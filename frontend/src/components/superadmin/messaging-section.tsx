'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  MessageSquareText,
  RefreshCw,
  Send,
  ShieldAlert,
} from 'lucide-react';
import {
  getSuperadminMessagingCampaign,
  listSuperadminMessagingCampaigns,
  sendSuperadminBatchCampaign,
  sendSuperadminSingleMessage,
  syncSuperadminMessage,
  syncSuperadminMessagingCampaign,
  type SuperAdminMessagingCampaign,
  type SuperAdminMessagingCampaignRecipient,
  type SuperAdminMessagingCampaignValidationResponse,
  type SuperAdminMessagingMessage,
  type SuperAdminMessagingRecipientInput,
  validateSuperadminBatchCampaign,
} from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingButton } from '@/components/ui/loading-button';
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

const CAMPAIGNS_PAGE_SIZE = 10;
const RECIPIENTS_PAGE_SIZE = 25;

function parseRecipientsText(value: string): SuperAdminMessagingRecipientInput[] {
  return value
    .split(/[\n,;]+/)
    .map((phone) => phone.trim())
    .filter(Boolean)
    .map((phone) => ({ phone }));
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('pt-PT');
}

function formatJson(value: unknown) {
  if (!value) return 'Sem snapshot disponível.';

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function getStatusVariant(status?: string | null) {
  const normalized = String(status || '').toLowerCase();

  if (['completed', 'delivered', 'sent'].includes(normalized)) return 'success' as const;
  if (['failed', 'rejected', 'undelivered', 'expired', 'cancelled', 'invalid', 'duplicate', 'opted_out', 'not_allowed'].includes(normalized)) {
    return 'destructive' as const;
  }
  if (['processing', 'sending'].includes(normalized)) return 'default' as const;
  return 'secondary' as const;
}

function SummaryPill({ label, value, variant }: { label: string; value: number; variant?: 'success' | 'secondary' | 'destructive' | 'default' | 'outline' | 'solid' }) {
  return (
    <div className="rounded-2xl border border-[#dde3ec] bg-white px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6b7e9a]">{label}</div>
      <div className="mt-1 flex items-center gap-2">
        <div className="text-2xl font-black text-[#0A2540]">{value}</div>
        {variant ? <Badge variant={variant}>{label}</Badge> : null}
      </div>
    </div>
  );
}

function ValidationSummary({
  result,
}: {
  result: SuperAdminMessagingCampaignValidationResponse;
}) {
  const summary = result.summary;

  return (
    <div className="space-y-4 rounded-2xl border border-[#dde3ec] bg-[#f8fafc] p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[#0A2540]">Pré-validação concluída</p>
          <p className="text-sm text-[#6b7e9a]">
            {summary.accepted} número(s) prontos para envio e {summary.invalid + summary.duplicate + summary.optedOut + summary.notAllowed} rejeitado(s).
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <SummaryPill label="Submetidos" value={summary.submitted} />
        <SummaryPill label="Aceites" value={summary.accepted} variant="success" />
        <SummaryPill label="Inválidos" value={summary.invalid} variant="destructive" />
        <SummaryPill label="Duplicados" value={summary.duplicate} variant="destructive" />
        <SummaryPill label="Opt-out" value={summary.optedOut} variant="destructive" />
        <SummaryPill label="Allowlist" value={summary.notAllowed} variant="destructive" />
      </div>

      {result.rejectedRecipients.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-[#dde3ec] bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Erro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.rejectedRecipients.slice(0, 12).map((recipient, index) => (
                <TableRow key={`${recipient.phoneOriginal}-${index}`}>
                  <TableCell className="font-medium">{recipient.phoneOriginal || 'Sem número'}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(recipient.status)}>{recipient.status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-[#6b7e9a]">{recipient.errorMessage || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {result.rejectedRecipients.length > 12 ? (
            <div className="border-t border-[#dde3ec] px-4 py-3 text-xs text-[#6b7e9a]">
              + {result.rejectedRecipients.length - 12} destinatário(s) rejeitado(s) não exibidos.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function CampaignHistoryTable({
  campaigns,
  isLoading,
  isFetching,
  error,
  onRetry,
  onView,
  onSync,
  syncingCampaignId,
}: {
  campaigns: SuperAdminMessagingCampaign[];
  isLoading: boolean;
  isFetching: boolean;
  error: boolean;
  onRetry: () => void;
  onView: (campaignId: string) => void;
  onSync: (campaignId: string) => void;
  syncingCampaignId?: string | null;
}) {
  if (error) {
    return (
      <ErrorState
        compact
        title="Não foi possível carregar as campanhas"
        message="Tenta novamente dentro de instantes."
        onRetry={onRetry}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-[#6b7e9a]">
        <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
        A carregar campanhas...
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <EmptyState
        icon={MessageSquareText}
        title="Ainda sem campanhas"
        description="As campanhas enviadas pelo superadmin vão aparecer aqui com tracking local."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[#dde3ec]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Campanha</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Destinatários</TableHead>
            <TableHead>Criador</TableHead>
            <TableHead>Provider ID</TableHead>
            <TableHead>Data</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {campaigns.map((campaign) => (
            <TableRow key={campaign.id}>
              <TableCell>
                <div className="font-medium text-[#0A2540]">{campaign.name}</div>
                <div className="mt-1 truncate text-xs text-[#6b7e9a]">{campaign.content}</div>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={getStatusVariant(campaign.status)}>{campaign.status}</Badge>
                  {campaign.isTest ? <Badge variant="secondary">Teste</Badge> : null}
                </div>
              </TableCell>
              <TableCell>
                <div className="text-sm font-medium text-[#0A2540]">{campaign.acceptedRecipientsCount} aceites</div>
                <div className="text-xs text-[#6b7e9a]">{campaign.requestedRecipientsCount} submetidos</div>
              </TableCell>
              <TableCell className="text-sm text-[#6b7e9a]">{campaign.createdByEmail}</TableCell>
              <TableCell className="font-mono text-xs text-[#6b7e9a]">{campaign.providerCampaignId || '—'}</TableCell>
              <TableCell className="text-sm text-[#6b7e9a]">{formatDateTime(campaign.createdAt)}</TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => onView(campaign.id)}>
                    <Eye className="mr-2 h-4 w-4" />
                    Ver
                  </Button>
                  <LoadingButton
                    variant="secondary"
                    size="sm"
                    loading={syncingCampaignId === campaign.id}
                    loadingLabel="A sync..."
                    disabled={syncingCampaignId === campaign.id || isFetching}
                    onClick={() => onSync(campaign.id)}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Sync
                  </LoadingButton>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function CampaignRecipientsTable({
  recipients,
}: {
  recipients: SuperAdminMessagingCampaignRecipient[];
}) {
  if (recipients.length === 0) {
    return (
      <EmptyState
        compact
        title="Sem destinatários"
        description="Não há recipients guardados para esta campanha."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[#dde3ec]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Número</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Provider</TableHead>
            <TableHead>Destino</TableHead>
            <TableHead>Custo</TableHead>
            <TableHead>Erro</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {recipients.map((recipient) => (
            <TableRow key={recipient.id}>
              <TableCell>
                <div className="font-medium text-[#0A2540]">{recipient.phoneNormalized || recipient.phoneOriginal}</div>
                {recipient.phoneNormalized && recipient.phoneOriginal !== recipient.phoneNormalized ? (
                  <div className="text-xs text-[#6b7e9a]">Original: {recipient.phoneOriginal}</div>
                ) : null}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={getStatusVariant(recipient.status)}>{recipient.status}</Badge>
                  {recipient.providerStatus ? <Badge variant="outline">{recipient.providerStatus}</Badge> : null}
                </div>
              </TableCell>
              <TableCell className="font-mono text-xs text-[#6b7e9a]">{recipient.providerMessageId || '—'}</TableCell>
              <TableCell className="text-sm text-[#6b7e9a]">{recipient.channelDestination || '—'}</TableCell>
              <TableCell className="text-sm text-[#6b7e9a]">
                {typeof recipient.cost === 'number' ? `${recipient.cost.toFixed(2)}` : '—'}
              </TableCell>
              <TableCell className="text-sm text-[#6b7e9a]">{recipient.errorMessage || '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function SuperAdminMessagingSection() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [campaignSearch, setCampaignSearch] = useState('');
  const [campaignPage, setCampaignPage] = useState(1);
  const [recipientPage, setRecipientPage] = useState(1);
  const [batchForm, setBatchForm] = useState({
    name: '',
    remitterId: '',
    countryAlpha2: 'AO',
    content: '',
    recipientsText: '',
    isTest: true,
  });
  const [singleForm, setSingleForm] = useState({
    phone: '',
    remitterId: '',
    content: '',
    isTest: true,
  });
  const [validationResult, setValidationResult] = useState<SuperAdminMessagingCampaignValidationResponse | null>(null);
  const [lastSingleMessage, setLastSingleMessage] = useState<SuperAdminMessagingMessage | null>(null);

  const selectedCampaignId = searchParams?.get('campaignId') || null;
  const recipientsCount = useMemo(
    () => parseRecipientsText(batchForm.recipientsText).length,
    [batchForm.recipientsText]
  );

  useEffect(() => {
    setRecipientPage(1);
  }, [selectedCampaignId]);

  const campaignsQuery = useQuery({
    queryKey: ['superadmin-messaging-campaigns', campaignPage, campaignSearch],
    queryFn: () =>
      listSuperadminMessagingCampaigns({
        page: campaignPage,
        pageSize: CAMPAIGNS_PAGE_SIZE,
        search: campaignSearch || undefined,
      }),
  });

  const campaignDetailQuery = useQuery({
    queryKey: ['superadmin-messaging-campaign', selectedCampaignId, recipientPage],
    queryFn: () =>
      getSuperadminMessagingCampaign(selectedCampaignId as string, {
        recipientPage,
        recipientPageSize: RECIPIENTS_PAGE_SIZE,
      }),
    enabled: !!selectedCampaignId,
  });

  const setCampaignInQuery = (campaignId?: string | null) => {
    const params = new URLSearchParams(searchParams?.toString());
    params.set('section', 'messaging');
    if (campaignId) {
      params.set('campaignId', campaignId);
    } else {
      params.delete('campaignId');
    }
    router.replace(`${pathname}?${params.toString()}`);
  };

  const validateBatchMutation = useMutation({
    mutationFn: () =>
      validateSuperadminBatchCampaign({
        name: batchForm.name,
        content: batchForm.content,
        remitterId: batchForm.remitterId,
        countryAlpha2: batchForm.countryAlpha2,
        recipients: parseRecipientsText(batchForm.recipientsText),
        isTest: batchForm.isTest,
      }),
    onSuccess: (result) => {
      setValidationResult(result);
      toast({
        variant: 'success',
        title: 'Validação concluída',
        description: `${result.summary.accepted} destinatário(s) prontos para envio.`,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'error',
        title: 'Falha na validação',
        description: error.message,
      });
    },
  });

  const sendBatchMutation = useMutation({
    mutationFn: () =>
      sendSuperadminBatchCampaign({
        name: batchForm.name,
        content: batchForm.content,
        remitterId: batchForm.remitterId,
        countryAlpha2: batchForm.countryAlpha2,
        recipients: parseRecipientsText(batchForm.recipientsText),
        isTest: batchForm.isTest,
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-messaging-campaigns'] });
      setValidationResult(null);
      setBatchForm({
        name: '',
        remitterId: '',
        countryAlpha2: 'AO',
        content: '',
        recipientsText: '',
        isTest: true,
      });
      setCampaignInQuery(result.campaign.id);
      toast({
        variant: 'success',
        title: 'Campanha enviada',
        description: `Campanha ${result.campaign.name} criada com sucesso.`,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'error',
        title: 'Falha ao enviar campanha',
        description: error.message,
      });
    },
  });

  const syncCampaignMutation = useMutation({
    mutationFn: (campaignId: string) => syncSuperadminMessagingCampaign(campaignId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-messaging-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['superadmin-messaging-campaign', result.campaign.id] });
      toast({
        variant: 'success',
        title: 'Campanha sincronizada',
        description: `Estado atual: ${result.campaign.status}.`,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'error',
        title: 'Falha ao sincronizar campanha',
        description: error.message,
      });
    },
  });

  const singleSendMutation = useMutation({
    mutationFn: () =>
      sendSuperadminSingleMessage({
        phone: singleForm.phone,
        content: singleForm.content,
        remitterId: singleForm.remitterId,
        isTest: singleForm.isTest,
      }),
    onSuccess: (result) => {
      setLastSingleMessage(result);
      toast({
        variant: 'success',
        title: 'Mensagem unitária enviada',
        description: `Tracking local criado para ${result.phoneNormalized}.`,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'error',
        title: 'Falha no envio unitário',
        description: error.message,
      });
    },
  });

  const syncMessageMutation = useMutation({
    mutationFn: (messageId: string) => syncSuperadminMessage(messageId),
    onSuccess: (result) => {
      setLastSingleMessage(result);
      queryClient.invalidateQueries({ queryKey: ['superadmin-messaging-campaign', result.campaign?.id] });
      toast({
        variant: 'success',
        title: 'Mensagem sincronizada',
        description: `Estado atual: ${result.status}.`,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'error',
        title: 'Falha ao sincronizar mensagem',
        description: error.message,
      });
    },
  });

  const selectedCampaign = campaignDetailQuery.data?.campaign || null;
  const campaigns = campaignsQuery.data?.data || [];
  const campaignsPagination = campaignsQuery.data?.pagination;
  const recipientsPagination = campaignDetailQuery.data?.recipients.pagination;

  return (
    <div className="space-y-6">
      {selectedCampaignId ? (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <Button variant="ghost" size="sm" className="w-fit px-0" onClick={() => setCampaignInQuery(null)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar ao histórico
              </Button>
              <div>
                <CardTitle>Detalhe da Campanha</CardTitle>
                <CardDescription>
                  Snapshot local, resposta do provider e estado dos recipients sincronizados.
                </CardDescription>
              </div>
            </div>
            <LoadingButton
              variant="outline"
              loading={syncCampaignMutation.isPending && syncCampaignMutation.variables === selectedCampaignId}
              loadingLabel="A sync..."
              onClick={() => selectedCampaignId && syncCampaignMutation.mutate(selectedCampaignId)}
              disabled={!selectedCampaignId}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Sincronizar campanha
            </LoadingButton>
          </CardHeader>
          <CardContent className="space-y-5">
            {campaignDetailQuery.isLoading ? (
              <div className="flex items-center justify-center py-16 text-[#6b7e9a]">
                <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                A carregar detalhe...
              </div>
            ) : campaignDetailQuery.isError || !selectedCampaign ? (
              <ErrorState
                compact
                title="Não foi possível carregar a campanha"
                message="Tenta novamente dentro de instantes."
                onRetry={() => campaignDetailQuery.refetch()}
              />
            ) : (
              <>
                <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                  <div className="rounded-2xl border border-[#dde3ec] bg-[#f8fafc] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-[#0A2540]">{selectedCampaign.name}</h3>
                        <p className="mt-1 text-sm text-[#6b7e9a]">{selectedCampaign.content}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={getStatusVariant(selectedCampaign.status)}>{selectedCampaign.status}</Badge>
                        {selectedCampaign.providerStatus ? <Badge variant="outline">{selectedCampaign.providerStatus}</Badge> : null}
                        {selectedCampaign.isTest ? <Badge variant="secondary">Teste</Badge> : null}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <SummaryPill label="Submetidos" value={selectedCampaign.requestedRecipientsCount} />
                      <SummaryPill label="Aceites" value={selectedCampaign.acceptedRecipientsCount} variant="success" />
                      <SummaryPill label="Inválidos" value={selectedCampaign.invalidRecipientsCount} variant="destructive" />
                      <SummaryPill label="Não allowlist" value={selectedCampaign.notAllowedRecipientsCount} variant="destructive" />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#dde3ec] bg-white p-4">
                    <div className="grid gap-3 text-sm">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6b7e9a]">Provider Campaign ID</div>
                        <div className="mt-1 font-mono text-xs text-[#0A2540]">{selectedCampaign.providerCampaignId || '—'}</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6b7e9a]">Criado por</div>
                        <div className="mt-1 text-[#0A2540]">{selectedCampaign.createdByEmail}</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6b7e9a]">Datas</div>
                        <div className="mt-1 text-[#0A2540]">Criada: {formatDateTime(selectedCampaign.createdAt)}</div>
                        <div className="text-[#6b7e9a]">Enviada: {formatDateTime(selectedCampaign.sentAt)}</div>
                        <div className="text-[#6b7e9a]">Processada: {formatDateTime(selectedCampaign.processedAt)}</div>
                        <div className="text-[#6b7e9a]">Concluída: {formatDateTime(selectedCampaign.completedAt)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6b7e9a]">Notas / erro</div>
                        <div className="mt-1 text-[#0A2540]">{selectedCampaign.statusNote || selectedCampaign.providerErrorMessage || '—'}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-[#0A2540]">Recipients</h3>
                      <p className="text-sm text-[#6b7e9a]">
                        {recipientsPagination?.total || 0} registo(s) locais para esta campanha.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={(recipientsPagination?.page || 1) <= 1}
                        onClick={() => setRecipientPage((page) => Math.max(page - 1, 1))}
                      >
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={(recipientsPagination?.page || 1) >= (recipientsPagination?.totalPages || 1)}
                        onClick={() => setRecipientPage((page) => page + 1)}
                      >
                        Próxima
                      </Button>
                    </div>
                  </div>

                  <CampaignRecipientsTable recipients={campaignDetailQuery.data?.recipients.data || []} />
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="rounded-2xl border border-[#dde3ec] bg-white p-4">
                    <div className="mb-3">
                      <h3 className="text-base font-semibold text-[#0A2540]">Raw Request</h3>
                      <p className="text-sm text-[#6b7e9a]">Payload local enviado para a Ziett.</p>
                    </div>
                    <pre className="max-h-[22rem] overflow-auto rounded-xl bg-[#0A2540] p-4 text-xs text-slate-100">
                      {formatJson(selectedCampaign.rawRequestJson)}
                    </pre>
                  </div>
                  <div className="rounded-2xl border border-[#dde3ec] bg-white p-4">
                    <div className="mb-3">
                      <h3 className="text-base font-semibold text-[#0A2540]">Raw Response</h3>
                      <p className="text-sm text-[#6b7e9a]">Último snapshot sincronizado do provider.</p>
                    </div>
                    <pre className="max-h-[22rem] overflow-auto rounded-xl bg-[#0A2540] p-4 text-xs text-slate-100">
                      {formatJson(selectedCampaign.rawResponseJson)}
                    </pre>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Envio Batch</CardTitle>
            <CardDescription>
              Cola a lista de números de teste, valida e cria a campanha local com tracking Ziett.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="campaign-name">Nome da campanha</Label>
                <Input
                  id="campaign-name"
                  value={batchForm.name}
                  onChange={(event) => setBatchForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Teste interno abril"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="campaign-remitter">Remitter ID</Label>
                <Input
                  id="campaign-remitter"
                  value={batchForm.remitterId}
                  onChange={(event) => setBatchForm((current) => ({ ...current, remitterId: event.target.value }))}
                  placeholder="uuid do remitter"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[160px_1fr]">
              <div className="space-y-2">
                <Label htmlFor="campaign-country">País default</Label>
                <Input
                  id="campaign-country"
                  value={batchForm.countryAlpha2}
                  onChange={(event) => setBatchForm((current) => ({ ...current, countryAlpha2: event.target.value.toUpperCase() }))}
                  maxLength={2}
                  placeholder="AO"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="campaign-content">Mensagem</Label>
                <Textarea
                  id="campaign-content"
                  value={batchForm.content}
                  onChange={(event) => setBatchForm((current) => ({ ...current, content: event.target.value }))}
                  placeholder="Mensagem de teste do KukuGest"
                  className="min-h-[110px]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="campaign-recipients">Números</Label>
                <span className="text-xs text-[#6b7e9a]">{recipientsCount} linha(s)/entrada(s)</span>
              </div>
              <Textarea
                id="campaign-recipients"
                value={batchForm.recipientsText}
                onChange={(event) => setBatchForm((current) => ({ ...current, recipientsText: event.target.value }))}
                placeholder={'+244900000000\n244911111111\n912345678'}
                className="min-h-[180px] font-mono"
              />
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-[#dde3ec] bg-[#f8fafc] px-4 py-3">
              <Checkbox
                id="campaign-is-test"
                checked={batchForm.isTest}
                onCheckedChange={(checked) => setBatchForm((current) => ({ ...current, isTest: checked === true }))}
              />
              <Label htmlFor="campaign-is-test" className="cursor-pointer text-sm text-[#0A2540]">
                Marcar como campanha de teste interno
              </Label>
            </div>

            <div className="flex flex-wrap gap-3">
              <LoadingButton
                variant="outline"
                loading={validateBatchMutation.isPending}
                loadingLabel="A validar..."
                onClick={() => validateBatchMutation.mutate()}
                disabled={sendBatchMutation.isPending}
              >
                <ShieldAlert className="mr-2 h-4 w-4" />
                Validar números
              </LoadingButton>
              <LoadingButton
                loading={sendBatchMutation.isPending}
                loadingLabel="A enviar..."
                onClick={() => sendBatchMutation.mutate()}
              >
                <Send className="mr-2 h-4 w-4" />
                Enviar campanha
              </LoadingButton>
            </div>

            {validationResult ? <ValidationSummary result={validationResult} /> : null}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Teste Unitário</CardTitle>
            <CardDescription>
              Envia uma única mensagem SMS via backend e guarda tracking local para sync posterior.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="single-phone">Número</Label>
              <Input
                id="single-phone"
                value={singleForm.phone}
                onChange={(event) => setSingleForm((current) => ({ ...current, phone: event.target.value }))}
                placeholder="+244900000000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="single-remitter">Remitter ID</Label>
              <Input
                id="single-remitter"
                value={singleForm.remitterId}
                onChange={(event) => setSingleForm((current) => ({ ...current, remitterId: event.target.value }))}
                placeholder="uuid do remitter"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="single-message">Mensagem</Label>
              <Textarea
                id="single-message"
                value={singleForm.content}
                onChange={(event) => setSingleForm((current) => ({ ...current, content: event.target.value }))}
                placeholder="Mensagem unitária de teste"
                className="min-h-[140px]"
              />
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-[#dde3ec] bg-[#f8fafc] px-4 py-3">
              <Checkbox
                id="single-is-test"
                checked={singleForm.isTest}
                onCheckedChange={(checked) => setSingleForm((current) => ({ ...current, isTest: checked === true }))}
              />
              <Label htmlFor="single-is-test" className="cursor-pointer text-sm text-[#0A2540]">
                Guardar como envio de teste
              </Label>
            </div>

            <LoadingButton
              className="w-full"
              loading={singleSendMutation.isPending}
              loadingLabel="A enviar..."
              onClick={() => singleSendMutation.mutate()}
            >
              <Send className="mr-2 h-4 w-4" />
              Enviar teste unitário
            </LoadingButton>

            {lastSingleMessage ? (
              <div className="space-y-3 rounded-2xl border border-[#dde3ec] bg-[#f8fafc] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#0A2540]">Último envio unitário</p>
                    <p className="text-sm text-[#6b7e9a]">{lastSingleMessage.phoneNormalized}</p>
                  </div>
                  <Badge variant={getStatusVariant(lastSingleMessage.status)}>{lastSingleMessage.status}</Badge>
                </div>

                <div className="grid gap-3 text-sm">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6b7e9a]">Provider Message ID</div>
                    <div className="mt-1 font-mono text-xs text-[#0A2540]">{lastSingleMessage.providerMessageId || '—'}</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6b7e9a]">Erro / detalhe</div>
                    <div className="mt-1 text-[#0A2540]">{lastSingleMessage.providerErrorMessage || lastSingleMessage.providerStatus || '—'}</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6b7e9a]">Criada</div>
                    <div className="mt-1 text-[#0A2540]">{formatDateTime(lastSingleMessage.createdAt)}</div>
                  </div>
                </div>

                <LoadingButton
                  variant="outline"
                  className="w-full"
                  loading={syncMessageMutation.isPending}
                  loadingLabel="A sync..."
                  onClick={() => syncMessageMutation.mutate(lastSingleMessage.id)}
                  disabled={!lastSingleMessage.providerMessageId}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Sincronizar mensagem
                </LoadingButton>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <CardTitle>Histórico de Campanhas</CardTitle>
            <CardDescription>
              Campanhas locais com providerCampaignId, estado interno e ações de detalhe/sync.
            </CardDescription>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Input
              value={campaignSearch}
              onChange={(event) => {
                setCampaignPage(1);
                setCampaignSearch(event.target.value);
              }}
              placeholder="Pesquisar por nome, conteúdo ou provider ID..."
              className="sm:w-96"
            />
            <Button variant="outline" onClick={() => campaignsQuery.refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <CampaignHistoryTable
            campaigns={campaigns}
            isLoading={campaignsQuery.isLoading}
            isFetching={campaignsQuery.isFetching}
            error={campaignsQuery.isError}
            onRetry={() => campaignsQuery.refetch()}
            onView={(campaignId) => setCampaignInQuery(campaignId)}
            onSync={(campaignId) => syncCampaignMutation.mutate(campaignId)}
            syncingCampaignId={syncCampaignMutation.isPending ? syncCampaignMutation.variables : null}
          />

          {campaignsPagination ? (
            <div className="flex flex-col gap-3 border-t border-[#e5ebf3] pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-[#6b7e9a]">
                {campaignsPagination.total} campanha(s) registada(s)
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={campaignsPagination.page <= 1}
                  onClick={() => setCampaignPage((page) => Math.max(page - 1, 1))}
                >
                  Anterior
                </Button>
                <div className="text-sm text-[#6b7e9a]">
                  Página {campaignsPagination.page} de {campaignsPagination.totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={campaignsPagination.page >= campaignsPagination.totalPages}
                  onClick={() => setCampaignPage((page) => page + 1)}
                >
                  Próxima
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
