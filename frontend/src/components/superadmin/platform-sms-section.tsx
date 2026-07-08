'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, BarChart3, Eye, History, Megaphone, Play, RefreshCw, Save, Send, Zap } from 'lucide-react';
import {
  getPlatformSmsStats,
  getPlatformSmsCampaign,
  listPlatformSmsAutomationLogs,
  listPlatformSmsAutomations,
  listPlatformSmsCampaigns,
  listPlatformSmsMessages,
  listPlatformSmsSegments,
  previewPlatformSmsCampaign,
  runPlatformSmsAutomation,
  sendPlatformSmsCampaign,
  syncPlatformSmsCampaign,
  syncPlatformSmsMessage,
  updatePlatformSmsAutomation,
  type PlatformAutomationRunResult,
  type PlatformAutomationRule,
  type PlatformSmsCampaign,
  type PlatformSmsMessage,
  type PlatformSmsPreview,
  type PlatformSmsSegmentType,
} from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingButton } from '@/components/ui/loading-button';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast-provider';

type Tab = 'campanhas' | 'automacoes' | 'historico' | 'estatisticas';

const DAYS_SEGMENTS: PlatformSmsSegmentType[] = ['trial_ending', 'payment_due_soon'];
const MAX_MESSAGE_LEN = 480;
const HISTORY_PAGE_SIZE = 30;
const CAMPAIGN_DETAIL_PAGE_SIZE = 20;

type AutomationConditionField = {
  key: 'cooldownDays' | 'days' | 'recentDays' | 'priorDays';
  label: string;
  defaultValue: number;
  max: number;
};

const COOLDOWN_FIELD: AutomationConditionField = {
  key: 'cooldownDays',
  label: 'Intervalo sem repetir (dias)',
  defaultValue: 7,
  max: 365,
};

const AUTOMATION_CONDITION_FIELDS: Record<string, AutomationConditionField[]> = {
  no_first_action: [
    { key: 'days', label: 'Contas criadas nos últimos (dias)', defaultValue: 30, max: 365 },
  ],
  trial_ending: [
    { key: 'days', label: 'Trial termina dentro de (dias)', defaultValue: 7, max: 90 },
  ],
  payment_due_soon: [
    { key: 'days', label: 'Pagamento vence dentro de (dias)', defaultValue: 7, max: 90 },
  ],
  usage_drop: [
    { key: 'recentDays', label: 'Sem login nos últimos (dias)', defaultValue: 7, max: 90 },
    { key: 'priorDays', label: 'Com atividade nos últimos (dias)', defaultValue: 21, max: 365 },
  ],
};

function getAutomationConditionFields(triggerType: string) {
  return [COOLDOWN_FIELD, ...(AUTOMATION_CONDITION_FIELDS[triggerType] || [])];
}

function readPositiveCondition(
  conditions: Record<string, unknown> | null | undefined,
  field: AutomationConditionField
) {
  const value = Number(conditions?.[field.key]);
  return Number.isFinite(value) && value > 0 ? value : field.defaultValue;
}

// Lista estática (espelha o backend) — usada como fallback para o seletor nunca
// ficar vazio, mesmo que o endpoint /segments não esteja disponível.
const STATIC_SEGMENTS: { type: PlatformSmsSegmentType; label: string }[] = [
  { type: 'all_users', label: 'Todos os utilizadores' },
  { type: 'inactive_7_days', label: 'Inativos há 7 dias' },
  { type: 'inactive_14_days', label: 'Inativos há 14 dias' },
  { type: 'trial_ending', label: 'Trial a terminar' },
  { type: 'trial_expired', label: 'Trial expirado' },
  { type: 'payment_due_soon', label: 'Pagamento próximo' },
  { type: 'payment_overdue', label: 'Pagamento vencido' },
  { type: 'onboarding_incomplete', label: 'Onboarding incompleto' },
  { type: 'workspace_servicos', label: 'Workspace Serviços' },
  { type: 'workspace_comercio', label: 'Workspace Comércio' },
];

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return value;
  }
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    completed: 'bg-emerald-100 text-emerald-700',
    sent: 'bg-emerald-100 text-emerald-700',
    delivered: 'bg-emerald-100 text-emerald-700',
    sending: 'bg-blue-100 text-blue-700',
    queued: 'bg-slate-100 text-slate-600',
    draft: 'bg-slate-100 text-slate-600',
    skipped: 'bg-amber-100 text-amber-700',
    failed: 'bg-red-100 text-red-700',
  };
  return map[status] || 'bg-slate-100 text-slate-600';
}

