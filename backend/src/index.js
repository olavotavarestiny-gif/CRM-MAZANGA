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
const requireAuth = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
// Allow CORS from any localhost origin (for development)
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Public routes
app.use('/api/auth', authRouter);
app.use('/api/webhook', webhookRouter);
app.use('/api/forms', formsRouter);

// Protected routes (require authentication)
app.use('/api/contacts', requireAuth, contactsRouter);
app.use('/api/messages', requireAuth, messagesRouter);
app.use('/api/send', requireAuth, sendRouter);
app.use('/api/automations', requireAuth, automationsRouter);
app.use('/api/whatsapp', requireAuth, whatsappRouter);
app.use('/api/tasks', requireAuth, tasksRouter);
app.use('/api/inbox', requireAuth, inboxRouter);

// Start server
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
