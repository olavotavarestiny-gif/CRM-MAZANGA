const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const automationRunner = require('../services/automationRunner');
const { requirePermission, requireDeletePermission } = require('../lib/permissions');
const { log: logActivity } = require('../services/activity-log.service.js');
const { canCreateContact, getLimitState, buildLimitErrorPayload } = require('../lib/plan-limits');
const { validateNIF } = require('../lib/fiscal/nif-validator');
const { cleanNifValue, parseCustomFields, resolveContactNif, stripNifKeysFromCustomFields } = require('../lib/contact-nif');
const { getDefaultStageName, isValidStageName } = require('../lib/pipeline-stages');
const VALID_FIELD_TYPES = ['text', 'number', 'date', 'select', 'url'];
const UNGROUPED_GROUP_ID = 'UNGROUPED';

function parseTags(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function formatTagsValue(tags) {
  return tags.length > 0 ? tags.join(', ') : 'Sem tags';
}

async function logContactActivity(req, data) {
  await logActivity({
    organization_id: req.user.effectiveUserId,
    user_id: req.user.id,
    user_name: req.user.name,
    ...data,
  });
}

// Built-in system field defaults exposed in contact field customization.
const SYSTEM_FIELD_DEFAULTS = [
  { key: 'name',        label: 'Nome',            required: true,  order: 0, visibleDefault: true },
  { key: 'phone',       label: 'Número',          required: true,  order: 1, visibleDefault: true },
  { key: 'email',       label: 'Email',           required: false, order: 2, visibleDefault: true },
  { key: 'nif',         label: 'NIF',             required: false, order: 3, visibleDefault: true },
  { key: 'company',     label: 'Empresa',         required: false, order: 4, visibleDefault: true },
  { key: 'clienteType', label: 'Tipo de Cliente', required: true,  order: 5, visibleDefault: true },
];

// Slugify a label into a unique key
function slugify(label) {
  return label
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);
}

// Merge system defaults with user overrides and return full config list
async function getSystemFieldConfigs(userId) {
  const overrides = await prisma.contactFieldConfig.findMany({ where: { userId } });
  const overrideMap = Object.fromEntries(overrides.map(o => [o.fieldKey, o]));
  return SYSTEM_FIELD_DEFAULTS.map(def => {
    const o = overrideMap[def.key];
    return {
      fieldKey:  def.key,
      label:     o?.label    ?? def.label,
      visible:   o !== undefined ? o.visible  : def.visibleDefault,
      required:  o !== undefined ? o.required : def.required,
      order:     o !== undefined ? o.order    : def.order,
      configId:  o?.id ?? null,
    };
  });
}

// ── System Field Config ───────────────────────────────────────────────────────

