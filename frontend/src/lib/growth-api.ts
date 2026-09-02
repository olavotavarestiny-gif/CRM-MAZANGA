import { api } from './api';

export type GrowthRole = 'mazanga_admin' | 'client';
export type GrowthClientStatus = 'active' | 'paused' | 'finished' | 'archived';

export interface GrowthMetrics {
  estimatedReturn: number | null; costPerContact: number | null; qualifiedRate: number | null;
  contactToMeetingRate: number | null; proposalToSaleRate: number | null; averageTicket: number | null;
  suggestedBottleneck: string | null;
  funnel: Array<{ key: string; label: string; value: number; conversion: number | null; drop: number; dropRate: number | null }>;
}
export interface GrowthContactSource { id?: string; sourceName: string; contacts: number; qualifiedContacts: number; meetings: number; proposals: number; sales: number; revenue: number; qualityLabel: 'low'|'medium'|'high'|'very_high'; strategicReading?: string|null; sortOrder: number }
export interface GrowthCampaign { id?: string; name: string; objective?: string|null; sourceName?: string|null; investment: number; contacts: number; sales: number; revenue: number; status: 'testing'|'maintain'|'scale'|'optimize'|'pause'|'finished'; decision?: string|null; note?: string|null; sortOrder: number }
export interface GrowthDecision { id?: string; decision: string; reason?: string|null; owner?: string|null; priority: 'low'|'medium'|'high'; status: 'next_action'|'in_progress'|'completed'|'cancelled'; expectedImpact?: string|null; sortOrder: number }
export interface GrowthReading { whatHappened?: string|null; whatDataShows?: string|null; bottleneck?: string|null; businessMeaning?: string|null; recommendedDecision?: string|null; nextActions?: string|null; clientNeeds?: string|null }
export interface GrowthReport { executiveSummary?: string|null; mainLearnings?: string|null; whatWorked?: string|null; whatDidNotWork?: string|null; decisionsTaken?: string|null; nextSteps?: string|null }
export interface GrowthPeriod {
  id: string; clientId: string; periodName: string; startDate: string; endDate: string; investment: number|string;
  contacts: number; qualifiedContacts: number; meetings: number; proposals: number; sales: number; attributedRevenue: number|string;
  executiveSummary?: string|null; mainBottleneck?: string|null; recommendation?: string|null; status: 'draft'|'published'|'archived';
  updatedAt: string; sources: GrowthContactSource[]; campaigns: GrowthCampaign[]; strategicReading?: GrowthReading|null;
  decisions: GrowthDecision[]; report?: GrowthReport|null; metrics: GrowthMetrics; warnings: string[];
  publications?: Array<{ id: string; version: number; snapshot: GrowthSnapshot; publishedAt: string }>;
  client?: Pick<GrowthClient,'id'|'companyName'|'logoUrl'|'sector'|'mainGoal'>;
}
export interface GrowthClient {
  id: string; companyName: string; logoUrl?: string|null; sector?: string|null; contactName?: string|null; contactEmail?: string|null;
  phone?: string|null; mainGoal?: string|null; status: GrowthClientStatus; updatedAt: string; periods?: GrowthPeriod[];
  accesses?: Array<{ id: string; active: boolean; invitedAt: string; user: { id: number; name: string; email: string; active: boolean } }>;
}
export interface GrowthSnapshot { schemaVersion: number; generatedAt: string; period: GrowthPeriod; metrics: GrowthMetrics; warnings: string[] }
export interface GrowthPortalPeriod { id: string; periodName: string; startDate: string; endDate: string; status: string; publication: { id: string; version: number; snapshot: GrowthSnapshot; publishedAt: string } }

export const growthApi = {
  bootstrap: async () => (await api.get<{ role: GrowthRole; clientId: string|null; organization?: { id: string; name: string }|null }>('/api/growth-room/bootstrap')).data,
  clients: async () => (await api.get<GrowthClient[]>('/api/growth-room/clients')).data,
  client: async (id: string) => (await api.get<GrowthClient>(`/api/growth-room/clients/${id}`)).data,
  createClient: async (data: Partial<GrowthClient>) => (await api.post<GrowthClient>('/api/growth-room/clients', data)).data,
  updateClient: async (id: string, data: Partial<GrowthClient>) => (await api.patch<GrowthClient>(`/api/growth-room/clients/${id}`, data)).data,
  invite: async (id: string, data: { name: string; email: string }) => (await api.post(`/api/growth-room/clients/${id}/invitations`, data)).data,
  revoke: async (id: string) => { await api.post(`/api/growth-room/accesses/${id}/revoke`); },
  createPeriod: async (clientId: string, data: Record<string, unknown>) => (await api.post<GrowthPeriod>(`/api/growth-room/clients/${clientId}/periods`, data)).data,
  period: async (id: string) => (await api.get<GrowthPeriod>(`/api/growth-room/periods/${id}`)).data,
  updatePeriod: async (id: string, data: Record<string, unknown>) => (await api.patch<GrowthPeriod>(`/api/growth-room/periods/${id}`, data)).data,
  publish: async (id: string) => (await api.post(`/api/growth-room/periods/${id}/publish`)).data,
  archive: async (id: string) => (await api.post(`/api/growth-room/periods/${id}/archive`)).data,
  removePeriod: async (id: string) => { await api.delete(`/api/growth-room/periods/${id}`); },
  portal: async (clientId?: string|null) => (await api.get<{ client: GrowthClient; periods: GrowthPortalPeriod[] }>('/api/growth-room/portal', { params: clientId ? { clientId } : undefined })).data,
};

export const formatGrowthKz = (value: number|string|null|undefined) => value == null ? '—' : `${new Intl.NumberFormat('pt-AO', { maximumFractionDigits: 0 }).format(Number(value))} Kz`;
export const formatGrowthPercent = (value: number|null|undefined) => value == null ? 'Não disponível' : `${new Intl.NumberFormat('pt-PT', { style: 'percent', maximumFractionDigits: 1 }).format(value)}`;
