const { log: logActivity } = require('../services/activity-log.service.js');

function buildActivityActor(reqOrActor, organizationId) {
  if (reqOrActor?.user) {
    return {
      organization_id: reqOrActor.user.effectiveUserId,
      user_id: reqOrActor.user.id,
      user_name: reqOrActor.user.name,
    };
  }

  if (reqOrActor?.user_id && reqOrActor?.user_name) {
    return {
      organization_id: reqOrActor.organization_id || organizationId,
      user_id: reqOrActor.user_id,
      user_name: reqOrActor.user_name,
    };
  }

  return {
    organization_id: organizationId,
    user_id: organizationId,
    user_name: 'Sistema',
  };
}

function stringifyActivityValue(value, fallback = null) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

async function logActivityEvent({
  organizationId,
  actor,
  entityType,
  entityId,
  entityLabel,
  action,
  fieldChanged,
  oldValue,
  newValue,
  metadata,
}) {
  const activityActor = buildActivityActor(actor, organizationId);

  await logActivity({
    ...activityActor,
    entity_type: entityType,
    entity_id: entityId,
    entity_label: entityLabel,
    action,
    field_changed: fieldChanged || null,
    old_value: stringifyActivityValue(oldValue),
    new_value: stringifyActivityValue(newValue),
    metadata: metadata ?? null,
  });
}

async function logFieldChangesActivity({
  organizationId,
  actor,
  entityType,
  entityId,
  entityLabel,
  changes,
}) {
  const normalizedChanges = Array.isArray(changes)
    ? changes.filter((change) => {
        const oldValue = stringifyActivityValue(change.oldValue, '—');
        const newValue = stringifyActivityValue(change.newValue, '—');
        return oldValue !== newValue;
      })
    : [];

  await Promise.all(
    normalizedChanges.map((change) =>
      logActivityEvent({
        organizationId,
        actor,
        entityType,
        entityId,
        entityLabel,
        action: change.action || 'updated',
        fieldChanged: change.fieldChanged,
        oldValue: change.oldValue,
        newValue: change.newValue,
        metadata: change.metadata,
      })
    )
  );
}

function buildProductLabel(product) {
  if (!product) return 'Produto';
  if (product.productCode && product.productDescription) {
    return `${product.productDescription} (${product.productCode})`;
  }
  return product.productDescription || product.productCode || 'Produto';
}

async function logCashSessionOpenedActivity(session, actor) {
  await logActivityEvent({
    organizationId: session.userId,
    actor,
    entityType: 'cash_session',
    entityId: session.id,
    entityLabel: session.estabelecimento?.nome || 'Sessão de caixa',
    action: 'opened',
    metadata: {
      establishment_name: session.estabelecimento?.nome || null,
      opening_balance: session.openingBalance ?? 0,
      notes: session.notes || null,
    },
  });
}

async function logCashSessionClosedActivity(session, actor) {
  await logActivityEvent({
    organizationId: session.userId,
    actor,
    entityType: 'cash_session',
    entityId: session.id,
    entityLabel: session.estabelecimento?.nome || 'Sessão de caixa',
    action: 'closed',
    metadata: {
      establishment_name: session.estabelecimento?.nome || null,
      opening_balance: session.openingBalance ?? 0,
      expected_closing_amount: session.expectedClosingAmount ?? null,
      closing_counted_amount: session.closingCountedAmount ?? null,
      difference_amount: session.differenceAmount ?? null,
      total_sales_amount: session.totalSalesAmount ?? 0,
      total_cash: session.totalCash ?? 0,
      total_multicaixa: session.totalMulticaixa ?? 0,
      total_tpa: session.totalTpa ?? 0,
      total_transferencia: session.totalTransferencia ?? 0,
      notes: session.notes || null,
    },
  });
}

async function logBillingCustomerCreatedActivity(customer, actor) {
  await logActivityEvent({
    organizationId: customer.userId,
    actor,
    entityType: 'billing_customer',
    entityId: customer.id,
    entityLabel: customer.customerName || 'Cliente de faturação',
    action: 'created',
    metadata: {
      customer_tax_id: customer.customerTaxID,
      customer_email: customer.customerEmail || null,
      customer_phone: customer.customerPhone || null,
    },
  });
}

async function logProductCreatedActivity(product, actor) {
  await logActivityEvent({
    organizationId: product.userId,
    actor,
    entityType: 'product',
    entityId: product.id,
    entityLabel: buildProductLabel(product),
    action: 'created',
    metadata: {
      product_code: product.productCode,
      product_type: product.productType,
      unit_price: product.unitPrice,
      stock: product.stock ?? null,
    },
  });
}

