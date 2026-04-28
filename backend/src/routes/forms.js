const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const automationRunner = require('../services/automationRunner');
const requireAuth = require('../middleware/auth');
const { requirePermission, requireDeletePermission } = require('../lib/permissions');
const { requirePlanFeature, canCreateContact, getPlanContext, hasPlanFeature } = require('../lib/plan-limits');
const { getDefaultStageName } = require('../lib/pipeline-stages');

const STANDARD_CONTACT_FIELDS = [
  { key: 'name', binding: 'standard:name', label: 'Nome', type: 'text', required: true },
  { key: 'phone', binding: 'standard:phone', label: 'Telefone', type: 'text', required: true },
  { key: 'email', binding: 'standard:email', label: 'Email', type: 'text', required: false },
  { key: 'company', binding: 'standard:company', label: 'Empresa', type: 'text', required: false },
  { key: 'location', binding: 'standard:location', label: 'Localização', type: 'text', required: false },
  { key: 'birthDate', binding: 'standard:birthDate', label: 'Aniversário', type: 'date', required: false },
  { key: 'sector', binding: 'standard:sector', label: 'Setor', type: 'text', required: false },
  { key: 'revenue', binding: 'standard:revenue', label: 'Faturamento', type: 'text', required: false },
];

const CONTACT_FIELD_KEYS = new Set(STANDARD_CONTACT_FIELDS.map((field) => field.key));
const LEGACY_CONTACT_FIELD_KEYS = new Set(['name', 'phone', 'email', 'company', 'sector', 'revenue', 'location', 'birthDate']);
const INFERRED_CONTACT_FIELD_PATTERNS = {
  name: [/^nome$/i, /^nome completo$/i, /^contacto$/i],
  phone: [/telefone/i, /telemovel/i, /telemóvel/i, /numero/i, /n[uú]mero/i, /celular/i, /whatsapp/i],
  email: [/e-?mail/i, /^email$/i, /correio/i],
  company: [/empresa/i, /companhia/i, /neg[oó]cio/i, /organiz/i],
  sector: [/setor/i, /sector/i, /ramo/i, /ind[uú]stria/i, /area/i, /área/i],
  revenue: [/fatura[cç][aã]o/i, /receita/i, /or[cç]amento/i, /volume/i, /revenue/i],
  location: [/local/i, /morada/i, /endere[cç]o/i, /prov[ií]ncia/i, /cidade/i],
  birthDate: [/anivers/i, /nascimento/i, /data de nascimento/i],
};

function safeParseJson(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeBinding(contactField) {
  if (!contactField) return null;
  const raw = String(contactField).trim();
  if (!raw || raw === 'none') return null;
  if (raw.startsWith('standard:') || raw.startsWith('custom:')) return raw;
  if (LEGACY_CONTACT_FIELD_KEYS.has(raw)) return `standard:${raw}`;
  return raw;
}

function getStandardFieldKey(contactField) {
  const binding = normalizeBinding(contactField);
  if (!binding) return null;
  if (binding.startsWith('standard:')) {
    const key = binding.slice('standard:'.length);
    return CONTACT_FIELD_KEYS.has(key) ? key : null;
  }
  if (LEGACY_CONTACT_FIELD_KEYS.has(binding)) return binding;
  return null;
}

function getCustomFieldKey(contactField) {
  const binding = normalizeBinding(contactField);
  return binding?.startsWith('custom:') ? binding.slice('custom:'.length) : null;
}

function formatDateValue(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function serialiseFormField(field) {
  return {
    ...field,
    contactField: normalizeBinding(field.contactField) || field.contactField,
    options: field.options ? safeParseJson(field.options, []) : undefined,
  };
}

async function getCustomFieldMap(userId) {
  const fields = await prisma.contactFieldDef.findMany({
    where: { userId, active: true },
    orderBy: { order: 'asc' },
  });

  return new Map(fields.map((field) => [
    field.key,
    {
      ...field,
      options: safeParseJson(field.options, []),
    },
  ]));
}

async function resolveFieldPersistenceData({ userId, type, options, contactField, contactFieldProvided = false }) {
  const data = {};
  const binding = normalizeBinding(contactField);
  if (contactFieldProvided) {
    data.contactField = binding || null;
  }

  const customKey = getCustomFieldKey(binding);
  if (customKey) {
    const customField = await prisma.contactFieldDef.findFirst({
      where: { userId, key: customKey, active: true },
    });
    if (!customField) {
      const error = new Error('Campo personalizado não encontrado');
      error.statusCode = 400;
      throw error;
    }

    if (customField.type === 'select') {
      data.type = 'multiple_choice';
      data.options = JSON.stringify(safeParseJson(customField.options, []));
      return data;
    }
  }

  if (type !== undefined) data.type = type;
  if (options !== undefined) data.options = options ? JSON.stringify(options) : null;
  return data;
}

function normaliseText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function inferContactField(field, submittedValue = '') {
  const standardField = getStandardFieldKey(field?.contactField);
  if (standardField) {
    return `standard:${standardField}`;
  }

  const customField = getCustomFieldKey(field?.contactField);
  if (customField) {
    return `custom:${customField}`;
  }

  const normalisedLabel = normaliseText(field?.label);

  for (const [contactField, patterns] of Object.entries(INFERRED_CONTACT_FIELD_PATTERNS)) {
    if (patterns.some((pattern) => pattern.test(normalisedLabel))) {
      return `standard:${contactField}`;
    }
  }

  const normalisedValue = normaliseSubmittedValue(submittedValue);
  if (normalisedValue.includes('@')) {
    return 'standard:email';
  }

  if (/^[\d\s\+\-\(\)]{7,20}$/.test(normalisedValue)) {
    return 'standard:phone';
  }

  return null;
}

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
    contactField: inferContactField(field, answersByFieldId.get(field.id) || ''),
    value: answersByFieldId.get(field.id) || '',
  }));
}

