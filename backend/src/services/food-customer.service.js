const { ORDER_STATUS_LABELS } = require('../lib/food-orders');
const { normalizePhoneToE164 } = require('../lib/phone-normalization');
const { domainError } = require('../lib/food-domain');

function optionalText(value, max = 300) {
  const normalized = String(value || '').trim();
  return normalized ? normalized.slice(0, max) : null;
}

function parseJson(value, fallback) {
  try {
    const parsed = JSON.parse(value || '');
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch (_error) {
    return fallback;
  }
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeIdentityText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function parseTags(value) {
  const parsed = parseJson(value, []);
  return Array.isArray(parsed) ? parsed.map((tag) => String(tag).trim()).filter(Boolean) : [];
}

function normalizeFoodCustomerPreferences(input, existing = {}) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const list = (value) => [...new Set((Array.isArray(value) ? value : String(value || '').split(/[,;|]/)).map((item) => optionalText(item, 80)).filter(Boolean))].slice(0, 20);
  const channel = String(source.preferredChannel || existing.preferredChannel || 'WHATSAPP').toUpperCase();
  const orderType = String(source.preferredOrderType || existing.preferredOrderType || 'delivery').toLowerCase();
  return {
    ...existing,
    ...source,
    allergies: list(source.allergies),
    dietaryRestrictions: list(source.dietaryRestrictions),
    preferredChannel: ['WHATSAPP', 'SMS', 'EMAIL', 'NONE'].includes(channel) ? channel : 'WHATSAPP',
    preferredOrderType: ['delivery', 'pickup', 'dine_in'].includes(orderType) ? orderType : 'delivery',
    favoriteNotes: optionalText(source.favoriteNotes, 500),
  };
}

function normalizeContactId(value) {
  const contactId = Number(value);
  if (!Number.isInteger(contactId) || contactId <= 0) {
    throw domainError('Cliente inválido.', 400, 'FOOD_CUSTOMER_INVALID');
  }
  return contactId;
}

function serializeFoodCustomer(contact) {
  const { foodProfiles, ...customer } = contact;
  return { ...customer, foodProfile: foodProfiles?.[0] || null };
}

const foodCustomerInclude = (organizationId) => ({
  foodProfiles: {
    where: { organizationId },
    include: {
      addresses: {
        where: { active: true },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      },
      preferredBranch: true,
    },
  },
});

async function requireFoodCustomer(prisma, organizationId, value, options = {}) {
  const contactId = normalizeContactId(value);
  const contact = await prisma.contact.findFirst({
    where: {
      id: contactId,
      userId: organizationId,
      ...(options.includeArchived ? {} : { status: { not: 'inativo' } }),
    },
    include: foodCustomerInclude(organizationId),
  });
  if (!contact) throw domainError('Cliente não encontrado.', 404, 'FOOD_CUSTOMER_NOT_FOUND');
  return contact;
}

async function validatePreferredBranch(prisma, organizationId, branchId, canAccessBranch) {
  if (!branchId) return null;
  const branch = await prisma.foodBranch.findFirst({
    where: { id: branchId, userId: organizationId, active: true },
    select: { id: true },
  });
  if (!branch || (canAccessBranch && !canAccessBranch(branch.id))) {
    throw domainError('Unidade preferida inválida.', 400, 'FOOD_BRANCH_INVALID');
  }
  return branch.id;
}

async function getFoodCustomer(prisma, organizationId, contactId) {
  const customer = serializeFoodCustomer(await requireFoodCustomer(prisma, organizationId, contactId));
  const items = await prisma.foodOrderItem.findMany({
    where: { userId: organizationId, order: { contactId: customer.id, status: { not: 'cancelled' } } },
    select: { productId: true, productName: true, quantity: true },
    orderBy: { createdAt: 'desc' },
    take: 1000,
  });
  const totals = new Map();
  for (const item of items) {
    const key = item.productId || item.productName;
    const current = totals.get(key) || { productId: item.productId, name: item.productName, quantity: 0 };
    current.quantity += item.quantity;
    totals.set(key, current);
  }
  return {
    ...customer,
    insights: {
      favoriteProducts: [...totals.values()].sort((left, right) => right.quantity - left.quantity).slice(0, 5),
    },
  };
}

function normalizeCustomerFilters(input = {}) {
  const segment = ['new', 'recurring', 'vip', 'inactive', 'at_risk'].includes(String(input.segment)) ? String(input.segment) : 'all';
  const minimumNumber = (value) => Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;
  return {
    search: optionalText(input.search, 120),
    segment,
    zone: optionalText(input.zone, 120),
    tag: optionalText(input.tag, 40),
    marketingConsent: input.marketingConsent === 'true' || input.marketingConsent === true
      ? true
      : input.marketingConsent === 'false' || input.marketingConsent === false ? false : null,
    minOrders: minimumNumber(input.minOrders),
    minSpent: minimumNumber(input.minSpent),
  };
}

async function listFoodCustomers(prisma, organizationId, input = {}) {
  const filters = normalizeCustomerFilters(input);
  const profileFilters = { organizationId };
  if (filters.marketingConsent !== null) profileFilters.marketingConsent = filters.marketingConsent;
  if (filters.minOrders !== null) profileFilters.totalOrders = { gte: filters.minOrders };
  if (filters.minSpent !== null) profileFilters.totalSpent = { gte: filters.minSpent };
  if (filters.segment === 'new') profileFilters.totalOrders = { lte: 1 };
  if (filters.segment === 'recurring') profileFilters.totalOrders = { gte: 2 };
  if (filters.segment === 'vip') profileFilters.OR = [{ totalOrders: { gte: 5 } }, { totalSpent: { gte: 100000 } }];
  if (filters.segment === 'at_risk') {
    profileFilters.totalOrders = { gte: 2 };
    profileFilters.lastOrderAt = { lt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) };
  }
  if (filters.zone) {
    profileFilters.addresses = {
      some: {
        active: true,
        OR: [
          { neighborhood: { contains: filters.zone, mode: 'insensitive' } },
          { address: { contains: filters.zone, mode: 'insensitive' } },
        ],
      },
    };
  }

  const where = {
    userId: organizationId,
    status: filters.segment === 'inactive' ? 'inativo' : { not: 'inativo' },
    ...(filters.tag && { tags: { contains: `"${filters.tag}"`, mode: 'insensitive' } }),
  };
  const requiresProfile = Object.keys(profileFilters).length > 1;
  if (requiresProfile) where.foodProfiles = { some: profileFilters };
  if (filters.search) {
    const normalizedPhone = normalizePhoneToE164(filters.search) || filters.search.replace(/\s+/g, '');
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { phone: { contains: normalizedPhone, mode: 'insensitive' } },
      { email: { contains: filters.search, mode: 'insensitive' } },
      { company: { contains: filters.search, mode: 'insensitive' } },
      { location: { contains: filters.search, mode: 'insensitive' } },
      {
        foodProfiles: {
          some: {
            organizationId,
            addresses: {
              some: {
                active: true,
                OR: [
                  { address: { contains: filters.search, mode: 'insensitive' } },
                  { neighborhood: { contains: filters.search, mode: 'insensitive' } },
                  { reference: { contains: filters.search, mode: 'insensitive' } },
                ],
              },
            },
          },
        },
      },
    ];
  }

  const contacts = await prisma.contact.findMany({
    where,
    include: foodCustomerInclude(organizationId),
    orderBy: { updatedAt: 'desc' },
    take: 200,
  });
  return contacts.map(serializeFoodCustomer);
}

