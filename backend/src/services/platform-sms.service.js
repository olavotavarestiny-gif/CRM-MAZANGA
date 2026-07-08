const prisma = require('../lib/prisma');
const { sendSms } = require('./sms.service');
const ziettService = require('./ziett.service');
const { SUPER_ADMIN_EMAILS } = require('../middleware/auth');

/**
 * SMS interno da plataforma — orquestração de segmentos, campanhas, histórico
 * e estatísticas para a equipa KukuGest comunicar com os utilizadores.
 *
 * Reutiliza o serviço central `sms.service.sendSms` (sem duplicar a chamada ao
 * provider) e regista cada envio em PlatformSmsMessage. Separado dos modelos
 * Messaging* (que são para os contactos dos clientes).
 */

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const PREVIEW_SAMPLE_SIZE = 50;
const MAX_CAMPAIGN_RECIPIENTS = 500; // limite de segurança para evitar disparos acidentais
const DEFAULT_WINDOW_DAYS = 7;

const MESSAGE_STATUS_MAP = {
  PENDING: 'queued',
  PROCESSING: 'queued',
  SENDING: 'queued',
  SENT: 'sent',
  DELIVERED: 'delivered',
  FAILED: 'failed',
  UNDELIVERED: 'failed',
  EXPIRED: 'failed',
  REJECTED: 'failed',
  CANCELLED: 'failed',
};

const SUCCESS_STATUSES = new Set(['sent', 'delivered']);
const FAILED_STATUSES = new Set(['failed']);
const QUEUED_STATUSES = new Set(['queued']);

class PlatformSmsError extends Error {
  constructor(message, { status = 400, code = 'PLATFORM_SMS_ERROR' } = {}) {
    super(message);
    this.name = 'PlatformSmsError';
    this.status = status;
    this.code = code;
  }
}

function formatError(error) {
  if (error instanceof PlatformSmsError) {
    return { status: error.status, body: { error: error.message, code: error.code } };
  }
  console.error('[platform-sms] error:', error);
  return { status: 500, body: { error: error.message || 'Erro interno', code: 'INTERNAL' } };
}

function compactObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined)
  );
}

function getPathValue(source, path) {
  if (!source) return undefined;
  return path.split('.').reduce((value, key) => {
    if (value === undefined || value === null) return undefined;
    return value[key];
  }, source);
}