async function logProductDeactivatedActivity(product, actor) {
  await logActivityEvent({
    organizationId: product.userId,
    actor,
    entityType: 'product',
    entityId: product.id,
    entityLabel: buildProductLabel(product),
    action: 'deactivated',
    metadata: {
      product_code: product.productCode,
    },
  });
}

async function logStockAdjustedActivity({
  organizationId,
  actor,
  product,
  previousStock,
  newStock,
  quantity,
  direction,
  reason,
  referenceType,
  referenceId,
}) {
  await logActivityEvent({
    organizationId,
    actor,
    entityType: 'product',
    entityId: product.id,
    entityLabel: buildProductLabel(product),
    action: 'stock_adjusted',
    fieldChanged: 'stock',
    oldValue: previousStock,
    newValue: newStock,
    metadata: {
      product_code: product.productCode,
      quantity,
      direction,
      reason: reason || null,
      reference_type: referenceType || null,
      reference_id: referenceId || null,
    },
  });
}

async function logProductCategoryCreatedActivity(category, actor) {
  await logActivityEvent({
    organizationId: category.userId,
    actor,
    entityType: 'product_category',
    entityId: category.id,
    entityLabel: category.nome,
    action: 'created',
    metadata: {
      color: category.cor || null,
    },
  });
}

async function logProductCategoryDeletedActivity(category, actor) {
  await logActivityEvent({
    organizationId: category.userId,
    actor,
    entityType: 'product_category',
    entityId: category.id,
    entityLabel: category.nome,
    action: 'deleted',
    metadata: {
      color: category.cor || null,
    },
  });
}

async function logSerieCreatedActivity(serie, actor) {
  await logActivityEvent({
    organizationId: serie.userId,
    actor,
    entityType: 'serie',
    entityId: serie.id,
    entityLabel: `${serie.seriesCode}/${serie.seriesYear}`,
    action: 'created',
    metadata: {
      document_type: serie.documentType,
      establishment_id: serie.estabelecimentoId,
      series_status: serie.seriesStatus,
    },
  });
}

async function logSerieDeletedActivity(serie, actor) {
  await logActivityEvent({
    organizationId: serie.userId,
    actor,
    entityType: 'serie',
    entityId: serie.id,
    entityLabel: `${serie.seriesCode}/${serie.seriesYear}`,
    action: 'deleted',
    metadata: {
      document_type: serie.documentType,
      establishment_id: serie.estabelecimentoId,
    },
  });
}

async function logStoreCreatedActivity(store, actor) {
  await logActivityEvent({
    organizationId: store.userId,
    actor,
    entityType: 'store',
    entityId: store.id,
    entityLabel: store.nome,
    action: 'created',
    metadata: {
      nif: store.nif,
      is_principal: store.isPrincipal,
    },
  });
}

async function logInvoiceCreatedActivity(factura, reqOrActor = null) {
  await logActivityEvent({
    organizationId: factura.userId,
    actor: reqOrActor,
    entityType: 'invoice',
    entityId: factura.id,
    entityLabel: factura.documentNo || factura.customerName || 'Fatura',
    action: 'created',
    metadata: {
      document_no: factura.documentNo,
      document_type: factura.documentType,
      customer_name: factura.customerName,
    },
  });
}

async function logInvoiceStatusChangeActivity({
  facturaId,
  organizationId,
  actor,
  entityLabel,
  oldStatus,
  newStatus,
  metadata,
}) {
  await logActivityEvent({
    organizationId,
    actor,
    entityType: 'invoice',
    entityId: facturaId,
    entityLabel,
    action: 'status_changed',
    fieldChanged: 'document_status',
    oldValue: oldStatus,
    newValue: newStatus,
    metadata: metadata || null,
  });
}

module.exports = {
  buildActivityActor,
  logActivityEvent,
  logFieldChangesActivity,
  logCashSessionOpenedActivity,
  logCashSessionClosedActivity,
  logBillingCustomerCreatedActivity,
  logProductCreatedActivity,
  logProductDeactivatedActivity,
  logStockAdjustedActivity,
  logProductCategoryCreatedActivity,
  logProductCategoryDeletedActivity,
  logSerieCreatedActivity,
  logSerieDeletedActivity,
  logStoreCreatedActivity,
  logInvoiceCreatedActivity,
  logInvoiceStatusChangeActivity,
};
