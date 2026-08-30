const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const { invalidateAuthUserCacheByUserId } = require('../middleware/auth');
const {
  MANAGEMENT_ROLES,
  MANAGEMENT_STAGES,
  requireManagementRoles,
  withManagementContext,
} = require('../lib/management-context');
const { campaignKpis, calculateDashboard, goalProgress } = require('../lib/management-kpis');

const router = express.Router();
const uuid = z.string().uuid();
const nullableText = z.string().trim().max(5000).nullable().optional();
const nullableUuid = uuid.nullable().optional();
const nullableDate = z.coerce.date().nullable().optional();
const nonNegative = z.coerce.number().min(0);

const clientSchema = z.object({
  companyName: z.string().trim().min(2), contactName: z.string().trim().min(2), phone: nullableText,
  email: z.string().trim().email().nullable().optional().or(z.literal('')), contractedService: nullableText,
  monthlyValue: nonNegative.nullable().optional(), totalContractValue: nonNegative.nullable().optional(),
  startDate: nullableDate, expectedEndDate: nullableDate, contractDurationMonths: z.coerce.number().int().min(0).nullable().optional(),
  commercialResponsibleId: nullableUuid, operationalResponsibleId: nullableUuid,
  status: z.enum(['lead','em_negociacao','ativo','pausado','inativo','cancelado']).default('lead'),
  source: nullableText, notes: nullableText, cancellationDate: nullableDate, cancellationReason: nullableText,
});

const campaignSchema = z.object({
  name: z.string().trim().min(2), channel: z.string().trim().min(2), objective: z.string().trim().min(2),
  startDate: z.coerce.date(), endDate: nullableDate, status: z.string().trim().default('planeada'),
  responsibleUserId: nullableUuid, investment: nonNegative.default(0), impressions: z.coerce.number().int().min(0).default(0),
  reach: z.coerce.number().int().min(0).default(0), clicks: z.coerce.number().int().min(0).default(0),
  leads: z.coerce.number().int().min(0).default(0), qualifiedLeads: z.coerce.number().int().min(0).default(0),
  meetingsGenerated: z.coerce.number().int().min(0).default(0), clientsWon: z.coerce.number().int().min(0).default(0),
  attributedRevenue: nonNegative.default(0), notes: nullableText,
});

const opportunitySchema = z.object({
  clientId: nullableUuid, campaignId: nullableUuid, companyName: z.string().trim().min(2), contactName: z.string().trim().min(2),
  phone: nullableText, email: z.string().trim().email().nullable().optional().or(z.literal('')), leadSource: nullableText,
  responsibleUserId: nullableUuid, entryDate: z.coerce.date(), firstContactDate: nullableDate,
  lastInteractionDate: nullableDate, nextInteractionDate: nullableDate,
  stage: z.enum(MANAGEMENT_STAGES).default('lead_recebido'), estimatedValue: nonNegative.default(0),
  closeProbability: z.coerce.number().min(0).max(100).default(10), meetingDate: nullableDate, proposalDate: nullableDate,
  expectedCloseDate: nullableDate, actualCloseDate: nullableDate, result: nullableText, lossReason: nullableText, notes: nullableText,
});

const taskSchema = z.object({
  clientId: nullableUuid, project: nullableText, workType: z.string().trim().min(2), title: z.string().trim().min(2),
  description: nullableText, responsibleUserId: nullableUuid, requestDate: z.coerce.date(), startDate: nullableDate,
  deadline: z.coerce.date(), completionDate: nullableDate, priority: z.enum(['baixa','normal','alta','urgente']).default('normal'),
  status: z.enum(['pendente','em_producao','revisao_interna','enviado_cliente','revisao_cliente','aprovado','concluido','atrasado','cancelado']).default('pendente'),
  estimatedHours: nonNegative.nullable().optional(), actualHours: nonNegative.nullable().optional(),
  revisionCount: z.coerce.number().int().min(0).default(0), deliveredOnTime: z.boolean().nullable().optional(),
  clientApproved: z.boolean().default(false), delayReason: nullableText, notes: nullableText,
});

