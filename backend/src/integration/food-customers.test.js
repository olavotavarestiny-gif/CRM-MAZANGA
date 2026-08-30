const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

test('CRM Food isola clientes, normaliza telefone e arquiva sem apagar pedidos', { skip: !testDatabaseUrl }, async () => {
  process.env.DATABASE_URL = testDatabaseUrl;
  const { PrismaClient } = require('@prisma/client');
  const {
    getFoodCustomer,
    updateFoodCustomer,
    archiveFoodCustomer,
    createFoodCustomerAddress,
    updateFoodCustomerAddress,
    archiveFoodCustomerAddress,
  } = require('../services/food-customer.service');
  const prisma = new PrismaClient();
  const suffix = crypto.randomUUID();
  const createdContactIds = [];
  const createdUserIds = [];

  try {
    const ownerA = await prisma.user.create({ data: { name: 'CRM Food A', email: `crm-food-a-${suffix}@example.test`, workspaceMode: 'food' } });
    const ownerB = await prisma.user.create({ data: { name: 'CRM Food B', email: `crm-food-b-${suffix}@example.test`, workspaceMode: 'food' } });
    createdUserIds.push(ownerA.id, ownerB.id);

    const branchA = await prisma.foodBranch.create({ data: { userId: ownerA.id, name: 'Unidade CRM A', isMain: true, createdByUserId: ownerA.id } });
    const branchB = await prisma.foodBranch.create({ data: { userId: ownerB.id, name: 'Unidade CRM B', isMain: true, createdByUserId: ownerB.id } });
    const customerA = await prisma.contact.create({ data: { userId: ownerA.id, name: 'Cliente A', phone: '+244923400001', email: '', company: '', status: 'ativo' } });
    const duplicateA = await prisma.contact.create({ data: { userId: ownerA.id, name: 'Cliente Duplicado', phone: '+244923400002', email: '', company: '', status: 'ativo' } });
    const customerB = await prisma.contact.create({ data: { userId: ownerB.id, name: 'Cliente B', phone: '+244923400003', email: '', company: '', status: 'ativo' } });
    createdContactIds.push(customerA.id, duplicateA.id, customerB.id);

    await prisma.foodCustomerProfile.create({ data: { organizationId: ownerA.id, contactId: customerA.id } });
    const profileB = await prisma.foodCustomerProfile.create({ data: { organizationId: ownerB.id, contactId: customerB.id } });
    const foreignAddress = await prisma.foodCustomerAddress.create({ data: { organizationId: ownerB.id, profileId: profileB.id, label: 'B', address: 'Morada B', isPrimary: true } });
    const order = await prisma.foodOrder.create({
      data: {
        userId: ownerA.id,
        branchId: branchA.id,
        contactId: customerA.id,
        orderNumber: 1,
        status: 'completed',
        orderState: 'completed',
        kitchenState: 'ready',
        deliveryState: 'not_required',
        paymentState: 'paid',
        orderType: 'pickup',
        customerName: customerA.name,
        customerPhone: customerA.phone,
        total: 2500,
      },
    });

    assert.equal((await getFoodCustomer(prisma, ownerA.id, customerA.id)).id, customerA.id);
    await assert.rejects(
      getFoodCustomer(prisma, ownerB.id, customerA.id),
      (error) => error.code === 'FOOD_CUSTOMER_NOT_FOUND'
    );

    const contextA = { organizationId: ownerA.id, canAccessBranch: (branchId) => branchId === branchA.id };
    const updated = await updateFoodCustomer(prisma, contextA, customerA.id, {
      name: 'Cliente A Editado',
      phone: '923 400 004',
      preferredBranchId: branchA.id,
      marketingConsent: true,
      notes: 'Sem cebola',
    });
    assert.equal(updated.customer.phone, '+244923400004');
    assert.equal(updated.customer.foodProfile.preferredBranchId, branchA.id);
    assert.equal(updated.customer.foodProfile.marketingConsent, true);

    await assert.rejects(
      updateFoodCustomer(prisma, contextA, customerA.id, { phone: '923400002' }),
      (error) => error.code === 'FOOD_CUSTOMER_PHONE_DUPLICATE'
    );
    await assert.rejects(
      updateFoodCustomer(prisma, contextA, customerA.id, { preferredBranchId: branchB.id }),
      (error) => error.code === 'FOOD_BRANCH_INVALID'
    );
    await assert.rejects(
      updateFoodCustomer(prisma, { organizationId: ownerB.id, canAccessBranch: () => true }, customerA.id, { name: 'Ataque tenant' }),
      (error) => error.code === 'FOOD_CUSTOMER_NOT_FOUND'
    );

    const firstAddress = await createFoodCustomerAddress(prisma, ownerA.id, customerA.id, { label: 'Casa', address: 'Rua 1' });
    assert.equal(firstAddress.isPrimary, true);
    const secondAddress = await createFoodCustomerAddress(prisma, ownerA.id, customerA.id, { label: 'Trabalho', address: 'Rua 2', isPrimary: true });
    assert.equal(secondAddress.isPrimary, true);
    assert.equal((await prisma.foodCustomerAddress.findUnique({ where: { id: firstAddress.id } })).isPrimary, false);

    await assert.rejects(
      updateFoodCustomerAddress(prisma, ownerA.id, customerA.id, foreignAddress.id, { address: 'Morada indevida' }),
      (error) => error.code === 'FOOD_CUSTOMER_ADDRESS_NOT_FOUND'
    );
    await archiveFoodCustomerAddress(prisma, ownerA.id, customerA.id, secondAddress.id);
    assert.equal((await prisma.foodCustomerAddress.findUnique({ where: { id: firstAddress.id } })).isPrimary, true);
    assert.equal((await prisma.foodCustomerAddress.findUnique({ where: { id: secondAddress.id } })).active, false);

    await archiveFoodCustomer(prisma, ownerA.id, customerA.id);
    assert.equal((await prisma.contact.findUnique({ where: { id: customerA.id } })).status, 'inativo');
    assert.equal(await prisma.foodCustomerAddress.count({ where: { organizationId: ownerA.id, profileId: firstAddress.profileId, active: true } }), 0);
    assert.equal((await prisma.foodOrder.findUnique({ where: { id: order.id } })).contactId, customerA.id);
    await assert.rejects(
      getFoodCustomer(prisma, ownerA.id, customerA.id),
      (error) => error.code === 'FOOD_CUSTOMER_NOT_FOUND'
    );
  } finally {
    if (createdContactIds.length) await prisma.contact.deleteMany({ where: { id: { in: createdContactIds } } });
    if (createdUserIds.length) await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  }
});

