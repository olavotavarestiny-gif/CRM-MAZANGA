const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const automationRunner = require('../services/automationRunner');
const requireAuth = require('../middleware/auth');
const { requirePermission, requireDeletePermission } = require('../lib/permissions');
const { requirePlanFeature, canCreateContact, getPlan, hasPlanFeature } = require('../lib/plan-limits');
const { getDefaultStageName } = require('../lib/pipeline-stages');

const CONTACT_FIELD_KEYS = new Set(['name', 'phone', 'email', 'company', 'sector', 'revenue']);

function normaliseSubmittedValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim();
}

function buildAnswersSnapshot(fields, submittedAnswers) {
  const answersByFieldId = new Map(
    Array.isArray(submittedAnswers)
      ? submittedAnswers.map((answer) => [answer.fieldId, normaliseSubmittedValue(answer.value)])
      : []
  );

  return fields.map((field) => ({
    fieldId: field.id,
    fieldLabel: field.label,
    contactField: field.contactField || null,
    value: answersByFieldId.get(field.id) || '',
  }));
}

function buildContactDataFromAnswers(answerSnapshots) {
  return answerSnapshots.reduce((acc, answer) => {
    if (answer.contactField && CONTACT_FIELD_KEYS.has(answer.contactField) && answer.value) {
      acc[answer.contactField] = answer.value;
    }
    return acc;
  }, {});
}

function serialiseSubmissionAnswer(answer) {
  return {
    ...answer,
    fieldLabel: answer.fieldLabel || answer.field?.label || 'Campo removido',
  };
}

function serialiseSubmission(submission) {
  return {
    ...submission,
    answers: (submission.answers || []).map(serialiseSubmissionAnswer),
  };
}