function duplicateReasons(left, right) {
  const reasons = [];
  const leftPhone = normalizePhoneToE164(left.phone);
  const rightPhone = normalizePhoneToE164(right.phone);
  if (leftPhone && rightPhone && leftPhone === rightPhone) reasons.push('phone');
  const leftEmail = normalizeEmail(left.email);
  const rightEmail = normalizeEmail(right.email);
  if (leftEmail && rightEmail && leftEmail === rightEmail) reasons.push('email');
  const sameName = normalizeIdentityText(left.name) && normalizeIdentityText(left.name) === normalizeIdentityText(right.name);
  const sameContext = [
    [left.company, right.company],
    [left.location, right.location],
  ].some(([a, b]) => normalizeIdentityText(a) && normalizeIdentityText(a) === normalizeIdentityText(b));
  if (sameName && sameContext) reasons.push('name_context');
  return reasons;
}

async function findFoodCustomerDuplicates(prisma, organizationId) {
  const contacts = await prisma.contact.findMany({
    where: { userId: organizationId, status: { not: 'inativo' } },
    include: foodCustomerInclude(organizationId),
    orderBy: { updatedAt: 'desc' },
    take: 1000,
  });
  const pairs = [];
  for (let leftIndex = 0; leftIndex < contacts.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < contacts.length; rightIndex += 1) {
      const reasons = duplicateReasons(contacts[leftIndex], contacts[rightIndex]);
      if (reasons.length) {
        pairs.push({
          id: `${contacts[leftIndex].id}:${contacts[rightIndex].id}`,
          reasons,
          customers: [serializeFoodCustomer(contacts[leftIndex]), serializeFoodCustomer(contacts[rightIndex])],
        });
      }
      if (pairs.length >= 100) return pairs;
    }
  }
  return pairs;
}

