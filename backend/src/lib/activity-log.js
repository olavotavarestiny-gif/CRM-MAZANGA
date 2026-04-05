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

async function logInvoiceCreatedActivity(factura, reqOrActor = null) {
  const actor = buildActivityActor(reqOrActor, factura.userId);

  await logActivity({
    ...actor,
    entity_type: 'invoice',
    entity_id: factura.id,
    entity_label: factura.documentNo || factura.customerName || 'Fatura',
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
  const activityActor = buildActivityActor(actor, organizationId);

  await logActivity({
    ...activityActor,
    entity_type: 'invoice',
    entity_id: facturaId,
    entity_label: entityLabel,
    action: 'status_changed',
    field_changed: 'document_status',
    old_value: oldStatus,
    new_value: newStatus,
    metadata: metadata || null,
  });
}

module.exports = {
  buildActivityActor,
  logInvoiceCreatedActivity,
  logInvoiceStatusChangeActivity,
};
