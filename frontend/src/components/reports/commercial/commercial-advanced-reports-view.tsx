'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  CreditCard,
  Package,
  ShoppingCart,
  Store,
  Users,
  Wallet,
} from 'lucide-react';
import {
  getCommercialAdvancedLocations,
  getCommercialAdvancedOverview,
  getCommercialAdvancedProducts,
  getCommercialAdvancedSales,
  getCommercialAdvancedTeam,
  getCurrentUser,
  getEstabelecimentos,
} from '@/lib/api';
import { canViewReports } from '@/lib/permissions';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ReportsBarChart,
  ReportsDoughnutChart,
  ReportsLineChart,
} from '@/components/reports/shared/report-charts';
import { ReportMetricCard, ReportMetricCardSkeleton } from '@/components/reports/shared/report-metric-card';
import {
  formatDateRange,
  formatGrowthLabel,
  formatKz,
  formatNumber,
  formatPaymentMethodLabel,
  ReportPeriodOption,
} from '@/components/reports/shared/report-format';
import { ReportNotice, ReportSectionCard, ReportSectionSkeleton } from '@/components/reports/shared/report-section';
import { ReportsFilters } from '@/components/reports/shared/reports-filters';

function getTodayIso() {
  return new Date().toISOString().slice(0, 10);
}

function getDefaultCustomStartIso() {
  const date = new Date();
  date.setDate(date.getDate() - 29);
  return date.toISOString().slice(0, 10);
}

