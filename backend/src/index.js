if (process.env.NODE_ENV !== 'production') {
  const path = require('path');
  const dotenv = require('dotenv');
  dotenv.config({ path: path.resolve(__dirname, '../.env') });
  dotenv.config({ path: path.resolve(__dirname, '../../frontend/.env.local') });
}

const express = require('express');
const cors = require('cors');
const prisma = require('./lib/prisma');
const { getPrismaStartupState, registerPrismaShutdown, startPrismaWarmup } = require('./lib/prisma-startup');
const { renewExpiringWatchChannels } = require('./lib/google-calendar');

const contactsRouter = require('./routes/contacts');
const messagesRouter = require('./routes/messages');
const webhookRouter = require('./routes/webhook');
const sendRouter = require('./routes/send');
const automationsRouter = require('./routes/automations');
const whatsappRouter = require('./routes/whatsapp');
const tasksRouter = require('./routes/tasks');
const formsRouter = require('./routes/forms');
const publicLeadRouter = require('./routes/public-lead');
const inboxRouter = require('./routes/inbox');
const authRouter = require('./routes/auth');
const adminRouter = require('./routes/admin');
const superadminRouter = require('./routes/superadmin');
const setupRouter = require('./routes/setup');
const financesRouter = require('./routes/finances');
const accountRouter = require('./routes/account');
const pipelineStagesRouter = require('./routes/pipeline-stages');
const dealStagesRouter = require('./routes/deal-stages');
const companiesRouter = require('./routes/companies');
const dealsRouter = require('./routes/deals');
const pipelineAnalyticsRouter = require('./routes/pipeline-analytics');
const calendarRouter = require('./routes/calendar');
const faturacaoConfigRouter = require('./routes/faturacao-config');
const faturacaoSeriesRouter = require('./routes/faturacao-series');
const faturacaoClientesRouter = require('./routes/faturacao-clientes');
const faturacaoProdutosRouter = require('./routes/faturacao-produtos');
const faturacaoFacturasRouter = require('./routes/faturacao-facturas');
const faturacaoSaftRouter = require('./routes/faturacao-saft');
const faturacaoRelatoriosRouter = require('./routes/faturacao-relatorios');
const faturacaoRecorrentesRouter = require('./routes/faturacao-recorrentes');
const produtoCategoriasRouter = require('./routes/produto-categorias');
const comercialDashboardRouter = require('./routes/comercial-dashboard');
const chatRouter = require('./routes/chat');
const notesRouter = require('./routes/notes');
const quickSalesRouter = require('./routes/quick-sales');
const caixaSessoesRouter = require('./routes/caixa-sessoes');
const activityRouter = require('./routes/activity');
const onboardingRouter = require('./routes/onboarding');
const startupTemplatesRouter = require('./routes/startup-templates');
const reportsRouter = require('./routes/reports');
const serviceDashboardRouter = require('./routes/service-dashboard');
const managementRouter = require('./routes/management');
const growthRoomRouter = require('./routes/growth-room');
const foodV1Router = require('./routes/food-v1');
const requireAuth = require('./middleware/auth');
const { requireSuperAdmin } = require('./middleware/auth');
const { requirePlanFeature } = require('./lib/plan-limits');
const { checkSubscriptionAccess } = require('./middleware/subscription-access');
const { requireManagementWorkspace } = require('./lib/management-context');

const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const HEALTH_DB_TIMEOUT_MS = Math.max(500, Number(process.env.HEALTH_DB_TIMEOUT_MS || 3500));
const SLOW_API_WARNING_MS = Math.max(500, Number(process.env.SLOW_API_WARNING_MS || 2500));
const READINESS_TIMEOUT_MS = Math.max(500, Number(process.env.READINESS_TIMEOUT_MS || 3500));
const essentialEnvPresence = {
  DATABASE_URL: Boolean(process.env.DATABASE_URL),
  FRONTEND_URL: Boolean(process.env.FRONTEND_URL),
  SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
  SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  JWT_SECRET: Boolean(process.env.JWT_SECRET),
};

console.info('[Startup] Backend boot starting', {
  nodeEnv: NODE_ENV,
  port: PORT,
  essentialEnvPresence,
});

const normalizeAllowedOrigin = (value) => {
  if (!value) return null;
  return value.startsWith('http://') || value.startsWith('https://')
    ? value
    : `https://${value}`;
};

