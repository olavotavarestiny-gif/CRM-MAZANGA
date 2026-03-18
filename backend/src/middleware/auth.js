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
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }

  // Verificar se o utilizador ainda está activo na BD
  try {
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { active: true },
    });
    if (!user || !user.active) {
      return res.status(403).json({ error: 'Conta desactivada. Contacte o administrador.' });
    }
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao verificar autenticação' });
  }

  req.user = decoded;
  next();
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito a administradores' });
  }
  next();
}

module.exports = requireAuth;
module.exports.requireAdmin = requireAdmin;
