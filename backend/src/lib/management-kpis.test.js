const test = require('node:test');
const assert = require('node:assert/strict');
const {
  safeDivide,
  campaignKpis,
  goalProgress,
  shouldMarkTaskOverdue,
  calculateDashboard,
} = require('./management-kpis');

test('safeDivide devolve null quando o denominador é zero', () => {
  assert.equal(safeDivide(100, 0, 100), null);
  assert.equal(safeDivide(25, 100, 100), 25);
});

test('campaignKpis calcula CTR, CPL, qualificação, CAC e ROAS', () => {
  const result = campaignKpis({
    impressions: 10_000,
    clicks: 500,
    investment: 200_000,
    leads: 100,
    qualifiedLeads: 40,
    meetingsGenerated: 20,
    clientsWon: 4,
    attributedRevenue: 1_000_000,
  });

  assert.deepEqual(result, {
    ctr: 5,
    cpl: 2_000,
    qualifiedLeadCost: 5_000,
    qualificationRate: 40,
    meetingConversion: 20,
    cac: 50_000,
    roas: 5,
  });
});

test('goalProgress aplica os estados verde, amarelo e vermelho', () => {
  assert.deepEqual(goalProgress(100, 100), { fulfillment: 100, state: 'verde' });
  assert.deepEqual(goalProgress(85, 100), { fulfillment: 85, state: 'amarelo' });
  assert.deepEqual(goalProgress(79, 100), { fulfillment: 79, state: 'vermelho' });
  assert.deepEqual(goalProgress(10, 0), { fulfillment: null, state: 'vermelho' });
});

test('shouldMarkTaskOverdue ignora tarefas concluídas e marca tarefas vencidas', () => {
  const now = new Date('2026-07-23T12:00:00.000Z');
  assert.equal(shouldMarkTaskOverdue({ deadline: '2026-07-22T12:00:00.000Z', status: 'em_producao' }, now), true);
  assert.equal(shouldMarkTaskOverdue({ deadline: '2026-07-22T12:00:00.000Z', status: 'concluido' }, now), false);
  assert.equal(shouldMarkTaskOverdue({ deadline: '2026-07-24T12:00:00.000Z', status: 'em_producao' }, now), false);
});

test('calculateDashboard respeita lucro, fecho, pipeline ponderado e entrega no prazo', () => {
  const result = calculateDashboard({
    clients: [
      { status: 'ativo', monthlyValue: 300_000 },
      { status: 'cancelado', monthlyValue: 100_000 },
    ],
    campaigns: [{ investment: 100_000, leads: 10, attributedRevenue: 500_000 }],
    opportunities: [
      { stage: 'negociacao', estimatedValue: 2_000_000, closeProbability: 50 },
      { stage: 'ganho', estimatedValue: 1_000_000, closeProbability: 100 },
      { stage: 'perdido', estimatedValue: 500_000, closeProbability: 0 },
    ],
    tasks: [
      { status: 'concluido', deliveredOnTime: true },
      { status: 'concluido', deliveredOnTime: false },
      { status: 'atrasado', deliveredOnTime: null },
    ],
    transactions: [
      { type: 'receita', expectedValue: 1_500_000, actualValue: 1_200_000 },
      { type: 'despesa', expectedValue: 400_000, actualValue: 300_000 },
    ],
  });

  assert.equal(result.cards.profit, 900_000);
  assert.equal(result.cards.profitMargin, 75);
  assert.equal(result.cards.closeRate, 50);
  assert.equal(result.cards.pipelineValue, 2_000_000);
  assert.equal(result.cards.weightedPipeline, 1_000_000);
  assert.equal(result.cards.onTimeRate, 50);
  assert.equal(result.cards.mrr, 300_000);
});