const parseAllowedOrigins = (...values) => {
  const origins = values
    .flatMap((value) => String(value || '').split(/[,\s]+/))
    .map((value) => normalizeAllowedOrigin(value.trim()))
    .filter(Boolean);

  return [...new Set(origins)];
};

const isManagedFrontendOrigin = (origin) => {
  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== 'https:' && protocol !== 'http:') return false;

    // Production app + official subdomains under app.kukugest.ao.
    if (hostname === 'app.kukugest.ao' || hostname.endsWith('.app.kukugest.ao')) {
      return true;
    }

    // Official beta/staging custom domain.
    if (hostname === 'beta.kukugest.ao') {
      return true;
    }

    // Vercel preview deployments for the linked frontend project.
    if (
      hostname === 'frontend-olavos-projects-c1426332.vercel.app' ||
      hostname === 'frontend-git-main-olavos-projects-c1426332.vercel.app' ||
      hostname.startsWith('frontend-git-') && hostname.endsWith('-olavos-projects-c1426332.vercel.app') ||
      hostname.startsWith('frontend-') && hostname.endsWith('-olavos-projects-c1426332.vercel.app')
    ) {
      return true;
    }

    // Dedicated Mazanga Growth Room deployment and its Vercel previews.
    if (
      hostname === 'mazanga-growth-room.vercel.app' ||
      hostname.startsWith('mazanga-growth-room-') && hostname.endsWith('-olavos-projects-c1426332.vercel.app')
    ) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
};

const explicitlyAllowedOrigins = new Set(
  parseAllowedOrigins(
    process.env.FRONTEND_URL,
    process.env.GROWTH_FRONTEND_URL,
    process.env.ALLOWED_VERCEL_URL
  )
);

// Middleware
// Allow CORS from localhost (development) and production domains
app.use(cors({
  origin: (origin, callback) => {
    // Allow localhost for development
    if (!origin || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
      return callback(null, true);
    }

    // Allow managed custom domains used by production/staging.
    if (isManagedFrontendOrigin(origin)) {
      return callback(null, true);
    }

    // Allow exact frontend origins from env. Supports comma-separated values for
    // multiple previews/custom domains without opening wildcard CORS.
    if (explicitlyAllowedOrigins.has(origin)) {
      return callback(null, true);
    }

    // Reject unknown origins
    return callback(new Error('Not allowed by CORS'));
  }
}));

// Security headers for all API responses (ZAP alerts 2–5, 7–8)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

function withTimeout(promise, timeoutMs, timeoutValue) {
  let timeout;
  return Promise.race([
    promise.finally(() => clearTimeout(timeout)),
    new Promise((resolve) => {
      timeout = setTimeout(() => resolve(timeoutValue), timeoutMs);
    }),
  ]);
}

function buildAliveHealthPayload() {
  return {
    ok: true,
    service: 'kukugest-backend',
    status: 'alive',
    timestamp: new Date().toISOString(),
  };
}

function getDatabaseHealthError(errorOrTimeout) {
  if (errorOrTimeout?.timeout) {
    return 'DB_TIMEOUT';
  }

  return errorOrTimeout?.code || errorOrTimeout?.name || 'DB_ERROR';
}

function getPublicPrismaStartupState() {
  const state = getPrismaStartupState();
  return {
    ready: state.ready,
    attempts: state.attempts,
    lastSuccessAt: state.lastSuccessAt,
    lastError: state.lastError ? 'redacted' : null,
  };
}

app.use((req, res, next) => {
  if (!req.path.startsWith('/api')) {
    return next();
  }

  const startedAt = Date.now();
  const originalEnd = res.end;

  res.end = function endWithTiming(...args) {
    const durationMs = Date.now() - startedAt;

    if (!res.headersSent) {
      res.setHeader('Server-Timing', `app;dur=${durationMs}`);
    }

    if (durationMs >= SLOW_API_WARNING_MS) {
      console.warn('[api.slow]', {
        route: req.originalUrl || req.url,
        method: req.method,
        status: res.statusCode,
        durationMs,
        userId: req.user?.id || null,
        effectiveUserId: req.user?.effectiveUserId || null,
      });
    }

    return originalEnd.apply(this, args);
  };

  return next();
});

// Public health checks
app.get('/health', (req, res) => {
  res.status(200).json(buildAliveHealthPayload());
});

