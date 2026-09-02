const express = require('express');
const { createClient: createSupabaseClient } = require('@supabase/supabase-js');
const { z } = require('zod');
const { withGrowthContext, requireGrowthAdmin } = require('../lib/growth-context');
const { calculateGrowthMetrics, buildGrowthWarnings, validateGrowthPublication, serializeGrowthPeriod, buildGrowthPeriodTemplate } = require('../lib/growth-room');

const router = express.Router();
const uuid = z.string().uuid();
const text = z.string().trim().max(10000).nullable().optional();
const nonNegativeInt = z.coerce.number().int().min(0);
const nonNegative = z.coerce.number().min(0);

const clientSchema = z.object({
  companyName: z.string().trim().min(2).max(180), logoUrl: text, sector: text,
  contactName: text, contactEmail: z.string().trim().email().nullable().optional().or(z.literal('')),
  phone: text, mainGoal: text, status: z.enum(['active','paused','finished','archived']).default('active'),
});
const sourceSchema = z.object({
  id: uuid.optional(), sourceName: z.string().trim().min(1), contacts: nonNegativeInt.default(0),
  qualifiedContacts: nonNegativeInt.default(0), meetings: nonNegativeInt.default(0), proposals: nonNegativeInt.default(0),
  sales: nonNegativeInt.default(0), revenue: nonNegative.default(0), qualityLabel: z.enum(['low','medium','high','very_high']).default('medium'),
  strategicReading: text, externalId: text, sortOrder: z.coerce.number().int().default(0),
});
const campaignSchema = z.object({
  id: uuid.optional(), name: z.string().trim().min(1), objective: text, sourceName: text,
  investment: nonNegative.default(0), contacts: nonNegativeInt.default(0), sales: nonNegativeInt.default(0), revenue: nonNegative.default(0),
  status: z.enum(['testing','maintain','scale','optimize','pause','finished']).default('testing'), decision: text, note: text, externalId: text,
  sortOrder: z.coerce.number().int().default(0),
});
const decisionSchema = z.object({
  id: uuid.optional(), decision: z.string().trim().min(1), reason: text, owner: text,
  priority: z.enum(['low','medium','high']).default('medium'), status: z.enum(['next_action','in_progress','completed','cancelled']).default('next_action'),
  expectedImpact: text, sortOrder: z.coerce.number().int().default(0),
});
const readingSchema = z.object({
  whatHappened: text, whatDataShows: text, bottleneck: text, businessMeaning: text,
  recommendedDecision: text, nextActions: text, clientNeeds: text,
});
const reportSchema = z.object({
  executiveSummary: text, mainLearnings: text, whatWorked: text, whatDidNotWork: text, decisionsTaken: text, nextSteps: text,
});
const periodBaseSchema = z.object({
  periodName: z.string().trim().min(2).max(120), startDate: z.coerce.date(), endDate: z.coerce.date(),
  investment: nonNegative.default(0), contacts: nonNegativeInt.default(0), qualifiedContacts: nonNegativeInt.default(0),
  meetings: nonNegativeInt.default(0), proposals: nonNegativeInt.default(0), sales: nonNegativeInt.default(0),
  attributedRevenue: nonNegative.default(0), executiveSummary: text, mainBottleneck: text, recommendation: text,
  sourceSystem: z.string().trim().default('manual'), externalId: text,
});
const periodEditorSchema = periodBaseSchema.partial().extend({
  sources: z.array(sourceSchema).optional(), campaigns: z.array(campaignSchema).optional(),
  strategicReading: readingSchema.optional(), decisions: z.array(decisionSchema).optional(), report: reportSchema.optional(),
});
const periodCreateSchema = periodBaseSchema.extend({ templatePeriodId: uuid.optional() });

const periodInclude = {
  client: { select: { id: true, companyName: true, logoUrl: true, sector: true, mainGoal: true } },
  sources: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
  campaigns: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
  strategicReading: true,
  decisions: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
  report: true,
  publications: { orderBy: { version: 'desc' }, take: 1 },
};