test('CRM Food filtra segmentos e consolida duplicados preservando relações', { skip: !testDatabaseUrl }, async () => {
  process.env.DATABASE_URL = testDatabaseUrl;
  const { PrismaClient } = require('@prisma/client');
  const {
    listFoodCustomers,
    findFoodCustomerDuplicates,
    mergeFoodCustomers,
  } = require('../services/food-customer.service');
  const prisma = new PrismaClient();
  const suffix = crypto.randomUUID();
  const createdContactIds = [];
  const createdUserIds = [];

  try {
    const owner = await prisma.user.create({ data: { name: 'Merge Food', email: `merge-food-${suffix}@example.test`, workspaceMode: 'food' } });
    const otherOwner = await prisma.user.create({ data: { name: 'Merge Food B', email: `merge-food-b-${suffix}@example.test`, workspaceMode: 'food' } });
    createdUserIds.push(owner.id, otherOwner.id);
    const branch = await prisma.foodBranch.create({ data: { userId: owner.id, name: 'Unidade Merge', isMain: true, createdByUserId: owner.id } });
    const target = await prisma.contact.create({
      data: { userId: owner.id, name: 'Ana Cliente', phone: '+244923555001', email: 'ana@example.test', company: '', status: 'ativo', tags: JSON.stringify(['food', 'VIP']) },
    });
    const source = await prisma.contact.create({
      data: { userId: owner.id, name: 'Ana Cliente Duplicada', phone: '923555001', email: '', company: 'Empresa Ana', status: 'ativo', tags: JSON.stringify(['food', 'almoço']) },
    });
    const unrelated = await prisma.contact.create({
      data: { userId: owner.id, name: 'Outro Cliente', phone: '+244923555002', email: '', company: '', status: 'ativo' },
    });
    const foreign = await prisma.contact.create({
      data: { userId: otherOwner.id, name: 'Ana Externa', phone: '923555001', email: 'ana@example.test', company: '', status: 'ativo' },
    });
    createdContactIds.push(target.id, source.id, unrelated.id, foreign.id);

    const targetProfile = await prisma.foodCustomerProfile.create({
      data: { organizationId: owner.id, contactId: target.id, totalOrders: 5, totalSpent: 125000, marketingConsent: true, notes: 'Nota principal' },
    });
    const sourceProfile = await prisma.foodCustomerProfile.create({
      data: { organizationId: owner.id, contactId: source.id, totalOrders: 1, totalSpent: 3000, marketingConsent: false, notes: 'Nota duplicada' },
    });
    await prisma.foodCustomerAddress.create({
      data: { organizationId: owner.id, profileId: sourceProfile.id, label: 'Casa', address: 'Rua do Kilamba', neighborhood: 'Kilamba', isPrimary: true },
    });
    await prisma.foodOrder.createMany({ data: [
      { userId: owner.id, branchId: branch.id, contactId: target.id, orderNumber: 1, status: 'completed', orderState: 'completed', kitchenState: 'ready', deliveryState: 'not_required', paymentState: 'paid', orderType: 'pickup', customerName: target.name, customerPhone: target.phone, total: 2000 },
      { userId: owner.id, branchId: branch.id, contactId: source.id, orderNumber: 2, status: 'completed', orderState: 'completed', kitchenState: 'ready', deliveryState: 'not_required', paymentState: 'paid', orderType: 'pickup', customerName: source.name, customerPhone: source.phone, total: 3000 },
    ] });
    const note = await prisma.contactNote.create({ data: { contactId: source.id, userId: owner.id, content: 'Histórico CRM' } });
    const task = await prisma.task.create({ data: { contactId: source.id, userId: owner.id, title: 'Ligar ao cliente' } });

    assert.deepEqual((await listFoodCustomers(prisma, owner.id, { segment: 'vip' })).map((item) => item.id), [target.id]);
    assert.deepEqual((await listFoodCustomers(prisma, owner.id, { tag: 'VIP' })).map((item) => item.id), [target.id]);
    assert.deepEqual((await listFoodCustomers(prisma, owner.id, { zone: 'Kilamba' })).map((item) => item.id), [source.id]);

    const pairs = await findFoodCustomerDuplicates(prisma, owner.id);
    assert.equal(pairs.length, 1);
    assert.deepEqual(new Set(pairs[0].customers.map((item) => item.id)), new Set([target.id, source.id]));
    assert.ok(pairs[0].reasons.includes('phone'));
    assert.equal((await findFoodCustomerDuplicates(prisma, otherOwner.id)).length, 0);

    await assert.rejects(
      mergeFoodCustomers(prisma, owner.id, target.id, foreign.id),
      (error) => error.code === 'FOOD_CUSTOMER_NOT_FOUND'
    );
    await assert.rejects(
      mergeFoodCustomers(prisma, owner.id, target.id, unrelated.id),
      (error) => error.code === 'FOOD_CUSTOMER_MERGE_UNVERIFIED'
    );

    const merged = await mergeFoodCustomers(prisma, owner.id, target.id, source.id);
    assert.equal(merged.customer.id, target.id);
    assert.equal(merged.sourceContactId, source.id);
    assert.equal(merged.moved.orders, 1);
    assert.equal((await prisma.contact.findUnique({ where: { id: source.id } })).status, 'inativo');
    assert.equal((await prisma.contactNote.findUnique({ where: { id: note.id } })).contactId, target.id);
    assert.equal((await prisma.task.findUnique({ where: { id: task.id } })).contactId, target.id);
    assert.equal(await prisma.foodOrder.count({ where: { userId: owner.id, contactId: target.id } }), 2);
    const refreshedProfile = await prisma.foodCustomerProfile.findUnique({ where: { id: targetProfile.id }, include: { addresses: true } });
    assert.equal(refreshedProfile.totalOrders, 2);
    assert.equal(refreshedProfile.totalSpent, 5000);
    assert.equal(refreshedProfile.addresses.length, 1);
    assert.equal(refreshedProfile.addresses[0].isPrimary, true);
    assert.match(refreshedProfile.notes, /Nota duplicada/);
    assert.deepEqual(new Set(JSON.parse((await prisma.contact.findUnique({ where: { id: target.id } })).tags)), new Set(['food', 'VIP', 'almoço']));
    assert.equal((await findFoodCustomerDuplicates(prisma, owner.id)).length, 0);
    assert.deepEqual((await listFoodCustomers(prisma, owner.id, { segment: 'inactive' })).map((item) => item.id), [source.id]);
  } finally {
    if (createdContactIds.length) await prisma.contact.deleteMany({ where: { id: { in: createdContactIds } } });
    if (createdUserIds.length) await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  }
});

