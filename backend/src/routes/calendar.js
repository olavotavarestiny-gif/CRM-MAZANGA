const express = require('express');
const { google } = require('googleapis');
const prisma = require('../lib/prisma');
const requireAuth = require('../middleware/auth');
const { requirePermission } = require('../lib/permissions');
const { requirePlanFeature } = require('../lib/plan-limits');
const { log: logActivity } = require('../services/activity-log.service.js');
const {
  GOOGLE_SCOPES,
  CalendarIntegrationError,
  ensureGoogleCalendarConfigured,
  getFrontendCalendarUrl,
  resolveFrontendCalendarReturnTo,
  getOAuth2Client,
  signOAuthState,
  verifyOAuthState,
  storeOAuthTokens,
  syncGoogleCalendarEvents,
  mapStoredEventToCalendarEvent,
  parseSyncWindow,
  getGoogleErrorDetails,
  ensureCalendarWatch,
  handleWebhookNotification,
  stopCalendarWatch,
} = require('../lib/google-calendar');

const router = express.Router();

function buildFrontendRedirect(returnTo, params = {}) {
  const url = new URL(resolveFrontendCalendarReturnTo(returnTo || getFrontendCalendarUrl()));
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

function isImpersonating(req) {
  return !!req.user?.impersonatedBy;
}

async function getCalendarActor(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      accountOwnerId: true,
    },
  });

  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    organizationId: user.accountOwnerId || user.id,
  };
}

async function logCalendarActivity(userId, payload) {
  const actor = await getCalendarActor(userId);
  if (!actor) return;

  await logActivity({
    organization_id: actor.organizationId,
    user_id: actor.id,
    user_name: actor.name,
    ...payload,
  });
}

function handleCalendarError(res, error, fallbackMessage) {
  if (error instanceof CalendarIntegrationError) {
    return res.status(error.status).json({
      error: error.message,
      code: error.code,
      reauthRequired: error.code === 'reauth_required',
    });
  }

  const details = getGoogleErrorDetails(error);
  return res.status(500).json({
    error: fallbackMessage || details.message || 'Erro interno no calendário',
    code: 'calendar_internal_error',
  });
}

// Callback público do Google OAuth
router.get('/callback', async (req, res) => {
  let frontendReturnTo = null;

  try {
    ensureGoogleCalendarConfigured();

    const { code, state, error } = req.query;

    if (state) {
      try {
        frontendReturnTo = verifyOAuthState(String(state)).returnTo || null;
      } catch {
        frontendReturnTo = null;
      }
    }

    if (error) {
      return res.redirect(buildFrontendRedirect(frontendReturnTo, { error: 'access_denied' }));
    }

    if (!code || !state) {
      return res.redirect(buildFrontendRedirect(frontendReturnTo, { error: 'missing_params' }));
    }

    const statePayload = verifyOAuthState(String(state));
    frontendReturnTo = statePayload.returnTo || null;
    const userId = Number.parseInt(String(statePayload.userId), 10);
    if (!Number.isInteger(userId)) {
      return res.redirect(buildFrontendRedirect(frontendReturnTo, { error: 'invalid_state' }));
    }

    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(String(code));

    if (!tokens?.access_token) {
      return res.redirect(buildFrontendRedirect(frontendReturnTo, { error: 'oauth_failed' }));
    }

    oauth2Client.setCredentials(tokens);

    let googleEmail = null;
    try {
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const { data } = await oauth2.userinfo.get();
      googleEmail = data.email || null;
    } catch {
      // O email é acessório; não falha o fluxo
    }

    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : new Date(Date.now() + 3600 * 1000);

    await storeOAuthTokens({
      userId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || null,
      expiresAt,
      scope: tokens.scope || GOOGLE_SCOPES.join(' '),
      googleEmail,
      primaryCalendarId: 'primary',
    });

    await logCalendarActivity(userId, {
      entity_type: 'calendar_connection',
      entity_id: `google:${userId}`,
      entity_label: 'Google Calendar',
      action: 'connected',
      metadata: {
        provider: 'google',
        google_email: googleEmail,
      },
    });

    try {
      await syncGoogleCalendarEvents({ userId });
    } catch (error) {
      const details = getGoogleErrorDetails(error);
      console.warn(`[calendar] initial sync failed for userId ${userId}:`, details.message);
    }

    try {
      await ensureCalendarWatch(userId);
    } catch (error) {
      const details = getGoogleErrorDetails(error);
      console.warn(`[calendar] watch setup failed for userId ${userId}:`, details.message);
    }

    return res.redirect(buildFrontendRedirect(frontendReturnTo, { connected: 'true' }));
  } catch (error) {
    const details = getGoogleErrorDetails(error);
    console.error('[calendar] OAuth callback error:', details.message);
    return res.redirect(buildFrontendRedirect(frontendReturnTo, {
      error: error instanceof CalendarIntegrationError ? error.code : 'oauth_failed',
    }));
  }
});