function buildContactDataFromAnswers(answerSnapshots) {
  return answerSnapshots.reduce((acc, answer) => {
    if (!answer.value) {
      return acc;
    }

    const standardKey = getStandardFieldKey(answer.contactField);
    if (standardKey) {
      acc.standard[standardKey] = answer.value;
      return acc;
    }

    const customKey = getCustomFieldKey(answer.contactField);
    if (customKey) {
      acc.custom[customKey] = answer.value;
    }
    return acc;
  }, { standard: {}, custom: {} });
}

function serialiseSubmissionAnswer(answer) {
  return {
    ...answer,
    fieldLabel: answer.fieldLabel || answer.field?.label || 'Campo removido',
    contactField: answer.contactField || inferContactField({
      label: answer.fieldLabel || answer.field?.label || '',
      contactField: answer.contactField,
    }, answer.value),
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
        fields: { select: { id: true, type: true, label: true, order: true, options: true, contactField: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(forms.map((form) => ({
      ...form,
      fields: form.fields.map(serialiseFormField),
    })));
  } catch (error) {
    console.error('Error fetching forms:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/forms/contact-fields - campos disponíveis para mapear no builder
router.get('/contact-fields', requireAuth, requirePlanFeature('formularios'), requirePermission('forms', 'view'), async (req, res) => {
  try {
    const customFields = await prisma.contactFieldDef.findMany({
      where: { userId: req.user.effectiveUserId, active: true },
      orderBy: { order: 'asc' },
    });

    res.json({
      standard: STANDARD_CONTACT_FIELDS,
      custom: customFields.map((field) => ({
        id: field.id,
        key: field.key,
        binding: `custom:${field.key}`,
        label: field.label,
        type: field.type,
        required: field.required,
        options: safeParseJson(field.options, []),
      })),
    });
  } catch (error) {
    console.error('Error fetching form contact fields:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/contact-fields', requireAuth, requirePlanFeature('formularios'), requirePermission('forms', 'edit'), async (req, res) => {
  try {
    const { label, type, options, required } = req.body;
    if (!label?.trim()) {
      return res.status(400).json({ error: 'Label is required' });
    }

    const fieldType = ['text', 'number', 'date', 'select', 'url'].includes(type) ? type : 'text';
    const baseKey = normaliseText(label)
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 40) || `campo_${Date.now()}`;
    let key = baseKey;
    const existing = await prisma.contactFieldDef.findFirst({ where: { userId: req.user.effectiveUserId, key } });
    if (existing) key = `${baseKey}_${Date.now().toString().slice(-4)}`;

    const maxOrder = await prisma.contactFieldDef.aggregate({
      where: { userId: req.user.effectiveUserId },
      _max: { order: true },
    });

    const field = await prisma.contactFieldDef.create({
      data: {
        userId: req.user.effectiveUserId,
        label: label.trim(),
        key,
        type: fieldType,
        options: fieldType === 'select' && Array.isArray(options) ? JSON.stringify(options) : null,
        required: !!required,
        order: (maxOrder._max.order ?? -1) + 1,
      },
    });

    res.status(201).json({
      id: field.id,
      key: field.key,
      binding: `custom:${field.key}`,
      label: field.label,
      type: field.type,
      required: field.required,
      options: safeParseJson(field.options, []),
    });
  } catch (error) {
    console.error('Error creating form contact field:', error);
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
    const { plan, workspaceMode } = await getPlanContext(form.userId);
    if (!hasPlanFeature(plan, 'formularios', workspaceMode)) {
      return res.status(403).json({ error: 'Funcionalidade não disponível no seu plano' });
    }
    // Parse options JSON para campos de múltipla escolha
    const fieldsWithParsedOptions = form.fields.map(serialiseFormField);
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
    const fieldData = await resolveFieldPersistenceData({
      userId: req.user.effectiveUserId,
      type,
      options,
      contactField,
      contactFieldProvided: Object.prototype.hasOwnProperty.call(req.body, 'contactField'),
    });
    const field = await prisma.formField.create({
      data: {
        formId: req.params.id,
        label,
        required: required || false,
        order,
        type: fieldData.type || type,
        options: fieldData.options ?? null,
        contactField: fieldData.contactField ?? null,
      },
    });
    res.status(201).json(serialiseFormField(field));
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
    const fieldData = await resolveFieldPersistenceData({
      userId: req.user.effectiveUserId,
      type,
      options,
      contactField,
      contactFieldProvided: Object.prototype.hasOwnProperty.call(req.body, 'contactField'),
    });
    const field = await prisma.formField.update({
      where: { id: req.params.fieldId },
      data: {
        ...(label !== undefined && { label }),
        ...(required !== undefined && { required }),
        ...(order !== undefined && { order }),
        ...fieldData,
      },
    });
    res.json(serialiseFormField(field));
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
    const { plan, workspaceMode } = await getPlanContext(form.userId);
    if (!hasPlanFeature(plan, 'formularios', workspaceMode)) {
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
      const standardData = contactData.standard;
      const customData = contactData.custom;
      automationContact = {
        ...automationContact,
        name: standardData.name || '',
        phone: standardData.phone || '',
        email: standardData.email || '',
        company: standardData.company || '',
        revenue: standardData.revenue || null,
        sector: standardData.sector || null,
        location: standardData.location || null,
      };

      if (standardData.phone) {
        const defaultStage = await getDefaultStageName(form.userId);
        const existingContact = await prisma.contact.findFirst({
          where: {
            userId: form.userId,
            phone: standardData.phone,
          },
        });

        if (existingContact) {
          const existingCustomFields = safeParseJson(existingContact.customFields, {});
          const updateData = {
            inPipeline: true,
            lastActivityAt: new Date(),
          };

          if (standardData.name) updateData.name = standardData.name;
          if (standardData.email) updateData.email = standardData.email;
          if (standardData.company) updateData.company = standardData.company;
          if (standardData.sector) updateData.sector = standardData.sector;
          if (standardData.revenue) updateData.revenue = standardData.revenue;
          if (standardData.location) updateData.location = standardData.location;
          if (standardData.birthDate) {
            const birthDate = formatDateValue(standardData.birthDate);
            if (birthDate) updateData.birthDate = birthDate;
          }
          if (Object.keys(customData).length > 0) {
            updateData.customFields = JSON.stringify({ ...existingCustomFields, ...customData });
          }

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
                name: standardData.name || 'Sem nome',
                phone: standardData.phone,
                email: standardData.email || '',
                company: standardData.company || '',
                revenue: standardData.revenue || null,
                sector: standardData.sector || null,
                location: standardData.location || null,
                birthDate: formatDateValue(standardData.birthDate),
                customFields: JSON.stringify(customData),
                stage: defaultStage,
                inPipeline: true,
                contactType: 'interessado',
                status: 'ativo',
                lastActivityAt: new Date(),
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
