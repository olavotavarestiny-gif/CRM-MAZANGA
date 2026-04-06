const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const prisma = require('../lib/prisma');
const requireAuth = require('../middleware/auth');
const { verifySupabaseJwt } = require('../middleware/auth');

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
];

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

// GET /api/calendar/auth — redireciona para OAuth Google
// Aceita token Supabase JWT via query string (necessário para redirects de browser)
router.get('/auth', async (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(503).send('Google Calendar não configurado no servidor');
  }

  // Extrair token do query param ou do header Authorization
  const authHeader = req.headers.authorization;
  const rawToken = req.query.token || (authHeader && authHeader.split(' ')[1]);
  const token = rawToken ? decodeURIComponent(String(rawToken)) : null;

  if (!token) {
    return res.status(401).send('Não autenticado');
  }

  let userId;
  try {
    const payload = await verifySupabaseJwt(token);
    const user = await prisma.user.findUnique({
      where: { supabaseUid: payload.sub },
      select: { id: true, accountOwnerId: true },
    });
    if (!user) return res.status(401).send('Utilizador não encontrado');
    userId = user.id;
  } catch {
    return res.status(401).send('Token inválido');
  }
  const oauth2Client = getOAuth2Client();
  const state = Buffer.from(JSON.stringify({ userId })).toString('base64');
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    state,
  });
  res.redirect(url);
});

// GET /api/calendar/callback — Google redireciona aqui com code
router.get('/callback', async (req, res) => {
  const frontendUrl = process.env.FRONTEND_CALENDAR_URL || 'http://localhost:3000/calendario';
  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.redirect(`${frontendUrl}?error=access_denied`);
    }

    if (!code || !state) {
      return res.redirect(`${frontendUrl}?error=missing_params`);
    }

    let userId;
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
      userId = decoded.userId;
    } catch {
      return res.redirect(`${frontendUrl}?error=invalid_state`);
    }

    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Obter email do utilizador Google
    let googleEmail = null;
    try {
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const { data } = await oauth2.userinfo.get();
      googleEmail = data.email;
    } catch { /* ignorar se falhar */ }

    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : new Date(Date.now() + 3600 * 1000);

    await prisma.googleCalendarToken.upsert({
      where: { userId },
      create: {
        userId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || null,
        expiresAt,
        googleEmail,
      },
      update: {
        accessToken: tokens.access_token,
        ...(tokens.refresh_token && { refreshToken: tokens.refresh_token }),
        expiresAt,
        googleEmail,
      },
    });

    res.redirect(`${frontendUrl}?connected=true`);
  } catch (err) {
    console.error('Calendar OAuth callback error:', err);
    res.redirect(`${frontendUrl}?error=oauth_failed`);
  }
});

// GET /api/calendar/status — verifica se o utilizador tem Google Calendar conectado
router.get('/status', requireAuth, async (req, res) => {
  try {
    const token = await prisma.googleCalendarToken.findUnique({
      where: { userId: req.user.id },
      select: { googleEmail: true },
    });
    res.json({ connected: !!token, email: token?.googleEmail || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/calendar/disconnect — remove tokens
router.delete('/disconnect', requireAuth, async (req, res) => {
  try {
    await prisma.googleCalendarToken.deleteMany({
      where: { userId: req.user.id },
    });
    res.json({ message: 'Desconectado com sucesso' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/calendar/events?start=ISO&end=ISO — busca eventos do Google Calendar
router.get('/events', requireAuth, async (req, res) => {
  try {
    const tokenRecord = await prisma.googleCalendarToken.findUnique({
      where: { userId: req.user.id },
    });

    if (!tokenRecord) {
      return res.status(401).json({ error: 'Google Calendar não conectado' });
    }

    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({
      access_token: tokenRecord.accessToken,
      refresh_token: tokenRecord.refreshToken,
    });

    // Renovar token se expirado
    if (tokenRecord.expiresAt < new Date()) {
      if (!tokenRecord.refreshToken) {
        await prisma.googleCalendarToken.delete({ where: { userId: req.user.id } });
        return res.status(401).json({ error: 'Token expirado, reconecte o Google Calendar' });
      }
      const { credentials } = await oauth2Client.refreshAccessToken();
      const expiresAt = credentials.expiry_date
        ? new Date(credentials.expiry_date)
        : new Date(Date.now() + 3600 * 1000);
      await prisma.googleCalendarToken.update({
        where: { userId: req.user.id },
        data: { accessToken: credentials.access_token, expiresAt },
      });
      oauth2Client.setCredentials(credentials);
    }

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const { start, end } = req.query;

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: start || new Date().toISOString(),
      timeMax: end || new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 250,
    });

    const events = (response.data.items || []).map((e) => ({
      id: `google_${e.id}`,
      title: e.summary || '(sem título)',
      start: e.start?.dateTime || e.start?.date,
      end: e.end?.dateTime || e.end?.date,
      allDay: !e.start?.dateTime,
      source: 'google',
    }));

    res.json(events);
  } catch (err) {
    console.error('Calendar events error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