// GET /contacts/field-config — returns system field visibility/label config
router.get('/field-config', async (req, res) => {
  try {
    const configs = await getSystemFieldConfigs(req.user.effectiveUserId);
    res.json(configs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /contacts/field-config/:key — update a system field config
router.put('/field-config/:key', async (req, res) => {
  try {
    const { label, visible, required, order } = req.body;
    const { key } = req.params;
    const userId = req.user.effectiveUserId;

    if (!SYSTEM_FIELD_DEFAULTS.find(f => f.key === key)) {
      return res.status(400).json({ error: 'Invalid field key' });
    }

    const data = {};
    if (label    !== undefined) data.label    = label.trim();
    if (visible  !== undefined) data.visible  = !!visible;
    if (required !== undefined) data.required = !!required;
    if (order    !== undefined) data.order    = order;

    await prisma.contactFieldConfig.upsert({
      where: { userId_fieldKey: { userId, fieldKey: key } },
      update: data,
      create: {
        userId,
        fieldKey: key,
        label: label?.trim() ?? SYSTEM_FIELD_DEFAULTS.find(f => f.key === key).label,
        visible: visible !== undefined ? !!visible : true,
        required: required !== undefined ? !!required : SYSTEM_FIELD_DEFAULTS.find(f => f.key === key).required,
        order: order ?? SYSTEM_FIELD_DEFAULTS.find(f => f.key === key).order,
      },
    });

    const configs = await getSystemFieldConfigs(userId);
    res.json(configs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Custom Field Definitions ─────────────────────────────────────────────────

// GET /contacts/fields — list custom field defs only
router.get('/fields', async (req, res) => {
  try {
    const fields = await prisma.contactFieldDef.findMany({
      where: { userId: req.user.effectiveUserId, active: true },
      orderBy: { order: 'asc' },
    });
    res.json(fields.map(f => ({ ...f, options: f.options ? JSON.parse(f.options) : [] })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /contacts/fields — create new field def
router.post('/fields', async (req, res) => {
  try {
    const { label, type, options, required } = req.body;
    if (!label || !label.trim()) return res.status(400).json({ error: 'Label is required' });
    const fieldType = VALID_FIELD_TYPES.includes(type) ? type : 'text';

    const userId = req.user.effectiveUserId;
    let key = slugify(label);
    if (!key) key = 'campo_' + Date.now();

    // Ensure key uniqueness within user scope
    const existing = await prisma.contactFieldDef.findFirst({ where: { userId, key } });
    if (existing) key = key + '_' + Date.now().toString().slice(-4);

    const maxOrder = await prisma.contactFieldDef.aggregate({
      where: { userId },
      _max: { order: true },
    });

    const field = await prisma.contactFieldDef.create({
      data: {
        userId,
        label: label.trim(),
        key,
        type: fieldType,
        options: fieldType === 'select' && Array.isArray(options) ? JSON.stringify(options) : null,
        required: !!required,
        order: (maxOrder._max.order ?? -1) + 1,
      },
    });
    res.status(201).json({ ...field, options: field.options ? JSON.parse(field.options) : [] });
  } catch (error) {
    if (error.code === 'P2002') return res.status(400).json({ error: 'A field with this key already exists' });
    res.status(500).json({ error: error.message });
  }
});

// PUT /contacts/fields/reorder — MUST be before /fields/:id to avoid route conflict
router.put('/fields/reorder', async (req, res) => {
  try {
    const { order } = req.body; // [{ id, order }, ...]
    if (!Array.isArray(order)) return res.status(400).json({ error: 'Invalid order array' });
    await Promise.all(
      order.map(({ id, order: o }) =>
        prisma.contactFieldDef.updateMany({
          where: { id, userId: req.user.effectiveUserId },
          data: { order: o },
        })
      )
    );
    res.json({ message: 'Reordered' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /contacts/fields/:id — update field def
router.put('/fields/:id', async (req, res) => {
  try {
    const { label, type, options, required, order } = req.body;
    const existing = await prisma.contactFieldDef.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.user.effectiveUserId) {
      return res.status(404).json({ error: 'Field not found' });
    }
    const updateData = {};
    if (label !== undefined) updateData.label = label.trim();
    if (type !== undefined && VALID_FIELD_TYPES.includes(type)) updateData.type = type;
    if (options !== undefined && Array.isArray(options)) updateData.options = JSON.stringify(options);
    if (required !== undefined) updateData.required = !!required;
    if (order !== undefined) updateData.order = order;

    const field = await prisma.contactFieldDef.update({ where: { id: req.params.id }, data: updateData });
    res.json({ ...field, options: field.options ? JSON.parse(field.options) : [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /contacts/fields/:id — hide field (active=false). System fields are hidden; custom fields are hard-deleted.
router.delete('/fields/:id', async (req, res) => {
  try {
    const existing = await prisma.contactFieldDef.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.user.effectiveUserId) {
      return res.status(404).json({ error: 'Field not found' });
    }
    // System fields are always soft-deleted so they can be restored later
    await prisma.contactFieldDef.update({ where: { id: req.params.id }, data: { active: false } });
    res.json({ message: 'Field hidden', isSystem: existing.isSystem });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
const VALID_REVENUES = [
  '- 50 Milhões De Kwanzas',
  'Entre 50 - 100 Milhões',
  'Entre 100 Milhões - 500 Milhões',
  '+ 500 M',
];

// Phone format validation (basic: only digits and common symbols)
function isValidPhone(phone) {
  return /^[\d\s\+\-\(\)]{7,20}$/.test(phone);
}

function parseDocuments(raw) {
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseTags(raw) {
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function serialiseContact(contact) {
  const customFields = parseCustomFields(contact.customFields);

  return {
    ...contact,
    nif: resolveContactNif({ ...contact, customFields }),
    tags: parseTags(contact.tags),
    customFields,
    documents: parseDocuments(contact.documents),
    contactGroup: contact.contactGroup
      ? {
          id: contact.contactGroup.id,
          name: contact.contactGroup.name,
        }
      : null,
  };
}

function normaliseClienteType(rawValue, fallback = 'particular') {
  return ['empresa', 'particular'].includes(rawValue) ? rawValue : fallback;
}

function validateContactNif({ nif, clienteType }) {
  if (clienteType === 'empresa' && !nif) {
    return 'NIF obrigatório para contactos empresa.';
  }

  if (!nif) {
    return null;
  }

  const validation = validateNIF(nif);
  if (!validation.valid) {
    return validation.reason ? `NIF inválido: ${validation.reason}` : 'NIF inválido.';
  }

  return null;
}

function parseDealValueInput(rawValue) {
  if (rawValue === undefined) {
    return { provided: false, value: undefined };
  }

  if (rawValue === null || rawValue === '') {
    return { provided: true, value: null };
  }

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed < 0) {
    const error = new Error('Valor da negociação inválido');
    error.statusCode = 400;
    throw error;
  }

  return {
    provided: true,
    value: Number(parsed.toFixed(2)),
  };
}

function cleanContactGroupName(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function normaliseContactGroupName(value) {
  return cleanContactGroupName(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

async function resolveContactGroupId(rawValue, userId) {
  if (rawValue === undefined) {
    return undefined;
  }

  if (rawValue === null || rawValue === '' || rawValue === UNGROUPED_GROUP_ID) {
    return null;
  }

  if (typeof rawValue !== 'string') {
    const error = new Error('Grupo inválido.');
    error.statusCode = 400;
    throw error;
  }

  const group = await prisma.contactGroup.findFirst({
    where: { id: rawValue, userId },
    select: { id: true },
  });

  if (!group) {
    const error = new Error('Grupo não encontrado.');
    error.statusCode = 400;
    throw error;
  }

  return group.id;
}

async function getWorkspaceModeForUser(userId) {
  const ownerAccount = await prisma.user.findUnique({
    where: { id: userId },
    select: { workspaceMode: true },
  });

  return ownerAccount?.workspaceMode === 'comercio' ? 'comercio' : 'servicos';
}

async function getValidatedStageName(userId, requestedStage) {
  if (requestedStage && await isValidStageName(userId, requestedStage)) {
    return requestedStage;
  }

  return getDefaultStageName(userId);
}

router.get('/groups', requirePermission('contacts', 'view'), async (req, res) => {
  try {
    const groups = await prisma.contactGroup.findMany({
      where: { userId: req.user.effectiveUserId },
      orderBy: [{ normalizedName: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json(groups);
  } catch (error) {
    console.error('Error fetching contact groups:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/groups', requirePermission('contacts', 'edit'), async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;
    const name = cleanContactGroupName(req.body?.name);
    const normalizedName = normaliseContactGroupName(name);

    if (!name || !normalizedName) {
      return res.status(400).json({ error: 'Nome do grupo é obrigatório.' });
    }

    const existing = await prisma.contactGroup.findFirst({
      where: { userId, normalizedName },
      select: { id: true },
    });

    if (existing) {
      return res.status(400).json({ error: 'Já existe um grupo com este nome.' });
    }

    const group = await prisma.contactGroup.create({
      data: { userId, name, normalizedName },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.status(201).json(group);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Já existe um grupo com este nome.' });
    }
    console.error('Error creating contact group:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/groups/:id', requirePermission('contacts', 'edit'), async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;
    const name = cleanContactGroupName(req.body?.name);
    const normalizedName = normaliseContactGroupName(name);

    if (!name || !normalizedName) {
      return res.status(400).json({ error: 'Nome do grupo é obrigatório.' });
    }

    const existing = await prisma.contactGroup.findFirst({
      where: { id: req.params.id, userId },
      select: { id: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Grupo não encontrado.' });
    }

    const duplicate = await prisma.contactGroup.findFirst({
      where: {
        userId,
        normalizedName,
        id: { not: req.params.id },
      },
      select: { id: true },
    });

    if (duplicate) {
      return res.status(400).json({ error: 'Já existe um grupo com este nome.' });
    }

    const group = await prisma.contactGroup.update({
      where: { id: req.params.id },
      data: { name, normalizedName },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json(group);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Já existe um grupo com este nome.' });
    }
    console.error('Error updating contact group:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/groups/:id', requirePermission('contacts', 'edit'), async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;

    const existing = await prisma.contactGroup.findFirst({
      where: { id: req.params.id, userId },
      select: { id: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Grupo não encontrado.' });
    }

    const detachedContactsCount = await prisma.contact.count({
      where: {
        userId,
        contactGroupId: req.params.id,
      },
    });

    await prisma.contactGroup.delete({
      where: { id: req.params.id },
    });

    res.json({
      message: 'Grupo removido.',
      detachedContactsCount,
    });
  } catch (error) {
    console.error('Error deleting contact group:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET all contacts with optional filters
router.get('/', requirePermission('contacts', 'view'), async (req, res) => {
  try {
    const { stage, search, inPipeline, revenue, contactType, groupId } = req.query;
    const userId = req.user.effectiveUserId;
    const where = { userId };
    const workspaceMode = await getWorkspaceModeForUser(userId);

    if (stage && await isValidStageName(userId, stage)) {
      where.stage = stage;
    }

    if (inPipeline === 'true') {
      where.inPipeline = true;
    } else if (inPipeline === 'false') {
      where.inPipeline = false;
    }

    if (revenue && VALID_REVENUES.includes(revenue)) {
      where.revenue = revenue;
    }

    if (workspaceMode === 'comercio') {
      where.contactType = 'cliente';
    } else if (contactType && ['interessado', 'cliente'].includes(contactType)) {
      where.contactType = contactType;
    }

    if (groupId === UNGROUPED_GROUP_ID) {
      where.contactGroupId = null;
    } else if (typeof groupId === 'string' && groupId.trim()) {
      where.contactGroupId = groupId.trim();
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { company: { contains: search, mode: 'insensitive' } },
        { nif: { contains: search } },
        { customFields: { contains: search } },
      ];
    }

    const contacts = await prisma.contact.findMany({
      where,
      include: {
        contactGroup: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(contacts.map(serialiseContact));
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST create new contact
router.post('/', requirePermission('contacts', 'edit'), async (req, res) => {
  try {
    const { name, email, phone, company, dealValueKz, revenue, sector, stage, tags, customFields, contactType, status, clienteType, nif, contactGroupId } = req.body;
    const userId = req.user.effectiveUserId;

    if (!name || !phone) {
      return res.status(400).json({ error: 'Name and phone are required' });
    }

    if (!isValidPhone(phone)) {
      return res.status(400).json({ error: 'Phone format is invalid. Use only digits, spaces, +, -, (, )' });
    }

    const limitState = await canCreateContact(userId);
    if (!limitState.allowed) {
      return res.status(403).json(buildLimitErrorPayload(limitState));
    }

    const workspaceMode = await getWorkspaceModeForUser(userId);
    const finalStage = await getValidatedStageName(userId, stage);
    const finalInPipeline = workspaceMode === 'comercio' ? false : true;
    const finalClienteType = normaliseClienteType(clienteType);
    const finalContactType =
      workspaceMode === 'comercio'
        ? 'cliente'
        : ['interessado', 'cliente'].includes(contactType)
        ? contactType
        : 'interessado';
    const cleanedCustomFields =
      customFields && typeof customFields === 'object'
        ? stripNifKeysFromCustomFields(customFields)
        : {};
    const resolvedNif =
      nif !== undefined
        ? cleanNifValue(nif)
        : resolveContactNif({ customFields });
    const parsedDealValue = parseDealValueInput(dealValueKz);
    const resolvedContactGroupId = await resolveContactGroupId(contactGroupId, userId);
    const nifError = validateContactNif({ nif: resolvedNif, clienteType: finalClienteType });
    if (nifError) {
      return res.status(400).json({ error: nifError });
    }

    const contact = await prisma.contact.create({
      data: {
        userId,
        contactGroupId: resolvedContactGroupId ?? null,
        name,
        email: email || '',
        phone,
        company: company || '',
        nif: resolvedNif,
        dealValueKz: parsedDealValue.provided ? parsedDealValue.value : null,
        revenue: revenue || null,
        sector: sector || null,
        tags: Array.isArray(tags) ? JSON.stringify(tags) : '[]',
        stage: finalStage,
        inPipeline: finalInPipeline,
        customFields: JSON.stringify(cleanedCustomFields),
        contactType: finalContactType,
        status: ['ativo', 'inativo'].includes(status) ? status : 'ativo',
        clienteType: finalClienteType,
      },
      include: {
        contactGroup: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    await logContactActivity(req, {
      entity_type: 'contact',
      entity_id: contact.id,
      entity_label: contact.name,
      action: 'created',
      metadata: {
        source: 'manual',
      },
    });

    // Run automations for new_contact trigger (don't wait, just fire and forget)
    console.log(`[AUTOMATION] New contact created: ${contact.name} (ID: ${contact.id})`);
    automationRunner.run('new_contact', contact).catch((err) => {
      console.error('Automation error:', err);
    });

    // Also run automations for tags, revenue, sector if provided
    if (Array.isArray(tags) && tags.length > 0) {
      for (const tag of tags) {
        automationRunner.run('contact_tag', contact, tag).catch((err) => {
          console.error('Automation error:', err);
        });
      }
    }
    if (revenue) {
      automationRunner.run('contact_revenue', contact, revenue).catch((err) => {
        console.error('Automation error:', err);
      });
    }
    if (sector) {
      automationRunner.run('contact_sector', contact, sector).catch((err) => {
        console.error('Automation error:', err);
      });
    }

    res.status(201).json(serialiseContact(contact));
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Phone number already exists' });
    }
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error creating contact:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST import contacts (bulk) - MUST be before /:id routes
router.post('/bulk-update', requirePermission('contacts', 'edit'), async (req, res) => {
  try {
    const userId = req.user.effectiveUserId;
    const workspaceMode = await getWorkspaceModeForUser(userId);
    const rawContactIds = Array.isArray(req.body?.contactIds) ? req.body.contactIds : [];
    const changes = req.body?.changes && typeof req.body.changes === 'object' ? req.body.changes : null;

    const contactIds = [...new Set(
      rawContactIds
        .map((value) => Number.parseInt(String(value), 10))
        .filter((value) => Number.isInteger(value) && value > 0)
    )];

    if (!contactIds.length) {
      return res.status(400).json({ error: 'Selecione pelo menos um contacto.' });
    }

    if (!changes) {
      return res.status(400).json({ error: 'Nenhuma alteração em massa foi enviada.' });
    }

    const updateData = {};
    const changeSummary = {};

    if (changes.contactGroupId !== undefined) {
      const resolvedContactGroupId = await resolveContactGroupId(changes.contactGroupId, userId);
      updateData.contactGroupId = resolvedContactGroupId ?? null;
      changeSummary.contactGroupId = resolvedContactGroupId ?? null;
    }

    if (changes.status !== undefined) {
      if (!['ativo', 'inativo'].includes(changes.status)) {
        return res.status(400).json({ error: 'Estado inválido.' });
      }
      updateData.status = changes.status;
      changeSummary.status = changes.status;
    }

    if (changes.stage !== undefined) {
      if (typeof changes.stage !== 'string' || !(await isValidStageName(userId, changes.stage))) {
        return res.status(400).json({ error: 'Etapa inválida.' });
      }
      updateData.stage = changes.stage;
      changeSummary.stage = changes.stage;
    }

    if (changes.contactType !== undefined) {
      if (workspaceMode === 'comercio') {
        updateData.contactType = 'cliente';
        changeSummary.contactType = 'cliente';
      } else if (['interessado', 'cliente'].includes(changes.contactType)) {
        updateData.contactType = changes.contactType;
        changeSummary.contactType = changes.contactType;
      } else {
        return res.status(400).json({ error: 'Tipo de contacto inválido.' });
      }
    }

    if (!Object.keys(updateData).length) {
      return res.status(400).json({ error: 'Selecione pelo menos uma alteração para aplicar.' });
    }

    const targetContacts = await prisma.contact.findMany({
      where: {
        userId,
        id: { in: contactIds },
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!targetContacts.length) {
      return res.status(404).json({ error: 'Nenhum contacto encontrado para a seleção atual.' });
    }

    const targetContactIds = targetContacts.map((contact) => contact.id);
    const updateResult = await prisma.contact.updateMany({
      where: {
        userId,
        id: { in: targetContactIds },
      },
      data: updateData,
    });

    await Promise.all(
      targetContacts.map((contact) =>
        logContactActivity(req, {
          entity_type: 'contact',
          entity_id: contact.id,
          entity_label: contact.name,
          action: 'bulk_updated',
          metadata: {
            source: 'bulk_update',
            changes: changeSummary,
          },
        })
      )
    );

    res.json({
      requestedCount: contactIds.length,
      matchedCount: targetContacts.length,
      updatedCount: updateResult.count,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error bulk-updating contacts:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST import contacts (bulk) - MUST be before /:id routes
router.post('/import', requirePermission('contacts', 'edit'), async (req, res) => {
  try {
    const { contacts } = req.body;
    const userId = req.user.effectiveUserId;

    if (!Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ error: 'Invalid contacts array' });
    }

    const defaultStage = await getDefaultStageName(userId);
    const workspaceMode = await getWorkspaceModeForUser(userId);

    // Prepare contacts for insertion
    const preparedContacts = contacts
      .filter((c) => c.phone) // Required field
      .map((c) => ({
        userId,
        name: `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.phone,
        email: c.email || '',
        phone: c.phone,
        company: c.companyName || '',
        revenue: c.revenue || null,
        sector: c.sector || null,
        stage: defaultStage,
        inPipeline: workspaceMode === 'comercio' ? false : true,
        contactType: workspaceMode === 'comercio' ? 'cliente' : 'interessado',
        status: 'ativo',
      }));

    const limitState = await getLimitState(userId, 'contacts');
    if (limitState.rawLimit !== Infinity) {
      const uniquePhones = [...new Set(preparedContacts.map((contact) => contact.phone))];
      const existingContacts = uniquePhones.length
        ? await prisma.contact.findMany({
            where: {
              userId,
              phone: { in: uniquePhones },
            },
            select: { phone: true },
          })
        : [];

      const existingPhones = new Set(existingContacts.map((contact) => contact.phone));
      const effectiveInsertCount = uniquePhones.filter((phone) => !existingPhones.has(phone)).length;

      if (limitState.current + effectiveInsertCount > limitState.rawLimit) {
        return res.status(403).json(buildLimitErrorPayload(limitState));
      }
    }

    // Insert all contacts
    const inserted = await Promise.all(
      preparedContacts.map((contact) =>
        prisma.contact
          .create({ data: contact })
          .then(async (newContact) => {
            await logContactActivity(req, {
              entity_type: 'contact',
              entity_id: newContact.id,
              entity_label: newContact.name,
              action: 'created',
              metadata: {
                source: 'csv_import',
              },
            });
            // Run automations for each new contact
            await automationRunner.run('new_contact', newContact);
            return newContact;
          })
          .catch((error) => {
            // Skip duplicate phone numbers
            if (error.code === 'P2002') {
              return null;
            }
            throw error;
          })
      )
    );

    const successCount = inserted.filter((c) => c !== null).length;

    res.json({
      total: contacts.length,
      imported: successCount,
      skipped: contacts.length - successCount,
      message: `${successCount} contacts imported successfully`,
    });
  } catch (error) {
    console.error('Error importing contacts:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /:id/summary — contact history summary
router.get('/:id/summary', requirePermission('contacts', 'view'), async (req, res) => {
  try {
    const contactId = parseInt(req.params.id);
    const userId = req.user.effectiveUserId;

    // Verify contact belongs to user
    const contact = await prisma.contact.findFirst({ where: { id: contactId, userId } });
    if (!contact) return res.status(404).json({ error: 'Contacto não encontrado' });

    // Total purchased (sum of income transactions)
    const agg = await prisma.transaction.aggregate({
      where: { clientId: contactId, userId, type: 'entrada' },
      _sum: { amountKz: true },
    });

    // Last 5 transactions
    const transacoes = await prisma.transaction.findMany({
      where: { clientId: contactId, userId },
      orderBy: { date: 'desc' },
      take: 5,
    });

    // Last service (last entrada transaction)
    const ultimaTransacao = transacoes.find(t => t.type === 'entrada') || null;

    res.json({
      totalComprado: agg._sum.amountKz || 0,
      ultimoServico: ultimaTransacao ? {
        data: ultimaTransacao.date,
        descricao: ultimaTransacao.description,
        valor: ultimaTransacao.amountKz,
      } : null,
      transacoes,
      faturas: [], // placeholder — faturas not directly linked to contacts by id yet
    });
  } catch (error) {
    console.error('Error fetching contact summary:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET contact by id with messages and tasks
router.get('/:id', requirePermission('contacts', 'view'), async (req, res) => {
  try {
    const contact = await prisma.contact.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        contactGroup: {
          select: {
            id: true,
            name: true,
          },
        },
        messages: {
          orderBy: { timestamp: 'asc' },
        },
        tasks: {
          where: req.user.isSuperAdmin || req.user.isAccountOwner || req.user.role === 'admin'
            ? undefined
            : { assignedToUserId: req.user.id },
          include: {
            assignedTo: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { dueDate: 'asc' },
        },
      },
    });

    if (!contact || contact.userId !== req.user.effectiveUserId) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json(serialiseContact(contact));
  } catch (error) {
    console.error('Error fetching contact:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT update contact
router.put('/:id', requirePermission('contacts', 'edit'), async (req, res) => {
  try {
    const { name, email, phone, company, dealValueKz, revenue, sector, stage, inPipeline, tags, customFields, contactType, status, documents, clienteType, nif, contactGroupId } = req.body;
    const updateData = {};
    const contactId = parseInt(req.params.id);
    const userId = req.user.effectiveUserId;

    // Verify ownership
    const existing = await prisma.contact.findUnique({ where: { id: contactId } });
    if (!existing || existing.userId !== userId) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    if (phone !== undefined && !isValidPhone(phone)) {
      return res.status(400).json({ error: 'Phone format is invalid. Use only digits, spaces, +, -, (, )' });
    }

    const workspaceMode = await getWorkspaceModeForUser(userId);
    const mergedCustomFields =
      customFields && typeof customFields === 'object'
        ? { ...parseCustomFields(existing.customFields), ...customFields }
        : parseCustomFields(existing.customFields);
    const cleanedMergedCustomFields = stripNifKeysFromCustomFields(mergedCustomFields);
    const nextClienteType = normaliseClienteType(clienteType, existing.clienteType || 'particular');
    const resolvedNif =
      nif !== undefined
        ? cleanNifValue(nif)
        : resolveContactNif({ customFields: mergedCustomFields }) || resolveContactNif(existing);
    const parsedDealValue = parseDealValueInput(dealValueKz);
    const nifError = validateContactNif({ nif: resolvedNif, clienteType: nextClienteType });

    if (nifError) {
      return res.status(400).json({ error: nifError });
    }

    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (company !== undefined) updateData.company = company;
    if (nif !== undefined || resolvedNif !== cleanNifValue(existing.nif)) {
      updateData.nif = resolvedNif;
    }
    if (parsedDealValue.provided) updateData.dealValueKz = parsedDealValue.value;
    if (revenue !== undefined) updateData.revenue = revenue;
    if (sector !== undefined) updateData.sector = sector;
    if (inPipeline !== undefined) updateData.inPipeline = inPipeline;
    if (contactGroupId !== undefined) updateData.contactGroupId = await resolveContactGroupId(contactGroupId, userId);
    if (Array.isArray(tags)) updateData.tags = JSON.stringify(tags);
    if (stage && await isValidStageName(userId, stage)) {
      updateData.stage = stage;
    }
    if (customFields && typeof customFields === 'object') {
      updateData.customFields = JSON.stringify(cleanedMergedCustomFields);
    } else if (JSON.stringify(cleanedMergedCustomFields) !== JSON.stringify(parseCustomFields(existing.customFields))) {
      updateData.customFields = JSON.stringify(cleanedMergedCustomFields);
    }
    if (workspaceMode === 'comercio') {
      updateData.contactType = 'cliente';
    } else if (contactType !== undefined && ['interessado', 'cliente'].includes(contactType)) {
      updateData.contactType = contactType;
    }
    if (status !== undefined && ['ativo', 'inativo'].includes(status)) updateData.status = status;
    if (clienteType !== undefined && ['empresa', 'particular'].includes(clienteType)) updateData.clienteType = nextClienteType;
    if (documents !== undefined) {
      if (Array.isArray(documents)) {
        updateData.documents = JSON.stringify(documents);
      } else if (typeof documents === 'string') {
        try {
          const parsed = JSON.parse(documents);
          if (Array.isArray(parsed)) updateData.documents = documents;
        } catch {}
      }
    }

    const contact = await prisma.contact.update({
      where: { id: contactId },
      data: updateData,
      include: {
        contactGroup: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (existing.name !== contact.name) {
      await logContactActivity(req, {
        entity_type: 'contact',
        entity_id: contact.id,
        entity_label: contact.name,
        action: 'updated',
        field_changed: 'name',
        old_value: existing.name,
        new_value: contact.name,
      });
    }

    if (existing.email !== contact.email) {
      await logContactActivity(req, {
        entity_type: 'contact',
        entity_id: contact.id,
        entity_label: contact.name,
        action: 'updated',
        field_changed: 'email',
        old_value: existing.email || 'Sem email',
        new_value: contact.email || 'Sem email',
      });
    }

    if (existing.phone !== contact.phone) {
      await logContactActivity(req, {
        entity_type: 'contact',
        entity_id: contact.id,
        entity_label: contact.name,
        action: 'updated',
        field_changed: 'phone',
        old_value: existing.phone || 'Sem telefone',
        new_value: contact.phone || 'Sem telefone',
      });
    }

    const oldTags = parseTags(existing.tags);
    const newTags = parseTags(contact.tags);
    if (JSON.stringify(oldTags) !== JSON.stringify(newTags)) {
      await logContactActivity(req, {
        entity_type: 'contact',
        entity_id: contact.id,
        entity_label: contact.name,
        action: 'updated',
        field_changed: 'tags',
        old_value: formatTagsValue(oldTags),
        new_value: formatTagsValue(newTags),
      });
    }

    if (existing.stage !== contact.stage) {
      await logContactActivity(req, {
        entity_type: 'contact',
        entity_id: contact.id,
        entity_label: contact.name,
        action: 'stage_changed',
        field_changed: 'stage',
        old_value: existing.stage,
        new_value: contact.stage,
        metadata: {
          old_stage_name: existing.stage,
          new_stage_name: contact.stage,
        },
      });
    }

    // Trigger automations for tags, revenue, sector changes
    if (tags && Array.isArray(tags)) {
      for (const tag of tags) {
        automationRunner.run('contact_tag', contact, tag).catch((err) => {
          console.error('Automation error:', err);
        });
      }
    }
    if (revenue !== undefined && revenue) {
      automationRunner.run('contact_revenue', contact, revenue).catch((err) => {
        console.error('Automation error:', err);
      });
    }
    if (sector !== undefined && sector) {
      automationRunner.run('contact_sector', contact, sector).catch((err) => {
        console.error('Automation error:', err);
      });
    }

    res.json(serialiseContact(contact));
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Phone number already exists' });
    }
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Contact not found' });
    }
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error updating contact:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE contact
router.delete('/:id', requireDeletePermission, async (req, res) => {
  try {
    const contactId = parseInt(req.params.id);

    // Only account owners can delete
    if (!req.user.isAccountOwner) {
      return res.status(403).json({ error: 'Apenas o dono da conta pode eliminar contactos' });
    }

    // Verify ownership
    const existing = await prisma.contact.findUnique({ where: { id: contactId } });
    if (!existing || existing.userId !== req.user.effectiveUserId) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    await prisma.contact.delete({
      where: { id: contactId },
    });

    await logContactActivity(req, {
      entity_type: 'contact',
      entity_id: existing.id,
      entity_label: existing.name,
      action: 'deleted',
    });

    res.json({ message: 'Contact deleted' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Contact not found' });
    }
    console.error('Error deleting contact:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
