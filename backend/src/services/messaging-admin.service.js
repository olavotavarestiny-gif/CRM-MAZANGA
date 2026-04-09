const prisma = require('../lib/prisma');
const { normalizePhoneToE164 } = require('../lib/phone-normalization');
const { log: logActivity } = require('./activity-log.service.js');
const ziettService = require('./ziett.service');

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MAX_BATCH_RECIPIENTS = 1000;
const DEFAULT_CHANNEL = 'SMS';
const DEFAULT_COUNTRY = 'AO';

const CAMPAIGN_STATUS_MAP = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  SENDING: 'sending',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  PAUSED: 'paused',
};

const MESSAGE_STATUS_MAP = {
  PENDING: 'pending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  FAILED: 'failed',
  UNDELIVERED: 'undelivered',
  EXPIRED: 'expired',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
};

class MessagingError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'MessagingError';
    this.status = details.status || 400;
    this.code = details.code || 'MESSAGING_ERROR';
    this.traceId = details.traceId || null;
    this.fields = details.fields || null;
    this.data = details.data || null;
    this.entityId = details.entityId || null;
  }
}

function compactObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined)
  );
}

function clampPage(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_PAGE;
}

function clampPageSize(value, max = MAX_PAGE_SIZE) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return DEFAULT_PAGE_SIZE;
  }
  return Math.min(parsed, max);
}

function buildPagination(total, page, pageSize) {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

function parseBoolean(value, fallback = undefined) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;

  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'sim'].includes(normalized)) return true;
  if (['false', '0', 'no', 'nao', 'não'].includes(normalized)) return false;
  return fallback;
}

function parsePlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value;
}