function pickFirstValue(source, paths) {
  for (const path of paths) {
    const value = getPathValue(source, path);
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return undefined;
}

function pickFirstString(source, paths) {
  const value = pickFirstValue(source, paths);
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function normalizeProviderStatus(rawStatus) {
  if (!rawStatus) return null;
  const normalized = String(rawStatus).trim().toUpperCase();
  return MESSAGE_STATUS_MAP[normalized] || String(rawStatus).trim().toLowerCase();
}

function extractMessageProviderStatus(response) {
  return pickFirstString(response, [
    'status',
    'provider_status',
    'providerStatus',
    'message.status',
    'message.provider_status',
    'message.providerStatus',
    'data.status',
    'data.provider_status',
    'data.providerStatus',
    'delivery.status',
    'delivery_status',
    'deliveryStatus',
  ]);
}

function buildProviderErrorFields(response) {
  return {
    errorCode: pickFirstString(response, [
      'error_code',
      'errorCode',
      'code',
      'error.code',
      'data.error_code',
      'data.errorCode',
      'data.code',
    ]) || undefined,
    errorMessage: pickFirstString(response, [
      'error_message',
      'errorMessage',
      'message',
      'detail',
      'error.message',
      'data.error_message',
      'data.errorMessage',
      'data.message',
      'data.detail',
    ]) || undefined,
  };
}

function assertZiettEnabled() {
  if (String(process.env.ZIETT_ENABLE || '').trim().toLowerCase() !== 'true') {
    throw new PlatformSmsError('A integração Ziett está desativada neste ambiente.', {
      status: 503,
      code: 'PLATFORM_SMS_DISABLED',
    });
  }
}

const SEGMENTS = {
  all_users: { label: 'Todos os utilizadores' },
  inactive_7_days: { label: 'Inativos há 7 dias' },
  inactive_14_days: { label: 'Inativos há 14 dias' },
  trial_ending: { label: 'Trial a terminar' },
  trial_expired: { label: 'Trial expirado' },
  payment_due_soon: { label: 'Pagamento próximo' },
  payment_overdue: { label: 'Pagamento vencido' },
  onboarding_incomplete: { label: 'Onboarding incompleto' },
  workspace_servicos: { label: 'Workspace Serviços' },
  workspace_comercio: { label: 'Workspace Comércio' },
};

function listSegments() {
  return Object.entries(SEGMENTS).map(([type, value]) => ({ type, label: value.label }));
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function hasUsablePhone(phone) {
  return typeof phone === 'string' && phone.trim().length > 0;
}

// Base: apenas donos de conta (account owners) ativos, excluindo superadmins.
function baseOwnerWhere(extra = {}) {
  const where = { ...extra, accountOwnerId: null, isSuperAdmin: false, active: true };
  if (SUPER_ADMIN_EMAILS.length > 0) {
    where.NOT = SUPER_ADMIN_EMAILS.map((email) => ({ email: { equals: email, mode: 'insensitive' } }));
  }
  return where;
}

function clampPage(value) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_PAGE;
}

function clampPageSize(value) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(n, MAX_PAGE_SIZE);
}

function renderTemplate(template, recipient) {
  const fullName = (recipient.name || '').trim();
  const firstName = fullName.split(/\s+/)[0] || fullName;
  return String(template || '')
    .replace(/\{\{\s*nome\s*\}\}/gi, firstName)
    .replace(/\{\{\s*name\s*\}\}/gi, firstName);
}

/**
 * Resolve os destinatários elegíveis de um segmento.
 * Devolve { recipients, totalCandidates, withoutPhone }.
 */
async function resolveSegmentRecipients(segmentType, filters = {}) {
  if (!SEGMENTS[segmentType]) {
    throw new PlatformSmsError(`Segmento inválido: ${segmentType}`, { code: 'INVALID_SEGMENT' });
  }

  const now = new Date();
  const days = Number.isFinite(Number(filters.days)) && Number(filters.days) > 0
    ? Number(filters.days)
    : DEFAULT_WINDOW_DAYS;

  let where;
  switch (segmentType) {
    case 'trial_ending':
      where = baseOwnerWhere({ billingType: 'trial', trialEndsAt: { gte: now, lte: addDays(now, days) } });
      break;
    case 'trial_expired':
      where = baseOwnerWhere({ billingType: 'trial', trialEndsAt: { lt: now } });
      break;
    case 'payment_due_soon':
      where = baseOwnerWhere({ billingType: 'paid', expiresAt: { gte: now, lte: addDays(now, days) } });
      break;
    case 'payment_overdue':
      where = baseOwnerWhere({ billingType: 'paid', expiresAt: { lt: now } });
      break;
    case 'workspace_servicos':
      where = baseOwnerWhere({ workspaceMode: 'servicos' });
      break;
    case 'workspace_comercio':
      where = baseOwnerWhere({ workspaceMode: 'comercio' });
      break;
    default:
      where = baseOwnerWhere();
      break;
  }

  const needsMembers = ['inactive_7_days', 'inactive_14_days', 'onboarding_incomplete'].includes(segmentType);
  const select = {
    id: true, name: true, phone: true, email: true,
    plan: true, workspaceMode: true, billingType: true,
    trialEndsAt: true, expiresAt: true, accountStatus: true,
  };
  if (needsMembers) select.accountMembers = { select: { id: true } };

  const owners = await prisma.user.findMany({ where, select, orderBy: { createdAt: 'desc' } });

  const allUserIds = (list) => {
    const ids = [];
    list.forEach((o) => {
      ids.push(o.id);
      (o.accountMembers || []).forEach((m) => ids.push(m.id));
    });
    return ids;
  };

  let candidates = owners;

  if (segmentType === 'inactive_7_days' || segmentType === 'inactive_14_days') {
    const windowDays = segmentType === 'inactive_7_days' ? 7 : 14;
    const cutoff = addDays(now, -windowDays);
    const ids = allUserIds(owners);
    const recentLogins = ids.length
      ? await prisma.loginLog.findMany({ where: { userId: { in: ids }, createdAt: { gte: cutoff } }, select: { userId: true } })
      : [];
    const activeSet = new Set(recentLogins.map((l) => l.userId));
    candidates = owners.filter((o) => {
      const memberIds = [o.id, ...(o.accountMembers || []).map((m) => m.id)];
      return !memberIds.some((id) => activeSet.has(id));
    });
  }

  if (segmentType === 'onboarding_incomplete') {
    const ids = allUserIds(owners);
    const withContacts = ids.length
      ? await prisma.contact.findMany({ where: { userId: { in: ids } }, select: { userId: true }, distinct: ['userId'] })
      : [];
    const hasContactSet = new Set(withContacts.map((c) => c.userId));
    candidates = owners.filter((o) => {
      const memberIds = [o.id, ...(o.accountMembers || []).map((m) => m.id)];
      return !memberIds.some((id) => hasContactSet.has(id));
    });
  }

  const recipients = candidates
    .filter((o) => hasUsablePhone(o.phone))
    .map((o) => ({
      userId: o.id,
      accountOwnerId: o.id,
      name: o.name,
      phone: o.phone.trim(),
      email: o.email,
      plan: o.plan,
      workspaceMode: o.workspaceMode,
    }));

  return {
    recipients,
    totalCandidates: candidates.length,
    withoutPhone: candidates.length - recipients.length,
  };
}

async function previewCampaign({ segmentType, segmentFilters } = {}) {
  const { recipients, totalCandidates, withoutPhone } = await resolveSegmentRecipients(segmentType, segmentFilters || {});
  return {
    segmentType,
    totalRecipients: recipients.length,
    totalCandidates,
    withoutPhone,
    sample: recipients.slice(0, PREVIEW_SAMPLE_SIZE).map((r) => ({
      name: r.name,
      phone: r.phone,
      email: r.email,
      plan: r.plan,
    })),
  };
}

async function createAndSendCampaign(user, body = {}) {
  const name = String(body.name || '').trim();
  const message = String(body.message || '').trim();
  const segmentType = body.segmentType;
  const segmentFilters = body.segmentFilters && typeof body.segmentFilters === 'object' ? body.segmentFilters : null;
  const senderName = body.senderName ? String(body.senderName).trim() : null;
  const isTest = body.isTest === undefined ? true : Boolean(body.isTest); // default seguro: só allowlist

  if (!name) throw new PlatformSmsError('O nome da campanha é obrigatório.', { code: 'INVALID_NAME' });
  if (!message) throw new PlatformSmsError('A mensagem é obrigatória.', { code: 'INVALID_MESSAGE' });
  if (!SEGMENTS[segmentType]) throw new PlatformSmsError('Segmento inválido.', { code: 'INVALID_SEGMENT' });

  const { recipients } = await resolveSegmentRecipients(segmentType, segmentFilters || {});
  if (recipients.length === 0) {
    throw new PlatformSmsError('Sem destinatários elegíveis com telefone para este segmento.', { code: 'NO_RECIPIENTS' });
  }
  if (recipients.length > MAX_CAMPAIGN_RECIPIENTS) {
    throw new PlatformSmsError(
      `Limite de segurança: ${recipients.length} destinatários excede o máximo de ${MAX_CAMPAIGN_RECIPIENTS}. Refine o segmento.`,
      { code: 'TOO_MANY_RECIPIENTS' }
    );
  }

  const campaign = await prisma.platformSmsCampaign.create({
    data: {
      name,
      message,
      segmentType,
      segmentFiltersJson: segmentFilters || undefined,
      status: 'sending',
      totalRecipients: recipients.length,
      senderName,
      createdByUserId: user.id,
      startedAt: new Date(),
    },
  });

  let sentCount = 0;
  let failedCount = 0;

  for (const recipient of recipients) {
    const content = renderTemplate(message, recipient);
    const result = await sendSms({
      phone: recipient.phone,
      message: content,
      senderName,
      isTest,
      metadata: { campaignId: campaign.id, targetUserId: recipient.userId },
    });

    if (result.success) sentCount += 1;
    else failedCount += 1;

    await prisma.platformSmsMessage.create({
      data: {
        targetUserId: recipient.userId,
        targetAccountOwnerId: recipient.accountOwnerId,
        phone: result.phoneNormalized || recipient.phone,
        recipientName: recipient.name,
        message: content,
        senderName,
        status: result.success ? 'sent' : 'failed',
        providerMessageId: result.providerMessageId || null,
        providerStatus: result.providerStatus || null,
        errorCode: result.errorCode || null,
        errorMessage: result.errorMessage || null,
        triggerSource: 'CAMPAIGN',
        campaignId: campaign.id,
        isTest,
        rawResponseJson: result.raw || undefined,
        sentAt: result.success ? new Date() : null,
        createdByUserId: user.id,
      },
    });
  }

  const finalStatus = sentCount === 0 && failedCount > 0 ? 'failed' : 'completed';
  return prisma.platformSmsCampaign.update({
    where: { id: campaign.id },
    data: { status: finalStatus, sentCount, failedCount, completedAt: new Date() },
    include: { _count: { select: { messages: true } } },
  });
}

async function listCampaigns(query = {}) {
  const page = clampPage(query.page);
  const pageSize = clampPageSize(query.pageSize);
  const where = {};
  if (query.status) where.status = String(query.status);
  if (query.segmentType) where.segmentType = String(query.segmentType);

  const [total, items] = await Promise.all([
    prisma.platformSmsCampaign.count({ where }),
    prisma.platformSmsCampaign.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { _count: { select: { messages: true } } },
    }),
  ]);

  return { items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}

