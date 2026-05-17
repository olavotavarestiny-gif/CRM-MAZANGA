import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import {
  DEV_AUTH_USER,
  isDevAuthSessionActive,
  writeDevAuthSession,
} from './dev-auth';

const DEV_SAMPLE_STATE_KEY = 'kukugest:dev-sample-state';
const DEV_USER_ID = -1001;

type DevState = {
  contacts: any[];
  groups: any[];
  stages: any[];
  tasks: any[];
  forms: any[];
  submissions: any[];
  transactions: any[];
  categories: any[];
  products: any[];
  facturas: any[];
  automations: any[];
  chatChannels: any[];
  chatMessages: Record<string, any[]>;
};

function nowIso() {
  return new Date().toISOString();
}

function daysFromNow(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function createInitialState() {
  const createdAt = '2026-05-01T09:00:00.000Z';
  const stages = [
    { id: 'dev-stage-novo', userId: DEV_USER_ID, name: 'Novo', color: '#3B82F6', order: 1, createdAt },
    { id: 'dev-stage-qualificacao', userId: DEV_USER_ID, name: 'Qualificação', color: '#F59E0B', order: 2, createdAt },
    { id: 'dev-stage-proposta', userId: DEV_USER_ID, name: 'Proposta', color: '#8B5CF6', order: 3, createdAt },
    { id: 'dev-stage-fechado', userId: DEV_USER_ID, name: 'Fechado', color: '#10B981', order: 4, createdAt },
  ];
  const groups = [
    { id: 'dev-group-enterprise', userId: DEV_USER_ID, name: 'Enterprise', createdAt, updatedAt: createdAt },
    { id: 'dev-group-pme', userId: DEV_USER_ID, name: 'PME', createdAt, updatedAt: createdAt },
  ];
  const contacts = [
    {
      id: 101,
      name: 'Ana Kiala',
      email: 'ana@kilamba-logistica.ao',
      phone: '+244 923 100 001',
      company: 'Kilamba Logistica',
      location: 'Luanda',
      birthDate: '1990-05-18',
      lastActivityAt: daysFromNow(-1),
      contactGroupId: 'dev-group-enterprise',
      nif: '5001234567',
      dealValueKz: 2800000,
      revenue: 'enterprise',
      sector: 'Logistica',
      stage: 'Proposta',
      inPipeline: true,
      tags: ['lead-quente', 'demo'],
      customFields: { origem: 'Formulario' },
      contactType: 'interessado' as const,
      status: 'ativo' as const,
      clienteType: 'empresa' as const,
      documents: [],
      createdAt,
      updatedAt: nowIso(),
      contactGroup: groups[0],
    },
    {
      id: 102,
      name: 'Miguel Andrade',
      email: 'miguel@baiaeventos.ao',
      phone: '+244 923 100 002',
      company: 'Baia Eventos',
      location: 'Benguela',
      birthDate: '1987-11-02',
      lastActivityAt: daysFromNow(-3),
      contactGroupId: 'dev-group-pme',
      nif: '5007654321',
      dealValueKz: 950000,
      revenue: 'profissional',
      sector: 'Eventos',
      stage: 'Qualificação',
      inPipeline: true,
      tags: ['whatsapp'],
      customFields: { origem: 'WhatsApp' },
      contactType: 'cliente' as const,
      status: 'ativo' as const,
      clienteType: 'empresa' as const,
      documents: [],
      createdAt,
      updatedAt: nowIso(),
      contactGroup: groups[1],
    },
    {
      id: 103,
      name: 'Carla Mendes',
      email: 'carla@email.test',
      phone: '+244 923 100 003',
      company: 'Independente',
      location: 'Huambo',
      birthDate: '1995-01-14',
      lastActivityAt: daysFromNow(-8),
      contactGroupId: null,
      nif: null,
      dealValueKz: 420000,
      revenue: 'essencial',
      sector: 'Consultoria',
      stage: 'Fechado',
      inPipeline: false,
      tags: ['cliente'],
      customFields: { origem: 'Indicacao' },
      contactType: 'cliente' as const,
      status: 'ativo' as const,
      clienteType: 'particular' as const,
      documents: [],
      createdAt,
      updatedAt: nowIso(),
      contactGroup: null,
    },
  ];
  const tasks = [
    {
      id: 501,
      contactId: 101,
      assignedToUserId: DEV_USER_ID,
      title: 'Enviar proposta comercial',
      notes: 'Preparar pacote Enterprise com automacoes e formularios.',
      dueDate: daysFromNow(1),
      priority: 'Alta' as const,
      done: false,
      source: 'manual',
      createdAt,
      updatedAt: nowIso(),
      contact: { id: 101, name: 'Ana Kiala', company: 'Kilamba Logistica' },
      assignedTo: { id: DEV_USER_ID, name: 'Dev Tester', email: 'dev@local.test' },
    },
    {
      id: 502,
      contactId: 102,
      assignedToUserId: DEV_USER_ID,
      title: 'Follow-up WhatsApp',
      notes: 'Confirmar disponibilidade para demo.',
      dueDate: daysFromNow(0),
      priority: 'Media' as const,
      done: false,
      source: 'automation',
      createdAt,
      updatedAt: nowIso(),
      contact: { id: 102, name: 'Miguel Andrade', company: 'Baia Eventos' },
      assignedTo: { id: DEV_USER_ID, name: 'Dev Tester', email: 'dev@local.test' },
    },
  ];
  const forms = [
    {
      id: 'dev-form-leads',
      title: 'Pedido de Demonstração',
      description: 'Formulário demo para captar leads no modo desenvolvimento.',
      mode: 'step' as const,
      thankYouUrl: '',
      brandColor: '#0A2540',
      bgColor: '#F5F7F9',
      createdAt,
      updatedAt: nowIso(),
      _count: { submissions: 2 },
      fields: [
        { id: 'dev-field-name', formId: 'dev-form-leads', type: 'text' as const, label: 'Nome', required: true, order: 1, contactField: 'name' },
        { id: 'dev-field-phone', formId: 'dev-form-leads', type: 'text' as const, label: 'Telefone', required: true, order: 2, contactField: 'phone' },
        { id: 'dev-field-interest', formId: 'dev-form-leads', type: 'multiple_choice' as const, label: 'Interesse principal', required: true, order: 3, options: ['CRM', 'Faturacao', 'Automacoes'], contactField: 'tags' },
      ],
    },
    {
      id: 'dev-form-satisfacao',
      title: 'Satisfação do Cliente',
      description: 'Questionário curto depois da entrega do serviço.',
      mode: 'single' as const,
      thankYouUrl: '',
      brandColor: '#B31B25',
      bgColor: '#FFFFFF',
      createdAt,
      updatedAt: nowIso(),
      _count: { submissions: 1 },
      fields: [
        { id: 'dev-field-rating', formId: 'dev-form-satisfacao', type: 'multiple_choice' as const, label: 'Como avalia o serviço?', required: true, order: 1, options: ['Excelente', 'Bom', 'A melhorar'] },
        { id: 'dev-field-comment', formId: 'dev-form-satisfacao', type: 'text' as const, label: 'Comentário', required: false, order: 2 },
      ],
    },
  ];
  const submissions = [
    {
      id: 'dev-sub-1',
      formId: 'dev-form-leads',
      contactId: 101,
      contactSyncStatus: 'created' as const,
      submittedAt: daysFromNow(-2),
      contact: { id: 101, name: 'Ana Kiala', phone: '+244 923 100 001', email: 'ana@kilamba-logistica.ao', company: 'Kilamba Logistica', stage: 'Proposta', inPipeline: true },
      form: { id: 'dev-form-leads', title: 'Pedido de Demonstração' },
      answers: [
        { id: 'dev-ans-1', fieldId: 'dev-field-name', fieldLabel: 'Nome', contactField: 'name', value: 'Ana Kiala' },
        { id: 'dev-ans-2', fieldId: 'dev-field-interest', fieldLabel: 'Interesse principal', contactField: 'tags', value: 'CRM' },
      ],
    },
    {
      id: 'dev-sub-2',
      formId: 'dev-form-leads',
      contactId: 102,
      contactSyncStatus: 'updated' as const,
      submittedAt: daysFromNow(-4),
      contact: { id: 102, name: 'Miguel Andrade', phone: '+244 923 100 002', email: 'miguel@baiaeventos.ao', company: 'Baia Eventos', stage: 'Qualificação', inPipeline: true },
      form: { id: 'dev-form-leads', title: 'Pedido de Demonstração' },
      answers: [
        { id: 'dev-ans-3', fieldId: 'dev-field-name', fieldLabel: 'Nome', contactField: 'name', value: 'Miguel Andrade' },
        { id: 'dev-ans-4', fieldId: 'dev-field-interest', fieldLabel: 'Interesse principal', contactField: 'tags', value: 'Automacoes' },
      ],
    },
  ];
  const transactions = [
    { id: 'dev-tx-1', date: '2026-05-04', clientId: 101, clientName: 'Kilamba Logistica', type: 'entrada' as const, revenueType: 'one-off' as const, category: 'Serviços', subcategory: 'Implementação', description: 'Setup CRM', amountKz: 1200000, currencyOrigin: 'KZ' as const, exchangeRate: 1, paymentMethod: 'Transferência', status: 'pago' as const, deleted: false, createdAt, updatedAt: nowIso(), contact: { id: 101, name: 'Ana Kiala', company: 'Kilamba Logistica' } },
    { id: 'dev-tx-2', date: '2026-05-08', clientId: 102, clientName: 'Baia Eventos', type: 'entrada' as const, revenueType: 'recorrente' as const, category: 'Subscrição', subcategory: 'Mensal', description: 'Plano Profissional', amountKz: 350000, currencyOrigin: 'KZ' as const, exchangeRate: 1, paymentMethod: 'Multicaixa', status: 'pendente' as const, deleted: false, createdAt, updatedAt: nowIso(), contact: { id: 102, name: 'Miguel Andrade', company: 'Baia Eventos' } },
    { id: 'dev-tx-3', date: '2026-05-10', type: 'saida' as const, category: 'Operação', subcategory: 'Software', description: 'Ferramentas cloud', amountKz: 180000, currencyOrigin: 'KZ' as const, exchangeRate: 1, paymentMethod: 'Cartão', status: 'pago' as const, deleted: false, createdAt, updatedAt: nowIso() },
  ];
  const products = [
    { id: 'dev-prod-1', productCode: 'CRM-SETUP', productDescription: 'Implementação CRM', unitPrice: 850000, cost: 240000, margin: 71.76, productType: 'S', unitOfMeasure: 'un', taxPercentage: 14, taxCode: 'NOR', active: true, stock: null, stockMinimo: null },
    { id: 'dev-prod-2', productCode: 'SUB-MENSAL', productDescription: 'Subscrição Mensal', unitPrice: 350000, cost: 60000, margin: 82.85, productType: 'S', unitOfMeasure: 'mes', taxPercentage: 14, taxCode: 'NOR', active: true, stock: null, stockMinimo: null },
  ];
  const facturas = [
    {
      id: 'dev-fat-1',
      documentNo: 'FT DEV/2026/1',
      documentType: 'FT',
      documentStatus: 'N' as const,
      customerTaxID: '5001234567',
      customerName: 'Kilamba Logistica',
      customerAddress: 'Luanda',
      lines: [{ lineNumber: 1, productCode: 'CRM-SETUP', productDescription: 'Implementação CRM', quantity: 1, unitPrice: 850000, unitOfMeasure: 'un', settlementAmount: 0, taxes: [{ taxType: 'IVA', taxCode: 'NOR', taxPercentage: 14, taxAmount: 119000 }] }],
      netTotal: 850000,
      taxPayable: 119000,
      grossTotal: 969000,
      jwsSignature: 'DEV-SIGNATURE',
      agtValidationStatus: 'P' as const,
      baseCurrency: 'AOA',
      displayCurrency: 'AOA',
      isOffline: false,
      documentDate: '2026-05-05',
      createdAt,
      currencyCode: 'AOA',
      paymentMethod: 'TRANSFERENCIA',
      serie: { seriesCode: 'DEV', seriesYear: 2026, documentType: 'FT' },
      estabelecimento: { id: 'dev-est-1', nome: 'Sede Dev', nif: '5000000000' },
    },
  ];
  const automations = [
    {
      id: 'dev-auto-1',
      trigger: 'form_submission',
      formId: 'dev-form-leads',
      action: 'create_task',
      taskTitle: 'Follow-up automático',
      taskPriority: 'Alta' as const,
      active: true,
      form: { id: 'dev-form-leads', title: 'Pedido de Demonstração' },
      executionSummary: {
        automationId: 'dev-auto-1',
        totalExecutions: 14,
        executionsLast30Days: 8,
        successfulExecutionsLast30Days: 7,
        failedExecutionsLast30Days: 1,
        successRateLast30Days: 87.5,
        lastExecution: { success: true, created_at: daysFromNow(-1), duration_ms: 180 },
      },
    },
  ];
  const chatChannels = [
    {
      id: 'dev-chat-geral',
      name: 'Geral',
      description: 'Canal demo da equipa',
      type: 'channel' as const,
      orgId: DEV_USER_ID,
      createdById: DEV_USER_ID,
      createdAt,
      members: [{ userId: DEV_USER_ID, name: 'Dev Tester', email: 'dev@local.test' }, { userId: -1002, name: 'Marta Demo', email: 'marta@local.test' }],
      unreadCount: 1,
      lastMessage: { text: 'A proposta demo ficou pronta.', createdAt: daysFromNow(-1), senderName: 'Marta Demo' },
    },
  ];
  const chatMessages = {
    'dev-chat-geral': [
      { id: 'dev-msg-1', channelId: 'dev-chat-geral', senderId: -1002, senderName: 'Marta Demo', senderEmail: 'marta@local.test', text: 'A proposta demo ficou pronta.', attachments: [], mentions: [], createdAt: daysFromNow(-1) },
      { id: 'dev-msg-2', channelId: 'dev-chat-geral', senderId: DEV_USER_ID, senderName: 'Dev Tester', senderEmail: 'dev@local.test', text: 'Obrigado, vou rever nos relatórios.', attachments: [], mentions: [], createdAt: daysFromNow(-1) },
    ],
  } as Record<string, any[]>;

  return {
    contacts,
    groups,
    stages,
    tasks,
    forms,
    submissions,
    transactions,
    categories: [
      { id: 'dev-cat-1', type: 'entrada' as const, category: 'Serviços', subcategories: ['Implementação', 'Consultoria'], color: '#10B981', icon: 'briefcase' },
      { id: 'dev-cat-2', type: 'entrada' as const, category: 'Subscrição', subcategories: ['Mensal'], color: '#3B82F6', icon: 'refresh' },
      { id: 'dev-cat-3', type: 'saida' as const, category: 'Operação', subcategories: ['Software'], color: '#EF4444', icon: 'settings' },
    ],
    products,
    facturas,
    automations,
    chatChannels,
    chatMessages,
  };
}

function readState(): DevState {
  if (typeof window === 'undefined') return createInitialState();
  const raw = sessionStorage.getItem(DEV_SAMPLE_STATE_KEY);
  if (!raw) {
    const initial = createInitialState();
    sessionStorage.setItem(DEV_SAMPLE_STATE_KEY, JSON.stringify(initial));
    return initial;
  }

  try {
    return JSON.parse(raw) as DevState;
  } catch {
    const initial = createInitialState();
    sessionStorage.setItem(DEV_SAMPLE_STATE_KEY, JSON.stringify(initial));
    return initial;
  }
}

function writeState(state: DevState) {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(DEV_SAMPLE_STATE_KEY, JSON.stringify(state));
  }
}

