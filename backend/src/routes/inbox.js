const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');

// GET all conversations (contacts with messages, ordered by latest)
router.get('/', async (req, res) => {
  try {
    const contacts = await prisma.contact.findMany({
      where: { messages: { some: {} } },
      include: {
        messages: {
          orderBy: { timestamp: 'desc' },
          take: 1, // only last message for preview
        },
      },
    });

    // Sort by latest message timestamp
    contacts.sort(
      (a, b) =>
        new Date(b.messages[0]?.timestamp || 0) -
        new Date(a.messages[0]?.timestamp || 0)
    );

    res.json(contacts);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
