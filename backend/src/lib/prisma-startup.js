const prisma = require('./prisma');

const INITIAL_RETRY_DELAY_MS = 1_000;
const MAX_RETRY_DELAY_MS = 30_000;

const prismaStartupState = {
  ready: false,
  attempts: 0,
  lastError: null,
  lastSuccessAt: null,
};

let warmupPromise = null;
let shutdownRegistered = false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function warmupPrisma() {
  let retryDelay = INITIAL_RETRY_DELAY_MS;

  while (true) {
    prismaStartupState.attempts += 1;

    try {
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
      prismaStartupState.ready = true;
      prismaStartupState.lastError = null;
      prismaStartupState.lastSuccessAt = new Date().toISOString();
      console.info('[Startup] Prisma database connection ready');
      return;
    } catch (error) {
      prismaStartupState.ready = false;
      prismaStartupState.lastError = error?.message || 'Unknown Prisma startup error';
      try {
        await prisma.$disconnect();
      } catch (_disconnectError) {
        // Ignore disconnect failures between retries.
      }
      console.warn(
        `[Startup] Prisma warm-up failed (attempt ${prismaStartupState.attempts}). ` +
        `Retrying in ${retryDelay}ms. Error: ${prismaStartupState.lastError}`
      );
      await sleep(retryDelay);
      retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY_MS);
    }
  }
}

function startPrismaWarmup() {
  if (!warmupPromise) {
    warmupPromise = warmupPrisma().catch((error) => {
      prismaStartupState.ready = false;
      prismaStartupState.lastError = error?.message || 'Unknown Prisma warm-up crash';
      console.error('[Startup] Prisma warm-up loop stopped unexpectedly:', prismaStartupState.lastError);
    });
  }

  return warmupPromise;
}

function getPrismaStartupState() {
  return { ...prismaStartupState };
}

function registerPrismaShutdown() {
  if (shutdownRegistered) {
    return;
  }

  shutdownRegistered = true;

  const shutdown = async (signal) => {
    console.info(`[Startup] Received ${signal}. Disconnecting Prisma...`);

    try {
      await prisma.$disconnect();
      console.info('[Startup] Prisma disconnected');
    } catch (error) {
      console.warn('[Startup] Prisma disconnect failed:', error?.message || error);
    } finally {
      process.exit(0);
    }
  };

  process.once('SIGINT', () => {
    shutdown('SIGINT');
  });

  process.once('SIGTERM', () => {
    shutdown('SIGTERM');
  });
}

module.exports = {
  getPrismaStartupState,
  registerPrismaShutdown,
  startPrismaWarmup,
};
