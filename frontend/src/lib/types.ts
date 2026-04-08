export type Stage = string;

export interface PipelineStage {
  id: string;
  userId: number;
  name: string;
  color: string;
  order: number;
  createdAt: string;
}

export interface PipelineAnalyticsConversionStage {
  stage: string;
  color: string;
  currentCount: number;
  reachedCount: number;
  advancementRate: number | null;
  stageConversionRate: number | null;
}

export interface PipelineAnalyticsConversionResponse {
  range: {
    period: '7d' | '30d' | '90d';
    start: string;
    end: string;
    previousStart: string;
    previousEnd: string;
  };
  totalContacts: number;
  closedContacts: number;
  totalConversionRate: number | null;
  byStage: PipelineAnalyticsConversionStage[];
}

export interface PipelineAnalyticsVelocityStage {
  stage: string;
  color: string;
  contactCount: number;
  currentDays: number | null;
  previousDays: number | null;
  deltaDays: number | null;
}

export interface PipelineAnalyticsVelocityResponse {
  range: {
    period: '7d' | '30d' | '90d';
    start: string;
    end: string;
    previousStart: string;
    previousEnd: string;
  };
  averageCurrentDays: number | null;
  averagePreviousDays: number | null;
  byStage: PipelineAnalyticsVelocityStage[];
}

export interface PipelineAnalyticsForecastStage {
  stage: string;
  color: string;
  contacts: number;
  currentValue: number;
  historicalConversionRate: number;
  weightedForecastValue: number;
}

export interface PipelineAnalyticsForecastResponse {
  currentValue: number;
  forecastValue: number;
  averageTicketValue: number;
  contactsWithCustomValue: number;
  contactsUsingAverageTicket: number;
  contactsUsingLegacyEstimate: number;
  totalClosedContacts: number;
  low_confidence: boolean;
  stageForecasts: PipelineAnalyticsForecastStage[];
}

export interface PipelineAnalyticsTeamMember {
  userId: number;
  name: string;
  email: string;
  role: string;
  activeContacts: number;
  closedContacts: number;
  totalContacts: number;
  showConversionRate: boolean;
  conversionRate: number | null;
}

export interface PipelineAnalyticsTeamResponse {
  members: PipelineAnalyticsTeamMember[];
}
export type Priority = 'Alta' | 'Media' | 'Baixa';

export interface Task {
  id: number;
  contactId?: number | null;
  assignedToUserId?: number | null;
  title: string;
  notes?: string;
  dueDate?: string;
  priority: Priority;
  done: boolean;
  createdAt: string;
  updatedAt: string;
  contact?: {
    id: number;
    name: string;
    company: string;
  } | null;
  assignedTo?: {
    id: number;
    name: string;
    email: string;
  } | null;
}

export interface Contact {
  id: number;
  name: string;
  email: string;
  phone: string;
  company: string;
  nif?: string | null;
  dealValueKz?: number | null;
  revenue?: string;
  sector?: string;
  stage: Stage;
  inPipeline: boolean;
  tags?: string[];
  customFields?: Record<string, string>;
  contactType: 'interessado' | 'cliente';
  status: 'ativo' | 'inativo';
  clienteType?: 'empresa' | 'particular';
  documents: { name: string; url: string; size?: number; uploadedAt: string }[];
  createdAt: string;
  updatedAt: string;
  tasks?: Task[];
}

export type ContactFieldType = 'text' | 'number' | 'date' | 'select' | 'url';

export interface ContactFieldDef {
  id: string;
  userId: number;
  label: string;
  key: string;
  type: ContactFieldType;
  options?: string[];
  required: boolean;
  order: number;
  active: boolean;
  createdAt: string;
}

// Config override for a built-in system field
export type SystemFieldKey =
  | 'name'
  | 'phone'
  | 'email'
  | 'nif'
  | 'company'
  | 'clienteType'
  | 'revenue'
  | 'sector'
  | 'tags';

export interface ContactFieldConfig {
  fieldKey: SystemFieldKey;
  label: string;
  visible: boolean;
  required: boolean;
  order: number;
  configId: string | null;
}

