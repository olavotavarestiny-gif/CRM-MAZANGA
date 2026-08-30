const { domainError } = require('../lib/food-domain');

const PURCHASE_INCLUDE = {
  branch: true,
  supplier: true,
  items: { include: { ingredient: true }, orderBy: { createdAt: 'asc' } },
  events: { orderBy: { version: 'asc' } },
};

const COMMANDS = {
  submit: { from: ['draft'], to: 'awaiting_confirmation' },
  confirm: { from: ['awaiting_confirmation', 'ordered'], to: 'confirmed' },
  dispatch: { from: ['confirmed'], to: 'in_delivery' },
  cancel: { from: ['draft', 'awaiting_confirmation', 'confirmed', 'in_delivery', 'ordered'], to: 'cancelled' },
};

function idempotencyKey(value) {
  const key = String(value || '').trim().slice(0, 120);
  if (!key) throw domainError('Idempotency-Key é obrigatório.', 400, 'FOOD_IDEMPOTENCY_KEY_REQUIRED');
  return key;
}

function expectedVersion(input, current, allowCurrent = false) {
  if (input === undefined && allowCurrent) return current;
  const version = Number(input);
  if (!Number.isInteger(version) || version < 1) throw domainError('Versão da compra inválida. Actualize a página.', 400, 'FOOD_PURCHASE_VERSION_INVALID');
  return version;
}

async function scopedPurchase(tx, context, purchaseId) {
  const purchase = await tx.foodPurchase.findFirst({
    where: { id: purchaseId, organizationId: context.organizationId },
    include: PURCHASE_INCLUDE,
  });
  if (!purchase) throw domainError('Compra não encontrada.', 404, 'FOOD_PURCHASE_NOT_FOUND');
  if (!context.canAccessBranch(purchase.branchId)) throw domainError('Não tem acesso a esta unidade.', 403, 'FOOD_PURCHASE_FORBIDDEN');
  return purchase;
}