const transactionSchema = z.object({
  clientId: nullableUuid, date: z.coerce.date(), type: z.enum(['receita','despesa']), category: z.string().trim().min(2),
  subcategory: nullableText, project: nullableText, description: z.string().trim().min(2), expectedValue: nonNegative,
  actualValue: nonNegative.nullable().optional(), dueDate: nullableDate, paymentDate: nullableDate,
  status: z.enum(['previsto','pendente','pago','recebido','parcial','em_atraso','cancelado']),
  paymentMethod: nullableText, receiptUrl: z.string().url().nullable().optional().or(z.literal('')), notes: nullableText,
});

const goalSchema = z.object({
  month: z.coerce.number().int().min(1).max(12), year: z.coerce.number().int().min(2020).max(2100),
  area: z.enum(['empresa','marketing','comercial','operacional','financeiro']), kpi: z.string().trim().min(2),
  targetValue: nonNegative, unit: z.enum(['kz','percentagem','quantidade','horas','dias']),
  responsibleUserId: nullableUuid, notes: nullableText,
});

function partial(schema) { return schema.partial(); }
function asDateStart(value) { return value ? new Date(`${value}T00:00:00.000Z`) : undefined; }
function asDateEnd(value) { return value ? new Date(`${value}T23:59:59.999Z`) : undefined; }

function asyncRoute(handler) {
  return async (req, res) => {
    try { await handler(req, res); }
    catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: 'Dados inválidos.', fields: error.flatten().fieldErrors });
      const status = error.statusCode || 500;
      if (status >= 500) console.error('[management]', error);
      return res.status(status).json({ error: status >= 500 ? 'Erro interno ao processar a operação.' : error.message });
    }
  };
}

async function logActivity(tx, context, actionType, module, recordId, description, metadata) {
  return tx.managementActivityLog.create({ data: {
    organizationId: context.organizationId, userId: context.profileId, actionType, module,
    relatedRecordId: recordId || null, description, metadata: metadata || undefined,
  } });
}

function scopedWhere(context, req, dateField = 'createdAt') {
  const where = { organizationId: context.organizationId };
  const dateFrom = asDateStart(req.query.dateFrom);
  const dateTo = asDateEnd(req.query.dateTo);
  if (dateFrom || dateTo) where[dateField] = { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) };
  return where;
}

async function syncOverdueTasks(tx, context) {
  if (!['admin', 'designer', 'editor'].includes(context.role)) return;
  await tx.managementOperationalTask.updateMany({
    where: {
      organizationId: context.organizationId,
      ...(context.role === 'admin' ? {} : { responsibleUserId: context.profileId }),
      deadline: { lt: new Date() },
      completionDate: null,
      status: { notIn: ['concluido','cancelado','atrasado'] },
    },
    data: { status: 'atrasado' },
  });
}

async function dashboardData(tx, context, req) {
  await syncOverdueTasks(tx, context);
  const responsible = req.query.responsibleId || undefined;
  const clientId = req.query.clientId || undefined;
  const status = req.query.status || undefined;
  const channel = req.query.channel || undefined;
  const base = scopedWhere(context, req);
  const [clients, campaigns, opportunities, tasks, transactions] = await Promise.all([
    tx.managementClient.findMany({ where: { ...base, ...(clientId ? { id: clientId } : {}), ...(status ? { status } : {}), ...(responsible ? { OR: [{ commercialResponsibleId: responsible }, { operationalResponsibleId: responsible }] } : {}) } }),
    tx.managementCampaign.findMany({ where: { ...base, ...(channel ? { channel } : {}), ...(status ? { status } : {}), ...(responsible ? { responsibleUserId: responsible } : {}) } }),
    tx.managementOpportunity.findMany({ where: { ...base, ...(clientId ? { clientId } : {}), ...(status && MANAGEMENT_STAGES.includes(status) ? { stage: status } : {}), ...(responsible ? { responsibleUserId: responsible } : {}) } }),
    tx.managementOperationalTask.findMany({ where: { ...base, ...(clientId ? { clientId } : {}), ...(status ? { status } : {}), ...(responsible ? { responsibleUserId: responsible } : {}) }, include: { client: { select: { id: true, companyName: true } }, responsible: { select: { id: true, fullName: true, role: true } } } }),
    tx.managementFinancialTransaction.findMany({ where: { ...scopedWhere(context, req, 'date'), ...(clientId ? { clientId } : {}), ...(status ? { status } : {}) }, include: { client: { select: { id: true, companyName: true, contractedService: true } } } }),
  ]);
  return { clients, campaigns, opportunities, tasks, transactions, summary: calculateDashboard({ clients, campaigns, opportunities, tasks, transactions }) };
}

