'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { managementApi } from '@/lib/management-api';
import { formatDate, formatKz } from '@/lib/management-format';
import { ManagementLoading, ManagementPage, StatusBadge } from '@/components/management/management-ui';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ClientProfilePage() {
  const id = String(useParams().id); const query = useQuery({ queryKey: ['management-client', id], queryFn: () => managementApi.client(id) });
  if (query.isLoading) return <ManagementLoading />;
  if (!query.data) return <ManagementPage title="Cliente"><p>Cliente não encontrado.</p></ManagementPage>;
  const client = query.data; const revenue = (client.transactions || []).filter((item) => item.type === 'receita').reduce((sum, item) => sum + Number(item.actualValue || 0), 0); const expenses = (client.transactions || []).filter((item) => item.type === 'despesa').reduce((sum, item) => sum + Number(item.actualValue || 0), 0);
  return <ManagementPage title={client.companyName} description={`${client.contactName} · ${client.email || client.phone || 'Sem contacto'}`}>
    <div className="grid gap-5 lg:grid-cols-3"><Card className="dark:border-slate-800 dark:bg-slate-900"><CardHeader><CardTitle>Dados gerais</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><Line label="Estado" value={<StatusBadge value={client.status} />} /><Line label="Serviço" value={client.contractedService || '—'} /><Line label="Valor mensal" value={formatKz(client.monthlyValue)} /><Line label="Contrato" value={`${formatDate(client.startDate)} — ${formatDate(client.expectedEndDate)}`} /><Line label="Origem" value={client.source || '—'} /></CardContent></Card>
      <Card className="dark:border-slate-800 dark:bg-slate-900"><CardHeader><CardTitle>Rentabilidade</CardTitle></CardHeader><CardContent className="space-y-3"><Line label="Receitas" value={formatKz(revenue)} /><Line label="Despesas" value={formatKz(expenses)} /><Line label="Resultado" value={formatKz(revenue - expenses)} /></CardContent></Card>
      <Card className="dark:border-slate-800 dark:bg-slate-900"><CardHeader><CardTitle>Atividade</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">{client.activities?.length ? client.activities.map((item) => <div key={item.id} className="border-l-2 border-blue-500 pl-3"><p>{item.description}</p><p className="text-xs text-slate-500">{formatDate(item.createdAt)}</p></div>) : <p className="text-slate-500">Sem atividade registada.</p>}</CardContent></Card></div>
    <div className="grid gap-5 lg:grid-cols-3"><Summary title="Oportunidades" value={client.opportunities?.length || 0} /><Summary title="Trabalhos" value={client.operationalTasks?.length || 0} /><Summary title="Movimentos" value={client.transactions?.length || 0} /></div>
  </ManagementPage>;
}
function Line({ label, value }: { label: string; value: React.ReactNode }) { return <div className="flex items-center justify-between gap-3"><span className="text-slate-500">{label}</span><span className="text-right font-medium">{value}</span></div>; }
function Summary({ title, value }: { title: string; value: number }) { return <Card className="dark:border-slate-800 dark:bg-slate-900"><CardContent className="p-5"><p className="text-sm text-slate-500">{title}</p><p className="mt-2 text-3xl font-bold">{value}</p></CardContent></Card>; }
