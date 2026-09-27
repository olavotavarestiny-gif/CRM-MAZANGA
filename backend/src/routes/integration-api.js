const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { canCreateContact, buildLimitErrorPayload } = require('../lib/plan-limits');
const { ensureDefaultDealStages } = require('../lib/deal-stages');
const { getSubscriptionState, STATUS_SUSPENDED } = require('../lib/subscription-access');
const { extractApiKey, hashApiKey, parseScopes } = require('../lib/integration-api-key');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[\d\s+\-()]{7,20}$/;

function cleanText(value, maxLength = 255) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function normalizePhone(value) {
  return cleanText(value, 20).replace(/\s+/g, '');
}

function normalizeTags(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((tag) => cleanText(tag, 60)).filter(Boolean))].slice(0, 20);
}

async function authenticateApiKey(req, res, next) {
  const rawKey = extractApiKey(req);
  if (!rawKey) return res.status(401).json({ success: false, error: 'API key em falta.' });
  try {
    const key = await prisma.integrationApiKey.findUnique({
      where: { keyHash: hashApiKey(rawKey) },
      include: { user: { select: { id: true, name: true, active: true, accountStatus: true } } },
    });
    const expired = key?.expiresAt && key.expiresAt <= new Date();
    if (!key || !key.active || expired || !key.user?.active || key.user.accountStatus === 'cancelled') {
      return res.status(401).json({ success: false, error: 'API key inválida ou inactiva.' });
    }
    const subscription = await getSubscriptionState(key.userId);
    if (subscription?.accountStatus === STATUS_SUSPENDED) {
      return res.status(402).json({ success: false, error: subscription.message || 'A conta está suspensa.', accountStatus: subscription.accountStatus });
    }
    req.integration = { keyId: key.id, userId: key.userId, accountName: key.user.name, scopes: parseScopes(key.scopes) };
    await prisma.integrationApiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });
    return next();
  } catch (error) {
    console.error('[integration-api.auth] Falha ao autenticar:', error.message);
    return res.status(500).json({ success: false, error: 'Falha ao autenticar a integração.' });
  }
}

function requireScope(scope) {
  return (req, res, next) => req.integration.scopes.includes(scope)
    ? next()
    : res.status(403).json({ success: false, error: `A chave não possui o âmbito ${scope}.` });
}

async function upsertContact(userId, payload) {
  const name = cleanText(payload.name);
  const phone = normalizePhone(payload.phone);
  const email = cleanText(payload.email).toLowerCase();
  const company = cleanText(payload.company);
  if (!name || !phone) {
    const error = new Error('Os campos name e phone são obrigatórios.'); error.status = 400; throw error;
  }
  if (!PHONE_REGEX.test(phone)) {
    const error = new Error('Telefone inválido.'); error.status = 400; throw error;
  }
  if (email && !EMAIL_REGEX.test(email)) {
    const error = new Error('Email inválido.'); error.status = 400; throw error;
  }

  const existing = await prisma.contact.findUnique({ where: { user_phone_unique: { userId, phone } } });
  const tags = normalizeTags(payload.tags);
  const customFields = payload.customFields && typeof payload.customFields === 'object' ? JSON.stringify(payload.customFields) : '{}';
  if (existing) {
    let currentTags = [];
    try { currentTags = JSON.parse(existing.tags || '[]'); } catch { currentTags = []; }
    const contact = await prisma.contact.update({
      where: { id: existing.id },
      data: {
        name, email, company, location: cleanText(payload.location), inPipeline: true,
        contactType: cleanText(payload.contactType) || existing.contactType,
        tags: JSON.stringify([...new Set([...(Array.isArray(currentTags) ? currentTags : []), ...tags, 'Integração API'])]),
        customFields,
      },
    });
    return { contact, existing: true };
  }

  const limit = await canCreateContact(userId);
  if (!limit.allowed) {
    const error = new Error('Limite de contactos atingido.');
    error.status = 403; error.payload = buildLimitErrorPayload(limit); throw error;
  }
  const contact = await prisma.contact.create({
    data: {
      userId, name, email, phone, company, location: cleanText(payload.location), inPipeline: true,
      stage: 'Novo', contactType: cleanText(payload.contactType) || 'interessado',
      tags: JSON.stringify([...new Set([...tags, 'Integração API'])]), customFields,
    },
  });
  return { contact, existing: false };
}