router.get('/bootstrap', asyncRoute(async (req, res) => {
  const data = await withManagementContext(req.user, async (tx, context) => {
    const profiles = await tx.managementProfile.findMany({ where: { organizationId: context.organizationId, active: true }, select: { id: true, fullName: true, role: true, active: true }, orderBy: { fullName: 'asc' } });
    const stages = await tx.managementPipelineStageSetting.findMany({ where: { organizationId: context.organizationId }, orderBy: { order: 'asc' } });
    return { profile: { id: context.profileId, fullName: context.profile.fullName, role: context.role }, organization: context.profile.organization, profiles, stages };
  });
  res.json(data);
}));

router.get('/users', asyncRoute(async (req, res) => {
  const data = await withManagementContext(req.user, async (tx, context) => {
    requireManagementRoles(context, ['admin']);
    return tx.managementProfile.findMany({ where: { organizationId: context.organizationId }, include: { user: { select: { id: true, email: true, lastSeenAt: true } } }, orderBy: { createdAt: 'asc' } });
  });
  res.json(data);
}));

router.post('/users', asyncRoute(async (req, res) => {
  const input = z.object({ name: z.string().trim().min(2), email: z.string().email(), password: z.string().min(8), role: z.enum(MANAGEMENT_ROLES.filter((role) => role !== 'admin')) }).parse(req.body);
  let authUserId = null;
  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const result = await withManagementContext(req.user, async (tx, context) => {
    requireManagementRoles(context, ['admin']);
    const existing = await tx.user.findFirst({ where: { email: { equals: input.email.toLowerCase(), mode: 'insensitive' } }, select: { id: true } });
    if (existing) { const error = new Error('Este email já está registado.'); error.statusCode = 409; throw error; }
    const createdAuth = await admin.auth.admin.createUser({ email: input.email.toLowerCase(), password: input.password, email_confirm: true, user_metadata: { name: input.name } });
    if (createdAuth.error) { const error = new Error(createdAuth.error.message); error.statusCode = 400; throw error; }
    authUserId = createdAuth.data.user.id;
    const user = await tx.user.create({ data: { name: input.name, email: input.email.toLowerCase(), supabaseUid: authUserId, role: input.role, active: true, mustChangePassword: true, accountOwnerId: req.user.effectiveUserId, workspaceMode: 'gestao_kpi' } });
    const profile = await tx.managementProfile.create({ data: { organizationId: context.organizationId, userId: user.id, authUserId, fullName: input.name, role: input.role, createdBy: context.profileId } });
    await logActivity(tx, context, 'utilizador_criado', 'utilizadores', profile.id, `Utilizador ${input.name} criado como ${input.role}.`);
    return { ...profile, user: { id: user.id, email: user.email } };
  }).catch(async (error) => { if (authUserId) await admin.auth.admin.deleteUser(authUserId).catch(() => {}); throw error; });
  res.status(201).json(result);
}));

