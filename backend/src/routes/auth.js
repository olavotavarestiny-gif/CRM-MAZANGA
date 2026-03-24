const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const prisma = require('../lib/prisma');
const requireAuth = require('../middleware/auth');
const { importJWK, jwtVerify } = require('jose');

// Lazy Supabase admin client — only created when first used so missing env vars
// don't crash the server on startup
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

// Shared EC public key for JWT verification (same key as middleware/auth.js)
const SUPABASE_JWK = {
  alg: 'ES256', crv: 'P-256',
  kid: 'bb424079-cb99-41be-97ee-ebd44cbd72d3',
  kty: 'EC',
  x: 'zHF8awnfE8CwkcTnZrTpetP8TOzQ-Nvnp6tTtHwcnyQ',
  y: 'sG2mdRZeicP-BLn1G8jXln1t1xNU50wRD6qNftFMRhc',
};
let _publicKey = null;
async function getPublicKey() {
  if (!_publicKey) _publicKey = await importJWK(SUPABASE_JWK, 'ES256');
  return _publicKey;
}

// POST /api/auth/sync
// Called by the frontend after Supabase login to link supabaseUid → User record.
// Verifies the Supabase JWT from the Authorization header (no service role key needed).
router.post('/sync', async (req, res) => {
  try {
    const { supabaseUid, email } = req.body;
    if (!supabaseUid || !email) {
      return res.status(400).json({ error: 'supabaseUid e email são obrigatórios' });
    }

    // Verify the JWT token to confirm the supabaseUid is genuine
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Token de autenticação em falta' });
    }
    try {
      const publicKey = await getPublicKey();
      const { payload } = await jwtVerify(token, publicKey, {
        issuer: `${process.env.SUPABASE_URL}/auth/v1`,
        audience: 'authenticated',
      });
      if (payload.sub !== supabaseUid) {
        return res.status(401).json({ error: 'Token não corresponde ao utilizador' });
      }
    } catch {
      return res.status(401).json({ error: 'Token inválido ou expirado' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: 'Utilizador não encontrado' });
    }

    if (user.supabaseUid && user.supabaseUid !== supabaseUid) {
      return res.status(409).json({ error: 'Email já associado a outra conta Supabase' });
    }

    if (!user.supabaseUid) {
      await prisma.user.update({
        where: { id: user.id },
        data: { supabaseUid },
      });
    }

    res.json({ ok: true, userId: user.id, mustChangePassword: user.mustChangePassword });
  } catch (error) {
    console.error('Error syncing user:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/auth/me - Dados do utilizador autenticado
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true, name: true, email: true, role: true, active: true,
        plan: true, allowedPages: true, mustChangePassword: true,
        accountOwnerId: true, createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'Utilizador não encontrado' });
    }

    let effectiveAllowedPages = user.allowedPages ? JSON.parse(user.allowedPages) : null;
    let effectivePlan = user.plan;
    let accountOwnerName = null;

    if (user.accountOwnerId) {
      // Team member — inherit plan and compute effective allowedPages from org owner
      const owner = await prisma.user.findUnique({
        where: { id: user.accountOwnerId },
        select: { plan: true, allowedPages: true, name: true },
      });
      if (owner) {
        effectivePlan = owner.plan || 'essencial';
        accountOwnerName = owner.name;
        const orgAllowed = owner.allowedPages ? JSON.parse(owner.allowedPages) : null;
        const memberAllowed = effectiveAllowedPages;
        if (orgAllowed && memberAllowed) {
          effectiveAllowedPages = orgAllowed.filter(p => memberAllowed.includes(p));
        } else {
          effectiveAllowedPages = orgAllowed || memberAllowed; // null if both null
        }
      }
    }

    res.json({
      ...user,
      plan: effectivePlan,
      allowedPages: effectiveAllowedPages,
      accountOwnerName,
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/change-password
// For first-time password change (mustChangePassword=true) or regular password change
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Nova password deve ter pelo menos 6 caracteres' });
    }

    // Update password in Supabase Auth
    const { error } = await getSupabaseAdmin().auth.admin.updateUserById(req.user.supabaseUid, {
      password: newPassword,
    });

    if (error) {
      const raw = (error.message || '').toLowerCase();
      let msg = 'Não foi possível alterar a password. Tente novamente.';
      if (raw.includes('at least') || raw.includes('characters') || raw.includes('length')) {
        msg = 'A password deve ter pelo menos 6 caracteres.';
      } else if (raw.includes('weak') || raw.includes('strong') || raw.includes('strength')) {
        msg = 'A password é demasiado fraca. Use letras maiúsculas, minúsculas, números e símbolos.';
      } else if (raw.includes('number') || raw.includes('digit')) {
        msg = 'A password deve conter pelo menos um número.';
      } else if (raw.includes('uppercase') || raw.includes('lower')) {
        msg = 'A password deve conter letras maiúsculas e minúsculas.';
      } else if (raw.includes('special') || raw.includes('symbol')) {
        msg = 'A password deve conter pelo menos um símbolo especial (ex: @, #, !).';
      } else if (raw.includes('same') || raw.includes('different') || raw.includes('previous')) {
        msg = 'A nova password não pode ser igual à anterior.';
      }
      return res.status(400).json({ error: msg });
    }

    // Clear mustChangePassword flag
    await prisma.user.update({
      where: { id: req.user.id },
      data: { mustChangePassword: false },
    });

    res.json({ message: 'Password alterada com sucesso' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/acknowledge-password-change
// Called after a successful Supabase password reset (forgot-password flow)
// to clear the mustChangePassword flag without re-setting the password.
router.post('/acknowledge-password-change', requireAuth, async (req, res) => {
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { mustChangePassword: false },
    });
    res.json({ message: 'OK' });
  } catch (error) {
    console.error('Error acknowledging password change:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