function paginate<T>(data: T[], params: URLSearchParams) {
  const page = Math.max(1, Number(params.get('page') || 1));
  const limit = Math.max(1, Number(params.get('limit') || data.length || 1));
  const total = data.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return { page, limit, total, totalPages, data: data.slice((page - 1) * limit, page * limit) };
}

function makeRange() {
  return {
    period: '30d' as const,
    granularity: 'day' as const,
    dayCount: 30,
    start: '2026-04-17',
    end: '2026-05-16',
    previousStart: '2026-03-18',
    previousEnd: '2026-04-16',
  };
}

function financeDashboard(state: DevState) {
  const active = state.transactions.filter((transaction) => !transaction.deleted);
  const revenue = active.filter((transaction) => transaction.type === 'entrada' && transaction.status === 'pago').reduce((sum, transaction) => sum + transaction.amountKz, 0);
  const expenses = active.filter((transaction) => transaction.type === 'saida' && transaction.status === 'pago').reduce((sum, transaction) => sum + transaction.amountKz, 0);
  const receivables = active.filter((transaction) => transaction.type === 'entrada' && transaction.status !== 'pago');
  const profit = revenue - expenses;
  return {
    revenue,
    expenses,
    profit,
    marginPercent: revenue ? (profit / revenue) * 100 : 0,
    mrr: 350000,
    receitaMensal: 350000,
    prevRevenue: 900000,
    prevExpenses: 220000,
    prevProfit: 680000,
    companyCashBalance: 5200000,
    openingBalance: 4100000,
    receivablesCount: receivables.length,
    receivablesTotal: receivables.reduce((sum, transaction) => sum + transaction.amountKz, 0),
  };
}

