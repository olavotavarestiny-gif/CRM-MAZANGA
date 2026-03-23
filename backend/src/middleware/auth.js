const { importJWK, jwtVerify } = require('jose');
const prisma = require('../lib/prisma');

// Supabase project's EC public key (from /auth/v1/.well-known/jwks.json)
// Public keys are safe to hardcode — they're not secret
const SUPABASE_JWK = {
  alg: 'ES256', crv: 'P-256',
  kid: 'bb424079-cb99-41be-97ee-ebd44cbd72d3',
  kty: 'EC',
  x: 'zHF8awnfE8CwkcTnZrTpetP8TOzQ-Nvnp6tTtHwcnyQ',
  y: 'sG2mdRZeicP-BLn1G8jXln1t1xNU50wRD6qNftFMRhc',
};

// Import once at startup — no network call needed
let _publicKey = null;
async function getPublicKey() {
  if (!_publicKey) {
    _publicKey = await importJWK(SUPABASE_JWK, 'ES256');
  }
  return _publicKey;
}

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  let decoded;
  try {
    const publicKey = await getPublicKey();
    const { payload } = await jwtVerify(token, publicKey, {
      issuer: `${process.env.SUPABASE_URL}/auth/v1`,
      audience: 'authenticated',
    });
    decoded = payload;
  } catch (error) {
    console.error('[auth] JWT verify error:', error.code || error.message);
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }

  const supabaseUid = decoded.sub;

  try {
    const user = await prisma.user.findUnique({
      where: { supabaseUid },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        accountOwnerId: true,
        mustChangePassword: true,
      },
    });

    if (!user || !user.active) {
      return res.status(403).json({ error: 'Conta desactivada. Contacte o administrador.' });
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      accountOwnerId: user.accountOwnerId || null,
      supabaseUid,
      effectiveUserId: user.accountOwnerId || user.id,
      isAccountOwner: !user.accountOwnerId,
      mustChangePassword: user.mustChangePassword,
    };
    next();
  } catch (error) {
    console.error('[auth] DB error:', error.message);
    res.status(500).json({ error: 'Erro ao verificar autenticação' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito a administradores' });
  }
  next();
}

function requireAccountOwner(req, res, next) {
  if (!req.user?.isAccountOwner) {
    return res.status(403).json({ error: 'Apenas o dono da conta pode realizar esta ação' });
  }
  next();
}

function requireAccountOwnerOrAdmin(req, res, next) {
  if (req.user?.role === 'admin' || req.user?.isAccountOwner) {
    return next();
  }
  return res.status(403).json({ error: 'Acesso não autorizado' });
}

module.exports = requireAuth;
module.exports.requireAdmin = requireAdmin;
module.exports.requireAccountOwner = requireAccountOwner;
module.exports.requireAccountOwnerOrAdmin = requireAccountOwnerOrAdmin;
