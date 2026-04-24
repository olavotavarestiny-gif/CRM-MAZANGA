import axios from 'axios';
import type {
  ActivityEntityHistoryResponse,
  ActivityFeedResponse,
  Automation,
  AutomationLogsResponse,
  AutomationStatsResponse,
  CalendarConnectionStatus,
  CalendarEvent,
  CaixaSessao,
  ChatChannel,
  ChatMessage,
  ClientAccount,
  ClientProfitability,
  ClienteFaturacao,
  ComercialAnalise,
  ComercialResumo,
  CommercialAdvancedLocationsResponse,
  CommercialAdvancedOverviewResponse,
  CommercialAdvancedProductsResponse,
  CommercialAdvancedSalesResponse,
  CommercialAdvancedTeamResponse,
  Contact,
  BulkUpdateContactsInput,
  BulkUpdateContactsResponse,
  ContactGroup,
  ContactFieldConfig,
  ContactFieldDef,
  CRMForm,
  DashboardStats,
  Estabelecimento,
  Factura,
  FacturaLine,
  FacturaRecorrente,
  FaturacaoConfig,
  FaturacaoDashboard,
  FinancialCategory,
  FormField,
  FormSubmission,
  PipelineAnalyticsConversionResponse,
  PipelineAnalyticsForecastResponse,
  PipelineAnalyticsTeamResponse,
  PipelineAnalyticsVelocityResponse,
  PipelineStage,
  PlanUsage,
  Produto,
  ProdutoCategoria,
  SaftPeriodo,
  Serie,
  ServicesAdvancedOverviewResponse,
  ServicesAdvancedPipelineResponse,
  ServicesAdvancedRevenueResponse,
  ServicesAdvancedTeamResponse,
  StockMovement,
  SystemFieldKey,
  Task,
  Transaction,
} from './types';
import { createClient } from './supabase/client';

const DEFAULT_API_URL = 'http://localhost:3001';
const RAW_API_URL = process.env.NEXT_PUBLIC_API_URL?.trim() || '';

function isAbsoluteHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function getApiUrlConfigErrorMessage(value: string): string | null {
  if (!value) {
    return 'A beta está sem NEXT_PUBLIC_API_URL configurado. Define a URL pública do backend Render antes de usar a aplicação.';
  }

  if (isAbsoluteHttpUrl(value)) {
    return null;
  }

  if (value.startsWith('sb_publishable_')) {
    return 'NEXT_PUBLIC_API_URL está inválido: recebemos uma chave publishable do Supabase em vez da URL do backend Render.';
  }

  return 'NEXT_PUBLIC_API_URL está inválido. Usa uma URL absoluta do backend Render, por exemplo https://seu-backend.onrender.com.';
}

export const API_URL_CONFIG_ERROR = getApiUrlConfigErrorMessage(RAW_API_URL);

const API_URL = API_URL_CONFIG_ERROR ? DEFAULT_API_URL : RAW_API_URL || DEFAULT_API_URL;

const api = axios.create({
  baseURL: API_URL,
});

let _supabaseClient: ReturnType<typeof createClient> | null = null;
function getSupabaseClient() {
  if (!_supabaseClient) _supabaseClient = createClient();
  return _supabaseClient;
}

// Request interceptor: prefer impersonation token, fall back to Supabase session token
api.interceptors.request.use(async (config) => {
  if (API_URL_CONFIG_ERROR) {
    throw new Error(API_URL_CONFIG_ERROR);
  }

  if (typeof window !== 'undefined') {
    const impersonationToken = localStorage.getItem('impersonation_token');
    if (impersonationToken) {
      config.headers.Authorization = `Bearer ${impersonationToken}`;
      return config;
    }
  }
  const supabase = getSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

// Response interceptor: handle 401 + extract user-friendly error messages
let isLoggingOut = false;
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !isLoggingOut) {
      isLoggingOut = true;
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/signout';
      }
    }
    // Extract the backend error message so .message is always human-readable
    const message =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message;
    const friendlyError = new Error(message);
    (friendlyError as any).response = error.response;
    return Promise.reject(friendlyError);
  }
);

// Contacts
export async function getContacts(params?: { stage?: string; search?: string; revenue?: string; inPipeline?: string; contactType?: string; groupId?: string }) {
  const response = await api.get<Contact[]>('/api/contacts', { params });
  return response.data;
}

export async function getContactGroups() {
  const response = await api.get<ContactGroup[]>('/api/contacts/groups');
  return response.data;
}

export async function createContactGroup(data: Pick<ContactGroup, 'name'>) {
  const response = await api.post<ContactGroup>('/api/contacts/groups', data);
  return response.data;
}

export async function updateContactGroup(id: string, data: Pick<ContactGroup, 'name'>) {
  const response = await api.put<ContactGroup>(`/api/contacts/groups/${id}`, data);
  return response.data;
}

export async function deleteContactGroup(id: string) {
  const response = await api.delete<{ message: string; detachedContactsCount: number }>(`/api/contacts/groups/${id}`);
  return response.data;
}

export async function createContact(data: Partial<Contact>) {
  const response = await api.post<Contact>('/api/contacts', data);
  return response.data;
}

export async function getContact(id: string) {
  const response = await api.get<Contact & { tasks: Task[] }>(
    `/api/contacts/${id}`
  );
  return response.data;
}

export async function updateContact(id: string, data: Partial<Contact>) {
  const response = await api.put<Contact>(`/api/contacts/${id}`, data);
  return response.data;
}

export async function bulkUpdateContacts(data: BulkUpdateContactsInput) {
  const response = await api.post<BulkUpdateContactsResponse>('/api/contacts/bulk-update', data);
  return response.data;
}

export async function deleteContact(id: string) {
  await api.delete(`/api/contacts/${id}`);
}

export async function getContactNotes(contactId: number, skip = 0) {
  const res = await api.get(`/api/contacts/${contactId}/notes?skip=${skip}`);
  return res.data as import('./types').ContactNote[];
}

export async function createContactNote(contactId: number, content: string) {
  const res = await api.post(`/api/contacts/${contactId}/notes`, { content });
  return res.data as import('./types').ContactNote;
}

export async function updateContactNote(noteId: number, content: string) {
  const res = await api.put(`/api/notes/${noteId}`, { content });
  return res.data as import('./types').ContactNote;
}

export async function deleteContactNote(noteId: number) {
  await api.delete(`/api/notes/${noteId}`);
}