router.post('/webhook', async (req, res) => {
  const channelId = req.get('X-Goog-Channel-Id');
  const channelToken = req.get('X-Goog-Channel-Token');

  res.sendStatus(200);

  if (!channelId) {
    return;
  }

  void (async () => {
    try {
      const syncRecord = await prisma.calendarSync.findUnique({
        where: { channelId },
        select: {
          channelToken: true,
        },
      });

      if (!syncRecord) {
        console.warn(`[calendar/webhook] unknown channel ${channelId}`);
        return;
      }

      if (!channelToken || syncRecord.channelToken !== channelToken) {
        console.warn(`[calendar/webhook] invalid token for channel ${channelId}`);
        return;
      }

      await handleWebhookNotification(channelId);
    } catch (error) {
      const details = getGoogleErrorDetails(error);
      console.error(`[calendar/webhook] processing failed for channel ${channelId}:`, details.message);
    }
  })();
});

// ---------------------------------------------------------------------------
// Connect / Disconnect: só requerem auth + plano (sem permissão — qualquer
// utilizador autenticado deve poder ligar/desligar a sua conta Google)
// ---------------------------------------------------------------------------

router.post('/connect', requireAuth, requirePlanFeature('calendario'), async (req, res) => {
  try {
    ensureGoogleCalendarConfigured();

    if (isImpersonating(req)) {
      return res.status(403).json({
        error: 'Não é permitido conectar Google Calendar durante impersonation',
        code: 'impersonation_not_allowed',
      });
    }

    const oauth2Client = getOAuth2Client();
    const state = signOAuthState({
      userId: req.user.id,
      returnTo: req.body?.returnTo,
    });
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: true,
      login_hint: req.user.email,
      scope: GOOGLE_SCOPES,
      state,
    });

    return res.json({ authUrl });
  } catch (error) {
    return handleCalendarError(res, error, 'Não foi possível iniciar a ligação Google Calendar');
  }
});

router.delete('/disconnect', requireAuth, requirePlanFeature('calendario'), async (req, res) => {
  try {
    if (isImpersonating(req)) {
      return res.status(403).json({
        error: 'Não é permitido desligar Google Calendar durante impersonation',
        code: 'impersonation_not_allowed',
      });
    }

    try {
      await stopCalendarWatch(req.user.id);
    } catch (error) {
      const details = getGoogleErrorDetails(error);
      console.warn('[calendar] disconnect watch cleanup failed:', details.message);
    }

    await prisma.$transaction([
      prisma.task.updateMany({
        where: { assignedToUserId: req.user.id },
        data: {
          googleCalendarEventId: null,
          googleCalendarHtmlLink: null,
          googleCalendarSyncedAt: null,
          googleCalendarSyncError: null,
        },
      }),
      prisma.googleCalendarEvent.deleteMany({
        where: { userId: req.user.id },
      }),
      prisma.calendarSync.deleteMany({
        where: { userId: req.user.id },
      }),
      prisma.googleCalendarToken.deleteMany({
        where: { userId: req.user.id },
      }),
    ]);

    await logActivity({
      organization_id: req.user.effectiveUserId,
      user_id: req.user.id,
      user_name: req.user.name,
      entity_type: 'calendar_connection',
      entity_id: `google:${req.user.id}`,
      entity_label: 'Google Calendar',
      action: 'disconnected',
      metadata: {
        provider: 'google',
      },
    });

    return res.json({ message: 'Google Calendar desligado com sucesso' });
  } catch (error) {
    return handleCalendarError(res, error, 'Não foi possível desligar o Google Calendar');
  }
});

