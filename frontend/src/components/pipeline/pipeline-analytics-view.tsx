'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getCurrentUser,
  getPipelineAnalyticsConversion,
  getPipelineAnalyticsForecast,
  getPipelineAnalyticsTeam,
  getPipelineAnalyticsVelocity,
} from '@/lib/api';
import type { User } from '@/lib/api';
import type { PipelineAnalyticsVelocityStage } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import PipelineFunnelChart from '@/components/pipeline/pipeline-funnel-chart';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Gauge,
  Target,
  TrendingUp,
  Wallet,
} from 'lucide-react';

const PERIOD_OPTIONS = ['7d', '30d', '90d'] as const;
type PeriodOption = (typeof PERIOD_OPTIONS)[number];

const moneyFormatter = new Intl.NumberFormat('pt-AO', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  return `${value.toFixed(1)}%`;
}

function formatDays(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  return `${value.toFixed(1)} dias`;
}

function formatKz(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  return `${moneyFormatter.format(Math.round(value))} Kz`;
}

function isPrivilegedUser(user: User | null) {
  return !!(user?.isSuperAdmin || user?.role === 'admin' || !user?.accountOwnerId);
}

function MetricCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="h-3 w-32 animate-pulse rounded bg-slate-200" />
        <div className="mt-3 h-8 w-28 animate-pulse rounded bg-slate-200" />
      </CardHeader>
      <CardContent>
        <div className="h-4 w-40 animate-pulse rounded bg-slate-100" />
      </CardContent>
    </Card>
  );
}