function jsonPeriod(period) {
  return { ...period, metrics: calculateGrowthMetrics(period), warnings: buildGrowthWarnings(period) };
}
function handleError(res, error) {
  if (error instanceof z.ZodError) return res.status(400).json({ error: 'Dados inválidos.', details: error.issues });
  console.error('[growth-room]', error);
  return res.status(error.statusCode || 500).json({ error: error.message || 'Erro interno.' });
}
function run(handler) {
  return async (req, res) => {
    try { await withGrowthContext(req.user, (tx, context) => handler(req, res, tx, context)); }
    catch (error) { handleError(res, error); }
  };
}

router.get('/bootstrap', run(async (_req, res, _tx, context) => {
  res.json({ role: context.role, organization: context.membership?.organization || null, clientId: context.clientId });
}));

router.get('/clients', run(async (_req, res, tx, context) => {
  requireGrowthAdmin(context);
  const clients = await tx.growthClient.findMany({
    where: { organizationId: context.organizationId }, orderBy: { updatedAt: 'desc' },
    include: {
      accesses: { include: { user: { select: { id: true, name: true, email: true, active: true } } } },
      periods: { orderBy: { startDate: 'desc' }, take: 1, include: { publications: { orderBy: { version: 'desc' }, take: 1 } } },
    },
  });
  res.json(clients);
}));

router.post('/clients', run(async (req, res, tx, context) => {
  requireGrowthAdmin(context);
  const input = clientSchema.parse(req.body);
  const client = await tx.growthClient.create({ data: { ...input, contactEmail: input.contactEmail || null, organizationId: context.organizationId } });
  res.status(201).json(client);
}));

router.get('/clients/:id', run(async (req, res, tx, context) => {
  requireGrowthAdmin(context);
  const id = uuid.parse(req.params.id);
  const client = await tx.growthClient.findFirst({
    where: { id, organizationId: context.organizationId },
    include: { accesses: { include: { user: { select: { id: true, name: true, email: true, active: true } } } }, periods: { orderBy: { startDate: 'desc' }, include: { publications: { orderBy: { version: 'desc' }, take: 1 } } } },
  });
  if (!client) return res.status(404).json({ error: 'Cliente não encontrado.' });
  res.json(client);
}));

router.patch('/clients/:id', run(async (req, res, tx, context) => {
  requireGrowthAdmin(context);
  const id = uuid.parse(req.params.id); const input = clientSchema.partial().parse(req.body);
  const found = await tx.growthClient.findFirst({ where: { id, organizationId: context.organizationId } });
  if (!found) return res.status(404).json({ error: 'Cliente não encontrado.' });
  res.json(await tx.growthClient.update({ where: { id }, data: { ...input, contactEmail: input.contactEmail || null } }));
}));

router.post('/clients/:id/invitations', run(async (req, res, tx, context) => {
  requireGrowthAdmin(context);
  const clientId = uuid.parse(req.params.id);
  const input = z.object({ name: z.string().trim().min(2), email: z.string().trim().email() }).parse(req.body);
  const client = await tx.growthClient.findFirst({ where: { id: clientId, organizationId: context.organizationId } });
  if (!client) return res.status(404).json({ error: 'Cliente não encontrado.' });
  const email = input.email.toLowerCase();
  let user = await tx.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
  const existingOther = user ? await tx.growthClientAccess.findUnique({ where: { userId: user.id } }) : null;
  if (existingOther && existingOther.clientId !== clientId) throw Object.assign(new Error('Este utilizador já está associado a outro cliente.'), { statusCode: 409 });
  const admin = createSupabaseClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const defaultFrontend = process.env.NODE_ENV === 'production'
    ? 'https://mazanga-growth-room.vercel.app'
    : (process.env.FRONTEND_URL || 'http://localhost:3020');
  const redirectTo = `${process.env.GROWTH_FRONTEND_URL || defaultFrontend}/auth/callback?next=/change-password`;
  let createdAuthId = null;
  if (!user) {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo, data: { name: input.name } });
    if (error) throw Object.assign(new Error(error.message), { statusCode: 400 });
    createdAuthId = data.user.id;
    try {
      user = await tx.user.create({ data: { name: input.name, email, supabaseUid: createdAuthId, role: 'user', active: true, mustChangePassword: true, workspaceMode: 'servicos' } });
    } catch (error) {
      await admin.auth.admin.deleteUser(createdAuthId).catch(() => {});
      throw error;
    }
  } else {
    const { error } = await admin.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: redirectTo } });
    if (error) throw Object.assign(new Error(error.message), { statusCode: 400 });
  }
  let access;
  try {
    access = await tx.growthClientAccess.upsert({ where: { userId: user.id }, update: { clientId, active: true, invitedAt: new Date() }, create: { clientId, userId: user.id }, include: { user: { select: { id: true, name: true, email: true, active: true } } } });
  } catch (error) {
    if (createdAuthId) await admin.auth.admin.deleteUser(createdAuthId).catch(() => {});
    throw error;
  }
  res.status(201).json(access);
}));