function servicesDashboard(state: DevState) {
  return {
    generatedAt: nowIso(),
    range: { period: '30d', start: '2026-04-17', end: '2026-05-16' },
    permissions: { revenue: true, pipeline: true, tasks: true },
    activeFilters: { period: '30d', responsibleUserId: null, stage: null, leadOrigin: null, segment: null },
    filters: {
      periods: [{ value: '30d', label: '30 dias' }, { value: '90d', label: '90 dias' }],
      responsibleUsers: [{ value: String(DEV_USER_ID), label: 'Dev Tester' }],
      stages: state.stages.map((stage) => ({ value: stage.name, label: stage.name, color: stage.color })),
      leadOrigins: [{ value: 'Formulario', label: 'Formulário' }, { value: 'WhatsApp', label: 'WhatsApp' }],
      segments: [{ value: 'Enterprise', label: 'Enterprise' }, { value: 'PME', label: 'PME' }],
    },
    kpis: {
      closedRevenue: 1200000,
      pipelineOpenValue: 3750000,
      winRate: 34,
      averageDealValue: 1250000,
      averageSalesCycleDays: 12,
      pipelineVelocity: 312500,
      openOpportunities: 2,
      wonCount: 1,
      lostCount: 0,
    },
    goal: { monthlyRevenueGoalKz: 5000000, attainmentPercent: 24, gapKz: 3800000 },
    headline: { monthlyForecastKz: 4300000, riskDealsCount: 1, summary: 'Pipeline demo com propostas activas e follow-ups pendentes.' },
    healthScore: { score: 78, status: 'saudavel' as const, reasons: ['Boa cobertura de follow-up', 'Receita recorrente activa'] },
    kpiContext: {
      pipelineOpenValue: 'Inclui oportunidades em Qualificação e Proposta.',
      averageSalesCycleDays: 'Calculado a partir dos contactos demo.',
      averageDealValue: 'Baseado em dealValueKz.',
      followUpsToday: '1 follow-up para hoje.',
    },
    pipelineHealth: {
      byStage: state.stages.map((stage, index) => ({ stage: stage.name, color: stage.color, count: Math.max(0, 3 - index), averageDaysInStage: 2 + index * 3, conversionRate: 70 - index * 10, winRateFromStage: 35 + index * 8 })),
      slowestStage: { stage: 'Proposta', averageDaysInStage: 11 },
      staleDeals: [{ id: 101, name: 'Ana Kiala', company: 'Kilamba Logistica', stage: 'Proposta', daysInStage: 11, lastActivityDays: 3 }],
      leadsWithoutFollowUp: [{ id: 102, name: 'Miguel Andrade', company: 'Baia Eventos', stage: 'Qualificação', lastActivityDays: 5 }],
    },
    nextActions: {
      overdueTasks: [],
      followUpsToday: state.tasks.filter((task) => !task.done).slice(0, 1),
      birthdaysToday: [],
      alerts: [{ id: 'dev-alert-1', title: 'Lead quente sem resposta', message: 'Ana Kiala espera proposta.', type: 'pipeline', createdAt: nowIso(), contact: { id: 101, name: 'Ana Kiala', company: 'Kilamba Logistica' } }],
    },
  };
}