router.use(authenticateApiKey);

router.get('/status', (req, res) => {
  res.json({ success: true, account: req.integration.accountName, scopes: req.integration.scopes });
});

router.post('/contacts', requireScope('contacts:write'), async (req, res) => {
  try {
    const result = await upsertContact(req.integration.userId, req.body || {});
    return res.status(result.existing ? 200 : 201).json({ success: true, contactId: result.contact.id, existing: result.existing });
  } catch (error) {
    console.error('[integration-api.contacts] Falha:', error.message);
    return res.status(error.status || 500).json({ success: false, error: error.message || 'Não foi possível criar o contacto.', ...(error.payload || {}) });
  }
});

router.post('/sales', requireScope('sales:write'), async (req, res) => {
  const userId = req.integration.userId;
  const body = req.body || {};
  const externalId = cleanText(body.externalId, 191) || null;
  const title = cleanText(body.title) || `Venda ${externalId || new Date().toISOString()}`;
  const valueKz = Number(body.valueKz);
  const closedAt = body.closedAt ? new Date(body.closedAt) : new Date();
  if (!Number.isFinite(valueKz) || valueKz < 0) return res.status(400).json({ success: false, error: 'valueKz deve ser um número igual ou superior a zero.' });
  if (Number.isNaN(closedAt.getTime())) return res.status(400).json({ success: false, error: 'closedAt deve ser uma data válida.' });

  try {
    if (externalId) {
      const existing = await prisma.deal.findUnique({ where: { userId_externalId: { userId, externalId } } });
      if (existing) return res.status(200).json({ success: true, saleId: existing.id, existing: true });
    }

    let contact = null;
    if (body.contactId != null) {
      contact = await prisma.contact.findFirst({ where: { id: Number(body.contactId), userId } });
      if (!contact) return res.status(404).json({ success: false, error: 'Contacto não encontrado nesta conta.' });
    } else if (body.contact) {
      contact = (await upsertContact(userId, body.contact)).contact;
    }

    const companyName = cleanText(body.companyName) || cleanText(contact?.company) || 'Consumidor Final';
    let company = await prisma.company.findFirst({ where: { userId, name: { equals: companyName, mode: 'insensitive' } } });
    if (!company) company = await prisma.company.create({ data: { userId, name: companyName } });

    await ensureDefaultDealStages(userId);
    const requestedStage = cleanText(body.stage);
    const stage = await prisma.dealStage.findFirst({
      where: requestedStage ? { userId, name: { equals: requestedStage, mode: 'insensitive' } } : { userId, name: 'Fechado' },
      orderBy: { order: 'asc' },
    }) || await prisma.dealStage.findFirst({ where: { userId }, orderBy: { order: 'desc' } });
    if (!stage) return res.status(409).json({ success: false, error: 'A conta não possui fases de venda configuradas.' });

    const sale = await prisma.$transaction(async (tx) => {
      const deal = await tx.deal.create({
        data: {
          userId, companyId: company.id, stageId: stage.id, title, externalId,
          source: cleanText(body.source) || 'API externa', valueKz, status: 'ganho',
          stageEnteredAt: new Date(), closedAt,
        },
      });
      if (contact) await tx.dealStakeholder.create({ data: { dealId: deal.id, contactId: contact.id, role: 'decisor', isPrimary: true } });
      return deal;
    });
    return res.status(201).json({ success: true, saleId: sale.id, contactId: contact?.id || null, existing: false });
  } catch (error) {
    if (error.code === 'P2002' && externalId) {
      const existing = await prisma.deal.findUnique({ where: { userId_externalId: { userId, externalId } } });
      if (existing) return res.status(200).json({ success: true, saleId: existing.id, existing: true });
    }
    console.error('[integration-api.sales] Falha:', error.message);
    return res.status(error.status || 500).json({ success: false, error: error.message || 'Não foi possível criar a venda.' });
  }
});

module.exports = router;
