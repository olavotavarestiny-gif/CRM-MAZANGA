const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateGrowthMetrics, buildGrowthWarnings, validateGrowthPublication } = require('./growth-room');

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