router.post('/accesses/:id/revoke', run(async (req, res, tx, context) => {
  requireGrowthAdmin(context);
  const id = uuid.parse(req.params.id);
  const access = await tx.growthClientAccess.findFirst({ where: { id, client: { organizationId: context.organizationId } } });
  if (!access) return res.status(404).json({ error: 'Acesso não encontrado.' });
  await tx.growthClientAccess.update({ where: { id }, data: { active: false } });
  res.status(204).end();
}));

router.post('/clients/:id/periods', run(async (req, res, tx, context) => {
  requireGrowthAdmin(context);
  const clientId = uuid.parse(req.params.id); const input = periodCreateSchema.parse(req.body);
  const client = await tx.growthClient.findFirst({ where: { id: clientId, organizationId: context.organizationId } });
  if (!client) return res.status(404).json({ error: 'Cliente não encontrado.' });
  if (input.endDate < input.startDate) return res.status(400).json({ error: 'A data final deve ser posterior à inicial.' });
  const { templatePeriodId, ...periodData } = input;
  let template = null;
  if (templatePeriodId) {
    template = await tx.growthPerformancePeriod.findFirst({
      where: { id: templatePeriodId, clientId, client: { organizationId: context.organizationId } },
      include: { sources: true, campaigns: true, decisions: true },
    });
    if (!template) return res.status(404).json({ error: 'Período-base não encontrado.' });
  }
  const structure = buildGrowthPeriodTemplate(template);
  const period = await tx.growthPerformancePeriod.create({
    data: {
      ...periodData, clientId, status: 'draft',
      sources: structure.sources.length ? { create: structure.sources } : undefined,
      campaigns: structure.campaigns.length ? { create: structure.campaigns } : undefined,
      decisions: structure.decisions.length ? { create: structure.decisions } : undefined,
    },
    include: periodInclude,
  });
  res.status(201).json(jsonPeriod(period));
}));

router.get('/periods/:id', run(async (req, res, tx, context) => {
  requireGrowthAdmin(context);
  const period = await tx.growthPerformancePeriod.findFirst({ where: { id: uuid.parse(req.params.id), client: { organizationId: context.organizationId } }, include: periodInclude });
  if (!period) return res.status(404).json({ error: 'Período não encontrado.' });
  res.json(jsonPeriod(period));
}));