// ---------------------------------------------------------------------------
// Restantes rotas: requerem auth + plano + permissão de vista
// ---------------------------------------------------------------------------
router.use(requireAuth, requirePlanFeature('calendario'), requirePermission('calendario', 'view'));

router.get('/status', async (req, res) => {
  try {
    const token = await prisma.googleCalendarToken.findUnique({
      where: { userId: req.user.id },
      select: {
        googleEmail: true,
        status: true,
        lastSyncAt: true,
        lastSyncError: true,
        lastSyncErrorAt: true,
        primaryCalendarId: true,
      },
    });

    return res.json({
      connected: !!token,
      email: token?.googleEmail || null,
      lastSyncAt: token?.lastSyncAt ? token.lastSyncAt.toISOString() : null,
      lastSyncError: token?.lastSyncError || null,
      lastSyncErrorAt: token?.lastSyncErrorAt ? token.lastSyncErrorAt.toISOString() : null,
      primaryCalendarId: token?.primaryCalendarId || null,
      reauthRequired: token?.status === 'needs_reauth',
    });
  } catch (error) {
    return handleCalendarError(res, error, 'Não foi possível obter o estado da ligação Google Calendar');
  }
});

router.post('/sync', async (req, res) => {
  try {
    if (isImpersonating(req)) {
      return res.status(403).json({
        error: 'Não é permitido sincronizar Google Calendar durante impersonation',
        code: 'impersonation_not_allowed',
      });
    }

    const token = await prisma.googleCalendarToken.findUnique({
      where: { userId: req.user.id },
      select: { id: true },
    });

    if (!token) {
      return res.status(409).json({
        error: 'Google Calendar não conectado',
        code: 'not_connected',
      });
    }

    const { start, end } = req.body || {};
    const result = await syncGoogleCalendarEvents({
      userId: req.user.id,
      start,
      end,
    });

    try {
      await ensureCalendarWatch(req.user.id);
    } catch (error) {
      const details = getGoogleErrorDetails(error);
      console.warn(`[calendar] watch ensure failed for userId ${req.user.id}:`, details.message);
    }

    await logActivity({
      organization_id: req.user.effectiveUserId,
      user_id: req.user.id,
      user_name: req.user.name,
      entity_type: 'calendar_sync',
      entity_id: `google:${req.user.id}`,
      entity_label: 'Google Calendar',
      action: 'synced',
      metadata: {
        provider: 'google',
        synced_count: result.syncedCount,
        removed_count: result.removedCount,
        primary_calendar_id: result.primaryCalendarId,
      },
    });

    return res.json({
      syncedCount: result.syncedCount,
      removedCount: result.removedCount,
      lastSyncAt: result.lastSyncAt.toISOString(),
      reauthRequired: false,
    });
  } catch (error) {
    const details = getGoogleErrorDetails(error);
    console.error('[calendar] sync error:', details.message);
    return handleCalendarError(res, error, 'Falha ao sincronizar eventos do Google Calendar');
  }
});

router.get('/events', async (req, res) => {
  try {
    const { start, end } = parseSyncWindow(req.query);
    const linkedTaskEvents = await prisma.task.findMany({
      where: {
        assignedToUserId: req.user.id,
        googleCalendarEventId: { not: null },
      },
      select: {
        googleCalendarEventId: true,
      },
    });

    const linkedGoogleEventIds = linkedTaskEvents
      .map((task) => task.googleCalendarEventId)
      .filter(Boolean);

    const events = await prisma.googleCalendarEvent.findMany({
      where: {
        userId: req.user.id,
        ...(linkedGoogleEventIds.length > 0
          ? { googleEventId: { notIn: linkedGoogleEventIds } }
          : {}),
        startAt: {
          gte: start,
          lte: end,
        },
      },
      orderBy: [
        { startAt: 'asc' },
        { endAt: 'asc' },
      ],
    });

    return res.json(events.map(mapStoredEventToCalendarEvent));
  } catch (error) {
    return handleCalendarError(res, error, 'Não foi possível carregar eventos sincronizados');
  }
});

module.exports = router;
