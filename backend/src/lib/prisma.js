const { PrismaClient } = require('@prisma/client');
const { isDevAuthRequestContext } = require('./dev-auth');

const globalForPrisma = global;
const DEV_AUTH_BLOCKED_WRITE_ACTIONS = new Set([
  'create',
  'createMany',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
  'executeRaw',
  'executeRawUnsafe',
]);

if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = new PrismaClient();
}

if (!globalForPrisma.prismaDevAuthGuardInstalled) {
  globalForPrisma.prisma.$use(async (params, next) => {
    if (isDevAuthRequestContext() && DEV_AUTH_BLOCKED_WRITE_ACTIONS.has(params.action)) {
      const error = new Error('Modo DEV com auth desactivado bloqueou uma escrita na base de dados.');
      error.code = 'DEV_AUTH_DB_WRITE_BLOCKED';
      throw error;
    }

    return next(params);
  });
  globalForPrisma.prismaDevAuthGuardInstalled = true;
}

module.exports = globalForPrisma.prisma;