test('Importação CSV Food valida linhas, conflitos e isolamento antes de confirmar', { skip: !testDatabaseUrl }, async () => {
  process.env.DATABASE_URL = testDatabaseUrl;
  const { PrismaClient } = require('@prisma/client');
  const {
    previewFoodCustomerImport,
    commitFoodCustomerImport,
  } = require('../services/food-customer.service');
  const prisma = new PrismaClient();
  const suffix = crypto.randomUUID();
  const createdContactIds = [];
  const createdUserIds = [];

  try {
    const owner = await prisma.user.create({ data: { name: 'Import Food', email: `import-food-${suffix}@example.test`, workspaceMode: 'food' } });
    const otherOwner = await prisma.user.create({ data: { name: 'Import Food B', email: `import-food-b-${suffix}@example.test`, workspaceMode: 'food' } });
    createdUserIds.push(owner.id, otherOwner.id);
    const existing = await prisma.contact.create({
      data: { userId: owner.id, name: 'Cliente Existente', phone: '923600001', email: '', company: '', status: 'ativo', tags: JSON.stringify(['food']) },
    });
    const foreign = await prisma.contact.create({
      data: { userId: otherOwner.id, name: 'Cliente Externo', phone: '+244923600009', email: '', company: '', status: 'ativo' },
    });
    createdContactIds.push(existing.id, foreign.id);
    await prisma.foodCustomerProfile.create({ data: { organizationId: owner.id, contactId: existing.id } });

    const rows = [
      { name: 'Existente Actualizado', phone: '+244 923 600 001', tags: 'VIP', marketingConsent: 'sim' },
      { name: 'Cliente Novo', phone: '923600002', email: 'novo@example.test', birthDate: '1990-05-20', tags: 'almoço;empresa' },
      { name: 'Repetido', phone: '+244923600002' },
      { name: '', phone: '123', email: 'email-invalido', birthDate: '31/02/2020' },
    ];
    const preview = await previewFoodCustomerImport(prisma, owner.id, rows, { maxRows: 5000 });
    assert.equal(preview.summary.total, 4);
    assert.equal(preview.summary.existing, 1);
    assert.equal(preview.summary.valid, 1);
    assert.equal(preview.summary.duplicate_file, 1);
    assert.equal(preview.summary.invalid, 1);
    assert.equal(preview.rows[0].existingCustomer.id, existing.id);
    assert.equal(preview.rows[1].data.phone, '+244923600002');
    assert.deepEqual(new Set(preview.rows[1].data.tags), new Set(['food', 'almoço', 'empresa']));

    const foreignPhoneForOwner = await previewFoodCustomerImport(prisma, owner.id, [{ name: 'Pode importar', phone: foreign.phone }]);
    assert.equal(foreignPhoneForOwner.summary.valid, 1);
    await assert.rejects(
      previewFoodCustomerImport(prisma, owner.id, rows, { maxRows: 2 }),
      (error) => error.code === 'FOOD_CUSTOMER_IMPORT_LIMIT'
    );

    const skipped = await commitFoodCustomerImport(prisma, owner.id, rows, 'skip', { maxRows: 5000 });
    assert.equal(skipped.imported, 1);
    assert.equal(skipped.updated, 0);
    assert.equal(skipped.skipped, 2);
    assert.equal(skipped.invalid, 1);
    const created = await prisma.contact.findFirst({ where: { userId: owner.id, phone: '+244923600002' } });
    assert.ok(created);
    createdContactIds.push(created.id);
    assert.equal((await prisma.contact.findUnique({ where: { id: existing.id } })).name, 'Cliente Existente');

    const updated = await commitFoodCustomerImport(prisma, owner.id, [rows[0]], 'update', { maxRows: 5000 });
    assert.equal(updated.imported, 0);
    assert.equal(updated.updated, 1);
    const refreshed = await prisma.contact.findUnique({ where: { id: existing.id }, include: { foodProfiles: true } });
    assert.equal(refreshed.name, 'Existente Actualizado');
    assert.ok(JSON.parse(refreshed.tags).includes('VIP'));
    assert.equal(refreshed.foodProfiles[0].marketingConsent, true);
  } finally {
    if (createdContactIds.length) await prisma.contact.deleteMany({ where: { id: { in: createdContactIds } } });
    if (createdUserIds.length) await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  }
});

