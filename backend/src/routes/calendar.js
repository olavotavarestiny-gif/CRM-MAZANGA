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
  getOAuth2Client,
  signOAuthState,
  verifyOAuthState,
  storeOAuthTokens,
  syncGoogleCalendarEvents,
  mapStoredEventToCalendarEvent,
  parseSyncWindow,
  getGoogleErrorDetails,
  generateChannelToken,
  pushEventToGoogle,
  deleteEventFromGoogle,
  startCalendarWatch,
  stopCalendarWatch,
  handleWebhookNotification,
} = require('../lib/google-calendar');

const router = express.Router();

function buildFrontendRedirect(params = {}) {
  const url = new URL(getFrontendCalendarUrl());
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
  try {
    ensureGoogleCalendarConfigured();

    const { code, state, error } = req.query;
    if (error) {
      return res.redirect(buildFrontendRedirect({ error: 'access_denied' }));
    }

    if (!code || !state) {
      return res.redirect(buildFrontendRedirect({ error: 'missing_params' }));
    }

    const statePayload = verifyOAuthState(String(state));
    const userId = Number.parseInt(String(statePayload.userId), 10);
    if (!Number.isInteger(userId)) {
      return res.redirect(buildFrontendRedirect({ error: 'invalid_state' }));
    }

    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(String(code));

    if (!tokens?.access_token) {
      return res.redirect(buildFrontendRedirect({ error: 'oauth_failed' }));
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

    return res.redirect(buildFrontendRedirect({ connected: 'true' }));
  } catch (error) {
    const details = getGoogleErrorDetails(error);
    console.error('[calendar] OAuth callback error:', details.message);
    return res.redirect(buildFrontendRedirect({
      error: error instanceof CalendarIntegrationError ? error.code : 'oauth_failed',
    }));
  }
});

// ---------------------------------------------------------------------------
// Public: Google Calendar push-notification webhook
// ---------------------------------------------------------------------------
router.post('/webhook', async (req, res) => {
  // Acknowledge immediately — Google expects a 2xx within 30 s
  res.status(200).end();

  const channelId = req.headers['x-goog-channel-id'];
  const channelToken = req.headers['x-goog-channel-token'];
  const resourceState = req.headers['x-goog-resource-state'];

  if (!channelId) return;

  // Initial sync handshake — nothing to do
  if (resourceState === 'sync') return;

  try {
    const record = await prisma.calendarSync.findUnique({ where: { channelId } });
    if (!record) return;

    // Validate token to reject forged requests
    const expected = generateChannelToken(record.userId);
    if (channelToken !== expected) {
      console.warn('[calendar/webhook] invalid channel token — ignoring notification');
      return;
    }

    // Process asynchronously (response already sent)
    handleWebhookNotification(channelId).catch((err) => {
      console.error('[calendar/webhook] background sync error:', err?.message);
    });
  } catch (err) {
    console.error('[calendar/webhook] error processing notification:', err?.message);
  }
});

router.use(requireAuth, requirePlanFeature('calendario'), requirePermission('calendario', 'view'));

router.post('/connect', async (req, res) => {
  try {
    ensureGoogleCalendarConfigured();

    if (isImpersonating(req)) {
      return res.status(403).json({
        error: 'Não é permitido conectar Google Calendar durante impersonation',
        code: 'impersonation_not_allowed',
      });
    }

    const oauth2Client = getOAuth2Client();
    const state = signOAuthState({ userId: req.user.id });
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

    const events = await prisma.googleCalendarEvent.findMany({
      where: {
        userId: req.user.id,
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

router.delete('/disconnect', async (req, res) => {
  try {
    if (isImpersonating(req)) {
      return res.status(403).json({
        error: 'Não é permitido desligar Google Calendar durante impersonation',
        code: 'impersonation_not_allowed',
      });
    }

    await prisma.$transaction([
      prisma.googleCalendarEvent.deleteMany({
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
// Bidirectional sync: CRM → Google Calendar
// ---------------------------------------------------------------------------

router.post('/events/push', async (req, res) => {
  try {
    if (isImpersonating(req)) {
      return res.status(403).json({
        error: 'Não é permitido criar eventos no Google Calendar durante impersonation',
        code: 'impersonation_not_allowed',
      });
    }

    const token = await prisma.googleCalendarToken.findUnique({
      where: { userId: req.user.id },
      select: { id: true },
    });

    if (!token) {
      return res.status(409).json({ error: 'Google Calendar não conectado', code: 'not_connected' });
    }

    const { title, description, startTime, endTime, attendees, googleEventId } = req.body || {};

    if (!title || !startTime || !endTime) {
      return res.status(400).json({
        error: 'Campos obrigatórios em falta: title, startTime, endTime',
        code: 'missing_fields',
      });
    }

    const result = await pushEventToGoogle(req.user.id, {
      title,
      description,
      startTime,
      endTime,
      attendees,
      googleEventId,
    });

    return res.json(result);
  } catch (error) {
    return handleCalendarError(res, error, 'Não foi possível criar/actualizar evento no Google Calendar');
  }
});

router.delete('/events/:googleEventId', async (req, res) => {
  try {
    const { googleEventId } = req.params;

    if (!googleEventId) {
      return res.status(400).json({ error: 'googleEventId em falta', code: 'missing_fields' });
    }

    await deleteEventFromGoogle(req.user.id, googleEventId);

    // Also remove the local cached copy if it exists
    await prisma.googleCalendarEvent.deleteMany({
      where: { userId: req.user.id, googleEventId },
    });

    return res.json({ success: true });
  } catch (error) {
    return handleCalendarError(res, error, 'Não foi possível apagar evento no Google Calendar');
  }
});

// ---------------------------------------------------------------------------
// Watch (push notifications) management
// ---------------------------------------------------------------------------

router.post('/watch/start', async (req, res) => {
  try {
    if (isImpersonating(req)) {
      return res.status(403).json({
        error: 'Não é permitido gerir notificações durante impersonation',
        code: 'impersonation_not_allowed',
      });
    }

    const token = await prisma.googleCalendarToken.findUnique({
      where: { userId: req.user.id },
      select: { id: true },
    });

    if (!token) {
      return res.status(409).json({ error: 'Google Calendar não conectado', code: 'not_connected' });
    }

    const result = await startCalendarWatch(req.user.id);

    return res.json({
      channelId: result.channelId,
      watchExpiry: result.watchExpiry.toISOString(),
    });
  } catch (error) {
    return handleCalendarError(res, error, 'Não foi possível activar notificações do Google Calendar');
  }
});

router.post('/watch/stop', async (req, res) => {
  try {
    if (isImpersonating(req)) {
      return res.status(403).json({
        error: 'Não é permitido gerir notificações durante impersonation',
        code: 'impersonation_not_allowed',
      });
    }

    await stopCalendarWatch(req.user.id);

    return res.json({ success: true });
  } catch (error) {
    return handleCalendarError(res, error, 'Não foi possível desactivar notificações do Google Calendar');
  }
});

router.get('/watch/status', async (req, res) => {
  try {
    const record = await prisma.calendarSync.findUnique({
      where: { userId: req.user.id },
      select: { watchExpiry: true },
    });

    const active = !!record && record.watchExpiry > new Date();

    return res.json({
      active,
      watchExpiry: record ? record.watchExpiry.toISOString() : null,
    });
  } catch (error) {
    return handleCalendarError(res, error, 'Não foi possível obter estado das notificações');
  }
});

module.exports = router;
