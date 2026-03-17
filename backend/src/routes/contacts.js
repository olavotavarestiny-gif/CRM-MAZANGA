const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const automationRunner = require('../services/automationRunner');

const VALID_STAGES = ['Novo', 'Contactado', 'Qualificado', 'Proposta Enviada', 'Fechado', 'Perdido'];
const VALID_REVENUES = [
  '- 50 Milhões De Kwanzas',
  'Entre 50 - 100 Milhões',
  'Entre 100 Milhões - 500 Milhões',
  '+ 500 M',
];

// GET all contacts with optional filters
router.get('/', async (req, res) => {
  try {
    const { stage, search, inPipeline, revenue } = req.query;
    const where = {};

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

    res.json(contacts);
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST create new contact
router.post('/', async (req, res) => {
  try {
    const { name, email, phone, company, revenue, sector, stage, tags } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: 'Name and phone are required' });
    }

    const finalStage = stage && VALID_STAGES.includes(stage) ? stage : 'Novo';

    const contact = await prisma.contact.create({
      data: {
        name,
        email: email || '',
        phone,
        company: company || '',
        revenue: revenue || null,
        sector: sector || null,
        tags: Array.isArray(tags) ? JSON.stringify(tags) : '[]',
        stage: finalStage,
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

    res.status(201).json(contact);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Phone number already exists' });
    }
    console.error('Error creating contact:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST import contacts (bulk) - MUST be before /:id routes
router.post('/import', async (req, res) => {
  try {
    const { contacts } = req.body;

    if (!Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ error: 'Invalid contacts array' });
    }

    // Prepare contacts for insertion
    const preparedContacts = contacts
      .filter((c) => c.phone) // Required field
      .map((c) => ({
        name: `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.phone,
        email: c.email || '',
        phone: c.phone,
        company: c.companyName || '',
        revenue: c.revenue || null,
        sector: c.sector || null,
        stage: 'Novo',
      }));

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

// GET contact by id with messages and tasks
router.get('/:id', async (req, res) => {
  try {
    const contact = await prisma.contact.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        messages: {
          orderBy: { timestamp: 'asc' },
        },
        tasks: {
          orderBy: { dueDate: 'asc' },
        },
      },
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json(contact);
  } catch (error) {
    console.error('Error fetching contact:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT update contact
router.put('/:id', async (req, res) => {
  try {
    const { name, email, phone, company, revenue, sector, stage, inPipeline, tags } = req.body;
    const updateData = {};
    const contactId = parseInt(req.params.id);

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

    res.json(contact);
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
router.delete('/:id', async (req, res) => {
  try {
    await prisma.contact.delete({
      where: { id: parseInt(req.params.id) },
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
