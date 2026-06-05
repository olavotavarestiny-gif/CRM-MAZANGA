const prisma = require('./prisma');

const DEFAULT_DEAL_STAGES = [
  { name: 'Qualificação', color: '#6b7e9a' },
  { name: 'Reunião', color: '#8B5CF6' },
  { name: 'Proposta', color: '#F59E0B' },
  { name: 'Aprovação', color: '#3B82F6' },
  { name: 'Fechado', color: '#22C55E' },
];

// Garante que o utilizador tem o funil B2B semeado. Idempotente.
async function ensureDefaultDealStages(userId) {
  const count = await prisma.dealStage.count({ where: { userId } });
  if (count > 0) return;

  await prisma.dealStage.createMany({
    data: DEFAULT_DEAL_STAGES.map((s, i) => ({
      userId,
      name: s.name,
      color: s.color,
      order: i,
    })),
    skipDuplicates: true,
  });
}

module.exports = { ensureDefaultDealStages, DEFAULT_DEAL_STAGES };
