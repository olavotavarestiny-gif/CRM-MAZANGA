const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateGrowthMetrics, buildGrowthWarnings, validateGrowthPublication, buildGrowthPeriodTemplate, evaluateGrowthGoals } = require('./growth-room');

test('calcula métricas e gargalo do funil', () => {
  const metrics = calculateGrowthMetrics({ contacts: 100, qualifiedContacts: 30, meetings: 20, proposals: 10, sales: 5, investment: 100, attributedRevenue: 500 });
  assert.equal(metrics.estimatedReturn, 5);
  assert.equal(metrics.costPerContact, 1);
  assert.equal(metrics.suggestedBottleneck, 'qualifiedContacts');
  assert.equal(metrics.funnel[1].dropRate, 0.7);
});

test('divisões por zero retornam null', () => {
  const metrics = calculateGrowthMetrics({ contacts: 0, qualifiedContacts: 0, meetings: 0, proposals: 0, sales: 0, investment: 0, attributedRevenue: 0 });
  assert.equal(metrics.estimatedReturn, null);
  assert.equal(metrics.costPerContact, null);
  assert.equal(metrics.proposalToSaleRate, null);
});

test('divergências geram avisos sem invalidar o período', () => {
  const warnings = buildGrowthWarnings({ contacts: 10, qualifiedContacts: 12, meetings: 2, proposals: 1, sales: 1, attributedRevenue: 100, investment: 50, sources: [{ contacts: 8, revenue: 80 }], campaigns: [{ investment: 40 }] });
  assert.equal(warnings.length, 4);
});

test('publicação exige resumo e decisão', () => {
  assert.deepEqual(validateGrowthPublication({ periodName: 'Agosto', startDate: new Date(), endDate: new Date(), executiveSummary: '', strategicReading: {} }), {
    valid: false,
    missing: ['resumo da Mazanga', 'decisão recomendada'],
  });
});

test('novo período reutiliza apenas a estrutura e decisões pendentes', () => {
  const template = buildGrowthPeriodTemplate({
    sources: [{ sourceName: 'Meta Ads', contacts: 30, sales: 2, revenue: 500, qualityLabel: 'high', sortOrder: 1 }],
    campaigns: [{ name: 'Leads Luanda', objective: 'Leads', sourceName: 'Meta Ads', investment: 100, contacts: 30, sales: 2, revenue: 500, status: 'scale' }],
    decisions: [
      { decision: 'Rever landing page', status: 'in_progress', owner: 'Mazanga', priority: 'high' },
      { decision: 'Publicar campanha', status: 'completed' },
    ],
  });
  assert.equal(template.sources[0].sourceName, 'Meta Ads');
  assert.equal(template.sources[0].contacts, 0);
  assert.equal(template.campaigns[0].investment, 0);
  assert.equal(template.campaigns[0].status, 'testing');
  assert.deepEqual(template.decisions.map((decision) => decision.decision), ['Rever landing page']);
  assert.equal(template.decisions[0].status, 'next_action');
});

test('metas distinguem atingida, em risco, abaixo e indisponível', () => {
  const goals = evaluateGrowthGoals({
    contacts: 80, sales: 2, attributedRevenue: 200000, investment: 100000,
    client: { goal: { targetContacts: 100, targetSales: 4, targetRevenue: 200000, maxCostPerContact: 1000, minEstimatedReturn: 3 } },
  });
  assert.equal(goals.find((goal) => goal.key === 'contacts').status, 'at_risk');
  assert.equal(goals.find((goal) => goal.key === 'sales').status, 'below');
  assert.equal(goals.find((goal) => goal.key === 'revenue').status, 'achieved');
  assert.equal(goals.find((goal) => goal.key === 'costPerContact').status, 'at_risk');
  assert.equal(goals.find((goal) => goal.key === 'estimatedReturn').status, 'below');
  const unavailable = evaluateGrowthGoals({ contacts: 0, investment: 0, client: { goal: { maxCostPerContact: 1000 } } });
  assert.equal(unavailable[0].status, 'unavailable');
});