test('Agenda Food respeita datas, consentimento, canal, estado e tenant', { skip: !testDatabaseUrl }, async () => {
  process.env.DATABASE_URL = testDatabaseUrl;
  const { PrismaClient } = require('@prisma/client');
  const { listFoodBirthdays } = require('../services/food-birthday.service');
  const prisma = new PrismaClient();
  const suffix = crypto.randomUUID();
  const createdContactIds = [];
  const createdUserIds = [];

  try {
    const owner = await prisma.user.create({ data: { name: 'Birthday Food', email: `birthday-food-${suffix}@example.test`, workspaceMode: 'food' } });
    const otherOwner = await prisma.user.create({ data: { name: 'Birthday Food B', email: `birthday-food-b-${suffix}@example.test`, workspaceMode: 'food' } });
    createdUserIds.push(owner.id, otherOwner.id);
    const eligible = await prisma.contact.create({ data: { userId: owner.id, name: 'Aniversário Elegível', phone: '+244923800001', email: 'birthday@example.test', company: '', birthDate: new Date('1990-12-31T00:00:00.000Z'), status: 'ativo' } });
    const noConsent = await prisma.contact.create({ data: { userId: owner.id, name: 'Sem Consentimento', phone: '+244923800002', email: '', company: '', birthDate: new Date('1991-01-01T00:00:00.000Z'), status: 'ativo' } });
    const archived = await prisma.contact.create({ data: { userId: owner.id, name: 'Arquivado', phone: '+244923800003', email: '', company: '', birthDate: new Date('1992-12-31T00:00:00.000Z'), status: 'inativo' } });
    const foreign = await prisma.contact.create({ data: { userId: otherOwner.id, name: 'Outro Tenant', phone: '+244923800001', email: '', company: '', birthDate: new Date('1993-12-31T00:00:00.000Z'), status: 'ativo' } });
    createdContactIds.push(eligible.id, noConsent.id, archived.id, foreign.id);
    await prisma.foodCustomerProfile.createMany({ data: [
      { organizationId: owner.id, contactId: eligible.id, marketingConsent: true, preferences: { preferredChannel: 'EMAIL' } },
      { organizationId: owner.id, contactId: noConsent.id, marketingConsent: false, preferences: { preferredChannel: 'WHATSAPP' } },
      { organizationId: owner.id, contactId: archived.id, marketingConsent: true, preferences: { preferredChannel: 'WHATSAPP' } },
      { organizationId: otherOwner.id, contactId: foreign.id, marketingConsent: true, preferences: { preferredChannel: 'WHATSAPP' } },
    ] });

    const agenda = await listFoodBirthdays(prisma, owner.id, 2, new Date('2026-12-30T18:00:00.000Z'));
    assert.deepEqual(agenda.map((item) => item.id), [eligible.id, noConsent.id]);
    assert.equal(agenda[0].daysUntil, 1);
    assert.equal(agenda[0].preferredChannel, 'EMAIL');
    assert.equal(agenda[0].eligible, true);
    assert.equal(agenda[1].daysUntil, 2);
    assert.equal(agenda[1].eligible, false);
    assert.equal((await listFoodBirthdays(prisma, owner.id, 1, new Date('2026-12-30T18:00:00.000Z'))).length, 1);
    assert.deepEqual((await listFoodBirthdays(prisma, otherOwner.id, 2, new Date('2026-12-30T18:00:00.000Z'))).map((item) => item.id), [foreign.id]);

    await prisma.foodBirthdayAutomationSettings.create({ data: { organizationId: owner.id, channel: 'EMAIL', template: 'Parabéns {{nome}}', createdByUserId: owner.id } });
    await prisma.foodBirthdayAutomationSettings.create({ data: { organizationId: otherOwner.id, channel: 'SMS', template: 'Feliz aniversário', createdByUserId: otherOwner.id } });
    assert.equal((await prisma.foodBirthdayAutomationSettings.findUnique({ where: { organizationId: owner.id } })).channel, 'EMAIL');
  } finally {
    if (createdContactIds.length) await prisma.contact.deleteMany({ where: { id: { in: createdContactIds } } });
    if (createdUserIds.length) await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  }
});