router.patch('/periods/:id', run(async (req, res, tx, context) => {
  requireGrowthAdmin(context);
  const id = uuid.parse(req.params.id); const input = periodEditorSchema.parse(req.body);
  const period = await tx.growthPerformancePeriod.findFirst({ where: { id, client: { organizationId: context.organizationId } } });
  if (!period) return res.status(404).json({ error: 'Período não encontrado.' });
  const { sources, campaigns, strategicReading, decisions, report, ...base } = input;
  if (base.startDate && base.endDate && base.endDate < base.startDate) return res.status(400).json({ error: 'A data final deve ser posterior à inicial.' });
  await tx.growthPerformancePeriod.update({ where: { id }, data: { ...base, status: period.status === 'archived' ? 'archived' : 'draft' } });
  if (sources) { await tx.growthContactSource.deleteMany({ where: { periodId: id } }); await tx.growthContactSource.createMany({ data: sources.map(({ id: _id, ...row }) => ({ ...row, periodId: id })) }); }
  if (campaigns) { await tx.growthCampaignAction.deleteMany({ where: { periodId: id } }); await tx.growthCampaignAction.createMany({ data: campaigns.map(({ id: _id, ...row }) => ({ ...row, periodId: id })) }); }
  if (decisions) { await tx.growthNextDecision.deleteMany({ where: { periodId: id } }); await tx.growthNextDecision.createMany({ data: decisions.map(({ id: _id, ...row }) => ({ ...row, periodId: id })) }); }
  if (strategicReading) await tx.growthStrategicReading.upsert({ where: { periodId: id }, update: strategicReading, create: { ...strategicReading, periodId: id } });
  if (report) await tx.growthPerformanceReport.upsert({ where: { periodId: id }, update: report, create: { ...report, periodId: id } });
  const updated = await tx.growthPerformancePeriod.findUnique({ where: { id }, include: periodInclude });
  res.json(jsonPeriod(updated));
}));

router.post('/periods/:id/publish', run(async (req, res, tx, context) => {
  requireGrowthAdmin(context);
  const id = uuid.parse(req.params.id);
  const period = await tx.growthPerformancePeriod.findFirst({ where: { id, client: { organizationId: context.organizationId } }, include: periodInclude });
  if (!period) return res.status(404).json({ error: 'Período não encontrado.' });
  const validation = validateGrowthPublication(period);
  if (!validation.valid) return res.status(400).json({ error: `Completa antes de publicar: ${validation.missing.join(', ')}.`, missing: validation.missing });
  const version = (period.publications[0]?.version || 0) + 1;
  const publication = await tx.growthPublication.create({ data: { periodId: id, version, snapshot: serializeGrowthPeriod(period), publishedById: req.user.id } });
  await tx.growthPerformancePeriod.update({ where: { id }, data: { status: 'published' } });
  res.status(201).json(publication);
}));

router.post('/periods/:id/archive', run(async (req, res, tx, context) => {
  requireGrowthAdmin(context); const id = uuid.parse(req.params.id);
  const period = await tx.growthPerformancePeriod.findFirst({ where: { id, client: { organizationId: context.organizationId } }, include: { publications: { take: 1 } } });
  if (!period) return res.status(404).json({ error: 'Período não encontrado.' });
  if (!period.publications.length) return res.status(400).json({ error: 'Um rascunho sem publicações deve ser eliminado, não arquivado.' });
  res.json(await tx.growthPerformancePeriod.update({ where: { id }, data: { status: 'archived', archivedAt: new Date() } }));
}));

router.delete('/periods/:id', run(async (req, res, tx, context) => {
  requireGrowthAdmin(context); const id = uuid.parse(req.params.id);
  const period = await tx.growthPerformancePeriod.findFirst({ where: { id, client: { organizationId: context.organizationId } }, include: { publications: { take: 1 } } });
  if (!period) return res.status(404).json({ error: 'Período não encontrado.' });
  if (period.publications.length) return res.status(409).json({ error: 'Períodos publicados só podem ser arquivados.' });
  await tx.growthPerformancePeriod.delete({ where: { id } }); res.status(204).end();
}));

router.get('/portal', run(async (req, res, tx, context) => {
  let clientId = context.clientId;
  if (context.role === 'mazanga_admin') {
    clientId = uuid.parse(req.query.clientId);
    const allowed = await tx.growthClient.findFirst({ where: { id: clientId, organizationId: context.organizationId }, select: { id: true } });
    if (!allowed) return res.status(404).json({ error: 'Cliente não encontrado.' });
  }
  const client = await tx.growthClient.findUnique({ where: { id: clientId } });
  const periods = await tx.growthPerformancePeriod.findMany({
    where: { clientId, publications: { some: {} } }, orderBy: { startDate: 'desc' },
    include: { publications: { orderBy: { version: 'desc' }, take: 1 } },
  });
  res.json({ client, periods: periods.map((period) => ({ id: period.id, periodName: period.periodName, startDate: period.startDate, endDate: period.endDate, status: period.status, publication: period.publications[0] })) });
}));

module.exports = router;
