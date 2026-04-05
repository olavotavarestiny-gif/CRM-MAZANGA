const express = require('express');
const prisma = require('../lib/prisma');
const requireAuth = require('../middleware/auth');
const { DAILY_TIP_CATALOG } = require('../data/daily-tip-catalog');

const router = express.Router();

function getLuandaDateString(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Luanda',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  return `${year}-${month}-${day}`;
}

function getTipIndex(dateString, libraryLength) {
  const [year, month, day] = dateString.split('-').map(Number);
  const utcMidnight = Date.UTC(year, month - 1, day);
  const epoch = Date.UTC(2026, 0, 1);
  const elapsedDays = Math.floor((utcMidnight - epoch) / (24 * 60 * 60 * 1000));

  return ((elapsedDays % libraryLength) + libraryLength) % libraryLength;
}

function getAudienceBucket(user) {
  if (user?.isSuperAdmin || user?.role === 'admin' || user?.isAccountOwner) {
    return 'owner';
  }

  return 'equipa';
}

async function getWorkspaceMode(user) {
  const ownerUserId = user?.effectiveUserId || user?.id;
  const owner = await prisma.user.findUnique({
    where: { id: ownerUserId },
    select: { workspaceMode: true },
  });

  return owner?.workspaceMode === 'comercio' ? 'comercio' : 'servicos';
}

function buildPersonalizedMessage(name, message) {
  const firstName = String(name || '').trim().split(/\s+/)[0] || 'Olá';
  return `${firstName}, ${message}`;
}

function buildDailyTipPayload({ user, dateString, workspaceMode }) {
  const audienceBucket = getAudienceBucket(user);
  const library = DAILY_TIP_CATALOG[workspaceMode]?.[audienceBucket] || [];

  if (!library.length) {
    throw new Error('Biblioteca de dicas não configurada');
  }

  const tipIndex = getTipIndex(dateString, library.length);
  const tip = library[tipIndex];

  return {
    date: dateString,
    tipIndex,
    workspaceMode,
    audienceBucket,
    tip: {
      id: tip.id,
      title: 'Dica do Dia',
      heading: tip.title,
      message: tip.message,
      personalizedMessage: buildPersonalizedMessage(user?.name, tip.message),
      category: tip.category,
    },
  };
}

router.post('/deliver', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const dateString = getLuandaDateString();
    const workspaceMode = await getWorkspaceMode(req.user);
    const payload = buildDailyTipPayload({ user: req.user, dateString, workspaceMode });

    const existing = await prisma.dailyTipDelivery.findUnique({
      where: {
        userId_deliveryDate: {
          userId,
          deliveryDate: dateString,
        },
      },
    });

    if (existing) {
      const storedPayload = existing.payload && typeof existing.payload === 'object'
        ? existing.payload
        : payload;

      return res.json({
        show: false,
        ...storedPayload,
      });
    }

    await prisma.dailyTipDelivery.create({
      data: {
        userId,
        deliveryDate: dateString,
        workspaceMode: payload.workspaceMode,
        audienceBucket: payload.audienceBucket,
        tipId: payload.tip.id,
        payload,
      },
    });

    return res.json({
      show: true,
      ...payload,
    });
  } catch (err) {
    console.error('[daily-tip] error:', err);
    return res.json({ show: false });
  }
});

module.exports = router;