function mergedContactData(target, source) {
  const targetTags = parseTags(target.tags);
  const sourceTags = parseTags(source.tags);
  const tags = [...new Set([...targetTags, ...sourceTags, 'food'])].slice(0, 20);
  const targetCustom = parseJson(target.customFields, {});
  const sourceCustom = parseJson(source.customFields, {});
  return {
    email: target.email || source.email || '',
    company: target.company || source.company || '',
    location: target.location || source.location || null,
    birthDate: target.birthDate || source.birthDate || null,
    tags: JSON.stringify(tags),
    customFields: JSON.stringify({ ...sourceCustom, ...targetCustom }),
  };
}

async function mergeFoodCustomers(prisma, organizationId, targetIdValue, sourceIdValue) {
  const targetId = normalizeContactId(targetIdValue);
  const sourceId = normalizeContactId(sourceIdValue);
  if (targetId === sourceId) throw domainError('Selecione dois clientes diferentes.', 400, 'FOOD_CUSTOMER_MERGE_SAME');

  return prisma.$transaction(async (tx) => {
    const [target, source] = await Promise.all([
      requireFoodCustomer(tx, organizationId, targetId),
      requireFoodCustomer(tx, organizationId, sourceId),
    ]);
    const reasons = duplicateReasons(target, source);
    if (!reasons.length) throw domainError('Os clientes não possuem sinais fortes de duplicação.', 409, 'FOOD_CUSTOMER_MERGE_UNVERIFIED');

    const moved = {};
    const move = async (name, model, whereField, dataField = whereField) => {
      const result = await model.updateMany({ where: { [whereField]: sourceId }, data: { [dataField]: targetId } });
      moved[name] = result.count;
    };

    await move('notes', tx.contactNote, 'contactId');
    await move('messages', tx.message, 'contactId');
    await move('tasks', tx.task, 'contactId');
    await move('automationAlerts', tx.automationAlert, 'contactId');
    await move('automationLogs', tx.automationLog, 'contact_id');
    await move('formSubmissions', tx.formSubmission, 'contactId');
    await move('transactions', tx.transaction, 'clientId');
    await move('calendarEvents', tx.calendarEvent, 'contactId');
    await move('orders', tx.foodOrder, 'contactId');
    await move('couponRedemptions', tx.foodCouponRedemption, 'contactId');
    await move('billingCustomers', tx.clienteFaturacao, 'contactId');
    await move('campaignRecipients', tx.messagingCampaignRecipient, 'contactId');
    await move('messageLogs', tx.messagingMessageLog, 'contactId');

    const sourceStakeholders = await tx.dealStakeholder.findMany({ where: { contactId: sourceId } });
    moved.dealStakeholders = 0;
    for (const stakeholder of sourceStakeholders) {
      const existing = await tx.dealStakeholder.findUnique({
        where: { dealId_contactId: { dealId: stakeholder.dealId, contactId: targetId } },
      });
      if (existing) {
        await tx.dealStakeholder.delete({ where: { id: stakeholder.id } });
      } else {
        await tx.dealStakeholder.update({ where: { id: stakeholder.id }, data: { contactId: targetId } });
      }
      moved.dealStakeholders += 1;
    }

    const targetProfile = target.foodProfiles[0];
    const sourceProfile = source.foodProfiles[0];
    if (!targetProfile && sourceProfile) {
      await tx.foodCustomerProfile.update({ where: { id: sourceProfile.id }, data: { contactId: targetId } });
    } else if (targetProfile && sourceProfile) {
      await tx.foodCustomerAddress.updateMany({
        where: { organizationId, profileId: sourceProfile.id, active: true },
        data: { profileId: targetProfile.id, isPrimary: false },
      });
      const preferences = {
        ...(sourceProfile.preferences && typeof sourceProfile.preferences === 'object' ? sourceProfile.preferences : {}),
        ...(targetProfile.preferences && typeof targetProfile.preferences === 'object' ? targetProfile.preferences : {}),
      };
      const notes = [targetProfile.notes, sourceProfile.notes && `Origem consolidada: ${sourceProfile.notes}`].filter(Boolean).join('\n\n') || null;
      await tx.foodCustomerProfile.update({
        where: { id: targetProfile.id },
        data: { preferences, notes },
      });
      await tx.foodCustomerProfile.update({
        where: { id: sourceProfile.id },
        data: { marketingConsent: false, transactionalConsent: false, totalOrders: 0, totalSpent: 0, lastOrderAt: null },
      });
    }

    const stats = await tx.foodOrder.aggregate({
      where: { userId: organizationId, contactId: targetId, status: { not: 'cancelled' } },
      _count: { id: true },
      _sum: { total: true },
      _max: { createdAt: true },
    });
    const currentTargetProfile = await tx.foodCustomerProfile.findUnique({
      where: { organizationId_contactId: { organizationId, contactId: targetId } },
    });
    if (currentTargetProfile) {
      await tx.foodCustomerProfile.update({
        where: { id: currentTargetProfile.id },
        data: { totalOrders: stats._count.id || 0, totalSpent: stats._sum.total || 0, lastOrderAt: stats._max.createdAt },
      });
      const primaryAddress = await tx.foodCustomerAddress.findFirst({
        where: { organizationId, profileId: currentTargetProfile.id, active: true, isPrimary: true },
      });
      if (!primaryAddress) {
        const firstAddress = await tx.foodCustomerAddress.findFirst({
          where: { organizationId, profileId: currentTargetProfile.id, active: true },
          orderBy: { createdAt: 'asc' },
        });
        if (firstAddress) await tx.foodCustomerAddress.update({ where: { id: firstAddress.id }, data: { isPrimary: true } });
      }
    }

    await tx.contact.update({ where: { id: targetId }, data: mergedContactData(target, source) });
    const sourceCustomFields = parseJson(source.customFields, {});
    await tx.contact.update({
      where: { id: sourceId },
      data: {
        status: 'inativo',
        inPipeline: false,
        customFields: JSON.stringify({ ...sourceCustomFields, foodMergedIntoContactId: targetId }),
      },
    });

    return {
      customer: await getFoodCustomer(tx, organizationId, targetId),
      sourceContactId: sourceId,
      reasons,
      moved,
    };
  });
}