async function commandFoodPurchase(prisma, context, purchaseId, input = {}, keyValue) {
  const key = idempotencyKey(keyValue);
  const command = String(input.command || '');
  const transition = COMMANDS[command];
  if (!transition) throw domainError('Comando de compra inválido.', 400, 'FOOD_PURCHASE_COMMAND_INVALID');
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "food_purchases" WHERE "id" = ${purchaseId} FOR UPDATE`;
    const purchase = await scopedPurchase(tx, context, purchaseId);
    const priorEvent = await tx.foodPurchaseEvent.findUnique({ where: { purchaseId_idempotencyKey: { purchaseId, idempotencyKey: key } } });
    if (priorEvent) return purchase;
    const version = expectedVersion(input.version, purchase.version);
    if (version !== purchase.version) throw domainError('A compra foi alterada por outro utilizador. Actualize a página.', 409, 'FOOD_PURCHASE_VERSION_CONFLICT');
    if (!transition.from.includes(purchase.status)) throw domainError('A compra não permite esta transição.', 409, 'FOOD_PURCHASE_INVALID_TRANSITION');
    const reason = String(input.reason || '').trim().slice(0, 1000) || null;
    if (command === 'cancel' && (!reason || reason.length < 3)) throw domainError('Indique o motivo do cancelamento.');
    const nextVersion = purchase.version + 1;
    await tx.foodPurchase.update({
      where: { id: purchase.id },
      data: {
        status: transition.to,
        version: nextVersion,
        ...(command === 'confirm' ? { purchasedAt: purchase.purchasedAt || new Date() } : {}),
        ...(command === 'cancel' ? { cancelledAt: new Date(), cancellationReason: reason } : {}),
      },
    });
    await tx.foodPurchaseEvent.create({
      data: {
        organizationId: context.organizationId,
        branchId: purchase.branchId,
        purchaseId: purchase.id,
        type: `command.${command}`,
        statusFrom: purchase.status,
        statusTo: transition.to,
        version: nextVersion,
        actorUserId: context.personId,
        idempotencyKey: key,
        payload: { reason },
      },
    });
    return scopedPurchase(tx, context, purchase.id);
  });
}

async function receiveFoodPurchaseItems(prisma, context, purchaseId, input = {}, keyValue, options = {}) {
  const key = idempotencyKey(keyValue);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "food_purchases" WHERE "id" = ${purchaseId} FOR UPDATE`;
    const purchase = await scopedPurchase(tx, context, purchaseId);
    const priorEvent = await tx.foodPurchaseEvent.findUnique({ where: { purchaseId_idempotencyKey: { purchaseId, idempotencyKey: key } } });
    if (priorEvent) return purchase;
    const version = expectedVersion(input.version, purchase.version, options.allowCurrentVersion === true);
    if (version !== purchase.version) throw domainError('A compra foi alterada por outro utilizador. Actualize a página.', 409, 'FOOD_PURCHASE_VERSION_CONFLICT');
    if (!['confirmed', 'in_delivery', 'partial', 'ordered'].includes(purchase.status)) {
      throw domainError('A compra não pode ser recebida no estado actual.', 409, 'FOOD_PURCHASE_RECEIPT_INVALID');
    }
    const requestedItems = Array.isArray(input.items) && input.items.length
      ? input.items
      : purchase.items.map((item) => ({ purchaseItemId: item.id, quantity: Number(item.quantity) - Number(item.receivedQuantity) }));
    const seen = new Set();
    const normalized = requestedItems.map((requested) => {
      const purchaseItemId = String(requested.purchaseItemId || '');
      const item = purchase.items.find((candidate) => candidate.id === purchaseItemId);
      if (!item || seen.has(purchaseItemId)) throw domainError('Item de receção inválido.', 400, 'FOOD_PURCHASE_RECEIPT_ITEM_INVALID');
      seen.add(purchaseItemId);
      const quantity = Number(requested.quantity);
      const remaining = Number(item.quantity) - Number(item.receivedQuantity);
      if (!Number.isFinite(quantity) || quantity <= 0 || quantity > remaining + 0.0000001) {
        throw domainError(`Quantidade recebida inválida para ${item.ingredient.name}.`, 400, 'FOOD_PURCHASE_RECEIPT_QUANTITY_INVALID');
      }
      return { item, quantity };
    });
    if (!normalized.length) throw domainError('Indique pelo menos uma quantidade recebida.');

    const receivedByItem = new Map(purchase.items.map((item) => [item.id, Number(item.receivedQuantity)]));
    for (const entry of [...normalized].sort((left, right) => left.item.ingredientId.localeCompare(right.item.ingredientId))) {
      await tx.$queryRaw`SELECT "id" FROM "food_ingredients" WHERE "id" = ${entry.item.ingredientId} FOR UPDATE`;
      const ingredient = await tx.foodIngredient.findFirst({ where: { id: entry.item.ingredientId, organizationId: context.organizationId } });
      if (!ingredient) throw domainError('Ingrediente da compra não encontrado.', 409, 'FOOD_INGREDIENT_NOT_FOUND');
      if (ingredient.branchId && ingredient.branchId !== purchase.branchId) throw domainError('Ingrediente pertence a outra unidade.', 409, 'FOOD_INGREDIENT_BRANCH_INVALID');
      const previousStock = Number(ingredient.currentStock);
      const newStock = previousStock + entry.quantity;
      const previousValue = previousStock * Number(ingredient.averageCost);
      const receivedValue = entry.quantity * Number(entry.item.unitCost);
      const averageCost = newStock > 0 ? (previousValue + receivedValue) / newStock : Number(entry.item.unitCost);
      await tx.foodIngredient.update({ where: { id: ingredient.id }, data: { currentStock: newStock, averageCost } });
      const nextReceived = Number(entry.item.receivedQuantity) + entry.quantity;
      receivedByItem.set(entry.item.id, nextReceived);
      await tx.foodPurchaseItem.update({ where: { id: entry.item.id }, data: { receivedQuantity: nextReceived } });
      await tx.foodStockMovement.create({
        data: {
          organizationId: context.organizationId,
          branchId: purchase.branchId,
          ingredientId: ingredient.id,
          purchaseId: purchase.id,
          type: 'purchase_receipt',
          quantity: entry.quantity,
          previousStock,
          newStock,
          unitCost: entry.item.unitCost,
          reason: `Receção da compra ${purchase.reference || purchase.id}`,
          referenceType: 'food_purchase_receipt',
          referenceId: key,
          createdByUserId: context.personId,
        },
      });
    }
    const complete = purchase.items.every((item) => (receivedByItem.get(item.id) || 0) >= Number(item.quantity) - 0.0000001);
    const nextStatus = complete ? 'received' : 'partial';
    const nextVersion = purchase.version + 1;
    await tx.foodPurchase.update({
      where: { id: purchase.id },
      data: { status: nextStatus, version: nextVersion, ...(complete ? { receivedAt: new Date() } : {}) },
    });
    await tx.foodPurchaseEvent.create({
      data: {
        organizationId: context.organizationId,
        branchId: purchase.branchId,
        purchaseId: purchase.id,
        type: 'receipt.confirmed',
        statusFrom: purchase.status,
        statusTo: nextStatus,
        version: nextVersion,
        actorUserId: context.personId,
        idempotencyKey: key,
        payload: { items: normalized.map((entry) => ({ purchaseItemId: entry.item.id, ingredientId: entry.item.ingredientId, quantity: entry.quantity })) },
      },
    });
    return scopedPurchase(tx, context, purchase.id);
  });
}

module.exports = { PURCHASE_INCLUDE, COMMANDS, commandFoodPurchase, receiveFoodPurchaseItems };
