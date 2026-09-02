const FUNNEL_STAGES = [
  ['contacts', 'Contactos recebidos'],
  ['qualifiedContacts', 'Contactos qualificados'],
  ['meetings', 'Reuniões'],
  ['proposals', 'Propostas'],
  ['sales', 'Vendas'],
];

function divide(numerator, denominator) {
  const top = Number(numerator || 0);
  const bottom = Number(denominator || 0);
  return bottom > 0 ? top / bottom : null;
}

function calculateGrowthMetrics(period) {
  const funnel = FUNNEL_STAGES.map(([key, label], index) => {
    const value = Number(period[key] || 0);
    const previous = index ? Number(period[FUNNEL_STAGES[index - 1][0]] || 0) : null;
    const conversion = index ? divide(value, previous) : 1;
    return {
      key,
      label,
      value,
      conversion,
      drop: previous === null ? 0 : previous - value,
      dropRate: previous === null ? 0 : divide(previous - value, previous),
    };
  });
  const bottleneck = funnel.slice(1).reduce((worst, stage) => {
    if (stage.dropRate === null) return worst;
    return !worst || stage.dropRate > worst.dropRate ? stage : worst;
  }, null);
  return {
    estimatedReturn: divide(period.attributedRevenue, period.investment),
    costPerContact: divide(period.investment, period.contacts),
    qualifiedRate: divide(period.qualifiedContacts, period.contacts),
    contactToMeetingRate: divide(period.meetings, period.contacts),
    proposalToSaleRate: divide(period.sales, period.proposals),
    averageTicket: divide(period.attributedRevenue, period.sales),
    funnel,
    suggestedBottleneck: bottleneck ? bottleneck.key : null,
  };
}

function buildGrowthWarnings(period) {
  const warnings = [];
  const sources = period.sources || [];
  const campaigns = period.campaigns || [];
  const sourceContacts = sources.reduce((sum, row) => sum + Number(row.contacts || 0), 0);
  const sourceRevenue = sources.reduce((sum, row) => sum + Number(row.revenue || 0), 0);
  const campaignInvestment = campaigns.reduce((sum, row) => sum + Number(row.investment || 0), 0);
  if (sources.length && sourceContacts !== Number(period.contacts || 0)) warnings.push('A soma dos contactos por origem difere do total do período.');
  if (sources.length && sourceRevenue !== Number(period.attributedRevenue || 0)) warnings.push('A soma da receita por origem difere da receita total.');
  if (campaigns.length && campaignInvestment !== Number(period.investment || 0)) warnings.push('A soma do investimento das campanhas difere do investimento total.');
  for (let index = 1; index < FUNNEL_STAGES.length; index += 1) {
    const [currentKey, currentLabel] = FUNNEL_STAGES[index];
    const [previousKey, previousLabel] = FUNNEL_STAGES[index - 1];
    if (Number(period[currentKey] || 0) > Number(period[previousKey] || 0)) {
      warnings.push(`${currentLabel} é superior a ${previousLabel}; confirma se existem oportunidades de períodos anteriores.`);
    }
  }
  return warnings;
}

function evaluateGrowthGoals(period) {
  const goal = period.client?.goal;
  if (!goal) return [];
  const metrics = calculateGrowthMetrics(period);
  const definitions = [
    ['contacts', 'Contactos', period.contacts, goal.targetContacts, 'count', 'minimum'],
    ['sales', 'Vendas', period.sales, goal.targetSales, 'count', 'minimum'],
    ['revenue', 'Receita', period.attributedRevenue, goal.targetRevenue, 'currency', 'minimum'],
    ['costPerContact', 'CPL máximo', metrics.costPerContact, goal.maxCostPerContact, 'currency', 'maximum'],
    ['estimatedReturn', 'Retorno mínimo', metrics.estimatedReturn, goal.minEstimatedReturn, 'multiple', 'minimum'],
  ];
  return definitions.flatMap(([key, label, rawActual, rawTarget, unit, direction]) => {
    const target = Number(rawTarget || 0);
    if (target <= 0) return [];
    const actual = rawActual === null || rawActual === undefined ? null : Number(rawActual);
    if (actual === null || !Number.isFinite(actual)) return [{ key, label, actual: null, target, unit, direction, progress: null, status: 'unavailable' }];
    const progress = direction === 'maximum'
      ? (actual <= 0 ? 1 : target / actual)
      : actual / target;
    const status = progress >= 1 ? 'achieved' : progress >= 0.7 ? 'at_risk' : 'below';
    return [{ key, label, actual, target, unit, direction, progress, status }];
  });
}

function validateGrowthPublication(period) {
  const missing = [];
  if (!period.periodName?.trim()) missing.push('nome do período');
  if (!period.startDate || !period.endDate) missing.push('datas do período');
  if (!period.executiveSummary?.trim()) missing.push('resumo da Mazanga');
  if (!period.strategicReading?.recommendedDecision?.trim() && !period.recommendation?.trim()) missing.push('decisão recomendada');
  return { valid: missing.length === 0, missing };
}

function serializeGrowthPeriod(period) {
  const clean = JSON.parse(JSON.stringify(period));
  delete clean.publications;
  return {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    period: clean,
    metrics: calculateGrowthMetrics(period),
    warnings: buildGrowthWarnings(period),
    goals: evaluateGrowthGoals(period),
  };
}

function buildGrowthPeriodTemplate(period) {
  if (!period) return { sources: [], campaigns: [], decisions: [] };
  return {
    sources: (period.sources || []).map((source, index) => ({
      sourceName: source.sourceName,
      contacts: 0,
      qualifiedContacts: 0,
      meetings: 0,
      proposals: 0,
      sales: 0,
      revenue: 0,
      qualityLabel: source.qualityLabel || 'medium',
      strategicReading: null,
      sortOrder: source.sortOrder ?? index,
    })),
    campaigns: (period.campaigns || []).map((campaign, index) => ({
      name: campaign.name,
      objective: campaign.objective || null,
      sourceName: campaign.sourceName || null,
      investment: 0,
      contacts: 0,
      sales: 0,
      revenue: 0,
      status: 'testing',
      decision: null,
      note: null,
      sortOrder: campaign.sortOrder ?? index,
    })),
    decisions: (period.decisions || [])
      .filter((decision) => !['completed', 'cancelled'].includes(decision.status))
      .map((decision, index) => ({
        decision: decision.decision,
        reason: decision.reason || null,
        owner: decision.owner || null,
        priority: decision.priority || 'medium',
        status: 'next_action',
        expectedImpact: decision.expectedImpact || null,
        sortOrder: decision.sortOrder ?? index,
      })),
  };
}

module.exports = {
  FUNNEL_STAGES,
  divide,
  calculateGrowthMetrics,
  buildGrowthWarnings,
  validateGrowthPublication,
  serializeGrowthPeriod,
  buildGrowthPeriodTemplate,
  evaluateGrowthGoals,
};
