const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');

async function touchContactActivity(contactId) {
  if (!contactId) return;
  await prisma.contact.updateMany({
    where: { id: Number(contactId) },
    data: { lastActivityAt: new Date() },
  });
}

// GET /api/contacts/:id/notes
router.get('/contacts/:id/notes', async (req, res) => {
  try {
    const contactId = parseInt(req.params.id);
    const skip = parseInt(req.query.skip) || 0;
    const userId = req.user.effectiveUserId;

    const contact = await prisma.contact.findFirst({ where: { id: contactId, userId } });
    if (!contact) return res.status(404).json({ error: 'Contacto não encontrado' });

    const notes = await prisma.contactNote.findMany({
      where: { contactId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      skip,
      include: { user: { select: { id: true, name: true } } },
    });

    res.json(notes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/contacts/:id/notes
router.post('/contacts/:id/notes', async (req, res) => {
  try {
    const contactId = parseInt(req.params.id);
    const { content } = req.body;
    const userId = req.user.effectiveUserId;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Conteúdo é obrigatório' });
    }

    const contact = await prisma.contact.findFirst({ where: { id: contactId, userId } });
    if (!contact) return res.status(404).json({ error: 'Contacto não encontrado' });

    const note = await prisma.contactNote.create({
      data: {
        contactId,
        userId: req.user.id,
        content: content.trim(),
      },
      include: { user: { select: { id: true, name: true } } },
    });
    await touchContactActivity(contactId);

    res.status(201).json(note);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/notes/:id
router.put('/notes/:id', async (req, res) => {
  try {
    const noteId = parseInt(req.params.id);
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Conteúdo é obrigatório' });
    }

    const note = await prisma.contactNote.findUnique({ where: { id: noteId } });
    if (!note) return res.status(404).json({ error: 'Nota não encontrada' });

    // Only author or admin can edit
    if (note.userId !== req.user.id && !req.user.isAccountOwner && !req.user.isSuperAdmin && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Sem permissão para editar esta nota' });
    }

    const updated = await prisma.contactNote.update({
      where: { id: noteId },
      data: { content: content.trim() },
      include: { user: { select: { id: true, name: true } } },
    });
    await touchContactActivity(note.contactId);

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/notes/:id
router.delete('/notes/:id', async (req, res) => {
  try {
    const noteId = parseInt(req.params.id);

    const note = await prisma.contactNote.findUnique({ where: { id: noteId } });
    if (!note) return res.status(404).json({ error: 'Nota não encontrada' });

    if (note.userId !== req.user.id && !req.user.isAccountOwner && !req.user.isSuperAdmin && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Sem permissão para apagar esta nota' });
    }

    await prisma.contactNote.delete({ where: { id: noteId } });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