function normalizeImportTags(value) {
  const values = Array.isArray(value) ? value : String(value || '').split(/[,;|]/);
  return [...new Set(['food', ...values.map((tag) => optionalText(tag, 40)).filter(Boolean)])].slice(0, 20);
}

function normalizeImportConsent(value) {
  if (typeof value === 'boolean') return value;
  return ['sim', 'yes', 'true', '1', 'autorizado'].includes(normalizeIdentityText(value));
}

function normalizeImportBirthDate(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const match = text.match(/^(\d{4})[-/]?(\d{2})[-/]?(\d{2})$/) || text.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (!match) return undefined;
  const iso = match[1].length === 4 ? `${match[1]}-${match[2]}-${match[3]}` : `${match[3]}-${match[2]}-${match[1]}`;
  const date = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso) return undefined;
  return iso;
}

async function previewFoodCustomerImport(prisma, organizationId, rawRows, options = {}) {
  const maxRows = Math.min(5000, Number.isFinite(Number(options.maxRows)) ? Number(options.maxRows) : 5000);
  if (!Array.isArray(rawRows) || rawRows.length === 0) throw domainError('O ficheiro não contém linhas para importar.');
  if (rawRows.length > maxRows) throw domainError(`O ficheiro excede o limite de ${maxRows} linhas.`, 413, 'FOOD_CUSTOMER_IMPORT_LIMIT');

  const existingContacts = await prisma.contact.findMany({
    where: { userId: organizationId },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, name: true, phone: true, email: true, status: true },
  });
  const existingByPhone = new Map();
  for (const contact of existingContacts) {
    const phone = normalizePhoneToE164(contact.phone);
    if (phone && !existingByPhone.has(phone)) existingByPhone.set(phone, contact);
  }

  const seenPhones = new Map();
  const rows = rawRows.map((raw, index) => {
    const errors = [];
    const name = optionalText(raw?.name, 180);
    const phone = normalizePhoneToE164(raw?.phone);
    const email = optionalText(raw?.email, 180)?.toLowerCase() || '';
    const birthDate = normalizeImportBirthDate(raw?.birthDate);
    if (!name) errors.push('Nome obrigatório.');
    if (!phone) errors.push('Telefone angolano inválido.');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Email inválido.');
    if (birthDate === undefined) errors.push('Data de nascimento inválida.');

    const data = {
      name: name || '',
      phone: phone || String(raw?.phone || '').trim(),
      email,
      company: optionalText(raw?.company, 180) || '',
      location: optionalText(raw?.location, 240),
      birthDate: birthDate || null,
      tags: normalizeImportTags(raw?.tags),
      notes: optionalText(raw?.notes, 1000),
      marketingConsent: normalizeImportConsent(raw?.marketingConsent),
    };
    let status = errors.length ? 'invalid' : 'valid';
    let existingCustomer = null;
    if (!errors.length && phone) {
      if (seenPhones.has(phone)) {
        status = 'duplicate_file';
        errors.push(`Telefone repetido na linha ${seenPhones.get(phone)}.`);
      } else {
        seenPhones.set(phone, index + 2);
        const existing = existingByPhone.get(phone);
        if (existing) {
          status = existing.status === 'inativo' ? 'existing_inactive' : 'existing';
          existingCustomer = existing;
        }
      }
    }
    return { rowNumber: index + 2, status, data, errors, existingCustomer };
  });

  const summary = rows.reduce((result, row) => {
    result[row.status] = (result[row.status] || 0) + 1;
    return result;
  }, { total: rows.length, valid: 0, invalid: 0, duplicate_file: 0, existing: 0, existing_inactive: 0 });
  return { rows, summary, maxRows };
}

