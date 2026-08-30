const { createFactura } = require('../lib/faturacao/create-factura');
const { domainError } = require('../lib/food-domain');

function fiscalLinesForOrder(order) {
  const weightedLines = order.items.map((item) => {
    const modifiers = (item.modifiers || []).map((modifier) => modifier.optionName).filter(Boolean);
    return {
      productCode: item.productCode || `FOOD-${item.id.slice(-8).toUpperCase()}`,
      productDescription: modifiers.length
        ? `${item.productName} (${modifiers.join(', ')})`
        : item.productName,
      quantity: Number(item.quantity || 1),
      weight: Math.max(0, Number(item.subtotal || 0)),
    };
  });
  if (Number(order.deliveryFee || 0) > 0) {
    weightedLines.push({
      productCode: 'FOOD-DELIVERY',
      productDescription: 'Taxa de entrega',
      quantity: 1,
      weight: Number(order.deliveryFee),
    });
  }
  const weightTotal = weightedLines.reduce((sum, line) => sum + line.weight, 0);
  if (weightTotal <= 0 || Number(order.total || 0) <= 0) {
    throw domainError('O pedido não possui valores faturáveis.');
  }

  let allocatedGross = 0;
  return weightedLines.map((line, index) => {
    const isLast = index === weightedLines.length - 1;
    const gross = isLast
      ? Number(order.total) - allocatedGross
      : Number(((Number(order.total) * line.weight) / weightTotal).toFixed(4));
    allocatedGross += gross;
    const netUnitPrice = gross / 1.14 / line.quantity;
    return {
      lineNumber: index + 1,
      productCode: line.productCode,
      productDescription: line.productDescription,
      quantity: line.quantity,
      unitPrice: Number(netUnitPrice.toFixed(6)),
      unitOfMeasure: 'UN',
      settlementAmount: 0,
      taxes: [{ taxType: 'IVA', taxCode: 'NOR', taxPercentage: 14 }],
    };
  });
}

async function issueFoodFiscalDocument(prisma, access, orderId, input = {}, req = null) {
  const idempotencyKey = String(input.idempotencyKey || '').trim();
  if (!idempotencyKey) throw domainError('Idempotency-Key é obrigatória para emissão fiscal.');

  let document = await prisma.foodFiscalDocument.findFirst({
    where: { userId: access.organizationId, idempotencyKey },
  });
  if (document?.orderId !== undefined && document.orderId !== orderId) {
    throw domainError('Idempotency-Key já utilizada noutro pedido.', 409, 'IDEMPOTENCY_KEY_REUSED');
  }
  if (document?.status === 'issued') return document;

  const order = await prisma.foodOrder.findFirst({
    where: { id: orderId, userId: access.organizationId },
    include: {
      branch: { include: { estabelecimento: true } },
      contact: true,
      items: { include: { modifiers: true }, orderBy: { sortOrder: 'asc' } },
      payments: { where: { status: 'confirmed' }, orderBy: { paidAt: 'desc' } },
    },
  });
  if (!order) throw domainError('Pedido Food não encontrado.', 404);
  if (!access.canAccessBranch(order.branchId)) throw domainError('Não tem acesso a esta unidade.', 403);
  if (order.paymentState !== 'paid') throw domainError('A factura só pode ser emitida depois do pagamento integral.');
  if (!order.branch?.estabelecimentoId) {
    throw domainError('Ligue esta unidade Food a um estabelecimento fiscal antes de emitir a factura.', 409, 'FOOD_FISCAL_BRANCH_REQUIRED');
  }
  const config = await prisma.configuracaoFaturacao.findUnique({
    where: { userId: access.organizationId },
    select: { defaultSerieId: true, defaultEstabelecimentoId: true },
  });
  const serieId = order.branch.estabelecimento?.defaultSerieId
    || (config?.defaultEstabelecimentoId === order.branch.estabelecimentoId ? config.defaultSerieId : null);
  if (!serieId) {
    throw domainError('O estabelecimento ligado à unidade não possui uma série fiscal predefinida.', 409, 'FOOD_FISCAL_SERIES_REQUIRED');
  }

  document = document
    ? await prisma.foodFiscalDocument.update({
      where: { id: document.id },
      data: { status: 'pending', attemptCount: { increment: 1 }, errorCode: null, errorMessage: null },
    })
    : await prisma.foodFiscalDocument.create({
      data: {
        userId: access.organizationId,
        branchId: order.branchId,
        orderId: order.id,
        paymentId: order.payments[0]?.id || null,
        documentType: input.documentType || 'FR',
        status: 'pending',
        idempotencyKey,
        attemptCount: 1,
      },
    });

  try {
    const factura = await createFactura(access.organizationId, {
      documentType: input.documentType || 'FR',
      serieId,
      estabelecimentoId: order.branch.estabelecimentoId,
      customerTaxID: order.contact?.nif || '000000000',
      customerName: order.customerName || order.contact?.name || 'Consumidor Final',
      customerAddress: order.deliveryAddress || order.contact?.location || null,
      paymentMethod: order.payments[0]?.method || order.paymentMethod || 'CASH',
      lines: fiscalLinesForOrder(order),
      baseCurrency: 'AOA',
      currencyCode: 'AOA',
      displayCurrency: 'AOA',
    }, req);

    return prisma.$transaction(async (tx) => {
      const issued = await tx.foodFiscalDocument.update({
        where: { id: document.id },
        data: { status: 'issued', facturaId: factura.id, issuedAt: new Date() },
      });
      const updatedOrder = await tx.foodOrder.update({
        where: { id: order.id },
        data: { version: { increment: 1 }, updatedByUserId: access.personId },
      });
      await tx.foodOrderEvent.create({
        data: {
          userId: access.organizationId,
          branchId: order.branchId,
          orderId: order.id,
          version: updatedOrder.version,
          eventType: 'fiscal.issued',
          actorUserId: access.personId,
          actorRole: access.primaryRole,
          payload: { foodFiscalDocumentId: issued.id, facturaId: factura.id, documentNo: factura.documentNo },
        },
      });
      return { ...issued, factura: { id: factura.id, documentNo: factura.documentNo, grossTotal: factura.grossTotal } };
    });
  } catch (error) {
    await prisma.foodFiscalDocument.update({
      where: { id: document.id },
      data: {
        status: 'failed',
        errorCode: error.code || 'FISCAL_EMISSION_FAILED',
        errorMessage: String(error.message || 'Erro fiscal').slice(0, 500),
      },
    });
    throw error;
  }
}

module.exports = { fiscalLinesForOrder, issueFoodFiscalDocument };