function automationStats(state: DevState) {
  const automation = state.automations[0];
  const log = {
    id: 'dev-log-1',
    automation_id: automation.id,
    organization_id: DEV_USER_ID,
    trigger_type: automation.trigger,
    trigger_data: { formId: 'dev-form-leads' },
    action_type: automation.action,
    action_data: { taskTitle: 'Follow-up automático' },
    success: true,
    contact_id: 101,
    duration_ms: 180,
    created_at: daysFromNow(-1),
    automation,
    contact: { id: 101, name: 'Ana Kiala', email: 'ana@kilamba-logistica.ao', phone: '+244 923 100 001', company: 'Kilamba Logistica' },
  };
  const entry = { automation_id: automation.id, automation, totalExecutions: 14, successfulExecutions: 13, failedExecutions: 1, successRate: 92.8, lastExecution: { id: log.id, success: true, duration_ms: 180, created_at: log.created_at } };
  return {
    dateRange: { from: null, to: null },
    totalAutomations: state.automations.length,
    totalExecutions: 14,
    successfulExecutions: 13,
    failedExecutions: 1,
    successRate: 92.8,
    neverExecutedCount: 0,
    perAutomation: [entry],
    mostFailingAutomations: [entry],
    recentExecutions: [log],
  };
}

function match(pathname: string, pattern: RegExp) {
  return pathname.match(pattern);
}

function normalizeUrl(config: InternalAxiosRequestConfig) {
  const base = config.baseURL || 'http://localhost';
  return new URL(config.url || '/', base);
}

function response(config: InternalAxiosRequestConfig, data: unknown, status = 200): AxiosResponse {
  return {
    data,
    status,
    statusText: status >= 400 ? 'Error' : 'OK',
    headers: {},
    config,
  };
}

function notFound(config: InternalAxiosRequestConfig) {
  return Promise.reject({
    response: response(config, { error: 'Recurso demo não encontrado' }, 404),
    message: 'Recurso demo não encontrado',
    config,
  });
}

