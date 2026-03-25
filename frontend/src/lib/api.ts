import axios from 'axios';
import type { Contact, ContactFieldDef, ContactFieldConfig, SystemFieldKey, Automation, Task, CRMForm, FormField, Transaction, FinancialCategory, DashboardStats, ClientProfitability, PipelineStage, CalendarEvent, Factura, FacturaLine, Serie, Estabelecimento, ClienteFaturacao, Produto, FaturacaoDashboard, FaturacaoConfig, SaftPeriodo, FacturaRecorrente, ChatChannel, ChatMessage, PlanUsage, ClientAccount } from './types';
import { createClient } from './supabase/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_URL,
});

// Request interceptor: prefer impersonation token, fall back to Supabase session token
api.interceptors.request.use(async (config) => {
  if (typeof window !== 'undefined') {
    const impersonationToken = localStorage.getItem('impersonation_token');
    if (impersonationToken) {
      config.headers.Authorization = `Bearer ${impersonationToken}`;
      return config;
    }
  }
  const supabase = createClient();
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
export async function getContacts(params?: { stage?: string; search?: string; revenue?: string; inPipeline?: string; contactType?: string }) {
  const response = await api.get<Contact[]>('/api/contacts', { params });
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

// System field config (built-in fields: email, phone, company, revenue, sector, tags)
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

// Tasks
export async function getTasks(params?: { done?: boolean; contactId?: number }) {
  const response = await api.get<Task[]>('/api/tasks', { params });
  return response.data;
}

export async function createTask(data: {
  contactId?: number | null;
  title: string;
  notes?: string;
  dueDate?: string;
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
  const response = await api.get(`/api/forms/${formId}/submissions`);
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

export async function getCurrentUserWithToken(accessToken: string) {
  const response = await api.get<User>('/api/auth/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return response.data;
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
}

// Admin - User Management
export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  active: boolean;
  plan?: string;
  isSuperAdmin?: boolean;
  permissions?: UserPermissions | null; // null = full access (no restrictions)
  accountOwnerId?: number | null;
  accountOwnerName?: string | null;
  impersonatedBy?: number | null;
  mustChangePassword?: boolean;
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
export async function getFinanceDashboard(params?: { dateFrom?: string; dateTo?: string }): Promise<DashboardStats> {
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
  activeContracts: Transaction[];
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

// Google Calendar
export async function getCalendarStatus(): Promise<{ connected: boolean; email: string | null }> {
  const response = await api.get('/api/calendar/status');
  return response.data;
}

export async function getCalendarEvents(start: string, end: string): Promise<CalendarEvent[]> {
  const response = await api.get('/api/calendar/events', { params: { start, end } });
  return response.data;
}

export async function disconnectCalendar(): Promise<void> {
  await api.delete('/api/calendar/disconnect');
}

export async function getCalendarAuthUrl(): Promise<string> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? '';
  return `${API_URL}/api/calendar/auth?token=${encodeURIComponent(token)}`;
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
  documentType: string; serieId: string; estabelecimentoId: string;
  customerTaxID: string; customerName: string; customerAddress?: string;
  clienteFaturacaoId?: string; lines: Omit<FacturaLine, 'lineNumber'>[];
  currencyCode?: string; currencyAmount?: number; exchangeRate?: number; paymentMethod?: string;
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
  nome: string; nif: string; morada?: string; telefone?: string; email?: string; isPrincipal?: boolean;
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
  productCode: string; productDescription: string; unitPrice: number;
  unitOfMeasure?: string; taxPercentage?: number; taxCode?: string;
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

export async function getChatUsers(): Promise<{ id: number; name: string; email: string }[]> {
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
export async function setMemberPermissions(memberId: number, permissions: UserPermissions | null): Promise<void> {
  await api.patch(`/api/account/team/${memberId}/permissions`, { permissions });
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
  data: { plan?: string; active?: boolean; permissions?: UserPermissions | null }
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

// Admin: list all client accounts
export async function getClientAccounts(): Promise<import('./types').ClientAccount[]> {
  const res = await api.get('/api/admin/accounts');
  return res.data;
}

// Admin: update plan for a client account
export async function updateClientAccount(id: number, data: { plan?: string }): Promise<void> {
  await api.patch(`/api/admin/accounts/${id}`, data);
}

// SuperAdmin: create a new client account
export async function createClientAccount(data: {
  name: string;
  email: string;
  password: string;
  plan?: string;
  permissions?: UserPermissions | null;
}): Promise<User> {
  const res = await api.post('/api/superadmin/users', data);
  return res.data;
}

export default api;