app.get('/api/health', (req, res) => {
  res.status(200).json(buildAliveHealthPayload());
});

app.get('/health/db', async (req, res) => {
  try {
    const database = await withTimeout(
      prisma.$queryRaw`SELECT 1`,
      HEALTH_DB_TIMEOUT_MS,
      { timeout: true }
    );

    if (database?.timeout) {
      return res.status(503).json({
        ok: false,
        service: 'kukugest-backend',
        database: 'timeout',
        timestamp: new Date().toISOString(),
        error: getDatabaseHealthError(database),
      });
    }

    return res.status(200).json({
      ok: true,
      service: 'kukugest-backend',
      database: 'ok',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(503).json({
      ok: false,
      service: 'kukugest-backend',
      database: 'error',
      timestamp: new Date().toISOString(),
      error: getDatabaseHealthError(error),
    });
  }
});

app.get('/api/ready', async (req, res) => {
  const startedAt = Date.now();
  try {
    const database = await withTimeout(
      prisma.$queryRaw`SELECT 1`,
      READINESS_TIMEOUT_MS,
      { timeout: true }
    );

    if (database?.timeout) {
      return res.status(503).json({
        status: 'starting',
        database: 'timeout',
        durationMs: Date.now() - startedAt,
        prisma: getPublicPrismaStartupState(),
      });
    }

    return res.json({
      status: 'ready',
      database: 'ok',
      durationMs: Date.now() - startedAt,
      prisma: getPublicPrismaStartupState(),
    });
  } catch (error) {
    return res.status(503).json({
      status: 'starting',
      database: 'error',
      error: error?.code || error?.name || 'DB_ERROR',
      durationMs: Date.now() - startedAt,
      prisma: getPublicPrismaStartupState(),
    });
  }
});

// Public routes
app.use('/api/auth', authRouter);
app.use('/api/webhook', webhookRouter);
app.use('/api/forms', formsRouter);
app.use('/api/setup', setupRouter);
app.use('/api/public', publicLeadRouter);

// Protected routes (require authentication)
app.use('/api/contacts', requireAuth, checkSubscriptionAccess, contactsRouter);
app.use('/api/messages', requireAuth, checkSubscriptionAccess, messagesRouter);
app.use('/api/send', requireAuth, checkSubscriptionAccess, sendRouter);
app.use('/api/automations', requireAuth, checkSubscriptionAccess, requirePlanFeature('automacoes'), automationsRouter);
app.use('/api/whatsapp', requireAuth, checkSubscriptionAccess, whatsappRouter);
app.use('/api/tasks', requireAuth, checkSubscriptionAccess, tasksRouter);
app.use('/api/inbox', requireAuth, checkSubscriptionAccess, inboxRouter);

// Platform admin routes
app.use('/api/admin', requireAuth, requireSuperAdmin, adminRouter);

// SuperAdmin-only routes
app.use('/api/superadmin', requireAuth, requireSuperAdmin, superadminRouter);

// Account owner or admin routes
app.use('/api/finances', requireAuth, checkSubscriptionAccess, requirePlanFeature('financas'), financesRouter);
app.use('/api/account', requireAuth, checkSubscriptionAccess, accountRouter);
app.use('/api/management', requireAuth, checkSubscriptionAccess, requireManagementWorkspace, managementRouter);
app.use('/api/growth-room', requireAuth, growthRoomRouter);
app.use('/api/food/v1', requireAuth, checkSubscriptionAccess, foodV1Router);
app.use('/api/pipeline-stages', requireAuth, checkSubscriptionAccess, pipelineStagesRouter);
app.use('/api/deal-stages', requireAuth, checkSubscriptionAccess, requirePlanFeature('processos'), dealStagesRouter);
app.use('/api/companies', requireAuth, checkSubscriptionAccess, requirePlanFeature('processos'), companiesRouter);
app.use('/api/deals', requireAuth, checkSubscriptionAccess, requirePlanFeature('processos'), dealsRouter);
app.use('/api/pipeline/analytics', requireAuth, checkSubscriptionAccess, requirePlanFeature('processos'), pipelineAnalyticsRouter);
app.use('/api/calendar', calendarRouter);
// Faturação AGT
app.use('/api/faturacao', requireAuth, checkSubscriptionAccess, requirePlanFeature('vendas'), faturacaoConfigRouter);
app.use('/api/faturacao', requireAuth, checkSubscriptionAccess, requirePlanFeature('vendas'), faturacaoSeriesRouter);
app.use('/api/faturacao', requireAuth, checkSubscriptionAccess, requirePlanFeature('vendas'), faturacaoClientesRouter);
app.use('/api/faturacao', requireAuth, checkSubscriptionAccess, requirePlanFeature('vendas'), faturacaoProdutosRouter);
app.use('/api/faturacao', requireAuth, checkSubscriptionAccess, requirePlanFeature('vendas'), faturacaoFacturasRouter);
app.use('/api/faturacao', requireAuth, checkSubscriptionAccess, requirePlanFeature('vendas'), faturacaoSaftRouter);
app.use('/api/faturacao', requireAuth, checkSubscriptionAccess, requirePlanFeature('vendas'), faturacaoRelatoriosRouter);
app.use('/api/faturacao', requireAuth, checkSubscriptionAccess, requirePlanFeature('vendas'), faturacaoRecorrentesRouter);
app.use('/api/produto-categorias', requireAuth, checkSubscriptionAccess, requirePlanFeature('vendas'), produtoCategoriasRouter);
app.use('/api/comercial', requireAuth, checkSubscriptionAccess, requirePlanFeature('vendas'), comercialDashboardRouter);
app.use('/api/chat', requireAuth, checkSubscriptionAccess, requirePlanFeature('conversas'), chatRouter);
app.use('/api/quick-sales', requireAuth, checkSubscriptionAccess, requirePlanFeature('vendas'), quickSalesRouter);
app.use('/api/caixa', requireAuth, checkSubscriptionAccess, requirePlanFeature('vendas'), caixaSessoesRouter);
app.use('/api/activity', requireAuth, checkSubscriptionAccess, activityRouter);
app.use('/api/onboarding', requireAuth, onboardingRouter);
app.use('/api/startup-templates', requireAuth, startupTemplatesRouter);
app.use('/api/reports', requireAuth, checkSubscriptionAccess, reportsRouter);
app.use('/api/dashboard', requireAuth, checkSubscriptionAccess, serviceDashboardRouter);
app.use('/api', requireAuth, checkSubscriptionAccess, notesRouter);

// Scheduler: process recurring invoices daily at 00:05
try {
  const cron = require('node-cron');
  const { processRecorrentes } = require('./lib/faturacao/scheduler');
  const { processFollowUpAutomations } = require('./services/followup-automation-scheduler');
  const { markManagementOverdueTasks } = require('./services/management-overdue-scheduler');
  cron.schedule('5 0 * * *', () => {
    console.log('[Scheduler] A processar faturas recorrentes...');
    processRecorrentes().catch(err => console.error('[Scheduler] Erro:', err.message));
  });
  console.log('[Scheduler] Cron de faturas recorrentes iniciado (00:05 diário)');

  cron.schedule('0 6 * * *', () => {
    renewExpiringWatchChannels().catch((err) => {
      console.error('[Scheduler] Erro ao renovar watch Google Calendar:', err.message);
    });
  });
  console.log('[Scheduler] Cron de renovação de watch Google Calendar iniciado (06:00 UTC diário)');

  cron.schedule('15 6 * * *', () => {
    processFollowUpAutomations()
      .then((result) => console.log('[Scheduler] Automações de follow-up processadas:', result))
      .catch((err) => console.error('[Scheduler] Erro nas automações de follow-up:', err.message));
  });
  console.log('[Scheduler] Cron de automações de follow-up iniciado (06:15 UTC diário)');

  cron.schedule('*/15 * * * *', () => {
    markManagementOverdueTasks()
      .then((updated) => updated > 0 && console.log(`[Scheduler] ${updated} trabalho(s) Gestão e KPI marcado(s) como atrasado(s).`))
      .catch((err) => console.error('[Scheduler] Erro ao atualizar trabalhos Gestão e KPI:', err.message));
  });
  console.log('[Scheduler] Cron de prazos Gestão e KPI iniciado (a cada 15 minutos)');
} catch (err) {
  console.warn('[Scheduler] node-cron não disponível:', err.message);
}

// Start server
registerPrismaShutdown();
startPrismaWarmup();

app.listen(PORT, () => {
  console.info('[Startup] Backend started', {
    nodeEnv: NODE_ENV,
    port: PORT,
  });
});
