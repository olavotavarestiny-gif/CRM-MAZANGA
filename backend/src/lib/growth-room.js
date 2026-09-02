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
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    period: clean,
    metrics: calculateGrowthMetrics(period),
    warnings: buildGrowthWarnings(period),
  };
}

module.exports = {
  FUNNEL_STAGES,
  divide,
  calculateGrowthMetrics,
  buildGrowthWarnings,
  validateGrowthPublication,
  serializeGrowthPeriod,
};
