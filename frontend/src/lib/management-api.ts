import api from './api';

export type ManagementRole = 'admin' | 'marketing' | 'commercial' | 'designer' | 'editor';

export interface ManagementProfile { id: string; fullName: string; role: ManagementRole; active: boolean; user?: { id: number; email: string; lastSeenAt?: string | null } }
export interface ManagementBootstrap { profile: ManagementProfile; organization: { id: string; name: string }; profiles: ManagementProfile[]; stages: PipelineStageSetting[] }
export interface PipelineStageSetting { id: string; stage: string; label: string; probability: string | number; order: number }
export interface ManagementClient { id: string; companyName: string; contactName: string; phone?: string | null; email?: string | null; contractedService?: string | null; monthlyValue?: string | number | null; totalContractValue?: string | number | null; startDate?: string | null; expectedEndDate?: string | null; contractDurationMonths?: number | null; commercialResponsibleId?: string | null; operationalResponsibleId?: string | null; commercialResponsible?: Pick<ManagementProfile, 'id' | 'fullName'> | null; operationalResponsible?: Pick<ManagementProfile, 'id' | 'fullName'> | null; status: string; source?: string | null; notes?: string | null; cancellationDate?: string | null; cancellationReason?: string | null; archivedAt?: string | null; createdAt: string; opportunities?: ManagementOpportunity[]; operationalTasks?: OperationalTask[]; transactions?: FinancialTransaction[]; activities?: ActivityLog[] }
export interface CampaignKpis { ctr: number | null; cpl: number | null; qualifiedLeadCost: number | null; qualificationRate: number | null; meetingConversion: number | null; cac: number | null; roas: number | null }
export interface Campaign { id: string; name: string; channel: string; objective: string; startDate: string; endDate?: string | null; status: string; responsibleUserId?: string | null; responsible?: Pick<ManagementProfile, 'id' | 'fullName'> | null; investment: string | number; impressions: number; reach: number; clicks: number; leads: number; qualifiedLeads: number; meetingsGenerated: number; clientsWon: number; attributedRevenue: string | number; notes?: string | null; kpis: CampaignKpis }
export interface OpportunityHistory { id: string; previousStage?: string | null; newStage: string; notes?: string | null; changedAt: string }
export interface ManagementOpportunity { id: string; clientId?: string | null; campaignId?: string | null; companyName: string; contactName: string; phone?: string | null; email?: string | null; leadSource?: string | null; responsibleUserId?: string | null; responsible?: Pick<ManagementProfile, 'id' | 'fullName'> | null; entryDate: string; firstContactDate?: string | null; lastInteractionDate?: string | null; nextInteractionDate?: string | null; stage: string; estimatedValue: string | number; closeProbability: string | number; meetingDate?: string | null; proposalDate?: string | null; expectedCloseDate?: string | null; actualCloseDate?: string | null; result?: string | null; lossReason?: string | null; notes?: string | null; stageHistory?: OpportunityHistory[] }
export interface OperationalTask { id: string; clientId?: string | null; client?: { id: string; companyName: string } | null; project?: string | null; workType: string; title: string; description?: string | null; responsibleUserId?: string | null; responsible?: Pick<ManagementProfile, 'id' | 'fullName' | 'role'> | null; requestDate: string; startDate?: string | null; deadline: string; completionDate?: string | null; priority: string; status: string; estimatedHours?: string | number | null; actualHours?: string | number | null; revisionCount: number; deliveredOnTime?: boolean | null; clientApproved: boolean; delayReason?: string | null; notes?: string | null }
export interface FinancialTransaction { id: string; clientId?: string | null; client?: { id: string; companyName: string; contractedService?: string | null } | null; date: string; type: 'receita' | 'despesa'; category: string; subcategory?: string | null; project?: string | null; description: string; expectedValue: string | number; actualValue?: string | number | null; dueDate?: string | null; paymentDate?: string | null; status: string; paymentMethod?: string | null; receiptUrl?: string | null; notes?: string | null }
export interface Goal { id: string; month: number; year: number; area: string; kpi: string; targetValue: string | number; actualValue?: string | number | null; unit: string; responsibleUserId?: string | null; responsible?: Pick<ManagementProfile, 'id' | 'fullName'> | null; notes?: string | null; fulfillment?: number; state?: 'verde' | 'amarelo' | 'vermelho' }
export interface ActivityLog { id: string; actionType: string; module: string; description: string; createdAt: string; user?: { fullName: string } | null }
export interface DashboardCards { revenueReceived: number; revenueExpected: number; expenses: number; profit: number; profitMargin: number | null; mrr: number; activeClients: number; newClients: number; lostClients: number; leads: number; qualifiedLeads: number; meetings: number; proposals: number; won: number; closeRate: number | null; pipelineValue: number; weightedPipeline: number; completedTasks: number; delayedTasks: number; onTimeRate: number | null }
export interface ManagementDashboard { role: ManagementRole; clients: ManagementClient[]; campaigns: Campaign[]; opportunities: ManagementOpportunity[]; tasks: OperationalTask[]; transactions: FinancialTransaction[]; summary: { cards: DashboardCards; campaignTotals: { investment: number; leads: number; revenue: number } }; activities: ActivityLog[] }