test('Timeline Food reúne actividade real e isola ocorrências por tenant e unidade', { skip: !testDatabaseUrl }, async () => {
  process.env.DATABASE_URL = testDatabaseUrl;
  const { PrismaClient } = require('@prisma/client');
  const {
    listFoodCustomerTimeline,
    createFoodCustomerOccurrence,
    resolveFoodCustomerOccurrence,
  } = require('../services/food-customer-timeline.service');
  const prisma = new PrismaClient();
  const suffix = crypto.randomUUID();
  const createdContactIds = [];
  const createdUserIds = [];
  let couponId;

  try {
    const ownerA = await prisma.user.create({ data: { name: 'Timeline Food A', email: `timeline-food-a-${suffix}@example.test`, workspaceMode: 'food' } });
    const ownerB = await prisma.user.create({ data: { name: 'Timeline Food B', email: `timeline-food-b-${suffix}@example.test`, workspaceMode: 'food' } });
    createdUserIds.push(ownerA.id, ownerB.id);
    const branchA = await prisma.foodBranch.create({ data: { userId: ownerA.id, name: 'Timeline A', isMain: true, createdByUserId: ownerA.id } });
    const branchB = await prisma.foodBranch.create({ data: { userId: ownerB.id, name: 'Timeline B', isMain: true, createdByUserId: ownerB.id } });
    const customerA = await prisma.contact.create({ data: { userId: ownerA.id, name: 'Cliente Timeline A', phone: '+244923900001', email: '', company: '', status: 'ativo' } });
    const customerB = await prisma.contact.create({ data: { userId: ownerB.id, name: 'Cliente Timeline B', phone: '+244923900002', email: '', company: '', status: 'ativo' } });
    createdContactIds.push(customerA.id, customerB.id);
    await prisma.foodCustomerProfile.createMany({ data: [
      { organizationId: ownerA.id, contactId: customerA.id },
      { organizationId: ownerB.id, contactId: customerB.id },
    ] });
    const order = await prisma.foodOrder.create({
      data: { userId: ownerA.id, branchId: branchA.id, contactId: customerA.id, orderNumber: 1, status: 'completed', orderState: 'completed', kitchenState: 'ready', deliveryState: 'not_required', paymentState: 'paid', orderType: 'pickup', customerName: customerA.name, customerPhone: customerA.phone, total: 7500 },
    });
    const coupon = await prisma.foodCoupon.create({
      data: { organizationId: ownerA.id, code: `TL-${suffix.slice(0, 8)}`, name: 'Regresso', discountType: 'fixed', discountValue: 1000, createdByUserId: ownerA.id },
    });
    couponId = coupon.id;
    await prisma.foodMarketingCampaign.create({ data: { organizationId: ownerA.id, couponId: coupon.id, name: 'Volte Sempre', channel: 'SMS', content: 'Benefício disponível', createdByUserId: ownerA.id } });
    await prisma.foodCouponRedemption.create({ data: { organizationId: ownerA.id, couponId: coupon.id, orderId: order.id, contactId: customerA.id, discountAmount: 1000 } });
    await prisma.foodAuditEvent.create({ data: { organizationId: ownerA.id, branchId: branchA.id, actorUserId: ownerA.id, action: 'customer.updated', entityType: 'contact', entityId: String(customerA.id), payload: { fields: ['phone'] } } });

    const contextA = { organizationId: ownerA.id, personId: ownerA.id, canAccessBranch: (branchId) => branchId === branchA.id };
    const occurrence = await createFoodCustomerOccurrence(prisma, contextA, customerA.id, {
      branchId: branchA.id,
      type: 'complaint',
      severity: 'high',
      title: 'Pedido chegou frio',
      description: 'Cliente pediu acompanhamento.',
    });
    assert.equal(occurrence.contactId, customerA.id);
    assert.equal(occurrence.status, 'open');

    await assert.rejects(
      createFoodCustomerOccurrence(prisma, contextA, customerA.id, { branchId: branchB.id, title: 'Unidade externa' }),
      (error) => error.code === 'FOOD_BRANCH_INVALID'
    );
    await assert.rejects(
      listFoodCustomerTimeline(prisma, ownerB.id, customerA.id),
      (error) => error.code === 'FOOD_CUSTOMER_NOT_FOUND'
    );

    const timeline = await listFoodCustomerTimeline(prisma, ownerA.id, customerA.id);
    assert.deepEqual(new Set(timeline.map((event) => event.type)), new Set(['order', 'coupon', 'occurrence', 'audit']));
    assert.equal(timeline.find((event) => event.type === 'order').metadata.total, 7500);
    assert.match(timeline.find((event) => event.type === 'coupon').description, /Volte Sempre/);
    assert.equal((await listFoodCustomerTimeline(prisma, ownerA.id, customerA.id, { type: 'occurrence' })).length, 1);

    await assert.rejects(
      resolveFoodCustomerOccurrence(prisma, contextA, customerA.id, occurrence.id, 'x'),
      (error) => error.statusCode === 400
    );
    const resolved = await resolveFoodCustomerOccurrence(prisma, contextA, customerA.id, occurrence.id, 'Refeição substituída sem custo.');
    assert.equal(resolved.status, 'resolved');
    assert.equal(resolved.resolutionNote, 'Refeição substituída sem custo.');
    await assert.rejects(
      resolveFoodCustomerOccurrence(prisma, contextA, customerA.id, occurrence.id, 'Outra resolução'),
      (error) => error.code === 'FOOD_CUSTOMER_OCCURRENCE_RESOLVED'
    );
    await assert.rejects(
      resolveFoodCustomerOccurrence(prisma, { organizationId: ownerB.id, personId: ownerB.id, canAccessBranch: () => true }, customerA.id, occurrence.id, 'Tentativa externa'),
      (error) => error.code === 'FOOD_CUSTOMER_NOT_FOUND'
    );
  } finally {
    if (couponId) {
      await prisma.foodCouponRedemption.deleteMany({ where: { couponId } });
      await prisma.foodMarketingCampaign.deleteMany({ where: { couponId } });
      await prisma.foodCoupon.deleteMany({ where: { id: couponId } });
    }
    if (createdContactIds.length) await prisma.contact.deleteMany({ where: { id: { in: createdContactIds } } });
    if (createdUserIds.length) await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  }
});
