'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Banknote, CreditCard, History, Lock, RefreshCw,
  Store, TrendingUp, Unlock, Wallet,
} from 'lucide-react';
import { abrirCaixaSessao, fecharCaixaSessao, getCaixaSessaoAtual, getCaixaSessoes, getCurrentUser, getEstabelecimentos } from '@/lib/api';
import type { CaixaSessao, Estabelecimento } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { canCaixaAudit, canCaixaClose, canCaixaOpen, canCaixaView } from '@/lib/permissions';
import { cn } from '@/lib/utils';

const HISTORY_PAGE_SIZE = 10;
const HISTORY_FETCH_LIMIT = 100;

function formatKz(value: number) {
  return `${value.toLocaleString('pt-AO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kz`;
}

function formatDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-AO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatTime(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('pt-AO', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function resolveInitialEstabelecimentoId(estabs: Estabelecimento[]) {
  const principalWithSerie = estabs.find((e) => e.isPrincipal && e.defaultSerieId);
  const firstWithSerie = estabs.find((e) => e.defaultSerieId);
  const fallback = estabs[0] ?? null;

  return principalWithSerie?.id || firstWithSerie?.id || fallback?.id || '';
}

function matchesDate(value: string, iso: string) {
  return new Date(iso).toLocaleDateString('sv-SE') === value;
}

function SessionStatCard({
  title,
  value,
  icon: Icon,
  accentClass,
  hint,
}: {
  title: string;
  value: string;
  icon: typeof Wallet;
  accentClass: string;
  hint?: string;
}) {
  return (
    <Card className="border-slate-200 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{title}</p>
          <p className="mt-3 text-2xl font-black tracking-tight text-[#2c2f31]">{value}</p>
          {hint ? <p className="mt-2 text-sm text-slate-500">{hint}</p> : null}
        </div>
        <div className={cn('rounded-2xl p-3', accentClass)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

export default function CaixaPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'sessao' | 'historico' | 'auditoria'>('sessao');
  const [showAbrirCaixa, setShowAbrirCaixa] = useState(false);
  const [showFecharCaixa, setShowFecharCaixa] = useState(false);
  const [abrirEstabelecimentoId, setAbrirEstabelecimentoId] = useState('');
  const [abrirBalance, setAbrirBalance] = useState<number | ''>('');
  const [abrirNotes, setAbrirNotes] = useState('');
  const [abrirErr, setAbrirErr] = useState('');
  const [fecharCounted, setFecharCounted] = useState<number | ''>('');
  const [fecharNotes, setFecharNotes] = useState('');
  const [fecharErr, setFecharErr] = useState('');
  const [historyDate, setHistoryDate] = useState('');
  const [historyStatus, setHistoryStatus] = useState<'all' | 'open' | 'closed'>('all');
  const [historyEstabelecimentoId, setHistoryEstabelecimentoId] = useState('all');
  const [historyPage, setHistoryPage] = useState(1);
  const abrirSelectionTouchedRef = useRef(false);
  const initialTabResolvedRef = useRef(false);
  const { data: currentUser, isLoading: loadingUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
    retry: false,
  });
  const podeVerCaixa = currentUser ? canCaixaView(currentUser) : false;
  const podeAbrirCaixa = currentUser ? canCaixaOpen(currentUser) : false;
  const podeFecharCaixa = currentUser ? canCaixaClose(currentUser) : false;
  const podeAuditarCaixa = currentUser ? canCaixaAudit(currentUser) : false;

  const {
    data: estabelecimentos = [],
    isLoading: loadingEstabelecimentos,
    isError: estabelecimentosError,
  } = useQuery({
    queryKey: ['estabelecimentos'],
    queryFn: getEstabelecimentos,
    retry: false,
    enabled: !!currentUser && podeVerCaixa,
  });

  const {
    data: sessao = null,
    isLoading: loadingSessao,
    isError: sessaoError,
    refetch: refetchSessao,
  } = useQuery<CaixaSessao | null>({
    queryKey: ['caixa-sessao-atual'],
    queryFn: () => getCaixaSessaoAtual(),
    retry: false,
    refetchInterval: activeTab === 'sessao' ? 30_000 : false,
    enabled: !!currentUser && podeVerCaixa,
  });

  const {
    data: historico,
    isLoading: loadingHistorico,
    isError: historicoError,
    refetch: refetchHistorico,
  } = useQuery({
    queryKey: ['caixa-sessoes', {
      status: activeTab === 'auditoria' ? 'closed' : historyStatus,
      estabelecimentoId: historyEstabelecimentoId,
      limit: HISTORY_FETCH_LIMIT,
    }],
    queryFn: () => getCaixaSessoes({
      status: activeTab === 'auditoria'
        ? 'closed'
        : historyStatus === 'all'
        ? undefined
        : historyStatus,
      estabelecimentoId: historyEstabelecimentoId === 'all' ? undefined : historyEstabelecimentoId,
      page: 1,
      limit: HISTORY_FETCH_LIMIT,
    }),
    enabled: !!currentUser && podeVerCaixa && podeAuditarCaixa && activeTab !== 'sessao',
  });

  const sessaoAberta = sessao?.status === 'open';
  const abrirEstabelecimento = estabelecimentos.find((item) => item.id === abrirEstabelecimentoId) ?? null;
  const hasSelectableEstabelecimento = estabelecimentos.some((item) => Boolean(item.defaultSerieId));
  const expectedClosing = sessao ? sessao.openingBalance + sessao.totalSalesAmount : 0;
  const diferencaPreview = fecharCounted !== '' ? Number(fecharCounted) - expectedClosing : null;

  const historicoFiltrado = (historico?.sessoes ?? []).filter((item) => {
    if (!historyDate) return true;
    return matchesDate(historyDate, item.openedAt);
  });
  const auditoriaRows = historicoFiltrado.filter((item) => item.status === 'closed');
  const auditoriaComDiferenca = auditoriaRows.filter((item) => (item.differenceAmount ?? 0) !== 0);
  const auditoriaConferidas = auditoriaRows.filter((item) => item.differenceAmount === 0);
  const auditoriaSemContagem = auditoriaRows.filter((item) => item.closingCountedAmount == null);
  const totalExcesso = auditoriaComDiferenca
    .filter((item) => (item.differenceAmount ?? 0) > 0)
    .reduce((sum, item) => sum + (item.differenceAmount ?? 0), 0);
  const totalEmFalta = auditoriaComDiferenca
    .filter((item) => (item.differenceAmount ?? 0) < 0)
    .reduce((sum, item) => sum + Math.abs(item.differenceAmount ?? 0), 0);
  const totalPages = Math.max(1, Math.ceil(historicoFiltrado.length / HISTORY_PAGE_SIZE));
  const historicoVisivel = historicoFiltrado.slice(
    (historyPage - 1) * HISTORY_PAGE_SIZE,
    historyPage * HISTORY_PAGE_SIZE
  );

  useEffect(() => {
    const initial = resolveInitialEstabelecimentoId(estabelecimentos);
    const selectedStillValid = estabelecimentos.some((item) => item.id === abrirEstabelecimentoId);

    if ((!selectedStillValid && abrirEstabelecimentoId !== initial) ||
      (!abrirSelectionTouchedRef.current && initial && abrirEstabelecimentoId !== initial)) {
      setAbrirEstabelecimentoId(initial);
    }
  }, [abrirEstabelecimentoId, estabelecimentos]);

  useEffect(() => {
    setHistoryPage(1);
  }, [historyDate, historyEstabelecimentoId, historyStatus]);

  useEffect(() => {
    if (historyPage > totalPages) {
      setHistoryPage(totalPages);
    }
  }, [historyPage, totalPages]);

  useEffect(() => {
    if ((activeTab === 'historico' || activeTab === 'auditoria') && !podeAuditarCaixa) {
      setActiveTab('sessao');
    }
  }, [activeTab, podeAuditarCaixa]);

  useEffect(() => {
    if (initialTabResolvedRef.current || loadingUser || loadingSessao) return;
    if (!currentUser) return;

    if (podeAuditarCaixa && !sessaoAberta) {
      setActiveTab('historico');
    }

    initialTabResolvedRef.current = true;
  }, [currentUser, loadingSessao, loadingUser, podeAuditarCaixa, sessaoAberta]);

  const abrirMutation = useMutation({
    mutationFn: () => abrirCaixaSessao({
      estabelecimentoId: abrirEstabelecimentoId,
      openingBalance: Number(abrirBalance) || 0,
      notes: abrirNotes || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caixa-sessao-atual'] });
      queryClient.invalidateQueries({ queryKey: ['caixa-sessoes'] });
      setShowAbrirCaixa(false);
      setAbrirBalance('');
      setAbrirNotes('');
      setAbrirErr('');
      setActiveTab('sessao');
    },
    onError: (error: Error) => setAbrirErr(error.message),
  });

  const fecharMutation = useMutation({
    mutationFn: () => fecharCaixaSessao(sessao!.id, {
      closingCountedAmount: fecharCounted !== '' ? Number(fecharCounted) : undefined,
      notes: fecharNotes || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caixa-sessao-atual'] });
      queryClient.invalidateQueries({ queryKey: ['caixa-sessoes'] });
      setShowFecharCaixa(false);
      setFecharCounted('');
      setFecharNotes('');
      setFecharErr('');
      setActiveTab(podeAuditarCaixa ? 'historico' : 'sessao');
    },
    onError: (error: Error) => setFecharErr(error.message),
  });

  if (loadingUser || (loadingSessao && activeTab === 'sessao')) {
    return (
      <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
        <div className="h-8 w-48 animate-pulse rounded-full bg-slate-200" />
        <div className="h-36 animate-pulse rounded-3xl bg-slate-200" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-2xl bg-slate-200" />
          ))}
        </div>
      </div>
    );
  }

  if (currentUser && !podeVerCaixa) {
    return (
      <div className="mx-auto max-w-6xl p-4 md:p-6">
        <ErrorState
          title="Acesso restrito"
          message="Não tem permissão para ver o estado do caixa desta conta."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#2c2f31]">Caixa</h1>
          <p className="mt-1 text-sm text-slate-500">
            Controle a sessão atual, acompanhe totais e reveja o histórico recente do ponto de venda.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => {
              if (activeTab === 'historico' || activeTab === 'auditoria') {
                refetchHistorico();
                return;
              }
              refetchSessao();
            }}
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>

          {sessaoAberta && podeFecharCaixa ? (
            <Button variant="destructive" className="gap-2" onClick={() => { setFecharErr(''); setShowFecharCaixa(true); }}>
              <Lock className="h-4 w-4" />
              Fechar Caixa
            </Button>
          ) : !sessaoAberta && podeAbrirCaixa ? (
            <Button className="gap-2 bg-green-600 text-white hover:bg-green-700" onClick={() => { setAbrirErr(''); setShowAbrirCaixa(true); }}>
              <Unlock className="h-4 w-4" />
              Abrir Caixa
            </Button>
          ) : null}
        </div>
      </div>

      <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setActiveTab('sessao')}
          className={cn(
            'rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
            activeTab === 'sessao' ? 'bg-[#0A2540] text-white' : 'text-slate-600 hover:bg-slate-100'
          )}
        >
          Sessão Atual
        </button>
        {podeAuditarCaixa ? (
          <>
            <button
              type="button"
              onClick={() => setActiveTab('historico')}
              className={cn(
                'rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
                activeTab === 'historico' ? 'bg-[#0A2540] text-white' : 'text-slate-600 hover:bg-slate-100'
              )}
            >
              Histórico
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('auditoria')}
              className={cn(
                'rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
                activeTab === 'auditoria' ? 'bg-[#0A2540] text-white' : 'text-slate-600 hover:bg-slate-100'
              )}
            >
              Auditoria
            </button>
          </>
        ) : null}
      </div>

      {podeAuditarCaixa ? (
        <p className="text-xs text-slate-500">
          Perfis de supervisão podem rever histórico e auditoria mesmo sem uma sessão aberta neste momento.
        </p>
      ) : null}

      {activeTab === 'sessao' ? (
        <>
          {sessaoError ? (
            <ErrorState
              title="Não foi possível carregar a sessão de caixa"
              message="Tenta novamente para ver o estado atual do caixa."
              onRetry={() => refetchSessao()}
            />
          ) : (
            <>
              <Card className={cn(
                'overflow-hidden border p-5 shadow-sm',
                sessaoAberta ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'
              )}>
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant={sessaoAberta ? 'success' : 'destructive'}>
                        {sessaoAberta ? 'Caixa aberto' : 'Caixa fechado'}
                      </Badge>
                      {sessao?.estabelecimento?.nome ? (
                        <span className="text-sm font-medium text-slate-700">
                          {sessao.estabelecimento.nome}
                        </span>
                      ) : null}
                    </div>
                    <h2 className="mt-3 text-xl font-bold text-[#2c2f31]">
                      {sessaoAberta ? 'Sessão em operação' : 'Nenhuma sessão aberta neste utilizador'}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {sessaoAberta
                        ? `Aberto às ${formatTime(sessao?.openedAt)} por ${sessao?.openedBy?.name || 'utilizador atual'}.`
                        : 'Abra o caixa para começar a registar movimento, acompanhar totais e liberar a venda rápida.'}
                    </p>
                  </div>

                  {!sessaoAberta && podeAbrirCaixa ? (
                    <Button className="gap-2 bg-green-600 text-white hover:bg-green-700" onClick={() => { setAbrirErr(''); setShowAbrirCaixa(true); }}>
                      <Unlock className="h-4 w-4" />
                      Abrir Caixa
                    </Button>
                  ) : null}
                </div>
              </Card>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <SessionStatCard
                  title="Total Vendido"
                  value={formatKz(sessao?.totalSalesAmount ?? 0)}
                  hint={sessaoAberta ? 'Acumulado da sessão aberta' : 'Sem sessão ativa no momento'}
                  icon={TrendingUp}
                  accentClass="bg-emerald-100 text-emerald-700"
                />
                <SessionStatCard
                  title="Nº de Vendas"
                  value={String(sessao?.salesCount ?? 0)}
                  hint="Faturas ligadas à sessão"
                  icon={History}
                  accentClass="bg-blue-100 text-blue-700"
                />
                <SessionStatCard
                  title="Numerário"
                  value={formatKz(sessao?.totalCash ?? 0)}
                  hint="Pagamentos em dinheiro"
                  icon={Banknote}
                  accentClass="bg-amber-100 text-amber-700"
                />
                <SessionStatCard
                  title="Multicaixa"
                  value={formatKz(sessao?.totalMulticaixa ?? 0)}
                  hint="Pagamentos eletrónicos"
                  icon={CreditCard}
                  accentClass="bg-violet-100 text-violet-700"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                <Card className="border-slate-200 p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Resumo Operacional</p>
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Saldo inicial</span>
                      <strong>{formatKz(sessao?.openingBalance ?? 0)}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Transferência</span>
                      <strong>{formatKz(sessao?.totalTransferencia ?? 0)}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Esperado em caixa</span>
                      <strong>{formatKz(expectedClosing)}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Última abertura</span>
                      <strong>{formatDate(sessao?.openedAt)} às {formatTime(sessao?.openedAt)}</strong>
                    </div>
                  </div>
                </Card>

                <Card className="border-slate-200 p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Observações</p>
                  <div className="mt-4 space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                      {sessao?.notes?.trim() || 'Sem observações registadas nesta sessão.'}
                    </div>

                    {!sessaoAberta && (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        A emissão em <Link href="/vendas-rapidas" className="font-semibold underline">Venda Rápida</Link> só fica disponível depois da abertura do caixa.
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            </>
          )}
        </>
      ) : activeTab === 'historico' ? (
        <>
          <Card className="border-slate-200 p-5 shadow-sm">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <Label className="text-sm">Data</Label>
                <Input
                  type="date"
                  value={historyDate}
                  onChange={(event) => setHistoryDate(event.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-sm">Ponto de Venda</Label>
                <Select value={historyEstabelecimentoId} onValueChange={setHistoryEstabelecimentoId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Todos os pontos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os pontos</SelectItem>
                    {estabelecimentos.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm">Estado</Label>
                <Select value={historyStatus} onValueChange={(value: 'all' | 'open' | 'closed') => setHistoryStatus(value)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="open">Abertos</SelectItem>
                    <SelectItem value="closed">Fechados</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
              <p className="text-slate-500">
                Histórico recente com paginação local nas últimas {HISTORY_FETCH_LIMIT} sessões.
              </p>
              <p className="font-medium text-slate-700">
                {historicoFiltrado.length} sessão{historicoFiltrado.length !== 1 ? 'ões' : ''} encontrada{historicoFiltrado.length !== 1 ? 's' : ''}
              </p>
            </div>

            {estabelecimentosError ? (
              <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Não foi possível carregar a lista de pontos de venda para o filtro. Ainda assim, o histórico continua disponível.
              </p>
            ) : null}
          </Card>

          {historicoError ? (
            <ErrorState
              title="Não foi possível carregar o histórico do caixa"
              message="Tenta novamente para rever as sessões recentes."
              onRetry={() => refetchHistorico()}
            />
          ) : (
            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Estabelecimento</TableHead>
                    <TableHead>Abertura</TableHead>
                    <TableHead>Fecho</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Diferença</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingHistorico ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-slate-500">
                        A carregar histórico...
                      </TableCell>
                    </TableRow>
                  ) : historicoVisivel.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-slate-500">
                        Não há sessões para os filtros atuais.
                      </TableCell>
                    </TableRow>
                  ) : (
                    historicoVisivel.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{formatDate(item.openedAt)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Store className="h-4 w-4 text-slate-400" />
                            <span>{item.estabelecimento?.nome || 'Sem ponto de venda'}</span>
                          </div>
                        </TableCell>
                        <TableCell>{formatTime(item.openedAt)}</TableCell>
                        <TableCell>{formatTime(item.closedAt)}</TableCell>
                        <TableCell className="font-semibold">{formatKz(item.totalSalesAmount)}</TableCell>
                        <TableCell className={cn(
                          'font-medium',
                          item.differenceAmount == null
                            ? 'text-slate-500'
                            : item.differenceAmount === 0
                            ? 'text-emerald-600'
                            : item.differenceAmount > 0
                            ? 'text-blue-600'
                            : 'text-red-600'
                        )}>
                          {item.differenceAmount == null ? '—' : formatKz(item.differenceAmount)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.status === 'open' ? 'success' : 'secondary'}>
                            {item.status === 'open' ? 'Aberto' : 'Fechado'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 text-sm md:flex-row md:items-center md:justify-between">
                <p className="text-slate-500">
                  Página {historyPage} de {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setHistoryPage((page) => Math.max(1, page - 1))} disabled={historyPage === 1}>
                    Anterior
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setHistoryPage((page) => Math.min(totalPages, page + 1))} disabled={historyPage === totalPages}>
                    Próxima
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </>
      ) : (
        <>
          <Card className="border-slate-200 p-5 shadow-sm">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Sessões Conferidas</p>
                <p className="mt-3 text-2xl font-black tracking-tight text-[#2c2f31]">{auditoriaConferidas.length}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Com Diferença</p>
                <p className="mt-3 text-2xl font-black tracking-tight text-[#2c2f31]">{auditoriaComDiferenca.length}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Excesso</p>
                <p className="mt-3 text-2xl font-black tracking-tight text-blue-700">{formatKz(totalExcesso)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Em Falta</p>
                <p className="mt-3 text-2xl font-black tracking-tight text-red-600">{formatKz(totalEmFalta)}</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <Label className="text-sm">Data</Label>
                <Input
                  type="date"
                  value={historyDate}
                  onChange={(event) => setHistoryDate(event.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-sm">Ponto de Venda</Label>
                <Select value={historyEstabelecimentoId} onValueChange={setHistoryEstabelecimentoId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Todos os pontos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os pontos</SelectItem>
                    {estabelecimentos.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  {auditoriaSemContagem.length} sessão{auditoriaSemContagem.length !== 1 ? 'ões' : ''} fechada{auditoriaSemContagem.length !== 1 ? 's' : ''} sem contagem final.
                </div>
              </div>
            </div>
          </Card>

          {historicoError ? (
            <ErrorState
              title="Não foi possível carregar a auditoria"
              message="Tenta novamente para rever diferenças de fecho e conferência do caixa."
              onRetry={() => refetchHistorico()}
            />
          ) : (
            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Estabelecimento</TableHead>
                    <TableHead>Esperado</TableHead>
                    <TableHead>Contado</TableHead>
                    <TableHead>Diferença</TableHead>
                    <TableHead>Fechado Por</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingHistorico ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-slate-500">
                        A carregar auditoria...
                      </TableCell>
                    </TableRow>
                  ) : auditoriaRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-slate-500">
                        Não há sessões fechadas para os filtros atuais.
                      </TableCell>
                    </TableRow>
                  ) : (
                    auditoriaRows.map((item) => {
                      const difference = item.differenceAmount;
                      const badgeVariant =
                        difference == null ? 'secondary' :
                        difference === 0 ? 'success' :
                        'destructive';

                      return (
                        <TableRow key={item.id}>
                          <TableCell>{formatDate(item.closedAt || item.openedAt)}</TableCell>
                          <TableCell>{item.estabelecimento?.nome || 'Sem ponto de venda'}</TableCell>
                          <TableCell className="font-medium">{formatKz(item.expectedClosingAmount ?? 0)}</TableCell>
                          <TableCell>{item.closingCountedAmount == null ? '—' : formatKz(item.closingCountedAmount)}</TableCell>
                          <TableCell className={cn(
                            'font-medium',
                            difference == null
                              ? 'text-slate-500'
                              : difference === 0
                              ? 'text-emerald-600'
                              : difference > 0
                              ? 'text-blue-600'
                              : 'text-red-600'
                          )}>
                            {difference == null ? '—' : formatKz(difference)}
                          </TableCell>
                          <TableCell>{item.closedBy?.name || '—'}</TableCell>
                          <TableCell>
                            <Badge variant={badgeVariant}>
                              {difference == null ? 'Sem contagem' : difference === 0 ? 'Conferido' : 'Diferença'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </Card>
          )}
        </>
      )}

      <Dialog open={podeAbrirCaixa && showAbrirCaixa} onOpenChange={(open) => { if (!open) setShowAbrirCaixa(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Unlock className="h-4 w-4 text-green-600" />
              Abrir Caixa
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {abrirErr ? <p className="text-sm text-red-600">{abrirErr}</p> : null}

            <div>
              <Label className="text-sm">Ponto de Venda *</Label>
              <Select
                value={abrirEstabelecimentoId}
                onValueChange={(value) => {
                  abrirSelectionTouchedRef.current = true;
                  setAbrirEstabelecimentoId(value);
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  {estabelecimentos.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.nome}{!item.defaultSerieId ? ' · sem série' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {estabelecimentosError ? (
                <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  Não foi possível carregar os pontos de venda.
                </p>
              ) : null}

              {!estabelecimentosError && !loadingEstabelecimentos && estabelecimentos.length === 0 ? (
                <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Ainda não existem pontos de venda. Crie o primeiro em{' '}
                  <Link href="/configuracoes?tab=empresa&section=faturacao" className="font-medium underline">
                    Configurações → Empresa → Configuração Fiscal
                  </Link>.
                </p>
              ) : null}

              {!estabelecimentosError && estabelecimentos.length > 0 && !hasSelectableEstabelecimento ? (
                <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Os pontos de venda já existem, mas ainda não têm série padrão. Pode abrir o caixa, porém a emissão só ficará disponível após configurar a série.
                </p>
              ) : null}

              {!estabelecimentosError && abrirEstabelecimento && !abrirEstabelecimento.defaultSerieId ? (
                <p className="mt-2 text-xs text-amber-700">
                  Este ponto de venda está sem série padrão no momento.
                </p>
              ) : null}
            </div>

            <div>
              <Label className="text-sm">Saldo inicial (Kz)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={abrirBalance}
                onChange={(event) => setAbrirBalance(event.target.value === '' ? '' : Number(event.target.value))}
                placeholder="0,00"
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-sm">Observação</Label>
              <Input
                value={abrirNotes}
                onChange={(event) => setAbrirNotes(event.target.value)}
                placeholder="opcional"
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAbrirCaixa(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => abrirMutation.mutate()}
              disabled={abrirMutation.isPending || !abrirEstabelecimentoId}
              className="bg-green-600 text-white hover:bg-green-700"
            >
              {abrirMutation.isPending ? 'A abrir...' : 'Abrir caixa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={podeFecharCaixa && showFecharCaixa} onOpenChange={(open) => { if (!open) setShowFecharCaixa(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-red-600" />
              Fechar Caixa
            </DialogTitle>
          </DialogHeader>

          {sessao ? (
            <div className="space-y-4 py-2">
              {fecharErr ? <p className="text-sm text-red-600">{fecharErr}</p> : null}

              <div className="rounded-lg border border-slate-200 bg-slate-50 text-sm">
                <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
                  <span className="text-slate-500">Saldo inicial</span>
                  <span className="font-medium">{formatKz(sessao.openingBalance)}</span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
                  <span className="text-slate-500">Total vendido</span>
                  <span className="font-medium text-emerald-700">{formatKz(sessao.totalSalesAmount)}</span>
                </div>
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-slate-500">Esperado em caixa</span>
                  <span className="font-semibold">{formatKz(expectedClosing)}</span>
                </div>
              </div>

              <div>
                <Label className="text-sm">Valor contado (Kz)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={fecharCounted}
                  onChange={(event) => setFecharCounted(event.target.value === '' ? '' : Number(event.target.value))}
                  placeholder={formatKz(expectedClosing)}
                  className="mt-1"
                />
                {diferencaPreview != null ? (
                  <p className={cn(
                    'mt-1 text-xs font-medium',
                    diferencaPreview === 0 ? 'text-emerald-600' : diferencaPreview > 0 ? 'text-blue-600' : 'text-red-600'
                  )}>
                    Diferença: {diferencaPreview > 0 ? '+' : ''}{formatKz(diferencaPreview)}
                  </p>
                ) : null}
              </div>

              <div>
                <Label className="text-sm">Observação</Label>
                <Input
                  value={fecharNotes}
                  onChange={(event) => setFecharNotes(event.target.value)}
                  placeholder="opcional"
                  className="mt-1"
                />
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFecharCaixa(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => fecharMutation.mutate()} disabled={fecharMutation.isPending || !sessao}>
              {fecharMutation.isPending ? 'A fechar...' : 'Confirmar fecho'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
