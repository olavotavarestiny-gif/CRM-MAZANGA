'use strict';

const TEMPLATE_VERSION = 'startup_templates_v1';

const STARTUP_TEMPLATES = [
  {
    key: 'marketing_agency',
    label: 'Agência de Marketing',
    workspaceMode: 'servicos',
    description: 'Estrutura comercial para captar leads, enviar propostas e fechar contratos.',
    pipelineStages: ['Novo lead', 'Diagnóstico', 'Proposta enviada', 'Negociação', 'Fechado'],
    goals: ['10 leads mês', '5 propostas', '2 contratos fechados'],
    tasks: ['Follow-up', 'Enviar proposta', 'Reunião comercial'],
    financialCategories: ['Serviços Recorrentes', 'Projetos One-off', 'Anúncios Online', 'Ferramentas'],
  },
  {
    key: 'accounting_office',
    label: 'Escritório de Contabilidade',
    workspaceMode: 'servicos',
    description: 'Fluxo simples para organizar clientes, propostas e obrigações recorrentes.',
    pipelineStages: ['Novo pedido', 'Análise documental', 'Proposta enviada', 'Aguardando decisão', 'Fechado'],
    goals: ['8 novos contactos mês', '4 propostas', '2 contratos fechados'],
    tasks: ['Pedir documentos', 'Enviar proposta', 'Agendar reunião'],
    financialCategories: ['Serviços Recorrentes', 'Legal/Administrativo', 'Operação', 'Outras Receitas'],
  },
  {
    key: 'technical_services',
    label: 'Serviços Técnicos',
    workspaceMode: 'servicos',
    description: 'Pipeline prático para pedidos, orçamentos, execução e conclusão de serviços.',
    pipelineStages: ['Pedido recebido', 'Orçamento', 'Aprovado', 'Execução', 'Concluído'],
    goals: ['15 pedidos mês', '8 orçamentos', '5 serviços concluídos'],
    tasks: ['Confirmar disponibilidade', 'Enviar orçamento', 'Marcar execução'],
    financialCategories: ['Projetos One-off', 'Transporte', 'Ferramentas', 'Operação'],
  },
  {
    key: 'retail_store',
    label: 'Loja / Comércio',
    workspaceMode: 'comercio',
    description: 'Arranque orientado a produtos, caixa, venda rápida e equipa.',
    pipelineStages: [],
    goals: ['20 vendas semana', '10 produtos cadastrados', '1 fecho de caixa diário'],
    tasks: ['Cadastrar produtos principais', 'Conferir stock inicial', 'Abrir caixa'],
    financialCategories: ['Receitas de Faturação', 'Operação', 'Transporte', 'Outras Receitas'],
  },
  {
    key: 'clinic',
    label: 'Clínica',
    workspaceMode: 'servicos',
    description: 'Organização inicial para contactos, marcações e acompanhamento comercial.',
    pipelineStages: ['Novo contacto', 'Triagem', 'Consulta marcada', 'Tratamento proposto', 'Fechado'],
    goals: ['12 contactos mês', '8 consultas marcadas', '4 tratamentos fechados'],
    tasks: ['Confirmar consulta', 'Enviar lembrete', 'Acompanhar paciente'],
    financialCategories: ['Serviços Recorrentes', 'Projetos One-off', 'Operação', 'Legal/Administrativo'],
  },
];

function normalizeTemplateKey(key) {
  return typeof key === 'string' ? key.trim().toLowerCase() : '';
}

function getStartupTemplate(key) {
  const normalized = normalizeTemplateKey(key);
  return STARTUP_TEMPLATES.find((template) => template.key === normalized) || null;
}

function listStartupTemplates(workspaceMode) {
  const normalizedWorkspace = workspaceMode === 'comercio' ? 'comercio' : 'servicos';
  return STARTUP_TEMPLATES.filter(
    (template) => template.workspaceMode === normalizedWorkspace || template.key === 'retail_store'
  );
}

module.exports = {
  TEMPLATE_VERSION,
  STARTUP_TEMPLATES,
  getStartupTemplate,
  listStartupTemplates,
};
