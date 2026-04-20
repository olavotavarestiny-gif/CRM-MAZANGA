const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { google } = require('googleapis');
const prisma = require('./prisma');

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
];

const GOOGLE_STATE_PURPOSE = 'google_calendar_oauth';
const TOKEN_PREFIX = 'enc:v1:';
const DEFAULT_SYNC_PAST_DAYS = 30;
const DEFAULT_SYNC_FUTURE_DAYS = 365;
const REFRESH_BUFFER_MS = 60 * 1000;

class CalendarIntegrationError extends Error {
  constructor(message, code = 'calendar_error', status = 500) {
    super(message);
    this.name = 'CalendarIntegrationError';
    this.code = code;
    this.status = status;
  }
}

function normalizeOrigin(value, fallback) {
  if (!value) return fallback;
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  return `https://${value}`;
}

function ensureGoogleCalendarConfigured() {
  const missing = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_REDIRECT_URI',
    'GOOGLE_TOKEN_ENCRYPTION_KEY',
  ].filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new CalendarIntegrationError(
      `Google Calendar não configurado no servidor (${missing.join(', ')})`,
      'calendar_not_configured',
      503
    );
  }
}

function getFrontendCalendarUrl() {
  const explicitUrl = process.env.FRONTEND_CALENDAR_URL;
  if (explicitUrl) return explicitUrl;

  const frontendOrigin = normalizeOrigin(process.env.FRONTEND_URL, 'http://localhost:3000');
  return `${frontendOrigin.replace(/\/+$/, '')}/calendario`;
}

function getKnownFrontendOrigins() {
  const candidates = [
    process.env.FRONTEND_URL,
    process.env.FRONTEND_CALENDAR_URL,
    process.env.ALLOWED_VERCEL_URL,
  ].filter(Boolean);

  const origins = new Set();

  candidates.forEach((value) => {
    try {
      origins.add(new URL(normalizeOrigin(value)).origin);
    } catch {
      // Ignora entradas inválidas e usa apenas as conhecidas
    }
  });

  return origins;
}

function isAllowedFrontendReturnTo(value) {
  if (!value || typeof value !== 'string') return false;

  try {
    const url = new URL(value);
    const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';

    if (isLocalhost) {
      return url.protocol === 'http:' || url.protocol === 'https:';
    }

    if (url.protocol !== 'https:') {
      return false;
    }

    if (url.hostname === 'app.kukugest.ao' || url.hostname.endsWith('.app.kukugest.ao')) {
      return true;
    }

    return getKnownFrontendOrigins().has(url.origin);
  } catch {
    return false;
  }
}

function resolveFrontendCalendarReturnTo(value) {
  if (isAllowedFrontendReturnTo(value)) {
    return value;
  }

  return getFrontendCalendarUrl();
}

function getCalendarWebhookAddress() {
  if (process.env.GOOGLE_WEBHOOK_ADDRESS) {
    return process.env.GOOGLE_WEBHOOK_ADDRESS;
  }

  try {
    const redirectUrl = new URL(process.env.GOOGLE_REDIRECT_URI);
    return `${redirectUrl.origin}/api/calendar/webhook`;
  } catch {
    return 'https://crm-mazanga.onrender.com/api/calendar/webhook';
  }
}

