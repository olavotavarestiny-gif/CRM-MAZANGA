function number(value) {
  if (value === null || value === undefined) return 0;
  return Number(value) || 0;
}

function safeDivide(numerator, denominator, multiplier = 1) {
  const divisor = number(denominator);
  if (divisor === 0) return null;
  return (number(numerator) / divisor) * multiplier;
}

function campaignKpis(campaign) {
  return {
    ctr: safeDivide(campaign.clicks, campaign.impressions, 100),
    cpl: safeDivide(campaign.investment, campaign.leads),
    qualifiedLeadCost: safeDivide(campaign.investment, campaign.qualifiedLeads),
    qualificationRate: safeDivide(campaign.qualifiedLeads, campaign.leads, 100),
    meetingConversion: safeDivide(campaign.meetingsGenerated, campaign.leads, 100),
    cac: safeDivide(campaign.investment, campaign.clientsWon),
    roas: safeDivide(campaign.attributedRevenue, campaign.investment),
  };
}

function goalProgress(actualValue, targetValue) {
  const fulfillment = safeDivide(actualValue, targetValue, 100);
  if (fulfillment === null) return { fulfillment: null, state: 'vermelho' };
  return {
    fulfillment,
    state: fulfillment >= 100 ? 'verde' : fulfillment >= 80 ? 'amarelo' : 'vermelho',
  };
}

function shouldMarkTaskOverdue(task, now = new Date()) {
  if (!task?.deadline || task.completionDate) return false;
  if (['concluido', 'cancelado', 'atrasado'].includes(task.status)) return false;
  return new Date(task.deadline).getTime() < now.getTime();
}

function calculateDashboard({ clients, campaigns, opportunities, tasks, transactions }) {
  const revenue = transactions.filter((item) => item.type === 'receita');
  const expenses = transactions.filter((item) => item.type === 'despesa');
  const revenueExpected = revenue.reduce((sum, item) => sum + number(item.expectedValue), 0);
  const revenueReceived = revenue.reduce((sum, item) => sum + number(item.actualValue), 0);
  const expensesPaid = expenses.reduce((sum, item) => sum + number(item.actualValue), 0);
  const profit = revenueReceived - expensesPaid;
  const openOpportunities = opportunities.filter((item) => !['ganho', 'perdido'].includes(item.stage));
  const won = opportunities.filter((item) => item.stage === 'ganho');
  const lost = opportunities.filter((item) => item.stage === 'perdido');
  const completed = tasks.filter((item) => item.status === 'concluido');
  const delayed = tasks.filter((item) => item.status === 'atrasado');

  return {
    cards: {
      revenueReceived,
      revenueExpected,
      expenses: expensesPaid,
      profit,
      profitMargin: safeDivide(profit, revenueReceived, 100),
      mrr: clients.filter((item) => item.status === 'ativo').reduce((sum, item) => sum + number(item.monthlyValue), 0),
      activeClients: clients.filter((item) => item.status === 'ativo').length,
      newClients: clients.filter((item) => item.status === 'ativo').length,
      lostClients: clients.filter((item) => item.status === 'cancelado').length,
      leads: opportunities.length,
      qualifiedLeads: opportunities.filter((item) => !['lead_recebido', 'primeiro_contacto'].includes(item.stage)).length,
      meetings: opportunities.filter((item) => item.meetingDate).length,
      proposals: opportunities.filter((item) => item.proposalDate).length,
      won: won.length,
      closeRate: safeDivide(won.length, won.length + lost.length, 100),
      pipelineValue: openOpportunities.reduce((sum, item) => sum + number(item.estimatedValue), 0),
      weightedPipeline: openOpportunities.reduce((sum, item) => sum + number(item.estimatedValue) * number(item.closeProbability) / 100, 0),
      completedTasks: completed.length,
      delayedTasks: delayed.length,
      onTimeRate: safeDivide(completed.filter((item) => item.deliveredOnTime).length, completed.length, 100),
    },
    campaignTotals: campaigns.reduce((acc, item) => ({
      investment: acc.investment + number(item.investment),
      leads: acc.leads + item.leads,
      revenue: acc.revenue + number(item.attributedRevenue),
    }), { investment: 0, leads: 0, revenue: 0 }),
  };
}

module.exports = {
  number,
  safeDivide,
  campaignKpis,
  goalProgress,
  shouldMarkTaskOverdue,
  calculateDashboard,
};