export interface Message {
  id: string;
  contactId: string;
  direction: 'inbound' | 'outbound';
  text: string;
  channel: 'whatsapp' | 'email';
  subject?: string;
  timestamp: string;
  warning?: string;
}

export interface ConversationContact extends Contact {
  messages: Message[];
}

export interface WhatsAppTemplate {
  name: string;
  language: string;
  status: string;
}

export interface Automation {
  id: string;
  trigger: string; // "new_contact", "form_submission", "contact_tag", "contact_revenue", "contact_sector"
  triggerValue?: string; // tag name, revenue, or sector
  formId?: string | null;
  action: string; // "send_email", "send_template", "send_text", "update_stage", "create_task"
  targetStage?: Stage; // for update_stage action
  templateName?: string;
  emailSubject?: string;
  emailBody?: string;
  taskTitle?: string;
  taskNotes?: string;
  taskPriority?: 'Baixa' | 'Media' | 'Alta';
  taskDueDays?: number | null;
  taskAssignedToUserId?: number | null;
  active: boolean;
  form?: {
    id: string;
    title: string;
  } | null;
  executionSummary?: AutomationExecutionSummary;
}

export interface AutomationExecutionSummary {
  automationId: string;
  totalExecutions: number;
  executionsLast30Days: number;
  successfulExecutionsLast30Days: number;
  failedExecutionsLast30Days: number;
  successRateLast30Days: number | null;
  lastExecution: {
    success: boolean;
    error_message?: string | null;
    duration_ms?: number | null;
    created_at: string;
  } | null;
}

export interface AutomationLogEntry {
  id: string;
  automation_id: string;
  organization_id: number;
  trigger_type: string;
  trigger_data: Record<string, unknown>;
  action_type: string;
  action_data: Record<string, unknown>;
  success: boolean;
  error_message?: string | null;
  contact_id?: number | null;
  duration_ms?: number | null;
  created_at: string;
  automation: Automation;
  contact?: {
    id: number;
    name: string;
    email: string;
    phone: string;
    company: string;
  } | null;
}