async function getCampaignDetail(id, query = {}) {
  const campaign = await prisma.platformSmsCampaign.findUnique({
    where: { id },
    include: { _count: { select: { messages: true } } },
  });
  if (!campaign) throw new PlatformSmsError('Campanha não encontrada.', { status: 404, code: 'NOT_FOUND' });

  const page = clampPage(query.page);
  const pageSize = clampPageSize(query.pageSize);
  const [total, messages] = await Promise.all([
    prisma.platformSmsMessage.count({ where: { campaignId: id } }),
    prisma.platformSmsMessage.findMany({
      where: { campaignId: id },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return { campaign, messages, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}

async function listMessages(query = {}) {
  const page = clampPage(query.page);
  const pageSize = clampPageSize(query.pageSize);
  const where = {};
  if (query.status) where.status = String(query.status);
  if (query.campaignId) where.campaignId = String(query.campaignId);
  if (query.triggerSource) where.triggerSource = String(query.triggerSource);
  if (query.search) {
    const term = String(query.search).trim();
    where.OR = [
      { phone: { contains: term } },
      { recipientName: { contains: term, mode: 'insensitive' } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.platformSmsMessage.count({ where }),
    prisma.platformSmsMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return { items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}

async function getStats() {
  const [sent, failed, queued, impacted, recentCampaigns, byTrigger] = await Promise.all([
    prisma.platformSmsMessage.count({ where: { status: 'sent' } }),
    prisma.platformSmsMessage.count({ where: { status: 'failed' } }),
    prisma.platformSmsMessage.count({ where: { status: 'queued' } }),
    prisma.platformSmsMessage.findMany({ select: { targetUserId: true }, distinct: ['targetUserId'] }),
    prisma.platformSmsCampaign.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { _count: { select: { messages: true } } },
    }),
    prisma.platformSmsMessage.groupBy({ by: ['triggerSource'], _count: { _all: true } }),
  ]);

  return {
    totals: { total: sent + failed + queued, sent, failed, queued, impactedUsers: impacted.length },
    byTrigger: byTrigger.map((t) => ({ triggerSource: t.triggerSource, count: t._count._all })),
    recentCampaigns,
  };
}

async function syncMessage(user, messageId) {
  assertZiettEnabled();

  const message = await prisma.platformSmsMessage.findUnique({
    where: { id: messageId },
  });

  if (!message) {
    throw new PlatformSmsError('Mensagem não encontrada.', { status: 404, code: 'NOT_FOUND' });
  }

  if (!message.providerMessageId) {
    throw new PlatformSmsError('A mensagem ainda não possui providerMessageId para sincronização.', {
      status: 400,
      code: 'MESSAGE_NOT_SYNCABLE',
    });
  }

  const response = await ziettService.getMessageById(message.providerMessageId);
  const providerStatus = extractMessageProviderStatus(response);
  const internalStatus = normalizeProviderStatus(providerStatus) || message.status;
  const providerErrorFields = buildProviderErrorFields(response);

  const updated = await prisma.platformSmsMessage.update({
    where: { id: message.id },
    data: compactObject({
      providerStatus,
      status: internalStatus,
      errorCode: providerErrorFields.errorCode || message.errorCode,
      errorMessage: providerErrorFields.errorMessage || message.errorMessage,
      rawResponseJson: response,
      sentAt: SUCCESS_STATUSES.has(internalStatus) ? (message.sentAt || new Date()) : message.sentAt,
    }),
  });

  if (updated.campaignId) {
    await recalculateCampaignCounters(updated.campaignId);
  }

  return updated;
}

async function recalculateCampaignCounters(campaignId) {
  const messages = await prisma.platformSmsMessage.findMany({
    where: { campaignId },
    select: { status: true },
  });

  const sentCount = messages.filter((message) => SUCCESS_STATUSES.has(message.status)).length;
  const failedCount = messages.filter((message) => FAILED_STATUSES.has(message.status)).length;
  const queuedCount = messages.filter((message) => QUEUED_STATUSES.has(message.status)).length;
  const totalRecipients = messages.length;

  let status = 'completed';
  if (totalRecipients === 0) status = 'completed';
  else if (queuedCount > 0) status = 'sending';
  else if (sentCount === 0 && failedCount > 0) status = 'failed';

  return prisma.platformSmsCampaign.update({
    where: { id: campaignId },
    data: {
      sentCount,
      failedCount,
      status,
      completedAt: queuedCount === 0 ? new Date() : null,
    },
    include: { _count: { select: { messages: true } } },
  });
}

async function syncCampaign(user, campaignId) {
  assertZiettEnabled();

  const campaign = await prisma.platformSmsCampaign.findUnique({
    where: { id: campaignId },
  });

  if (!campaign) {
    throw new PlatformSmsError('Campanha não encontrada.', { status: 404, code: 'NOT_FOUND' });
  }

  const messages = await prisma.platformSmsMessage.findMany({
    where: {
      campaignId,
      providerMessageId: { not: null },
    },
    orderBy: { createdAt: 'asc' },
  });

  if (messages.length === 0) {
    throw new PlatformSmsError('A campanha não possui mensagens sincronizáveis.', {
      status: 400,
      code: 'CAMPAIGN_NOT_SYNCABLE',
    });
  }

  let synced = 0;
  let failedSync = 0;

  for (const message of messages) {
    try {
      await syncMessage(user, message.id);
      synced += 1;
    } catch (error) {
      failedSync += 1;
      console.warn(`[platform-sms] Falha ao sincronizar mensagem ${message.id}:`, error.message);
    }
  }

  const updatedCampaign = await recalculateCampaignCounters(campaign.id);
  return {
    campaign: updatedCampaign,
    synced,
    failedSync,
    totalSyncable: messages.length,
  };
}

module.exports = {
  PlatformSmsError,
  formatError,
  listSegments,
  resolveSegmentRecipients,
  previewCampaign,
  createAndSendCampaign,
  listCampaigns,
  getCampaignDetail,
  listMessages,
  getStats,
  syncMessage,
  syncCampaign,
  // helpers reutilizados pelo motor de automações
  baseOwnerWhere,
  renderTemplate,
  addDays,
};
