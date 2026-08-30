'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, Banknote, CalendarDays, Check, Clock3, Plus, Trash2, UserPlus, UsersRound, X } from 'lucide-react';
import {
  archiveFoodWorkSchedule,
  getFoodContext,
  getFoodSettings,
  getFoodTeam,
  getFoodWorkforceDashboard,
  reviewFoodCashDifference,
  saveFoodWorkSchedule,
} from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api-error-message';
import type { FoodCashSession, FoodWorkSchedule } from '@/lib/types';
import { FoodEmptyState, FoodPageHeader, getFoodBrandStyle } from '@/components/food/food-ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const roleLabels: Record<string, string> = { manager: 'Gestor', cashier: 'Caixa', kitchen: 'Cozinha', delivery_manager: 'Delivery', courier: 'Entregador', crm_marketing: 'CRM' };
const approvalLabels: Record<FoodCashSession['approvalStatus'], string> = { not_required: 'Sem diferença', pending: 'Por analisar', approved: 'Aprovada', rejected: 'Rejeitada' };

function formatKz(value: number) {
  return `${new Intl.NumberFormat('pt-AO', { maximumFractionDigits: 2 }).format(value || 0)} Kz`;
}

function formatHours(value: number) {
  return `${new Intl.NumberFormat('pt-AO', { maximumFractionDigits: 1 }).format(value || 0)} h`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function Metric({ label, value, icon: Icon, tone }: { label: string; value: string | number; icon: typeof UsersRound; tone: string }) {
  return <Card className="border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-slate-500">{label}</p><p className="mt-1 text-2xl font-black text-slate-950">{value}</p></div><div className={`flex h-9 w-9 items-center justify-center rounded-lg ${tone}`}><Icon className="h-4 w-4" /></div></div></Card>;
}

export default function FoodWorkforceManagementPage() {
  const queryClient = useQueryClient();
  const [branchId, setBranchId] = useState('');
  const [days, setDays] = useState(30);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ personId: '', workDate: today(), startTime: '08:00', endTime: '17:00', notes: '' });
  const [review, setReview] = useState<{ session: FoodCashSession; decision: 'approved' | 'rejected' } | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const settingsQuery = useQuery({ queryKey: ['food-settings'], queryFn: getFoodSettings });
  const contextQuery = useQuery({ queryKey: ['food-context'], queryFn: getFoodContext });
  const teamQuery = useQuery({ queryKey: ['food-team'], queryFn: getFoodTeam });
  const dashboardQuery = useQuery({ queryKey: ['food-workforce-dashboard', branchId, days], queryFn: () => getFoodWorkforceDashboard({ branchId: branchId || undefined, days }) });
  const branches = contextQuery.data?.branches ?? [];
  const canEdit = contextQuery.data?.permissions.includes('*') || contextQuery.data?.permissions.includes('team.edit') || false;
  const people = useMemo(() => {
    const unique = new Map<number, { id: number; name: string }>();
    for (const assignment of teamQuery.data?.assignments ?? []) {
      if (assignment.active && (!branchId || !assignment.branchId || assignment.branchId === branchId)) unique.set(assignment.personId, { id: assignment.personId, name: assignment.person.name });
    }
    for (const row of dashboardQuery.data?.performance ?? []) unique.set(row.person.id, { id: row.person.id, name: row.person.name });
    return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [branchId, dashboardQuery.data?.performance, teamQuery.data?.assignments]);
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['food-workforce-dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['food-management-overview'] }),
    ]);
  };
  const scheduleMutation = useMutation({
    mutationFn: () => saveFoodWorkSchedule({ ...scheduleForm, personId: Number(scheduleForm.personId), branchId }),
    onSuccess: async () => { setShowSchedule(false); setScheduleForm({ personId: '', workDate: today(), startTime: '08:00', endTime: '17:00', notes: '' }); await refresh(); },
  });
  const archiveMutation = useMutation({ mutationFn: (item: FoodWorkSchedule) => archiveFoodWorkSchedule(item.id, 'Horário removido pelo gestor'), onSuccess: refresh });
  const reviewMutation = useMutation({
    mutationFn: () => reviewFoodCashDifference(review!.session.id, { decision: review!.decision, note: reviewNote || undefined }),
    onSuccess: async () => { setReview(null); setReviewNote(''); await refresh(); },
  });
  const error = contextQuery.error || teamQuery.error || dashboardQuery.error;
  if (error) return <div className="mx-auto max-w-7xl p-4 md:p-6"><ErrorState title="Não foi possível abrir a equipa" message={getApiErrorMessage(error)} onRetry={() => Promise.all([contextQuery.refetch(), teamQuery.refetch(), dashboardQuery.refetch()])} /></div>;
  const dashboard = dashboardQuery.data;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6" style={getFoodBrandStyle(settingsQuery.data)}>
      <FoodPageHeader eyebrow="Gestão Food" title="Equipa e Caixas" description="Turnos, horários, produtividade e diferenças de Caixa.">
        <Button asChild variant="outline"><Link href="/food/gestao"><ArrowLeft className="mr-2 h-4 w-4" />Gestão</Link></Button>
        {canEdit ? <Button asChild variant="outline"><Link href="/food/configuracoes?section=team"><UserPlus className="mr-2 h-4 w-4" />Gerir colaboradores</Link></Button> : null}
        {canEdit ? <Button disabled={!branchId} onClick={() => setShowSchedule((value) => !value)}><Plus className="mr-2 h-4 w-4" />Horário</Button> : null}
      </FoodPageHeader>

      <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2">
        <label className="text-sm font-semibold text-slate-600">Unidade<select className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 font-normal text-slate-950" value={branchId} onChange={(event) => setBranchId(event.target.value)}><option value="">Todas autorizadas</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
        <label className="text-sm font-semibold text-slate-600">Período<select className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 font-normal text-slate-950" value={days} onChange={(event) => setDays(Number(event.target.value))}><option value={7}>7 dias</option><option value={30}>30 dias</option><option value={90}>90 dias</option></select></label>
      </div>

      {showSchedule && canEdit ? <Card className="border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-black text-slate-950">Planear horário</h2><div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-5"><div><Label>Colaborador</Label><select className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={scheduleForm.personId} onChange={(event) => setScheduleForm({ ...scheduleForm, personId: event.target.value })}><option value="">Selecionar</option>{people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></div><div><Label>Data</Label><Input className="mt-1" type="date" value={scheduleForm.workDate} onChange={(event) => setScheduleForm({ ...scheduleForm, workDate: event.target.value })} /></div><div><Label>Entrada</Label><Input className="mt-1" type="time" value={scheduleForm.startTime} onChange={(event) => setScheduleForm({ ...scheduleForm, startTime: event.target.value })} /></div><div><Label>Saída</Label><Input className="mt-1" type="time" value={scheduleForm.endTime} onChange={(event) => setScheduleForm({ ...scheduleForm, endTime: event.target.value })} /></div><div><Label>Nota</Label><Input className="mt-1" value={scheduleForm.notes} onChange={(event) => setScheduleForm({ ...scheduleForm, notes: event.target.value })} /></div></div>{scheduleMutation.isError ? <p className="mt-3 text-sm font-semibold text-red-600">{getApiErrorMessage(scheduleMutation.error)}</p> : null}<div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => setShowSchedule(false)}>Cancelar</Button><Button disabled={!branchId || !scheduleForm.personId || !scheduleForm.workDate || scheduleMutation.isPending} onClick={() => scheduleMutation.mutate()}>Guardar horário</Button></div></Card> : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Em trabalho" value={dashboard?.summary.peopleWorking ?? 0} icon={UsersRound} tone="bg-emerald-50 text-emerald-700" /><Metric label="Caixas abertos" value={dashboard?.summary.openCashSessions ?? 0} icon={Banknote} tone="bg-blue-50 text-blue-700" /><Metric label="Diferenças pendentes" value={dashboard?.summary.pendingApprovals ?? 0} icon={AlertTriangle} tone="bg-amber-50 text-amber-700" /><Metric label="Horas no período" value={formatHours(dashboard?.summary.hours ?? 0)} icon={Clock3} tone="bg-slate-100 text-slate-700" /></div>

      <section><div className="mb-3"><h2 className="text-lg font-black text-slate-950">Em trabalho agora</h2><p className="text-sm text-slate-500">Turnos abertos nas unidades autorizadas.</p></div>{dashboardQuery.isLoading ? <div className="h-28 animate-pulse rounded-lg bg-white" /> : !dashboard?.activeShifts.length ? <FoodEmptyState icon={UsersRound} title="Ninguém em turno" description="Os turnos abertos aparecerão aqui em tempo real." /> : <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{dashboard.activeShifts.map((shift) => <div key={shift.id} className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-4"><div><p className="font-black text-emerald-950">{shift.person?.name}</p><p className="text-sm text-emerald-700">{shift.branch?.name} · desde {new Date(shift.startedAt).toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' })}</p></div><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /></div>)}</div>}</section>

      <section><div className="mb-3"><h2 className="text-lg font-black text-slate-950">Próximos horários</h2><p className="text-sm text-slate-500">Planeamento dos próximos 14 dias.</p></div>{!dashboard?.schedules.length ? <FoodEmptyState icon={CalendarDays} title="Sem horários planeados" description="Escolha uma unidade e adicione o primeiro horário." /> : <div className="overflow-hidden rounded-lg border border-slate-200 bg-white"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Colaborador</th><th className="px-4 py-3">Unidade</th><th className="px-4 py-3">Horário</th><th className="px-4 py-3">Nota</th><th className="px-4 py-3 text-right">Acção</th></tr></thead><tbody className="divide-y divide-slate-100">{dashboard.schedules.map((item) => <tr key={item.id}><td className="px-4 py-3 font-semibold text-slate-950">{new Date(item.workDate).toLocaleDateString('pt-AO', { day: '2-digit', month: 'short' })}</td><td className="px-4 py-3 text-slate-700">{item.person?.name}</td><td className="px-4 py-3 text-slate-600">{item.branch?.name}</td><td className="px-4 py-3 font-semibold text-slate-800">{item.startTime}–{item.endTime}</td><td className="px-4 py-3 text-slate-500">{item.notes || '—'}</td><td className="px-4 py-3 text-right">{canEdit ? <Button size="icon" variant="ghost" title="Remover horário" disabled={archiveMutation.isPending} onClick={() => archiveMutation.mutate(item)}><Trash2 className="h-4 w-4 text-red-600" /></Button> : null}</td></tr>)}</tbody></table></div></div>}</section>

      <section><div className="mb-3"><h2 className="text-lg font-black text-slate-950">Produtividade</h2><p className="text-sm text-slate-500">Indicadores derivados dos registos do período, sem metas automáticas.</p></div><div className="overflow-hidden rounded-lg border border-slate-200 bg-white"><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Colaborador</th><th className="px-4 py-3">Funções</th><th className="px-4 py-3">Horas</th><th className="px-4 py-3">Pedidos</th><th className="px-4 py-3">Valor pedidos</th><th className="px-4 py-3">Vendas Caixa</th><th className="px-4 py-3">Diferenças</th></tr></thead><tbody className="divide-y divide-slate-100">{(dashboard?.performance ?? []).map((row) => <tr key={row.person.id}><td className="px-4 py-3"><p className="font-bold text-slate-950">{row.person.name}</p><p className="text-xs text-slate-500">{row.person.email}</p></td><td className="px-4 py-3 text-slate-600">{row.roles.map((role) => roleLabels[role] || role).join(', ')}</td><td className="px-4 py-3 font-semibold text-slate-800">{formatHours(row.hours)}</td><td className="px-4 py-3 text-slate-700">{row.orders}</td><td className="px-4 py-3 text-slate-700">{formatKz(row.orderValue)}</td><td className="px-4 py-3 text-slate-700">{formatKz(row.cashSales)}</td><td className="px-4 py-3"><span className={row.cashDifference > 0 ? 'font-bold text-amber-700' : 'text-slate-500'}>{formatKz(row.cashDifference)}</span>{row.pendingApprovals ? <Badge className="ml-2" variant="secondary">{row.pendingApprovals} pendente</Badge> : null}</td></tr>)}</tbody></table></div></div></section>

      <section><div className="mb-3"><h2 className="text-lg font-black text-slate-950">Histórico de Caixas</h2><p className="text-sm text-slate-500">Valores esperados, contados e análise das diferenças.</p></div>{!dashboard?.cashSessions.length ? <FoodEmptyState icon={Banknote} title="Sem sessões no período" description="As sessões abertas e fechadas aparecerão aqui." /> : <div className="overflow-hidden rounded-lg border border-slate-200 bg-white"><div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Abertura</th><th className="px-4 py-3">Operador</th><th className="px-4 py-3">Unidade</th><th className="px-4 py-3">Vendas</th><th className="px-4 py-3">Esperado</th><th className="px-4 py-3">Contado</th><th className="px-4 py-3">Diferença</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3 text-right">Análise</th></tr></thead><tbody className="divide-y divide-slate-100">{dashboard.cashSessions.map((session) => { const operator = dashboard.performance.find((row) => row.person.id === session.openedByUserId)?.person.name || `Utilizador ${session.openedByUserId}`; return <tr key={session.id}><td className="whitespace-nowrap px-4 py-3 text-slate-600">{new Date(session.openedAt).toLocaleString('pt-AO')}</td><td className="px-4 py-3 font-semibold text-slate-800">{operator}</td><td className="px-4 py-3 text-slate-600">{session.branch?.name}</td><td className="px-4 py-3 text-slate-700">{formatKz(session.totalSalesAmount)}</td><td className="px-4 py-3 text-slate-700">{formatKz(session.expectedClosingAmount)}</td><td className="px-4 py-3 text-slate-700">{session.closingCountedAmount == null ? 'Aberto' : formatKz(session.closingCountedAmount)}</td><td className={`px-4 py-3 font-bold ${Math.abs(Number(session.differenceAmount || 0)) > 0.005 ? 'text-amber-700' : 'text-slate-500'}`}>{session.differenceAmount == null ? '—' : formatKz(session.differenceAmount)}</td><td className="px-4 py-3"><Badge variant={session.approvalStatus === 'approved' ? 'success' : session.approvalStatus === 'pending' ? 'secondary' : 'outline'}>{approvalLabels[session.approvalStatus]}</Badge></td><td className="px-4 py-3 text-right">{session.approvalStatus === 'pending' ? <div className="flex justify-end gap-1"><Button size="icon" variant="ghost" title="Aprovar diferença" onClick={() => { setReview({ session, decision: 'approved' }); setReviewNote(''); }}><Check className="h-4 w-4 text-emerald-700" /></Button><Button size="icon" variant="ghost" title="Rejeitar diferença" onClick={() => { setReview({ session, decision: 'rejected' }); setReviewNote(''); }}><X className="h-4 w-4 text-red-700" /></Button></div> : session.approvalNote ? <span className="text-xs text-slate-500">{session.approvalNote}</span> : null}</td></tr>; })}</tbody></table></div></div>}</section>

      {review ? <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-4 md:items-center" onMouseDown={(event) => { if (event.target === event.currentTarget) setReview(null); }}><Card className="w-full max-w-md border-slate-200 bg-white p-5 shadow-xl"><h3 className="text-lg font-black text-slate-950">{review.decision === 'approved' ? 'Aprovar diferença?' : 'Rejeitar diferença?'}</h3><p className="mt-1 text-sm text-slate-500">Diferença de {formatKz(review.session.differenceAmount || 0)}. A decisão ficará na auditoria.</p><div className="mt-4"><Label>Nota {review.decision === 'rejected' ? '*' : '(opcional)'}</Label><Input className="mt-1" value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} /></div>{reviewMutation.isError ? <p className="mt-3 text-sm font-semibold text-red-600">{getApiErrorMessage(reviewMutation.error)}</p> : null}<div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setReview(null)}>Cancelar</Button><Button variant={review.decision === 'rejected' ? 'destructive' : 'default'} disabled={(review.decision === 'rejected' && reviewNote.trim().length < 3) || reviewMutation.isPending} onClick={() => reviewMutation.mutate()}>{review.decision === 'approved' ? 'Aprovar' : 'Rejeitar'}</Button></div></Card></div> : null}
    </div>
  );
}
