function cleanText(value, max = 500) {
  const normalized = String(value || '').trim();
  return normalized ? normalized.slice(0, max) : null;
}

function requestIp(req) {
  const forwarded = cleanText(req?.headers?.['x-forwarded-for'], 200);
  return forwarded ? forwarded.split(',')[0].trim() : cleanText(req?.ip, 200);
}

function foodAuditData(req, event) {
  const access = req.foodContext;
  return {
    organizationId: access.organizationId,
    branchId: event.branchId || null,
    actorUserId: access.personId || null,
    actorRole: access.primaryRole || null,
    action: cleanText(event.action, 120),
    entityType: cleanText(event.entityType, 120),
    entityId: cleanText(event.entityId, 160),
    origin: cleanText(req.get?.('X-Food-Origin') || event.origin, 80) || 'api',
    device: cleanText(req.get?.('X-Food-Device') || event.device, 160),
    reason: cleanText(event.reason, 1000),
    idempotencyKey: cleanText(req.get?.('Idempotency-Key') || event.idempotencyKey, 120),
    ipAddress: requestIp(req),
    userAgent: cleanText(req.get?.('User-Agent') || req?.headers?.['user-agent'], 500),
    payload: event.payload && typeof event.payload === 'object' ? event.payload : {},
  };
}

async function recordFoodAudit(prisma, req, event) {
  const data = foodAuditData(req, event);
  if (!data.action || !data.entityType || !data.entityId) {
    const error = new Error('Evento de auditoria Food inválido.');
    error.code = 'FOOD_AUDIT_INVALID';
    throw error;
  }
  if (!data.idempotencyKey) return prisma.foodAuditEvent.create({ data });
  const existing = await prisma.foodAuditEvent.findUnique({
    where: { organizationId_idempotencyKey: { organizationId: data.organizationId, idempotencyKey: data.idempotencyKey } },
  });
  return existing || prisma.foodAuditEvent.create({ data });
}

module.exports = { cleanText, foodAuditData, recordFoodAudit };