export interface AutomationLogsResponse {
  data: AutomationLogEntry[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  filters: {
    status: 'all' | 'success' | 'failed';
    dateFrom?: string | null;
    dateTo?: string | null;
  };
}

export interface ActivityLogEntry {
  id: string;
  organization_id: number;
  entity_type:
    | 'contact'
    | 'invoice'
    | 'task'
    | 'pipeline_stage'
    | 'cash_session'
    | 'billing_customer'
    | 'product'
    | 'product_category'
    | 'serie'
    | 'store'
    | 'billing_config'
    | string;
  entity_id: string;
  entity_label: string;
  action:
    | 'created'
    | 'updated'
    | 'deleted'
    | 'deactivated'
    | 'opened'
    | 'closed'
    | 'stage_changed'
    | 'status_changed'
    | 'stock_adjusted'
    | string;
  field_changed?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  user_id: number;
  user_name: string;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

export interface ActivityPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ActivityEntityHistoryResponse {
  data: ActivityLogEntry[];
  pagination: ActivityPagination;
}

export interface ActivityFeedResponse {
  data: ActivityLogEntry[];
  pagination: ActivityPagination;
  users: Array<{
    id: number;
    name: string;
    email: string;
  }>;
  filters: {
    userId: number | null;
    entityType: string | null;
    search: string;
    dateFrom: string | null;
    dateTo: string | null;
  };
}

export interface AutomationStatsEntry {
  automation_id: string;
  automation: Automation;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  successRate: number | null;
  lastExecution: {
    id: string;
    success: boolean;
    error_message?: string | null;
    duration_ms?: number | null;
    created_at: string;
  } | null;
}

export interface AutomationStatsResponse {
  dateRange: {
    from?: string | null;
    to?: string | null;
  };
  totalAutomations: number;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  successRate: number | null;
  neverExecutedCount: number;
  perAutomation: AutomationStatsEntry[];
  mostFailingAutomations: AutomationStatsEntry[];
  recentExecutions: AutomationLogEntry[];
}

export interface FormField {
  id: string;
  formId: string;
  type: 'text' | 'multiple_choice';
  label: string;
  required: boolean;
  order: number;
  options?: string[];
  contactField?: string;
}

export interface CRMForm {
  id: string;
  title: string;
  description?: string;
  mode: 'step' | 'single';
  thankYouUrl?: string;
  brandColor?: string;
  bgColor?: string;
  logoUrl?: string;
  createdAt: string;
  updatedAt: string;
  fields: FormField[];
  _count?: { submissions: number };
  metaPixelEnabled?: boolean;
  metaPixelId?: string;
  googleTagEnabled?: boolean;
  googleTagId?: string;
  trackSubmitAsLead?: boolean;
}

export interface FormSubmissionAnswer {
  id: string;
  fieldId?: string | null;
  fieldLabel: string;
  contactField?: string | null;
  value: string;
}

export interface FormSubmission {
  id: string;
  formId: string;
  contactId?: number | null;
  contactSyncStatus: 'created' | 'updated' | 'skipped';
  submittedAt: string;
  contact?: {
    id: number;
    name: string;
    phone: string;
    email: string;
    company: string;
    stage: string;
    inPipeline: boolean;
  } | null;
  answers: FormSubmissionAnswer[];
}

// Calendar types
export interface CalendarEvent {
  id: string;
  title: string;
  start: string;   // ISO date or datetime
  end?: string;
  allDay: boolean;
  source: 'crm' | 'google';
  color?: string;
  taskId?: number;
  contactName?: string;
  priority?: string;
}

// Finance types
export type TransactionType = 'entrada' | 'saida';
export type TransactionStatus = 'pago' | 'pendente' | 'atrasado';
export type RevenueType = 'recorrente' | 'one-off';
export type CurrencyOrigin = 'KZ' | 'CHF' | 'EUR' | 'USD';

export interface TransactionAttachment {
  url: string;
  name: string;
  size?: number;
  type?: string;
  uploadedAt: string;
}

export interface Transaction {
  id: string;
  date: string;
  clientId?: number;
  clientName?: string;
  type: TransactionType;
  revenueType?: RevenueType;
  contractDurationMonths?: number;
  nextPaymentDate?: string;
  category: string;
  subcategory?: string;
  description?: string;
  amountKz: number;
  currencyOrigin: CurrencyOrigin;
  exchangeRate: number;
  paymentMethod?: string;
  status: TransactionStatus;
  receiptNumber?: string;
  notes?: string;
  attachments?: TransactionAttachment[];
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
  contact?: { id: number; name: string; company: string };
}

export interface FinancialCategory {
  id: string;
  type: TransactionType;
  category: string;
  subcategories?: string[];
  color?: string;
  icon?: string;
}

export interface DashboardStats {
  revenue: number;
  expenses: number;
  profit: number;
  marginPercent: number;
  mrr: number;
  receitaMensal: number;
  prevRevenue: number;
  prevExpenses: number;
  prevProfit: number;
  companyCashBalance: number;
  openingBalance: number;
  receivablesCount: number;
  receivablesTotal: number;
}

export interface ClientProfitability {
  clientId: number;
  clientName: string;
  totalRevenue: number;
  totalCosts: number;
  netMargin: number;
  marginPercent: number;
}

// ============================================
// MÓDULO FATURAÇÃO AGT
// ============================================

export interface IBANEntry {
  label: string;
  iban: string;
}

export interface FacturaTax {
  taxType: string;
  taxCode: string;
  taxPercentage: number;
  taxAmount?: number;
}

export interface FacturaLine {
  lineNumber: number;
  productCode: string;
  productDescription: string;
  quantity: number;
  unitPrice: number;
  unitOfMeasure: string;
  settlementAmount: number;
  isIncluded?: boolean;
  taxes: FacturaTax[];
}

export interface Factura {
  id: string;
  documentNo: string;
  documentType: string;
  documentStatus: 'N' | 'A';
  documentCancelReason?: string;
  customerTaxID: string;
  customerName: string;
  customerAddress?: string;
  clienteFaturacaoId?: string;
  lines: FacturaLine[];
  netTotal: number;
  taxPayable: number;
  grossTotal: number;
  qrCodeUrl?: string;
  qrCodeImage?: string;
  jwsSignature: string;
  agtRequestId?: string;
  agtValidationStatus: 'P' | 'V' | 'I' | 'A';
  agtSubmittedAt?: string;
  baseCurrency: string;
  displayCurrency: string;
  isOffline: boolean;
  documentDate: string;
  createdAt: string;
  currencyCode: string;
  currencyAmount?: number;
  exchangeRate?: number;
  exchangeRateDate?: string;
  displayMode?: 'DOCUMENT_ONLY' | 'DOCUMENT_PLUS_INTERNAL';
  paymentMethod?: string;
  paymentDue?: string;
  serie?: { seriesCode: string; seriesYear: number; documentType: string };
  estabelecimento?: { id: string; nome: string; nif?: string; morada?: string; telefone?: string; email?: string };
  clienteFaturacao?: {
    customerName?: string;
    customerTaxID?: string;
    customerAddress?: string;
    customerPhone?: string;
    customerEmail?: string;
  };
}

export interface Serie {
  id: string;
  seriesCode: string;
  seriesYear: number;
  documentType: string;
  firstDocumentNumber: number;
  lastDocumentNumber?: number;
  seriesStatus: 'A' | 'U' | 'F';
  createdAt: string;
  estabelecimento?: { id: string; nome: string };
}

export interface Estabelecimento {
  id: string;
  nome: string;
  nif?: string;
  defaultSerieId?: string | null;
  morada?: string;
  telefone?: string;
  email?: string;
  isPrincipal: boolean;
  defaultSerie?: {
    id: string;
    seriesCode: string;
    seriesYear: number;
    documentType: string;
  } | null;
}

export interface ClienteFaturacao {
  id: string;
  customerTaxID: string;
  customerName: string;
  customerAddress?: string;
  customerPhone?: string;
  customerEmail?: string;
  contactId?: number;
  source?: 'faturacao' | 'crm';
}

export interface ProdutoCategoria {
  id: string;
  userId: number;
  nome: string;
  cor?: string | null;
  isDefault: boolean;
  createdAt: string;
  _count?: { produtos: number };
}

export interface ComercialResumo {
  totalHoje: number;
  vendasHoje: number;
  totalOntem: number;
  variacao: number;
  totalSemanaActual: number;
  totalSemanaAnterior: number;
  variacaoSemana: number;
  topProduto: {
    productCode: string;
    productDescription: string;
    quantidadeVendida: number;
    facturacaoTotal: number;
  } | null;
  top3MesPorQuantidade: {
    productCode: string;
    productDescription: string;
    quantidadeTotal: number;
    facturacaoTotal: number;
  }[];
  estabelecimentoDestaque: {
    id: string;
    nome: string;
    totalHoje: number;
  } | null;
  stockAlertaCount: number;
}

export interface ComercialTopProduto {
  productCode: string;
  productDescription: string;
  quantidadeTotal: number;
  facturacaoTotal: number;
}

export interface ComercialAnalise {
  totalVendas: number;
  numVendas: number;
  ticketMedio: number;
  topPorQuantidade: ComercialTopProduto[];
  topPorFacturacao: ComercialTopProduto[];
  produtosParados: Produto[];
  rankingEstabelecimentos: {
    id: string;
    nome: string;
    total: number;
    count: number;
  }[];
  vendasPorDia: {
    date: string;
    total: number;
    count: number;
  }[];
}

export interface AdvancedReportRange {
  period: '7d' | '30d' | '90d' | 'month' | 'custom';
  granularity: 'day' | 'week' | 'month';
  dayCount: number;
  start: string;
  end: string;
  previousStart: string;
  previousEnd: string;
}

export interface AdvancedReportComparison {
  current: number;
  previous: number;
  growthPercent: number | null;
}

export interface ServicesAdvancedOverviewResponse {
  range: AdvancedReportRange;
  totals: {
    totalContacts: number;
    contactsAdded: number;
    contactsAddedPrevious: number;
    contactsAddedGrowthPercent: number | null;
    activePipelineContacts: number;
    wonDeals: number;
    lostDeals: number;
    negotiationValue: number;
    invoicesIssued: number;
    receivablesCount: number;
    receivablesTotal: number;
  };
  revenue: {
    received: AdvancedReportComparison;
    issued: AdvancedReportComparison;
  };
  topClients: Array<{
    clientId: number | null;
    clientName: string;
    revenue: number;
  }>;
}

export interface ServicesAdvancedPipelineResponse {
  range: AdvancedReportRange;
  summary: {
    totalContacts: number;
    previousTotalContacts: number;
    totalValue: number;
    previousTotalValue: number;
    totalConversionRate: number | null;
    previousConversionRate: number | null;
    wonDeals: number;
    lostDeals: number;
    averageCloseDays: number;
    previousAverageCloseDays: number;
    bottleneckStage: {
      stage: string;
      conversionRate: number | null;
      advancementRate: number | null;
    } | null;
  };
  byStage: Array<{
    stage: string;
    color: string;
    count: number;
    previousCount: number;
    deltaCount: number;
    value: number;
    previousValue: number;
    deltaValue: number;
    reachedCount: number;
    advancementRate: number | null;
    stageConversionRate: number | null;
  }>;
  stageTime: {
    available: boolean;
    reason?: string | null;
  };
}

export interface ServicesAdvancedRevenueResponse {
  range: AdvancedReportRange;
  summary: {
    received: AdvancedReportComparison;
    issued: AdvancedReportComparison;
    activeRecurringMonthlyRevenue: number;
    recurringReceivedRevenue: number;
    estimatedNonRecurringReceivedRevenue: number;
    estimatedNonRecurringIssuedRevenue: number;
    averageBillingPerClient: number;
    invoicesIssued: number;
    invoicesPaid: number;
    receivablesCount: number;
    receivablesTotal: number;
    top5RevenueConcentrationPercent: number | null;
    classificationNote: string;
  };
  topProfitableClients: Array<{
    clientId: number | null;
    clientName: string;
    revenue: number;
    costs: number;
    netMargin: number;
    marginPercent: number | null;
  }>;
  topRevenueClients: Array<{
    clientId: number | null;
    clientName: string;
    revenue: number;
    costs: number;
    netMargin: number;
    marginPercent: number | null;
  }>;
}

export interface ServicesAdvancedTeamResponse {
  range: AdvancedReportRange;
  summary: {
    members: number;
    totalTaskCompletions: number;
    totalOverdueTasks: number;
    totalContactsCreated: number;
    totalActivityEvents: number;
    totalClosedDeals: number;
    closedDealsAttribution: {
      available: boolean;
      reason: string | null;
    };
  };
  members: Array<{
    userId: number;
    name: string;
    email: string;
    role: string;
    tasksCompleted: number;
    overdueTasks: number;
    contactsCreated: number;
    activityCount: number;
    closedDeals: number;
  }>;
}

export interface CommercialAdvancedOverviewResponse {
  range: AdvancedReportRange;
  summary: {
    totalSales: number;
    previousTotalSales: number;
    growthPercent: number | null;
    invoiceCount: number;
    previousInvoiceCount: number;
    ticketAverage: number;
    previousTicketAverage: number;
    criticalStockCount: number;
  };
  paymentMethods: Array<{
    method: string;
    total: number;
    count: number;
  }>;
  establishments: Array<{
    estabelecimentoId: string;
    nome: string;
    total: number;
    count: number;
    ticketAverage: number;
  }>;
  topProducts: Array<{
    productId: string | null;
    productCode: string;
    productDescription: string;
    quantityTotal: number;
    revenueTotal: number;
    estimatedMargin: number | null;
    marginPercent: number | null;
    turnoverRatio: number | null;
    stock: number | null;
    stockMinimo: number | null;
  }>;
  topClients: Array<{
    customerTaxID: string | null;
    customerName: string;
    count: number;
    total: number;
    averageTicket: number;
  }>;
  criticalProducts: Array<{
    productId: string;
    productCode: string;
    productDescription: string;
    stock: number;
    stockMinimo: number;
  }>;
}

export interface CommercialAdvancedSalesResponse {
  range: AdvancedReportRange;
  summary: {
    totalSales: number;
    previousTotalSales: number;
    growthPercent: number | null;
    documentCount: number;
    previousDocumentCount: number;
    ticketAverage: number;
    previousTicketAverage: number;
    trendGrowthPercent: number | null;
  };
  series: Array<{
    key: string;
    label: string;
    total: number;
    count: number;
  }>;
}

export interface CommercialAdvancedProductsResponse {
  range: AdvancedReportRange;
  summary: {
    totalProducts: number;
    soldProducts: number;
    unsoldProducts: number;
    criticalStockCount: number;
  };
  topSold: CommercialAdvancedOverviewResponse['topProducts'];
  leastSold: CommercialAdvancedOverviewResponse['topProducts'];
  topRevenue: CommercialAdvancedOverviewResponse['topProducts'];
  lowMovement: CommercialAdvancedOverviewResponse['topProducts'];
  criticalProducts: Array<{
    productId: string;
    productCode: string;
    productDescription: string;
    stock: number;
    stockMinimo: number;
  }>;
  unsoldProducts: Array<{
    productId: string;
    productCode: string;
    productDescription: string;
    stock: number;
    stockMinimo: number;
  }>;
}

export interface CommercialAdvancedLocationsResponse {
  range: AdvancedReportRange;
  summary: {
    locations: number;
    bestLocation: {
      id: string;
      nome: string;
      totalSales: number;
      previousTotalSales: number;
      growthPercent: number | null;
      salesCount: number;
      previousSalesCount: number;
      ticketAverage: number;
      totalCashInSessions: number;
    } | null;
    totalCashInSessions: number;
  };
  locations: Array<{
    id: string;
    nome: string;
    totalSales: number;
    previousTotalSales: number;
    growthPercent: number | null;
    salesCount: number;
    previousSalesCount: number;
    ticketAverage: number;
    totalCashInSessions: number;
  }>;
}

export interface CommercialAdvancedTeamResponse {
  range: AdvancedReportRange;
  summary: {
    members: number;
    totalSalesCount: number;
    totalSold: number;
    sessionsOpened: number;
    sessionsClosed: number;
    attributionNote: string;
  };
  members: Array<{
    userId: number;
    name: string;
    email: string;
    role: string;
    salesCount: number;
    totalSold: number;
    sessionsOpened: number;
    sessionsClosed: number;
  }>;
}

export interface Produto {
  id: string;
  productCode: string;
  productDescription: string;
  unitPrice: number;       // preço de venda
  cost?: number | null;    // preço de custo (opcional)
  margin?: number | null;  // margem % — calculada pelo servidor
  productType: string;     // S=serviço, P=produto, O=outro
  sku?: string | null;
  barcode?: string | null; // código de barras EAN/QR
  unitOfMeasure: string;
  taxPercentage: number;
  taxCode: string;
  active: boolean;
  stock?: number | null;   // stock atual (null = sem controlo de stock)
  stockMinimo?: number | null;
  categoriaId?: string | null;
  categoria?: ProdutoCategoria | null;
}

export interface CaixaSessao {
  id: string;
  userId: number;
  estabelecimentoId: string;
  openedByUserId: number;
  closedByUserId?: number | null;
  openedAt: string;
  closedAt?: string | null;
  openingBalance: number;
  closingCountedAmount?: number | null;
  expectedClosingAmount?: number | null;
  differenceAmount?: number | null;
  totalSalesAmount: number;
  salesCount: number;
  totalCash: number;
  totalMulticaixa: number;
  totalTpa: number;
  totalTransferencia: number;
  status: 'open' | 'closed';
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  estabelecimento?: { id: string; nome: string; nif: string };
  openedBy?: { id: number; name: string };
  closedBy?: { id: number; name: string } | null;
}

export interface StockMovement {
  id: string;
  productId: string;
  userId: number;
  type: 'entry' | 'exit' | 'adjustment';
  quantity: number;
  previousStock: number;
  newStock: number;
  reason?: string | null;
  notes?: string | null;
  createdByUserId: number;
  referenceType?: string | null;
  referenceId?: string | null;
  createdAt: string;
}

export interface IvaRateBreakdown {
  base: number;
  iva: number;
  count: number;
}

export interface IvaReport {
  periodo: string;
  totalBase: number;
  totalIva: number;
  totalGross: number;
  byRate: {
    rate0:  IvaRateBreakdown;
    rate5:  IvaRateBreakdown;
    rate14: IvaRateBreakdown;
  };
  facturas: {
    documentNo: string;
    documentDate: string;
    documentType: string;
    customerName: string;
    customerTaxID: string;
    netTotal: number;
    taxPayable: number;
    grossTotal: number;
  }[];
}

export interface VendasMonthly {
  month: number;
  label: string;
  count: number;
  netTotal: number;
  taxPayable: number;
  grossTotal: number;
}

export interface VendasReport {
  year: number;
  months: VendasMonthly[];
  totals: { count: number; netTotal: number; taxPayable: number; grossTotal: number };
}

export interface FaturacaoDashboard {
  totalMes: number;
  receitaMes: number;
  pendentesAGT: number;
  totalGeral: number;
  mockMode: boolean;
}

export interface FaturacaoConfig {
  id: string;
  nifEmpresa: string;
  nomeEmpresa: string;
  moradaEmpresa: string;
  telefoneEmpresa: string;
  emailEmpresa: string;
  websiteEmpresa: string;
  iban: string;
  logoUrl?: string;
  agtMockMode: boolean;
  agtCertNumber: string;
  contingencyMode: boolean;
  defaultSerieId?: string;
  defaultEstabelecimentoId?: string;
}

export interface SaftPeriodo {
  id: string;
  periodo: string;
  status: string;
  totalFacturas: number;
  generatedAt: string;
}

export interface FacturaRecorrente {
  id: string;
  userId: number;
  serieId: string;
  estabelecimentoId: string;
  clienteFaturacaoId?: string;
  customerTaxID: string;
  customerName: string;
  customerAddress?: string;
  documentType: string;
  lines: string;
  baseCurrency: string;
  displayCurrency: string;
  currencyCode: string;
  exchangeRate?: number;
  exchangeRateDate?: string;
  displayMode?: 'DOCUMENT_ONLY' | 'DOCUMENT_PLUS_INTERNAL';
  paymentMethod: string;
  frequency: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
  startDate: string;
  nextRunDate: string;
  lastRunDate?: string;
  lastFacturaId?: string;
  isActive: boolean;
  totalGenerated: number;
  maxOccurrences?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  serie?: { seriesCode: string; seriesYear: number; documentType: string };
  estabelecimento?: { nome: string; nif: string };
  clienteFaturacao?: { customerName: string; customerTaxID: string };
}

// ── CHAT INTERNO ──────────────────────────────────────────────
export interface ChatMember {
  userId: number;
  name: string;
  email: string;
}

export interface ChatLastMessage {
  text: string;
  createdAt: string;
  senderName: string;
}

export interface ChatChannel {
  id: string;
  name: string;
  description?: string;
  type: 'channel' | 'dm';
  orgId: number;
  createdById: number;
  createdAt: string;
  members: ChatMember[];
  unreadCount: number;
  lastMessage?: ChatLastMessage | null;
}

export interface ChatAttachment {
  url: string;
  name: string;
  size: number;
  type: string;
}

export interface ChatMessage {
  id: string;
  channelId: string;
  senderId: number;
  senderName: string;
  senderEmail: string;
  text: string;
  attachments: ChatAttachment[];
  mentions: number[];
  createdAt: string;
}

import type { PlanCatalogEntry, PlanName } from './api';

export interface PlanUsageItem {
  current: number;
  limit: number;
}

export interface PlanUsage {
  plan: PlanName;
  usage: Record<string, PlanUsageItem>;
}

export type AvailablePlanCatalog = Record<PlanName, PlanCatalogEntry>;

// ── GESTÃO DE CONTAS CLIENTES ────────────────────────────────
export interface ClientAccountMember {
  id: number;
  name: string;
  email: string;
  active: boolean;
  permissions: import('./api').UserPermissions | null;
}

export interface ClientAccount {
  id: number;
  name: string;
  email: string;
  active: boolean;
  plan: PlanName;
  permissions: import('./api').UserPermissions | null;
  createdAt: string;
  accountMembers: ClientAccountMember[];
  _count: { accountMembers: number };
}

export interface ContactNote {
  id: number;
  contactId: number;
  content: string;
  createdAt: string;
  updatedAt: string;
  user?: { id: number; name: string };
}