export type QueryParams = Record<string, string | number | undefined>;
export const managementApi = {
  bootstrap: async () => (await api.get<ManagementBootstrap>('/api/management/bootstrap')).data,
  dashboard: async (params?: QueryParams) => (await api.get<ManagementDashboard>('/api/management/dashboard', { params })).data,
  listUsers: async () => (await api.get<ManagementProfile[]>('/api/management/users')).data,
  createUser: async (data: { name: string; email: string; password: string; role: Exclude<ManagementRole, 'admin'> }) => (await api.post<ManagementProfile>('/api/management/users', data)).data,
  updateUser: async (id: string, data: Partial<Pick<ManagementProfile, 'fullName' | 'role' | 'active'>>) => (await api.patch<ManagementProfile>(`/api/management/users/${id}`, data)).data,
  clients: async (params?: QueryParams) => (await api.get<ManagementClient[]>('/api/management/clients', { params })).data,
  client: async (id: string) => (await api.get<ManagementClient>(`/api/management/clients/${id}`)).data,
  createClient: async (data: Record<string, unknown>) => (await api.post<ManagementClient>('/api/management/clients', data)).data,
  updateClient: async (id: string, data: Record<string, unknown>) => (await api.patch<ManagementClient>(`/api/management/clients/${id}`, data)).data,
  archiveClient: async (id: string) => (await api.post<ManagementClient>(`/api/management/clients/${id}/archive`)).data,
  deleteClient: async (id: string) => { await api.delete(`/api/management/clients/${id}`); },
  campaigns: async () => (await api.get<Campaign[]>('/api/management/campaigns')).data,
  createCampaign: async (data: Record<string, unknown>) => (await api.post<Campaign>('/api/management/campaigns', data)).data,
  updateCampaign: async (id: string, data: Record<string, unknown>) => (await api.patch<Campaign>(`/api/management/campaigns/${id}`, data)).data,
  opportunities: async () => (await api.get<ManagementOpportunity[]>('/api/management/opportunities')).data,
  createOpportunity: async (data: Record<string, unknown>) => (await api.post<ManagementOpportunity>('/api/management/opportunities', data)).data,
  updateOpportunity: async (id: string, data: Record<string, unknown>) => (await api.patch<ManagementOpportunity>(`/api/management/opportunities/${id}`, data)).data,
  moveOpportunity: async (id: string, stage: string, notes?: string) => (await api.post<ManagementOpportunity>(`/api/management/opportunities/${id}/stage`, { stage, notes })).data,
  stages: async () => (await api.get<PipelineStageSetting[]>('/api/management/stages')).data,
  updateStage: async (id: string, data: { probability: number; label?: string }) => (await api.patch<PipelineStageSetting>(`/api/management/stages/${id}`, data)).data,
  tasks: async (params?: QueryParams) => (await api.get<OperationalTask[]>('/api/management/tasks', { params })).data,
  createTask: async (data: Record<string, unknown>) => (await api.post<OperationalTask>('/api/management/tasks', data)).data,
  updateTask: async (id: string, data: Record<string, unknown>) => (await api.patch<OperationalTask>(`/api/management/tasks/${id}`, data)).data,
  transactions: async (params?: QueryParams) => (await api.get<FinancialTransaction[]>('/api/management/transactions', { params })).data,
  createTransaction: async (data: Record<string, unknown>) => (await api.post<FinancialTransaction>('/api/management/transactions', data)).data,
  updateTransaction: async (id: string, data: Record<string, unknown>) => (await api.patch<FinancialTransaction>(`/api/management/transactions/${id}`, data)).data,
  deleteTransaction: async (id: string) => { await api.delete(`/api/management/transactions/${id}`); },
  goals: async (params?: QueryParams) => (await api.get<Goal[]>('/api/management/goals', { params })).data,
  createGoal: async (data: Record<string, unknown>) => (await api.post<Goal>('/api/management/goals', data)).data,
  updateGoal: async (id: string, data: Record<string, unknown>) => (await api.patch<Goal>(`/api/management/goals/${id}`, data)).data,
  deleteGoal: async (id: string) => { await api.delete(`/api/management/goals/${id}`); },
  activities: async () => (await api.get<ActivityLog[]>('/api/management/activities')).data,
  report: async (module: string, params?: QueryParams) => (await api.get<unknown>(`/api/management/reports/${module}`, { params })).data,
};