export async function getContactSummary(contactId: number) {
  const res = await api.get(`/api/contacts/${contactId}/summary`);
  return res.data as {
    totalComprado: number;
    ultimoServico: { data: string; descricao: string; valor: number } | null;
    transacoes: any[];
    faturas: any[];
  };
}

export async function getEntityHistory(
  entityType: string,
  entityId: string | number,
  params?: { page?: number; pageSize?: number }
) {
  const response = await api.get<ActivityEntityHistoryResponse>(`/api/activity/entity/${entityType}/${entityId}`, { params });
  return response.data;
}

export async function getActivityFeed(params?: {
  page?: number;
  pageSize?: number;
  userId?: number;
  entityType?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const response = await api.get<ActivityFeedResponse>('/api/activity', { params });
  return response.data;
}

export interface ImportContactData {
  firstName?: string;
  lastName?: string;
  companyName?: string;
  phone: string;
  email?: string;
  revenue?: string;
  sector?: string;
}

export async function importContacts(contacts: ImportContactData[]) {
  const response = await api.post<{
    total: number;
    imported: number;
    skipped: number;
    message: string;
  }>('/api/contacts/import', { contacts });
  return response.data;
}

// Contact Field Definitions
export async function getContactFieldDefs() {
  const response = await api.get<ContactFieldDef[]>('/api/contacts/fields');
  return response.data;
}

export async function createContactFieldDef(data: {
  label: string;
  type: string;
  options?: string[];
  required?: boolean;
}) {
  const response = await api.post<ContactFieldDef>('/api/contacts/fields', data);
  return response.data;
}

export async function updateContactFieldDef(id: string, data: Partial<ContactFieldDef>) {
  const response = await api.put<ContactFieldDef>(`/api/contacts/fields/${id}`, data);
  return response.data;
}

export async function deleteContactFieldDef(id: string) {
  await api.delete(`/api/contacts/fields/${id}`);
}

export async function reorderContactFieldDefs(order: { id: string; order: number }[]) {
  await api.put('/api/contacts/fields/reorder', { order });
}

// Pipeline Stages
export async function getPipelineStages() {
  const response = await api.get<PipelineStage[]>('/api/pipeline-stages');
  return response.data;
}

export async function createPipelineStage(data: { name: string; color: string }) {
  const response = await api.post<PipelineStage>('/api/pipeline-stages', data);
  return response.data;
}

export async function updatePipelineStage(id: string, data: { name?: string; color?: string }) {
  const response = await api.put<PipelineStage>(`/api/pipeline-stages/${id}`, data);
  return response.data;
}

export async function deletePipelineStage(id: string) {
  const response = await api.delete<{ message: string; movedTo?: string }>(`/api/pipeline-stages/${id}`);
  return response.data;
}

export async function reorderPipelineStages(order: { id: string; order: number }[]) {
  const response = await api.put<PipelineStage[]>('/api/pipeline-stages/reorder', { order });
  return response.data;
}

export async function getPipelineAnalyticsConversion(params: {
  organization_id: number;
  period?: '7d' | '30d' | '90d';
}) {
  const response = await api.get<PipelineAnalyticsConversionResponse>('/api/pipeline/analytics/conversion', { params });
  return response.data;
}

export async function getPipelineAnalyticsVelocity(params: {
  organization_id: number;
  period?: '7d' | '30d' | '90d';
}) {
  const response = await api.get<PipelineAnalyticsVelocityResponse>('/api/pipeline/analytics/velocity', { params });
  return response.data;
}

export async function getPipelineAnalyticsForecast(params: {
  organization_id: number;
  period?: '7d' | '30d' | '90d';
}) {
  const response = await api.get<PipelineAnalyticsForecastResponse>('/api/pipeline/analytics/forecast', { params });
  return response.data;
}

export async function getPipelineAnalyticsTeam(params: {
  organization_id: number;
  period?: '7d' | '30d' | '90d';
}) {
  const response = await api.get<PipelineAnalyticsTeamResponse>('/api/pipeline/analytics/team', { params });
  return response.data;
}

// System field config for contact built-ins shown in customization
export async function getContactFieldConfigs() {
  const response = await api.get<ContactFieldConfig[]>('/api/contacts/field-config');
  return response.data;
}

export async function updateContactFieldConfig(
  key: SystemFieldKey,
  data: Partial<Pick<ContactFieldConfig, 'label' | 'visible' | 'required' | 'order'>>
) {
  const response = await api.put<ContactFieldConfig[]>(`/api/contacts/field-config/${key}`, data);
  return response.data;
}

// Automations
export async function getAutomations() {
  const response = await api.get<Automation[]>('/api/automations');
  return response.data;
}

export async function createAutomation(data: Partial<Automation>) {
  const response = await api.post<Automation>('/api/automations', data);
  return response.data;
}

export async function updateAutomation(id: string, data: Partial<Automation>) {
  const response = await api.put<Automation>(`/api/automations/${id}`, data);
  return response.data;
}

export async function deleteAutomation(id: string) {
  await api.delete(`/api/automations/${id}`);
}

export async function getAutomationLogs(
  id: string,
  params?: {
    page?: number;
    pageSize?: number;
    status?: 'all' | 'success' | 'failed';
    dateFrom?: string;
    dateTo?: string;
  }
) {
  const response = await api.get<AutomationLogsResponse>(`/api/automations/${id}/logs`, { params });
  return response.data;
}

export async function getAutomationStats(params?: { dateFrom?: string; dateTo?: string }) {
  const response = await api.get<AutomationStatsResponse>('/api/automations/stats', { params });
  return response.data;
}

// Tasks
export async function getTasks(params?: { done?: boolean; contactId?: number }) {
  const response = await api.get<Task[]>('/api/tasks', { params });
  return response.data;
}

export async function createTask(data: {
  contactId?: number | null;
  assignedToUserId?: number | null;
  title: string;
  notes?: string;
  dueDate?: string | null;
  priority?: string;
}) {
  const response = await api.post<Task>('/api/tasks', data);
  return response.data;
}

export async function updateTask(id: number, data: Partial<Task>) {
  const response = await api.put<Task>(`/api/tasks/${id}`, data);
  return response.data;
}

export async function deleteTask(id: number) {
  await api.delete(`/api/tasks/${id}`);
}

// Forms
export async function getForms() {
  const response = await api.get<CRMForm[]>('/api/forms');
  return response.data;
}

export async function createForm(data: { title: string; description?: string; mode?: string; thankYouUrl?: string }) {
  const response = await api.post<CRMForm>('/api/forms', data);
  return response.data;
}

export async function getForm(id: string) {
  const response = await api.get<CRMForm>(`/api/forms/${id}`);
  return response.data;
}

export async function updateForm(id: string, data: Partial<CRMForm>) {
  const response = await api.put<CRMForm>(`/api/forms/${id}`, data);
  return response.data;
}

export async function deleteForm(id: string) {
  await api.delete(`/api/forms/${id}`);
}

export async function addField(
  formId: string,
  data: { type: string; label: string; required?: boolean; order: number; options?: string[]; contactField?: string }
) {
  const response = await api.post<FormField>(`/api/forms/${formId}/fields`, data);
  return response.data;
}

export async function updateField(formId: string, fieldId: string, data: Partial<FormField>) {
  const response = await api.put<FormField>(`/api/forms/${formId}/fields/${fieldId}`, data);
  return response.data;
}

export async function deleteField(formId: string, fieldId: string) {
  await api.delete(`/api/forms/${formId}/fields/${fieldId}`);
}

export async function reorderFields(formId: string, fields: { id: string; order: number }[]) {
  await api.post(`/api/forms/${formId}/fields/reorder`, { fields });
}

export async function submitForm(formId: string, answers: { fieldId: string; value: string }[]) {
  const response = await api.post(`/api/forms/${formId}/submit`, { answers });
  return response.data;
}

export async function getFormSubmissions(formId: string) {
  const response = await api.get<FormSubmission[]>(`/api/forms/${formId}/submissions`);
  return response.data;
}

// Authentication
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: number;
    name: string;
    email: string;
  };
  mustChangePassword?: boolean;
}

