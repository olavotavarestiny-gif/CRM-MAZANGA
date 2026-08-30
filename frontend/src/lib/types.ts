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
  dueDate?: string | null;
  priority: Priority;
  done: boolean;
  googleCalendarEventId?: string | null;
  googleCalendarHtmlLink?: string | null;
  googleCalendarSyncedAt?: string | null;
  googleCalendarSyncError?: string | null;
  source?: string;
  automationId?: string | null;
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
  location?: string | null;
  birthDate?: string | null;
  lastActivityAt?: string | null;
  contactGroupId?: string | null;
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
  contactGroup?: ContactGroup | null;
  tasks?: Task[];
}

export interface ContactGroup {
  id: string;
  userId: number;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface BulkUpdateContactsInput {
  contactIds: number[];
  changes: {
    contactGroupId?: string | null;
    status?: 'ativo' | 'inativo';
    stage?: string;
    contactType?: 'interessado' | 'cliente';
  };
}

export interface BulkUpdateContactsResponse {
  requestedCount: number;
  matchedCount: number;
  updatedCount: number;
}

export interface BulkDeleteContactsResponse {
  requestedCount: number;
  deletedCount: number;
}
export interface ContactsPageResponse {
  data: Contact[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ContactStatsResponse {
  total: number;
  interessados?: number;
  clientes?: number;
  emPipeline?: number;
  [key: string]: number | undefined;
}

export interface ContactFacetsResponse {
  stages?: string[];
  revenues?: string[];
  groups?: ContactGroup[];
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
  | 'location'
  | 'birthDate'
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
    | 'messaging_campaign'
    | 'messaging_message'
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
    | 'sent'
    | 'sync_requested'
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
  type: 'text' | 'number' | 'multiple_choice';
  label: string;
  required: boolean;
  order: number;
  options?: string[];
  contactField?: string;
}

export interface FormContactFieldOption {
  id?: string;
  key: string;
  binding: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
}

export interface FormContactFieldsResponse {
  standard: FormContactFieldOption[];
  custom: FormContactFieldOption[];
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
  form?: {
    id: string;
    title: string;
  };
  answers: FormSubmissionAnswer[];
}

// Calendar types
export interface CalendarConnectionStatus {
  connected: boolean;
  email: string | null;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  lastSyncErrorAt: string | null;
  primaryCalendarId: string | null;
  reauthRequired: boolean;
}

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
  externalUrl?: string;
  googleLinked?: boolean;
  googleSyncError?: string | null;
  localEventId?: string;
}

export interface LocalCalendarEvent {
  id: string;
  userId: number;
  contactId?: number | null;
  assignedToUserId?: number | null;
  title: string;
  notes?: string | null;
  startDate: string;
  endDate: string;
  syncWithGoogle: boolean;
  googleCalendarEventId?: string | null;
  googleCalendarHtmlLink?: string | null;
  googleCalendarSyncError?: string | null;
  googleCalendarSyncedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  contact?: { id: number; name: string; company: string } | null;
  assignedTo?: { id: number; name: string; email: string } | null;
}

export interface ServicesDashboardBase {
  generatedAt: string;
  range: { period: string; start: string; end: string };
  permissions: { revenue: boolean; pipeline: boolean; tasks: boolean };
  activeFilters: {
    period: string;
    responsibleUserId: string | null;
    stage: string | null;
    leadOrigin: string | null;
    segment: string | null;
  };
  filters: {
    periods: Array<{ value: string; label: string }>;
    responsibleUsers: Array<{ value: string; label: string }>;
    stages: Array<{ value: string; label: string; color?: string }>;
    leadOrigins: Array<{ value: string; label: string }>;
    segments: Array<{ value: string; label: string }>;
  };
  kpis: {
    closedRevenue: number | null;
    pipelineOpenValue: number | null;
    winRate: number | null;
    averageDealValue: number | null;
    averageSalesCycleDays: number | null;
    pipelineVelocity: number | null;
    openOpportunities: number | null;
    wonCount: number | null;
    lostCount: number | null;
  };
  goal: {
    monthlyRevenueGoalKz: number | null;
    attainmentPercent: number | null;
    gapKz: number | null;
  };
  headline: {
    monthlyForecastKz: number | null;
    riskDealsCount: number;
    summary: string;
  };
  healthScore: {
    score: number;
    status: 'saudavel' | 'atencao' | 'risco';
    reasons: string[];
  };
  kpiContext: {
    pipelineOpenValue: string;
    averageSalesCycleDays: string;
    averageDealValue: string;
    followUpsToday: string;
  };
  pipelineHealth: {
    byStage: Array<{
      stage: string;
      color: string;
      count: number;
      averageDaysInStage: number | null;
      conversionRate: number | null;
      winRateFromStage: number | null;
    }>;
    slowestStage: { stage: string; averageDaysInStage: number | null } | null;
    staleDeals: Array<{ id: number; name: string; company: string; stage: string; daysInStage: number; lastActivityDays: number | null }>;
    leadsWithoutFollowUp: Array<{ id: number; name: string; company: string; stage: string; lastActivityDays: number | null }>;
  } | null;
  nextActions: {
    overdueTasks: Task[];
    followUpsToday: Task[];
    birthdaysToday: Array<{ id: number; name: string; company: string; birthDate: string }>;
    alerts: Array<{ id: string; title: string; message?: string | null; type: string; createdAt: string; contact?: { id: number; name: string; company: string } | null }>;
  } | null;
}

export interface ServicesDashboardSettings {
  monthlyRevenueGoalKz: number | null;
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
  userId?: number | null;
  type: TransactionType;
  category: string;
  subcategories?: string[];
  color?: string;
  icon?: string;
  sortOrder?: number;
  active?: boolean;
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

export interface FoodSettings {
  id: string | null;
  userId: number | null;
  organizationId?: number | null;
  isEnabled: boolean;
  restaurantName?: string | null;
  logoUrl?: string | null;
  primaryColor: string;
  secondaryColor?: string | null;
  restaurantPhone?: string | null;
  restaurantEmail?: string | null;
  restaurantAddress?: string | null;
  currency: string;
  timezone: string;
  defaultPreparationMinutes: number;
  kdsGreenMinutes: number;
  kdsYellowMinutes: number;
  kdsRedMinutes: number;
  orderTypes: string[];
  paymentMethods: string[];
  kitchenSoundEnabled: boolean;
  kitchenSoundVolume: number;
  kitchenSoundRepeatSeconds: number;
  kdsUnacceptedWarningSeconds: number;
  kdsUnacceptedEscalationSeconds: number;
  kdsReadyReminderMinutes: number;
  createdByUserId?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface FoodBranch {
  id: string;
  userId: number;
  organizationId?: number;
  estabelecimentoId?: string | null;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  neighborhood?: string | null;
  isMain: boolean;
  active: boolean;
  createdByUserId?: number | null;
  createdAt: string;
  updatedAt: string;
  estabelecimento?: Pick<Estabelecimento, 'id' | 'nome' | 'nif'> | null;
}

export interface FoodCategory {
  id: string;
  userId: number;
  organizationId?: number;
  name: string;
  color?: string | null;
  icon?: string | null;
  sortOrder: number;
  active: boolean;
  archivedAt?: string | null;
  createdByUserId?: number | null;
  createdAt: string;
  updatedAt: string;
  _count?: { products: number };
}

export interface FoodModifierOption {
  id: string;
  userId: number;
  organizationId?: number;
  groupId: string;
  name: string;
  priceDelta: number;
  sortOrder: number;
  active: boolean;
  createdByUserId?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface FoodModifierGroup {
  id: string;
  userId: number;
  organizationId?: number;
  name: string;
  required: boolean;
  minSelection: number;
  maxSelection?: number | null;
  sortOrder: number;
  active: boolean;
  createdByUserId?: number | null;
  createdAt: string;
  updatedAt: string;
  options?: FoodModifierOption[];
}

export interface FoodProduct {
  id: string;
  userId: number;
  organizationId?: number;
  branchId?: string | null;
  categoryId?: string | null;
  internalCode: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  price: number;
  cost?: number | null;
  preparationMinutes: number;
  available: boolean;
  active: boolean;
  archivedAt?: string | null;
  sortOrder: number;
  createdByUserId?: number | null;
  createdAt: string;
  updatedAt: string;
  branch?: Pick<FoodBranch, 'id' | 'name'> | null;
  category?: Pick<FoodCategory, 'id' | 'name' | 'color' | 'icon'> | null;
  modifierGroups?: Array<{
    id: string;
    groupId: string;
    sortOrder: number;
    group: FoodModifierGroup;
  }>;
  recipeItems?: FoodRecipeItem[];
}

export type FoodOrderStatus =
  | 'draft'
  | 'pending_confirmation'
  | 'confirmed'
  | 'sent_to_kitchen'
  | 'kitchen_accepted'
  | 'preparing'
  | 'ready'
  | 'awaiting_handoff'
  | 'out_for_delivery'
  | 'delivered'
  | 'completed'
  | 'cancelled';

export type FoodOrderType = 'delivery' | 'pickup' | 'dine_in';
export type FoodPaymentStatus = 'pending' | 'paid' | 'partial' | 'refunded';
export type FoodOrderState = 'draft' | 'active' | 'completed' | 'cancelled';
export type FoodKitchenState = 'not_required' | 'queued' | 'accepted' | 'preparing' | 'ready';
export type FoodDeliveryState =
  | 'not_required' | 'pending' | 'awaiting_dispatch' | 'assigned'
  | 'approaching_pickup' | 'picked_up' | 'out_for_delivery' | 'arrived'
  | 'delivered' | 'failed' | 'returned';
export type FoodPaymentState = 'unpaid' | 'partial' | 'paid' | 'refunded';

export interface FoodCustomerSearchResult {
  id: number;
  name: string;
  phone: string;
  email?: string | null;
  location?: string | null;
  company?: string | null;
  totalOrders?: number;
  totalSpent?: number;
  lastOrder?: Pick<FoodOrder, 'id' | 'orderNumber' | 'displayNumber' | 'total' | 'createdAt' | 'status' | 'statusLabel'> | null;
}

export interface FoodOrderItemModifier {
  id: string;
  userId: number;
  orderItemId: string;
  modifierGroupId?: string | null;
  modifierOptionId?: string | null;
  groupName: string;
  optionName: string;
  priceDelta: number;
  quantity: number;
  total: number;
  sortOrder: number;
  createdAt: string;
}

export interface FoodOrderItem {
  id: string;
  userId: number;
  orderId: string;
  productId?: string | null;
  productName: string;
  productCode?: string | null;
  productImageUrl?: string | null;
  categoryName?: string | null;
  unitPrice: number;
  quantity: number;
  subtotal: number;
  notes?: string | null;
  offered: boolean;
  preparationMinutes: number;
  sortOrder: number;
  kitchenState?: 'pending' | 'preparing' | 'completed' | 'unavailable';
  kitchenIssue?: string | null;
  completedAt?: string | null;
  kitchenTicketItem?: FoodKitchenTicketItem | null;
  createdAt: string;
  modifiers?: FoodOrderItemModifier[];
}

export interface FoodOrderStatusHistory {
  id: string;
  userId: number;
  orderId: string;
  previousStatus?: FoodOrderStatus | null;
  previousStatusLabel?: string | null;
  newStatus: FoodOrderStatus;
  newStatusLabel?: string;
  note?: string | null;
  metadata?: Record<string, unknown>;
  createdByUserId?: number | null;
  createdAt: string;
}

export interface FoodOrder {
  id: string;
  userId: number;
  organizationId?: number;
  branchId?: string | null;
  contactId?: number | null;
  orderNumber: number;
  displayNumber: string;
  status: FoodOrderStatus;
  statusLabel: string;
  orderState: FoodOrderState;
  kitchenState: FoodKitchenState;
  deliveryState: FoodDeliveryState;
  paymentState: FoodPaymentState;
  version: number;
  orderType: FoodOrderType;
  orderTypeLabel: string;
  source: string;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  deliveryAddress?: string | null;
  deliveryNeighborhood?: string | null;
  deliveryReference?: string | null;
  tableName?: string | null;
  paymentMethod?: string | null;
  paymentStatus: FoodPaymentStatus;
  paymentStatusLabel: string;
  subtotal: number;
  discountAmount: number;
  deliveryFee: number;
  taxAmount: number;
  total: number;
  estimatedPreparationMinutes: number;
  notes?: string | null;
  cancelReason?: string | null;
  confirmedAt?: string | null;
  sentToKitchenAt?: string | null;
  readyAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  createdByUserId?: number | null;
  createdByName?: string | null;
  updatedByUserId?: number | null;
  createdAt: string;
  updatedAt: string;
  items?: FoodOrderItem[];
  statusHistory?: FoodOrderStatusHistory[];
  events?: FoodOrderEvent[];
  kitchenTicket?: FoodKitchenTicket | null;
  delivery?: FoodDelivery | null;
  payments?: FoodPayment[];
  fiscalDocuments?: FoodFiscalDocument[];
}

export interface FoodOrderEvent {
  id: string;
  userId: number;
  branchId?: string | null;
  orderId: string;
  version: number;
  eventType: string;
  actorUserId?: number | null;
  actorRole?: string | null;
  origin: string;
  payload: Record<string, unknown>;
  occurredAt: string;
}

export interface FoodAuditEvent {
  id: string;
  organizationId: number;
  branchId?: string | null;
  actorUserId?: number | null;
  actorRole?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  origin: string;
  device?: string | null;
  reason?: string | null;
  idempotencyKey?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  payload: Record<string, unknown>;
  occurredAt: string;
  branch?: Pick<FoodBranch, 'id' | 'name'> | null;
  actor?: { id: number; name: string; email: string } | null;
}

export interface FoodKitchenTicketItem {
  id: string;
  ticketId: string;
  orderItemId: string;
  state: 'pending' | 'preparing' | 'completed' | 'unavailable';
  issueType?: string | null;
  issueNote?: string | null;
  issueResolution?: string | null;
  issueResolvedAt?: string | null;
  issueResolvedByUserId?: number | null;
  startedAt?: string | null;
  completedAt?: string | null;
  orderItem?: FoodOrderItem;
}

export interface FoodKitchenTicket {
  id: string;
  userId: number;
  branchId?: string | null;
  orderId: string;
  state: 'queued' | 'accepted' | 'preparing' | 'ready' | 'collected' | 'cancelled';
  version: number;
  acceptedAt?: string | null;
  acknowledgedAt?: string | null;
  acknowledgedByUserId?: number | null;
  startedAt?: string | null;
  readyAt?: string | null;
  createdAt: string;
  updatedAt: string;
  items?: FoodKitchenTicketItem[];
  order?: FoodOrder;
  branch?: Pick<FoodBranch, 'id' | 'name'> | null;
  alert?: FoodKitchenAlert;
}

export type FoodKitchenAlertLevel = 'new' | 'change' | 'unaccepted_warning' | 'cashier_escalation' | 'on_time' | 'acknowledged' | 'near_limit' | 'late' | 'critical' | 'ready_waiting';

export interface FoodKitchenAlert {
  level: FoodKitchenAlertLevel;
  label: string;
  elapsedSeconds: number;
  readySeconds?: number;
  audible: boolean;
  requiresAcknowledgement: boolean;
}

export interface FoodDelivery {
  id: string;
  userId: number;
  branchId?: string | null;
  orderId: string;
  courierUserId?: number | null;
  state: FoodDeliveryState;
  proofType?: 'pin' | 'photo' | null;
  proofMediaId?: string | null;
  failureReason?: string | null;
  returnReason?: string | null;
  attemptCount: number;
  assignedAt?: string | null;
  pickedUpAt?: string | null;
  arrivedAt?: string | null;
  deliveredAt?: string | null;
  returnedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  order?: FoodOrder;
  branch?: Pick<FoodBranch, 'id' | 'name'> | null;
  proofMedia?: { id: string; kind: string; mimeType: string; createdAt: string } | null;
  contactAvailable?: boolean;
  customerDataRedacted?: boolean;
  collection?: FoodDeliveryCollection | null;
}

export type FoodDeliveryCollectionState =
  | 'pending_collection' | 'with_courier' | 'handed_to_cashier' | 'reconciled'
  | 'not_received' | 'discrepancy' | 'returned';

export interface FoodDeliveryCollection {
  id: string;
  organizationId: number;
  branchId?: string | null;
  deliveryId: string;
  orderId: string;
  courierUserId: number;
  state: FoodDeliveryCollectionState;
  expectedAmount: number;
  expectedMethod?: string | null;
  actualAmount?: number | null;
  actualMethod?: string | null;
  discrepancyAmount?: number | null;
  exceptionReason?: string | null;
  version: number;
  receivedAt?: string | null;
  handedOverAt?: string | null;
  reconciledAt?: string | null;
  payment?: FoodPayment | null;
  events?: Array<{ id: string; eventType: string; version: number; payload: Record<string, unknown>; createdAt: string }>;
}

export type FoodCourierOperationalStatus = 'available' | 'unavailable' | 'off_shift' | 'assigned' | 'heading_pickup' | 'at_restaurant' | 'delivering' | 'no_gps' | 'problem';

export interface FoodCourierProfile {
  id: string;
  organizationId: number;
  personId: number;
  phone?: string | null;
  address?: string | null;
  transportType?: 'motorcycle' | 'bicycle' | 'car' | 'on_foot' | 'other' | null;
  vehiclePlate?: string | null;
  baseStatus: 'available' | 'unavailable' | 'no_gps' | 'off_shift';
  lastLatitude?: number | null;
  lastLongitude?: number | null;
  lastLocationAt?: string | null;
  active: boolean;
  statusEvents?: Array<{ id: string; previousStatus?: string | null; newStatus: string; reason?: string | null; createdAt: string }>;
}

export interface FoodCourierSnapshot {
  profile?: FoodCourierProfile | null;
  shift?: FoodShift | null;
  activeDelivery?: { id: string; state: FoodDeliveryState; branchId?: string | null; orderId: string } | null;
  operationalStatus: FoodCourierOperationalStatus;
  metrics: { deliveredCount: number };
}

export interface FoodCourierAssignment {
  id: string;
  personId: number;
  branchId?: string | null;
  person: { id: number; name: string; email: string; active: boolean };
  courierProfile?: FoodCourierProfile | null;
  currentShift?: FoodShift | null;
  activeDelivery?: FoodCourierSnapshot['activeDelivery'];
  operationalStatus: FoodCourierOperationalStatus;
  assignmentEligible: boolean;
  legacyProfile: boolean;
  metrics: FoodCourierSnapshot['metrics'];
}

export interface FoodPayment {
  id: string;
  userId: number;
  branchId?: string | null;
  orderId: string;
  cashSessionId?: string | null;
  deliveryCollectionId?: string | null;
  source?: 'cashier' | 'delivery_collection' | string;
  courierUserId?: number | null;
  amount: number;
  method: string;
  status: string;
  transactionReference?: string | null;
  paidAt?: string | null;
  createdAt: string;
}

export interface FoodCashSession {
  id: string;
  organizationId: number;
  branchId: string;
  shiftId?: string | null;
  openedByUserId: number;
  closedByUserId?: number | null;
  status: 'open' | 'closed';
  openingBalance: number;
  expectedClosingAmount: number;
  closingCountedAmount?: number | null;
  differenceAmount?: number | null;
  totalSalesAmount: number;
  salesCount: number;
  totalsByMethod: Record<string, number>;
  notes?: string | null;
  openedDeviceId?: string | null;
  closedDeviceId?: string | null;
  approvalStatus: 'not_required' | 'pending' | 'approved' | 'rejected';
  approvedByUserId?: number | null;
  approvedAt?: string | null;
  approvalNote?: string | null;
  openedAt: string;
  closedAt?: string | null;
  branch?: Pick<FoodBranch, 'id' | 'name'>;
  shift?: FoodShift | null;
}

export interface FoodShift {
  id: string;
  organizationId: number;
  branchId: string;
  personId: number;
  status: 'open' | 'closed';
  startDeviceId?: string | null;
  endDeviceId?: string | null;
  notes?: string | null;
  startedAt: string;
  endedAt?: string | null;
  branch?: Pick<FoodBranch, 'id' | 'name'>;
  person?: { id: number; name: string; email: string };
}

export interface FoodWorkforceStatus {
  credentialConfigured: boolean;
  credentialLockedUntil?: string | null;
  shift?: FoodShift | null;
}

export interface FoodWorkSchedule {
  id: string;
  organizationId: number;
  branchId: string;
  personId: number;
  workDate: string;
  startTime: string;
  endTime: string;
  notes?: string | null;
  active: boolean;
  branch?: Pick<FoodBranch, 'id' | 'name'>;
  person?: { id: number; name: string; email: string };
}

export interface FoodWorkforcePerformance {
  person: { id: number; name: string; email: string; active: boolean };
  roles: string[];
  shiftOpen?: FoodShift | null;
  hours: number;
  orders: number;
  orderValue: number;
  cashSales: number;
  cashDifference: number;
  pendingApprovals: number;
}

export interface FoodWorkforceDashboard {
  from: string;
  days: number;
  summary: { peopleWorking: number; openCashSessions: number; pendingApprovals: number; hours: number; orders: number };
  activeShifts: FoodShift[];
  performance: FoodWorkforcePerformance[];
  cashSessions: FoodCashSession[];
  schedules: FoodWorkSchedule[];
}

export interface FoodFiscalDocument {
  id: string;
  orderId: string;
  paymentId?: string | null;
  facturaId?: string | null;
  documentType: string;
  status: 'pending' | 'issued' | 'failed';
  attemptCount: number;
  errorCode?: string | null;
  errorMessage?: string | null;
  requestedAt: string;
  issuedAt?: string | null;
  factura?: { id: string; documentNo: string; grossTotal: number };
}

export interface FoodContext {
  entitled: boolean;
  enabled: boolean;
  roles: string[];
  primaryRole?: string | null;
  branchIds: string[] | null;
  branches: Array<Pick<FoodBranch, 'id' | 'name' | 'isMain'> & Partial<Pick<FoodBranch, 'address' | 'neighborhood'>>>;
  permissions: string[];
  roleLabels: Record<string, string>;
}

export interface FoodIngredient {
  id: string;
  organizationId: number;
  branchId?: string | null;
  internalCode: string;
  name: string;
  unit: string;
  currentStock: number;
  minimumStock: number;
  idealStock: number;
  purchaseUnit: string;
  purchaseConversion: number;
  preferredSupplierId?: string | null;
  averageCost: number;
  active: boolean;
  lowStock?: boolean;
  branch?: Pick<FoodBranch, 'id' | 'name'> | null;
  preferredSupplier?: Pick<FoodSupplier, 'id' | 'name' | 'phone'> | null;
  _count?: { recipeItems: number };
}

export interface FoodStockAlert {
  id: string;
  organizationId: number;
  branchId?: string | null;
  ingredientId: string;
  status: 'open' | 'resolved';
  severity: 'warning' | 'critical';
  recommendedQuantity: number;
  openedAt: string;
  resolvedAt?: string | null;
  lastEvaluatedAt: string;
}

export interface FoodStockReplenishmentItem {
  ingredient: FoodIngredient;
  currentStock: number;
  minimumStock: number;
  idealStock: number;
  pendingQuantity: number;
  recommendedQuantity: number;
  recommendedPackages: number;
  needsAlert: boolean;
  severity: 'warning' | 'critical';
  alert?: FoodStockAlert | null;
  lastUnitCost?: number | null;
  lastPurchaseId?: string | null;
}

export interface FoodStockReplenishmentResponse {
  summary: { alerts: number; critical: number; recommendedItems: number };
  items: FoodStockReplenishmentItem[];
}

export interface FoodStockMovement {
  id: string;
  organizationId: number;
  branchId?: string | null;
  ingredientId: string;
  purchaseId?: string | null;
  type: string;
  quantity: number;
  previousStock: number;
  newStock: number;
  unitCost?: number | null;
  reason?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  createdAt: string;
  branch?: Pick<FoodBranch, 'id' | 'name'> | null;
  ingredient: Pick<FoodIngredient, 'id' | 'name' | 'unit' | 'internalCode'>;
  purchase?: Pick<FoodPurchase, 'id' | 'reference' | 'status'> | null;
}

export interface FoodStockReport {
  branch?: Pick<FoodBranch, 'id' | 'name'> | null;
  from: string;
  days: number;
  inventory: { ingredients: number; value: number; alerts: number };
  movements: { count: number; entries: number; exits: number };
  purchases: {
    byStatus: Array<{ status: string; _count: { _all: number }; _sum: { total: number | null } }>;
    openCount: number;
    openValue: number;
    receivedCount: number;
    receivedValue: number;
  };
}

export interface FoodSupplierWhatsAppDraft {
  supplier: Pick<FoodSupplier, 'id' | 'name' | 'phone'>;
  phone: string;
  message: string;
  url: string;
}

export interface FoodRecipeItem {
  id: string;
  organizationId: number;
  productId: string;
  ingredientId: string;
  quantity: number;
  unit: string;
  wastePercent: number;
  ingredient?: FoodIngredient;
}

export interface FoodSupplier {
  id: string;
  organizationId: number;
  branchId?: string | null;
  name: string;
  nif?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  active: boolean;
  branch?: Pick<FoodBranch, 'id' | 'name'> | null;
  createdAt: string;
}

export interface FoodSupplierProduct {
  id: string;
  organizationId: number;
  supplierId: string;
  ingredientId: string;
  purchaseUnit: string;
  packageQuantity: number;
  packagePrice: number;
  minimumPackages: number;
  leadTimeDays: number;
  qualityRating?: number | null;
  paymentTerms?: string | null;
  active: boolean;
  normalizedUnitCost: number;
  supplier: FoodSupplier;
  ingredient: FoodIngredient;
}

export interface FoodPurchaseSuggestionGroup {
  supplier: FoodSupplier;
  branch: Pick<FoodBranch, 'id' | 'name'>;
  items: Array<{
    ingredient: FoodIngredient;
    offer: FoodSupplierProduct;
    packages: number;
    quantity: number;
    unitCost: number;
    total: number;
  }>;
  total: number;
}

export interface FoodPurchaseSuggestionsResponse {
  branch: Pick<FoodBranch, 'id' | 'name'>;
  groups: FoodPurchaseSuggestionGroup[];
  unpriced: Array<{ ingredient: FoodIngredient; recommendedQuantity: number }>;
}

export interface FoodPurchaseItem {
  id: string;
  ingredientId: string;
  quantity: number;
  receivedQuantity: number;
  unitCost: number;
  total: number;
  ingredient?: FoodIngredient;
}

export interface FoodPurchase {
  id: string;
  organizationId: number;
  branchId: string;
  supplierId?: string | null;
  status: 'draft' | 'awaiting_confirmation' | 'confirmed' | 'in_delivery' | 'partial' | 'received' | 'cancelled' | 'ordered';
  version: number;
  reference?: string | null;
  total: number;
  purchasedAt?: string | null;
  receivedAt?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  createdAt: string;
  branch?: FoodBranch;
  supplier?: FoodSupplier | null;
  items?: FoodPurchaseItem[];
  events?: FoodPurchaseEvent[];
}

export interface FoodPurchaseEvent {
  id: string;
  purchaseId: string;
  type: string;
  statusFrom?: string | null;
  statusTo?: string | null;
  version: number;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface FoodManagementOverview {
  from: string;
  orders: { total: number; cancelled: number; byState: Array<{ orderState: string; _count: { _all: number }; _sum: { total: number | null } }> };
  revenue: number;
  paymentsCount: number;
  averageTicket: number;
  deliveries: Array<{ state: string; _count: { _all: number } }>;
  lowStock: number;
  openSessions: number;
}

export interface FoodOperationalReportSummary {
  orders: number;
  cancelledOrders: number;
  cancellationRate: number;
  orderValue: number;
  received: number;
  reconciled: number;
  heldByCouriers: number;
  outstanding: number;
  averageTicket: number;
  discounts: number;
  delivered: number;
  failedDeliveries: number;
  deliverySuccessRate: number;
  purchasesReceived: number;
  cashDifference: number;
}

export interface FoodOperationalReport {
  period: { from: string; to: string; days: number; previousFrom: string; previousTo: string; branchId?: string | null };
  summary: FoodOperationalReportSummary;
  previous: FoodOperationalReportSummary;
  comparison: Partial<Record<keyof FoodOperationalReportSummary, number | null>>;
  daily: Array<{ date: string; orders: number; orderValue: number; received: number; reconciled: number }>;
  byMethod: Array<{ method: string; received: number; reconciled: number; count: number }>;
  byBranch: Array<{ branchId: string; branchName: string } & FoodOperationalReportSummary>;
  stock: { inventoryValue: number; lowStock: number; movementCount: number; movementValue: number };
  pending: {
    collections: Array<{
      id: string; orderId: string; orderNumber: number; customerName?: string | null;
      branchId?: string | null; branchName: string; courierUserId: number;
      state: FoodDeliveryCollectionState; expectedAmount: number; actualAmount?: number | null;
      discrepancyAmount?: number | null; exceptionReason?: string | null;
      deliveryState: FoodDeliveryState; updatedAt: string;
    }>;
    openCashSessions: number;
    cashDifferences: Array<{
      id: string; branchId: string; differenceAmount?: number | null; approvalStatus: string;
      openedAt: string; closedAt?: string | null; totalSalesAmount: number;
    }>;
  };
}

export interface FoodMonthCloseCheck {
  key: string;
  label: string;
  status: 'ok' | 'warning' | 'blocked';
  count: number;
  amount: number;
  actionHref?: string | null;
  records: Array<Record<string, unknown>>;
}

export interface FoodMonthCloseReadiness {
  period: { month: string; start: string; end: string; branchId?: string | null };
  ready: boolean;
  totals: { blockedChecks: number; blockingRecords: number; warningChecks: number; warningRecords: number };
  checks: FoodMonthCloseCheck[];
}

export interface FoodMonthlyClose {
  id: string;
  organizationId: number;
  branchId?: string | null;
  scopeKey: string;
  month: string;
  status: 'closed' | 'reopened';
  version: number;
  snapshot: FoodOperationalReport;
  validationSnapshot: FoodMonthCloseReadiness;
  closedByUserId: number;
  idempotencyKey: string;
  closedAt: string;
  reopenedByUserId?: number | null;
  reopenedAt?: string | null;
  reopenReason?: string | null;
  createdAt: string;
  updatedAt: string;
  branch?: Pick<FoodBranch, 'id' | 'name'> | null;
  events?: Array<{ id: string; version: number; eventType: string; actorUserId: number; payload: Record<string, unknown>; createdAt: string }>;
  revisions: FoodMonthlyCloseRevision[];
}

export interface FoodMonthlyCloseRevision {
  id: string;
  organizationId: number;
  monthlyCloseId: string;
  revisionNumber: number;
  aggregateVersion: number;
  snapshot: FoodOperationalReport;
  validationSnapshot: FoodMonthCloseReadiness;
  reason: string;
  closedByUserId: number;
  idempotencyKey: string;
  closedAt: string;
  createdAt: string;
}

export interface FoodMarketingOverview {
  customers: number;
  consented: number;
  segments: Array<{ id: string; name: string; description?: string | null; filters: Record<string, unknown> }>;
  coupons: Array<{ id: string; code: string; name: string; discountType: string; discountValue: number; active: boolean; _count?: { redemptions: number } }>;
  campaigns: Array<{ id: string; name: string; channel: string; content: string; status: string; recipientsCount: number; deliveredCount: number; conversionsCount: number; attributedRevenue: number; createdAt: string }>;
}

export interface FoodCustomerAddress {
  id: string;
  organizationId: number;
  profileId: string;
  label: string;
  address: string;
  neighborhood?: string | null;
  reference?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isPrimary: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FoodCustomerProfile {
  id: string;
  organizationId: number;
  contactId: number;
  preferredBranchId?: string | null;
  marketingConsent: boolean;
  transactionalConsent: boolean;
  preferences: FoodCustomerPreferences & Record<string, unknown>;
  notes?: string | null;
  totalOrders: number;
  totalSpent: number;
  lastOrderAt?: string | null;
  preferredBranch?: Pick<FoodBranch, 'id' | 'name'> | null;
  addresses?: FoodCustomerAddress[];
  createdAt: string;
  updatedAt: string;
}

export interface FoodCustomerPreferences {
  allergies?: string[];
  dietaryRestrictions?: string[];
  preferredChannel?: 'WHATSAPP' | 'SMS' | 'EMAIL' | 'NONE';
  preferredOrderType?: 'delivery' | 'pickup' | 'dine_in';
  favoriteNotes?: string | null;
}

export interface FoodV1Customer {
  id: number;
  name: string;
  phone: string;
  email?: string | null;
  company?: string | null;
  location?: string | null;
  birthDate?: string | null;
  tags?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  foodProfile?: FoodCustomerProfile | null;
  insights?: {
    favoriteProducts: Array<{ productId?: string | null; name: string; quantity: number }>;
  };
}

export type FoodCustomerOccurrenceType = 'complaint' | 'compliment' | 'preference' | 'incident' | 'follow_up' | 'other';
export type FoodCustomerOccurrenceSeverity = 'low' | 'medium' | 'high';

export interface FoodCustomerOccurrence {
  id: string;
  organizationId: number;
  contactId: number;
  branchId?: string | null;
  type: FoodCustomerOccurrenceType;
  severity: FoodCustomerOccurrenceSeverity;
  title: string;
  description?: string | null;
  status: 'open' | 'resolved';
  occurredAt: string;
  resolvedAt?: string | null;
  resolutionNote?: string | null;
  branch?: Pick<FoodBranch, 'id' | 'name'> | null;
  createdAt: string;
  updatedAt: string;
}

export type FoodCustomerTimelineType = 'all' | 'order' | 'coupon' | 'occurrence' | 'audit';

export interface FoodCustomerTimelineEvent {
  id: string;
  entityId?: string;
  type: Exclude<FoodCustomerTimelineType, 'all'>;
  occurredAt: string;
  title: string;
  description?: string | null;
  status: string;
  severity?: FoodCustomerOccurrenceSeverity;
  occurrenceType?: FoodCustomerOccurrenceType;
  resolutionNote?: string | null;
  resolvedAt?: string | null;
  branch?: Pick<FoodBranch, 'id' | 'name'> | null;
  metadata: Record<string, unknown>;
}

export interface FoodCustomerDuplicatePair {
  id: string;
  reasons: Array<'phone' | 'email' | 'name_context'>;
  customers: [FoodV1Customer, FoodV1Customer];
}

export interface FoodCustomerMergeResult {
  customer: FoodV1Customer;
  sourceContactId: number;
  reasons: FoodCustomerDuplicatePair['reasons'];
  moved: Record<string, number>;
}

export type FoodCustomerImportRowInput = {
  name?: string;
  phone?: string;
  email?: string;
  company?: string;
  location?: string;
  birthDate?: string;
  tags?: string;
  notes?: string;
  marketingConsent?: string | boolean;
};

export type FoodCustomerImportRow = {
  rowNumber: number;
  status: 'valid' | 'invalid' | 'duplicate_file' | 'existing' | 'existing_inactive';
  data: {
    name: string;
    phone: string;
    email: string;
    company: string;
    location?: string | null;
    birthDate?: string | null;
    tags: string[];
    notes?: string | null;
    marketingConsent: boolean;
  };
  errors: string[];
  existingCustomer?: Pick<FoodV1Customer, 'id' | 'name' | 'phone' | 'email' | 'status'> | null;
};

export interface FoodCustomerImportPreview {
  rows: FoodCustomerImportRow[];
  summary: {
    total: number;
    valid: number;
    invalid: number;
    duplicate_file: number;
    existing: number;
    existing_inactive: number;
  };
  maxRows: number;
}

export interface FoodCustomerImportResult {
  importId: string;
  total: number;
  imported: number;
  updated: number;
  skipped: number;
  invalid: number;
  errors: FoodCustomerImportRow[];
}

export interface FoodBirthdayCustomer {
  id: number;
  name: string;
  phone: string;
  email?: string | null;
  birthDate: string;
  nextBirthday: string;
  daysUntil: number;
  ageTurning: number;
  preferredChannel: 'WHATSAPP' | 'SMS' | 'EMAIL' | 'NONE';
  marketingConsent: boolean;
  eligible: boolean;
  totalOrders: number;
  totalSpent: number;
}

export interface FoodBirthdaySettings {
  id?: string;
  organizationId?: number;
  enabled: boolean;
  daysBefore: number;
  sendTime: string;
  channel: 'WHATSAPP' | 'SMS' | 'EMAIL';
  template: string;
  benefitType: 'none' | 'coupon';
  couponId?: string | null;
  validityDays: number;
  minimumOrder: number;
  segmentId?: string | null;
  coupon?: FoodMarketingOverview['coupons'][number] | null;
  segment?: FoodMarketingOverview['segments'][number] | null;
}

export interface FoodOrderStatusOption {
  value: FoodOrderStatus;
  label: string;
}

export interface FoodOrderCreateItemInput {
  productId: string;
  quantity: number;
  modifierOptionIds?: string[];
  notes?: string | null;
  offered?: boolean;
}

export interface FoodOrderCreateInput {
  branchId?: string | null;
  contactId?: number | null;
  createCustomer?: boolean;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  orderType: FoodOrderType;
  source?: string | null;
  deliveryAddress?: string | null;
  deliveryNeighborhood?: string | null;
  deliveryReference?: string | null;
  tableName?: string | null;
  paymentMethod?: string | null;
  paymentStatus?: FoodPaymentStatus;
  discountAmount?: number;
  deliveryFee?: number;
  taxAmount?: number;
  notes?: string | null;
  sendToKitchen?: boolean;
  status?: FoodOrderStatus;
  items: FoodOrderCreateItemInput[];
}

export interface FoodOverview {
  settings: FoodSettings;
  counts: {
    branches: number;
    categories: number;
    products: number;
    modifierGroups: number;
    activeOrders?: number;
    todaysOrders?: number;
  };
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
  lastSeenAt?: string | null;
  isOnline?: boolean;
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

export interface ChatMessageMetadata {
  type?: 'task_assignment' | string;
  taskId?: number;
  taskTitle?: string;
  assignedByName?: string;
  href?: string;
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
  metadata?: ChatMessageMetadata;
  readByOtherAt?: string | null;
  createdAt: string;
}

export type ClientAccountPlanName = 'essencial' | 'profissional' | 'enterprise';
export type ClientAccountPermissions = Record<string, unknown>;

export interface ClientAccountPlanCatalogEntry {
  label: string;
  description?: string;
  limits?: Record<string, unknown>;
  features?: Record<string, boolean>;
}

export interface PlanUsageItem {
  current: number;
  limit: number;
}

export interface PlanUsage {
  plan: ClientAccountPlanName;
  usage: Record<string, PlanUsageItem>;
}

export type AvailablePlanCatalog = Record<ClientAccountPlanName, ClientAccountPlanCatalogEntry>;

// ── GESTÃO DE CONTAS CLIENTES ────────────────────────────────
export interface ClientAccountMember {
  id: number;
  name: string;
  email: string;
  active: boolean;
  permissions: ClientAccountPermissions | null;
}

export interface ClientAccount {
  id: number;
  name: string;
  email: string;
  active: boolean;
  plan: ClientAccountPlanName;
  permissions: ClientAccountPermissions | null;
  createdAt: string;
  accountMembers: ClientAccountMember[];
  _count: { accountMembers: number };
}

export interface NoteAttachment {
  name: string;
  url: string;
  size?: number;
  contentType?: string;
  uploadedAt: string;
}

export interface ContactNote {
  id: number;
  contactId: number;
  content: string;
  attachments: NoteAttachment[];
  createdAt: string;
  updatedAt: string;
  user?: { id: number; name: string };
}

export interface Company {
  id: string;
  userId: number;
  name: string;
  nif?: string | null;
  sector?: string | null;
  website?: string | null;
  location?: string | null;
  sizeTier?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { deals: number };
}

export interface DealStage {
  id: string;
  userId: number;
  name: string;
  color: string;
  order: number;
}

export type DealStatus = 'aberto' | 'ganho' | 'perdido';
export type StakeholderRole = 'tecnico' | 'decisor' | 'financeiro' | 'influenciador' | 'outro';
export type StakeholderInfluence = 'alto' | 'medio' | 'baixo';

export interface DealStakeholder {
  id: string;
  dealId: string;
  contactId: number;
  role: StakeholderRole;
  influence?: StakeholderInfluence | null;
  isPrimary: boolean;
  notes?: string | null;
  addedAt: string;
  contact?: { id: number; name: string; email: string; phone: string };
}

export interface Deal {
  id: string;
  userId: number;
  companyId: string;
  stageId: string;
  title: string;
  valueKz?: number | null;
  status: DealStatus;
  lossReason?: string | null;
  ownerUserId?: number | null;
  expectedCloseDate?: string | null;
  stageEnteredAt: string;
  closedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  company?: Company;
  stage?: DealStage;
  stakeholders?: DealStakeholder[];
  _count?: { stakeholders: number };
}

export type DealNoteType = 'nota' | 'reuniao' | 'chamada' | 'email' | 'proximo_passo';

export interface DealNote {
  id: string;
  dealId: string;
  userId: number;
  content: string;
  noteType: DealNoteType;
  createdAt: string;
  updatedAt: string;
  user?: { id: number; name: string };
}