function SectionSkeleton({ lines = 5 }: { lines?: number }) {
  return (
    <Card>
      <CardHeader>
        <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
        <div className="h-3 w-56 animate-pulse rounded bg-slate-100" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: lines }).map((_, index) => (
          <div key={index} className="h-10 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </CardContent>
    </Card>
  );
}

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  accentClass,
}: {
  title: string;
  value: string;
  description: string;
  icon: typeof TrendingUp;
  accentClass: string;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardDescription>{title}</CardDescription>
            <CardTitle className="mt-3 text-3xl">{value}</CardTitle>
          </div>
          <div className={cn('rounded-2xl p-3', accentClass)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-[#6b7e9a]">{description}</p>
      </CardContent>
    </Card>
  );
}

function VelocityTrend({ row }: { row: PipelineAnalyticsVelocityStage }) {
  if (row.currentDays === null || row.previousDays === null || row.deltaDays === null || row.deltaDays === 0) {
    return <span className="text-xs text-[#6b7e9a]">Sem mudança</span>;
  }

  const isSlower = row.deltaDays > 0;

  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-semibold', isSlower ? 'text-amber-600' : 'text-emerald-600')}>
      {isSlower ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
      {Math.abs(row.deltaDays).toFixed(1)} dias
    </span>
  );
}

export default function PipelineAnalyticsView() {
  const [period, setPeriod] = useState<PeriodOption>('30d');
  const [processesOpen, setProcessesOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);

  const currentUserQuery = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
    staleTime: 30_000,
  });

  const currentUser = currentUserQuery.data || null;
  const organizationId = currentUser ? currentUser.accountOwnerId || currentUser.id : null;
  const privilegedUser = isPrivilegedUser(currentUser);

  const analyticsParams = useMemo(
    () => (organizationId ? { organization_id: organizationId, period } : null),
    [organizationId, period]
  );

  const conversionQuery = useQuery({
    queryKey: ['pipeline-analytics', 'conversion', analyticsParams],
    queryFn: () => getPipelineAnalyticsConversion(analyticsParams!),
    enabled: Boolean(analyticsParams),
    retry: false,
  });

  const velocityQuery = useQuery({
    queryKey: ['pipeline-analytics', 'velocity', analyticsParams],
    queryFn: () => getPipelineAnalyticsVelocity(analyticsParams!),
    enabled: Boolean(analyticsParams),
    retry: false,
  });

  const forecastQuery = useQuery({
    queryKey: ['pipeline-analytics', 'forecast', analyticsParams],
    queryFn: () => getPipelineAnalyticsForecast(analyticsParams!),
    enabled: Boolean(analyticsParams),
    retry: false,
  });

  const teamQuery = useQuery({
    queryKey: ['pipeline-analytics', 'team', analyticsParams],
    queryFn: () => getPipelineAnalyticsTeam(analyticsParams!),
    enabled: Boolean(analyticsParams) && privilegedUser,
    retry: false,
  });

  const shouldShowLimitedView = (conversionQuery.data?.closedContacts || 0) < 5;

  if (currentUserQuery.isLoading) {
    return <div className="min-h-[40vh]" />;
  }

  if (currentUser?.workspaceMode === 'comercio') {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#0A2540]">Analytics</h2>
          <p className="mt-2 max-w-2xl text-sm text-[#6b7e9a]">
            Conversão, velocidade e forecast das negociações activas no workspace de serviços.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-2xl border border-[#dde3ec] bg-white p-1">
          {PERIOD_OPTIONS.map((option) => (
            <Button
              key={option}
              variant={period === option ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setPeriod(option)}
              className="min-w-[64px]"
            >
              {option}
            </Button>
          ))}
        </div>
      </div>

      {shouldShowLimitedView && conversionQuery.data ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex items-start gap-3 p-5">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-700" />
            <div>
              <p className="font-semibold text-[#0A2540]">
                Precisas de pelo menos 5 negócios fechados para ver analytics de conversão
              </p>
              <p className="mt-1 text-sm text-amber-900/80">
                Por enquanto mostramos apenas o valor actual do pipeline. Assim que houver histórico suficiente, o funil, velocidade e forecast completo ficam disponíveis.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-4">
        {shouldShowLimitedView ? (
          forecastQuery.isLoading ? (
            <MetricCardSkeleton />
          ) : forecastQuery.isError ? (
            <ErrorState compact title="Falha ao carregar valor do pipeline" message="Não foi possível calcular o valor actual do pipeline." />
          ) : (
            <MetricCard
              title="Pipeline Value Actual"
              value={formatKz(forecastQuery.data?.currentValue)}
              description="Estimativa actual baseada no bucket de faturação dos negócios em aberto."
              icon={Wallet}
              accentClass="bg-[#EEF5FC] text-[#1A6FD4]"
            />
          )
        ) : (
          <>
            {conversionQuery.isLoading ? (
              <MetricCardSkeleton />
            ) : conversionQuery.isError ? (
              <ErrorState compact title="Falha ao carregar conversão" message="Não foi possível calcular a taxa de conversão." />
            ) : (
              <MetricCard
                title="Conversão Total"
                value={formatPercent(conversionQuery.data?.totalConversionRate)}
                description={`${conversionQuery.data?.closedContacts || 0} negócios fechados em ${conversionQuery.data?.totalContacts || 0} oportunidades no período.`}
                icon={Target}
                accentClass="bg-emerald-50 text-emerald-700"
              />
            )}

            {velocityQuery.isLoading ? (
              <MetricCardSkeleton />
            ) : velocityQuery.isError ? (
              <ErrorState compact title="Falha ao carregar velocidade" message="Não foi possível calcular a velocidade média." />
            ) : (
              <MetricCard
                title="Tempo Médio"
                value={formatDays(velocityQuery.data?.averageCurrentDays)}
                description={
                  velocityQuery.data?.averagePreviousDays !== null && velocityQuery.data?.averagePreviousDays !== undefined
                    ? `Período anterior: ${formatDays(velocityQuery.data?.averagePreviousDays)}`
                    : 'Ainda sem base suficiente no período anterior.'
                }
                icon={Gauge}
                accentClass="bg-amber-50 text-amber-700"
              />
            )}

            {forecastQuery.isLoading ? (
              <MetricCardSkeleton />
            ) : forecastQuery.isError ? (
              <ErrorState compact title="Falha ao carregar pipeline value" message="Não foi possível calcular o valor actual do pipeline." />
            ) : (
              <MetricCard
                title="Pipeline Value"
                value={formatKz(forecastQuery.data?.currentValue)}
                description="Soma estimada dos negócios activos em aberto."
                icon={Wallet}
                accentClass="bg-[#EEF5FC] text-[#1A6FD4]"
              />
            )}

            {forecastQuery.isLoading ? (
              <MetricCardSkeleton />
            ) : forecastQuery.isError ? (
              <ErrorState compact title="Falha ao carregar forecast" message="Não foi possível calcular o forecast." />
            ) : (
              <Card className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardDescription>Forecast</CardDescription>
                      <CardTitle className="mt-3 text-3xl">{formatKz(forecastQuery.data?.forecastValue)}</CardTitle>
                    </div>
                    <div className="rounded-2xl bg-violet-50 p-3 text-violet-700">
                      <TrendingUp className="h-5 w-5" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-[#6b7e9a]">
                    Projecção ponderada pela conversão histórica estimada de cada etapa.
                  </p>
                  {forecastQuery.data?.low_confidence ? (
                    <Badge variant="secondary">Confiança baixa: menos de 10 fechados</Badge>
                  ) : null}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {!shouldShowLimitedView ? (
        <>
          <Card className="overflow-hidden">
            <button
              type="button"
              onClick={() => setProcessesOpen((open) => !open)}
              className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-slate-50"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-[#EEF5FC] p-3 text-[#1A6FD4]">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-base font-semibold text-[#0A2540]">
                    {processesOpen ? 'Ocultar processos' : 'Mostrar processos'}
                  </p>
                  <p className="mt-1 text-sm text-[#6b7e9a]">
                    Funil de conversão e velocidade por etapa.
                  </p>
                </div>
              </div>
              {processesOpen ? <ChevronUp className="h-5 w-5 text-[#6b7e9a]" /> : <ChevronDown className="h-5 w-5 text-[#6b7e9a]" />}
            </button>
            {processesOpen ? (
              <CardContent className="space-y-6 border-t border-[#dde3ec] pt-6">
                {conversionQuery.isLoading ? (
                  <SectionSkeleton lines={6} />
                ) : conversionQuery.isError ? (
                  <ErrorState
                    title="Falha ao carregar funil de conversão"
                    message="Não foi possível gerar o funil do pipeline para este período."
                    onRetry={() => conversionQuery.refetch()}
                  />
                ) : conversionQuery.data?.totalContacts ? (
                  <div className="space-y-6">
                    <div>
                      <div className="mb-4">
                        <h3 className="text-base font-semibold text-[#0A2540]">Funil de Conversão</h3>
                        <p className="mt-1 text-sm text-[#6b7e9a]">Barras horizontais por etapa com a percentagem de avanço da coorte.</p>
                      </div>
                      <PipelineFunnelChart stages={conversionQuery.data.byStage} />
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {conversionQuery.data.byStage
                        .filter((stage) => stage.stage !== 'Perdido')
                        .map((stage) => (
                          <div key={stage.stage} className="rounded-2xl border border-[#dde3ec] p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                                <p className="text-sm font-medium text-[#0A2540]">{stage.stage}</p>
                              </div>
                              <span className="text-xs text-[#6b7e9a]">{stage.currentCount} actual</span>
                            </div>
                            <p className="mt-3 text-2xl font-semibold text-[#0A2540]">{formatPercent(stage.advancementRate)}</p>
                            <p className="mt-1 text-xs text-[#6b7e9a]">
                              Win rate estimada a partir desta etapa: {formatPercent(stage.stageConversionRate)}
                            </p>
                          </div>
                        ))}
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    variant="empty"
                    icon={BarChart3}
                    title="Sem dados suficientes no período"
                    description="Ainda não há oportunidades criadas neste intervalo para calcular o funil."
                  />
                )}

                {velocityQuery.isLoading ? (
                  <SectionSkeleton lines={7} />
                ) : velocityQuery.isError ? (
                  <ErrorState
                    title="Falha ao carregar velocidade"
                    message="Não foi possível comparar o tempo médio por etapa."
                    onRetry={() => velocityQuery.refetch()}
                  />
                ) : (
                  <div>
                    <div className="mb-4">
                      <h3 className="text-base font-semibold text-[#0A2540]">Velocidade por Etapa</h3>
                      <p className="mt-1 text-sm text-[#6b7e9a]">Comparação do tempo médio actual com o período anterior.</p>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Etapa</TableHead>
                          <TableHead>Tempo Actual</TableHead>
                          <TableHead>Tempo Anterior</TableHead>
                          <TableHead>Tendência</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {velocityQuery.data?.byStage.map((row) => (
                          <TableRow key={row.stage}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.color }} />
                                <span className="font-medium">{row.stage}</span>
                              </div>
                            </TableCell>
                            <TableCell>{formatDays(row.currentDays)}</TableCell>
                            <TableCell>{formatDays(row.previousDays)}</TableCell>
                            <TableCell><VelocityTrend row={row} /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            ) : null}
          </Card>

          {privilegedUser ? (
            teamQuery.isLoading ? (
              <SectionSkeleton lines={4} />
            ) : teamQuery.isError ? (
              <ErrorState
                title="Falha ao carregar analytics de equipa"
                message="Não foi possível calcular os indicadores por responsável."
                onRetry={() => teamQuery.refetch()}
              />
            ) : (
              <Card>
                <CardHeader>
                  <button
                    type="button"
                    onClick={() => setTeamOpen((open) => !open)}
                    className="flex w-full items-center justify-between text-left"
                  >
                    <div>
                      <CardTitle>Equipa</CardTitle>
                      <CardDescription>Contactos activos e taxa de conversão por responsável.</CardDescription>
                    </div>
                    {teamOpen ? <ChevronUp className="h-5 w-5 text-[#6b7e9a]" /> : <ChevronDown className="h-5 w-5 text-[#6b7e9a]" />}
                  </button>
                </CardHeader>
                {teamOpen ? (
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Responsável</TableHead>
                          <TableHead>Contactos Activos</TableHead>
                          <TableHead>Fechados</TableHead>
                          <TableHead>Conversão</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {teamQuery.data?.members.map((member) => (
                          <TableRow key={member.userId}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{member.name}</p>
                                <p className="text-xs text-[#6b7e9a]">{member.email}</p>
                              </div>
                            </TableCell>
                            <TableCell>{member.activeContacts}</TableCell>
                            <TableCell>{member.closedContacts}</TableCell>
                            <TableCell>
                              {member.showConversionRate ? (
                                <span className="font-medium">{formatPercent(member.conversionRate)}</span>
                              ) : (
                                <span className="text-xs text-[#6b7e9a]">Disponível com 5 fechados</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                ) : null}
              </Card>
            )
          ) : null}
        </>
      ) : null}
    </div>
  );
}