export async function register(data: RegisterRequest) {
  const response = await api.post<AuthResponse>('/api/auth/register', data);
  return response.data;
}

export async function login(data: LoginRequest) {
  const response = await api.post<AuthResponse>('/api/auth/login', data);
  return response.data;
}

export async function getCurrentUser() {
  const response = await api.get<User>('/api/auth/me');
  return response.data;
}

export async function updateCurrentUserProfile(data: { name?: string; jobTitle?: string | null }) {
  const response = await api.patch<User>('/api/auth/me', data);
  return response.data;
}

export async function getCurrentUserWithToken(accessToken: string) {
  const response = await api.get<User>('/api/auth/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return response.data;
}

export async function logLoginWithToken(accessToken: string): Promise<void> {
  await api.post(
    '/api/auth/log-login',
    {},
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
}

export async function changePassword(newPassword: string) {
  const response = await api.post<{ message: string }>('/api/auth/change-password', {
    newPassword,
  });
  return response.data;
}

export async function acknowledgePasswordChange(): Promise<void> {
  await api.post('/api/auth/acknowledge-password-change');
}

// User permissions structure
export interface UserPermissions {
  contacts?:    'none' | 'view' | 'edit';
  pipeline?:    'none' | 'view' | 'edit';
  tasks?:       'none' | 'view' | 'edit';
  chat?:        'none' | 'view' | 'edit';
  calendario?:  'none' | 'view' | 'edit';
  automations?: 'none' | 'view' | 'edit';
  forms?:       'none' | 'view' | 'edit';
  vendas?:      'none' | 'view' | 'edit';
  finances?: {
    transactions?:  'none' | 'view' | 'edit';
    view_invoices?: boolean;
    emit_invoices?: boolean;
    view_reports?:  boolean;
    saft?:          boolean;
  };
  comercial?: {
    dashboard_basic?: boolean;
    dashboard_analysis?: boolean;
    view_store_ranking?: boolean;
    view_product_performance?: boolean;
  };
  caixa?: {
    view?: boolean;
    open?: boolean;
    close?: boolean;
    audit?: boolean;
  };
  stock?: {
    view?: boolean;
    edit?: boolean;
  };
  taskAssignment?: {
    assign_admin_owner?: boolean;
  };
}

export type PlanName = 'essencial' | 'profissional' | 'enterprise';

export type PlanFeatureName =
  | 'painel'
  | 'clientes'
  | 'processos'
  | 'tarefas'
  | 'vendas'
  | 'conversas'
  | 'calendario'
  | 'automacoes'
  | 'formularios'
  | 'financas';

export interface PlanDetails {
  label: string;
  description: string;
}

export interface PlanLimits {
  users: number | null;
  contacts: number | null;
  tasks: number | null;
  automations: number | null;
}

export interface PlanFeatures {
  painel: boolean;
  clientes: boolean;
  processos: boolean;
  tarefas: boolean;
  vendas: boolean;
  conversas: boolean;
  calendario: boolean;
  automacoes: boolean;
  formularios: boolean;
  financas: boolean;
}

export interface PlanCatalogEntry extends PlanDetails {
  limits: PlanLimits;
  features: PlanFeatures;
}

// Admin - User Management
export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  jobTitle?: string | null;
  active: boolean;
  plan?: PlanName;
  planDetails?: PlanDetails;
  planLimits?: PlanLimits;
  planFeatures?: PlanFeatures;
  availablePlans?: Partial<Record<PlanName, PlanCatalogEntry>>;
  isSuperAdmin?: boolean;
  permissions?: UserPermissions | null; // null = full access (no restrictions)
  accountOwnerId?: number | null;
  assignedEstabelecimentoId?: string | null;
  assignedEstabelecimento?: { id: string; nome: string } | null;
  accountOwnerName?: string | null;
  impersonatedBy?: number | null;
  mustChangePassword?: boolean;
  workspaceMode?: 'servicos' | 'comercio';
  createdAt: string;
  lastLogin?: string;
}

export interface LoginLog {
  id: number;
  userId: number;
  ip?: string;
  userAgent?: string;
  createdAt: string;
  user: {
    id: number;
    name: string;
    email: string;
  };
}

export async function getUsers() {
  const response = await api.get<User[]>('/api/admin/users');
  return response.data;
}

export async function createUser(data: { name: string; email: string; password: string; role?: string }) {
  const response = await api.post<User>('/api/admin/users', data);
  return response.data;
}

export async function updateUser(id: number, data: { name?: string; active?: boolean; role?: string }) {
  const response = await api.patch<User>(`/api/admin/users/${id}`, data);
  return response.data;
}

export async function deleteUser(id: number) {
  await api.delete(`/api/admin/users/${id}`);
}

export async function getLoginLogs() {
  const response = await api.get<LoginLog[]>('/api/admin/logins');
  return response.data;
}

// Team Management (Account Members)
export async function getTeamMembers() {
  const response = await api.get<User[]>('/api/account/team');
  return response.data;
}

export async function addTeamMember(data: { name: string; email: string; password: string }) {
  const response = await api.post<User>('/api/account/team', data);
  return response.data;
}

export async function removeTeamMember(memberId: number) {
  await api.delete(`/api/account/team/${memberId}`);
}

// Finances
export function buildMonthlyFinancePeriod(year: number, month: number) {
  const normalizedMonth = Math.min(12, Math.max(1, month));
  const monthLabel = String(normalizedMonth).padStart(2, '0');

  return {
    year,
    month: normalizedMonth,
    dateFrom: `${year}-${monthLabel}-01`,
    dateTo: new Date(Date.UTC(year, normalizedMonth, 0)).toISOString().slice(0, 10),
  };
}

export async function getFinanceDashboard(params?: { year?: number; month?: number }): Promise<DashboardStats> {
  const response = await api.get<DashboardStats>('/api/finances/dashboard', { params });
  return response.data;
}

export async function getTransactions(params?: {
  page?: number;
  limit?: number;
  type?: string;
  status?: string;
  clientId?: number;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}): Promise<{ data: Transaction[]; total: number; page: number; totalPages: number }> {
  const response = await api.get('/api/finances/transactions', { params });
  return response.data;
}

export async function createTransaction(data: Partial<Transaction>): Promise<Transaction> {
  const response = await api.post<Transaction>('/api/finances/transactions', data);
  return response.data;
}

export async function updateTransaction(id: string, data: Partial<Transaction>): Promise<Transaction> {
  const response = await api.put<Transaction>(`/api/finances/transactions/${id}`, data);
  return response.data;
}

export async function deleteTransaction(id: string): Promise<void> {
  await api.delete(`/api/finances/transactions/${id}`);
}

export async function markTransactionPaid(id: string): Promise<Transaction> {
  const response = await api.post<Transaction>(`/api/finances/transactions/${id}/mark-paid`);
  return response.data;
}

export async function getClientProfitability(): Promise<ClientProfitability[]> {
  const response = await api.get<ClientProfitability[]>('/api/finances/profitability');
  return response.data;
}

export async function getClientProfitabilityDetail(clientId: number): Promise<{
  contact: { id: number; name: string; company: string } | null;
  summary: { totalRevenue: number; totalCosts: number; netMargin: number; marginPercent: number };
  costsByCategory: { category: string; total: number }[];
  recentTransactions: Transaction[];
  activeRecurringInvoices: {
    id: string;
    customerName: string;
    frequency: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
    nextRunDate: string;
    totalGenerated: number;
    maxOccurrences?: number | null;
    grossTotalKz: number;
    monthlyAmountKz: number;
  }[];
}> {
  const response = await api.get(`/api/finances/profitability/${clientId}`);
  return response.data;
}

export async function getFinancialCategories(): Promise<FinancialCategory[]> {
  const response = await api.get<FinancialCategory[]>('/api/finances/categories');
  return response.data;
}

export async function seedFinancialCategories(): Promise<void> {
  await api.post('/api/finances/seed-categories');
}

export async function downloadTransactionsCSV(params?: { dateFrom?: string; dateTo?: string; type?: string; status?: string }): Promise<void> {
  const response = await api.get('/api/finances/export-csv', { params, responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `transacoes-${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function downloadActivityCsv(params?: {
  userId?: number;
  entityType?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<void> {
  const response = await api.get('/api/activity/export-csv', { params, responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `atividade-${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

// Google Calendar
export async function getCalendarStatus(): Promise<CalendarConnectionStatus> {
  const response = await api.get('/api/calendar/status');
  return response.data;
}

export async function getCalendarEvents(start: string, end: string): Promise<CalendarEvent[]> {
  const response = await api.get('/api/calendar/events', { params: { start, end } });
  return response.data;
}

export async function connectCalendar(returnTo?: string): Promise<{ authUrl: string }> {
  const response = await api.post('/api/calendar/connect', returnTo ? { returnTo } : {});
  return response.data;
}

export async function syncCalendar(): Promise<{
  syncedCount: number;
  removedCount: number;
  lastSyncAt: string;
  reauthRequired: boolean;
}> {
  const response = await api.post('/api/calendar/sync');
  return response.data;
}

export async function disconnectCalendar(): Promise<void> {
  await api.delete('/api/calendar/disconnect');
}

// ============================================
// FATURAÇÃO AGT
// ============================================

export async function getFaturacaoDashboard(): Promise<FaturacaoDashboard> {
  const res = await api.get('/api/faturacao/dashboard');
  return res.data;
}

export async function getFacturas(params?: {
  page?: number; limit?: number; documentType?: string;
  documentStatus?: string; agtStatus?: string; search?: string;
  startDate?: string; endDate?: string;
}): Promise<{ facturas: Factura[]; total: number; pages: number }> {
  const res = await api.get('/api/faturacao/facturas', { params });
  return res.data;
}

export async function getFactura(id: string): Promise<Factura> {
  const res = await api.get(`/api/faturacao/facturas/${id}`);
  return res.data;
}

export async function createFactura(data: {
  documentType: string; serieId?: string; estabelecimentoId: string;
  customerTaxID: string; customerName: string; customerAddress?: string;
  clienteFaturacaoId?: string; lines: Omit<FacturaLine, 'lineNumber'>[];
  baseCurrency?: string; displayCurrency?: string; currencyCode?: string;
  currencyAmount?: number; exchangeRate?: number; exchangeRateDate?: string;
  displayMode?: 'DOCUMENT_ONLY' | 'DOCUMENT_PLUS_INTERNAL'; paymentMethod?: string;
}): Promise<Factura> {
  const res = await api.post('/api/faturacao/facturas', data);
  return res.data;
}

export async function downloadFacturaPdf(id: string): Promise<void> {
  const res = await api.get(`/api/faturacao/facturas/${id}/pdf`, { responseType: 'blob' });
  const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `factura-${id}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function openFacturaPdfInTab(id: string): Promise<void> {
  const res = await api.get(`/api/faturacao/facturas/${id}/pdf`, { responseType: 'blob' });
  const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
  const win = window.open(url, '_blank');
  if (!win) {
    // Fallback se popups bloqueados: faz download
    const a = document.createElement('a');
    a.href = url;
    a.download = `factura-${id}.pdf`;
    a.click();
  }
}

export async function anularFactura(id: string, motivo: string): Promise<Factura> {
  const res = await api.post(`/api/faturacao/facturas/${id}/anular`, { motivo });
  return res.data;
}

// Séries
export async function getSeries(): Promise<Serie[]> {
  const res = await api.get('/api/faturacao/series');
  return res.data;
}

export async function createSerie(data: {
  estabelecimentoId: string; seriesCode: string; seriesYear: number;
  documentType: string; firstDocumentNumber?: number;
}): Promise<Serie> {
  const res = await api.post('/api/faturacao/series', data);
  return res.data;
}

export async function updateSerie(id: string, data: { seriesStatus?: string }): Promise<Serie> {
  const res = await api.put(`/api/faturacao/series/${id}`, data);
  return res.data;
}

export async function deleteSerie(id: string): Promise<void> {
  await api.delete(`/api/faturacao/series/${id}`);
}

// Estabelecimentos
export async function getEstabelecimentos(): Promise<Estabelecimento[]> {
  const res = await api.get('/api/faturacao/estabelecimentos');
  return res.data;
}

export async function createEstabelecimento(data: {
  nome: string; nif?: string; morada?: string; telefone?: string; email?: string; isPrincipal?: boolean;
}): Promise<Estabelecimento> {
  const res = await api.post('/api/faturacao/estabelecimentos', data);
  return res.data;
}

// Clientes
export async function getClientesFaturacao(params?: { search?: string; page?: number }): Promise<{ clientes: ClienteFaturacao[]; total: number }> {
  const res = await api.get('/api/faturacao/clientes', { params });
  return res.data;
}

export async function createClienteFaturacao(data: {
  customerTaxID: string; customerName: string; customerAddress?: string;
  customerPhone?: string; customerEmail?: string;
}): Promise<ClienteFaturacao> {
  const res = await api.post('/api/faturacao/clientes', data);
  return res.data;
}

export async function importContactToBillingCustomer(data: {
  contactId: number;
  customerTaxID?: string;
}): Promise<ClienteFaturacao> {
  const res = await api.post('/api/faturacao/clientes/from-contact', data);
  return res.data;
}

export async function updateClienteFaturacao(id: string, data: Partial<ClienteFaturacao>): Promise<ClienteFaturacao> {
  const res = await api.put(`/api/faturacao/clientes/${id}`, data);
  return res.data;
}

// Produtos
export async function getProdutos(params?: { search?: string; active?: boolean }): Promise<Produto[]> {
  const res = await api.get('/api/faturacao/produtos', { params });
  return res.data;
}

export async function createProduto(data: {
  productCode: string;
  productDescription: string;
  unitPrice: number;
  cost?: number | null;
  productType?: string;
  sku?: string | null;
  unitOfMeasure?: string;
  taxPercentage?: number;
  stockMinimo?: number | null;
  categoriaId?: string | null;
}): Promise<Produto> {
  const res = await api.post('/api/faturacao/produtos', data);
  return res.data;
}

export async function updateProduto(id: string, data: Partial<Produto>): Promise<Produto> {
  const res = await api.put(`/api/faturacao/produtos/${id}`, data);
  return res.data;
}

export async function deleteProduto(id: string): Promise<void> {
  await api.delete(`/api/faturacao/produtos/${id}`);
}

export async function addStock(id: string, data: { quantity: number; reason?: string; notes?: string }): Promise<{ produto: Produto; movement: StockMovement }> {
  const res = await api.post(`/api/faturacao/produtos/${id}/stock`, data);
  return res.data;
}

export async function getStockMovements(id: string): Promise<StockMovement[]> {
  const res = await api.get(`/api/faturacao/produtos/${id}/stock-movements`);
  return res.data;
}

// Categorias de Produtos
export async function getCategoriasProduto(): Promise<ProdutoCategoria[]> {
  const res = await api.get('/api/produto-categorias');
  return res.data;
}

export async function createCategoriaProduto(data: { nome: string; cor?: string }): Promise<ProdutoCategoria> {
  const res = await api.post('/api/produto-categorias', data);
  return res.data;
}

export async function updateCategoriaProduto(id: string, data: { nome?: string; cor?: string }): Promise<ProdutoCategoria> {
  const res = await api.patch(`/api/produto-categorias/${id}`, data);
  return res.data;
}

export async function deleteCategoriaProduto(id: string): Promise<void> {
  await api.delete(`/api/produto-categorias/${id}`);
}

// Painel Comercial
export async function getComercialResumo(): Promise<ComercialResumo> {
  const res = await api.get('/api/comercial/resumo');
  return res.data;
}

export async function getComercialInsights(): Promise<string[]> {
  const res = await api.get('/api/comercial/insights');
  return res.data;
}

export async function getComercialAnalise(params?: {
  dias?: number;
  estabelecimentoId?: string;
}): Promise<ComercialAnalise> {
  const res = await api.get('/api/comercial/analise', { params });
  return res.data;
}

export interface AdvancedReportParams {
  period?: '7d' | '30d' | '90d' | 'month' | 'custom';
  startDate?: string;
  endDate?: string;
  estabelecimentoId?: string;
  userId?: number;
}

export async function getServicesAdvancedOverview(params?: AdvancedReportParams): Promise<ServicesAdvancedOverviewResponse> {
  const res = await api.get('/api/reports/servicos/advanced/overview', { params });
  return res.data;
}

export async function getServicesAdvancedPipeline(params?: AdvancedReportParams): Promise<ServicesAdvancedPipelineResponse> {
  const res = await api.get('/api/reports/servicos/advanced/pipeline', { params });
  return res.data;
}

export async function getServicesAdvancedRevenue(params?: AdvancedReportParams): Promise<ServicesAdvancedRevenueResponse> {
  const res = await api.get('/api/reports/servicos/advanced/revenue', { params });
  return res.data;
}

export async function getServicesAdvancedTeam(params?: AdvancedReportParams): Promise<ServicesAdvancedTeamResponse> {
  const res = await api.get('/api/reports/servicos/advanced/team', { params });
  return res.data;
}

export async function getCommercialAdvancedOverview(params?: AdvancedReportParams): Promise<CommercialAdvancedOverviewResponse> {
  const res = await api.get('/api/reports/comercio/advanced/overview', { params });
  return res.data;
}

export async function getCommercialAdvancedSales(params?: AdvancedReportParams): Promise<CommercialAdvancedSalesResponse> {
  const res = await api.get('/api/reports/comercio/advanced/sales', { params });
  return res.data;
}

export async function getCommercialAdvancedProducts(params?: AdvancedReportParams): Promise<CommercialAdvancedProductsResponse> {
  const res = await api.get('/api/reports/comercio/advanced/products', { params });
  return res.data;
}

export async function getCommercialAdvancedLocations(params?: AdvancedReportParams): Promise<CommercialAdvancedLocationsResponse> {
  const res = await api.get('/api/reports/comercio/advanced/locations', { params });
  return res.data;
}

export async function getCommercialAdvancedTeam(params?: AdvancedReportParams): Promise<CommercialAdvancedTeamResponse> {
  const res = await api.get('/api/reports/comercio/advanced/team', { params });
  return res.data;
}

// Caixa — Sessões
export async function getCaixaSessaoAtual(params?: { estabelecimentoId?: string }): Promise<CaixaSessao | null> {
  const res = await api.get('/api/caixa/sessoes/atual', { params });
  return res.data;
}

export async function abrirCaixaSessao(data: {
  estabelecimentoId: string;
  openingBalance?: number;
  notes?: string;
}): Promise<CaixaSessao> {
  const res = await api.post('/api/caixa/sessoes', data);
  return res.data;
}

export async function fecharCaixaSessao(id: string, data: {
  closingCountedAmount?: number;
  notes?: string;
}): Promise<CaixaSessao> {
  const res = await api.patch(`/api/caixa/sessoes/${id}/fechar`, data);
  return res.data;
}

export async function getCaixaSessoes(params?: {
  status?: 'open' | 'closed';
  estabelecimentoId?: string;
  page?: number;
  limit?: number;
}): Promise<{ sessoes: CaixaSessao[]; total: number; page: number; limit: number }> {
  const res = await api.get('/api/caixa/sessoes', { params });
  return res.data;
}

// Configuração
export async function getFaturacaoConfig(): Promise<FaturacaoConfig> {
  const res = await api.get('/api/faturacao/config');
  return res.data;
}

export async function updateFaturacaoConfig(data: Partial<FaturacaoConfig>): Promise<FaturacaoConfig> {
  const res = await api.put('/api/faturacao/config', data);
  return res.data;
}

// SAF-T
export async function getSaftPeriodos(): Promise<SaftPeriodo[]> {
  const res = await api.get('/api/faturacao/saft');
  return res.data;
}

export async function generateSaft(periodo: string): Promise<SaftPeriodo> {
  const res = await api.post('/api/faturacao/saft/generate', { periodo });
  return res.data;
}

// Relatórios fiscais
export async function getIvaReport(periodo: string) {
  const res = await api.get('/api/faturacao/relatorios/iva', { params: { periodo } });
  return res.data as import('./types').IvaReport;
}

export async function getVendasReport(year: number) {
  const res = await api.get('/api/faturacao/relatorios/vendas', { params: { year } });
  return res.data as import('./types').VendasReport;
}

export function getIvaExportUrl(periodo: string): string {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3011';
  return `${API_URL}/api/faturacao/relatorios/iva/export?periodo=${periodo}`;
}

export function getVendasExportUrl(year: number): string {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3011';
  return `${API_URL}/api/faturacao/relatorios/vendas/export?year=${year}`;
}

export async function validateSaft(periodo: string): Promise<{ valid: boolean; errors: string[] }> {
  const res = await api.post('/api/faturacao/saft/validate', { periodo });
  return res.data;
}

export async function getSaftDownloadUrl(id: string): Promise<string> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? '';
  return `${API_URL}/api/faturacao/saft/${id}/download?token=${encodeURIComponent(token)}`;
}

// Faturas Recorrentes
export async function getRecorrentes(): Promise<FacturaRecorrente[]> {
  const res = await api.get('/api/faturacao/recorrentes');
  return res.data;
}

export async function createRecorrente(data: Partial<FacturaRecorrente> & { lines: unknown }): Promise<FacturaRecorrente> {
  const res = await api.post('/api/faturacao/recorrentes', data);
  return res.data;
}

export async function updateRecorrente(id: string, data: Partial<FacturaRecorrente>): Promise<FacturaRecorrente> {
  const res = await api.put(`/api/faturacao/recorrentes/${id}`, data);
  return res.data;
}

export async function deleteRecorrente(id: string): Promise<void> {
  await api.delete(`/api/faturacao/recorrentes/${id}`);
}

export async function triggerRecorrente(id: string): Promise<FacturaRecorrente> {
  const res = await api.post(`/api/faturacao/recorrentes/${id}/trigger`);
  return res.data;
}

// ============================================
// CHAT INTERNO
// ============================================

export async function getChatChannels(): Promise<ChatChannel[]> {
  const res = await api.get('/api/chat/channels');
  return res.data;
}

export async function createChatChannel(data: {
  name: string;
  description?: string;
  memberIds: number[];
}): Promise<ChatChannel> {
  const res = await api.post('/api/chat/channels', data);
  return res.data;
}

export async function updateChatChannel(
  channelId: string,
  data: { name?: string; description?: string; memberIds?: number[] }
): Promise<ChatChannel> {
  const res = await api.patch(`/api/chat/channels/${channelId}`, data);
  return res.data;
}

export async function deleteChatChannel(channelId: string): Promise<void> {
  await api.delete(`/api/chat/channels/${channelId}`);
}

export async function createDM(targetUserId: number): Promise<ChatChannel> {
  const res = await api.post('/api/chat/dm', { targetUserId });
  return res.data;
}

export async function getChatMessages(channelId: string, before?: string): Promise<ChatMessage[]> {
  const res = await api.get(`/api/chat/channels/${channelId}/messages`, {
    params: before ? { before, limit: 50 } : { limit: 50 },
  });
  return res.data;
}

export async function sendChatMessage(
  channelId: string,
  text: string,
  attachments?: { url: string; name: string; size: number; type: string }[]
): Promise<ChatMessage> {
  const res = await api.post(`/api/chat/channels/${channelId}/messages`, {
    text,
    attachments: attachments ?? [],
  });
  return res.data;
}

export async function markChannelRead(channelId: string): Promise<void> {
  await api.post(`/api/chat/channels/${channelId}/read`);
}

export async function getChatUnreadCount(): Promise<number> {
  const res = await api.get<{ unread: number }>('/api/chat/unread');
  return res.data.unread;
}

export interface ChatUser {
  id: number;
  name: string;
  email: string;
  role: string;
  accountOwnerId?: number | null;
  isSuperAdmin?: boolean;
}

export async function getChatUsers(): Promise<ChatUser[]> {
  const res = await api.get('/api/chat/users');
  return res.data;
}

export async function getPlanUsage(): Promise<PlanUsage> {
  const res = await api.get('/api/chat/limits');
  return res.data;
}

// ============================================
// RBAC — PERMISSÕES GRANULARES
// ============================================

// Account owner: set granular permissions for a team member (null = full access)
export async function setMemberPermissions(
  memberId: number,
  permissions: UserPermissions | null,
  assignedEstabelecimentoId?: string | null
): Promise<void> {
  await api.patch(`/api/account/team/${memberId}/permissions`, {
    permissions,
    assignedEstabelecimentoId: assignedEstabelecimentoId ?? null,
  });
}

// SuperAdmin: list all orgs (account owners)
export interface SuperAdminOrg extends User {
  accountMembers: { id: number; name: string; email: string; active: boolean }[];
  _count: { accountMembers: number };
}

export async function getSuperAdminOrgs(): Promise<SuperAdminOrg[]> {
  const res = await api.get('/api/superadmin/orgs');
  return res.data;
}

export async function updateSuperAdminOrg(
  id: number,
  data: {
    plan?: PlanName;
    active?: boolean;
    permissions?: UserPermissions | null;
    workspaceMode?: 'servicos' | 'comercio';
  }
): Promise<void> {
  await api.patch(`/api/superadmin/orgs/${id}`, data);
}

export async function deleteSuperAdminOrg(id: number): Promise<void> {
  await api.delete(`/api/superadmin/orgs/${id}`);
}

export async function impersonateUser(userId: number): Promise<{ token: string; targetName: string; targetEmail: string }> {
  const res = await api.post(`/api/superadmin/impersonate/${userId}`);
  return res.data;
}

// SuperAdmin: usage stats per org
export interface SuperAdminUsageStat {
  orgId: number;
  orgName: string;
  logins7d: number;
  logins30d: number;
  lastLogin: string | null;
  sparkline: { date: string; count: number }[];
}

export async function getSuperAdminUsage(): Promise<SuperAdminUsageStat[]> {
  const res = await api.get('/api/superadmin/usage');
  return res.data;
}

// SuperAdmin: storage/record counts per org
export interface SuperAdminStorageStat {
  orgId: number;
  orgName: string;
  contacts: number;
  tasks: number;
  transactions: number;
  notes: number;
  fileCount: number;
  fileSizeBytes: number;
}

export async function getSuperAdminStorage(): Promise<SuperAdminStorageStat[]> {
  const res = await api.get('/api/superadmin/storage');
  return res.data;
}

// SuperAdmin: platform dashboard KPIs
export interface SuperAdminDashboard {
  totalOrgs: number;
  activeOrgs: number;
  newOrgsThisMonth: number;
  totalContacts: number;
  totalStorageMb: number;
  workspaceMix: { servicos: number; comercio: number };
  planDistribution: { essencial: number; profissional: number; enterprise: number };
  mostActiveOrg: { name: string; logins30d: number } | null;
}

export async function getSuperAdminDashboard(): Promise<SuperAdminDashboard> {
  const res = await api.get('/api/superadmin/dashboard');
  return res.data;
}

export interface SuperAdminMessagingSummary {
  submitted: number;
  accepted: number;
  invalid: number;
  duplicate: number;
  optedOut: number;
  notAllowed: number;
}

export interface SuperAdminMessagingRecipientInput {
  phone: string;
  contactId?: number | null;
  name?: string | null;
  email?: string | null;
}

export interface SuperAdminMessagingCampaignPreview {
  provider: string;
  name: string;
  content: string;
  channelType: string;
  remitterId: string;
  countryAlpha2: string;
  requestedRecipientsCount: number;
  acceptedRecipientsCount: number;
  invalidRecipientsCount: number;
  duplicateRecipientsCount: number;
  optedOutRecipientsCount: number;
  notAllowedRecipientsCount: number;
  isTest: boolean;
  status: string;
}

export interface SuperAdminMessagingCampaign {
  id: string;
  provider: string;
  providerCampaignId?: string | null;
  name: string;
  content: string;
  channelType: string;
  remitterId: string;
  countryAlpha2: string;
  requestedRecipientsCount: number;
  acceptedRecipientsCount: number;
  invalidRecipientsCount: number;
  duplicateRecipientsCount: number;
  optedOutRecipientsCount: number;
  notAllowedRecipientsCount: number;
  status: string;
  providerStatus?: string | null;
  triggerSource: string;
  createdByUserId: number;
  createdByEmail: string;
  accountOwnerId?: number | null;
  workspaceMode?: string | null;
  isTest: boolean;
  statusNote?: string | null;
  providerErrorCode?: string | null;
  providerErrorMessage?: string | null;
  providerTraceId?: string | null;
  rawRequestJson?: Record<string, unknown> | null;
  rawResponseJson?: Record<string, unknown> | null;
  sentAt?: string | null;
  processedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    recipients: number;
    messages: number;
  };
}

export interface SuperAdminMessagingCampaignRecipient {
  id: string;
  campaignId: string;
  phoneOriginal: string;
  phoneNormalized?: string | null;
  contactId?: number | null;
  contactName?: string | null;
  contactEmail?: string | null;
  status: string;
  providerMessageId?: string | null;
  providerStatus?: string | null;
  channelDestination?: string | null;
  cost?: number | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  rawProviderJson?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface SuperAdminMessagingMessage {
  id: string;
  provider: string;
  providerMessageId?: string | null;
  campaignId?: string | null;
  campaignRecipientId?: string | null;
  content: string;
  phoneOriginal: string;
  phoneNormalized: string;
  contactId?: number | null;
  channelType: string;
  remitterId: string;
  status: string;
  providerStatus?: string | null;
  channelDestination?: string | null;
  cost?: number | null;
  triggerSource: string;
  createdByUserId: number;
  createdByEmail: string;
  isTest: boolean;
  providerErrorCode?: string | null;
  providerErrorMessage?: string | null;
  providerTraceId?: string | null;
  rawRequestJson?: Record<string, unknown> | null;
  rawResponseJson?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  campaign?: {
    id: string;
    name: string;
    providerCampaignId?: string | null;
    status: string;
    isTest: boolean;
  } | null;
  campaignRecipient?: {
    id: string;
    status: string;
    providerStatus?: string | null;
    errorCode?: string | null;
    errorMessage?: string | null;
  } | null;
}

export interface SuperAdminMessagingPaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface SuperAdminMessagingCampaignDetail {
  campaign: SuperAdminMessagingCampaign;
  recipients: SuperAdminMessagingPaginatedResponse<SuperAdminMessagingCampaignRecipient>;
  summary?: SuperAdminMessagingSummary;
}

export interface SuperAdminMessagingCampaignValidationResponse {
  campaign: SuperAdminMessagingCampaignPreview;
  summary: SuperAdminMessagingSummary;
  acceptedRecipients: Array<{
    phoneOriginal: string;
    phoneNormalized: string;
    contactId?: number | null;
    contactName?: string | null;
    contactEmail?: string | null;
  }>;
  rejectedRecipients: Array<{
    phoneOriginal: string;
    phoneNormalized?: string | null;
    contactId?: number | null;
    contactName?: string | null;
    contactEmail?: string | null;
    status: string;
    errorCode?: string | null;
    errorMessage?: string | null;
  }>;
}

export async function validateSuperadminBatchCampaign(payload: {
  name: string;
  content: string;
  remitterId: string;
  countryAlpha2?: string;
  recipients: SuperAdminMessagingRecipientInput[];
  isTest?: boolean;
}): Promise<SuperAdminMessagingCampaignValidationResponse> {
  const res = await api.post('/api/superadmin/messaging/campaigns/validate', payload);
  return res.data;
}

export async function sendSuperadminBatchCampaign(payload: {
  name: string;
  content: string;
  remitterId: string;
  countryAlpha2?: string;
  recipients: SuperAdminMessagingRecipientInput[];
  isTest?: boolean;
}): Promise<SuperAdminMessagingCampaignDetail> {
  const res = await api.post('/api/superadmin/messaging/campaigns/send', payload);
  return res.data;
}

export async function listSuperadminMessagingCampaigns(params?: {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  isTest?: boolean;
}): Promise<SuperAdminMessagingPaginatedResponse<SuperAdminMessagingCampaign>> {
  const res = await api.get('/api/superadmin/messaging/campaigns', { params });
  return res.data;
}

export async function getSuperadminMessagingCampaign(
  id: string,
  params?: { recipientPage?: number; recipientPageSize?: number }
): Promise<SuperAdminMessagingCampaignDetail> {
  const res = await api.get(`/api/superadmin/messaging/campaigns/${id}`, { params });
  return res.data;
}

export async function syncSuperadminMessagingCampaign(id: string): Promise<SuperAdminMessagingCampaignDetail> {
  const res = await api.post(`/api/superadmin/messaging/campaigns/${id}/sync`);
  return res.data;
}

export async function sendSuperadminSingleMessage(payload: {
  phone: string;
  content: string;
  remitterId: string;
  countryAlpha2?: string;
  isTest?: boolean;
  saveContact?: boolean;
  contactId?: number | null;
}): Promise<SuperAdminMessagingMessage> {
  const res = await api.post('/api/superadmin/messaging/test/send-single', payload);
  return res.data;
}

export async function listSuperadminMessages(params?: {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  isTest?: boolean;
}): Promise<SuperAdminMessagingPaginatedResponse<SuperAdminMessagingMessage>> {
  const res = await api.get('/api/superadmin/messaging/messages', { params });
  return res.data;
}

export async function getSuperadminMessage(id: string): Promise<SuperAdminMessagingMessage> {
  const res = await api.get(`/api/superadmin/messaging/messages/${id}`);
  return res.data;
}

export async function syncSuperadminMessage(id: string): Promise<SuperAdminMessagingMessage> {
  const res = await api.post(`/api/superadmin/messaging/messages/${id}/sync`);
  return res.data;
}

// Admin: list all client accounts
export async function getClientAccounts(): Promise<import('./types').ClientAccount[]> {
  const res = await api.get('/api/admin/accounts');
  return res.data;
}

// Admin: update plan for a client account
export async function updateClientAccount(id: number, data: { plan?: PlanName }): Promise<void> {
  await api.patch(`/api/admin/accounts/${id}`, data);
}

// SuperAdmin: create a new client account
export async function createClientAccount(data: {
  name: string;
  email: string;
  password: string;
  plan?: PlanName;
  workspaceMode?: 'servicos' | 'comercio';
  permissions?: UserPermissions | null;
}): Promise<User> {
  const res = await api.post('/api/superadmin/users', data);
  return res.data;
}

// ============================================
// QUICK SALES (Workspace COMERCIO)
// ============================================

export interface QuickSaleDefaults {
  ready: boolean;
  defaultSerieId: string | null;
  defaultEstabelecimentoId: string | null;
}

export interface QuickSaleItem {
  productCode: string;
  productDescription: string;
  quantity: number;
  unitPrice: number;
  unitOfMeasure?: string;
  taxCode?: string;
  taxPercentage?: number;
}

export async function getQuickSaleDefaults(): Promise<QuickSaleDefaults> {
  const res = await api.get('/api/quick-sales/defaults');
  return res.data;
}

export async function emitQuickSale(payload: {
  items: QuickSaleItem[];
  customerTaxID?: string;
  customerName?: string;
  clienteFaturacaoId?: string;
  paymentMethod?: string;
  estabelecimentoId?: string;
}): Promise<Factura> {
  const res = await api.post<Factura>('/api/quick-sales/emit', payload);
  return res.data;
}

export interface OnboardingStep {
  id: string;
  label: string;
  href: string;
  completed: boolean;
}

export interface OnboardingData {
  show: boolean;
  dismissed: boolean;
  completedCount: number;
  totalCount: number;
  allDone?: boolean;
  steps?: OnboardingStep[];
}

export async function getOnboarding(): Promise<OnboardingData> {
  const res = await api.get<OnboardingData>('/api/onboarding');
  return res.data;
}

export async function dismissOnboarding(): Promise<void> {
  await api.post('/api/onboarding/dismiss');
}

export interface DailyTipDeliveryResponse {
  show: boolean;
  visibleInDashboard?: boolean;
  dismissedAt?: string | null;
  date?: string;
  tipIndex?: number;
  workspaceMode?: 'servicos' | 'comercio';
  audienceBucket?: 'owner' | 'equipa';
  tip?: {
    id: string;
    title: string;
    heading: string;
    message: string;
    personalizedMessage: string;
    category?: string;
  };
}

export async function getDailyTip(): Promise<DailyTipDeliveryResponse> {
  const res = await api.post<DailyTipDeliveryResponse>('/api/daily-tip/deliver');
  return res.data;
}

export async function dismissDailyTip(): Promise<void> {
  await api.post('/api/daily-tip/dismiss');
}

export default api;