async function commitFoodCustomerImport(prisma, organizationId, rawRows, strategy, options = {}) {
  if (!['skip', 'update'].includes(strategy)) throw domainError('Estratégia de conflito inválida.');
  const preview = await previewFoodCustomerImport(prisma, organizationId, rawRows, options);
  const processable = preview.rows.filter((row) => row.status === 'valid' || (row.status === 'existing' && strategy === 'update'));
  const result = await prisma.$transaction(async (tx) => {
    let imported = 0;
    let updated = 0;
    for (const row of processable) {
      const data = row.data;
      if (row.status === 'valid') {
        const contact = await tx.contact.create({
          data: {
            userId: organizationId,
            name: data.name,
            phone: data.phone,
            email: data.email,
            company: data.company,
            location: data.location,
            birthDate: data.birthDate ? new Date(`${data.birthDate}T00:00:00.000Z`) : null,
            contactType: 'cliente',
            status: 'ativo',
            stage: 'Cliente Food',
            inPipeline: false,
            tags: JSON.stringify(data.tags),
          },
        });
        await tx.foodCustomerProfile.create({
          data: {
            organizationId,
            contactId: contact.id,
            marketingConsent: data.marketingConsent,
            transactionalConsent: true,
            notes: data.notes,
          },
        });
        imported += 1;
      } else {
        const contactId = row.existingCustomer.id;
        const existing = await tx.contact.findFirst({ where: { id: contactId, userId: organizationId, status: { not: 'inativo' } } });
        if (!existing) throw domainError(`O cliente da linha ${row.rowNumber} foi alterado durante a importação.`, 409, 'FOOD_CUSTOMER_IMPORT_CONFLICT');
        const tags = [...new Set([...parseTags(existing.tags), ...data.tags])].slice(0, 20);
        await tx.contact.update({
          where: { id: contactId },
          data: {
            name: data.name || existing.name,
            email: data.email || existing.email,
            company: data.company || existing.company,
            location: data.location || existing.location,
            birthDate: data.birthDate ? new Date(`${data.birthDate}T00:00:00.000Z`) : existing.birthDate,
            tags: JSON.stringify(tags),
          },
        });
        await tx.foodCustomerProfile.upsert({
          where: { organizationId_contactId: { organizationId, contactId } },
          update: {
            marketingConsent: data.marketingConsent,
            ...(data.notes && { notes: data.notes }),
          },
          create: {
            organizationId,
            contactId,
            marketingConsent: data.marketingConsent,
            transactionalConsent: true,
            notes: data.notes,
          },
        });
        updated += 1;
      }
    }
    return { imported, updated };
  });

  return {
    ...result,
    skipped: preview.summary.existing + preview.summary.existing_inactive + preview.summary.duplicate_file - result.updated,
    invalid: preview.summary.invalid,
    total: preview.summary.total,
    errors: preview.rows.filter((row) => row.status === 'invalid' || row.status === 'duplicate_file' || row.status === 'existing_inactive'),
  };
}

