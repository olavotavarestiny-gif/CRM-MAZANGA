const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const prisma = require('../lib/prisma');

let _supabaseAdmin = null;
function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _supabaseAdmin;
}

// GET /api/superadmin/orgs — list all client account owners
router.get('/orgs', async (req, res) => {
  try {
    const orgs = await prisma.user.findMany({
      where: { accountOwnerId: null, role: 'user', isSuperAdmin: false },
      select: {
        id: true, name: true, email: true, active: true, plan: true,
        permissions: true, createdAt: true,
        accountMembers: {
          select: { id: true, name: true, email: true, active: true },
          orderBy: { name: 'asc' },
        },
        _count: { select: { accountMembers: true } },
        loginLogs: { take: 1, orderBy: { createdAt: 'desc' }, select: { createdAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(orgs.map(o => ({
      ...o,
      permissions: o.permissions ? JSON.parse(o.permissions) : null,
      lastLogin: o.loginLogs[0]?.createdAt || null,
      loginLogs: undefined,
    })));
  } catch (error) {
    console.error('Error fetching orgs:', error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/superadmin/orgs/:id — update plan, active, or org-level permissions
router.patch('/orgs/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { plan, active, permissions } = req.body;

    const data = {};
    if (plan !== undefined) data.plan = plan;
    if (active !== undefined) data.active = active;
    if (permissions !== undefined) {
      data.permissions = permissions ? JSON.stringify(permissions) : null;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, name: true, email: true, plan: true, active: true, permissions: true },
    });

    res.json({
      ...updated,
      permissions: updated.permissions ? JSON.parse(updated.permissions) : null,
    });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Conta não encontrada' });
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/superadmin/orgs/:id — delete an entire org (owner + all members + all data)
router.delete('/orgs/:id', async (req, res) => {
  try {
    const ownerId = parseInt(req.params.id);

    if (ownerId === req.user.id) {
      return res.status(400).json({ error: 'Não pode eliminar a própria conta' });
    }

    // Collect all user IDs in this org
    const members = await prisma.user.findMany({
      where: { accountOwnerId: ownerId },
      select: { id: true, supabaseUid: true },
    });
    const owner = await prisma.user.findUnique({
      where: { id: ownerId },
      select: { id: true, supabaseUid: true, role: true, accountOwnerId: true },
    });

    if (!owner || owner.accountOwnerId !== null || owner.role === 'admin') {
      return res.status(404).json({ error: 'Org não encontrada' });
    }

    const allUsers = [owner, ...members];

    // Delete from Supabase Auth
    for (const u of allUsers) {
      if (u.supabaseUid) {
        await getSupabaseAdmin().auth.admin.deleteUser(u.supabaseUid).catch(() => {});
      }
    }

    // Delete members first (FK constraint), then owner
    await prisma.user.deleteMany({ where: { accountOwnerId: ownerId } });
    await prisma.user.delete({ where: { id: ownerId } });

    res.json({ message: 'Organização eliminada' });
  } catch (error) {
    console.error('Error deleting org:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/superadmin/impersonate/:userId — generate impersonation token
router.post('/impersonate/:userId', async (req, res) => {
  try {
    const targetId = parseInt(req.params.userId);

    if (targetId === req.user.id) {
      return res.status(400).json({ error: 'Não pode impersonar a própria conta' });
    }

    const target = await prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, name: true, email: true, active: true },
    });

    if (!target || !target.active) {
      return res.status(404).json({ error: 'Utilizador não encontrado ou inactivo' });
    }

    const token = jwt.sign(
      {
        type: 'impersonation',
        impersonatedUserId: target.id,
        impersonatorId: req.user.id,
        impersonatorEmail: req.user.email,
      },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '2h' }
    );

    res.json({ token, targetName: target.name, targetEmail: target.email });
  } catch (error) {
    console.error('Error creating impersonation token:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/superadmin/users — create a new client account (same as admin but superadmin version)
router.post('/users', async (req, res) => {
  try {
    const { name, email, password, plan, permissions } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nome, email e password são obrigatórios' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password deve ter pelo menos 6 caracteres' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ error: 'Email já está registado' });

    const { data: authData, error: authError } = await getSupabaseAdmin().auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { name },
    });
    if (authError) return res.status(400).json({ error: authError.message });

    const user = await prisma.user.create({
      data: {
        name, email,
        supabaseUid: authData.user.id,
        role: 'user',
        active: true,
        mustChangePassword: true,
        plan: plan || 'essencial',
        permissions: permissions ? JSON.stringify(permissions) : null,
      },
    });

    res.status(201).json({
      id: user.id, name: user.name, email: user.email,
      plan: user.plan, active: user.active, createdAt: user.createdAt,
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/superadmin/usage — per-org daily login aggregation (last 30 days)
router.get('/usage', async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const orgs = await prisma.user.findMany({
      where: { accountOwnerId: null, role: 'user', isSuperAdmin: false },
      select: { id: true, name: true, accountMembers: { select: { id: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const results = await Promise.all(orgs.map(async (org) => {
      const userIds = [org.id, ...org.accountMembers.map(m => m.id)];

      const logs = await prisma.loginLog.findMany({
        where: { userId: { in: userIds }, createdAt: { gte: thirtyDaysAgo } },
        select: { createdAt: true },
        orderBy: { createdAt: 'desc' },
      });

      // Pre-populate daily buckets for the last 7 days
      const dailyMap = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dailyMap[d.toISOString().slice(0, 10)] = 0;
      }

      let logins30d = 0;
      let lastLogin = null;

      logs.forEach(log => {
        logins30d++;
        const key = log.createdAt.toISOString().slice(0, 10);
        if (key in dailyMap) dailyMap[key]++;
        if (!lastLogin || log.createdAt > lastLogin) lastLogin = log.createdAt;
      });

      const sparkline = Object.entries(dailyMap).map(([date, count]) => ({ date, count }));
      const logins7d = sparkline.reduce((s, d) => s + d.count, 0);

      return { orgId: org.id, orgName: org.name, logins7d, logins30d, lastLogin, sparkline };
    }));

    res.json(results);
  } catch (error) {
    console.error('[superadmin] usage error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/superadmin/storage — per-org record counts and file storage
router.get('/storage', async (req, res) => {
  try {
    const orgs = await prisma.user.findMany({
      where: { accountOwnerId: null, role: 'user', isSuperAdmin: false },
      select: { id: true, name: true },
      orderBy: { createdAt: 'desc' },
    });

    const results = await Promise.all(orgs.map(async (org) => {
      const [contacts, tasks, transactions, notes, contactsWithDocs] = await Promise.all([
        prisma.contact.count({ where: { userId: org.id } }),
        prisma.task.count({ where: { userId: org.id } }),
        prisma.transaction.count({ where: { userId: org.id, deleted: false } }),
        prisma.contactNote.count({ where: { contact: { userId: org.id } } }),
        prisma.contact.findMany({ where: { userId: org.id }, select: { documents: true } }),
      ]);

      let fileCount = 0;
      let fileSizeBytes = 0;
      for (const c of contactsWithDocs) {
        try {
          const docs = JSON.parse(c.documents || '[]');
          if (Array.isArray(docs)) {
            fileCount += docs.length;
            fileSizeBytes += docs.reduce((s, d) => s + (typeof d.size === 'number' ? d.size : 0), 0);
          }
        } catch { /* skip malformed JSON */ }
      }

      return { orgId: org.id, orgName: org.name, contacts, tasks, transactions, notes, fileCount, fileSizeBytes };
    }));

    res.json(results);
  } catch (error) {
    console.error('[superadmin] storage error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
