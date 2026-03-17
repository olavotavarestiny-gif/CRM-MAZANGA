const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');

// GET messages for a contact
router.get('/:contactId', async (req, res) => {
  try {
    const messages = await prisma.message.findMany({
      where: { contactId: parseInt(req.params.contactId) },
      orderBy: { timestamp: 'asc' },
    });

    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
