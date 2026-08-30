const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const prisma = require('../lib/prisma');
const {
  requireAccountOwner,
  invalidateAuthUserCacheByUserId,
  invalidateAuthUserCacheByMembership,
} = require('../middleware/auth');
// Nota: /api/account já é montado com requireAuth + checkSubscriptionAccess
// (ver index.js), por isso req.user está sempre disponível aqui.
const { parsePermissions, intersectPermissions } = require('../lib/permissions');
const { canCreateUser, buildLimitErrorPayload } = require('../lib/plan-limits');

// Lazy Supabase admin client
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

// Resolve {id, nome} para um conjunto de ids de estabelecimento da conta.
async function resolveEstabelecimentos(accountOwnerId, ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const rows = await prisma.estabelecimento.findMany({
    where: { id: { in: unique }, userId: accountOwnerId },
    select: { id: true, nome: true },
  });
  return new Map(rows.map((r) => [r.id, r]));
}

// GET /api/account/team - Listar membros da conta activa (donos apenas)
// Junta membros "casa" (User.accountOwnerId) + convidados (AccountMembership).
router.get('/team', requireAccountOwner, async (req, res) => {
  try {
    const accountOwnerId = req.user.effectiveUserId;

    const [homeMembers, guestMemberships] = await Promise.all([
      prisma.user.findMany({
        where: { accountOwnerId, active: true },
        select: {
          id: true,
          name: true,
          email: true,
          permissions: true,
          assignedEstabelecimentoId: true,
          assignedEstabelecimento: { select: { id: true, nome: true } },
          createdAt: true,
          loginLogs: { take: 1, orderBy: { createdAt: 'desc' }, select: { createdAt: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.accountMembership.findMany({
        where: { accountOwnerId, active: true },
        select: {
          role: true,
          permissions: true,
          assignedEstabelecimentoId: true,
          createdAt: true,
          person: {
            select: {
              id: true,
              name: true,
              email: true,
              loginLogs: { take: 1, orderBy: { createdAt: 'desc' }, select: { createdAt: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const estabMap = await resolveEstabelecimentos(
      accountOwnerId,
      guestMemberships.map((g) => g.assignedEstabelecimentoId)
    );

    const homeList = homeMembers.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      active: true,
      permissions: m.permissions ? JSON.parse(m.permissions) : null,
      assignedEstabelecimentoId: m.assignedEstabelecimentoId,
      assignedEstabelecimento: m.assignedEstabelecimento,
      createdAt: m.createdAt,
      lastLogin: m.loginLogs[0]?.createdAt || null,
      membershipType: 'home',
    }));

    const guestList = guestMemberships.map((g) => ({
      id: g.person.id,
      name: g.person.name,
      email: g.person.email,
      active: true,
      permissions: g.permissions ? JSON.parse(g.permissions) : null,
      assignedEstabelecimentoId: g.assignedEstabelecimentoId,
      assignedEstabelecimento: g.assignedEstabelecimentoId
        ? estabMap.get(g.assignedEstabelecimentoId) || null
        : null,
      createdAt: g.createdAt,
      lastLogin: g.person.loginLogs[0]?.createdAt || null,
      membershipType: 'guest',
    }));

    const all = [...homeList, ...guestList].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    res.json(all);
  } catch (error) {
    console.error('Error fetching team members:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/account/team - Adicionar pessoa à conta activa.
// - Pessoa nova → cria identidade de login + membro "casa" (precisa password).
// - Pessoa que já existe noutra conta → adiciona como CONVIDADO desta conta
//   (AccountMembership), usando o login existente (não pede/reset password).
// - Membro "casa" removido desta conta → reactiva (fluxo legado, precisa password).
router.post('/team', requireAccountOwner, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const accountOwnerId = req.user.effectiveUserId;
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (!name || !normalizedEmail) {
      return res.status(400).json({ error: 'Nome e email são obrigatórios' });
    }

    const limitState = await canCreateUser(accountOwnerId);
    if (!limitState.allowed) {
      return res.status(403).json(buildLimitErrorPayload(limitState));
    }

    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
      select: {
        id: true,
        name: true,
        active: true,
        accountOwnerId: true,
        supabaseUid: true,
        isSuperAdmin: true,
      },
    });

    if (existingUser) {
      if (existingUser.isSuperAdmin) {
        return res.status(400).json({ error: 'Este utilizador não pode ser adicionado a uma conta' });
      }

      const isOwnerOfThisAccount = existingUser.id === accountOwnerId;
      const isHomeMemberOfThisAccount = existingUser.accountOwnerId === accountOwnerId;

      if (isOwnerOfThisAccount) {
        return res.status(400).json({ error: 'Esta pessoa já é a dona desta conta' });
      }

      // ── Membro "casa" desta conta (activo ou removido) → fluxo legado.
      if (isHomeMemberOfThisAccount) {
        if (existingUser.active) {
          return res.status(400).json({ error: 'Email já está registado nesta conta' });
        }
        if (!password || password.length < 6) {
          return res.status(400).json({ error: 'Password deve ter pelo menos 6 caracteres' });
        }

        let supabaseUid = existingUser.supabaseUid;
        if (supabaseUid) {
          const { error: updateAuthError } = await getSupabaseAdmin().auth.admin.updateUserById(supabaseUid, {
            password,
            user_metadata: { name },
          });
          if (updateAuthError) {
            return res.status(400).json({ error: updateAuthError.message });
          }
        } else {
          const { data: authData, error: authError } = await getSupabaseAdmin().auth.admin.createUser({
            email: normalizedEmail,
            password,
            email_confirm: true,
            user_metadata: { name },
          });
          if (authError) {
            return res.status(400).json({ error: authError.message });
          }
          supabaseUid = authData.user.id;
        }

        const member = await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            name,
            email: normalizedEmail,
            supabaseUid,
            accountOwnerId,
            role: 'user',
            active: true,
            mustChangePassword: true,
            permissions: null,
            assignedEstabelecimentoId: null,
          },
          select: { id: true, name: true, email: true, accountOwnerId: true, active: true, createdAt: true },
        });

        return res.status(201).json({ ...member, membershipType: 'home' });
      }

      // ── Pessoa de OUTRA conta (ou dona de outra conta) → CONVIDADO desta conta.
      const existingMembership = await prisma.accountMembership.findUnique({
        where: { personId_accountOwnerId: { personId: existingUser.id, accountOwnerId } },
        select: { id: true, active: true },
      });
      if (existingMembership?.active) {
        return res.status(400).json({ error: 'Esta pessoa já é membro desta conta' });
      }

      if (existingMembership) {
        await prisma.accountMembership.update({
          where: { id: existingMembership.id },
          data: { active: true, role: 'user', permissions: null, assignedEstabelecimentoId: null },
        });
      } else {
        await prisma.accountMembership.create({
          data: { personId: existingUser.id, accountOwnerId, role: 'user' },
        });
      }

      return res.status(201).json({
        id: existingUser.id,
        name: existingUser.name,
        email: normalizedEmail,
        accountOwnerId,
        active: true,
        membershipType: 'guest',
      });
    }

    // ── Pessoa nova → criar identidade de login + membro "casa" desta conta.
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password deve ter pelo menos 6 caracteres' });
    }

    let supabaseUid = null;
    if (!req.user.isDevAuthLocalUser) {
      const { data: authData, error: authError } = await getSupabaseAdmin().auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: { name },
      });
      if (authError) {
        return res.status(400).json({ error: authError.message });
      }
      supabaseUid = authData.user.id;
    }

    const member = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        supabaseUid,
        passwordHash: req.user.isDevAuthLocalUser ? 'DEV_AUTH_LOCAL' : 'SUPABASE_AUTH',
        accountOwnerId,
        role: 'user',
        active: true,
        mustChangePassword: !req.user.isDevAuthLocalUser,
      },
      select: { id: true, name: true, email: true, accountOwnerId: true, active: true, createdAt: true },
    });

    res.status(201).json({ ...member, membershipType: 'home' });
  } catch (error) {
    console.error('Error creating team member:', error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/account/team/:memberId/permissions - Set granular permissions for a team member
router.patch('/team/:memberId/permissions', requireAccountOwner, async (req, res) => {
  try {
    const memberId = parseInt(req.params.memberId);
    const accountOwnerId = req.user.effectiveUserId;
    const { permissions, assignedEstabelecimentoId } = req.body; // UserPermissions object | null

    // Classificar: membro "casa" (User) ou convidado (AccountMembership)?
    const homeMember = await prisma.user.findFirst({
      where: { id: memberId, accountOwnerId, active: true },
      select: { id: true },
    });
    const membership = homeMember
      ? null
      : await prisma.accountMembership.findUnique({
          where: { personId_accountOwnerId: { personId: memberId, accountOwnerId } },
          select: { id: true, active: true },
        });
    if (!homeMember && !(membership && membership.active)) {
      return res.status(404).json({ error: 'Membro não encontrado nesta conta' });
    }

    // Enforce org-level restrictions (intersection)
    const owner = await prisma.user.findUnique({
      where: { id: accountOwnerId },
      select: { permissions: true },
    });
    const orgPerms = parsePermissions(owner?.permissions);
    const memberPerms = parsePermissions(permissions ? JSON.stringify(permissions) : null);
    const finalPerms = intersectPermissions(orgPerms, memberPerms);

    let finalAssignedEstabelecimentoId = null;
    if (assignedEstabelecimentoId) {
      const assignedEstabelecimento = await prisma.estabelecimento.findFirst({
        where: { id: assignedEstabelecimentoId, userId: accountOwnerId },
        select: { id: true, nome: true },
      });

      if (!assignedEstabelecimento) {
        return res.status(404).json({ error: 'Ponto de venda atribuído não encontrado nesta conta' });
      }

      finalAssignedEstabelecimentoId = assignedEstabelecimento.id;
    }

    const finalPermsJson = finalPerms ? JSON.stringify(finalPerms) : null;

    if (homeMember) {
      const updated = await prisma.user.update({
        where: { id: memberId },
        data: { permissions: finalPermsJson, assignedEstabelecimentoId: finalAssignedEstabelecimentoId },
        select: {
          permissions: true,
          assignedEstabelecimentoId: true,
          assignedEstabelecimento: { select: { id: true, nome: true } },
        },
      });
      invalidateAuthUserCacheByUserId(memberId);
      return res.json({
        permissions: updated.permissions ? JSON.parse(updated.permissions) : null,
        assignedEstabelecimentoId: updated.assignedEstabelecimentoId,
        assignedEstabelecimento: updated.assignedEstabelecimento,
      });
    }

    // Convidado: guardar na AccountMembership.
    await prisma.accountMembership.update({
      where: { id: membership.id },
      data: { permissions: finalPermsJson, assignedEstabelecimentoId: finalAssignedEstabelecimentoId },
    });
    invalidateAuthUserCacheByMembership(memberId, accountOwnerId);
    const estab = finalAssignedEstabelecimentoId
      ? await prisma.estabelecimento.findUnique({
          where: { id: finalAssignedEstabelecimentoId },
          select: { id: true, nome: true },
        })
      : null;
    res.json({
      permissions: finalPerms || null,
      assignedEstabelecimentoId: finalAssignedEstabelecimentoId,
      assignedEstabelecimento: estab,
    });
  } catch (error) {
    console.error('Error setting member permissions:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/account/team/:memberId - Remover membro/convidado da conta activa
router.delete('/team/:memberId', requireAccountOwner, async (req, res) => {
  try {
    const memberId = parseInt(req.params.memberId);
    const accountOwnerId = req.user.effectiveUserId;

    // Membro "casa" desta conta?
    const homeMember = await prisma.user.findUnique({
      where: { id: memberId },
      select: { accountOwnerId: true, active: true },
    });

    if (homeMember && homeMember.accountOwnerId === accountOwnerId && homeMember.active) {
      // Desactivar o login do membro "casa" (comportamento legado).
      await prisma.user.update({ where: { id: memberId }, data: { active: false } });
      // Efeito imediato (sem esperar o TTL da cache ~15s).
      invalidateAuthUserCacheByUserId(memberId);
      return res.json({ message: 'Membro removido da conta' });
    }

    // Caso contrário, tentar remover um CONVIDADO (AccountMembership).
    const membership = await prisma.accountMembership.findUnique({
      where: { personId_accountOwnerId: { personId: memberId, accountOwnerId } },
      select: { id: true, active: true },
    });

    if (!membership || !membership.active) {
      return res.status(404).json({ error: 'Membro não encontrado nesta conta' });
    }

    // Desactivar apenas o acesso a esta conta — o login e as outras contas
    // da pessoa não são afectados.
    await prisma.accountMembership.update({ where: { id: membership.id }, data: { active: false } });
    invalidateAuthUserCacheByMembership(memberId, accountOwnerId);

    res.json({ message: 'Acesso removido desta conta' });
  } catch (error) {
    console.error('Error removing team member:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Membro não encontrado' });
    }
    res.status(500).json({ error: error.message });
  }
});

// ── Multi-conta: listar e seleccionar a conta activa ──────────────────────────

// Contas acessíveis pela pessoa autenticada: a conta "casa" + convidados activos.
async function listAccessibleAccounts(personId) {
  const person = await prisma.user.findUnique({
    where: { id: personId },
    select: {
      id: true,
      name: true,
      accountOwnerId: true,
      role: true,
      accountOwner: { select: { id: true, name: true } },
    },
  });
  if (!person) return [];

  const isOwnerHome = !person.accountOwnerId;
  const homeAccountId = person.accountOwnerId || person.id;
  const homeAccountName = isOwnerHome ? person.name : person.accountOwner?.name || 'A minha conta';

  const memberships = await prisma.accountMembership.findMany({
    where: { personId, active: true },
    select: { role: true, accountOwner: { select: { id: true, name: true, active: true } } },
  });

  const accounts = [
    {
      accountOwnerId: homeAccountId,
      accountName: homeAccountName,
      role: isOwnerHome ? 'owner' : person.role || 'user',
      isOwner: isOwnerHome,
      isHome: true,
    },
    ...memberships
      .filter((m) => m.accountOwner && m.accountOwner.active)
      .map((m) => ({
        accountOwnerId: m.accountOwner.id,
        accountName: m.accountOwner.name,
        role: m.role || 'user',
        isOwner: false,
        isHome: false,
      })),
  ];

  // Dedup defensivo (a conta casa não deve aparecer também como convidado).
  const seen = new Set();
  return accounts.filter((a) => (seen.has(a.accountOwnerId) ? false : seen.add(a.accountOwnerId)));
}

// GET /api/account/my-accounts - Contas a que o utilizador tem acesso
router.get('/my-accounts', async (req, res) => {
  try {
    const accounts = await listAccessibleAccounts(req.user.id);
    res.json({ accounts, activeAccountId: req.user.effectiveUserId });
  } catch (error) {
    console.error('Error listing accounts:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/account/select-active-account - Validar a conta activa escolhida
// (o frontend persiste a escolha e passa a enviar o header X-Account-Id).
router.post('/select-active-account', async (req, res) => {
  try {
    const accountOwnerId = Number(req.body?.accountOwnerId);
    if (!Number.isFinite(accountOwnerId)) {
      return res.status(400).json({ error: 'accountOwnerId inválido' });
    }
    const accounts = await listAccessibleAccounts(req.user.id);
    const match = accounts.find((a) => a.accountOwnerId === accountOwnerId);
    if (!match) {
      return res.status(403).json({ error: 'Sem acesso a esta conta', code: 'ACCOUNT_NOT_ACCESSIBLE' });
    }
    res.json({ ok: true, account: match });
  } catch (error) {
    console.error('Error selecting account:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
