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
const faturacaoRecorrentesRouter = require('./routes/faturacao-recorrentes');
const chatRouter = require('./routes/chat');
const requireAuth = require('./middleware/auth');
const { requireAdmin, requireAccountOwnerOrAdmin } = require('./middleware/auth');

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

    // Allow *.vercel.app and *.mazanga.digital
    if (origin.endsWith('.vercel.app') || origin.endsWith('.mazanga.digital')) {
      return callback(null, true);
    }

    // Allow exact FRONTEND_URL if set (e.g. crm.mazanga.digital without subdomain wildcard)
    if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) {
      return callback(null, true);
    }

    // Reject unknown origins
    return callback(new Error('Not allowed by CORS'));
  }
}));
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
app.use('/api/automations', requireAuth, automationsRouter);
app.use('/api/whatsapp', requireAuth, whatsappRouter);
app.use('/api/tasks', requireAuth, tasksRouter);
app.use('/api/inbox', requireAuth, inboxRouter);

// Admin-only routes (require authentication + admin role)
app.use('/api/admin', requireAuth, requireAdmin, adminRouter);

// Account owner or admin routes
app.use('/api/finances', requireAuth, requireAccountOwnerOrAdmin, financesRouter);
app.use('/api/account', requireAuth, accountRouter);
app.use('/api/pipeline-stages', requireAuth, pipelineStagesRouter);
app.use('/api/calendar', calendarRouter);
// Faturação AGT
app.use('/api/faturacao', requireAuth, faturacaoConfigRouter);
app.use('/api/faturacao', requireAuth, faturacaoSeriesRouter);
app.use('/api/faturacao', requireAuth, faturacaoClientesRouter);
app.use('/api/faturacao', requireAuth, faturacaoProdutosRouter);
app.use('/api/faturacao', requireAuth, faturacaoFacturasRouter);
app.use('/api/faturacao', requireAuth, faturacaoSaftRouter);
app.use('/api/faturacao', requireAuth, faturacaoRecorrentesRouter);
app.use('/api/chat', requireAuth, chatRouter);

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