router.patch('/users/:id', asyncRoute(async (req, res) => {
  const input = z.object({ role: z.enum(MANAGEMENT_ROLES).optional(), active: z.boolean().optional(), fullName: z.string().trim().min(2).optional() }).parse(req.body);
  const result = await withManagementContext(req.user, async (tx, context) => {
    requireManagementRoles(context, ['admin']);
    const profile = await tx.managementProfile.findFirst({ where: { id: req.params.id, organizationId: context.organizationId }, include: { user: true } });
    if (!profile) { const error = new Error('Utilizador não encontrado.'); error.statusCode = 404; throw error; }
    if (profile.id === context.profileId && input.active === false) { const error = new Error('Não pode desativar o próprio perfil.'); error.statusCode = 400; throw error; }
    const updated = await tx.managementProfile.update({ where: { id: profile.id }, data: input });
    await tx.user.update({ where: { id: profile.userId }, data: { ...(input.role ? { role: input.role } : {}), ...(input.active !== undefined ? { active: input.active } : {}), ...(input.fullName ? { name: input.fullName } : {}) } });
    invalidateAuthUserCacheByUserId(profile.userId);
    await logActivity(tx, context, 'utilizador_atualizado', 'utilizadores', profile.id, `Utilizador ${updated.fullName} atualizado.`);
    return updated;
  });
  res.json(result);
}));

router.get('/clients', asyncRoute(async (req, res) => {
  const data = await withManagementContext(req.user, async (tx, context) => {
    requireManagementRoles(context, ['admin','commercial']);
    const search = String(req.query.search || '').trim(); const status = req.query.status;
    return tx.managementClient.findMany({ where: { organizationId: context.organizationId, archivedAt: req.query.archived === 'true' ? { not: null } : null, ...(status ? { status } : {}), ...(search ? { OR: [{ companyName: { contains: search, mode: 'insensitive' } }, { contactName: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }] } : {}) }, include: { commercialResponsible: { select: { id: true, fullName: true } }, operationalResponsible: { select: { id: true, fullName: true } } }, orderBy: { createdAt: 'desc' } });
  }); res.json(data);
}));

router.get('/clients/:id', asyncRoute(async (req, res) => {
  const data = await withManagementContext(req.user, async (tx, context) => {
    requireManagementRoles(context, ['admin','commercial']);
    const client = await tx.managementClient.findFirst({ where: { id: req.params.id, organizationId: context.organizationId }, include: { opportunities: true, operationalTasks: true, transactions: true, commercialResponsible: true, operationalResponsible: true } });
    if (!client) { const error = new Error('Cliente não encontrado.'); error.statusCode = 404; throw error; }
    const activities = await tx.managementActivityLog.findMany({ where: { organizationId: context.organizationId, relatedRecordId: client.id }, orderBy: { createdAt: 'desc' }, take: 30 });
    return { ...client, activities };
  }); res.json(data);
}));

router.post('/clients', asyncRoute(async (req, res) => {
  const input = clientSchema.parse(req.body); const data = await withManagementContext(req.user, async (tx, context) => {
    requireManagementRoles(context, ['admin','commercial']);
    const client = await tx.managementClient.create({ data: { ...input, email: input.email || null, organizationId: context.organizationId, createdBy: context.profileId } });
    await logActivity(tx, context, 'cliente_criado', 'clientes', client.id, `Cliente ${client.companyName} criado.`); return client;
  }); res.status(201).json(data);
}));

router.patch('/clients/:id', asyncRoute(async (req, res) => {
  const input = partial(clientSchema).parse(req.body); const data = await withManagementContext(req.user, async (tx, context) => {
    requireManagementRoles(context, ['admin','commercial']);
    const found = await tx.managementClient.findFirst({ where: { id: req.params.id, organizationId: context.organizationId } });
    if (!found) { const error = new Error('Cliente não encontrado.'); error.statusCode = 404; throw error; }
    const client = await tx.managementClient.update({ where: { id: found.id }, data: { ...input, email: input.email || undefined } });
    await logActivity(tx, context, 'cliente_atualizado', 'clientes', client.id, `Cliente ${client.companyName} atualizado.`); return client;
  }); res.json(data);
}));

