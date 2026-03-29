'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, PackageX, ShoppingCart, TrendingDown, TrendingUp, Trophy } from 'lucide-react';
import { getComercialAnalise, getComercialInsights, getComercialResumo, getCurrentUser } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';

function formatKz(value: number) {
  return `${value.toLocaleString('pt-AO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kz`;
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
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{title}</p>
            <p className="mt-3 text-2xl font-black tracking-tight text-[#2c2f31]">{value}</p>
            {hint ? <p className="mt-2 text-sm text-slate-500">{hint}</p> : null}
          </div>
          <div className={`rounded-2xl p-3 ${accentClass}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
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
          <div key={index} className="h-40 animate-pulse rounded-2xl bg-slate-200" />
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
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="border-slate-200 p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Performance</p>
        <div className="mt-4 space-y-3 text-sm">
          <div className="flex items-center justify-between"><span className="text-slate-500">Total vendido</span><strong>{formatKz(data.totalVendas)}</strong></div>
          <div className="flex items-center justify-between"><span className="text-slate-500">Número de vendas</span><strong>{data.numVendas}</strong></div>
          <div className="flex items-center justify-between"><span className="text-slate-500">Ticket médio</span><strong>{formatKz(data.ticketMedio)}</strong></div>
        </div>
      </Card>

      <Card className="border-slate-200 p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Top por Quantidade</p>
        <div className="mt-4 space-y-3">
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
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Top por Faturação</p>
        <div className="mt-4 space-y-3">
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
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Produtos Parados</p>
        <div className="mt-4 space-y-3">
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
  );
}

export default function PainelComercialPage() {
  const [modo, setModo] = useState<'resumo' | 'analise'>('resumo');
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
    retry: false,
  });

  const podeAnalise = !!(currentUser?.isSuperAdmin || currentUser?.role === 'admin' || !currentUser?.accountOwnerId);

  const {
    data: resumo,
    isLoading: resumoLoading,
    isError: resumoError,
    refetch: refetchResumo,
  } = useQuery({
    queryKey: ['comercial-resumo'],
    queryFn: getComercialResumo,
    refetchInterval: 60_000,
  });

  const {
    data: insights = [],
    isLoading: insightsLoading,
    isError: insightsError,
    refetch: refetchInsights,
  } = useQuery({
    queryKey: ['comercial-insights'],
    queryFn: getComercialInsights,
    refetchInterval: 60_000,
  });

  if (resumoLoading || insightsLoading) {
    return (
      <div className="mx-auto max-w-6xl p-4 md:p-6">
        <div className="space-y-4">
          <div className="h-8 w-64 animate-pulse rounded-full bg-slate-200" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-36 animate-pulse rounded-2xl bg-slate-200" />
            ))}
          </div>
          <div className="h-36 animate-pulse rounded-2xl bg-slate-200" />
        </div>
      </div>
    );
  }

  if (resumoError || insightsError || !resumo) {
    return (
      <div className="mx-auto max-w-6xl p-4 md:p-6">
        <ErrorState
          title="Não foi possível carregar o painel comercial"
          message="Os dados de vendas não responderam como esperado."
          onRetry={() => {
            refetchResumo();
            refetchInsights();
          }}
        />
      </div>
    );
  }

  const variacaoLabel = resumo.variacao > 0
    ? `+${resumo.variacao}% vs ontem`
    : `${resumo.variacao}% vs ontem`;

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#2c2f31]">Painel Comercial</h1>
          <p className="mt-1 text-sm text-slate-500">
            Acompanha vendas, rotação de produtos e sinais rápidos do dia.
          </p>
        </div>

        {podeAnalise ? (
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setModo('resumo')}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${modo === 'resumo' ? 'bg-[#0A2540] text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              Resumo
            </button>
            <button
              type="button"
              onClick={() => setModo('analise')}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${modo === 'analise' ? 'bg-[#0A2540] text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              Análise
            </button>
          </div>
        ) : null}
      </div>

      {modo === 'analise' && podeAnalise ? (
        <PainelAnalise />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <CommercialSummaryCard
              title="Total Hoje"
              value={formatKz(resumo.totalHoje)}
              hint={variacaoLabel}
              icon={resumo.variacao >= 0 ? TrendingUp : TrendingDown}
              accentClass={resumo.variacao >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}
            />
            <CommercialSummaryCard
              title="Vendas Hoje"
              value={String(resumo.vendasHoje)}
              hint={resumo.estabelecimentoDestaque ? `Destaque: ${resumo.estabelecimentoDestaque.nome}` : 'Sem destaque ainda'}
              icon={ShoppingCart}
              accentClass="bg-blue-100 text-blue-700"
            />
            <CommercialSummaryCard
              title="Top Produto"
              value={resumo.topProduto?.productDescription || 'Sem vendas'}
              hint={resumo.topProduto ? `${resumo.topProduto.quantidadeVendida} unidades` : 'Ainda sem rotação hoje'}
              icon={Trophy}
              accentClass="bg-amber-100 text-amber-700"
            />
            <CommercialSummaryCard
              title="Stock Baixo"
              value={String(resumo.stockAlertaCount)}
              hint={resumo.stockAlertaCount > 0 ? 'Ver produtos com alerta' : 'Inventário sem alertas'}
              icon={PackageX}
              accentClass="bg-rose-100 text-rose-700"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <Card className="border-slate-200 p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-[#0A2540]" />
                <p className="text-sm font-semibold text-[#2c2f31]">Insights do Dia</p>
              </div>
              <div className="mt-4 space-y-3">
                {insights.map((insight) => (
                  <div key={insight} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    {insight}
                  </div>
                ))}
                {insights.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    Ainda não há insights suficientes para hoje.
                  </div>
                ) : null}
              </div>
            </Card>

            <Card className="border-slate-200 p-5 shadow-sm">
              <p className="text-sm font-semibold text-[#2c2f31]">Ações rápidas</p>
              <div className="mt-4 grid gap-3">
                <Button asChild className="justify-start gap-2">
                  <Link href="/vendas-rapidas">
                    <ShoppingCart className="h-4 w-4" />
                    Ir para Venda Rápida
                  </Link>
                </Button>
                <Button asChild variant="outline" className="justify-start gap-2">
                  <Link href="/produtos">
                    <PackageX className="h-4 w-4" />
                    Rever inventário
                  </Link>
                </Button>
                <Button asChild variant="outline" className="justify-start gap-2">
                  <Link href="/vendas">
                    <BarChart3 className="h-4 w-4" />
                    Abrir faturação
                  </Link>
                </Button>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
