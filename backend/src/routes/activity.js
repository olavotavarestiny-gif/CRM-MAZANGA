const express = require('express');
const prisma = require('../lib/prisma');
const { canPerform } = require('../lib/permissions');
const {
  getEntityHistory,
  getOrganizationFeed,
  exportOrganizationFeedCsv,
} = require('../services/activity-log.service.js');

const router = express.Router();

function hasPrivilegedAccess(req) {
  return !!(req.user?.isSuperAdmin || req.user?.isAccountOwner || req.user?.role === 'admin');
}

function canViewEntity(req, entityType) {
  if (hasPrivilegedAccess(req)) return true;

  if (entityType === 'contact') {
    return canPerform(req.user.permissionsJson, 'contacts', 'view');
  }

  if (entityType === 'task') {
    return canPerform(req.user.permissionsJson, 'tasks', 'view');
  }

  if (entityType === 'invoice') {
    return (
      canPerform(req.user.permissionsJson, 'finances', 'transactions_view')
      || canPerform(req.user.permissionsJson, 'finances', 'view_invoices')
    );
  }

  if (entityType === 'pipeline_stage') {
    return canPerform(req.user.permissionsJson, 'pipeline', 'view');
  }

  return false;
}

router.get('/entity/:entityType/:entityId', async (req, res) => {
  try {
    const { entityType, entityId } = req.params;

    if (!canViewEntity(req, entityType)) {
      return res.status(403).json({ error: 'Sem permissão para ver este histórico' });
    }

    const data = await getEntityHistory(
      entityType,
      entityId,
      req.user.effectiveUserId,
      req.query
    );

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    if (!hasPrivilegedAccess(req)) {
      return res.status(403).json({ error: 'Sem permissão para ver a atividade da organização' });
    }

    const organizationId = req.user.effectiveUserId;
    const [data, users] = await Promise.all([
      getOrganizationFeed(organizationId, req.query),
      prisma.user.findMany({
        where: {
          active: true,
          OR: [{ id: organizationId }, { accountOwnerId: organizationId }],
        },
        select: { id: true, name: true, email: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    res.json({
      ...data,
      users,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/export-csv', async (req, res) => {
  try {
    if (!hasPrivilegedAccess(req)) {
      return res.status(403).json({ error: 'Sem permissão para exportar a atividade da organização' });
    }

    const csv = await exportOrganizationFeedCsv(req.user.effectiveUserId, req.query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="atividade-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(`\uFEFF${csv}`);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