router.post('/clients/:id/archive', asyncRoute(async (req, res) => {
  const data = await withManagementContext(req.user, async (tx, context) => { requireManagementRoles(context, ['admin']); const client = await tx.managementClient.update({ where: { id: req.params.id }, data: { archivedAt: new Date() } }); await logActivity(tx, context, 'cliente_arquivado', 'clientes', client.id, `Cliente ${client.companyName} arquivado.`); return client; }); res.json(data);
}));

router.delete('/clients/:id', asyncRoute(async (req, res) => {
  await withManagementContext(req.user, async (tx, context) => { requireManagementRoles(context, ['admin']); const client = await tx.managementClient.findFirst({ where: { id: req.params.id, organizationId: context.organizationId }, include: { _count: { select: { opportunities: true, operationalTasks: true, transactions: true } } } }); if (!client) { const error = new Error('Cliente não encontrado.'); error.statusCode = 404; throw error; } if (Object.values(client._count).some(Boolean)) { const error = new Error('O cliente possui registos relacionados. Arquive-o em vez de eliminar.'); error.statusCode = 409; throw error; } await tx.managementClient.delete({ where: { id: client.id } }); }); res.status(204).end();
}));

router.get('/campaigns', asyncRoute(async (req, res) => { const data = await withManagementContext(req.user, async (tx, context) => { requireManagementRoles(context, ['admin','marketing']); const rows = await tx.managementCampaign.findMany({ where: { organizationId: context.organizationId }, include: { responsible: { select: { id: true, fullName: true } } }, orderBy: { startDate: 'desc' } }); return rows.map((row) => ({ ...row, kpis: campaignKpis(row) })); }); res.json(data); }));
router.post('/campaigns', asyncRoute(async (req, res) => { const input = campaignSchema.parse(req.body); const data = await withManagementContext(req.user, async (tx, context) => { requireManagementRoles(context, ['admin','marketing']); const row = await tx.managementCampaign.create({ data: { ...input, organizationId: context.organizationId, createdBy: context.profileId } }); await logActivity(tx, context, 'campanha_criada', 'marketing', row.id, `Campanha ${row.name} criada.`); return { ...row, kpis: campaignKpis(row) }; }); res.status(201).json(data); }));
router.patch('/campaigns/:id', asyncRoute(async (req, res) => { const input = partial(campaignSchema).parse(req.body); const data = await withManagementContext(req.user, async (tx, context) => { requireManagementRoles(context, ['admin','marketing']); const row = await tx.managementCampaign.update({ where: { id: req.params.id }, data: input }); await logActivity(tx, context, 'campanha_atualizada', 'marketing', row.id, `Campanha ${row.name} atualizada.`); return { ...row, kpis: campaignKpis(row) }; }); res.json(data); }));
router.delete('/campaigns/:id', asyncRoute(async (req, res) => { await withManagementContext(req.user, async (tx, context) => { requireManagementRoles(context, ['admin']); await tx.managementCampaign.delete({ where: { id: req.params.id } }); }); res.status(204).end(); }));

