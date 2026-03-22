const prisma = require('../prisma');

/**
 * Regista um evento de auditoria.
 */
async function logEvent(eventType, entityType, entityId, userId, req, eventData = null, errorData = null) {
  try {
    await prisma.auditoriaEvento.create({
      data: {
        eventType,
        entityType,
        entityId: String(entityId),
        userId: userId ? Number(userId) : null,
        eventData: eventData ? JSON.stringify(eventData) : null,
        errorData: errorData ? JSON.stringify(errorData) : null,
        ipAddress: req?.ip || req?.headers?.['x-forwarded-for'] || null,
        userAgent: req?.headers?.['user-agent'] || null,
      },
    });
  } catch (err) {
    // Não bloquear operação principal se auditoria falhar
    console.error('Audit log error:', err);
  }
}

module.exports = { logEvent };