function TeamFilter({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ userId: number; name: string }>;
}) {
  return (
    <div className="min-w-[220px]">
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        Utilizador
      </label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Toda a equipa" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Toda a equipa</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.userId} value={String(option.userId)}>
              {option.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default function CommercialAdvancedReportsView() {
  const [period, setPeriod] = useState<ReportPeriodOption>('30d');
  const [startDate, setStartDate] = useState(getDefaultCustomStartIso());
  const [endDate, setEndDate] = useState(getTodayIso());
  const [estabelecimentoId, setEstabelecimentoId] = useState('all');
  const [teamUserId, setTeamUserId] = useState('all');

  const currentUserQuery = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
    staleTime: 30_000,
    retry: false,
  });

  const currentUser = currentUserQuery.data || null;
  const hasAccess = !!(currentUser && canViewReports(currentUser));

  const params = useMemo(() => ({
    period,
    ...(period === 'custom' ? { startDate, endDate } : {}),
    ...(estabelecimentoId !== 'all' ? { estabelecimentoId } : {}),
  }), [endDate, estabelecimentoId, period, startDate]);

  const teamParams = useMemo(() => ({
    ...params,
    ...(teamUserId !== 'all' ? { userId: Number(teamUserId) } : {}),
  }), [params, teamUserId]);

  const overviewQuery = useQuery({
    queryKey: ['advanced-reports', 'commerce', 'overview', params],
    queryFn: () => getCommercialAdvancedOverview(params),
    enabled: hasAccess && currentUser?.workspaceMode === 'comercio',
    retry: false,
  });

  const salesQuery = useQuery({
    queryKey: ['advanced-reports', 'commerce', 'sales', params],
    queryFn: () => getCommercialAdvancedSales(params),
    enabled: hasAccess && currentUser?.workspaceMode === 'comercio',
    retry: false,
  });

  const productsQuery = useQuery({
    queryKey: ['advanced-reports', 'commerce', 'products', params],
    queryFn: () => getCommercialAdvancedProducts(params),
    enabled: hasAccess && currentUser?.workspaceMode === 'comercio',
    retry: false,
  });

  const locationsQuery = useQuery({
    queryKey: ['advanced-reports', 'commerce', 'locations', params],
    queryFn: () => getCommercialAdvancedLocations(params),
    enabled: hasAccess && currentUser?.workspaceMode === 'comercio',
    retry: false,
  });

  const teamQuery = useQuery({
    queryKey: ['advanced-reports', 'commerce', 'team', teamParams],
    queryFn: () => getCommercialAdvancedTeam(teamParams),
    enabled: hasAccess && currentUser?.workspaceMode === 'comercio',
    retry: false,
  });

  const establishmentsQuery = useQuery({
    queryKey: ['estabelecimentos', 'reports'],
    queryFn: getEstabelecimentos,
    enabled: hasAccess && currentUser?.workspaceMode === 'comercio',
    staleTime: 60_000,
  });

  const handlePeriodChange = (value: ReportPeriodOption) => {
    setPeriod(value);
    if (value === 'custom' && (!startDate || !endDate)) {
      setStartDate(getDefaultCustomStartIso());
      setEndDate(getTodayIso());
    }
  };

  const handleReset = () => {
    setPeriod('30d');
    setStartDate(getDefaultCustomStartIso());
    setEndDate(getTodayIso());
    setEstabelecimentoId('all');
    setTeamUserId('all');
  };

  if (currentUserQuery.isLoading) {
    return <div className="min-h-[40vh] p-6" />;
  }

  if (!currentUser || currentUser.workspaceMode !== 'comercio') {
    return null;
  }

  if (!hasAccess) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <EmptyState
          variant="no-permission"
          title="Sem acesso aos relatórios avançados"
          description="Este perfil ainda não tem permissão para consultar a camada avançada de relatórios do workspace comercial."
        />
      </div>
    );
  }

  const teamOptions = teamQuery.data?.members.map((member) => ({
    userId: member.userId,
    name: member.name,
  })) || [{ userId: currentUser.id, name: currentUser.name }];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <ReportsFilters
        title="Relatórios avançados de comércio"
        description="Vendas, produtos, multi-estabelecimento e performance da equipa comercial numa superfície própria."
        period={period}
        onPeriodChange={handlePeriodChange}
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        establishmentId={estabelecimentoId}
        onEstablishmentChange={setEstabelecimentoId}
        establishmentOptions={(establishmentsQuery.data || []).map((item) => ({
          value: item.id,
          label: item.nome,
        }))}
        onReset={handleReset}
        extraContent={overviewQuery.data ? (
          <div className="rounded-2xl border border-[var(--workspace-primary-border)] bg-[var(--workspace-primary-soft)] px-4 py-3 text-sm text-[var(--workspace-primary)]">
            Intervalo actual: {formatDateRange(overviewQuery.data.range.start, overviewQuery.data.range.end)}. O resumo do painel continua leve; esta página concentra comparação, rankings e decisões.
          </div>
        ) : null}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {overviewQuery.isLoading || salesQuery.isLoading ? (
          Array.from({ length: 6 }).map((_, index) => <ReportMetricCardSkeleton key={index} />)
        ) : overviewQuery.isError || salesQuery.isError || !overviewQuery.data || !salesQuery.data ? (
          <div className="md:col-span-2 xl:col-span-3">
            <ErrorState
              title="Não foi possível carregar o resumo avançado"
              message="Tenta novamente dentro de instantes para restaurar os indicadores do comércio."
              onRetry={() => {
                void overviewQuery.refetch();
                void salesQuery.refetch();
              }}
            />
          </div>
        ) : (
          <>
            <ReportMetricCard
              title="Vendas do período"
              value={formatKz(overviewQuery.data.summary.totalSales)}
              description={formatGrowthLabel(overviewQuery.data.summary.growthPercent)}
              icon={Wallet}
              accentClass="bg-[var(--workspace-primary)]"
            />
            <ReportMetricCard
              title="Documentos emitidos"
              value={formatNumber(overviewQuery.data.summary.invoiceCount)}
              description={`${formatNumber(overviewQuery.data.summary.previousInvoiceCount)} no período anterior`}
              icon={ShoppingCart}
              accentClass="bg-orange-600"
            />
            <ReportMetricCard
              title="Ticket médio"
              value={formatKz(overviewQuery.data.summary.ticketAverage)}
              description={`${formatKz(overviewQuery.data.summary.previousTicketAverage)} no período anterior`}
              icon={CreditCard}
              accentClass="bg-sky-700"
            />
            <ReportMetricCard
              title="Stock crítico"
              value={formatNumber(overviewQuery.data.summary.criticalStockCount)}
              description="Produtos abaixo do stock mínimo"
              icon={Package}
              accentClass="bg-rose-600"
            />
            <ReportMetricCard
              title="Estabelecimentos"
              value={formatNumber(locationsQuery.data?.summary.locations ?? 0)}
              description={locationsQuery.data?.summary.bestLocation ? `Melhor do período: ${locationsQuery.data.summary.bestLocation.nome}` : 'Sem liderança destacada'}
              icon={Store}
              accentClass="bg-amber-600"
            />
            <ReportMetricCard
              title="Sessões de caixa"
              value={formatKz(locationsQuery.data?.summary.totalCashInSessions ?? 0)}
              description="Total de caixa registado nas sessões do período"
              icon={BarChart3}
              accentClass="bg-slate-700"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        {salesQuery.isLoading ? (
          <ReportSectionSkeleton lines={6} />
        ) : salesQuery.isError || !salesQuery.data ? (
          <ErrorState
            title="Falha ao carregar tendência de vendas"
            message="Não foi possível montar a série temporal do período."
            onRetry={() => void salesQuery.refetch()}
          />
        ) : (
          <ReportSectionCard
            title="Tendência de vendas"
            description="Série temporal agregada automaticamente por dia, semana ou mês conforme o intervalo."
          >
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="h-72">
                <ReportsLineChart
                  labels={salesQuery.data.series.map((item) => item.label)}
                  values={salesQuery.data.series.map((item) => item.total)}
                  datasetLabel="Vendas"
                  color="#ea580c"
                />
              </div>
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Crescimento</p>
                  <p className="mt-2 text-3xl font-black text-[#2c2f31]">{formatGrowthLabel(salesQuery.data.summary.growthPercent, 'Sem base anterior')}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Tendência do período</p>
                  <p className="mt-2 text-3xl font-black text-[#2c2f31]">{formatGrowthLabel(salesQuery.data.summary.trendGrowthPercent, 'Sem tendência comparável')}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Documentos</p>
                  <p className="mt-2 text-3xl font-black text-[#2c2f31]">{formatNumber(salesQuery.data.summary.documentCount)}</p>
                </div>
              </div>
            </div>
          </ReportSectionCard>
        )}

        {overviewQuery.isLoading ? (
          <ReportSectionSkeleton lines={6} />
        ) : overviewQuery.isError || !overviewQuery.data ? (
          <ErrorState
            title="Falha ao carregar overview comercial"
            message="Não foi possível consolidar métodos de pagamento e clientes."
            onRetry={() => void overviewQuery.refetch()}
          />
        ) : (
          <ReportSectionCard
            title="Distribuição operacional"
            description="Métodos de pagamento, clientes com mais compras e estabelecimentos com maior peso no período."
          >
            <div className="grid grid-cols-1 gap-5">
              <div className="h-72">
                <ReportsDoughnutChart
                  labels={overviewQuery.data.paymentMethods.map((item) => formatPaymentMethodLabel(item.method))}
                  values={overviewQuery.data.paymentMethods.map((item) => item.total)}
                  colors={['#f97316', '#2563eb', '#0f766e', '#7c3aed', '#475569']}
                />
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Compras</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overviewQuery.data.topClients.map((client) => (
                    <TableRow key={`${client.customerTaxID || 'sem-nif'}-${client.customerName}`}>
                      <TableCell className="font-medium">{client.customerName}</TableCell>
                      <TableCell className="text-right">{formatNumber(client.count)}</TableCell>
                      <TableCell className="text-right">{formatKz(client.total)}</TableCell>
                    </TableRow>
                  ))}
                  {overviewQuery.data.topClients.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-slate-500">
                        Ainda não há clientes com compras registadas neste período.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </ReportSectionCard>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {productsQuery.isLoading ? (
          <ReportSectionSkeleton lines={8} />
        ) : productsQuery.isError || !productsQuery.data ? (
          <ErrorState
            title="Falha ao carregar produtos"
            message="Não foi possível consolidar top produtos, margem e stock."
            onRetry={() => void productsQuery.refetch()}
          />
        ) : (
          <ReportSectionCard
            title="Produtos avançado"
            description="Mais vendidos, maior faturação e leitura simplificada de rotação e margem."
          >
            <div className="grid grid-cols-1 gap-5">
              <div className="h-72">
                <ReportsBarChart
                  labels={productsQuery.data.topSold.slice(0, 6).map((item) => item.productDescription)}
                  values={productsQuery.data.topSold.slice(0, 6).map((item) => item.quantityTotal)}
                  datasetLabel="Quantidade vendida"
                  color="rgba(234, 88, 12, 0.85)"
                />
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Faturação</TableHead>
                    <TableHead className="text-right">Margem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productsQuery.data.topRevenue.slice(0, 6).map((product) => (
                    <TableRow key={product.productCode}>
                      <TableCell className="font-medium">{product.productDescription}</TableCell>
                      <TableCell className="text-right">{formatKz(product.revenueTotal)}</TableCell>
                      <TableCell className="text-right">{formatKz(product.estimatedMargin)}</TableCell>
                    </TableRow>
                  ))}
                  {productsQuery.data.topRevenue.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-slate-500">
                        Ainda não há produtos com faturação suficiente neste período.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </ReportSectionCard>
        )}

        {locationsQuery.isLoading ? (
          <ReportSectionSkeleton lines={7} />
        ) : locationsQuery.isError || !locationsQuery.data ? (
          <ErrorState
            title="Falha ao carregar multi-estabelecimento"
            message="Não foi possível comparar estabelecimentos neste período."
            onRetry={() => void locationsQuery.refetch()}
          />
        ) : (
          <ReportSectionCard
            title="Multi-estabelecimento"
            description="Comparação de vendas, ticket e caixa entre os pontos de venda da organização."
          >
            <div className="grid grid-cols-1 gap-5">
              <div className="h-72">
                <ReportsBarChart
                  labels={locationsQuery.data.locations.map((item) => item.nome)}
                  values={locationsQuery.data.locations.map((item) => item.totalSales)}
                  datasetLabel="Vendas por estabelecimento"
                  color="rgba(15, 23, 42, 0.85)"
                />
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Estabelecimento</TableHead>
                    <TableHead className="text-right">Vendas</TableHead>
                    <TableHead className="text-right">Ticket</TableHead>
                    <TableHead className="text-right">Caixa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {locationsQuery.data.locations.map((location) => (
                    <TableRow key={location.id}>
                      <TableCell className="font-medium">{location.nome}</TableCell>
                      <TableCell className="text-right">{formatKz(location.totalSales)}</TableCell>
                      <TableCell className="text-right">{formatKz(location.ticketAverage)}</TableCell>
                      <TableCell className="text-right">{formatKz(location.totalCashInSessions)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {locationsQuery.data.summary.bestLocation ? (
                <ReportNotice
                  title={`Melhor estabelecimento: ${locationsQuery.data.summary.bestLocation.nome}`}
                  message={`Total vendido: ${formatKz(locationsQuery.data.summary.bestLocation.totalSales)}. Ticket médio: ${formatKz(locationsQuery.data.summary.bestLocation.ticketAverage)}.`}
                />
              ) : null}
            </div>
          </ReportSectionCard>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {productsQuery.isLoading ? (
          <ReportSectionSkeleton lines={6} />
        ) : productsQuery.isError || !productsQuery.data ? (
          <ErrorState
            title="Falha ao carregar saúde do stock"
            message="Não foi possível montar a leitura de produtos críticos e sem vendas."
            onRetry={() => void productsQuery.refetch()}
          />
        ) : (
          <ReportSectionCard
            title="Saúde do stock"
            description="Produtos abaixo do mínimo e produtos sem vendas no período seleccionado."
          >
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <div>
                <p className="mb-3 text-sm font-semibold text-[#2c2f31]">Stock crítico</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productsQuery.data.criticalProducts.slice(0, 6).map((product) => (
                      <TableRow key={product.productCode}>
                        <TableCell className="font-medium">{product.productDescription}</TableCell>
                        <TableCell className="text-right">
                          {formatNumber(product.stock)} / {formatNumber(product.stockMinimo)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {productsQuery.data.criticalProducts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-slate-500">
                          Sem alertas críticos neste período.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
              <div>
                <p className="mb-3 text-sm font-semibold text-[#2c2f31]">Sem vendas no período</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productsQuery.data.unsoldProducts.slice(0, 6).map((product) => (
                      <TableRow key={product.productCode}>
                        <TableCell className="font-medium">{product.productDescription}</TableCell>
                        <TableCell className="text-right">{formatNumber(product.stock)}</TableCell>
                      </TableRow>
                    ))}
                    {productsQuery.data.unsoldProducts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-slate-500">
                          Não há produtos parados neste intervalo.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            </div>
          </ReportSectionCard>
        )}

        {teamQuery.isLoading ? (
          <ReportSectionSkeleton lines={7} />
        ) : teamQuery.isError || !teamQuery.data ? (
          <ErrorState
            title="Falha ao carregar performance da equipa"
            message="Não foi possível consolidar vendas e sessões por utilizador."
            onRetry={() => void teamQuery.refetch()}
          />
        ) : (
          <ReportSectionCard
            title="Performance da equipa"
            description="Vendas atribuídas por eventos reais de criação de fatura e sessões de caixa abertas/fechadas."
            action={
              <TeamFilter
                value={teamUserId}
                onChange={setTeamUserId}
                options={teamOptions}
              />
            }
          >
            <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              {teamQuery.data.summary.attributionNote}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Membro</TableHead>
                  <TableHead className="text-right">Vendas</TableHead>
                  <TableHead className="text-right">Total vendido</TableHead>
                  <TableHead className="text-right">Sessões abertas</TableHead>
                  <TableHead className="text-right">Sessões fechadas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamQuery.data.members.map((member) => (
                  <TableRow key={member.userId}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{member.name}</p>
                        <p className="text-xs text-slate-500">{member.email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(member.salesCount)}</TableCell>
                    <TableCell className="text-right">{formatKz(member.totalSold)}</TableCell>
                    <TableCell className="text-right">{formatNumber(member.sessionsOpened)}</TableCell>
                    <TableCell className="text-right">{formatNumber(member.sessionsClosed)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ReportSectionCard>
        )}
      </div>
    </div>
  );
}
