require('dotenv').config();
const express = require('express');
const cors = require('cors');

const contactsRouter = require('./routes/contacts');
const messagesRouter = require('./routes/messages');
const webhookRouter = require('./routes/webhook');
const sendRouter = require('./routes/send');
const automationsRouter = require('./routes/automations');
const whatsappRouter = require('./routes/whatsapp');
const tasksRouter = require('./routes/tasks');
const formsRouter = require('./routes/forms');
const inboxRouter = require('./routes/inbox');
const authRouter = require('./routes/auth');
const adminRouter = require('./routes/admin');
const superadminRouter = require('./routes/superadmin');
const setupRouter = require('./routes/setup');
const financesRouter = require('./routes/finances');
const accountRouter = require('./routes/account');
const pipelineStagesRouter = require('./routes/pipeline-stages');
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
const requireAuth = require('./middleware/auth');
const { requireSuperAdmin } = require('./middleware/auth');
const { requirePlanFeature } = require('./lib/plan-limits');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
// Allow CORS from localhost (development) and production domains
app.use(cors({
  origin: (origin, callback) => {
    // Allow localhost for development
    if (!origin || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
      return callback(null, true);
    }

    // Allow only the specific Vercel deployment URL (avoids wildcard *.vercel.app)
    const allowedVercel = process.env.ALLOWED_VERCEL_URL; // e.g. 'mazanga-crm-xxxx.vercel.app'
    if (allowedVercel && origin === `https://${allowedVercel}`) {
      return callback(null, true);
    }

    // Allow *.mazanga.digital subdomains
    if (origin.endsWith('.mazanga.digital')) {
      return callback(null, true);
    }

    // Allow exact FRONTEND_URL if set (e.g. crm.mazanga.digital)
    if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) {
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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Public routes
app.use('/api/auth', authRouter);
app.use('/api/webhook', webhookRouter);
app.use('/api/forms', formsRouter);
app.use('/api/setup', setupRouter);

// Protected routes (require authentication)
app.use('/api/contacts', requireAuth, contactsRouter);
app.use('/api/messages', requireAuth, messagesRouter);
app.use('/api/send', requireAuth, sendRouter);
app.use('/api/automations', requireAuth, requirePlanFeature('automacoes'), automationsRouter);
app.use('/api/whatsapp', requireAuth, whatsappRouter);
app.use('/api/tasks', requireAuth, tasksRouter);
app.use('/api/inbox', requireAuth, inboxRouter);

// Platform admin routes
app.use('/api/admin', requireAuth, requireSuperAdmin, adminRouter);

// SuperAdmin-only routes
app.use('/api/superadmin', requireAuth, requireSuperAdmin, superadminRouter);

// Account owner or admin routes
app.use('/api/finances', requireAuth, requirePlanFeature('financas'), financesRouter);
app.use('/api/account', requireAuth, accountRouter);
app.use('/api/pipeline-stages', requireAuth, pipelineStagesRouter);
app.use('/api/calendar', calendarRouter);
// Faturação AGT
app.use('/api/faturacao', requireAuth, requirePlanFeature('vendas'), faturacaoConfigRouter);
app.use('/api/faturacao', requireAuth, requirePlanFeature('vendas'), faturacaoSeriesRouter);
app.use('/api/faturacao', requireAuth, requirePlanFeature('vendas'), faturacaoClientesRouter);
app.use('/api/faturacao', requireAuth, requirePlanFeature('vendas'), faturacaoProdutosRouter);
app.use('/api/faturacao', requireAuth, requirePlanFeature('vendas'), faturacaoFacturasRouter);
app.use('/api/faturacao', requireAuth, requirePlanFeature('vendas'), faturacaoSaftRouter);
app.use('/api/faturacao', requireAuth, requirePlanFeature('vendas'), faturacaoRelatoriosRouter);
app.use('/api/faturacao', requireAuth, requirePlanFeature('vendas'), faturacaoRecorrentesRouter);
app.use('/api/produto-categorias', requireAuth, requirePlanFeature('vendas'), produtoCategoriasRouter);
app.use('/api/comercial', requireAuth, requirePlanFeature('vendas'), comercialDashboardRouter);
app.use('/api/chat', requireAuth, requirePlanFeature('conversas'), chatRouter);
app.use('/api/quick-sales', requireAuth, requirePlanFeature('vendas'), quickSalesRouter);
app.use('/api/caixa', requireAuth, requirePlanFeature('vendas'), caixaSessoesRouter);
app.use('/api', requireAuth, notesRouter);

// Scheduler: process recurring invoices daily at 00:05
try {
  const cron = require('node-cron');
  const { processRecorrentes } = require('./lib/faturacao/scheduler');
  cron.schedule('5 0 * * *', () => {
    console.log('[Scheduler] A processar faturas recorrentes...');
    processRecorrentes().catch(err => console.error('[Scheduler] Erro:', err.message));
  });
  console.log('[Scheduler] Cron de faturas recorrentes iniciado (00:05 diário)');
} catch (err) {
  console.warn('[Scheduler] node-cron não disponível:', err.message);
}

// Start server
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