async function updateFoodCustomer(prisma, context, contactIdValue, input = {}) {
  const organizationId = context.organizationId;
  const existing = await requireFoodCustomer(prisma, organizationId, contactIdValue);
  const contactId = existing.id;
  const contactData = {};

  if (input.name !== undefined) {
    const name = optionalText(input.name, 180);
    if (!name) throw domainError('Nome do cliente é obrigatório.');
    contactData.name = name;
  }
  if (input.phone !== undefined) {
    const phone = normalizePhoneToE164(input.phone);
    if (!phone) throw domainError('Telefone angolano inválido. Use 9XXXXXXXX, 2449XXXXXXXX ou +244 9XXXXXXXX.');
    const duplicate = await prisma.contact.findFirst({
      where: { userId: organizationId, phone, id: { not: contactId } },
      select: { id: true },
    });
    if (duplicate) throw domainError('Já existe outro cliente com este telefone.', 409, 'FOOD_CUSTOMER_PHONE_DUPLICATE');
    contactData.phone = phone;
  }
  if (input.email !== undefined) contactData.email = optionalText(input.email, 180) || '';
  if (input.company !== undefined) contactData.company = optionalText(input.company, 180) || '';
  if (input.location !== undefined) contactData.location = optionalText(input.location, 240);
  if (input.birthDate !== undefined) {
    if (!input.birthDate) {
      contactData.birthDate = null;
    } else {
      const birthDate = new Date(`${String(input.birthDate).slice(0, 10)}T00:00:00.000Z`);
      if (Number.isNaN(birthDate.getTime())) throw domainError('Data de nascimento inválida.');
      contactData.birthDate = birthDate;
    }
  }
  if (input.tags !== undefined) {
    const tags = Array.isArray(input.tags)
      ? [...new Set(input.tags.map((tag) => optionalText(tag, 40)).filter(Boolean))].slice(0, 20)
      : [];
    contactData.tags = JSON.stringify(tags);
  }

  const profileData = {};
  if (input.marketingConsent !== undefined) profileData.marketingConsent = input.marketingConsent === true;
  if (input.transactionalConsent !== undefined) profileData.transactionalConsent = input.transactionalConsent === true;
  if (input.preferences !== undefined) {
    const currentPreferences = existing.foodProfiles[0]?.preferences && typeof existing.foodProfiles[0].preferences === 'object'
      ? existing.foodProfiles[0].preferences
      : {};
    profileData.preferences = normalizeFoodCustomerPreferences(input.preferences, currentPreferences);
  }
  if (input.notes !== undefined) profileData.notes = optionalText(input.notes, 1000);
  if (input.preferredBranchId !== undefined) {
    profileData.preferredBranchId = await validatePreferredBranch(
      prisma,
      organizationId,
      optionalText(input.preferredBranchId, 80),
      context.canAccessBranch
    );
  }

  await prisma.$transaction(async (tx) => {
    if (Object.keys(contactData).length) {
      await tx.contact.update({ where: { id: contactId }, data: contactData });
    }
    if (Object.keys(profileData).length) {
      await tx.foodCustomerProfile.upsert({
        where: { organizationId_contactId: { organizationId, contactId } },
        update: profileData,
        create: { organizationId, contactId, ...profileData },
      });
    }
  });

  return {
    customer: await getFoodCustomer(prisma, organizationId, contactId),
    changedFields: [...Object.keys(contactData), ...Object.keys(profileData)],
  };
}

