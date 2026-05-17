const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { buildLimitErrorPayload, canCreateContact } = require('../lib/plan-limits');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[\d\s\+\-\(\)]{7,20}$/;

// POST /api/public/lead — recebe leads do site mazangamarketing.com
router.post('/lead', async (req, res) => {
  const secret = process.env.MAZANGA_WEBHOOK_SECRET;
  const authHeader = req.headers['authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!secret || token !== secret) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const { name, email, phone, company, role, revenue, service_interest, source, main_challenge } = req.body;

  if (!name?.trim() || !email?.trim() || !phone?.trim()) {
    return res.status(400).json({ success: false, error: 'Campos obrigatórios em falta: name, email, phone' });
  }

  if (!EMAIL_REGEX.test(email.trim())) {
    return res.status(400).json({ success: false, error: 'Email inválido' });
  }

  if (!PHONE_REGEX.test(phone.trim())) {
    return res.status(400).json({ success: false, error: 'Telefone inválido' });
  }

  try {
    const ownerEmail = process.env.MAZANGA_LEAD_OWNER_EMAIL?.trim().toLowerCase();
    if (!ownerEmail) {
      console.error('[public-lead] MAZANGA_LEAD_OWNER_EMAIL não configurado');
      return res.status(503).json({ success: false, error: 'Integração indisponível' });
    }

    const owner = await prisma.user.findUnique({ where: { email: ownerEmail }, select: { id: true } });
    if (!owner) {
      console.error(`[public-lead] Owner não encontrado para MAZANGA_LEAD_OWNER_EMAIL=${ownerEmail}`);
      return res.status(503).json({ success: false, error: 'Integração indisponível' });
    }

    const userId = owner.id;
    const normalizedPhone = phone.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const customFields = JSON.stringify({
      cargo: role?.trim() || '',
      servico_interesse: service_interest?.trim() || '',
      fonte: source?.trim() || '',
      desafio_negocio: main_challenge?.trim() || '',
    });

    const existing = await prisma.contact.findUnique({
      where: { user_phone_unique: { userId, phone: normalizedPhone } },
      select: { id: true },
    });
    if (existing) {
      const contact = await prisma.contact.update({
        where: { id: existing.id },
        data: {
          name: name.trim(),
          email: normalizedEmail,
          company: company?.trim() || '',
          revenue: revenue?.trim() || null,
          inPipeline: true,
          customFields,
          lastActivityAt: new Date(),
        },
      });
      return res.status(200).json({ success: true, contactId: contact.id, existing: true, updated: true });
    }

    const contactLimit = await canCreateContact(userId);
    if (!contactLimit.allowed) {
      return res.status(403).json({
        success: false,
        ...buildLimitErrorPayload(contactLimit),
      });
    }

    const contact = await prisma.contact.create({
      data: {
        userId,
        name: name.trim(),
        email: normalizedEmail,
        phone: normalizedPhone,
        company: company?.trim() || '',
        revenue: revenue?.trim() || null,
        stage: 'Novo',
        inPipeline: true,
        tags: JSON.stringify(['Mazanga Website', 'Lead']),
        contactType: 'interessado',
        customFields,
        lastActivityAt: new Date(),
      },
    });

    console.info(`[public-lead] Novo lead criado: ${contact.id} — ${contact.name} (${contact.email})`);
    return res.status(201).json({ success: true, contactId: contact.id });
  } catch (error) {
    console.error('[public-lead] Erro ao criar contacto:', error.message);
    return res.status(500).json({ success: false, error: 'Erro interno. Tenta novamente.' });
  }
});

module.exports = router;
