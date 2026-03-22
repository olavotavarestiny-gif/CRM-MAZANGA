const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const automationRunner = require('../services/automationRunner');
const requireAuth = require('../middleware/auth');

// GET /api/forms - lista todos os formulários com contagem de submissões
router.get('/', requireAuth, async (req, res) => {
  try {
    const forms = await prisma.form.findMany({
      where: { userId: req.user.effectiveUserId },
      include: {
        _count: { select: { submissions: true } },
        fields: { select: { id: true, type: true, label: true, order: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(forms);
  } catch (error) {
    console.error('Error fetching forms:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/forms - criar novo formulário
router.post('/', requireAuth, async (req, res) => {
  try {
    const { title, description, mode, thankYouUrl } = req.body;
    const form = await prisma.form.create({
      data: {
        userId: req.user.effectiveUserId,
        title,
        description: description || null,
        mode: mode || 'step',
        thankYouUrl: thankYouUrl || null,
      },
    });
    res.status(201).json(form);
  } catch (error) {
    console.error('Error creating form:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/forms/:id - obter formulário com campos ordenados
router.get('/:id', async (req, res) => {
  try {
    const form = await prisma.form.findUnique({
      where: { id: req.params.id },
      include: {
        fields: { orderBy: { order: 'asc' } },
      },
    });
    if (!form) {
      return res.status(404).json({ error: 'Form not found' });
    }
    // Parse options JSON para campos de múltipla escolha
    const fieldsWithParsedOptions = form.fields.map((field) => ({
      ...field,
      options: field.options ? JSON.parse(field.options) : undefined,
    }));
    res.json({ ...form, fields: fieldsWithParsedOptions });
  } catch (error) {
    console.error('Error fetching form:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/forms/:id - atualizar metadados do formulário
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const form = await prisma.form.findUnique({
      where: { id: req.params.id },
      select: { userId: true },
    });
    if (!form || form.userId !== req.user.id) {
      return res.status(404).json({ error: 'Form not found' });
    }

    const { title, description, mode, thankYouUrl, brandColor, bgColor, logoUrl } = req.body;
    const updatedForm = await prisma.form.update({
      where: { id: req.params.id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description: description || null }),
        ...(mode !== undefined && { mode }),
        ...(thankYouUrl !== undefined && { thankYouUrl: thankYouUrl || null }),
        ...(brandColor !== undefined && { brandColor: brandColor || null }),
        ...(bgColor !== undefined && { bgColor: bgColor || null }),
        ...(logoUrl !== undefined && { logoUrl: logoUrl || null }),
      },
    });
    res.json(updatedForm);
  } catch (error) {
    console.error('Error updating form:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/forms/:id - eliminar formulário (cascata)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    // Only account owners can delete
    if (!req.user.isAccountOwner) {
      return res.status(403).json({ error: 'Apenas o dono da conta pode eliminar formulários' });
    }

    const form = await prisma.form.findUnique({
      where: { id: req.params.id },
      select: { userId: true },
    });
    if (!form || form.userId !== req.user.effectiveUserId) {
      return res.status(404).json({ error: 'Form not found' });
    }

    await prisma.form.delete({
      where: { id: req.params.id },
    });
    res.json({ message: 'Form deleted' });
  } catch (error) {
    console.error('Error deleting form:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/forms/:id/fields - adicionar campo ao formulário
router.post('/:id/fields', requireAuth, async (req, res) => {
  try {
    // Verify form ownership
    const form = await prisma.form.findUnique({
      where: { id: req.params.id },
      select: { userId: true },
    });
    if (!form || form.userId !== req.user.id) {
      return res.status(404).json({ error: 'Form not found' });
    }

    const { type, label, required, order, options, contactField } = req.body;
    const field = await prisma.formField.create({
      data: {
        formId: req.params.id,
        type,
        label,
        required: required || false,
        order,
        options: options ? JSON.stringify(options) : null,
        contactField: contactField || null,
      },
    });
    res.status(201).json({
      ...field,
      options: field.options ? JSON.parse(field.options) : undefined,
    });
  } catch (error) {
    console.error('Error creating field:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/forms/:id/fields/:fieldId - atualizar campo
router.put('/:id/fields/:fieldId', requireAuth, async (req, res) => {
  try {
    // Verify form ownership
    const form = await prisma.form.findUnique({
      where: { id: req.params.id },
      select: { userId: true },
    });
    if (!form || form.userId !== req.user.id) {
      return res.status(404).json({ error: 'Form not found' });
    }

    const { type, label, required, order, options, contactField } = req.body;
    const field = await prisma.formField.update({
      where: { id: req.params.fieldId },
      data: {
        ...(type !== undefined && { type }),
        ...(label !== undefined && { label }),
        ...(required !== undefined && { required }),
        ...(order !== undefined && { order }),
        ...(options !== undefined && { options: options ? JSON.stringify(options) : null }),
        ...(contactField !== undefined && { contactField: contactField || null }),
      },
    });
    res.json({
      ...field,
      options: field.options ? JSON.parse(field.options) : undefined,
    });
  } catch (error) {
    console.error('Error updating field:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/forms/:id/fields/:fieldId - eliminar campo
router.delete('/:id/fields/:fieldId', requireAuth, async (req, res) => {
  try {
    // Verify form ownership
    const form = await prisma.form.findUnique({
      where: { id: req.params.id },
      select: { userId: true },
    });
    if (!form || form.userId !== req.user.id) {
      return res.status(404).json({ error: 'Form not found' });
    }

    await prisma.formField.delete({
      where: { id: req.params.fieldId },
    });
    res.json({ message: 'Field deleted' });
  } catch (error) {
    console.error('Error deleting field:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/forms/:id/fields/reorder - reordenar campos
router.post('/:id/fields/reorder', requireAuth, async (req, res) => {
  try {
    // Verify form ownership
    const form = await prisma.form.findUnique({
      where: { id: req.params.id },
      select: { userId: true },
    });
    if (!form || form.userId !== req.user.id) {
      return res.status(404).json({ error: 'Form not found' });
    }

    const { fields } = req.body; // [{id, order}, ...]
    for (const f of fields) {
      await prisma.formField.update({
        where: { id: f.id },
        data: { order: f.order },
      });
    }
    res.json({ message: 'Fields reordered' });
  } catch (error) {
    console.error('Error reordering fields:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/forms/:id/submit - submeter formulário (pública)
router.post('/:id/submit', async (req, res) => {
  try {
    const { answers } = req.body; // [{fieldId, value}, ...]
    const submission = await prisma.formSubmission.create({
      data: {
        formId: req.params.id,
        answers: {
          create: answers,
        },
      },
      include: { answers: true },
    });

    // Auto-criar contacto se campos mapeados
    try {
      const formWithFields = await prisma.form.findUnique({
        where: { id: req.params.id },
        include: { fields: true },
        select: { fields: true, userId: true },
      });

      const contactData = {};
      for (const answer of answers) {
        const field = formWithFields.fields.find((f) => f.id === answer.fieldId);
        if (field?.contactField && answer.value?.trim()) {
          contactData[field.contactField] = answer.value.trim();
        }
      }

      // Só criar se tiver phone (campo único obrigatório)
      if (contactData.phone) {
        try {
          const newContact = await prisma.contact.create({
            data: {
              userId: formWithFields.userId,
              name: contactData.name || 'Sem nome',
              phone: contactData.phone,
              email: contactData.email || '',
              company: contactData.company || '',
              revenue: contactData.revenue || null,
              sector: contactData.sector || null,
              stage: 'Novo',
            },
          });
          // Trigger form_submission automation
          await automationRunner.run('form_submission', newContact);
        } catch (e) {
          // Ignorar P2002 (telefone duplicado) — contacto já existe
          if (e.code !== 'P2002') {
            console.error('Error creating contact from form:', e);
          }
        }
      }
    } catch (error) {
      // Não bloquear a resposta se falhar ao criar contacto
      console.error('Error in auto-create contact logic:', error);
    }

    res.status(201).json(submission);
  } catch (error) {
    console.error('Error submitting form:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/forms/:id/submissions - obter submissões do formulário
router.get('/:id/submissions', requireAuth, async (req, res) => {
  try {
    // Verify form ownership
    const form = await prisma.form.findUnique({
      where: { id: req.params.id },
      select: { userId: true },
    });
    if (!form || form.userId !== req.user.id) {
      return res.status(404).json({ error: 'Form not found' });
    }

    const submissions = await prisma.formSubmission.findMany({
      where: { formId: req.params.id },
      include: { answers: true },
      orderBy: { submittedAt: 'desc' },
    });
    res.json(submissions);
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