async function archiveFoodCustomer(prisma, organizationId, contactIdValue) {
  const contact = await requireFoodCustomer(prisma, organizationId, contactIdValue);
  const profile = contact.foodProfiles[0];
  await prisma.$transaction(async (tx) => {
    await tx.contact.update({ where: { id: contact.id }, data: { status: 'inativo' } });
    if (profile) {
      await tx.foodCustomerAddress.updateMany({
        where: { organizationId, profileId: profile.id, active: true },
        data: { active: false, isPrimary: false },
      });
    }
  });
  return { contactId: contact.id, profileId: profile?.id || null };
}

async function requireFoodCustomerProfile(prisma, organizationId, contactIdValue) {
  const contact = await requireFoodCustomer(prisma, organizationId, contactIdValue);
  const profile = contact.foodProfiles[0];
  if (!profile) throw domainError('Perfil Food do cliente não encontrado.', 404, 'FOOD_CUSTOMER_PROFILE_NOT_FOUND');
  return { contact, profile };
}

function addressData(input, { partial = false } = {}) {
  const data = {};
  const optionalCoordinate = (value) => {
    if (value === undefined || value === null || value === '') return null;
    return Number.isFinite(Number(value)) ? Number(value) : null;
  };
  if (!partial || input.address !== undefined) {
    const address = optionalText(input.address, 400);
    if (!address) throw domainError('Morada é obrigatória.');
    data.address = address;
  }
  if (!partial || input.label !== undefined) data.label = optionalText(input.label, 60) || 'Principal';
  if (!partial || input.neighborhood !== undefined) data.neighborhood = optionalText(input.neighborhood, 160);
  if (!partial || input.reference !== undefined) data.reference = optionalText(input.reference, 300);
  if (!partial || input.latitude !== undefined) data.latitude = optionalCoordinate(input.latitude);
  if (!partial || input.longitude !== undefined) data.longitude = optionalCoordinate(input.longitude);
  if (input.isPrimary !== undefined) data.isPrimary = input.isPrimary === true;
  return data;
}

async function createFoodCustomerAddress(prisma, organizationId, contactIdValue, input = {}) {
  const { profile } = await requireFoodCustomerProfile(prisma, organizationId, contactIdValue);
  const data = addressData(input);
  return prisma.$transaction(async (tx) => {
    const activeCount = await tx.foodCustomerAddress.count({ where: { organizationId, profileId: profile.id, active: true } });
    data.isPrimary = data.isPrimary === true || activeCount === 0;
    if (data.isPrimary) {
      await tx.foodCustomerAddress.updateMany({ where: { organizationId, profileId: profile.id }, data: { isPrimary: false } });
    }
    return tx.foodCustomerAddress.create({ data: { organizationId, profileId: profile.id, ...data } });
  });
}