function handleRequest(config: InternalAxiosRequestConfig): AxiosResponse | Promise<AxiosResponse> {
  writeDevAuthSession(DEV_AUTH_USER);
  const state = readState();
  const url = normalizeUrl(config);
  const path = url.pathname;
  const method = (config.method || 'get').toLowerCase();
  const body = typeof config.data === 'string' ? JSON.parse(config.data || '{}') : (config.data || {});

  if (method === 'get' && path === '/api/contacts') {
    const search = (url.searchParams.get('search') || '').toLowerCase();
    const stage = url.searchParams.get('stage');
    const filtered = state.contacts.filter((contact) => {
      if (stage && stage !== 'ALL' && contact.stage !== stage) return false;
      if (!search) return true;
      return [contact.name, contact.email, contact.phone, contact.company].some((value) => String(value || '').toLowerCase().includes(search));
    });
    const page = paginate(filtered, url.searchParams);
    return response(config, { data: page.data, pagination: { page: page.page, limit: page.limit, total: page.total, totalPages: page.totalPages } });
  }
  if (method === 'get' && path === '/api/contacts/stats') {
    return response(config, { total: state.contacts.length, interessados: state.contacts.filter((contact) => contact.contactType === 'interessado').length, clientes: state.contacts.filter((contact) => contact.contactType === 'cliente').length, emPipeline: state.contacts.filter((contact) => contact.inPipeline).length });
  }
  if (method === 'get' && path === '/api/contacts/groups') return response(config, state.groups);
  if (method === 'get' && path === '/api/contacts/facets') return response(config, { stages: state.stages.map((stage) => stage.name), revenues: ['essencial', 'profissional', 'enterprise'], groups: state.groups });
  if (method === 'get' && path === '/api/contacts/fields') return response(config, []);
  if (method === 'get' && path === '/api/contacts/field-config') return response(config, []);
  if (method === 'post' && path === '/api/contacts') {
    const contact = { id: Math.max(...state.contacts.map((item) => item.id)) + 1, name: body.name || 'Novo Contacto Demo', email: body.email || '', phone: body.phone || '', company: body.company || '', location: body.location || '', birthDate: body.birthDate || null, lastActivityAt: nowIso(), contactGroupId: body.contactGroupId || null, nif: body.nif || null, dealValueKz: Number(body.dealValueKz || 0), revenue: body.revenue || 'essencial', sector: body.sector || '', stage: body.stage || 'Novo', inPipeline: body.inPipeline ?? true, tags: body.tags || [], customFields: body.customFields || {}, contactType: body.contactType || 'interessado', status: body.status || 'ativo', clienteType: body.clienteType || 'empresa', documents: [], createdAt: nowIso(), updatedAt: nowIso(), contactGroup: null };
    state.contacts.unshift(contact);
    writeState(state);
    return response(config, contact, 201);
  }
  const contactIdMatch = match(path, /^\/api\/contacts\/(\d+)$/);
  if (contactIdMatch && method === 'get') {
    const contact = state.contacts.find((item) => item.id === Number(contactIdMatch[1]));
    return contact ? response(config, { ...contact, tasks: state.tasks.filter((task) => task.contactId === contact.id) }) : notFound(config);
  }
  if (contactIdMatch && (method === 'put' || method === 'patch')) {
    const index = state.contacts.findIndex((item) => item.id === Number(contactIdMatch[1]));
    if (index < 0) return notFound(config);
    state.contacts[index] = {
      ...state.contacts[index],
      ...body,
      dealValueKz: body.dealValueKz !== undefined ? Number(body.dealValueKz || 0) : state.contacts[index].dealValueKz,
      updatedAt: nowIso(),
    };
    writeState(state);
    return response(config, state.contacts[index]);
  }
  const contactSubmissionsMatch = match(path, /^\/api\/contacts\/(\d+)\/form-submissions$/);
  if (contactSubmissionsMatch && method === 'get') return response(config, state.submissions.filter((item) => item.contactId === Number(contactSubmissionsMatch[1])));
  const contactSummaryMatch = match(path, /^\/api\/contacts\/(\d+)\/summary$/);
  if (contactSummaryMatch && method === 'get') {
    const contactId = Number(contactSummaryMatch[1]);
    const transactions = state.transactions.filter((transaction) => transaction.clientId === contactId);
    const totalComprado = transactions
      .filter((transaction) => transaction.type === 'entrada')
      .reduce((sum, transaction) => sum + Number(transaction.amountKz || 0), 0);
    return response(config, {
      totalComprado,
      ultimoServico: transactions[0]
        ? {
            descricao: transactions[0].description || transactions[0].category,
            data: transactions[0].date,
            valor: Number(transactions[0].amountKz || 0),
          }
        : null,
      transacoes: transactions.slice(0, 5),
      generatedAt: nowIso(),
    });
  }
  const contactNotesMatch = match(path, /^\/api\/contacts\/(\d+)\/notes$/);
  if (contactNotesMatch && method === 'get') return response(config, { data: [{ id: 1, contactId: Number(contactNotesMatch[1]), content: 'Nota demo: pediu orçamento por WhatsApp.', createdAt: daysFromNow(-1), updatedAt: daysFromNow(-1), user: { id: DEV_USER_ID, name: 'Dev Tester' } }], total: 1 });

  if (method === 'get' && path === '/api/pipeline-stages') return response(config, state.stages);
  if (method === 'get' && path === '/api/pipeline/analytics/conversion') return response(config, { range: { period: '30d', start: '2026-04-17', end: '2026-05-16', previousStart: '2026-03-18', previousEnd: '2026-04-16' }, totalContacts: state.contacts.length, closedContacts: 1, totalConversionRate: 33.3, byStage: state.stages.map((stage, index) => ({ stage: stage.name, color: stage.color, currentCount: Math.max(0, 3 - index), reachedCount: 3 - index, advancementRate: 85 - index * 10, stageConversionRate: 45 - index * 5 })) });
  if (method === 'get' && path === '/api/pipeline/analytics/velocity') return response(config, { range: { period: '30d', start: '2026-04-17', end: '2026-05-16', previousStart: '2026-03-18', previousEnd: '2026-04-16' }, averageCurrentDays: 8, averagePreviousDays: 11, byStage: state.stages.map((stage, index) => ({ stage: stage.name, color: stage.color, contactCount: Math.max(0, 3 - index), currentDays: 3 + index, previousDays: 5 + index, deltaDays: -2 })) });
  if (method === 'get' && path === '/api/pipeline/analytics/forecast') return response(config, { currentValue: 4170000, forecastValue: 2680000, averageTicketValue: 1390000, contactsWithCustomValue: 3, contactsUsingAverageTicket: 0, contactsUsingLegacyEstimate: 0, totalClosedContacts: 1, low_confidence: false, stageForecasts: state.stages.map((stage, index) => ({ stage: stage.name, color: stage.color, contacts: Math.max(0, 3 - index), currentValue: 1400000 - index * 250000, historicalConversionRate: 70 - index * 10, weightedForecastValue: 980000 - index * 200000 })) });
  if (method === 'get' && path === '/api/pipeline/analytics/team') return response(config, { members: [{ userId: DEV_USER_ID, name: 'Dev Tester', email: 'dev@local.test', role: 'OrgAdmin', activeContacts: 2, closedContacts: 1, totalContacts: 3, showConversionRate: true, conversionRate: 33.3 }] });

  if (method === 'get' && path === '/api/tasks') return response(config, state.tasks);
  if (method === 'post' && path === '/api/tasks') {
    const task = { id: Math.max(...state.tasks.map((item) => item.id)) + 1, contactId: body.contactId || null, assignedToUserId: body.assignedToUserId || DEV_USER_ID, title: body.title || 'Nova tarefa demo', notes: body.notes || '', dueDate: body.dueDate || null, priority: body.priority || 'Media', done: false, source: 'manual', createdAt: nowIso(), updatedAt: nowIso(), contact: null, assignedTo: { id: DEV_USER_ID, name: 'Dev Tester', email: 'dev@local.test' } };
    state.tasks.unshift(task);
    writeState(state);
    return response(config, task, 201);
  }

  if (method === 'get' && path === '/api/forms') return response(config, state.forms.map((form) => ({ ...form, _count: { submissions: state.submissions.filter((item) => item.formId === form.id).length } })));
  const formMatch = match(path, /^\/api\/forms\/([^/]+)$/);
  if (formMatch && method === 'get') {
    const form = state.forms.find((item) => item.id === formMatch[1]);
    return form ? response(config, form) : notFound(config);
  }
  if (method === 'post' && path === '/api/forms') {
    const form = { id: uid('dev-form'), title: body.title || 'Novo formulário demo', description: body.description || '', mode: body.mode || 'step', thankYouUrl: body.thankYouUrl || '', brandColor: '#0A2540', bgColor: '#F5F7F9', createdAt: nowIso(), updatedAt: nowIso(), _count: { submissions: 0 }, fields: [] };
    state.forms.unshift(form);
    writeState(state);
    return response(config, form, 201);
  }
  if (formMatch && (method === 'put' || method === 'patch')) {
    const index = state.forms.findIndex((item) => item.id === formMatch[1]);
    if (index < 0) return notFound(config);
    state.forms[index] = { ...state.forms[index], ...body, updatedAt: nowIso() };
    writeState(state);
    return response(config, state.forms[index]);
  }
  if (formMatch && method === 'delete') {
    state.forms = state.forms.filter((item) => item.id !== formMatch[1]);
    state.submissions = state.submissions.filter((item) => item.formId !== formMatch[1]);
    writeState(state);
    return response(config, {});
  }
  if (method === 'get' && path === '/api/forms/contact-fields') return response(config, { standard: [{ key: 'name', binding: 'name', label: 'Nome', type: 'text', required: true }, { key: 'phone', binding: 'phone', label: 'Telefone', type: 'text', required: true }, { key: 'email', binding: 'email', label: 'Email', type: 'text' }], custom: [] });
  const formFieldsMatch = match(path, /^\/api\/forms\/([^/]+)\/fields$/);
  if (formFieldsMatch && method === 'post') {
    const form = state.forms.find((item) => item.id === formFieldsMatch[1]);
    if (!form) return notFound(config);
    const field = { id: uid('dev-field'), formId: form.id, type: body.type || 'text', label: body.label || 'Campo demo', required: Boolean(body.required), order: body.order || form.fields.length + 1, options: body.options || [], contactField: body.contactField };
    form.fields.push(field);
    form.updatedAt = nowIso();
    writeState(state);
    return response(config, field, 201);
  }
  const formFieldMatch = match(path, /^\/api\/forms\/([^/]+)\/fields\/([^/]+)$/);
  if (formFieldMatch && (method === 'put' || method === 'patch')) {
    const form = state.forms.find((item) => item.id === formFieldMatch[1]);
    if (!form) return notFound(config);
    const index = form.fields.findIndex((item: any) => item.id === formFieldMatch[2]);
    if (index < 0) return notFound(config);
    form.fields[index] = { ...form.fields[index], ...body };
    form.updatedAt = nowIso();
    writeState(state);
    return response(config, form.fields[index]);
  }
  if (formFieldMatch && method === 'delete') {
    const form = state.forms.find((item) => item.id === formFieldMatch[1]);
    if (!form) return notFound(config);
    form.fields = form.fields.filter((item: any) => item.id !== formFieldMatch[2]);
    form.updatedAt = nowIso();
    writeState(state);
    return response(config, {});
  }
  const reorderMatch = match(path, /^\/api\/forms\/([^/]+)\/fields\/reorder$/);
  if (reorderMatch && method === 'post') {
    const form = state.forms.find((item) => item.id === reorderMatch[1]);
    if (!form) return notFound(config);
    const orderById = new Map((body.fields || []).map((item: any) => [item.id, item.order]));
    form.fields = form.fields
      .map((field: any) => ({ ...field, order: Number(orderById.get(field.id) || field.order) }))
      .sort((a: any, b: any) => a.order - b.order);
    form.updatedAt = nowIso();
    writeState(state);
    return response(config, {});
  }
  const submissionsMatch = match(path, /^\/api\/forms\/([^/]+)\/submissions$/);
  if (submissionsMatch && method === 'get') return response(config, state.submissions.filter((item) => item.formId === submissionsMatch[1]));
  const submitMatch = match(path, /^\/api\/forms\/([^/]+)\/submit$/);
  if (submitMatch && method === 'post') {
    const form = state.forms.find((item) => item.id === submitMatch[1]);
    if (!form) return notFound(config);
    const submission = { id: uid('dev-sub'), formId: form.id, contactId: null, contactSyncStatus: 'skipped' as const, submittedAt: nowIso(), form: { id: form.id, title: form.title }, contact: null, answers: (body.answers || []).map((answer: any, index: number) => { const field = form.fields.find((item: any) => item.id === answer.fieldId); return { id: uid('dev-ans'), fieldId: answer.fieldId, fieldLabel: field?.label || `Resposta ${index + 1}`, contactField: field?.contactField || null, value: answer.value }; }) };
    state.submissions.unshift(submission);
    writeState(state);
    return response(config, { ok: true, submissionId: submission.id }, 201);
  }

  if (method === 'get' && path === '/api/dashboard/servicos/base') return response(config, servicesDashboard(state));
  if (method === 'get' && path === '/api/dashboard/servicos/settings') return response(config, { monthlyRevenueGoalKz: 5000000 });

  if (method === 'get' && path === '/api/finances/dashboard') return response(config, financeDashboard(state));
  if (method === 'get' && path === '/api/finances/transactions') {
    const active = state.transactions.filter((item) => !item.deleted);
    const page = paginate(active, url.searchParams);
    return response(config, { data: page.data, total: page.total, page: page.page, totalPages: page.totalPages });
  }
  if (method === 'post' && path === '/api/finances/transactions') {
    const transaction = { id: uid('dev-tx'), date: body.date || new Date().toISOString().slice(0, 10), clientId: body.clientId, clientName: body.clientName, type: body.type || 'entrada', revenueType: body.revenueType, category: body.category || 'Serviços', subcategory: body.subcategory, description: body.description || 'Transação demo', amountKz: Number(body.amountKz || body.amount || 0), currencyOrigin: body.currencyOrigin || 'KZ', exchangeRate: Number(body.exchangeRate || 1), paymentMethod: body.paymentMethod, status: body.status || 'pendente', notes: body.notes, deleted: false, createdAt: nowIso(), updatedAt: nowIso() };
    state.transactions.unshift(transaction);
    writeState(state);
    return response(config, transaction, 201);
  }
  if (method === 'get' && path === '/api/finances/categories') return response(config, state.categories);
  if (method === 'get' && path === '/api/finances/profitability') return response(config, [{ clientId: 101, clientName: 'Kilamba Logistica', totalRevenue: 1200000, totalCosts: 240000, netMargin: 960000, marginPercent: 80 }, { clientId: 102, clientName: 'Baia Eventos', totalRevenue: 350000, totalCosts: 60000, netMargin: 290000, marginPercent: 82.8 }]);
  if (method === 'get' && path === '/api/finances/export-csv') return response(config, new Blob(['data,descricao,valor\\n2026-05-04,Setup CRM,1200000\\n'], { type: 'text/csv' }));

  if (method === 'get' && path.startsWith('/api/reports/servicos/advanced/')) {
    const range = makeRange();
    if (path.endsWith('/overview')) return response(config, { range, totals: { totalContacts: 3, contactsAdded: 2, contactsAddedPrevious: 1, contactsAddedGrowthPercent: 100, activePipelineContacts: 2, wonDeals: 1, lostDeals: 0, negotiationValue: 3750000, invoicesIssued: 1, receivablesCount: 1, receivablesTotal: 350000 }, revenue: { received: { current: 1200000, previous: 900000, growthPercent: 33.3 }, issued: { current: 1550000, previous: 1100000, growthPercent: 40.9 } }, topClients: [{ clientId: 101, clientName: 'Kilamba Logistica', revenue: 1200000 }] });
    if (path.endsWith('/pipeline')) return response(config, { range, summary: { totalContacts: 3, previousTotalContacts: 2, totalValue: 4170000, previousTotalValue: 2800000, totalConversionRate: 33.3, previousConversionRate: 20, wonDeals: 1, lostDeals: 0, averageCloseDays: 12, previousAverageCloseDays: 18, bottleneckStage: { stage: 'Proposta', conversionRate: 45, advancementRate: 70 } }, byStage: state.stages.map((stage, index) => ({ stage: stage.name, color: stage.color, count: Math.max(0, 3 - index), previousCount: Math.max(0, 2 - index), deltaCount: 1, value: 1200000 - index * 100000, previousValue: 800000 - index * 50000, deltaValue: 350000, reachedCount: 3 - index, advancementRate: 80 - index * 10, stageConversionRate: 50 - index * 5 })), stageTime: { available: true } });
    if (path.endsWith('/revenue')) return response(config, { range, summary: { received: { current: 1200000, previous: 900000, growthPercent: 33.3 }, issued: { current: 1550000, previous: 1100000, growthPercent: 40.9 }, activeRecurringMonthlyRevenue: 350000, recurringReceivedRevenue: 350000, estimatedNonRecurringReceivedRevenue: 850000, estimatedNonRecurringIssuedRevenue: 1200000, averageBillingPerClient: 775000, invoicesIssued: 1, invoicesPaid: 1, receivablesCount: 1, receivablesTotal: 350000, top5RevenueConcentrationPercent: 100, classificationNote: 'Demo' }, topProfitableClients: [{ clientId: 101, clientName: 'Kilamba Logistica', revenue: 1200000, costs: 240000, netMargin: 960000, marginPercent: 80 }], topRevenueClients: [{ clientId: 101, clientName: 'Kilamba Logistica', revenue: 1200000, costs: 240000, netMargin: 960000, marginPercent: 80 }] });
    if (path.endsWith('/team')) return response(config, { range, summary: { members: 1, totalTaskCompletions: 4, totalOverdueTasks: 0, totalContactsCreated: 3, totalActivityEvents: 18, totalClosedDeals: 1, closedDealsAttribution: { available: true, reason: null } }, members: [{ userId: DEV_USER_ID, name: 'Dev Tester', email: 'dev@local.test', role: 'OrgAdmin', tasksCompleted: 4, overdueTasks: 0, contactsCreated: 3, activityCount: 18, closedDeals: 1 }] });
  }

  if (method === 'get' && path === '/api/automations') return response(config, state.automations);
  if (method === 'get' && path === '/api/automations/stats') return response(config, automationStats(state));
  const automationLogsMatch = match(path, /^\/api\/automations\/([^/]+)\/logs$/);
  if (automationLogsMatch && method === 'get') return response(config, { data: automationStats(state).recentExecutions, pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 }, filters: { status: 'all' } });

  if (method === 'get' && path === '/api/chat/channels') return response(config, state.chatChannels);
  const chatMessagesMatch = match(path, /^\/api\/chat\/channels\/([^/]+)\/messages$/);
  if (chatMessagesMatch && method === 'get') return response(config, state.chatMessages[chatMessagesMatch[1]] || []);
  if (chatMessagesMatch && method === 'post') {
    const message = { id: uid('dev-msg'), channelId: chatMessagesMatch[1], senderId: DEV_USER_ID, senderName: 'Dev Tester', senderEmail: 'dev@local.test', text: body.text || '', attachments: body.attachments || [], mentions: [], createdAt: nowIso() };
    state.chatMessages[chatMessagesMatch[1]] = [...(state.chatMessages[chatMessagesMatch[1]] || []), message];
    writeState(state);
    return response(config, message, 201);
  }
  const chatReadMatch = match(path, /^\/api\/chat\/channels\/([^/]+)\/read$/);
  if (chatReadMatch && method === 'post') {
    state.chatChannels = state.chatChannels.map((channel) => (
      channel.id === chatReadMatch[1] ? { ...channel, unreadCount: 0 } : channel
    ));
    writeState(state);
    return response(config, {});
  }
  if (method === 'get' && path === '/api/chat/unread') return response(config, { unread: 1 });
  if (method === 'get' && path === '/api/chat/users') return response(config, [{ id: DEV_USER_ID, name: 'Dev Tester', email: 'dev@local.test', role: 'OrgAdmin', accountOwnerId: null }, { id: -1002, name: 'Marta Demo', email: 'marta@local.test', role: 'user', accountOwnerId: DEV_USER_ID }]);
  if (method === 'get' && path === '/api/chat/limits') return response(config, { plan: 'enterprise', usage: { users: { current: 2, limit: 20 }, messages: { current: 12, limit: 10000 } } });

  if (method === 'get' && path === '/api/faturacao/dashboard') return response(config, { totalMes: state.facturas.length, receitaMes: state.facturas.reduce((sum, item) => sum + item.grossTotal, 0), pendentesAGT: 1, totalGeral: state.facturas.reduce((sum, item) => sum + item.grossTotal, 0), mockMode: true });
  if (method === 'get' && path === '/api/faturacao/facturas') return response(config, { facturas: state.facturas, total: state.facturas.length, pages: 1 });
  const facturaPdfMatch = match(path, /^\/api\/faturacao\/facturas\/([^/]+)\/pdf$/);
  if (facturaPdfMatch && method === 'get') return response(config, new Blob(['Factura demo PDF'], { type: 'application/pdf' }));
  const facturaMatch = match(path, /^\/api\/faturacao\/facturas\/([^/]+)$/);
  if (facturaMatch && method === 'get') {
    const factura = state.facturas.find((item) => item.id === facturaMatch[1]);
    return factura ? response(config, factura) : notFound(config);
  }
  if (method === 'get' && path === '/api/faturacao/series') return response(config, [{ id: 'dev-serie-1', seriesCode: 'DEV', seriesYear: 2026, documentType: 'FT', firstDocumentNumber: 1, seriesStatus: 'A', createdAt: nowIso(), estabelecimento: { id: 'dev-est-1', nome: 'Sede Dev' } }]);
  if (method === 'get' && path === '/api/faturacao/estabelecimentos') return response(config, [{ id: 'dev-est-1', nome: 'Sede Dev', nif: '5000000000', morada: 'Luanda', telefone: '+244 923 000 000', email: 'demo@local.test', isPrincipal: true }]);
  if (method === 'get' && path === '/api/faturacao/clientes') return response(config, [{ id: 'dev-cli-1', customerTaxID: '5001234567', customerName: 'Kilamba Logistica', customerAddress: 'Luanda', customerPhone: '+244 923 100 001', customerEmail: 'ana@kilamba-logistica.ao', contactId: 101, source: 'crm' }]);
  if (method === 'get' && path === '/api/faturacao/produtos') return response(config, { data: state.products, total: state.products.length, page: 1, totalPages: 1 });
  if (method === 'get' && path === '/api/produto-categorias') return response(config, [{ id: 'dev-prod-cat-1', userId: DEV_USER_ID, nome: 'Serviços', cor: '#0A2540', isDefault: true, createdAt: nowIso(), _count: { produtos: state.products.length } }]);

  if (method === 'get' && path === '/api/activity') return response(config, { data: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 }, users: [{ id: DEV_USER_ID, name: 'Dev Tester', email: 'dev@local.test' }], filters: { userId: null, entityType: null, search: '', dateFrom: null, dateTo: null } });
  if (method === 'get' && path === '/api/activity/export-csv') return response(config, new Blob(['tipo,accao,data\\ncontact,created,2026-05-01\\n'], { type: 'text/csv' }));
  if (method === 'get' && path === '/api/onboarding') return response(config, {
    show: true,
    dismissed: false,
    completedCount: 2,
    totalCount: 5,
    allDone: false,
    finalMessage: 'Conta configurada com sucesso.',
    workspaceMode: 'servicos',
    flowKey: 'onboarding_v2',
    welcome: { show: false, dismissed: true, flowKey: 'welcome_v1' },
    steps: [
      { id: 'setup_company', label: 'Complete os dados da empresa', href: '/faturacao/configuracao', completed: true },
      { id: 'add_contact', label: 'Crie o primeiro contacto', href: '/contacts', completed: true },
      { id: 'setup_pipeline', label: 'Configure o primeiro Processo de Venda', href: '/pipeline', completed: false },
      { id: 'create_task', label: 'Crie uma tarefa', href: '/tasks', completed: false },
      { id: 'create_invoice', label: 'Emita a primeira fatura', href: '/faturacao/nova', completed: false },
    ],
  });
  if (method === 'post' && path === '/api/onboarding/welcome/dismiss') return response(config, { success: true });
  if (method === 'get' && path === '/api/startup-templates') return response(config, { templates: [], applied: [] });
  if (method === 'get' && path === '/api/startup-templates/status') return response(config, { applied: false, templateId: null });

  return notFound(config);
}

export function createDevSampleApiAdapter(): AxiosAdapter | null {
  if (!isDevAuthSessionActive()) return null;
  return (config) => Promise.resolve(handleRequest(config));
}
