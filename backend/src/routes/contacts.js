const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const automationRunner = require('../services/automationRunner');
const { requirePermission, requireDeletePermission } = require('../lib/permissions');
const { canCreateContact, getLimitState, buildLimitErrorPayload } = require('../lib/plan-limits');

const VALID_STAGES = ['Novo', 'Contactado', 'Qualificado', 'Proposta Enviada', 'Fechado', 'Perdido'];
const VALID_FIELD_TYPES = ['text', 'number', 'date', 'select', 'url'];

// Built-in system field defaults exposed in contact field customization.
const SYSTEM_FIELD_DEFAULTS = [
  { key: 'name',        label: 'Nome',            required: true,  order: 0, visibleDefault: true },
  { key: 'phone',       label: 'Número',          required: true,  order: 1, visibleDefault: true },
  { key: 'email',       label: 'Email',           required: false, order: 2, visibleDefault: true },
  { key: 'company',     label: 'Empresa',         required: false, order: 3, visibleDefault: true },
  { key: 'clienteType', label: 'Tipo de Cliente', required: true,  order: 4, visibleDefault: true },
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

// Helper: parse customFields JSON safely
function parseCustomFields(raw) {
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
}

function parseDocuments(raw) {
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// GET all contacts with optional filters
router.get('/', requirePermission('contacts', 'view'), async (req, res) => {
  try {
    const { stage, search, inPipeline, revenue, contactType } = req.query;
    const where = { userId: req.user.effectiveUserId };

    if (stage && VALID_STAGES.includes(stage)) {
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

    if (contactType && ['interessado', 'cliente'].includes(contactType)) {
      where.contactType = contactType;
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
        { company: { contains: search } },
      ];
    }

    const contacts = await prisma.contact.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    res.json(contacts.map(c => ({
      ...c,
      tags: (() => { try { return JSON.parse(c.tags); } catch { return []; } })(),
      customFields: parseCustomFields(c.customFields),
      documents: parseDocuments(c.documents),
    })));
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST create new contact
router.post('/', requirePermission('contacts', 'edit'), async (req, res) => {
  try {
    const { name, email, phone, company, revenue, sector, stage, tags, customFields, contactType, status, clienteType } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: 'Name and phone are required' });
    }

    if (!isValidPhone(phone)) {
      return res.status(400).json({ error: 'Phone format is invalid. Use only digits, spaces, +, -, (, )' });
    }

    const limitState = await canCreateContact(req.user.effectiveUserId);
    if (!limitState.allowed) {
      return res.status(403).json(buildLimitErrorPayload(limitState));
    }

    const finalStage = stage && VALID_STAGES.includes(stage) ? stage : 'Novo';

    const contact = await prisma.contact.create({
      data: {
        userId: req.user.effectiveUserId,
        name,
        email: email || '',
        phone,
        company: company || '',
        revenue: revenue || null,
        sector: sector || null,
        tags: Array.isArray(tags) ? JSON.stringify(tags) : '[]',
        stage: finalStage,
        customFields: customFields && typeof customFields === 'object' ? JSON.stringify(customFields) : '{}',
        contactType: ['interessado', 'cliente'].includes(contactType) ? contactType : 'interessado',
        status: ['ativo', 'inativo'].includes(status) ? status : 'ativo',
        clienteType: ['empresa', 'particular'].includes(clienteType) ? clienteType : 'particular',
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

    res.status(201).json({
      ...contact,
      tags: (() => { try { return JSON.parse(contact.tags); } catch { return []; } })(),
      customFields: parseCustomFields(contact.customFields),
      documents: parseDocuments(contact.documents),
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Phone number already exists' });
    }
    console.error('Error creating contact:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST import contacts (bulk) - MUST be before /:id routes
router.post('/import', requirePermission('contacts', 'edit'), async (req, res) => {
  try {
    const { contacts } = req.body;

    if (!Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ error: 'Invalid contacts array' });
    }

    // Prepare contacts for insertion
    const preparedContacts = contacts
      .filter((c) => c.phone) // Required field
      .map((c) => ({
        userId: req.user.effectiveUserId,
        name: `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.phone,
        email: c.email || '',
        phone: c.phone,
        company: c.companyName || '',
        revenue: c.revenue || null,
        sector: c.sector || null,
        stage: 'Novo',
      }));

    const limitState = await getLimitState(req.user.effectiveUserId, 'contacts');
    if (limitState.rawLimit !== Infinity) {
      const uniquePhones = [...new Set(preparedContacts.map((contact) => contact.phone))];
      const existingContacts = uniquePhones.length
        ? await prisma.contact.findMany({
            where: {
              userId: req.user.effectiveUserId,
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

    res.json({
      ...contact,
      tags: (() => { try { return JSON.parse(contact.tags); } catch { return []; } })(),
      customFields: parseCustomFields(contact.customFields),
      documents: parseDocuments(contact.documents),
    });
  } catch (error) {
    console.error('Error fetching contact:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT update contact
router.put('/:id', requirePermission('contacts', 'edit'), async (req, res) => {
  try {
    const { name, email, phone, company, revenue, sector, stage, inPipeline, tags, customFields, contactType, status, documents, clienteType } = req.body;
    const updateData = {};
    const contactId = parseInt(req.params.id);

    // Verify ownership
    const existing = await prisma.contact.findUnique({ where: { id: contactId } });
    if (!existing || existing.userId !== req.user.effectiveUserId) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    if (phone !== undefined && !isValidPhone(phone)) {
      return res.status(400).json({ error: 'Phone format is invalid. Use only digits, spaces, +, -, (, )' });
    }

    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (company !== undefined) updateData.company = company;
    if (revenue !== undefined) updateData.revenue = revenue;
    if (sector !== undefined) updateData.sector = sector;
    if (inPipeline !== undefined) updateData.inPipeline = inPipeline;
    if (Array.isArray(tags)) updateData.tags = JSON.stringify(tags);
    if (stage && VALID_STAGES.includes(stage)) {
      updateData.stage = stage;
    }
    if (customFields && typeof customFields === 'object') {
      // Merge existing customFields with incoming to avoid overwriting unrelated keys
      const existing2 = await prisma.contact.findUnique({ where: { id: contactId }, select: { customFields: true } });
      const merged = { ...parseCustomFields(existing2?.customFields), ...customFields };
      updateData.customFields = JSON.stringify(merged);
    }
    if (contactType !== undefined && ['interessado', 'cliente'].includes(contactType)) updateData.contactType = contactType;
    if (status !== undefined && ['ativo', 'inativo'].includes(status)) updateData.status = status;
    if (clienteType !== undefined && ['empresa', 'particular'].includes(clienteType)) updateData.clienteType = clienteType;
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
    });

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

    res.json({
      ...contact,
      tags: (() => { try { return JSON.parse(contact.tags); } catch { return []; } })(),
      customFields: parseCustomFields(contact.customFields),
      documents: parseDocuments(contact.documents),
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Phone number already exists' });
    }
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Contact not found' });
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
