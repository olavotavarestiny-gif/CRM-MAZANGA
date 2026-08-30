'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { managementApi } from '@/lib/management-api';
import { formatDate, formatKz, formatPercent } from '@/lib/management-format';
import { KpiCard, ManagementLoading, ManagementPage } from './management-ui';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];
const STAGES = ['lead_recebido', 'primeiro_contacto', 'lead_qualificado', 'reuniao_agendada', 'reuniao_realizada', 'proposta_enviada', 'negociacao', 'ganho', 'perdido'];
const monthStart = new Date(); monthStart.setDate(1);

function dateKey(value: string) { return value.slice(0, 7); }
function mapValues(map: Map<string, number>) { return Array.from(map).sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => ({ name, value })); }

export default function ManagementDashboard() {
  const [dateFrom, setDateFrom] = useState(monthStart.toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [responsibleId, setResponsibleId] = useState('');
  const [clientId, setClientId] = useState('');
  const [channel, setChannel] = useState('');
  const [status, setStatus] = useState('');
  const bootstrap = useQuery({ queryKey: ['management-bootstrap'], queryFn: managementApi.bootstrap });
  const role = bootstrap.data?.profile.role;
  const clients = useQuery({ queryKey: ['management-clients', 'dashboard-filter'], queryFn: () => managementApi.clients(), enabled: role === 'admin' || role === 'commercial' });
  const params = { dateFrom, dateTo, responsibleId: responsibleId || undefined, clientId: clientId || undefined, channel: channel || undefined, status: status || undefined };
  const query = useQuery({ queryKey: ['management-dashboard', params], queryFn: () => managementApi.dashboard(params) });

  const charts = useMemo(() => {
    const data = query.data;
    if (!data) return { revenue: [], expenses: [], leads: [], origins: [], funnel: [], pipeline: [], tasks: [], delivery: [], clients: [], services: [] };
    const revenueMap = new Map<string, number>();
    const expenseMap = new Map<string, number>();
    const clientRevenueMap = new Map<string, number>();
    const serviceRevenueMap = new Map<string, number>();
    data.transactions.forEach((item) => {
      const value = Number(item.actualValue || 0);
      const month = dateKey(item.date);
      const target = item.type === 'receita' ? revenueMap : expenseMap;
      target.set(month, (target.get(month) || 0) + value);
      if (item.type === 'receita') {
        const clientName = item.client?.companyName || 'Sem cliente';
        const service = item.client?.contractedService || item.category || 'Outro';
        clientRevenueMap.set(clientName, (clientRevenueMap.get(clientName) || 0) + value);
        serviceRevenueMap.set(service, (serviceRevenueMap.get(service) || 0) + value);
      }
    });
    const leadMap = new Map<string, number>();
    const originMap = new Map<string, number>();
    if (data.role === 'marketing') {
      data.campaigns.forEach((item) => {
        leadMap.set(dateKey(item.startDate), (leadMap.get(dateKey(item.startDate)) || 0) + item.leads);
        originMap.set(item.channel, (originMap.get(item.channel) || 0) + item.leads);
      });
    } else {
      data.opportunities.forEach((item) => {
        leadMap.set(dateKey(item.entryDate), (leadMap.get(dateKey(item.entryDate)) || 0) + 1);
        originMap.set(item.leadSource || 'Outro', (originMap.get(item.leadSource || 'Outro') || 0) + 1);
      });
    }
    const pipelineMap = new Map<string, number>();
    data.opportunities.filter((item) => !['ganho', 'perdido'].includes(item.stage)).forEach((item) => pipelineMap.set(item.stage, (pipelineMap.get(item.stage) || 0) + Number(item.estimatedValue || 0)));
    const taskMap = new Map<string, number>();
    data.tasks.filter((item) => item.status === 'concluido').forEach((item) => taskMap.set(item.responsible?.fullName || 'Sem responsável', (taskMap.get(item.responsible?.fullName || 'Sem responsável') || 0) + 1));
    const completed = data.tasks.filter((item) => item.status === 'concluido');
    return {
      revenue: mapValues(revenueMap),
      expenses: mapValues(expenseMap),
      leads: mapValues(leadMap),
      origins: mapValues(originMap),
      funnel: STAGES.map((stage) => ({ name: stage.replaceAll('_', ' '), value: data.opportunities.filter((item) => item.stage === stage).length })),
      pipeline: Array.from(pipelineMap).map(([name, value]) => ({ name: name.replaceAll('_', ' '), value })),
      tasks: mapValues(taskMap),
      delivery: [{ name: 'No prazo', value: completed.filter((item) => item.deliveredOnTime).length }, { name: 'Atrasadas', value: completed.filter((item) => item.deliveredOnTime === false).length }],
      clients: Array.from(clientRevenueMap).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value })),
      services: Array.from(serviceRevenueMap).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value })),
    };
  }, [query.data]);

  const changeMonth = (value: string) => {
    setSelectedMonth(value);
    if (!value) return;
    const [year, month] = value.split('-').map(Number);
    setDateFrom(`${value}-01`);
    setDateTo(new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10));
  };

  if (query.isLoading || bootstrap.isLoading) return <ManagementLoading />;
  if (query.isError || !query.data) return <ManagementPage title="Dashboard"><p className="rounded-xl bg-red-50 p-4 text-red-700">Não foi possível carregar o dashboard.</p></ManagementPage>;
  const cards = query.data.summary.cards;
  const dashboardRole = query.data.role;
  const allCards = dashboardRole === 'admin' ? [
    ['Receita recebida', formatKz(cards.revenueReceived), 'green'], ['Receita prevista', formatKz(cards.revenueExpected), 'blue'], ['Despesas', formatKz(cards.expenses), 'red'], ['Lucro', formatKz(cards.profit), cards.profit >= 0 ? 'green' : 'red'], ['Margem de lucro', formatPercent(cards.profitMargin), 'blue'], ['MRR', formatKz(cards.mrr), 'green'],
    ['Clientes ativos', cards.activeClients, 'blue'], ['Novos clientes', cards.newClients, 'green'], ['Clientes perdidos', cards.lostClients, 'red'], ['Leads gerados', cards.leads, 'blue'], ['Leads qualificados', cards.qualifiedLeads, 'blue'], ['Reuniões realizadas', cards.meetings, 'blue'], ['Propostas enviadas', cards.proposals, 'amber'], ['Clientes fechados', cards.won, 'green'], ['Taxa de fecho', formatPercent(cards.closeRate), 'green'], ['Valor do pipeline', formatKz(cards.pipelineValue), 'amber'], ['Pipeline ponderado', formatKz(cards.weightedPipeline), 'amber'], ['Entregas concluídas', cards.completedTasks, 'green'], ['Entregas atrasadas', cards.delayedTasks, 'red'], ['Entrega no prazo', formatPercent(cards.onTimeRate), 'green'],
  ] as const : dashboardRole === 'marketing' ? [['Investimento', formatKz(query.data.summary.campaignTotals.investment), 'amber'], ['Leads', query.data.summary.campaignTotals.leads, 'blue'], ['Receita atribuída', formatKz(query.data.summary.campaignTotals.revenue), 'green']] as const : dashboardRole === 'commercial' ? [['Leads', cards.leads, 'blue'], ['Qualificados', cards.qualifiedLeads, 'blue'], ['Ganhos', cards.won, 'green'], ['Pipeline', formatKz(cards.pipelineValue), 'amber']] as const : [['Concluídos', cards.completedTasks, 'green'], ['Atrasados', cards.delayedTasks, 'red'], ['No prazo', formatPercent(cards.onTimeRate), 'blue']] as const;
  const showFinancial = dashboardRole === 'admin';
  const showCommercial = dashboardRole === 'admin' || dashboardRole === 'commercial';
  const showMarketing = dashboardRole === 'admin' || dashboardRole === 'marketing';
  const showOperational = dashboardRole === 'admin' || dashboardRole === 'designer' || dashboardRole === 'editor';

  return <ManagementPage title="Dashboard" description="Visão consolidada da operação e dos principais indicadores.">
    <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7" data-no-print>
      <Filter label="Data inicial"><Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></Filter>
      <Filter label="Data final"><Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></Filter>
      <Filter label="Mês"><Input type="month" value={selectedMonth} onChange={(event) => changeMonth(event.target.value)} /></Filter>
      <Filter label="Responsável"><select value={responsibleId} onChange={(event) => setResponsibleId(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Todos</option>{(bootstrap.data?.profiles || []).map((profile) => <option key={profile.id} value={profile.id}>{profile.fullName}</option>)}</select></Filter>
      <Filter label="Cliente"><select value={clientId} onChange={(event) => setClientId(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Todos</option>{(clients.data || []).map((client) => <option key={client.id} value={client.id}>{client.companyName}</option>)}</select></Filter>
      <Filter label="Canal"><select value={channel} onChange={(event) => setChannel(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Todos</option>{['meta_ads', 'google_ads', 'linkedin', 'instagram_organico', 'facebook_organico', 'evento', 'indicacao', 'prospeccao', 'website', 'outro'].map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></Filter>
      <Filter label="Estado"><select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Todos</option>{['ativo', 'pausado', 'cancelado', 'lead_recebido', 'lead_qualificado', 'reuniao_realizada', 'proposta_enviada', 'negociacao', 'ganho', 'perdido', 'pendente', 'em_producao', 'concluido', 'atrasado', 'pago', 'recebido', 'em_atraso'].map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></Filter>
    </div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">{allCards.map(([label, value, tone]) => <KpiCard key={label} label={label} value={value} tone={tone} />)}</div>
    <div className="grid gap-5 lg:grid-cols-2">
      {showFinancial && <ChartCard title="Receita por mês"><ResponsiveContainer width="100%" height={260}><LineChart data={charts.revenue}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" /><YAxis hide /><Tooltip formatter={(value) => formatKz(Number(value))} /><Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={3} /></LineChart></ResponsiveContainer></ChartCard>}
      {showFinancial && <ChartCard title="Despesas por mês"><ResponsiveContainer width="100%" height={260}><BarChart data={charts.expenses}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" /><YAxis hide /><Tooltip formatter={(value) => formatKz(Number(value))} /><Bar dataKey="value" fill="#ef4444" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></ChartCard>}
      {showMarketing && <ChartCard title="Leads por origem"><ResponsiveContainer width="100%" height={260}><PieChart><Pie data={charts.origins} dataKey="value" nameKey="name" outerRadius={90} label>{charts.origins.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></ChartCard>}
      {(showMarketing || showCommercial) && <ChartCard title="Leads por mês"><ResponsiveContainer width="100%" height={260}><LineChart data={charts.leads}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip /><Line type="monotone" dataKey="value" stroke="#06b6d4" strokeWidth={3} /></LineChart></ResponsiveContainer></ChartCard>}
      {showCommercial && <ChartCard title="Conversão do funil comercial"><ResponsiveContainer width="100%" height={300}><BarChart data={charts.funnel} layout="vertical"><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" allowDecimals={false} /><YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="value" fill="#2563eb" radius={[0, 6, 6, 0]} /></BarChart></ResponsiveContainer></ChartCard>}
      {showCommercial && <ChartCard title="Valor do pipeline por etapa"><ResponsiveContainer width="100%" height={260}><BarChart data={charts.pipeline}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis hide /><Tooltip formatter={(value) => formatKz(Number(value))} /><Bar dataKey="value" fill="#8b5cf6" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></ChartCard>}
      {showOperational && <ChartCard title="Trabalhos concluídos por colaborador"><ResponsiveContainer width="100%" height={260}><BarChart data={charts.tasks}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="value" fill="#10b981" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></ChartCard>}
      {showOperational && <ChartCard title="Entregas no prazo versus atrasadas"><ResponsiveContainer width="100%" height={260}><PieChart><Pie data={charts.delivery} dataKey="value" nameKey="name" outerRadius={90} label><Cell fill="#10b981" /><Cell fill="#ef4444" /></Pie><Tooltip /></PieChart></ResponsiveContainer></ChartCard>}
      {showFinancial && <ChartCard title="Receita por cliente"><ResponsiveContainer width="100%" height={260}><BarChart data={charts.clients}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis hide /><Tooltip formatter={(value) => formatKz(Number(value))} /><Bar dataKey="value" fill="#f59e0b" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></ChartCard>}
      {showFinancial && <ChartCard title="Receita por serviço"><ResponsiveContainer width="100%" height={260}><BarChart data={charts.services}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis hide /><Tooltip formatter={(value) => formatKz(Number(value))} /><Bar dataKey="value" fill="#06b6d4" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></ChartCard>}
    </div>
    {dashboardRole === 'admin' && query.data.activities.length > 0 && <Card className="print-card border-slate-200 dark:border-slate-800"><CardHeader><CardTitle className="text-base">Atividades recentes</CardTitle></CardHeader><CardContent className="space-y-3">{query.data.activities.map((activity) => <div key={activity.id} className="flex flex-col justify-between gap-1 border-b border-slate-100 pb-3 text-sm last:border-0 dark:border-slate-800 sm:flex-row"><div><p className="font-medium">{activity.description}</p><p className="text-xs text-slate-500">{activity.user?.fullName || 'Sistema'} · {activity.module}</p></div><span className="text-xs text-slate-500">{formatDate(activity.createdAt)}</span></div>)}</CardContent></Card>}
  </ManagementPage>;
}

function Filter({ label, children }: { label: string; children: React.ReactNode }) { return <label className="space-y-1"><span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</span>{children}</label>; }
function ChartCard({ title, children }: { title: string; children: React.ReactNode }) { return <Card className="print-card border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"><CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader><CardContent>{children}</CardContent></Card>; }
