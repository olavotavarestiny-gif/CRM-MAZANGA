const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');

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

          // Find or create contact by phone
          let contact = await prisma.contact.findUnique({
            where: { phone },
          });

          if (!contact) {
            contact = await prisma.contact.create({
              data: {
                name: phone,
                phone,
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

          console.log('Message saved for contact:', contact.id);
        }
      }
    }
  } catch (error) {
    console.error('Error processing webhook:', error.message);
  }
});

module.exports = router;
