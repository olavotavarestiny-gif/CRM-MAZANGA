const prisma = require('./prisma');

const DEFAULT_STAGES = [
  { name: 'Novo', color: '#3B82F6', order: 0 },
  { name: 'Contactado', color: '#F59E0B', order: 1 },
  { name: 'Qualificado', color: '#8B5CF6', order: 2 },
  { name: 'Proposta Enviada', color: '#F97316', order: 3 },
  { name: 'Fechado', color: '#10B981', order: 4 },
  { name: 'Perdido', color: '#6B7280', order: 5 },
];

async function ensureDefaultStages(userId) {
  const count = await prisma.pipelineStage.count({ where: { userId } });

  if (count === 0) {
    await prisma.pipelineStage.createMany({
      data: DEFAULT_STAGES.map((stage) => ({ ...stage, userId })),
      skipDuplicates: true,
    });
  }
}

async function getPipelineStages(userId) {
  await ensureDefaultStages(userId);

  return prisma.pipelineStage.findMany({
    where: { userId },
    orderBy: { order: 'asc' },
  });
}

async function getDefaultStageName(userId) {
  const stages = await getPipelineStages(userId);
  return stages[0]?.name || DEFAULT_STAGES[0].name;
}

async function isValidStageName(userId, stageName) {
  if (!stageName) {
    return false;
  }

  await ensureDefaultStages(userId);

  const stage = await prisma.pipelineStage.findFirst({
    where: { userId, name: stageName },
    select: { id: true },
  });

  return Boolean(stage);
}

async function resolveStageName(userId, stageName) {
  if (stageName && await isValidStageName(userId, stageName)) {
    return stageName;
  }

  return getDefaultStageName(userId);
}

module.exports = {
  DEFAULT_STAGES,
  ensureDefaultStages,
  getPipelineStages,
  getDefaultStageName,
  isValidStageName,
  resolveStageName,
};