function toNullableString(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function toNullableInt(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function parseNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

function pickFirstDate(source, paths) {
  const value = pickFirstValue(source, paths);
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeProviderStatus(rawStatus, map) {
  if (!rawStatus) return null;
  const normalized = String(rawStatus).trim().toUpperCase();
  return map[normalized] || String(rawStatus).trim().toLowerCase();
}

function getCampaignInternalStatus(rawStatus) {
  return normalizeProviderStatus(rawStatus, CAMPAIGN_STATUS_MAP);
}

function getMessageInternalStatus(rawStatus) {
  return normalizeProviderStatus(rawStatus, MESSAGE_STATUS_MAP);
}

function getDefaultCountry(bodyCountry) {
  return String(bodyCountry || process.env.ZIETT_DEFAULT_COUNTRY || DEFAULT_COUNTRY).toUpperCase();
}

function getDefaultChannel() {
  return String(process.env.ZIETT_DEFAULT_CHANNEL || DEFAULT_CHANNEL).toUpperCase();
}

function assertMessagingEnabled() {
  if (String(process.env.ZIETT_ENABLE || '').toLowerCase() !== 'true') {
    throw new MessagingError('A integração Ziett está desativada neste ambiente.', {
      status: 503,
      code: 'MESSAGING_DISABLED',
    });
  }
}

let cachedAllowlistRaw = null;
let cachedAllowlistValues = null;

function getAllowedRecipientsSet(defaultCountry = DEFAULT_COUNTRY) {
  const raw = process.env.ZIETT_TEST_ALLOWED_RECIPIENTS || '';

  if (!raw.trim()) {
    throw new MessagingError('ZIETT_TEST_ALLOWED_RECIPIENTS não está configurada.', {
      status: 503,
      code: 'MESSAGING_ALLOWLIST_NOT_CONFIGURED',
    });
  }

  if (raw === cachedAllowlistRaw && cachedAllowlistValues) {
    return cachedAllowlistValues;
  }

  const values = raw
    .split(/[\n,;]+/)
    .map((item) => normalizePhoneToE164(item, defaultCountry))
    .filter(Boolean);

  if (values.length === 0) {
    throw new MessagingError('ZIETT_TEST_ALLOWED_RECIPIENTS não contém números válidos.', {
      status: 503,
      code: 'MESSAGING_ALLOWLIST_EMPTY',
    });
  }

  cachedAllowlistRaw = raw;
  cachedAllowlistValues = new Set(values);

  return cachedAllowlistValues;
}

async function getWorkspaceModeForUser(effectiveUserId) {
  const owner = await prisma.user.findUnique({
    where: { id: effectiveUserId },
    select: { workspaceMode: true },
  });

  return owner?.workspaceMode || null;
}

function getRecipientStatusMessage(status) {
  if (status === 'invalid') return 'Número inválido para SMS em Angola.';
  if (status === 'duplicate') return 'Número duplicado no mesmo pedido.';
  if (status === 'opted_out') return 'Número bloqueado por opt-out local.';
  if (status === 'not_allowed') return 'Número fora da allowlist de testes.';
  return 'Número rejeitado.';
}

function normalizeRecipientInput(rawRecipients) {
  if (Array.isArray(rawRecipients)) {
    return rawRecipients.map((recipient) => (typeof recipient === 'string' ? { phone: recipient } : (recipient || {})));
  }

  if (typeof rawRecipients === 'string') {
    return rawRecipients
      .split(/[\n,;]+/)
      .map((phone) => phone.trim())
      .filter(Boolean)
      .map((phone) => ({ phone }));
  }

  return [];
}

async function classifyRecipients(rawRecipients, defaultCountry = DEFAULT_COUNTRY) {
  const allowlist = getAllowedRecipientsSet(defaultCountry);
  const normalizedRecipients = normalizeRecipientInput(rawRecipients);
  const accepted = [];
  const rejected = [];
  const uniqueCandidates = [];
  const seen = new Set();

  normalizedRecipients.forEach((recipient) => {
    const phoneOriginal = toNullableString(recipient.phone);
    const normalizedPhone = normalizePhoneToE164(phoneOriginal, defaultCountry);
    const basePayload = {
      phoneOriginal: phoneOriginal || '',
      phoneNormalized: normalizedPhone,
      contactId: toNullableInt(recipient.contactId),
      contactName: toNullableString(recipient.name || recipient.contactName),
      contactEmail: toNullableString(recipient.email || recipient.contactEmail),
    };

    if (!phoneOriginal || !normalizedPhone) {
      rejected.push({
        ...basePayload,
        status: 'invalid',
        errorCode: 'INVALID_PHONE',
        errorMessage: getRecipientStatusMessage('invalid'),
      });
      return;
    }

    if (seen.has(normalizedPhone)) {
      rejected.push({
        ...basePayload,
        status: 'duplicate',
        errorCode: 'DUPLICATE_PHONE',
        errorMessage: getRecipientStatusMessage('duplicate'),
      });
      return;
    }

    seen.add(normalizedPhone);
    uniqueCandidates.push(basePayload);
  });

  const optOutPhones = uniqueCandidates.length > 0
    ? await prisma.messagingOptOut.findMany({
        where: {
          phoneNormalized: { in: uniqueCandidates.map((recipient) => recipient.phoneNormalized) },
          isActive: true,
        },
        select: { phoneNormalized: true },
      })
    : [];

  const optedOutSet = new Set(optOutPhones.map((entry) => entry.phoneNormalized));

  uniqueCandidates.forEach((recipient) => {
    if (optedOutSet.has(recipient.phoneNormalized)) {
      rejected.push({
        ...recipient,
        status: 'opted_out',
        errorCode: 'OPTED_OUT',
        errorMessage: getRecipientStatusMessage('opted_out'),
      });
      return;
    }

    if (!allowlist.has(recipient.phoneNormalized)) {
      rejected.push({
        ...recipient,
        status: 'not_allowed',
        errorCode: 'NOT_ALLOWED',
        errorMessage: getRecipientStatusMessage('not_allowed'),
      });
      return;
    }

    accepted.push(recipient);
  });

  return {
    submitted: normalizedRecipients.length,
    accepted,
    rejected,
    summary: {
      submitted: normalizedRecipients.length,
      accepted: accepted.length,
      invalid: rejected.filter((entry) => entry.status === 'invalid').length,
      duplicate: rejected.filter((entry) => entry.status === 'duplicate').length,
      optedOut: rejected.filter((entry) => entry.status === 'opted_out').length,
      notAllowed: rejected.filter((entry) => entry.status === 'not_allowed').length,
    },
  };
}

function validateRequiredString(value, fieldName, label) {
  const normalized = toNullableString(value);
  if (!normalized) {
    throw new MessagingError(`${label} é obrigatório.`, {
      status: 400,
      code: 'VALIDATION_ERROR',
      fields: { [fieldName]: `${label} é obrigatório.` },
    });
  }
  return normalized;
}

async function prepareBatchCampaignInput(body = {}) {
  assertMessagingEnabled();

  const name = validateRequiredString(body.name, 'name', 'O nome da campanha');
  const content = validateRequiredString(body.content, 'content', 'O conteúdo da mensagem');
  const remitterId = validateRequiredString(body.remitterId, 'remitterId', 'O remitter');
  const countryAlpha2 = getDefaultCountry(body.countryAlpha2);
  const isTest = parseBoolean(body.isTest, true);
  const recipients = normalizeRecipientInput(body.recipients);

  if (recipients.length === 0) {
    throw new MessagingError('A campanha precisa de pelo menos um destinatário.', {
      status: 400,
      code: 'VALIDATION_ERROR',
      fields: { recipients: 'Informe pelo menos um destinatário.' },
    });
  }

  const classification = await classifyRecipients(recipients, countryAlpha2);

  if (classification.accepted.length === 0) {
    throw new MessagingError('Nenhum destinatário válido ficou elegível para envio.', {
      status: 400,
      code: 'NO_VALID_RECIPIENTS',
      fields: { recipients: 'Nenhum destinatário passou na validação.' },
      data: { summary: classification.summary },
    });
  }

  if (classification.accepted.length > MAX_BATCH_RECIPIENTS) {
    throw new MessagingError(`A Ziett aceita no máximo ${MAX_BATCH_RECIPIENTS} destinatários válidos por batch nesta fase.`, {
      status: 400,
      code: 'BATCH_LIMIT_EXCEEDED',
      fields: { recipients: `Máximo de ${MAX_BATCH_RECIPIENTS} destinatários válidos por campanha.` },
      data: { summary: classification.summary },
    });
  }

  const ziettPayload = {
    name,
    remitter_id: remitterId,
    country_alpha2: countryAlpha2,
    content,
    channel_type: getDefaultChannel(),
    recipients: classification.accepted.map((recipient) => recipient.phoneNormalized),
  };

  return {
    name,
    content,
    remitterId,
    countryAlpha2,
    isTest,
    recipients,
    ...classification,
    ziettPayload,
    previewCampaign: {
      provider: 'ZIETT',
      name,
      content,
      channelType: getDefaultChannel(),
      remitterId,
      countryAlpha2,
      requestedRecipientsCount: classification.submitted,
      acceptedRecipientsCount: classification.accepted.length,
      invalidRecipientsCount: classification.summary.invalid,
      duplicateRecipientsCount: classification.summary.duplicate,
      optedOutRecipientsCount: classification.summary.optedOut,
      notAllowedRecipientsCount: classification.summary.notAllowed,
      isTest,
      status: 'validated',
    },
  };
}

async function prepareSingleMessageInput(body = {}) {
  assertMessagingEnabled();

  const content = validateRequiredString(body.content, 'content', 'O conteúdo da mensagem');
  const remitterId = validateRequiredString(body.remitterId, 'remitterId', 'O remitter');
  const countryAlpha2 = getDefaultCountry(body.countryAlpha2);
  const phoneOriginal = validateRequiredString(body.phone, 'phone', 'O número');
  const phoneNormalized = normalizePhoneToE164(phoneOriginal, countryAlpha2);
  const isTest = parseBoolean(body.isTest, true);

  if (!phoneNormalized) {
    throw new MessagingError('O número não está num formato SMS válido para Angola.', {
      status: 400,
      code: 'INVALID_PHONE',
      fields: { phone: 'Use +244XXXXXXXXX, 244XXXXXXXXX ou 9XXXXXXXX.' },
    });
  }

  const allowlist = getAllowedRecipientsSet(countryAlpha2);
  if (!allowlist.has(phoneNormalized)) {
    throw new MessagingError('O número não faz parte da allowlist de teste.', {
      status: 400,
      code: 'NOT_ALLOWED',
      fields: { phone: 'Este número não está permitido para a fase de testes.' },
    });
  }

  const optOut = await prisma.messagingOptOut.findFirst({
    where: {
      phoneNormalized,
      isActive: true,
    },
    select: { phoneNormalized: true, reason: true },
  });

  if (optOut) {
    throw new MessagingError('O número está bloqueado por opt-out local.', {
      status: 400,
      code: 'OPTED_OUT',
      fields: { phone: optOut.reason || 'Opt-out ativo para este número.' },
    });
  }

  return {
    content,
    remitterId,
    countryAlpha2,
    phoneOriginal,
    phoneNormalized,
    contactId: toNullableInt(body.contactId),
    isTest,
    saveContact: parsePlainObject(body.saveContact),
    ziettPayload: {
      remitter_id: remitterId,
      channel_type: getDefaultChannel(),
      target_e164: phoneNormalized,
      content,
      ...compactObject({
        save_contact: parsePlainObject(body.saveContact) || undefined,
      }),
    },
  };
}

async function recordActivity(user, data) {
  await logActivity({
    organization_id: user.effectiveUserId,
    user_id: user.id,
    user_name: user.name,
    ...data,
  });
}

function extractCampaignProviderStatus(payload) {
  return pickFirstString(payload, [
    'status',
    'campaign_status',
    'campaignStatus',
    'state',
    'data.status',
    'data.campaign_status',
  ]);
}

function extractMessageProviderStatus(payload) {
  return pickFirstString(payload, [
    'status',
    'message_status',
    'messageStatus',
    'delivery_status',
    'deliveryStatus',
    'state',
    'data.status',
    'data.message_status',
  ]);
}

function extractCampaignEntries(payload) {
  const candidates = [
    pickFirstValue(payload, ['entries']),
  ];

  const candidatePaths = [
    'entries',
    'messages',
    'recipients',
    'data.entries',
    'data.messages',
    'data.recipients',
  ];

  for (const path of candidatePaths) {
    const value = getPathValue(payload, path);
    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
}

function extractCampaignId(payload) {
  return pickFirstString(payload, ['campaign_id', 'campaignId']);
}

function extractMessageId(payload) {
  return pickFirstString(payload, ['message_id', 'messageId']);
}

function buildProviderErrorFields(payload, error) {
  const providerErrorCode = pickFirstString(payload, ['code', 'error.code']) || error?.code || null;
  const providerErrorMessage = providerErrorCode
    ? (pickFirstString(payload, ['message', 'error.message']) || error?.message || null)
    : (error?.message || null);

  return compactObject({
    providerStatus: extractCampaignProviderStatus(payload) || extractMessageProviderStatus(payload) || null,
    providerErrorCode,
    providerErrorMessage,
    providerTraceId: pickFirstString(payload, ['trace_id', 'traceId']) || error?.traceId || null,
  });
}

async function createBatchCampaignDraft(user, preparedInput) {
  const workspaceMode = await getWorkspaceModeForUser(user.effectiveUserId);

  return prisma.$transaction(async (tx) => {
    const campaign = await tx.messagingCampaign.create({
      data: {
        provider: 'ZIETT',
        name: preparedInput.name,
        content: preparedInput.content,
        channelType: getDefaultChannel(),
        remitterId: preparedInput.remitterId,
        countryAlpha2: preparedInput.countryAlpha2,
        requestedRecipientsCount: preparedInput.submitted,
        acceptedRecipientsCount: preparedInput.accepted.length,
        invalidRecipientsCount: preparedInput.summary.invalid,
        duplicateRecipientsCount: preparedInput.summary.duplicate,
        optedOutRecipientsCount: preparedInput.summary.optedOut,
        notAllowedRecipientsCount: preparedInput.summary.notAllowed,
        status: 'pending',
        triggerSource: 'SUPERADMIN_PANEL',
        createdByUserId: user.id,
        createdByEmail: user.email,
        accountOwnerId: user.accountOwnerId || null,
        workspaceMode,
        isTest: preparedInput.isTest,
        rawRequestJson: preparedInput.ziettPayload,
        statusNote: `Campanha validada localmente para ${preparedInput.accepted.length} destinatário(s).`,
      },
    });

    const acceptedRecipientMap = new Map();

    for (const recipient of preparedInput.accepted) {
      const createdRecipient = await tx.messagingCampaignRecipient.create({
        data: {
          campaignId: campaign.id,
          phoneOriginal: recipient.phoneOriginal,
          phoneNormalized: recipient.phoneNormalized,
          contactId: recipient.contactId,
          contactName: recipient.contactName,
          contactEmail: recipient.contactEmail,
          status: 'pending',
        },
      });

      acceptedRecipientMap.set(createdRecipient.phoneNormalized, createdRecipient);

      await tx.messagingMessageLog.create({
        data: {
          provider: 'ZIETT',
          campaignId: campaign.id,
          campaignRecipientId: createdRecipient.id,
          content: preparedInput.content,
          phoneOriginal: recipient.phoneOriginal,
          phoneNormalized: recipient.phoneNormalized,
          contactId: recipient.contactId,
          channelType: getDefaultChannel(),
          remitterId: preparedInput.remitterId,
          status: 'pending',
          triggerSource: 'SUPERADMIN_PANEL',
          createdByUserId: user.id,
          createdByEmail: user.email,
          isTest: preparedInput.isTest,
          rawRequestJson: {
            name: preparedInput.name,
            channel_type: preparedInput.ziettPayload.channel_type,
            remitter_id: preparedInput.remitterId,
            country_alpha2: preparedInput.countryAlpha2,
            content: preparedInput.content,
            recipient: recipient.phoneNormalized,
          },
        },
      });
    }

    for (const recipient of preparedInput.rejected) {
      await tx.messagingCampaignRecipient.create({
        data: {
          campaignId: campaign.id,
          phoneOriginal: recipient.phoneOriginal,
          phoneNormalized: recipient.phoneNormalized,
          contactId: recipient.contactId,
          contactName: recipient.contactName,
          contactEmail: recipient.contactEmail,
          status: recipient.status,
          errorCode: recipient.errorCode,
          errorMessage: recipient.errorMessage,
        },
      });
    }

    return {
      campaign,
      acceptedRecipientMap,
    };
  });
}

function buildCampaignListWhere(filters = {}) {
  const where = {};

  if (filters.status) where.status = filters.status;

  const isTest = parseBoolean(filters.isTest);
  if (typeof isTest === 'boolean') {
    where.isTest = isTest;
  }

  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { content: { contains: filters.search, mode: 'insensitive' } },
      { providerCampaignId: { contains: filters.search, mode: 'insensitive' } },
      { createdByEmail: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  return where;
}

function buildMessageListWhere(filters = {}) {
  const where = {};

  if (filters.status) where.status = filters.status;

  const isTest = parseBoolean(filters.isTest);
  if (typeof isTest === 'boolean') {
    where.isTest = isTest;
  }

  if (filters.search) {
    where.OR = [
      { content: { contains: filters.search, mode: 'insensitive' } },
      { phoneOriginal: { contains: filters.search, mode: 'insensitive' } },
      { phoneNormalized: { contains: filters.search, mode: 'insensitive' } },
      { providerMessageId: { contains: filters.search, mode: 'insensitive' } },
      { createdByEmail: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  return where;
}

async function listCampaigns(filters = {}) {
  const page = clampPage(filters.page);
  const pageSize = clampPageSize(filters.pageSize);
  const where = buildCampaignListWhere(filters);

  const [total, data] = await Promise.all([
    prisma.messagingCampaign.count({ where }),
    prisma.messagingCampaign.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        _count: {
          select: {
            recipients: true,
            messages: true,
          },
        },
      },
    }),
  ]);

  return {
    data,
    pagination: buildPagination(total, page, pageSize),
  };
}

async function getCampaignDetail(campaignId, filters = {}) {
  const recipientPage = clampPage(filters.recipientPage || filters.page);
  const recipientPageSize = clampPageSize(filters.recipientPageSize || filters.pageSize, 200);

  const [campaign, totalRecipients, recipients] = await Promise.all([
    prisma.messagingCampaign.findUnique({
      where: { id: campaignId },
      include: {
        _count: {
          select: {
            recipients: true,
            messages: true,
          },
        },
      },
    }),
    prisma.messagingCampaignRecipient.count({
      where: { campaignId },
    }),
    prisma.messagingCampaignRecipient.findMany({
      where: { campaignId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      skip: (recipientPage - 1) * recipientPageSize,
      take: recipientPageSize,
    }),
  ]);

  if (!campaign) {
    throw new MessagingError('Campanha não encontrada.', {
      status: 404,
      code: 'CAMPAIGN_NOT_FOUND',
    });
  }

  return {
    campaign,
    recipients: {
      data: recipients,
      pagination: buildPagination(totalRecipients, recipientPage, recipientPageSize),
    },
  };
}

async function getMessageDetail(messageId) {
  const message = await prisma.messagingMessageLog.findUnique({
    where: { id: messageId },
    include: {
      campaign: {
        select: {
          id: true,
          name: true,
          providerCampaignId: true,
          status: true,
          isTest: true,
        },
      },
      campaignRecipient: {
        select: {
          id: true,
          status: true,
          providerStatus: true,
          errorCode: true,
          errorMessage: true,
        },
      },
    },
  });

  if (!message) {
    throw new MessagingError('Mensagem não encontrada.', {
      status: 404,
      code: 'MESSAGE_NOT_FOUND',
    });
  }

  return message;
}

async function listMessages(filters = {}) {
  const page = clampPage(filters.page);
  const pageSize = clampPageSize(filters.pageSize);
  const where = buildMessageListWhere(filters);

  const [total, data] = await Promise.all([
    prisma.messagingMessageLog.count({ where }),
    prisma.messagingMessageLog.findMany({
      where,
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            providerCampaignId: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    data,
    pagination: buildPagination(total, page, pageSize),
  };
}

async function validateBatchCampaign(body) {
  const preparedInput = await prepareBatchCampaignInput(body);

  return {
    campaign: preparedInput.previewCampaign,
    summary: preparedInput.summary,
    acceptedRecipients: preparedInput.accepted,
    rejectedRecipients: preparedInput.rejected,
  };
}

async function sendBatchCampaign(user, body) {
  const preparedInput = await prepareBatchCampaignInput(body);
  const { campaign } = await createBatchCampaignDraft(user, preparedInput);

  try {
    const response = await ziettService.sendBatchCampaign(preparedInput.ziettPayload);
    const providerStatus = extractCampaignProviderStatus(response);
    const internalStatus = getCampaignInternalStatus(providerStatus) || 'processing';
    const completedAt = ['completed', 'failed', 'cancelled'].includes(internalStatus) ? new Date() : null;

    await prisma.messagingCampaign.update({
      where: { id: campaign.id },
      data: {
        providerCampaignId: extractCampaignId(response),
        providerStatus,
        status: internalStatus,
        statusNote: pickFirstString(response, ['message', 'detail']) || `Campanha enviada para ${preparedInput.accepted.length} destinatário(s).`,
        rawResponseJson: response,
        sentAt: new Date(),
        processedAt: internalStatus !== 'pending' ? new Date() : null,
        completedAt,
        ...buildProviderErrorFields(response),
      },
    });

    await recordActivity(user, {
      entity_type: 'messaging_campaign',
      entity_id: campaign.id,
      entity_label: preparedInput.name,
      action: 'created',
      metadata: {
        provider: 'ZIETT',
        provider_campaign_id: extractCampaignId(response),
        requested_recipients: preparedInput.submitted,
        accepted_recipients: preparedInput.accepted.length,
        is_test: preparedInput.isTest,
      },
    });

    return {
      ...(await getCampaignDetail(campaign.id)),
      summary: preparedInput.summary,
    };
  } catch (error) {
    const normalizedError = error instanceof MessagingError
      ? error
      : new MessagingError(error.message, {
          status: error.status || 502,
          code: error.code || 'ZIETT_SEND_BATCH_FAILED',
          traceId: error.traceId || null,
          fields: error.fields || null,
          data: error.data || null,
          entityId: campaign.id,
        });

    await prisma.$transaction(async (tx) => {
      await tx.messagingCampaign.update({
        where: { id: campaign.id },
        data: {
          status: 'failed',
          statusNote: normalizedError.message,
          providerErrorCode: normalizedError.code,
          providerErrorMessage: normalizedError.message,
          providerTraceId: normalizedError.traceId,
          rawResponseJson: normalizedError.data,
          completedAt: new Date(),
        },
      });

      await tx.messagingCampaignRecipient.updateMany({
        where: {
          campaignId: campaign.id,
          status: 'pending',
        },
        data: {
          status: 'failed',
          errorCode: normalizedError.code,
          errorMessage: normalizedError.message,
        },
      });

      await tx.messagingMessageLog.updateMany({
        where: {
          campaignId: campaign.id,
          status: 'pending',
        },
        data: {
          status: 'failed',
          providerErrorCode: normalizedError.code,
          providerErrorMessage: normalizedError.message,
          providerTraceId: normalizedError.traceId,
          rawResponseJson: normalizedError.data,
        },
      });
    });

    throw normalizedError;
  }
}

function buildRecipientSyncUpdate(entry) {
  const providerStatus = extractMessageProviderStatus(entry);
  const status = providerStatus ? (getMessageInternalStatus(providerStatus) || providerStatus.toLowerCase()) : undefined;

  return compactObject({
    providerMessageId: extractMessageId(entry) || undefined,
    providerStatus: providerStatus || undefined,
    status,
    channelDestination: pickFirstString(entry, ['channel_destination', 'channelDestination', 'destination', 'target_e164', 'target']) || undefined,
    cost: parseNumber(pickFirstValue(entry, ['cost', 'price', 'billing_cost'])) ?? undefined,
    errorCode: pickFirstString(entry, ['code', 'error.code']) || undefined,
    errorMessage: pickFirstString(entry, ['message', 'error.message']) || undefined,
    rawProviderJson: entry,
  });
}

function buildMessageSyncUpdate(entry) {
  const providerStatus = extractMessageProviderStatus(entry);
  const status = providerStatus ? (getMessageInternalStatus(providerStatus) || providerStatus.toLowerCase()) : undefined;

  return compactObject({
    providerMessageId: extractMessageId(entry) || undefined,
    providerStatus: providerStatus || undefined,
    status,
    channelDestination: pickFirstString(entry, ['channel_destination', 'channelDestination', 'destination', 'target_e164', 'target']) || undefined,
    cost: parseNumber(pickFirstValue(entry, ['cost', 'price', 'billing_cost'])) ?? undefined,
    providerErrorCode: pickFirstString(entry, ['code', 'error.code']) || undefined,
    providerErrorMessage: pickFirstString(entry, ['message', 'error.message']) || undefined,
    providerTraceId: pickFirstString(entry, ['trace_id', 'traceId']) || undefined,
    rawResponseJson: entry,
  });
}

async function syncCampaign(user, campaignId) {
  assertMessagingEnabled();

  const campaign = await prisma.messagingCampaign.findUnique({
    where: { id: campaignId },
  });

  if (!campaign) {
    throw new MessagingError('Campanha não encontrada.', {
      status: 404,
      code: 'CAMPAIGN_NOT_FOUND',
    });
  }

  if (!campaign.providerCampaignId) {
    throw new MessagingError('A campanha ainda não possui providerCampaignId para sincronização.', {
      status: 400,
      code: 'CAMPAIGN_NOT_SYNCABLE',
    });
  }

  const response = await ziettService.getCampaignById(campaign.providerCampaignId);
  const providerStatus = extractCampaignProviderStatus(response);
  const internalStatus = getCampaignInternalStatus(providerStatus) || campaign.status;
  const entries = extractCampaignEntries(response);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.messagingCampaign.update({
      where: { id: campaign.id },
      data: compactObject({
        providerStatus,
        status: internalStatus,
        statusNote: pickFirstString(response, ['message', 'detail']) || campaign.statusNote,
        providerErrorCode: buildProviderErrorFields(response).providerErrorCode || campaign.providerErrorCode,
        providerErrorMessage: buildProviderErrorFields(response).providerErrorMessage || campaign.providerErrorMessage,
        providerTraceId: buildProviderErrorFields(response).providerTraceId || campaign.providerTraceId,
        rawResponseJson: response,
        processedAt: pickFirstDate(response, ['processed_at', 'processedAt', 'updated_at', 'updatedAt']) || campaign.processedAt || now,
        completedAt: ['completed', 'failed', 'cancelled'].includes(internalStatus)
          ? (pickFirstDate(response, ['completed_at', 'completedAt', 'finished_at', 'finishedAt']) || campaign.completedAt || now)
          : campaign.completedAt,
      }),
    });

    if (entries.length === 0) {
      return;
    }

    const recipients = await tx.messagingCampaignRecipient.findMany({
      where: { campaignId: campaign.id },
    });
    const messageLogs = await tx.messagingMessageLog.findMany({
      where: { campaignId: campaign.id },
    });

    const recipientsByPhone = new Map(recipients.filter((item) => item.phoneNormalized).map((item) => [item.phoneNormalized, item]));
    const recipientsByProviderMessageId = new Map(recipients.filter((item) => item.providerMessageId).map((item) => [item.providerMessageId, item]));
    const messagesByPhone = new Map(messageLogs.map((item) => [item.phoneNormalized, item]));
    const messagesByProviderMessageId = new Map(messageLogs.filter((item) => item.providerMessageId).map((item) => [item.providerMessageId, item]));

    for (const entry of entries) {
      const providerMessageId = extractMessageId(entry);
      const phoneNormalized = normalizePhoneToE164(
        pickFirstString(entry, ['target_e164', 'channel_destination', 'channelDestination', 'destination', 'target']),
        campaign.countryAlpha2 || DEFAULT_COUNTRY
      );

      const recipient = (providerMessageId && recipientsByProviderMessageId.get(providerMessageId))
        || (phoneNormalized && recipientsByPhone.get(phoneNormalized));
      const message = (providerMessageId && messagesByProviderMessageId.get(providerMessageId))
        || (phoneNormalized && messagesByPhone.get(phoneNormalized));

      const recipientUpdate = buildRecipientSyncUpdate(entry);
      const messageUpdate = buildMessageSyncUpdate(entry);

      if (recipient) {
        await tx.messagingCampaignRecipient.update({
          where: { id: recipient.id },
          data: recipientUpdate,
        });
      }

      if (message) {
        await tx.messagingMessageLog.update({
          where: { id: message.id },
          data: messageUpdate,
        });
      }
    }
  });

  await recordActivity(user, {
    entity_type: 'messaging_campaign',
    entity_id: campaign.id,
    entity_label: campaign.name,
    action: 'sync_requested',
    metadata: {
      provider: 'ZIETT',
      provider_campaign_id: campaign.providerCampaignId,
      entries_synced: entries.length,
    },
  });

  return getCampaignDetail(campaign.id);
}

async function sendSingleTestMessage(user, body) {
  const preparedInput = await prepareSingleMessageInput(body);

  const messageLog = await prisma.messagingMessageLog.create({
    data: {
      provider: 'ZIETT',
      content: preparedInput.content,
      phoneOriginal: preparedInput.phoneOriginal,
      phoneNormalized: preparedInput.phoneNormalized,
      contactId: preparedInput.contactId,
      channelType: getDefaultChannel(),
      remitterId: preparedInput.remitterId,
      status: 'pending',
      triggerSource: 'SUPERADMIN_PANEL',
      createdByUserId: user.id,
      createdByEmail: user.email,
      isTest: preparedInput.isTest,
      rawRequestJson: preparedInput.ziettPayload,
    },
  });

  try {
    const response = await ziettService.sendSingleMessage(preparedInput.ziettPayload);
    const providerStatus = extractMessageProviderStatus(response);
    const internalStatus = getMessageInternalStatus(providerStatus) || 'pending';

    await prisma.messagingMessageLog.update({
      where: { id: messageLog.id },
      data: {
        providerMessageId: extractMessageId(response),
        providerStatus,
        status: internalStatus,
        channelDestination: preparedInput.phoneNormalized,
        rawResponseJson: response,
        ...buildProviderErrorFields(response),
      },
    });

    await recordActivity(user, {
      entity_type: 'messaging_message',
      entity_id: messageLog.id,
      entity_label: preparedInput.phoneNormalized,
      action: 'sent',
      metadata: {
        provider: 'ZIETT',
        provider_message_id: extractMessageId(response),
        is_test: preparedInput.isTest,
      },
    });

    return getMessageDetail(messageLog.id);
  } catch (error) {
    const normalizedError = error instanceof MessagingError
      ? error
      : new MessagingError(error.message, {
          status: error.status || 502,
          code: error.code || 'ZIETT_SEND_SINGLE_FAILED',
          traceId: error.traceId || null,
          fields: error.fields || null,
          data: error.data || null,
          entityId: messageLog.id,
        });

    await prisma.messagingMessageLog.update({
      where: { id: messageLog.id },
      data: {
        status: 'failed',
        providerErrorCode: normalizedError.code,
        providerErrorMessage: normalizedError.message,
        providerTraceId: normalizedError.traceId,
        rawResponseJson: normalizedError.data,
      },
    });

    throw normalizedError;
  }
}

async function syncMessage(user, messageId) {
  assertMessagingEnabled();

  const message = await prisma.messagingMessageLog.findUnique({
    where: { id: messageId },
  });

  if (!message) {
    throw new MessagingError('Mensagem não encontrada.', {
      status: 404,
      code: 'MESSAGE_NOT_FOUND',
    });
  }

  if (!message.providerMessageId) {
    throw new MessagingError('A mensagem ainda não possui providerMessageId para sincronização.', {
      status: 400,
      code: 'MESSAGE_NOT_SYNCABLE',
    });
  }

  const response = await ziettService.getMessageById(message.providerMessageId);
  const providerStatus = extractMessageProviderStatus(response);
  const internalStatus = getMessageInternalStatus(providerStatus) || message.status;
  const providerErrorFields = buildProviderErrorFields(response);
  const updateData = compactObject({
    providerStatus,
    status: internalStatus,
    channelDestination: pickFirstString(response, ['channel_destination', 'channelDestination', 'destination', 'target_e164', 'target'])
      || message.channelDestination,
    cost: parseNumber(pickFirstValue(response, ['cost', 'price', 'billing_cost'])) ?? message.cost,
    providerErrorCode: providerErrorFields.providerErrorCode || message.providerErrorCode,
    providerErrorMessage: providerErrorFields.providerErrorMessage || message.providerErrorMessage,
    providerTraceId: providerErrorFields.providerTraceId || message.providerTraceId,
    rawResponseJson: response,
  });

  await prisma.$transaction(async (tx) => {
    await tx.messagingMessageLog.update({
      where: { id: message.id },
      data: updateData,
    });

    if (message.campaignRecipientId) {
      await tx.messagingCampaignRecipient.update({
        where: { id: message.campaignRecipientId },
        data: compactObject({
          providerMessageId: extractMessageId(response) || message.providerMessageId,
          providerStatus,
          status: internalStatus,
          channelDestination: updateData.channelDestination,
          cost: updateData.cost,
          errorCode: updateData.providerErrorCode,
          errorMessage: updateData.providerErrorMessage,
          rawProviderJson: response,
        }),
      });
    }
  });

  await recordActivity(user, {
    entity_type: 'messaging_message',
    entity_id: message.id,
    entity_label: message.phoneNormalized,
    action: 'sync_requested',
    metadata: {
      provider: 'ZIETT',
      provider_message_id: message.providerMessageId,
    },
  });

  return getMessageDetail(message.id);
}

function formatMessagingError(error) {
  const normalizedError = error instanceof MessagingError
    ? error
    : new MessagingError(error.message || 'Erro interno de messaging.', {
        status: error.status || 500,
        code: error.code || 'MESSAGING_ERROR',
        traceId: error.traceId || null,
        fields: error.fields || null,
        data: error.data || null,
        entityId: error.entityId || null,
      });

  return {
    status: normalizedError.status,
    body: compactObject({
      error: normalizedError.message,
      code: normalizedError.code,
      status: normalizedError.status,
      traceId: normalizedError.traceId,
      fields: normalizedError.fields,
      entityId: normalizedError.entityId,
      data: normalizedError.data,
    }),
  };
}

module.exports = {
  MessagingError,
  formatMessagingError,
  validateBatchCampaign,
  sendBatchCampaign,
  listCampaigns,
  getCampaignDetail,
  syncCampaign,
  sendSingleTestMessage,
  listMessages,
  getMessageDetail,
  syncMessage,
};