function getOAuth2Client() {
  ensureGoogleCalendarConfigured();

  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

function getEncryptionKey() {
  const rawKey = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  if (!rawKey) {
    throw new CalendarIntegrationError(
      'GOOGLE_TOKEN_ENCRYPTION_KEY não configurada',
      'calendar_not_configured',
      503
    );
  }

  return crypto.createHash('sha256').update(rawKey, 'utf8').digest();
}

function encryptToken(plainValue) {
  if (!plainValue) return null;
  if (plainValue.startsWith(TOKEN_PREFIX)) return plainValue;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plainValue, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${TOKEN_PREFIX}${iv.toString('base64url')}.${encrypted.toString('base64url')}.${authTag.toString('base64url')}`;
}

function decryptToken(storedValue) {
  if (!storedValue) {
    return { value: null, legacy: false };
  }

  if (!storedValue.startsWith(TOKEN_PREFIX)) {
    return { value: storedValue, legacy: true };
  }

  const payload = storedValue.slice(TOKEN_PREFIX.length);
  const [ivPart, encryptedPart, authTagPart] = payload.split('.');
  if (!ivPart || !encryptedPart || !authTagPart) {
    throw new CalendarIntegrationError('Token Google cifrado inválido', 'invalid_stored_token', 500);
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(ivPart, 'base64url')
  );
  decipher.setAuthTag(Buffer.from(authTagPart, 'base64url'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, 'base64url')),
    decipher.final(),
  ]).toString('utf8');

  return { value: decrypted, legacy: false };
}

function signOAuthState({ userId, returnTo }) {
  const safeReturnTo = isAllowedFrontendReturnTo(returnTo) ? returnTo : undefined;

  return jwt.sign(
    {
      purpose: GOOGLE_STATE_PURPOSE,
      userId,
      nonce: crypto.randomUUID(),
      ...(safeReturnTo ? { returnTo: safeReturnTo } : {}),
    },
    process.env.JWT_SECRET || 'fallback-secret',
    { expiresIn: '10m' }
  );
}

function verifyOAuthState(state) {
  try {
    const payload = jwt.verify(state, process.env.JWT_SECRET || 'fallback-secret');
    if (payload.purpose !== GOOGLE_STATE_PURPOSE || !payload.userId) {
      throw new Error('state payload inválido');
    }

    return {
      ...payload,
      returnTo: isAllowedFrontendReturnTo(payload.returnTo) ? payload.returnTo : null,
    };
  } catch {
    throw new CalendarIntegrationError('State OAuth inválido ou expirado', 'invalid_state', 400);
  }
}

function getDefaultSyncWindow() {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - DEFAULT_SYNC_PAST_DAYS);
  start.setHours(0, 0, 0, 0);

  const end = new Date(now);
  end.setDate(end.getDate() + DEFAULT_SYNC_FUTURE_DAYS);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function parseSyncWindow(input = {}) {
  const fallback = getDefaultSyncWindow();
  const start = input.start ? new Date(input.start) : fallback.start;
  const end = input.end ? new Date(input.end) : fallback.end;

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new CalendarIntegrationError('Janela de sincronização inválida', 'invalid_sync_window', 400);
  }

  if (start > end) {
    throw new CalendarIntegrationError('A data inicial não pode ser superior à final', 'invalid_sync_window', 400);
  }

  return { start, end };
}

function trimErrorMessage(message) {
  if (!message) return null;
  return String(message).slice(0, 1000);
}

function getGoogleErrorDetails(error) {
  const responseData = error?.response?.data || null;
  return {
    message: responseData?.error_description
      || responseData?.error?.message
      || responseData?.error
      || error?.message
      || 'Erro desconhecido',
    code: responseData?.error
      || responseData?.error?.status
      || error?.code
      || null,
  };
}

function isInvalidGrantError(error) {
  const details = getGoogleErrorDetails(error);
  return details.code === 'invalid_grant' || details.message.toLowerCase().includes('invalid_grant');
}

async function markConnectionNeedsReauth(userId, rawMessage) {
  const message = trimErrorMessage(rawMessage) || 'Ligação Google Calendar requer nova autorização';

  await prisma.googleCalendarToken.updateMany({
    where: { userId },
    data: {
      status: 'needs_reauth',
      lastSyncError: message,
      lastSyncErrorAt: new Date(),
    },
  });

  throw new CalendarIntegrationError(
    'A ligação ao Google Calendar expirou. Reconecte a conta para continuar.',
    'reauth_required',
    409
  );
}

async function storeOAuthTokens({
  userId,
  accessToken,
  refreshToken,
  expiresAt,
  scope,
  googleEmail,
  primaryCalendarId = 'primary',
}) {
  ensureGoogleCalendarConfigured();

  const createData = {
    userId,
    provider: 'google',
    status: 'connected',
    accessToken: encryptToken(accessToken),
    refreshToken: refreshToken ? encryptToken(refreshToken) : null,
    expiresAt,
    scope: scope || null,
    googleEmail: googleEmail || null,
    primaryCalendarId: primaryCalendarId || 'primary',
    lastSyncError: null,
    lastSyncErrorAt: null,
  };

  const updateData = {
    provider: 'google',
    status: 'connected',
    accessToken: encryptToken(accessToken),
    expiresAt,
    scope: scope || null,
    googleEmail: googleEmail || null,
    primaryCalendarId: primaryCalendarId || 'primary',
    lastSyncError: null,
    lastSyncErrorAt: null,
  };

  if (refreshToken) {
    updateData.refreshToken = encryptToken(refreshToken);
  }

  return prisma.googleCalendarToken.upsert({
    where: { userId },
    create: createData,
    update: updateData,
  });
}

function normalizeGoogleEvent(event, { userId, calendarId }) {
  const startRaw = event?.start?.dateTime || event?.start?.date;
  if (!event?.id || !startRaw) return null;

  const isAllDay = !event?.start?.dateTime;
  const startAt = isAllDay
    ? new Date(`${event.start.date}T00:00:00.000Z`)
    : new Date(event.start.dateTime);

  let endAt;
  if (isAllDay) {
    endAt = event?.end?.date
      ? new Date(`${event.end.date}T00:00:00.000Z`)
      : new Date(`${event.start.date}T00:00:00.000Z`);
  } else {
    endAt = event?.end?.dateTime
      ? new Date(event.end.dateTime)
      : new Date(event.start.dateTime);
  }

  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    return null;
  }

  if (endAt < startAt) {
    endAt = new Date(startAt);
  }

  const sourceUpdatedAt = event.updated ? new Date(event.updated) : null;

  return {
    userId,
    calendarId,
    googleEventId: event.id,
    title: event.summary || '(sem título)',
    description: event.description || null,
    location: event.location || null,
    startAt,
    endAt,
    isAllDay,
    status: event.status || 'confirmed',
    htmlLink: event.htmlLink || null,
    sourceUpdatedAt: sourceUpdatedAt && !Number.isNaN(sourceUpdatedAt.getTime()) ? sourceUpdatedAt : null,
  };
}

function mapStoredEventToCalendarEvent(event) {
  return {
    id: `google_${event.googleEventId}`,
    title: event.title,
    description: event.description || undefined,
    location: event.location || undefined,
    externalUrl: event.htmlLink || undefined,
    start: event.isAllDay ? event.startAt.toISOString().slice(0, 10) : event.startAt.toISOString(),
    end: event.isAllDay ? event.endAt.toISOString().slice(0, 10) : event.endAt.toISOString(),
    allDay: event.isAllDay,
    source: 'google',
  };
}

async function getConnectionTokens(tokenRecord) {
  const accessToken = decryptToken(tokenRecord.accessToken);
  const refreshToken = decryptToken(tokenRecord.refreshToken);

  return {
    accessToken: accessToken.value,
    refreshToken: refreshToken.value,
    needsReencrypt: accessToken.legacy || refreshToken.legacy,
  };
}

async function refreshAccessToken({ userId, tokenRecord, refreshToken, scope, googleEmail, primaryCalendarId }) {
  if (!refreshToken) {
    return markConnectionNeedsReauth(userId, 'Refresh token indisponível');
  }

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  try {
    const { credentials } = await oauth2Client.refreshAccessToken();
    const expiresAt = credentials.expiry_date
      ? new Date(credentials.expiry_date)
      : new Date(Date.now() + 3600 * 1000);

    await storeOAuthTokens({
      userId,
      accessToken: credentials.access_token,
      refreshToken: credentials.refresh_token || refreshToken,
      expiresAt,
      scope: credentials.scope || scope || tokenRecord.scope,
      googleEmail: googleEmail || tokenRecord.googleEmail,
      primaryCalendarId: primaryCalendarId || tokenRecord.primaryCalendarId || 'primary',
    });

    oauth2Client.setCredentials({
      access_token: credentials.access_token,
      refresh_token: credentials.refresh_token || refreshToken,
    });

    const updatedRecord = await prisma.googleCalendarToken.findUnique({ where: { userId } });
    return { oauth2Client, tokenRecord: updatedRecord };
  } catch (error) {
    if (isInvalidGrantError(error)) {
      return markConnectionNeedsReauth(userId, getGoogleErrorDetails(error).message);
    }

    throw new CalendarIntegrationError(
      'Não foi possível renovar o token do Google Calendar',
      'refresh_failed',
      502
    );
  }
}

async function getAuthorizedGoogleClient(userId) {
  const tokenRecord = await prisma.googleCalendarToken.findUnique({ where: { userId } });
  if (!tokenRecord) {
    throw new CalendarIntegrationError('Google Calendar não conectado', 'not_connected', 409);
  }

  const { accessToken, refreshToken, needsReencrypt } = await getConnectionTokens(tokenRecord);

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  const shouldRefresh = !accessToken || tokenRecord.expiresAt.getTime() <= (Date.now() + REFRESH_BUFFER_MS);
  if (shouldRefresh) {
    return refreshAccessToken({
      userId,
      tokenRecord,
      refreshToken,
      scope: tokenRecord.scope,
      googleEmail: tokenRecord.googleEmail,
      primaryCalendarId: tokenRecord.primaryCalendarId,
    });
  }

  if (needsReencrypt) {
    await prisma.googleCalendarToken.update({
      where: { userId },
      data: {
        accessToken: encryptToken(accessToken),
        ...(refreshToken ? { refreshToken: encryptToken(refreshToken) } : {}),
      },
    });
  }

  return { oauth2Client, tokenRecord };
}

async function syncGoogleCalendarEvents({ userId, start, end }) {
  const syncWindow = parseSyncWindow({ start, end });
  const syncStart = syncWindow.start;
  const syncEnd = syncWindow.end;

  try {
    const { oauth2Client, tokenRecord } = await getAuthorizedGoogleClient(userId);
    const calendarApi = google.calendar({ version: 'v3', auth: oauth2Client });

    let primaryCalendarId = tokenRecord.primaryCalendarId || 'primary';
    try {
      const { data: calendarInfo } = await calendarApi.calendars.get({ calendarId: 'primary' });
      if (calendarInfo?.id) {
        primaryCalendarId = calendarInfo.id;
      }
    } catch {
      // Mantém "primary" se a metadata não estiver acessível
    }

    const remoteEvents = [];
    let pageToken = undefined;

    do {
      const { data } = await calendarApi.events.list({
        calendarId: 'primary',
        timeMin: syncStart.toISOString(),
        timeMax: syncEnd.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 250,
        pageToken,
        showDeleted: false,
      });

      remoteEvents.push(...(data.items || []));
      pageToken = data.nextPageToken || undefined;
    } while (pageToken);

    const normalizedEvents = remoteEvents
      .map((event) => normalizeGoogleEvent(event, { userId, calendarId: primaryCalendarId }))
      .filter(Boolean);

    const localEventsInWindow = await prisma.googleCalendarEvent.findMany({
      where: {
        userId,
        calendarId: primaryCalendarId,
        startAt: { lte: syncEnd },
        endAt: { gte: syncStart },
      },
      select: {
        id: true,
        calendarId: true,
        googleEventId: true,
      },
    });

    const remoteKeys = new Set(
      normalizedEvents.map((event) => `${event.calendarId}:${event.googleEventId}`)
    );
    const deleteIds = localEventsInWindow
      .filter((event) => !remoteKeys.has(`${event.calendarId}:${event.googleEventId}`))
      .map((event) => event.id);

    const operations = normalizedEvents.map((event) => prisma.googleCalendarEvent.upsert({
      where: {
        userId_calendarId_googleEventId: {
          userId: event.userId,
          calendarId: event.calendarId,
          googleEventId: event.googleEventId,
        },
      },
      create: event,
      update: {
        title: event.title,
        description: event.description,
        location: event.location,
        startAt: event.startAt,
        endAt: event.endAt,
        isAllDay: event.isAllDay,
        status: event.status,
        htmlLink: event.htmlLink,
        sourceUpdatedAt: event.sourceUpdatedAt,
      },
    }));

    if (deleteIds.length > 0) {
      operations.push(prisma.googleCalendarEvent.deleteMany({
        where: { id: { in: deleteIds } },
      }));
    }

    if (operations.length > 0) {
      await prisma.$transaction(operations);
    }

    const lastSyncAt = new Date();
    await prisma.googleCalendarToken.update({
      where: { userId },
      data: {
        status: 'connected',
        primaryCalendarId,
        lastSyncAt,
        lastSyncError: null,
        lastSyncErrorAt: null,
      },
    });

    return {
      syncedCount: normalizedEvents.length,
      removedCount: deleteIds.length,
      lastSyncAt,
      primaryCalendarId,
    };
  } catch (error) {
    if (error instanceof CalendarIntegrationError) {
      if (error.code !== 'reauth_required') {
        await prisma.googleCalendarToken.updateMany({
          where: { userId },
          data: {
            lastSyncError: trimErrorMessage(error.message),
            lastSyncErrorAt: new Date(),
          },
        });
      }
      throw error;
    }

    const details = getGoogleErrorDetails(error);
    if (isInvalidGrantError(error)) {
      return markConnectionNeedsReauth(userId, details.message);
    }

    await prisma.googleCalendarToken.updateMany({
      where: { userId },
      data: {
        lastSyncError: trimErrorMessage(details.message),
        lastSyncErrorAt: new Date(),
      },
    });

    throw new CalendarIntegrationError(
      'Falha ao sincronizar eventos do Google Calendar',
      'sync_failed',
      502
    );
  }
}

// ---------------------------------------------------------------------------
// Bidirectional sync helpers (CRM → Google Calendar)
// ---------------------------------------------------------------------------

function generateChannelToken(userId) {
  const key = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || '';
  return crypto.createHmac('sha256', key).update(String(userId)).digest('hex');
}

async function pushEventToGoogle(userId, eventData) {
  const {
    title,
    description,
    startTime,
    endTime,
    attendees,
    googleEventId,
    allDay,
    startDate,
    endDate,
  } = eventData;

  const resource = {
    summary: title,
    description: description || undefined,
  };

  if (allDay) {
    resource.start = { date: startDate };
    resource.end = { date: endDate };
  } else {
    resource.start = { dateTime: new Date(startTime).toISOString(), timeZone: 'Africa/Luanda' };
    resource.end = { dateTime: new Date(endTime).toISOString(), timeZone: 'Africa/Luanda' };
  }

  if (Array.isArray(attendees) && attendees.length > 0) {
    resource.attendees = attendees.map((email) => ({ email }));
  }

  const { oauth2Client } = await getAuthorizedGoogleClient(userId);
  const calendarApi = google.calendar({ version: 'v3', auth: oauth2Client });

  try {
    let data;
    if (googleEventId) {
      ({ data } = await calendarApi.events.patch({
        calendarId: 'primary',
        eventId: googleEventId,
        requestBody: resource,
      }));
    } else {
      ({ data } = await calendarApi.events.insert({
        calendarId: 'primary',
        requestBody: resource,
      }));
    }

    return { googleEventId: data.id, htmlLink: data.htmlLink || null };
  } catch (error) {
    if (error?.response?.status === 401) {
      // Refresh and retry once
      const { oauth2Client: refreshed } = await getAuthorizedGoogleClient(userId);
      const retryApi = google.calendar({ version: 'v3', auth: refreshed });
      let data;
      if (googleEventId) {
        ({ data } = await retryApi.events.patch({
          calendarId: 'primary',
          eventId: googleEventId,
          requestBody: resource,
        }));
      } else {
        ({ data } = await retryApi.events.insert({
          calendarId: 'primary',
          requestBody: resource,
        }));
      }
      return { googleEventId: data.id, htmlLink: data.htmlLink || null };
    }

    const details = getGoogleErrorDetails(error);
    throw new CalendarIntegrationError(
      `Não foi possível criar/actualizar evento no Google Calendar: ${details.message}`,
      'push_failed',
      502
    );
  }
}

async function deleteEventFromGoogle(userId, googleEventId) {
  const { oauth2Client } = await getAuthorizedGoogleClient(userId);
  const calendarApi = google.calendar({ version: 'v3', auth: oauth2Client });

  try {
    await calendarApi.events.delete({ calendarId: 'primary', eventId: googleEventId });
  } catch (error) {
    if (error?.response?.status === 404 || error?.response?.status === 410) {
      return { success: true }; // Already deleted — treat as success
    }

    const details = getGoogleErrorDetails(error);
    throw new CalendarIntegrationError(
      `Não foi possível apagar evento no Google Calendar: ${details.message}`,
      'delete_failed',
      502
    );
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// Watch (push notifications)
// ---------------------------------------------------------------------------

const WATCH_ADDRESS = getCalendarWebhookAddress();

async function startCalendarWatch(userId) {
  const { oauth2Client } = await getAuthorizedGoogleClient(userId);
  const calendarApi = google.calendar({ version: 'v3', auth: oauth2Client });

  const channelId = crypto.randomUUID();
  const channelToken = generateChannelToken(userId);

  const { data: watchData } = await calendarApi.events.watch({
    calendarId: 'primary',
    requestBody: {
      id: channelId,
      type: 'web_hook',
      address: WATCH_ADDRESS,
      token: channelToken,
    },
  });

  const watchExpiry = watchData.expiration
    ? new Date(Number(watchData.expiration))
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days fallback

  // Fetch initial syncToken for incremental sync
  let syncToken = null;
  try {
    const { data: listData } = await calendarApi.events.list({
      calendarId: 'primary',
      maxResults: 1,
      showDeleted: false,
      singleEvents: true,
    });
    syncToken = listData.nextSyncToken || null;
  } catch {
    // syncToken is optional; proceed without it
  }

  await prisma.calendarSync.upsert({
    where: { userId },
    create: {
      userId,
      channelId,
      resourceId: watchData.resourceId,
      channelToken,
      syncToken,
      watchExpiry,
    },
    update: {
      channelId,
      resourceId: watchData.resourceId,
      channelToken,
      syncToken,
      watchExpiry,
    },
  });

  return { channelId, watchExpiry };
}

async function ensureCalendarWatch(userId) {
  const existing = await prisma.calendarSync.findUnique({
    where: { userId },
    select: {
      watchExpiry: true,
    },
  });

  const renewalThreshold = new Date(Date.now() + 60 * 60 * 1000);
  if (existing?.watchExpiry && existing.watchExpiry > renewalThreshold) {
    return existing;
  }

  if (existing) {
    await stopCalendarWatch(userId);
  }

  return startCalendarWatch(userId);
}

async function stopCalendarWatch(userId) {
  const record = await prisma.calendarSync.findUnique({ where: { userId } });
  if (!record) return;

  try {
    const { oauth2Client } = await getAuthorizedGoogleClient(userId);
    const calendarApi = google.calendar({ version: 'v3', auth: oauth2Client });
    await calendarApi.channels.stop({
      requestBody: { id: record.channelId, resourceId: record.resourceId },
    });
  } catch {
    // Non-blocking: channel may already be expired
  }

  await prisma.calendarSync.delete({ where: { userId } });
}

async function handleWebhookNotification(channelId) {
  const record = await prisma.calendarSync.findUnique({ where: { channelId } });
  if (!record) return;

  const { userId, syncToken } = record;
  const tokenRecord = await prisma.googleCalendarToken.findUnique({
    where: { userId },
    select: {
      primaryCalendarId: true,
    },
  });
  if (!tokenRecord) return;

  const primaryCalendarId = tokenRecord.primaryCalendarId || 'primary';

  try {
    const { oauth2Client } = await getAuthorizedGoogleClient(userId);
    const calendarApi = google.calendar({ version: 'v3', auth: oauth2Client });

    let newSyncToken = syncToken;
    let pageToken;

    do {
      let listParams = {
        calendarId: 'primary',
        showDeleted: true,
        singleEvents: true,
        maxResults: 250,
        pageToken,
      };

      if (syncToken) {
        listParams.syncToken = syncToken;
      } else {
        // No syncToken — fall back to 30-day window
        const now = new Date();
        const past = new Date(now);
        past.setDate(past.getDate() - 30);
        listParams.timeMin = past.toISOString();
        listParams.timeMax = new Date(now.setDate(now.getDate() + 365)).toISOString();
        listParams.orderBy = 'startTime';
      }

      const { data } = await calendarApi.events.list(listParams);

      const items = data.items || [];

      // Separate cancelled (deleted) events from active ones
      const toDelete = items.filter((e) => e.status === 'cancelled').map((e) => e.id);
      const toUpsert = items
        .filter((e) => e.status !== 'cancelled')
        .map((e) => normalizeGoogleEvent(e, { userId, calendarId: primaryCalendarId }))
        .filter(Boolean);

      const ops = [];

      if (toDelete.length > 0) {
        ops.push(
          prisma.googleCalendarEvent.deleteMany({
            where: {
              userId,
              calendarId: primaryCalendarId,
              googleEventId: { in: toDelete },
            },
          })
        );
      }

      for (const event of toUpsert) {
        ops.push(
          prisma.googleCalendarEvent.upsert({
            where: {
              userId_calendarId_googleEventId: {
                userId: event.userId,
                calendarId: event.calendarId,
                googleEventId: event.googleEventId,
              },
            },
            create: event,
            update: {
              title: event.title,
              description: event.description,
              location: event.location,
              startAt: event.startAt,
              endAt: event.endAt,
              isAllDay: event.isAllDay,
              status: event.status,
              htmlLink: event.htmlLink,
              sourceUpdatedAt: event.sourceUpdatedAt,
            },
          })
        );
      }

      if (ops.length > 0) {
        await prisma.$transaction(ops);
      }

      newSyncToken = data.nextSyncToken || newSyncToken;
      pageToken = data.nextPageToken;
    } while (pageToken);

    // Persist updated syncToken
    if (newSyncToken !== syncToken) {
      await prisma.calendarSync.update({
        where: { channelId },
        data: { syncToken: newSyncToken },
      });
    }
  } catch (error) {
    // 410 Gone = syncToken expired → fall back to full sync
    if (error?.response?.status === 410) {
      console.warn(`[calendar/webhook] syncToken expired for userId ${userId}, falling back to full sync`);
      await syncGoogleCalendarEvents({ userId });

      // Reset syncToken in DB
      await prisma.calendarSync.update({
        where: { channelId },
        data: { syncToken: null },
      });
      return;
    }

    const details = getGoogleErrorDetails(error);
    console.error(`[calendar/webhook] incremental sync error for userId ${userId}:`, details.message);
  }
}

async function renewExpiringWatchChannels() {
  const threshold = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 h from now

  const expiring = await prisma.calendarSync.findMany({
    where: { watchExpiry: { lt: threshold } },
    select: { userId: true },
  });

  for (const { userId } of expiring) {
    try {
      await stopCalendarWatch(userId);
      await startCalendarWatch(userId);
      console.log(`[calendar/watch] renewed watch channel for userId ${userId}`);
    } catch (error) {
      console.error(`[calendar/watch] failed to renew channel for userId ${userId}:`, error?.message);
    }
  }
}

module.exports = {
  GOOGLE_SCOPES,
  CalendarIntegrationError,
  ensureGoogleCalendarConfigured,
  getFrontendCalendarUrl,
  resolveFrontendCalendarReturnTo,
  getOAuth2Client,
  signOAuthState,
  verifyOAuthState,
  storeOAuthTokens,
  getAuthorizedGoogleClient,
  syncGoogleCalendarEvents,
  mapStoredEventToCalendarEvent,
  parseSyncWindow,
  getDefaultSyncWindow,
  getGoogleErrorDetails,
  generateChannelToken,
  pushEventToGoogle,
  deleteEventFromGoogle,
  startCalendarWatch,
  ensureCalendarWatch,
  stopCalendarWatch,
  handleWebhookNotification,
  renewExpiringWatchChannels,
};
