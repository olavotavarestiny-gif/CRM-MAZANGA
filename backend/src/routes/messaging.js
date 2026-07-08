const express = require('express');
const prisma = require('../lib/prisma');
const { requirePermission } = require('../lib/permissions');
const messagingService = require('../services/messaging-admin.service');

const router = express.Router();

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function clampPage(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_PAGE;
}

function clampPageSize(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(parsed, MAX_PAGE_SIZE);
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

async function getAccountUserIds(req) {
  const ownerId = req.user.effectiveUserId;
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { id: ownerId },
        { accountOwnerId: ownerId },
      ],
    },
    select: { id: true },
  });

  return users.map((user) => user.id);
}

function buildMessageWhere(userIds, filters = {}) {
  const where = {
    createdByUserId: { in: userIds },
  };

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

function handleRouteError(res, error) {
  const formatted = messagingService.formatMessagingError(error);
  return res.status(formatted.status).json(formatted.body);
}

router.get('/messages', requirePermission('chat', 'view'), async (req, res) => {
  try {
    const page = clampPage(req.query.page);
    const pageSize = clampPageSize(req.query.pageSize);
    const userIds = await getAccountUserIds(req);
    const where = buildMessageWhere(userIds, req.query);

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
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    res.json({
      data,
      pagination: buildPagination(total, page, pageSize),
    });
  } catch (error) {
    return handleRouteError(res, error);
  }
});

router.post('/messages/send-single', requirePermission('chat', 'edit'), async (req, res) => {
  try {
    const result = await messagingService.sendSingleTestMessage(req.user, {
      ...req.body,
      triggerSource: 'APP_MESSAGING',
    });
    return res.status(201).json(result);
  } catch (error) {
    return handleRouteError(res, error);
  }
});

router.post('/messages/:id/sync', requirePermission('chat', 'edit'), async (req, res) => {
  try {
    const userIds = await getAccountUserIds(req);
    const message = await prisma.messagingMessageLog.findFirst({
      where: {
        id: req.params.id,
        createdByUserId: { in: userIds },
      },
      select: { id: true },
    });

    if (!message) {
      return res.status(404).json({ error: 'Mensagem não encontrada.' });
    }

    const result = await messagingService.syncMessage(req.user, req.params.id);
    return res.json(result);
  } catch (error) {
    return handleRouteError(res, error);
  }
});

module.exports = router;
