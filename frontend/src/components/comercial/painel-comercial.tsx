'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  CreditCard,
  DollarSign,
  Lock,
  PackageX,
  ShoppingCart,
  Store,
  TrendingDown,
  TrendingUp,
  Unlock,
} from 'lucide-react';
import { getCaixaSessaoAtual, getComercialAnalise, getComercialResumo, getCurrentUser } from '@/lib/api';
import type { User } from '@/lib/api';
import OnboardingChecklist from '@/components/onboarding/onboarding-checklist';
import WidgetWrapper from '@/components/dashboard/widget-wrapper';
import { BillingAccessBanner } from '@/components/billing/access-notice';
import { CommerceButton as Button } from '@/components/ui/button-commerce';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import {
  canAccessBilling,
  canAccessQuickSales,
  canCaixaOpen,
  canCaixaView,
  canComercialDashboardAnalysis,
  canComercialDashboardBasic,
  canFinanceTransactionsView,
  canStockView,
  canView,
} from '@/lib/permissions';

function formatKz(value: number) {
  return `${new Intl.NumberFormat('pt-PT').format(Math.round(value || 0))} Kz`;
}

function formatShortTime(value?: string | null) {
  if (!value) return '--:--';

  return new Date(value).toLocaleTimeString('pt-PT', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function CommercialSummaryCard({
  title,
  value,
  hint,
  icon: Icon,
  accentClass,
}: {
  title: string;
  value: string;
  hint?: string;
  icon: typeof TrendingUp;
  accentClass: string;
}) {
  return (
    <Card className="overflow-hidden border-slate-200 shadow-sm">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</p>
            <p className="mt-4 text-2xl font-black tracking-tight text-[#2c2f31]">{value}</p>
            {hint ? <p className="mt-2 text-xs text-slate-500">{hint}</p> : null}
          </div>
          <div className={`rounded-lg p-2 ${accentClass}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </div>
    </Card>
  );
}

function SummaryCardSkeleton() {
  return (
    <Card className="overflow-hidden border-slate-200 shadow-sm">
      <div className="flex animate-pulse flex-col gap-3 p-4">
        <div className="h-3 w-28 rounded-full bg-slate-200" />
        <div className="h-9 w-36 rounded-full bg-slate-200" />
        <div className="h-4 w-40 rounded-full bg-slate-200" />
      </div>
    </Card>
  );
}

function TopProdutosMesCard({
  items,
  isLoading,
  isError,
  onRetry,
}: {
  items: { productCode: string; productDescription: string; quantidadeTotal: number }[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  return (
    <Card className="border-slate-200 p-5 shadow-sm">
      <p className="text-base font-semibold text-[#2c2f31]">Top 3 do mês</p>
      <div className="mt-4">
        <WidgetWrapper
          title="top 3 do mês"
          isLoading={isLoading}
          error={isError}
          isEmpty={!isLoading && !isError && items.length === 0}
          onRetry={onRetry}
          className="border-0 bg-transparent p-0"
        >
          <div className="flex flex-col gap-3">
            {items.map((item, index) => (
              <div key={item.productCode} className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-[#2c2f31]">{index + 1}. {item.productDescription}</p>
                  <p className="text-xs text-slate-500">{item.productCode}</p>
                </div>
                <strong>{item.quantidadeTotal}</strong>
              </div>
            ))}
          </div>
        </WidgetWrapper>
      </div>
    </Card>
  );
}

function CaixaSessaoCard({
  canViewCaixa,
  sessao,
  isLoading,
  isError,
  onRetry,
}: {
  canViewCaixa: boolean;
  sessao: Awaited<ReturnType<typeof getCaixaSessaoAtual>>;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  if (!canViewCaixa) return null;

  return (
    <Card className="border-slate-200 p-5 shadow-sm">
      <p className="text-base font-semibold text-[#2c2f31]">Sessão caixa</p>
      <div className="mt-4">
        <WidgetWrapper
          title="sessão de caixa"
          isLoading={isLoading}
          error={isError}
          onRetry={onRetry}
          className="border-0 bg-transparent p-0"
        >
          {sessao?.status === 'open' ? (
            <div className="flex flex-col gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
              <Badge variant="success">Aberta</Badge>
              <div>
                <p className="text-sm font-medium text-[#2c2f31]">{sessao.estabelecimento?.nome || 'Sem estabelecimento'}</p>
                <p className="text-sm text-slate-600">
                  Aberta desde {formatShortTime(sessao.openedAt)} · {sessao.salesCount} vendas · {formatKz(sessao.totalSalesAmount)}
                </p>
              </div>
              <Button asChild variant="outline" className="justify-start gap-2">
                <Link href="/caixa">
                  <CreditCard className="h-4 w-4" />
                  Ir para Caixa
                </Link>
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <Badge variant="secondary">Fechada</Badge>
              <p className="text-sm text-slate-600">Sem sessão aberta neste momento.</p>
              <Button asChild variant="outline" className="justify-start gap-2">
                <Link href="/caixa">
                  <CreditCard className="h-4 w-4" />
                  Abrir área de Caixa
                </Link>
              </Button>
            </div>
          )}
        </WidgetWrapper>
      </div>
    </Card>
  );
}

function PainelAnalise() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['comercial-analise', { dias: 30 }],
    queryFn: () => getComercialAnalise({ dias: 30 }),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-40 animate-pulse rounded-lg bg-slate-100" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <ErrorState
        title="Não foi possível carregar a análise"
        message="Tenta novamente para ver o desempenho comercial detalhado."
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-slate-200 p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#2c2f31]">Análise comercial reforçada</p>
            <p className="mt-1 text-sm text-slate-500">
              Este painel continua como resumo rápido. A leitura completa agora vive na área dedicada de relatórios avançados.
            </p>
          </div>
          <Button asChild variant="outline" className="justify-start gap-2">
            <Link href="/relatorios/comercio">
              <BarChart3 className="h-4 w-4" />
              Abrir relatórios avançados
            </Link>
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="border-slate-200 p-5 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Performance</p>
        <div className="mt-4 flex flex-col gap-3 text-sm">
          <div className="flex items-center justify-between"><span className="text-slate-500">Total vendido</span><strong>{formatKz(data.totalVendas)}</strong></div>
          <div className="flex items-center justify-between"><span className="text-slate-500">Número de vendas</span><strong>{data.numVendas}</strong></div>
          <div className="flex items-center justify-between"><span className="text-slate-500">Ticket médio</span><strong>{formatKz(data.ticketMedio)}</strong></div>
        </div>
        </Card>

        <Card className="border-slate-200 p-5 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Top por quantidade</p>
        <div className="mt-4 flex flex-col gap-3">
          {data.topPorQuantidade.slice(0, 5).map((item) => (
            <div key={item.productCode} className="flex items-center justify-between gap-4 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-[#2c2f31]">{item.productDescription}</p>
                <p className="text-xs text-slate-500">{item.productCode}</p>
              </div>
              <strong>{item.quantidadeTotal}</strong>
            </div>
          ))}
          {data.topPorQuantidade.length === 0 ? <p className="text-sm text-slate-500">Sem vendas no período.</p> : null}
        </div>
        </Card>

        <Card className="border-slate-200 p-5 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Top por faturação</p>
        <div className="mt-4 flex flex-col gap-3">
          {data.topPorFacturacao.slice(0, 5).map((item) => (
            <div key={item.productCode} className="flex items-center justify-between gap-4 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-[#2c2f31]">{item.productDescription}</p>
                <p className="text-xs text-slate-500">{item.productCode}</p>
              </div>
              <strong>{formatKz(item.facturacaoTotal)}</strong>
            </div>
          ))}
          {data.topPorFacturacao.length === 0 ? <p className="text-sm text-slate-500">Sem faturação no período.</p> : null}
        </div>
        </Card>

        <Card className="border-slate-200 p-5 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Produtos parados</p>
        <div className="mt-4 flex flex-col gap-3">
          {data.produtosParados.slice(0, 5).map((produto) => (
            <div key={produto.id} className="flex items-center justify-between gap-4 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-[#2c2f31]">{produto.productDescription}</p>
                <p className="text-xs text-slate-500">{produto.productCode}</p>
              </div>
              <strong>{produto.stock ?? 0}</strong>
            </div>
          ))}
          {data.produtosParados.length === 0 ? <p className="text-sm text-slate-500">Todos os produtos tiveram rotação no período.</p> : null}
        </div>
        </Card>
      </div>
    </div>
  );
}

function PainelOperacionalReduzido({ currentUser }: { currentUser: User }) {
  const podeVerCaixa = canCaixaView(currentUser);
  const podeAbrirCaixa = podeVerCaixa && canCaixaOpen(currentUser);
  const podeVerVendasRapidas = canAccessQuickSales(currentUser);
  const podeVerProdutos = canStockView(currentUser);
  const podeVerContactos = canView(currentUser, 'contacts');
  const podeVerFinancas = canFinanceTransactionsView(currentUser);

  const {
    data: sessao = null,
    isLoading: loadingSessao,
  } = useQuery({
    queryKey: ['caixa-sessao-atual'],
    queryFn: () => getCaixaSessaoAtual(),
    enabled: podeVerCaixa,
    refetchInterval: 30_000,
  });

  const links = [
    podeVerCaixa ? { href: '/caixa', label: 'Ir para Caixa', icon: CreditCard } : null,
    podeVerVendasRapidas ? { href: '/vendas-rapidas', label: 'Ir para Venda Rápida', icon: ShoppingCart } : null,
    podeVerFinancas ? { href: '/finances', label: 'Abrir finanças', icon: DollarSign } : null,
    podeVerProdutos ? { href: '/produtos', label: 'Rever inventário', icon: PackageX } : null,
    podeVerContactos ? { href: '/contacts', label: 'Ver contactos', icon: Store } : null,
  ].filter(Boolean) as { href: string; label: string; icon: typeof CreditCard }[];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm text-slate-500">Olá, {currentUser.name}</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#2c2f31]">Painel operacional</h1>
          <p className="mt-1 text-sm text-slate-500">
            Área focada na operação do dia, sem métricas comerciais nem dados de faturação.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="border-slate-200 p-5 shadow-sm">
          <p className="text-base font-semibold text-[#2c2f31]">Estado operacional</p>

          {podeVerCaixa ? (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              {loadingSessao ? (
                <div className="space-y-2">
                  <div className="h-4 w-32 animate-pulse rounded-full bg-slate-200" />
                  <div className="h-4 w-48 animate-pulse rounded-full bg-slate-200" />
                </div>
              ) : sessao?.status === 'open' ? (
                <div className="space-y-2">
                  <Badge variant="success">Caixa aberto</Badge>
                  <p className="text-sm font-medium text-[#2c2f31]">{sessao.estabelecimento?.nome}</p>
                  <p className="text-sm text-slate-500">
                    Sessão ativa para operação e venda rápida.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Badge variant="secondary">Caixa fechado</Badge>
                  <p className="text-sm text-slate-500">
                    O caixa está encerrado. A venda rápida continua protegida até existir uma sessão aberta.
                  </p>
                  {podeAbrirCaixa ? (
                    <div className="inline-flex items-center gap-2 text-sm font-medium text-green-700">
                      <Unlock className="h-4 w-4" />
                      Pode abrir caixa na área de Caixa.
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-2 text-sm font-medium text-slate-500">
                      <Lock className="h-4 w-4" />
                      Sem permissão para abrir caixa.
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Não tens acesso à supervisão do caixa nesta conta.
            </div>
          )}
        </Card>

        <Card className="border-slate-200 p-5 shadow-sm">
          <p className="text-base font-semibold text-[#2c2f31]">Acessos rápidos</p>
          <div className="mt-4 grid gap-3">
            {links.map(({ href, label, icon: Icon }) => (
              <Button key={href} asChild variant="outline" className="justify-start gap-2">
                <Link href={href}>
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              </Button>
            ))}
            {links.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                Não há atalhos operacionais disponíveis para este perfil no momento.
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function PainelComercialPage({ currentUser: currentUserProp }: { currentUser?: User }) {
  const [modo, setModo] = useState<'resumo' | 'analise'>('resumo');
  const {
    data: fetchedCurrentUser,
    isLoading: loadingUser,
  } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
    retry: false,
    enabled: !currentUserProp,
  });

  const currentUser = currentUserProp ?? fetchedCurrentUser;

  const podeResumo = currentUser ? canComercialDashboardBasic(currentUser) : false;
  const podeAnalise = currentUser ? canComercialDashboardAnalysis(currentUser) : false;
  const podeVerVendas = currentUser ? canView(currentUser, 'vendas') : false;
  const podeVerProdutos = currentUser ? canStockView(currentUser) : false;
  const podeVerFaturacao = currentUser ? canAccessBilling(currentUser) : false;
  const podeVerCaixa = currentUser ? canCaixaView(currentUser) : false;

  const {
    data: resumo,
    isLoading: resumoLoading,
    isError: resumoError,
    refetch: refetchResumo,
  } = useQuery({
    queryKey: ['comercial-resumo'],
    queryFn: getComercialResumo,
    refetchInterval: 60_000,
    enabled: !!currentUser && podeResumo,
  });

  const {
    data: sessao = null,
    isLoading: sessaoLoading,
    isError: sessaoError,
    refetch: refetchSessao,
  } = useQuery({
    queryKey: ['caixa-sessao-atual', 'dashboard'],
    queryFn: () => getCaixaSessaoAtual(),
    enabled: !!currentUser && podeResumo && podeVerCaixa,
    refetchInterval: 30_000,
  });

  if (loadingUser) {
    return (
      <div className="mx-auto max-w-6xl p-4 md:p-6">
        <div className="space-y-4">
          <div className="h-8 w-64 animate-pulse rounded-full bg-slate-200" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-36 animate-pulse rounded-2xl bg-slate-200" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (currentUser && !podeResumo) {
    return <PainelOperacionalReduzido currentUser={currentUser} />;
  }

  const variacaoHoje = resumo?.variacao ?? 0;
  const variacaoLabel = variacaoHoje > 0
    ? `+${variacaoHoje}% vs ontem`
    : `${variacaoHoje}% vs ontem`;
  const variacaoSemana = resumo?.variacaoSemana ?? 0;
  const variacaoSemanaLabel = variacaoSemana > 0
    ? `+${variacaoSemana}% vs semana anterior`
    : `${variacaoSemana}% vs semana anterior`;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm text-slate-500">Olá, {currentUser?.name || 'utilizador'}</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#2c2f31]">Painel comercial</h1>
          <p className="mt-1 text-sm text-slate-500">
            {new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
          {podeAnalise ? (
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
            <button
              type="button"
              onClick={() => setModo('resumo')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${modo === 'resumo' ? 'bg-[#B84D0E] text-white' : 'text-slate-500 hover:bg-orange-50 hover:text-[#B84D0E]'}`}
            >
              Resumo
            </button>
            <button
              type="button"
              onClick={() => setModo('analise')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${modo === 'analise' ? 'bg-[#B84D0E] text-white' : 'text-slate-500 hover:bg-orange-50 hover:text-[#B84D0E]'}`}
            >
              Análise
            </button>
          </div>
          ) : null}
        </div>
      </div>

      <BillingAccessBanner subscription={currentUser?.subscription} />
      <OnboardingChecklist currentUser={currentUser} />

      {modo === 'analise' && podeAnalise ? (
        <PainelAnalise />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {resumoLoading ? (
              Array.from({ length: 4 }).map((_, index) => <SummaryCardSkeleton key={index} />)
            ) : resumoError || !resumo ? (
              <div className="md:col-span-2 xl:col-span-4">
                <ErrorState
                  compact
                  title="Não foi possível carregar o resumo comercial"
                  message="Tenta novamente para ver os indicadores principais."
                  onRetry={() => refetchResumo()}
                />
              </div>
            ) : (
              <>
                <CommercialSummaryCard
                  title="Total Hoje"
                  value={formatKz(resumo.totalHoje)}
                  hint={variacaoLabel}
                  icon={variacaoHoje >= 0 ? TrendingUp : TrendingDown}
                  accentClass={variacaoHoje >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}
                />
                <CommercialSummaryCard
                  title="Vendas Hoje"
                  value={String(resumo.vendasHoje)}
                  hint={resumo.estabelecimentoDestaque ? `Destaque: ${resumo.estabelecimentoDestaque.nome}` : 'Sem destaque ainda'}
                  icon={ShoppingCart}
                  accentClass="bg-blue-100 text-blue-700"
                />
                <CommercialSummaryCard
                  title="Receita Semana"
                  value={formatKz(resumo.totalSemanaActual)}
                  hint={variacaoSemanaLabel}
                  icon={variacaoSemana >= 0 ? TrendingUp : TrendingDown}
                  accentClass={variacaoSemana >= 0 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}
                />
                <CommercialSummaryCard
                  title="Stock Baixo"
                  value={String(resumo.stockAlertaCount)}
                  hint={resumo.stockAlertaCount > 0 ? 'Ver produtos com alerta' : 'Inventário sem alertas'}
                  icon={PackageX}
                  accentClass="bg-slate-100 text-slate-700"
                />
              </>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <Card className="border-slate-200 p-5 shadow-sm">
              <p className="text-base font-semibold text-[#2c2f31]">Ações rápidas</p>
              <div className="mt-4 grid gap-3">
                {podeVerVendas ? (
                  <Button asChild className="justify-start gap-2">
                    <Link href="/vendas-rapidas">
                      <ShoppingCart className="h-4 w-4" />
                      Ir para Venda Rápida
                    </Link>
                  </Button>
                ) : null}
                {podeVerProdutos ? (
                  <Button asChild variant="outline" className="justify-start gap-2">
                    <Link href="/produtos">
                      <PackageX className="h-4 w-4" />
                      Rever inventário
                    </Link>
                  </Button>
                ) : null}
                {podeVerFaturacao ? (
                  <Button asChild variant="outline" className="justify-start gap-2">
                    <Link href="/vendas">
                      <BarChart3 className="h-4 w-4" />
                      Abrir faturação
                    </Link>
                  </Button>
                ) : null}
                {!podeVerVendas && !podeVerFaturacao ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    Não há ações rápidas comerciais disponíveis para este perfil.
                  </div>
                ) : null}
              </div>
            </Card>
          </div>

          <div className={`grid grid-cols-1 gap-4 ${podeVerCaixa ? 'xl:grid-cols-2' : ''}`}>
            <CaixaSessaoCard
              canViewCaixa={podeVerCaixa}
              sessao={sessao}
              isLoading={sessaoLoading}
              isError={sessaoError}
              onRetry={() => refetchSessao()}
            />

            <TopProdutosMesCard
              items={resumo?.top3MesPorQuantidade ?? []}
              isLoading={resumoLoading}
              isError={resumoError}
              onRetry={() => refetchResumo()}
            />
          </div>
        </>
      )}
    </div>
  );
}
