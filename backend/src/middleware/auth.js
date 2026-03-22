const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  let decoded;
  try {
    // Verify with Supabase JWT secret (not the old JWT_SECRET)
    decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }

  // decoded.sub = Supabase UID (UUID)
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