router.get('/opportunities', asyncRoute(async (req, res) => { const data = await withManagementContext(req.user, async (tx, context) => { requireManagementRoles(context, ['admin','commercial']); return tx.managementOpportunity.findMany({ where: { organizationId: context.organizationId, ...(req.query.stage ? { stage: req.query.stage } : {}) }, include: { responsible: { select: { id: true, fullName: true } }, client: { select: { id: true, companyName: true } }, stageHistory: { orderBy: { changedAt: 'desc' } } }, orderBy: { updatedAt: 'desc' } }); }); res.json(data); }));
router.post('/opportunities', asyncRoute(async (req, res) => { const input = opportunitySchema.parse(req.body); const data = await withManagementContext(req.user, async (tx, context) => { requireManagementRoles(context, ['admin','commercial']); const setting = await tx.managementPipelineStageSetting.findFirst({ where: { organizationId: context.organizationId, stage: input.stage } }); const row = await tx.managementOpportunity.create({ data: { ...input, organizationId: context.organizationId, closeProbability: setting?.probability ?? input.closeProbability, createdBy: context.profileId } }); await tx.managementOpportunityStageHistory.create({ data: { organizationId: context.organizationId, opportunityId: row.id, userId: context.profileId, newStage: row.stage, notes: 'Oportunidade criada' } }); await logActivity(tx, context, 'lead_criado', 'comercial', row.id, `Oportunidade ${row.companyName} criada.`); return row; }); res.status(201).json(data); }));
router.patch('/opportunities/:id', asyncRoute(async (req, res) => { const input = partial(opportunitySchema.omit({ stage: true })).parse(req.body); const data = await withManagementContext(req.user, async (tx, context) => { requireManagementRoles(context, ['admin','commercial']); const row = await tx.managementOpportunity.update({ where: { id: req.params.id }, data: input }); await logActivity(tx, context, 'oportunidade_atualizada', 'comercial', row.id, `Oportunidade ${row.companyName} atualizada.`); return row; }); res.json(data); }));
router.post('/opportunities/:id/stage', asyncRoute(async (req, res) => { const input = z.object({ stage: z.enum(MANAGEMENT_STAGES), notes: nullableText }).parse(req.body); const data = await withManagementContext(req.user, async (tx, context) => { requireManagementRoles(context, ['admin','commercial']); const current = await tx.managementOpportunity.findFirst({ where: { id: req.params.id, organizationId: context.organizationId } }); if (!current) { const error = new Error('Oportunidade não encontrada.'); error.statusCode = 404; throw error; } const setting = await tx.managementPipelineStageSetting.findFirst({ where: { organizationId: context.organizationId, stage: input.stage } }); const update = { stage: input.stage, stageChangedAt: new Date(), closeProbability: setting?.probability ?? current.closeProbability, ...(input.stage === 'ganho' || input.stage === 'perdido' ? { actualCloseDate: new Date(), result: input.stage } : {}) }; let clientId = current.clientId; if (input.stage === 'ganho' && !clientId) { const client = await tx.managementClient.create({ data: { organizationId: context.organizationId, companyName: current.companyName, contactName: current.contactName, phone: current.phone, email: current.email, source: current.leadSource, status: 'ativo', commercialResponsibleId: current.responsibleUserId, createdBy: context.profileId } }); clientId = client.id; update.clientId = client.id; } else if (input.stage === 'ganho' && clientId) { await tx.managementClient.update({ where: { id: clientId }, data: { status: 'ativo' } }); } const row = await tx.managementOpportunity.update({ where: { id: current.id }, data: update }); await tx.managementOpportunityStageHistory.create({ data: { organizationId: context.organizationId, opportunityId: row.id, userId: context.profileId, previousStage: current.stage, newStage: input.stage, notes: input.notes } }); await logActivity(tx, context, 'etapa_alterada', 'comercial', row.id, `${current.companyName}: ${current.stage} → ${input.stage}.`); return row; }); res.json(data); }));
router.delete('/opportunities/:id', asyncRoute(async (req, res) => { await withManagementContext(req.user, async (tx, context) => { requireManagementRoles(context, ['admin']); await tx.managementOpportunity.delete({ where: { id: req.params.id } }); }); res.status(204).end(); }));

router.get('/stages', asyncRoute(async (req, res) => { const data = await withManagementContext(req.user, (tx, context) => tx.managementPipelineStageSetting.findMany({ where: { organizationId: context.organizationId }, orderBy: { order: 'asc' } })); res.json(data); }));
router.patch('/stages/:id', asyncRoute(async (req, res) => { const input = z.object({ probability: z.coerce.number().min(0).max(100), label: z.string().trim().min(2).optional() }).parse(req.body); const data = await withManagementContext(req.user, async (tx, context) => { requireManagementRoles(context, ['admin']); return tx.managementPipelineStageSetting.update({ where: { id: req.params.id }, data: input }); }); res.json(data); }));