// GET /api/forms - lista todos os formulários com contagem de submissões
router.get('/', requireAuth, requirePlanFeature('formularios'), requirePermission('forms', 'view'), async (req, res) => {
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
router.post('/', requireAuth, requirePlanFeature('formularios'), requirePermission('forms', 'edit'), async (req, res) => {
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
    if (!form.userId) {
      return res.status(404).json({ error: 'Form not found' });
    }
    const plan = await getPlan(form.userId);
    if (!hasPlanFeature(plan, 'formularios')) {
      return res.status(403).json({ error: 'Funcionalidade não disponível no seu plano' });
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
router.put('/:id', requireAuth, requirePlanFeature('formularios'), requirePermission('forms', 'edit'), async (req, res) => {
  try {
    const form = await prisma.form.findUnique({
      where: { id: req.params.id },
      select: { userId: true },
    });
    if (!form || form.userId !== req.user.effectiveUserId) {
      return res.status(404).json({ error: 'Form not found' });
    }

    const { title, description, mode, thankYouUrl, brandColor, bgColor, logoUrl,
            metaPixelEnabled, metaPixelId, googleTagEnabled, googleTagId, trackSubmitAsLead } = req.body;

    // Tracking validation
    if (metaPixelEnabled && !metaPixelId?.trim()) {
      return res.status(400).json({ error: 'Pixel ID é obrigatório quando o Meta Pixel está ativo.' });
    }
    if (googleTagEnabled && !googleTagId?.trim()) {
      return res.status(400).json({ error: 'Google Tag ID é obrigatório quando o Google Tag está ativo.' });
    }
    if (metaPixelId?.trim() && !/^\d+$/.test(metaPixelId.trim())) {
      return res.status(400).json({ error: 'Meta Pixel ID deve conter apenas números.' });
    }
    if (googleTagId?.trim() && !/^(G-|GTM-|AW-)[A-Z0-9]+$/.test(googleTagId.trim())) {
      return res.status(400).json({ error: 'Google Tag ID inválido. Use o formato G-XXXXXXX, GTM-XXXXXXX ou AW-XXXXXXX.' });
    }

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
        ...(metaPixelEnabled !== undefined && { metaPixelEnabled: Boolean(metaPixelEnabled) }),
        ...(metaPixelId      !== undefined && { metaPixelId: metaPixelId?.trim() || null }),
        ...(googleTagEnabled !== undefined && { googleTagEnabled: Boolean(googleTagEnabled) }),
        ...(googleTagId      !== undefined && { googleTagId: googleTagId?.trim() || null }),
        ...(trackSubmitAsLead !== undefined && { trackSubmitAsLead: Boolean(trackSubmitAsLead) }),
      },
    });
    res.json(updatedForm);
  } catch (error) {
    console.error('Error updating form:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/forms/:id - eliminar formulário (cascata)
router.delete('/:id', requireAuth, requirePlanFeature('formularios'), requireDeletePermission, async (req, res) => {
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
router.post('/:id/fields', requireAuth, requirePlanFeature('formularios'), requirePermission('forms', 'edit'), async (req, res) => {
  try {
    // Verify form ownership
    const form = await prisma.form.findUnique({
      where: { id: req.params.id },
      select: { userId: true },
    });
    if (!form || form.userId !== req.user.effectiveUserId) {
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
router.put('/:id/fields/:fieldId', requireAuth, requirePlanFeature('formularios'), requirePermission('forms', 'edit'), async (req, res) => {
  try {
    // Verify form ownership
    const form = await prisma.form.findUnique({
      where: { id: req.params.id },
      select: { userId: true },
    });
    if (!form || form.userId !== req.user.effectiveUserId) {
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
router.delete('/:id/fields/:fieldId', requireAuth, requirePlanFeature('formularios'), requireDeletePermission, async (req, res) => {
  try {
    // Verify form ownership
    const form = await prisma.form.findUnique({
      where: { id: req.params.id },
      select: { userId: true },
    });
    if (!form || form.userId !== req.user.effectiveUserId) {
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
router.post('/:id/fields/reorder', requireAuth, requirePlanFeature('formularios'), requirePermission('forms', 'edit'), async (req, res) => {
  try {
    // Verify form ownership
    const form = await prisma.form.findUnique({
      where: { id: req.params.id },
      select: { userId: true },
    });
    if (!form || form.userId !== req.user.effectiveUserId) {
      return res.status(404).json({ error: 'Form not found' });
    }

    const { fields } = req.body; // [{id, order}, ...]
    await prisma.$transaction(
      fields.map((field) => prisma.formField.update({
        where: { id: field.id },
        data: { order: field.order },
      })),
    );
    res.json({ message: 'Fields reordered' });
  } catch (error) {
    console.error('Error reordering fields:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/forms/:id/submit - submeter formulário (pública)
router.post('/:id/submit', async (req, res) => {
  try {
    const form = await prisma.form.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        title: true,
        userId: true,
        fields: {
          orderBy: { order: 'asc' },
        },
      },
    });
    if (!form) {
      return res.status(404).json({ error: 'Form not found' });
    }
    if (!form.userId) {
      return res.status(404).json({ error: 'Form not found' });
    }
    const plan = await getPlan(form.userId);
    if (!hasPlanFeature(plan, 'formularios')) {
      return res.status(403).json({ error: 'Funcionalidade não disponível no seu plano' });
    }

    const { answers } = req.body; // [{fieldId, value}, ...]
    if (!Array.isArray(answers)) {
      return res.status(400).json({ error: 'answers must be an array' });
    }

    const answerSnapshots = buildAnswersSnapshot(form.fields, answers);
    const missingRequiredField = form.fields.find((field) => {
      if (!field.required) {
        return false;
      }

      const answer = answerSnapshots.find((item) => item.fieldId === field.id);
      return !answer?.value;
    });

    if (missingRequiredField) {
      return res.status(400).json({ error: `O campo "${missingRequiredField.label}" é obrigatório.` });
    }

    let linkedContactId = null;
    let contactSyncStatus = 'skipped';
    let syncedContact = null;
    let automationContact = {
      userId: form.userId,
      id: null,
      name: '',
      phone: '',
      email: '',
      company: '',
      revenue: null,
      sector: null,
      stage: null,
      inPipeline: false,
      formTitle: '',
    };

    try {
      const contactData = buildContactDataFromAnswers(answerSnapshots);
      automationContact = {
        ...automationContact,
        name: contactData.name || '',
        phone: contactData.phone || '',
        email: contactData.email || '',
        company: contactData.company || '',
        revenue: contactData.revenue || null,
        sector: contactData.sector || null,
      };

      if (contactData.phone) {
        const defaultStage = await getDefaultStageName(form.userId);
        const existingContact = await prisma.contact.findFirst({
          where: {
            userId: form.userId,
            phone: contactData.phone,
          },
        });

        if (existingContact) {
          const updateData = {
            inPipeline: true,
          };

          if (contactData.name) updateData.name = contactData.name;
          if (contactData.email) updateData.email = contactData.email;
          if (contactData.company) updateData.company = contactData.company;
          if (contactData.sector) updateData.sector = contactData.sector;
          if (contactData.revenue) updateData.revenue = contactData.revenue;

          syncedContact = await prisma.contact.update({
            where: { id: existingContact.id },
            data: updateData,
          });
          automationContact = {
            ...automationContact,
            ...syncedContact,
            formTitle: form.title,
          };
          linkedContactId = syncedContact.id;
          contactSyncStatus = 'updated';
        } else {
          const contactLimit = await canCreateContact(form.userId);
          if (contactLimit.allowed) {
            syncedContact = await prisma.contact.create({
              data: {
                userId: form.userId,
                name: contactData.name || 'Sem nome',
                phone: contactData.phone,
                email: contactData.email || '',
                company: contactData.company || '',
                revenue: contactData.revenue || null,
                sector: contactData.sector || null,
                stage: defaultStage,
                inPipeline: true,
                contactType: 'interessado',
                status: 'ativo',
              },
            });
            automationContact = {
              ...automationContact,
              ...syncedContact,
              formTitle: form.title,
            };
            linkedContactId = syncedContact.id;
            contactSyncStatus = 'created';
          }
        }
      }
    } catch (error) {
      console.error('Error in auto-create contact logic:', error);
    }

    const submission = await prisma.formSubmission.create({
      data: {
        formId: req.params.id,
        contactId: linkedContactId,
        contactSyncStatus,
        answers: {
          create: answerSnapshots,
        },
      },
      include: {
        answers: {
          include: {
            field: {
              select: { label: true },
            },
          },
        },
        contact: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            company: true,
            stage: true,
            inPipeline: true,
          },
        },
      },
    });

    automationContact.formTitle = form.title;

    if (automationContact) {
      await automationRunner.run('form_submission', syncedContact || automationContact, { formId: req.params.id, userId: form.userId });
    }

    if (syncedContact) {
      submission.contact = submission.contact || {
        id: syncedContact.id,
        name: syncedContact.name,
        phone: syncedContact.phone,
        email: syncedContact.email,
        company: syncedContact.company,
        stage: syncedContact.stage,
        inPipeline: syncedContact.inPipeline,
      };
    }

    res.status(201).json(serialiseSubmission(submission));
  } catch (error) {
    console.error('Error submitting form:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/forms/:id/submissions - obter submissões do formulário
router.get('/:id/submissions', requireAuth, requirePlanFeature('formularios'), async (req, res) => {
  try {
    // Verify form ownership
    const form = await prisma.form.findUnique({
      where: { id: req.params.id },
      select: { userId: true },
    });
    if (!form || form.userId !== req.user.effectiveUserId) {
      return res.status(404).json({ error: 'Form not found' });
    }

    const submissions = await prisma.formSubmission.findMany({
      where: { formId: req.params.id },
      include: {
        answers: {
          include: {
            field: {
              select: { label: true },
            },
          },
          orderBy: { fieldLabel: 'asc' },
        },
        contact: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            company: true,
            stage: true,
            inPipeline: true,
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });
    res.json(submissions.map(serialiseSubmission));
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
