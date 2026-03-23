import axios from 'axios';
import type { Contact, ContactFieldDef, ContactFieldConfig, SystemFieldKey, Message, Automation, Task, CRMForm, FormField, Transaction, FinancialCategory, DashboardStats, ClientProfitability, PipelineStage, CalendarEvent, Factura, FacturaLine, Serie, Estabelecimento, ClienteFaturacao, Produto, FaturacaoDashboard, FaturacaoConfig, SaftPeriodo, FacturaRecorrente } from './types';
import { createClient } from './supabase/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_URL,
});

// Request interceptor: add Supabase session token to all requests
api.interceptors.request.use(async (config) => {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

// Response interceptor: handle 401 errors
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
    return Promise.reject(error);
  }
);

// Contacts
export async function getContacts(params?: { stage?: string; search?: string; revenue?: string; inPipeline?: string }) {
  const response = await api.get<Contact[]>('/api/contacts', { params });
  return response.data;
}

export async function createContact(data: Partial<Contact>) {
  const response = await api.post<Contact>('/api/contacts', data);
  return response.data;
}

export async function getContact(id: string) {
  const response = await api.get<Contact & { messages: Message[]; tasks: Task[] }>(
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

// Inbox & Messages
export async function getConversations() {
  const response = await api.get<Contact[]>('/api/inbox');
  return response.data;
}

export async function getMessages(contactId: string) {
  const response = await api.get<Message[]>(`/api/messages/${contactId}`);
  return response.data;
}

export async function sendMessage(contactId: string, text?: string, templateName?: string) {
  const response = await api.post<Message>('/api/send', {
    contactId,
    text,
    templateName,
  });
  return response.data;
}

export async function sendEmailMessage(contactId: string, subject: string, text: string) {
  const response = await api.post<Message>('/api/send/email', {
    contactId,
    subject,
    text,
  });
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

// WhatsApp Templates
export interface WhatsAppTemplate {
  name: string;
  language: string;
  status: string;
}

export async function getWhatsAppTemplates() {
  const response = await api.get<WhatsAppTemplate[]>('/api/whatsapp/templates');
  return response.data;
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

export async function changePassword(newPassword: string) {
  const response = await api.post<{ message: string }>('/api/auth/change-password', {
    newPassword,
  });
  return response.data;
}

// Admin - User Management
export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  active: boolean;
  accountOwnerId?: number | null;
  accountOwnerName?: string | null;
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

export function getCalendarAuthUrl(): string {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  return `${API_URL}/api/calendar/auth?token=${token || ''}`;
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

export function getSaftDownloadUrl(id: string): string {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  return `${API_URL}/api/faturacao/saft/${id}/download?token=${token || ''}`;
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

export default api;