router.get('/tasks', asyncRoute(async (req, res) => { const data = await withManagementContext(req.user, async (tx, context) => { requireManagementRoles(context, ['admin','designer','editor']); await syncOverdueTasks(tx, context); return tx.managementOperationalTask.findMany({ where: { organizationId: context.organizationId, ...(context.role === 'admin' ? {} : { responsibleUserId: context.profileId }), ...(req.query.status ? { status: req.query.status } : {}) }, include: { client: { select: { id: true, companyName: true } }, responsible: { select: { id: true, fullName: true, role: true } } }, orderBy: { deadline: 'asc' } }); }); res.json(data); }));
router.post('/tasks', asyncRoute(async (req, res) => { const input = taskSchema.parse(req.body); const data = await withManagementContext(req.user, async (tx, context) => { requireManagementRoles(context, ['admin']); const row = await tx.managementOperationalTask.create({ data: { ...input, organizationId: context.organizationId, createdBy: context.profileId } }); await logActivity(tx, context, 'trabalho_criado', 'operacional', row.id, `Trabalho ${row.title} criado.`); return row; }); res.status(201).json(data); }));
router.patch('/tasks/:id', asyncRoute(async (req, res) => { const input = partial(taskSchema).parse(req.body); const data = await withManagementContext(req.user, async (tx, context) => { requireManagementRoles(context, ['admin','designer','editor']); const current = await tx.managementOperationalTask.findFirst({ where: { id: req.params.id, organizationId: context.organizationId, ...(context.role === 'admin' ? {} : { responsibleUserId: context.profileId }) } }); if (!current) { const error = new Error('Trabalho não encontrado.'); error.statusCode = 404; throw error; } const allowed = context.role === 'admin' ? input : Object.fromEntries(Object.entries(input).filter(([key]) => ['status','actualHours','revisionCount','completionDate','clientApproved','delayReason','notes'].includes(key))); if (allowed.status === 'concluido') { allowed.completionDate = allowed.completionDate || new Date(); allowed.deliveredOnTime = new Date(allowed.completionDate) <= new Date(current.deadline); } const row = await tx.managementOperationalTask.update({ where: { id: current.id }, data: allowed }); if (row.status === 'concluido' && current.status !== 'concluido') await logActivity(tx, context, 'trabalho_concluido', 'operacional', row.id, `Trabalho ${row.title} concluído.`); return row; }); res.json(data); }));
router.delete('/tasks/:id', asyncRoute(async (req, res) => { await withManagementContext(req.user, async (tx, context) => { requireManagementRoles(context, ['admin']); await tx.managementOperationalTask.delete({ where: { id: req.params.id } }); }); res.status(204).end(); }));

router.get('/transactions', asyncRoute(async (req, res) => { const data = await withManagementContext(req.user, async (tx, context) => { requireManagementRoles(context, ['admin']); return tx.managementFinancialTransaction.findMany({ where: { ...scopedWhere(context, req, 'date'), ...(req.query.type ? { type: req.query.type } : {}), ...(req.query.status ? { status: req.query.status } : {}) }, include: { client: { select: { id: true, companyName: true } } }, orderBy: { date: 'desc' } }); }); res.json(data); }));
router.post('/transactions', asyncRoute(async (req, res) => { const input = transactionSchema.parse(req.body); const data = await withManagementContext(req.user, async (tx, context) => { requireManagementRoles(context, ['admin']); const row = await tx.managementFinancialTransaction.create({ data: { ...input, receiptUrl: input.receiptUrl || null, organizationId: context.organizationId, createdBy: context.profileId } }); await logActivity(tx, context, 'transacao_registada', 'financas', row.id, `${row.type === 'receita' ? 'Receita' : 'Despesa'} registada: ${row.description}.`); return row; }); res.status(201).json(data); }));
router.patch('/transactions/:id', asyncRoute(async (req, res) => { const input = partial(transactionSchema).parse(req.body); const data = await withManagementContext(req.user, async (tx, context) => { requireManagementRoles(context, ['admin']); return tx.managementFinancialTransaction.update({ where: { id: req.params.id }, data: input }); }); res.json(data); }));
router.delete('/transactions/:id', asyncRoute(async (req, res) => { await withManagementContext(req.user, async (tx, context) => { requireManagementRoles(context, ['admin']); await tx.managementFinancialTransaction.delete({ where: { id: req.params.id } }); }); res.status(204).end(); }));

