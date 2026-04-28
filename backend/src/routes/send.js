const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const whatsapp = require('../lib/whatsapp');
const email = require('../lib/email');

async function touchContactActivity(contactId) {
  await prisma.contact.updateMany({
    where: { id: Number(contactId) },
    data: { lastActivityAt: new Date() },
  });
}

// POST - Send WhatsApp message (text or template)
router.post('/', async (req, res) => {
  try {
    const { contactId, text, templateName } = req.body;

    if (!contactId || (!text && !templateName)) {
      return res.status(400).json({ error: 'contactId and (text or templateName) are required' });
    }

    // Validate contactId is a number
    const id = parseInt(contactId, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid contactId: must be a number' });
    }

    // Get contact by id
    const contact = await prisma.contact.findUnique({
      where: { id },
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contacto não encontrado' });
    }

    if (!contact.phone) {
      return res.status(400).json({ error: 'Contact has no phone number' });
    }

    let messageText = text;
    let deliveryError = null;

    if (templateName) {
      // Send WhatsApp template
      try {
        await whatsapp.sendTemplate(contact.phone, templateName);
        messageText = `[Template: ${templateName}]`;
      } catch (err) {
        messageText = `[Template: ${templateName}]`;
        deliveryError = err.message;
      }
    } else {
      // Send text message
      try {
        await whatsapp.sendTextMessage(contact.phone, text);
      } catch (err) {
        deliveryError = err.message;
      }
    }

    // Always save message to DB (even if WhatsApp delivery failed)
    const message = await prisma.message.create({
      data: {
        contactId: id,
        direction: 'outbound',
        text: messageText,
        channel: 'whatsapp',
      },
    });
    await touchContactActivity(id);

    // Return message + warning if delivery failed
    if (deliveryError) {
      console.warn(`Message saved but WhatsApp delivery failed: ${deliveryError}`);
      return res.status(207).json({
        ...message,
        warning: deliveryError,
      });
    }

    res.json(message);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST - Send email message
router.post('/email', async (req, res) => {
  try {
    const { contactId, subject, text } = req.body;

    if (!contactId || !subject || !text) {
      return res.status(400).json({ error: 'contactId, subject and text are required' });
    }

    // Validate contactId is a number
    const id = parseInt(contactId, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid contactId: must be a number' });
    }

    // Get contact by id
    const contact = await prisma.contact.findUnique({
      where: { id },
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contacto não encontrado' });
    }

    if (!contact.email) {
      return res.status(400).json({ error: 'Contacto não tem email' });
    }

    // Send email
    await email.sendEmail({ to: contact.email, subject, body: text });

    // Save outbound message
    const message = await prisma.message.create({
      data: {
        contactId: id,
        direction: 'outbound',
        text: text,
        channel: 'email',
        subject,
      },
    });
    await touchContactActivity(id);

    res.json(message);
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