export function PlatformSmsSection() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('campanhas');

  // Campaign form state
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [segmentType, setSegmentType] = useState<PlatformSmsSegmentType>('all_users');
  const [days, setDays] = useState(7);
  const [isTest, setIsTest] = useState(true);
  const [preview, setPreview] = useState<PlatformSmsPreview | null>(null);

  // History search
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [selectedCampaignPage, setSelectedCampaignPage] = useState(1);

  const segmentsQuery = useQuery({ queryKey: ['platform-sms-segments'], queryFn: listPlatformSmsSegments });
  const segments = segmentsQuery.data && segmentsQuery.data.length > 0 ? segmentsQuery.data : STATIC_SEGMENTS;
  const segmentLabel = useMemo(() => {
    const map: Record<string, string> = {};
    segments.forEach((s) => { map[s.type] = s.label; });
    return (type: string) => map[type] || type;
  }, [segments]);

  const campaignsQuery = useQuery({
    queryKey: ['platform-sms-campaigns'],
    queryFn: () => listPlatformSmsCampaigns({ pageSize: 20 }),
    enabled: tab === 'campanhas',
  });

  const messagesQuery = useQuery({
    queryKey: ['platform-sms-messages', search, historyPage],
    queryFn: () => listPlatformSmsMessages({ page: historyPage, pageSize: HISTORY_PAGE_SIZE, search: search || undefined }),
    enabled: tab === 'historico',
  });

  const campaignDetailQuery = useQuery({
    queryKey: ['platform-sms-campaign-detail', selectedCampaignId, selectedCampaignPage],
    queryFn: () => getPlatformSmsCampaign(selectedCampaignId as string, {
      page: selectedCampaignPage,
      pageSize: CAMPAIGN_DETAIL_PAGE_SIZE,
    }),
    enabled: !!selectedCampaignId,
  });

  const statsQuery = useQuery({
    queryKey: ['platform-sms-stats'],
    queryFn: getPlatformSmsStats,
    enabled: tab === 'estatisticas',
  });

  const automationsQuery = useQuery({
    queryKey: ['platform-sms-automations'],
    queryFn: listPlatformSmsAutomations,
    enabled: tab === 'automacoes',
  });

  const segmentFilters = DAYS_SEGMENTS.includes(segmentType) ? { days } : null;

  const previewMutation = useMutation({
    mutationFn: () => previewPlatformSmsCampaign({ segmentType, segmentFilters }),
    onSuccess: (data) => setPreview(data),
    onError: (err: Error) => toast({ variant: 'error', title: 'Erro na pré-visualização', description: err.message }),
  });

  const sendMutation = useMutation({
    mutationFn: () => sendPlatformSmsCampaign({ name, message, segmentType, segmentFilters, isTest }),
    onSuccess: (campaign) => {
      qc.invalidateQueries({ queryKey: ['platform-sms-campaigns'] });
      qc.invalidateQueries({ queryKey: ['platform-sms-messages'] });
      qc.invalidateQueries({ queryKey: ['platform-sms-stats'] });
      setPreview(null);
      setName('');
      setMessage('');
      toast({
        variant: 'success',
        title: 'Campanha enviada',
        description: `${campaign.sentCount} enviado(s), ${campaign.failedCount} falhado(s)${isTest ? ' (modo teste)' : ''}.`,
      });
    },
    onError: (err: Error) => toast({ variant: 'error', title: 'Erro ao enviar', description: err.message }),
  });

  const syncCampaignMutation = useMutation({
    mutationFn: (campaignId: string) => syncPlatformSmsCampaign(campaignId),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['platform-sms-campaigns'] });
      qc.invalidateQueries({ queryKey: ['platform-sms-campaign-detail'] });
      qc.invalidateQueries({ queryKey: ['platform-sms-messages'] });
      qc.invalidateQueries({ queryKey: ['platform-sms-stats'] });
      toast({
        variant: result.failedSync > 0 ? 'info' : 'success',
        title: 'Campanha sincronizada',
        description: `${result.synced}/${result.totalSyncable} mensagem(ns) sincronizada(s).${result.failedSync ? ` ${result.failedSync} falharam.` : ''}`,
      });
    },
    onError: (err: Error) => toast({ variant: 'error', title: 'Erro ao sincronizar campanha', description: err.message }),
  });

  const syncMessageMutation = useMutation({
    mutationFn: (messageId: string) => syncPlatformSmsMessage(messageId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-sms-campaigns'] });
      qc.invalidateQueries({ queryKey: ['platform-sms-campaign-detail'] });
      qc.invalidateQueries({ queryKey: ['platform-sms-messages'] });
      qc.invalidateQueries({ queryKey: ['platform-sms-stats'] });
      toast({ variant: 'success', title: 'Mensagem sincronizada' });
    },
    onError: (err: Error) => toast({ variant: 'error', title: 'Erro ao sincronizar mensagem', description: err.message }),
  });

  const resetPreviewOnChange = (fn: () => void) => { fn(); setPreview(null); };
  const canSend = !!name.trim() && !!message.trim() && !!preview && preview.totalRecipients > 0;
  const openCampaignDetail = (id: string) => {
    setSelectedCampaignId(id);
    setSelectedCampaignPage(1);
  };
  const handleSendCampaign = () => {
    if (!canSend || sendMutation.isPending) return;
    if (!isTest) {
      const confirmed = window.confirm(
        `Vai enviar uma campanha REAL para ${preview?.totalRecipients || 0} destinatário(s) do segmento "${segmentLabel(segmentType)}". Esta ação não usa a allowlist de teste. Pretende continuar?`
      );
      if (!confirmed) return;
    }
    sendMutation.mutate();
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {([
          { id: 'campanhas', label: 'Campanhas', icon: Megaphone },
          { id: 'automacoes', label: 'Automações', icon: Zap },
          { id: 'historico', label: 'Histórico', icon: History },
          { id: 'estatisticas', label: 'Estatísticas', icon: BarChart3 },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
              tab === id
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-[#dde3ec] bg-white text-[#0A2540] hover:bg-slate-50'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'campanhas' && (
        <>
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#0A2540]">
                <Send className="h-5 w-5" /> Nova campanha interna
              </CardTitle>
              <CardDescription>
                Comunique com os utilizadores da plataforma por segmento. Use <code>{'{{nome}}'}</code> para personalizar.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Segmento</Label>
                  <select
                    value={segmentType}
                    onChange={(e) => resetPreviewOnChange(() => setSegmentType(e.target.value as PlatformSmsSegmentType))}
                    className="mt-1 w-full rounded-lg border border-[#dde3ec] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {segments.map((s) => (
                      <option key={s.type} value={s.type}>{s.label}</option>
                    ))}
                  </select>
                </div>
                {DAYS_SEGMENTS.includes(segmentType) && (
                  <div>
                    <Label>Janela (dias)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={90}
                      value={days}
                      onChange={(e) => resetPreviewOnChange(() => setDays(Math.max(1, Number(e.target.value) || 7)))}
                      className="mt-1"
                    />
                  </div>
                )}
              </div>

              <div>
                <Label>Nome da campanha</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Reativação trial Junho" className="mt-1" />
              </div>

              <div>
                <Label>Mensagem</Label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE_LEN))}
                  placeholder="Olá {{nome}}, ..."
                  rows={3}
                  className="mt-1"
                />
                <p className="mt-1 text-xs text-[#6b7e9a]">{message.length}/{MAX_MESSAGE_LEN} caracteres</p>
              </div>

              <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <input type="checkbox" checked={isTest} onChange={(e) => setIsTest(e.target.checked)} className="mt-0.5" />
                <span>
                  <strong>Modo de teste</strong> — só envia para os números da allowlist (ZIETT_TEST_ALLOWED_RECIPIENTS).
                  Desligue apenas quando quiser enviar a sério para todo o segmento.
                </span>
              </label>

              <div className="flex flex-wrap gap-2">
                <LoadingButton
                  variant="outline"
                  onClick={() => previewMutation.mutate()}
                  loading={previewMutation.isPending}
                  loadingLabel="A pré-visualizar..."
                >
                  <Eye className="mr-2 h-4 w-4" /> Pré-visualizar destinatários
                </LoadingButton>
                <LoadingButton
                  onClick={handleSendCampaign}
                  disabled={!canSend || sendMutation.isPending}
                  loading={sendMutation.isPending}
                  loadingLabel="A enviar..."
                >
                  <Send className="mr-2 h-4 w-4" /> {isTest ? 'Enviar (teste)' : 'Enviar campanha'}
                </LoadingButton>
              </div>

              {preview && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <span className="font-semibold text-[#0A2540]">
                      {preview.totalRecipients} destinatário(s) com telefone
                    </span>
                    {preview.withoutPhone > 0 && (
                      <span className="inline-flex items-center gap-1 text-amber-700">
                        <AlertTriangle className="h-4 w-4" /> {preview.withoutPhone} sem telefone (ignorados)
                      </span>
                    )}
                    <span className="text-[#6b7e9a]">{preview.totalCandidates} candidato(s) no segmento</span>
                  </div>
                  {preview.sample.length > 0 && (
                    <div className="mt-3 max-h-56 overflow-auto rounded border border-slate-200 bg-white">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Telefone</TableHead>
                            <TableHead>Plano</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {preview.sample.map((r, i) => (
                            <TableRow key={i}>
                              <TableCell>{r.name}</TableCell>
                              <TableCell className="font-mono text-xs">{r.phone}</TableCell>
                              <TableCell>{r.plan || '—'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                  {preview.totalRecipients > preview.sample.length && (
                    <p className="mt-2 text-xs text-[#6b7e9a]">A mostrar os primeiros {preview.sample.length}.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-[#0A2540]">Campanhas</CardTitle>
            </CardHeader>
            <CardContent>
              {campaignsQuery.isLoading ? (
                <p className="py-8 text-center text-sm text-[#6b7e9a]">A carregar...</p>
              ) : (campaignsQuery.data?.items.length ?? 0) === 0 ? (
                <p className="py-8 text-center text-sm text-[#6b7e9a]">Ainda não há campanhas.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Segmento</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Enviados</TableHead>
                      <TableHead className="text-right">Falhados</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaignsQuery.data!.items.map((c: PlatformSmsCampaign) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>{segmentLabel(c.segmentType)}</TableCell>
                        <TableCell><Badge className={statusBadge(c.status)}>{c.status}</Badge></TableCell>
                        <TableCell className="text-right">{c.sentCount}/{c.totalRecipients}</TableCell>
                        <TableCell className="text-right">{c.failedCount}</TableCell>
                        <TableCell className="text-xs text-[#6b7e9a]">{formatDateTime(c.createdAt)}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => openCampaignDetail(c.id)}>
                            <Eye className="mr-1 h-4 w-4" /> Detalhe
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {tab === 'automacoes' && (
        <div className="space-y-4">
          <p className="text-sm text-[#6b7e9a]">
            Automações enviam SMS aos utilizadores conforme o gatilho. Estão <strong>desativadas por defeito</strong> —
            ative só as que quiser. Para evitar duplicados, respeitam o intervalo configurado em cada automação.
            O scheduler corre uma vez por dia; &laquo;Correr teste&raquo; envia apenas para a allowlist.
          </p>
          {automationsQuery.isLoading ? (
            <p className="py-8 text-center text-sm text-[#6b7e9a]">A carregar...</p>
          ) : automationsQuery.isError ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-700">Não foi possível carregar as automações.</p>
              <Button size="sm" variant="outline" onClick={() => automationsQuery.refetch()}>Tentar novamente</Button>
            </div>
          ) : (automationsQuery.data?.length ?? 0) === 0 ? (
            <p className="py-8 text-center text-sm text-[#6b7e9a]">Ainda não há automações configuradas.</p>
          ) : (
            (automationsQuery.data || []).map((rule) => (
              <AutomationCard key={rule.id} rule={rule} />
            ))
          )}
        </div>
      )}

      {tab === 'historico' && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-[#0A2540]">Histórico de SMS internos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setHistoryPage(1);
                setSearch(searchInput.trim());
              }}
              className="flex gap-2"
            >
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Procurar por nome ou telefone..."
              />
              <Button type="submit" variant="outline">Procurar</Button>
            </form>
            {messagesQuery.isLoading ? (
              <p className="py-8 text-center text-sm text-[#6b7e9a]">A carregar...</p>
            ) : (messagesQuery.data?.items.length ?? 0) === 0 ? (
              <p className="py-8 text-center text-sm text-[#6b7e9a]">Sem mensagens.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Destinatário</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Erro</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {messagesQuery.data!.items.map((m: PlatformSmsMessage) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.recipientName || '—'}</TableCell>
                        <TableCell className="font-mono text-xs">{m.phone}</TableCell>
                        <TableCell><Badge className={statusBadge(m.status)}>{m.status}</Badge></TableCell>
                        <TableCell className="text-xs">{m.triggerSource}{m.isTest ? ' (teste)' : ''}</TableCell>
                        <TableCell className="text-xs text-[#6b7e9a]">{formatDateTime(m.createdAt)}</TableCell>
                        <TableCell className="max-w-[220px] truncate text-xs text-red-600" title={m.errorMessage || ''}>
                          {m.errorMessage || ''}
                        </TableCell>
                        <TableCell className="text-right">
                          <LoadingButton
                            size="sm"
                            variant="outline"
                            loading={syncMessageMutation.isPending && syncMessageMutation.variables === m.id}
                            loadingLabel="Sync"
                            disabled={!m.providerMessageId}
                            onClick={() => syncMessageMutation.mutate(m.id)}
                          >
                            <RefreshCw className="mr-1 h-4 w-4" /> Sync
                          </LoadingButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {messagesQuery.data?.pagination && (
              <SmsPagination
                totalLabel={`${messagesQuery.data.pagination.total} mensagem(ns)`}
                page={messagesQuery.data.pagination.page}
                totalPages={messagesQuery.data.pagination.totalPages}
                onPrevious={() => setHistoryPage((current) => Math.max(current - 1, 1))}
                onNext={() => setHistoryPage((current) => current + 1)}
              />
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'estatisticas' && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { label: 'Total', value: statsQuery.data?.totals.total ?? 0 },
              { label: 'Enviados', value: statsQuery.data?.totals.sent ?? 0 },
              { label: 'Falhados', value: statsQuery.data?.totals.failed ?? 0 },
              { label: 'Em fila', value: statsQuery.data?.totals.queued ?? 0 },
              { label: 'Utilizadores impactados', value: statsQuery.data?.totals.impactedUsers ?? 0 },
            ].map((kpi) => (
              <Card key={kpi.label} className="border-slate-200 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-wide text-[#6b7e9a]">{kpi.label}</p>
                  <p className="mt-1 text-2xl font-bold text-[#0A2540]">{statsQuery.isLoading ? '—' : kpi.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader><CardTitle className="text-[#0A2540]">Campanhas recentes</CardTitle></CardHeader>
            <CardContent>
              {(statsQuery.data?.recentCampaigns.length ?? 0) === 0 ? (
                <p className="py-6 text-center text-sm text-[#6b7e9a]">Sem campanhas.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Enviados</TableHead>
                      <TableHead className="text-right">Falhados</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(statsQuery.data?.recentCampaigns || []).map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell><Badge className={statusBadge(c.status)}>{c.status}</Badge></TableCell>
                        <TableCell className="text-right">{c.sentCount}</TableCell>
                        <TableCell className="text-right">{c.failedCount}</TableCell>
                        <TableCell className="text-xs text-[#6b7e9a]">{formatDateTime(c.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={!!selectedCampaignId} onOpenChange={(open) => { if (!open) setSelectedCampaignId(null); }}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader className="pr-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <DialogTitle>Detalhe da campanha</DialogTitle>
              {selectedCampaignId && (
                <LoadingButton
                  size="sm"
                  variant="outline"
                  loading={syncCampaignMutation.isPending && syncCampaignMutation.variables === selectedCampaignId}
                  loadingLabel="A sincronizar..."
                  onClick={() => syncCampaignMutation.mutate(selectedCampaignId)}
                >
                  <RefreshCw className="mr-1 h-4 w-4" /> Sincronizar campanha
                </LoadingButton>
              )}
            </div>
          </DialogHeader>

          {campaignDetailQuery.isLoading ? (
            <p className="py-8 text-center text-sm text-[#6b7e9a]">A carregar detalhe...</p>
          ) : campaignDetailQuery.isError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              Não foi possível carregar esta campanha.
            </p>
          ) : campaignDetailQuery.data ? (
            <div className="space-y-4">
              <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs uppercase text-[#6b7e9a]">Campanha</p>
                  <p className="mt-1 font-semibold text-[#0A2540]">{campaignDetailQuery.data.campaign.name}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-[#6b7e9a]">Segmento</p>
                  <p className="mt-1 text-[#0A2540]">{segmentLabel(campaignDetailQuery.data.campaign.segmentType)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-[#6b7e9a]">Estado</p>
                  <Badge className={`mt-1 ${statusBadge(campaignDetailQuery.data.campaign.status)}`}>
                    {campaignDetailQuery.data.campaign.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs uppercase text-[#6b7e9a]">Resultado</p>
                  <p className="mt-1 text-[#0A2540]">
                    {campaignDetailQuery.data.campaign.sentCount}/{campaignDetailQuery.data.campaign.totalRecipients} enviados · {campaignDetailQuery.data.campaign.failedCount} falhados
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <p className="text-xs uppercase text-[#6b7e9a]">Mensagem</p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-[#0A2540]">{campaignDetailQuery.data.campaign.message}</p>
              </div>

              {(campaignDetailQuery.data.messages.length ?? 0) === 0 ? (
                <p className="py-8 text-center text-sm text-[#6b7e9a]">Sem mensagens registadas para esta campanha.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Destinatário</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Provider</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Erro</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {campaignDetailQuery.data.messages.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell className="font-medium">{m.recipientName || '—'}</TableCell>
                          <TableCell className="font-mono text-xs">{m.phone}</TableCell>
                          <TableCell><Badge className={statusBadge(m.status)}>{m.status}</Badge></TableCell>
                          <TableCell className="text-xs text-[#6b7e9a]">{m.providerStatus || m.providerMessageId || '—'}</TableCell>
                          <TableCell className="text-xs text-[#6b7e9a]">{formatDateTime(m.createdAt)}</TableCell>
                          <TableCell className="max-w-[240px] truncate text-xs text-red-600" title={m.errorMessage || ''}>
                            {m.errorMessage || ''}
                          </TableCell>
                          <TableCell className="text-right">
                            <LoadingButton
                              size="sm"
                              variant="outline"
                              loading={syncMessageMutation.isPending && syncMessageMutation.variables === m.id}
                              loadingLabel="Sync"
                              disabled={!m.providerMessageId}
                              onClick={() => syncMessageMutation.mutate(m.id)}
                            >
                              <RefreshCw className="mr-1 h-4 w-4" /> Sync
                            </LoadingButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <SmsPagination
                totalLabel={`${campaignDetailQuery.data.pagination.total} mensagem(ns) nesta campanha`}
                page={campaignDetailQuery.data.pagination.page}
                totalPages={campaignDetailQuery.data.pagination.totalPages}
                onPrevious={() => setSelectedCampaignPage((current) => Math.max(current - 1, 1))}
                onNext={() => setSelectedCampaignPage((current) => current + 1)}
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SmsPagination({
  totalLabel,
  page,
  totalPages,
  onPrevious,
  onNext,
}: {
  totalLabel: string;
  page: number;
  totalPages: number;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const effectiveTotalPages = Math.max(totalPages, 1);

  return (
    <div className="flex flex-col gap-3 border-t border-[#e5ebf3] pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-[#6b7e9a]">{totalLabel}</p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={onPrevious}>
          Anterior
        </Button>
        <span className="text-sm text-[#6b7e9a]">
          Página {page} de {effectiveTotalPages}
        </span>
        <Button variant="outline" size="sm" disabled={page >= effectiveTotalPages} onClick={onNext}>
          Próxima
        </Button>
      </div>
    </div>
  );
}

function AutomationCard({ rule }: { rule: PlatformAutomationRule }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [message, setMessage] = useState(rule.messageTemplate);
  const conditionFields = getAutomationConditionFields(rule.triggerType);
  const [conditionValues, setConditionValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      conditionFields.map((field) => [field.key, readPositiveCondition(rule.conditionsJson, field)])
    )
  );
  const [previewResult, setPreviewResult] = useState<PlatformAutomationRunResult | null>(null);
  const [showLogs, setShowLogs] = useState(false);

  const logsQuery = useQuery({
    queryKey: ['platform-sms-automation-logs', rule.id],
    queryFn: () => listPlatformSmsAutomationLogs(rule.id, { pageSize: 10 }),
    enabled: showLogs,
  });

  const invalidateExecution = () => {
    qc.invalidateQueries({ queryKey: ['platform-sms-automations'] });
    qc.invalidateQueries({ queryKey: ['platform-sms-automation-logs', rule.id] });
    qc.invalidateQueries({ queryKey: ['platform-sms-messages'] });
    qc.invalidateQueries({ queryKey: ['platform-sms-stats'] });
  };

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof updatePlatformSmsAutomation>[1]) => updatePlatformSmsAutomation(rule.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-sms-automations'] });
      toast({ variant: 'success', title: 'Automação atualizada' });
    },
    onError: (err: Error) => toast({ variant: 'error', title: 'Erro', description: err.message }),
  });

  const runMutation = useMutation({
    mutationFn: (opts: { dryRun?: boolean; isTest?: boolean }) => runPlatformSmsAutomation(rule.id, opts),
    onSuccess: (res, opts) => {
      if (opts.dryRun) {
        setPreviewResult(res);
        toast({ variant: 'info', title: 'Pré-visualização', description: `${res.eligible} utilizador(es) elegível(eis).` });
      } else {
        invalidateExecution();
        toast({
          variant: res.failed > 0 && res.sent === 0 ? 'error' : 'success',
          title: 'Execução concluída',
          description: `Elegíveis ${res.eligible} · enviados ${res.sent} · falhados ${res.failed} · ignorados ${res.skipped} (modo teste).`,
        });
      }
    },
    onError: (err: Error) => toast({ variant: 'error', title: 'Erro ao correr', description: err.message }),
  });

  const messageChanged = message.trim() !== rule.messageTemplate;
  const conditionsChanged = conditionFields.some(
    (field) => conditionValues[field.key] !== readPositiveCondition(rule.conditionsJson, field)
  );
  const usageRangeInvalid = rule.triggerType === 'usage_drop'
    && conditionValues.priorDays <= conditionValues.recentDays;

  const saveConditions = () => {
    const conditionsJson: Record<string, unknown> = { ...(rule.conditionsJson || {}) };
    conditionFields.forEach((field) => {
      conditionsJson[field.key] = conditionValues[field.key];
    });
    updateMutation.mutate({ conditionsJson });
  };

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-medium text-[#0A2540]">{rule.name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#6b7e9a]">
              <Badge className="bg-slate-100 text-slate-600">{rule.triggerType}</Badge>
              <span>Última execução: {rule.lastRunAt ? formatDateTime(rule.lastRunAt) : 'nunca'}</span>
              <span>· {rule.sentCount ?? 0} enviado(s)</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Switch
              aria-label={rule.isActive ? 'Desativar automação' : 'Ativar automação'}
              checked={rule.isActive}
              disabled={updateMutation.isPending}
              onCheckedChange={(checked) => updateMutation.mutate({ isActive: checked === true })}
            />
            <span className={rule.isActive ? 'font-medium text-emerald-700' : 'text-[#6b7e9a]'}>
              {rule.isActive ? 'Ativa' : 'Inativa'}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`automation-message-${rule.id}`}>Mensagem</Label>
          <Textarea
            id={`automation-message-${rule.id}`}
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE_LEN))}
            rows={2}
          />
          <p className="text-right text-xs text-[#6b7e9a]">{message.length}/{MAX_MESSAGE_LEN}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {conditionFields.map((field) => (
            <div key={field.key} className="space-y-2">
              <Label htmlFor={`${rule.id}-${field.key}`}>{field.label}</Label>
              <Input
                id={`${rule.id}-${field.key}`}
                type="number"
                min={1}
                max={field.max}
                value={conditionValues[field.key]}
                onChange={(event) => {
                  const value = Math.min(field.max, Math.max(1, Number(event.target.value) || field.defaultValue));
                  setConditionValues((current) => ({ ...current, [field.key]: value }));
                }}
              />
            </div>
          ))}
        </div>

        {usageRangeInvalid ? (
          <p className="text-sm text-red-700">A janela com atividade deve ser maior do que o período sem login.</p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {messageChanged ? (
            <LoadingButton
              size="sm"
              loading={updateMutation.isPending}
              loadingLabel="A guardar..."
              onClick={() => updateMutation.mutate({ messageTemplate: message.trim() })}
              disabled={!message.trim()}
            >
              <Save className="mr-1 h-4 w-4" /> Guardar mensagem
            </LoadingButton>
          ) : null}
          {conditionsChanged ? (
            <LoadingButton
              size="sm"
              variant="outline"
              loading={updateMutation.isPending}
              loadingLabel="A guardar..."
              onClick={saveConditions}
              disabled={usageRangeInvalid}
            >
              <Save className="mr-1 h-4 w-4" /> Guardar condições
            </LoadingButton>
          ) : null}
          <LoadingButton
            size="sm"
            variant="outline"
            loading={runMutation.isPending && runMutation.variables?.dryRun === true}
            loadingLabel="A verificar..."
            onClick={() => runMutation.mutate({ dryRun: true })}
            disabled={runMutation.isPending}
          >
            <Eye className="mr-1 h-4 w-4" /> Pré-ver elegíveis
          </LoadingButton>
          <LoadingButton
            size="sm"
            variant="outline"
            loading={runMutation.isPending && runMutation.variables?.dryRun === false}
            loadingLabel="A executar..."
            onClick={() => runMutation.mutate({ dryRun: false, isTest: true })}
            disabled={runMutation.isPending}
          >
            <Play className="mr-1 h-4 w-4" /> Correr teste
          </LoadingButton>
          <Button size="sm" variant="outline" onClick={() => setShowLogs((current) => !current)}>
            <History className="mr-1 h-4 w-4" /> {showLogs ? 'Ocultar histórico' : 'Ver histórico'}
          </Button>
        </div>

        {previewResult ? (
          <div className="space-y-3 border-t border-slate-200 pt-4">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="font-semibold text-[#0A2540]">{previewResult.eligible} elegível(eis)</span>
              {previewResult.sample && previewResult.eligible > previewResult.sample.length ? (
                <span className="text-[#6b7e9a]">A mostrar os primeiros {previewResult.sample.length}.</span>
              ) : null}
            </div>
            {previewResult.sample?.length ? (
              <div className="max-h-56 overflow-auto rounded border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Utilizador</TableHead>
                      <TableHead>Telefone</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewResult.sample.map((recipient) => (
                      <TableRow key={`${recipient.phone}-${recipient.name}`}>
                        <TableCell className="font-medium">{recipient.name || '—'}</TableCell>
                        <TableCell className="font-mono text-xs">{recipient.phone}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-[#6b7e9a]">Nenhum utilizador elegível com telefone.</p>
            )}
          </div>
        ) : null}

        {showLogs ? (
          <div className="space-y-3 border-t border-slate-200 pt-4">
            <p className="font-medium text-[#0A2540]">Execuções recentes</p>
            {logsQuery.isLoading ? (
              <p className="py-4 text-sm text-[#6b7e9a]">A carregar histórico...</p>
            ) : logsQuery.isError ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-700">Não foi possível carregar o histórico.</p>
                <Button size="sm" variant="outline" onClick={() => logsQuery.refetch()}>Tentar novamente</Button>
              </div>
            ) : (logsQuery.data?.logs.length ?? 0) === 0 ? (
              <p className="py-4 text-sm text-[#6b7e9a]">Esta automação ainda não tem execuções.</p>
            ) : (
              <div className="overflow-x-auto rounded border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Utilizador</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Erro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logsQuery.data!.logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <p className="font-medium">{log.targetUser?.name || `Utilizador #${log.targetUserId}`}</p>
                          <p className="font-mono text-xs text-[#6b7e9a]">{log.targetUser?.phone || '—'}</p>
                        </TableCell>
                        <TableCell><Badge className={statusBadge(log.status)}>{log.status}</Badge></TableCell>
                        <TableCell className="text-xs text-[#6b7e9a]">{formatDateTime(log.executedAt)}</TableCell>
                        <TableCell className="max-w-[280px] truncate text-xs text-red-600" title={log.errorMessage || ''}>
                          {log.errorMessage || ''}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