router.get('/goals', asyncRoute(async (req, res) => { const data = await withManagementContext(req.user, async (tx, context) => { requireManagementRoles(context, ['admin']); const dashboard = await dashboardData(tx, context, req); const values = dashboard.summary.cards; const goals = await tx.managementGoal.findMany({ where: { organizationId: context.organizationId, ...(req.query.month ? { month: Number(req.query.month) } : {}), ...(req.query.year ? { year: Number(req.query.year) } : {}) }, include: { responsible: { select: { id: true, fullName: true } } }, orderBy: [{ year: 'desc' }, { month: 'desc' }] }); return Promise.all(goals.map(async (goal) => { const actual = values[goal.kpi]; if (actual !== undefined && actual !== null) await tx.managementGoal.update({ where: { id: goal.id }, data: { actualValue: actual, calculatedAt: new Date() } }); const realized = actual ?? Number(goal.actualValue || 0); return { ...goal, actualValue: realized, ...goalProgress(realized, goal.targetValue) }; })); }); res.json(data); }));
router.post('/goals', asyncRoute(async (req, res) => { const input = goalSchema.parse(req.body); const data = await withManagementContext(req.user, async (tx, context) => { requireManagementRoles(context, ['admin']); const row = await tx.managementGoal.create({ data: { ...input, organizationId: context.organizationId, createdBy: context.profileId } }); await logActivity(tx, context, 'meta_criada', 'metas', row.id, `Meta ${row.kpi} criada.`); return row; }); res.status(201).json(data); }));
router.patch('/goals/:id', asyncRoute(async (req, res) => { const input = partial(goalSchema).parse(req.body); const data = await withManagementContext(req.user, async (tx, context) => { requireManagementRoles(context, ['admin']); return tx.managementGoal.update({ where: { id: req.params.id }, data: input }); }); res.json(data); }));
router.delete('/goals/:id', asyncRoute(async (req, res) => { await withManagementContext(req.user, async (tx, context) => { requireManagementRoles(context, ['admin']); await tx.managementGoal.delete({ where: { id: req.params.id } }); }); res.status(204).end(); }));

router.get('/dashboard', asyncRoute(async (req, res) => { const data = await withManagementContext(req.user, async (tx, context) => { const dashboard = await dashboardData(tx, context, req); const activities = context.role === 'admin' ? await tx.managementActivityLog.findMany({ where: { organizationId: context.organizationId }, include: { user: { select: { fullName: true } } }, orderBy: { createdAt: 'desc' }, take: 10 }) : []; return { role: context.role, ...dashboard, activities }; }); res.json(data); }));
router.get('/activities', asyncRoute(async (req, res) => { const data = await withManagementContext(req.user, async (tx, context) => { requireManagementRoles(context, ['admin']); return tx.managementActivityLog.findMany({ where: { organizationId: context.organizationId }, include: { user: { select: { fullName: true } } }, orderBy: { createdAt: 'desc' }, take: 100 }); }); res.json(data); }));
router.get('/reports/:module', asyncRoute(async (req, res) => { const data = await withManagementContext(req.user, async (tx, context) => { requireManagementRoles(context, ['admin']); const dashboard = await dashboardData(tx, context, req); const modules = { marketing: dashboard.campaigns, comercial: dashboard.opportunities, operacional: dashboard.tasks, financeiro: dashboard.transactions, clientes: dashboard.clients, geral: dashboard }; return modules[req.params.module] ?? dashboard; }); res.json(data); }));

module.exports = router;