async function updateFoodCustomerAddress(prisma, organizationId, contactIdValue, addressId, input = {}) {
  const { profile } = await requireFoodCustomerProfile(prisma, organizationId, contactIdValue);
  const address = await prisma.foodCustomerAddress.findFirst({
    where: { id: addressId, organizationId, profileId: profile.id, active: true },
  });
  if (!address) throw domainError('Morada não encontrada.', 404, 'FOOD_CUSTOMER_ADDRESS_NOT_FOUND');
  const data = addressData(input, { partial: true });
  return prisma.$transaction(async (tx) => {
    if (data.isPrimary === true) {
      await tx.foodCustomerAddress.updateMany({ where: { organizationId, profileId: profile.id }, data: { isPrimary: false } });
    }
    const updated = await tx.foodCustomerAddress.update({ where: { id: address.id }, data });
    if (updated.isPrimary === false && address.isPrimary) {
      const replacement = await tx.foodCustomerAddress.findFirst({
        where: { organizationId, profileId: profile.id, active: true, id: { not: address.id } },
        orderBy: { createdAt: 'asc' },
      });
      if (replacement) await tx.foodCustomerAddress.update({ where: { id: replacement.id }, data: { isPrimary: true } });
    }
    return updated;
  });
}

async function archiveFoodCustomerAddress(prisma, organizationId, contactIdValue, addressId) {
  const { profile } = await requireFoodCustomerProfile(prisma, organizationId, contactIdValue);
  const address = await prisma.foodCustomerAddress.findFirst({
    where: { id: addressId, organizationId, profileId: profile.id, active: true },
  });
  if (!address) throw domainError('Morada não encontrada.', 404, 'FOOD_CUSTOMER_ADDRESS_NOT_FOUND');
  await prisma.$transaction(async (tx) => {
    await tx.foodCustomerAddress.update({ where: { id: address.id }, data: { active: false, isPrimary: false } });
    if (address.isPrimary) {
      const replacement = await tx.foodCustomerAddress.findFirst({
        where: { organizationId, profileId: profile.id, active: true, id: { not: address.id } },
        orderBy: { createdAt: 'asc' },
      });
      if (replacement) await tx.foodCustomerAddress.update({ where: { id: replacement.id }, data: { isPrimary: true } });
    }
  });
  return { addressId: address.id, profileId: profile.id };
}

function normalizeSearch(value) {
  return String(value || '').trim().slice(0, 120);
}

async function searchFoodCustomers(prisma, organizationId, value) {
  const search = normalizeSearch(value);
  if (search.length < 2) return [];
  const normalizedPhone = normalizePhoneToE164(search) || search.replace(/\s+/g, '');
  const contacts = await prisma.contact.findMany({
    where: {
      userId: organizationId,
      status: { not: 'inativo' },
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: normalizedPhone, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
      ],
    },
    orderBy: { updatedAt: 'desc' },
    take: 12,
    select: { id: true, name: true, phone: true, email: true, location: true, company: true },
  });
  return Promise.all(contacts.map(async (contact) => {
    const [stats, lastOrder] = await Promise.all([
      prisma.foodOrder.aggregate({
        where: { userId: organizationId, contactId: contact.id, status: { not: 'cancelled' } },
        _count: { id: true },
        _sum: { total: true },
      }),
      prisma.foodOrder.findFirst({
        where: { userId: organizationId, contactId: contact.id },
        orderBy: { createdAt: 'desc' },
        select: { id: true, orderNumber: true, total: true, createdAt: true, status: true },
      }),
    ]);
    return {
      ...contact,
      totalOrders: stats._count.id || 0,
      totalSpent: stats._sum.total || 0,
      lastOrder: lastOrder ? {
        ...lastOrder,
        displayNumber: `#${String(lastOrder.orderNumber).padStart(4, '0')}`,
        statusLabel: ORDER_STATUS_LABELS[lastOrder.status] || lastOrder.status,
      } : null,
    };
  }));
}

module.exports = {
  normalizeSearch,
  searchFoodCustomers,
  listFoodCustomers,
  findFoodCustomerDuplicates,
  mergeFoodCustomers,
  previewFoodCustomerImport,
  commitFoodCustomerImport,
  normalizeFoodCustomerPreferences,
  getFoodCustomer,
  updateFoodCustomer,
  archiveFoodCustomer,
  createFoodCustomerAddress,
  updateFoodCustomerAddress,
  archiveFoodCustomerAddress,
};
