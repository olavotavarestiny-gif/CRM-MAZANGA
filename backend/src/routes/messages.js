const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');

// GET messages for a contact
router.get('/:contactId', async (req, res) => {
  try {
    const contactId = parseInt(req.params.contactId);
    if (!Number.isInteger(contactId)) {
      return res.status(400).json({ error: 'Contacto inválido' });
    }

    const contact = await prisma.contact.findFirst({
      where: {
        id: contactId,
        userId: req.user.effectiveUserId,
      },
      select: { id: true },
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contacto não encontrado' });
    }

    const messages = await prisma.message.findMany({
      where: { contactId },
      orderBy: { timestamp: 'asc' },
    });

    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
