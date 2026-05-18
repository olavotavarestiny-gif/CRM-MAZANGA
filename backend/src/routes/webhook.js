const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');

async function getWebhookOwnerId() {
  const ownerEmail = (
    process.env.WHATSAPP_OWNER_EMAIL ||
    process.env.MAZANGA_LEAD_OWNER_EMAIL ||
    ''
  ).trim().toLowerCase();

  if (!ownerEmail) {
    console.error('[webhook] WHATSAPP_OWNER_EMAIL não configurado');
    return null;
  }

  const owner = await prisma.user.findUnique({
    where: { email: ownerEmail },
    select: { id: true },
  });

  if (!owner) {
    console.error(`[webhook] Owner não encontrado para WHATSAPP_OWNER_EMAIL=${ownerEmail}`);
    return null;
  }

  return owner.id;
}

// GET - Meta verification challenge
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    console.log('Webhook verified');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// POST - Receive incoming messages from WhatsApp
router.post('/', async (req, res) => {
  // Always respond 200 immediately to prevent Meta retries
  res.sendStatus(200);

  try {
    const body = req.body;

    if (body.object !== 'whatsapp_business_account') {
      console.log('Webhook received non-WhatsApp event, ignoring');
      return;
    }

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value;

        if (!value.messages) {
          continue;
        }

        for (const msg of value.messages) {
          // MVP: only handle text messages
          if (msg.type !== 'text') {
            continue;
          }

          const phone = msg.from;
          const text = msg.text.body;
          const timestamp = new Date(Number(msg.timestamp) * 1000);

          console.log(`Received message from ${phone}: ${text}`);
          const userId = await getWebhookOwnerId();
          if (!userId) {
            console.error('[webhook] Mensagem ignorada por falta de owner configurado');
            continue;
          }

          // Find or create contact by phone
          let contact = await prisma.contact.findFirst({
            where: { userId, phone },
          });

          if (!contact) {
            contact = await prisma.contact.create({
              data: {
                userId,
                name: phone,
                email: '',
                phone,
                company: '',
              },
            });
            console.log('Created new contact:', contact.id);
          }

          // Save inbound message
          await prisma.message.create({
            data: {
              contactId: contact.id,
              direction: 'inbound',
              text,
              timestamp,
            },
          });
          await prisma.contact.update({
            where: { id: contact.id },
            data: { lastActivityAt: timestamp },
          });

          console.log('Message saved for contact:', contact.id);
        }
      }
    }
  } catch (error) {
    console.error('Error processing webhook:', error.message);
  }
});

module.exports = router;
