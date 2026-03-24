const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');

// GET /api/faturacao/clientes
router.get('/clientes', async (req, res) => {
  try {
    const { search, page = 1, limit = 50 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const where = {
      userId: req.user.effectiveUserId,
      ...(search && {
        OR: [
          { customerName: { contains: search, mode: 'insensitive' } },
          { customerTaxID: { contains: search } },
        ],
      }),
    };
    const [clientes, total] = await Promise.all([
      prisma.clienteFaturacao.findMany({ where, skip, take: Number(limit), orderBy: { customerName: 'asc' } }),
      prisma.clienteFaturacao.count({ where }),
    ]);
    res.json({ clientes, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    res.status(500).json({ error: "Erro de servidor. Tente novamente." });
  }
});

// POST /api/faturacao/clientes
router.post('/clientes', async (req, res) => {
  try {
    const { customerTaxID, customerName, customerAddress, customerPhone, customerEmail, contactId } = req.body;
    if (!customerTaxID || !customerName) return res.status(400).json({ error: 'NIF e nome obrigatórios' });
    const cliente = await prisma.clienteFaturacao.create({
      data: { userId: req.user.effectiveUserId, customerTaxID, customerName, customerAddress, customerPhone, customerEmail, contactId: contactId || null },
    });
    res.status(201).json(cliente);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Já existe um cliente com este NIF. Selecione-o na lista de clientes em vez de criar um novo.' });
    res.status(500).json({ error: 'Erro ao criar o cliente. Verifique o NIF e o nome e tente novamente.' });
  }
});

// PUT /api/faturacao/clientes/:id
router.put('/clientes/:id', async (req, res) => {
  try {
    const existing = await prisma.clienteFaturacao.findUnique({ where: { id: req.params.id }, select: { userId: true } });
    if (!existing || existing.userId !== req.user.effectiveUserId) return res.status(404).json({ error: 'Cliente não encontrado' });
    const { customerName, customerAddress, customerPhone, customerEmail } = req.body;
    const updated = await prisma.clienteFaturacao.update({
      where: { id: req.params.id },
      data: {
        ...(customerName !== undefined && { customerName }),
        ...(customerAddress !== undefined && { customerAddress }),
        ...(customerPhone !== undefined && { customerPhone }),
        ...(customerEmail !== undefined && { customerEmail }),
      },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Erro de servidor. Tente novamente." });
  }
});

// POST /api/faturacao/clientes/from-contact — importar contacto CRM
router.post('/clientes/from-contact', async (req, res) => {
  try {
    const { contactId } = req.body;
    const contact = await prisma.contact.findFirst({
      where: { id: Number(contactId), userId: req.user.effectiveUserId },
    });
    if (!contact) return res.status(404).json({ error: 'Contacto não encontrado' });
    const cliente = await prisma.clienteFaturacao.upsert({
      where: { userId_customerTaxID: { userId: req.user.effectiveUserId, customerTaxID: contact.phone || `CONTACT-${contactId}` } },
      create: {
        userId: req.user.effectiveUserId,
        customerTaxID: contact.phone || `CONTACT-${contactId}`,
        customerName: contact.name,
        customerAddress: '',
        customerPhone: contact.phone,
        customerEmail: contact.email,
        contactId: Number(contactId),
      },
      update: { customerName: contact.name, customerPhone: contact.phone, customerEmail: contact.email },
    });
    res.json(cliente);
  } catch (err) {
    res.status(500).json({ error: "Erro de servidor. Tente novamente." });
  }
});

module.exports = router;
