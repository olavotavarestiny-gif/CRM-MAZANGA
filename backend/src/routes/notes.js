const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { requirePermission } = require('../lib/permissions');

async function touchContactActivity(contactId, userId) {
  if (!contactId) return;
  await prisma.contact.updateMany({
    where: { id: Number(contactId), userId },
    data: { lastActivityAt: new Date() },
  });
}

function parseAttachments(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; } catch { return []; }
  }
  return [];
}

function serializeNote(note) {
  return { ...note, attachments: parseAttachments(note.attachments) };
}

// GET /api/contacts/:id/notes
router.get('/contacts/:id/notes', requirePermission('contacts', 'view'), async (req, res) => {
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

    res.json(notes.map(serializeNote));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/contacts/:id/notes
router.post('/contacts/:id/notes', requirePermission('contacts', 'edit'), async (req, res) => {
  try {
    const contactId = parseInt(req.params.id);
    const { content, attachments } = req.body;
    const userId = req.user.effectiveUserId;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Conteúdo é obrigatório' });
    }

    const contact = await prisma.contact.findFirst({ where: { id: contactId, userId } });
    if (!contact) return res.status(404).json({ error: 'Contacto não encontrado' });

    const safeAttachments = parseAttachments(attachments);

    const note = await prisma.contactNote.create({
      data: {
        contactId,
        userId: req.user.id,
        content: content.trim(),
        attachments: JSON.stringify(safeAttachments),
      },
      include: { user: { select: { id: true, name: true } } },
    });
    await touchContactActivity(contactId, userId);

    res.status(201).json(serializeNote(note));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/notes/:id
router.put('/notes/:id', requirePermission('contacts', 'edit'), async (req, res) => {
  try {
    const noteId = parseInt(req.params.id);
    const { content, attachments } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Conteúdo é obrigatório' });
    }

    const note = await prisma.contactNote.findUnique({
      where: { id: noteId },
      include: { contact: { select: { userId: true } } },
    });
    if (!note) return res.status(404).json({ error: 'Nota não encontrada' });
    if (note.contact?.userId !== req.user.effectiveUserId) {
      return res.status(404).json({ error: 'Nota não encontrada' });
    }

    if (note.userId !== req.user.id && !req.user.isAccountOwner && !req.user.isSuperAdmin && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Sem permissão para editar esta nota' });
    }

    const updateData = { content: content.trim() };
    if (attachments !== undefined) {
      updateData.attachments = JSON.stringify(parseAttachments(attachments));
    }

    const updated = await prisma.contactNote.update({
      where: { id: noteId },
      data: updateData,
      include: { user: { select: { id: true, name: true } } },
    });
    await touchContactActivity(note.contactId, req.user.effectiveUserId);

    res.json(serializeNote(updated));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/notes/:id
router.delete('/notes/:id', requirePermission('contacts', 'edit'), async (req, res) => {
  try {
    const noteId = parseInt(req.params.id);

    const note = await prisma.contactNote.findUnique({
      where: { id: noteId },
      include: { contact: { select: { userId: true } } },
    });
    if (!note) return res.status(404).json({ error: 'Nota não encontrada' });
    if (note.contact?.userId !== req.user.effectiveUserId) {
      return res.status(404).json({ error: 'Nota não encontrada' });
    }

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
