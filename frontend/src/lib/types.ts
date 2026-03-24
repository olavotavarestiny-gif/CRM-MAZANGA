export type Stage = string;

export interface PipelineStage {
  id: string;
  userId: number;
  name: string;
  color: string;
  order: number;
  createdAt: string;
}
export type Priority = 'Alta' | 'Media' | 'Baixa';

export interface Task {
  id: number;
  contactId?: number | null;
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
}

export interface Contact {
  id: number;
  name: string;
  email: string;
  phone: string;
  company: string;
  revenue?: string;
  sector?: string;
  stage: Stage;
  inPipeline: boolean;
  tags?: string[];
  customFields?: Record<string, string>;
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
export type SystemFieldKey = 'email' | 'phone' | 'company' | 'revenue' | 'sector' | 'tags';

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
  action: string; // "send_email", "send_template", "send_text", "update_stage"
  targetStage?: Stage; // for update_stage action
  templateName?: string;
  emailSubject?: string;
  emailBody?: string;
  active: boolean;
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
  isOffline: boolean;
  documentDate: string;
  createdAt: string;
  currencyCode: string;
  currencyAmount?: number;
  exchangeRate?: number;
  paymentMethod?: string;
  serie?: { seriesCode: string; seriesYear: number; documentType: string };
  estabelecimento?: { id: string; nome: string; nif: string };
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
  nif: string;
  morada?: string;
  telefone?: string;
  email?: string;
  isPrincipal: boolean;
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

export interface Produto {
  id: string;
  productCode: string;
  productDescription: string;
  unitPrice: number;
  unitOfMeasure: string;
  taxPercentage: number;
  taxCode: string;
  active: boolean;
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
  currencyCode: string;
  exchangeRate?: number;
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

export interface PlanUsageItem {
  current: number;
  limit: number;
}

export interface PlanUsage {
  plan: string;
  usage: Record<string, PlanUsageItem>;
}

// ── GESTÃO DE CONTAS CLIENTES ────────────────────────────────
export interface ClientAccountMember {
  id: number;
  name: string;
  email: string;
  active: boolean;
  allowedPages: string[] | null;
}

export interface ClientAccount {
  id: number;
  name: string;
  email: string;
  active: boolean;
  plan: string;
  allowedPages: string[] | null;
  createdAt: string;
  accountMembers: ClientAccountMember[];
  _count: { accountMembers: number };
}

