'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Briefcase,
  CheckCircle2,
  FileText,
  KanbanSquare,
  Target,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import {
  getCurrentUser,
  getServicesAdvancedOverview,
  getServicesAdvancedPipeline,
  getServicesAdvancedRevenue,
  getServicesAdvancedTeam,
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
import { ReportsBarChart, ReportsDoughnutChart } from '@/components/reports/shared/report-charts';
import { ReportMetricCard, ReportMetricCardSkeleton } from '@/components/reports/shared/report-metric-card';
import {
  formatDateRange,
  formatDays,
  formatGrowthLabel,
  formatKz,
  formatNumber,
  formatPercent,
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

export default function ServicesAdvancedReportsView() {
  const [period, setPeriod] = useState<ReportPeriodOption>('30d');
  const [startDate, setStartDate] = useState(getDefaultCustomStartIso());
  const [endDate, setEndDate] = useState(getTodayIso());
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
  }), [endDate, period, startDate]);

  const teamParams = useMemo(() => ({
    ...params,
    ...(teamUserId !== 'all' ? { userId: Number(teamUserId) } : {}),
  }), [params, teamUserId]);

  const overviewQuery = useQuery({
    queryKey: ['advanced-reports', 'services', 'overview', params],
    queryFn: () => getServicesAdvancedOverview(params),
    enabled: hasAccess && currentUser?.workspaceMode === 'servicos',
    retry: false,
  });

  const pipelineQuery = useQuery({
    queryKey: ['advanced-reports', 'services', 'pipeline', params],
    queryFn: () => getServicesAdvancedPipeline(params),
    enabled: hasAccess && currentUser?.workspaceMode === 'servicos',
    retry: false,
  });

  const revenueQuery = useQuery({
    queryKey: ['advanced-reports', 'services', 'revenue', params],
    queryFn: () => getServicesAdvancedRevenue(params),
    enabled: hasAccess && currentUser?.workspaceMode === 'servicos',
    retry: false,
  });

  const teamQuery = useQuery({
    queryKey: ['advanced-reports', 'services', 'team', teamParams],
    queryFn: () => getServicesAdvancedTeam(teamParams),
    enabled: hasAccess && currentUser?.workspaceMode === 'servicos',
    retry: false,
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
    setTeamUserId('all');
  };

  if (currentUserQuery.isLoading) {
    return <div className="min-h-[40vh] p-6" />;
  }

  if (!currentUser || currentUser.workspaceMode !== 'servicos') {
    return null;
  }

  if (!hasAccess) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <EmptyState
          variant="no-permission"
          title="Sem acesso aos relatórios avançados"
          description="Esta conta ou este perfil ainda não têm permissão para consultar a camada avançada de relatórios."
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
        title="Relatórios avançados de serviços"
        description="Leitura executiva do funil comercial, faturação e performance da equipa sem mexer no dashboard principal."
        period={period}
        onPeriodChange={handlePeriodChange}
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onReset={handleReset}
        extraContent={overviewQuery.data ? (
          <div className="rounded-2xl border border-[var(--workspace-primary-border)] bg-[var(--workspace-primary-soft)] px-4 py-3 text-sm text-[var(--workspace-primary)]">
            Intervalo actual: {formatDateRange(overviewQuery.data.range.start, overviewQuery.data.range.end)}. Receita recebida e faturação emitida aparecem separadas para evitar leituras ambíguas.
          </div>
        ) : null}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {overviewQuery.isLoading || revenueQuery.isLoading ? (
          Array.from({ length: 6 }).map((_, index) => <ReportMetricCardSkeleton key={index} />)
        ) : overviewQuery.isError || revenueQuery.isError || !overviewQuery.data || !revenueQuery.data ? (
          <div className="md:col-span-2 xl:col-span-3">
            <ErrorState
              title="Não foi possível carregar o resumo avançado"
              message="Tenta novamente dentro de instantes para voltar a ver os indicadores executivos."
              onRetry={() => {
                void overviewQuery.refetch();
                void revenueQuery.refetch();
              }}
            />
          </div>
        ) : (
          <>
            <ReportMetricCard
              title="Contactos no período"
              value={formatNumber(overviewQuery.data.totals.contactsAdded)}
              description={formatGrowthLabel(overviewQuery.data.totals.contactsAddedGrowthPercent)}
              icon={Users}
              accentClass="bg-[var(--workspace-primary)]"
            />
            <ReportMetricCard
              title="Activos em processos"
              value={formatNumber(overviewQuery.data.totals.activePipelineContacts)}
              description={`${formatNumber(overviewQuery.data.totals.totalContacts)} contactos no CRM`}
              icon={KanbanSquare}
              accentClass="bg-sky-700"
            />
            <ReportMetricCard
              title="Negócios ganhos"
              value={formatNumber(overviewQuery.data.totals.wonDeals)}
              description={`${formatNumber(overviewQuery.data.totals.lostDeals)} perdidos no período`}
              icon={CheckCircle2}
              accentClass="bg-emerald-600"
            />
            <ReportMetricCard
              title="Valor em negociação"
              value={formatKz(overviewQuery.data.totals.negotiationValue)}
              description="Estimativa actual dos contactos ainda activos no funil"
              icon={Target}
              accentClass="bg-indigo-600"
            />
            <ReportMetricCard
              title="Recebido"
              value={formatKz(revenueQuery.data.summary.received.current)}
              description={formatGrowthLabel(revenueQuery.data.summary.received.growthPercent)}
              icon={Wallet}
              accentClass="bg-emerald-700"
            />
            <ReportMetricCard
              title="Emitido"
              value={formatKz(revenueQuery.data.summary.issued.current)}
              description={`${formatNumber(revenueQuery.data.summary.invoicesIssued)} faturas emitidas`}
              icon={FileText}
              accentClass="bg-orange-600"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        {overviewQuery.isLoading ? (
          <ReportSectionSkeleton lines={6} />
        ) : overviewQuery.isError || !overviewQuery.data ? (
          <ErrorState
            title="Falha ao carregar o overview comercial"
            message="Não foi possível calcular os principais indicadores do período."
            onRetry={() => void overviewQuery.refetch()}
          />
        ) : (
          <ReportSectionCard
            title="Top clientes por receita recebida"
            description="Clientes com maior receita efectivamente recebida no período actual."
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overviewQuery.data.topClients.map((client) => (
                  <TableRow key={`${client.clientId || 'sem-id'}-${client.clientName}`}>
                    <TableCell className="font-medium">{client.clientName}</TableCell>
                    <TableCell className="text-right">{formatKz(client.revenue)}</TableCell>
                  </TableRow>
                ))}
                {overviewQuery.data.topClients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-slate-500">
                      Ainda não há clientes com receita recebida neste intervalo.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </ReportSectionCard>
        )}

        {pipelineQuery.isLoading ? (
          <ReportSectionSkeleton lines={5} />
        ) : pipelineQuery.isError || !pipelineQuery.data ? (
          <ErrorState
            title="Falha ao carregar processos de venda"
            message="Não foi possível montar a leitura avançada do funil."
            onRetry={() => void pipelineQuery.refetch()}
          />
        ) : (
          <ReportSectionCard
            title="Resumo avançado do funil"
            description="Distribuição por etapa, conversão geral e percepção do gargalo actual."
          >
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="h-72">
                <ReportsBarChart
                  labels={pipelineQuery.data.byStage.map((stage) => stage.stage)}
                  values={pipelineQuery.data.byStage.map((stage) => stage.count)}
                  datasetLabel="Contactos por etapa"
                  color="rgba(30, 64, 175, 0.85)"
                />
              </div>
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Conversão total</p>
                  <p className="mt-2 text-3xl font-black text-[#2c2f31]">
                    {formatPercent(pipelineQuery.data.summary.totalConversionRate)}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    {formatGrowthLabel(
                      pipelineQuery.data.summary.totalConversionRate !== null &&
                      pipelineQuery.data.summary.previousConversionRate !== null
                        ? pipelineQuery.data.summary.totalConversionRate - pipelineQuery.data.summary.previousConversionRate
                        : null,
                      'Sem base histórica comparável'
                    )}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Tempo médio até fecho</p>
                  <p className="mt-2 text-3xl font-black text-[#2c2f31]">
                    {formatDays(pipelineQuery.data.summary.averageCloseDays)}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    Período anterior: {formatDays(pipelineQuery.data.summary.previousAverageCloseDays)}
                  </p>
                </div>
                {pipelineQuery.data.summary.bottleneckStage ? (
                  <ReportNotice
                    title={`Gargalo principal: ${pipelineQuery.data.summary.bottleneckStage.stage}`}
                    message={`Conversão nesta etapa: ${formatPercent(pipelineQuery.data.summary.bottleneckStage.conversionRate)}. Avanço acumulado: ${formatPercent(pipelineQuery.data.summary.bottleneckStage.advancementRate)}.`}
                  />
                ) : null}
              </div>
            </div>
          </ReportSectionCard>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {pipelineQuery.isLoading ? (
          <ReportSectionSkeleton lines={8} />
        ) : pipelineQuery.isError || !pipelineQuery.data ? (
          <ErrorState
            title="Falha ao carregar etapas"
            message="Não foi possível comparar as etapas do funil."
            onRetry={() => void pipelineQuery.refetch()}
          />
        ) : (
          <ReportSectionCard
            title="Comparação por etapa"
            description="Contagem, valor e taxa de conversão estimada por etapa do processo de venda."
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Etapa</TableHead>
                  <TableHead className="text-right">Contactos</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Avanço</TableHead>
                  <TableHead className="text-right">Conversão</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pipelineQuery.data.byStage.map((stage) => (
                  <TableRow key={stage.stage}>
                    <TableCell className="font-medium">{stage.stage}</TableCell>
                    <TableCell className="text-right">{formatNumber(stage.count)}</TableCell>
                    <TableCell className="text-right">{formatKz(stage.value)}</TableCell>
                    <TableCell className="text-right">{formatPercent(stage.advancementRate)}</TableCell>
                    <TableCell className="text-right">{formatPercent(stage.stageConversionRate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!pipelineQuery.data.stageTime.available ? (
              <div className="mt-4">
                <ReportNotice
                  title="Tempo por etapa em fallback"
                  message={pipelineQuery.data.stageTime.reason || 'O sistema ainda não tem histórico suficiente por etapa para uma medição confiável.'}
                />
              </div>
            ) : null}
          </ReportSectionCard>
        )}

        {revenueQuery.isLoading ? (
          <ReportSectionSkeleton lines={6} />
        ) : revenueQuery.isError || !revenueQuery.data ? (
          <ErrorState
            title="Falha ao carregar receita avançada"
            message="Não foi possível calcular a camada híbrida de receita e faturação."
            onRetry={() => void revenueQuery.refetch()}
          />
        ) : (
          <ReportSectionCard
            title="Receita avançada"
            description="Separação entre recorrência activa, receita recebida e faturação emitida no período."
          >
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="h-72">
                <ReportsDoughnutChart
                  labels={['Recorrente mensalizada', 'Emitido não recorrente']}
                  values={[
                    revenueQuery.data.summary.activeRecurringMonthlyRevenue,
                    revenueQuery.data.summary.estimatedNonRecurringIssuedRevenue,
                  ]}
                  colors={['#1d4ed8', '#f97316']}
                />
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Recorrente activo</p>
                    <p className="mt-2 text-2xl font-black text-[#2c2f31]">{formatKz(revenueQuery.data.summary.activeRecurringMonthlyRevenue)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Concentração top 5</p>
                    <p className="mt-2 text-2xl font-black text-[#2c2f31]">{formatPercent(revenueQuery.data.summary.top5RevenueConcentrationPercent)}</p>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-right">Margem líquida</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {revenueQuery.data.topProfitableClients.map((client) => (
                      <TableRow key={`${client.clientId || 'sem-id'}-${client.clientName}`}>
                        <TableCell className="font-medium">{client.clientName}</TableCell>
                        <TableCell className="text-right">{formatKz(client.netMargin)}</TableCell>
                      </TableRow>
                    ))}
                    {revenueQuery.data.topProfitableClients.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-slate-500">
                          Ainda não há dados suficientes para calcular margem por cliente.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
                <ReportNotice
                  title="Classificação de receita"
                  message={revenueQuery.data.summary.classificationNote}
                />
              </div>
            </div>
          </ReportSectionCard>
        )}
      </div>

      {teamQuery.isLoading ? (
        <ReportSectionSkeleton lines={7} />
      ) : teamQuery.isError || !teamQuery.data ? (
        <ErrorState
          title="Falha ao carregar performance da equipa"
          message="Não foi possível consolidar as entregas da equipa neste período."
          onRetry={() => void teamQuery.refetch()}
        />
      ) : (
        <ReportSectionCard
          title="Performance da equipa"
          description="Tarefas concluídas, contactos criados, actividade registada e negócios ganhos por utilizador."
          action={
            <TeamFilter
              value={teamUserId}
              onChange={setTeamUserId}
              options={teamOptions}
            />
          }
        >
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Tarefas concluídas</p>
              <p className="mt-2 text-2xl font-black text-[#2c2f31]">{formatNumber(teamQuery.data.summary.totalTaskCompletions)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Tarefas em atraso</p>
              <p className="mt-2 text-2xl font-black text-[#2c2f31]">{formatNumber(teamQuery.data.summary.totalOverdueTasks)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Contactos criados</p>
              <p className="mt-2 text-2xl font-black text-[#2c2f31]">{formatNumber(teamQuery.data.summary.totalContactsCreated)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Negócios fechados</p>
              <p className="mt-2 text-2xl font-black text-[#2c2f31]">{formatNumber(teamQuery.data.summary.totalClosedDeals)}</p>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Membro</TableHead>
                <TableHead className="text-right">Tarefas</TableHead>
                <TableHead className="text-right">Atrasos</TableHead>
                <TableHead className="text-right">Contactos</TableHead>
                <TableHead className="text-right">Atividade</TableHead>
                <TableHead className="text-right">Fechos</TableHead>
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
                  <TableCell className="text-right">{formatNumber(member.tasksCompleted)}</TableCell>
                  <TableCell className="text-right">{formatNumber(member.overdueTasks)}</TableCell>
                  <TableCell className="text-right">{formatNumber(member.contactsCreated)}</TableCell>
                  <TableCell className="text-right">{formatNumber(member.activityCount)}</TableCell>
                  <TableCell className="text-right">{formatNumber(member.closedDeals)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ReportSectionCard>
      )}
    </div>
  );
}
