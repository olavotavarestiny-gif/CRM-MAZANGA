'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, CheckCircle2, Clock, ShieldAlert } from 'lucide-react';
import { getFoodBirthdaySettings, getFoodBirthdays, getFoodMarketingOverview, updateFoodBirthdaySettings } from '@/lib/api';
import type { FoodBirthdaySettings } from '@/lib/types';
import { getApiErrorMessage } from '@/lib/api-error-message';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FoodEmptyState } from '@/components/food/food-ui';

const defaultSettings: FoodBirthdaySettings = {
  enabled: false,
  daysBefore: 0,
  sendTime: '09:00',
  channel: 'WHATSAPP',
  template: 'Feliz aniversário, {{nome}}!',
  benefitType: 'none',
  couponId: null,
  validityDays: 7,
  minimumOrder: 0,
  segmentId: null,
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-AO', { day: '2-digit', month: 'short' }).format(new Date(value));
}

export function FoodBirthdayPanel() {
  const queryClient = useQueryClient();
  const [days, setDays] = useState(30);
  const [form, setForm] = useState<FoodBirthdaySettings>(defaultSettings);
  const birthdaysQuery = useQuery({ queryKey: ['food-birthdays', days], queryFn: () => getFoodBirthdays(days) });
  const settingsQuery = useQuery({ queryKey: ['food-birthday-settings'], queryFn: getFoodBirthdaySettings });
  const overviewQuery = useQuery({ queryKey: ['food-marketing-overview'], queryFn: getFoodMarketingOverview });
  useEffect(() => { if (settingsQuery.data) setForm({ ...defaultSettings, ...settingsQuery.data, enabled: false }); }, [settingsQuery.data]);
  const saveMutation = useMutation({
    mutationFn: () => updateFoodBirthdaySettings({ ...form, enabled: false }),
    onSuccess: async (settings) => {
      setForm({ ...settings, enabled: false });
      await queryClient.invalidateQueries({ queryKey: ['food-birthday-settings'] });
    },
  });
  const birthdays = birthdaysQuery.data || [];
  const eligible = birthdays.filter((item) => item.eligible).length;
  const error = birthdaysQuery.error || settingsQuery.error || overviewQuery.error || saveMutation.error;

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-black text-slate-950">Agenda de aniversários</h2><p className="text-sm text-slate-500">Clientes activos com perfil Food e data de nascimento.</p></div><select className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" value={days} onChange={(event) => setDays(Number(event.target.value))}><option value={7}>Próximos 7 dias</option><option value={30}>Próximos 30 dias</option><option value={90}>Próximos 90 dias</option><option value={366}>Próximo ano</option></select></div>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3"><Card className="border-slate-200 p-4"><p className="text-xs font-bold text-slate-500">No período</p><p className="mt-1 text-2xl font-black text-slate-950">{birthdays.length}</p></Card><Card className="border-slate-200 p-4"><p className="text-xs font-bold text-slate-500">Elegíveis</p><p className="mt-1 text-2xl font-black text-emerald-700">{eligible}</p></Card><Card className="col-span-2 border-slate-200 p-4 sm:col-span-1"><p className="text-xs font-bold text-slate-500">Sem autorização/canal</p><p className="mt-1 text-2xl font-black text-amber-700">{birthdays.length - eligible}</p></Card></div>
    {birthdaysQuery.isLoading ? <div className="h-48 animate-pulse rounded-lg bg-white" /> : birthdays.length === 0 ? <FoodEmptyState icon={CalendarDays} title="Sem aniversários no período" description="As datas registadas nos perfis aparecerão nesta agenda." /> : <div className="overflow-hidden rounded-lg border border-slate-200 bg-white"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Canal</th><th className="px-4 py-3">Estado</th></tr></thead><tbody className="divide-y divide-slate-100">{birthdays.map((item) => <tr key={item.id}><td className="px-4 py-3"><p className="font-black text-slate-950">{item.daysUntil === 0 ? 'Hoje' : formatDate(item.nextBirthday)}</p><p className="text-xs text-slate-500">{item.ageTurning} anos · {item.daysUntil} dias</p></td><td className="px-4 py-3"><p className="font-bold text-slate-950">{item.name}</p><p className="text-xs text-slate-500">{item.phone || item.email}</p></td><td className="px-4 py-3 font-semibold text-slate-700">{item.preferredChannel}</td><td className="px-4 py-3">{item.eligible ? <Badge variant="success"><CheckCircle2 className="mr-1 h-3 w-3" />Elegível</Badge> : <Badge variant="secondary"><ShieldAlert className="mr-1 h-3 w-3" />Bloqueado</Badge>}</td></tr>)}</tbody></table></div></div>}

    <Card className="border-slate-200 bg-white p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="font-black text-slate-950">Configuração preparada</h3><p className="mt-1 text-sm text-slate-500">O disparo permanece desligado; esta configuração será usada quando o canal tenant-aware for activado.</p></div><Badge variant="secondary"><Clock className="mr-1 h-3 w-3" />Sem envio</Badge></div><div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"><div><Label>Antecedência</Label><Input className="mt-1" type="number" min="0" max="30" value={form.daysBefore} onChange={(event) => setForm({ ...form, daysBefore: Number(event.target.value) })} /></div><div><Label>Horário</Label><Input className="mt-1" type="time" value={form.sendTime} onChange={(event) => setForm({ ...form, sendTime: event.target.value })} /></div><div><Label>Canal</Label><select className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.channel} onChange={(event) => setForm({ ...form, channel: event.target.value as FoodBirthdaySettings['channel'] })}><option value="WHATSAPP">WhatsApp</option><option value="SMS">SMS</option><option value="EMAIL">Email</option></select></div><div><Label>Segmento</Label><select className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.segmentId || ''} onChange={(event) => setForm({ ...form, segmentId: event.target.value || null })}><option value="">Todos os elegíveis</option>{(overviewQuery.data?.segments || []).map((segment) => <option key={segment.id} value={segment.id}>{segment.name}</option>)}</select></div><div className="sm:col-span-2 lg:col-span-4"><Label>Mensagem</Label><Textarea className="mt-1" rows={3} value={form.template} onChange={(event) => setForm({ ...form, template: event.target.value })} /></div><div><Label>Benefício</Label><select className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.benefitType} onChange={(event) => setForm({ ...form, benefitType: event.target.value as FoodBirthdaySettings['benefitType'], couponId: event.target.value === 'coupon' ? form.couponId : null })}><option value="none">Sem benefício</option><option value="coupon">Cupão</option></select></div>{form.benefitType === 'coupon' ? <div><Label>Cupão</Label><select className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.couponId || ''} onChange={(event) => setForm({ ...form, couponId: event.target.value || null })}><option value="">Seleccionar</option>{(overviewQuery.data?.coupons || []).filter((coupon) => coupon.active).map((coupon) => <option key={coupon.id} value={coupon.id}>{coupon.code}</option>)}</select></div> : null}<div><Label>Validade em dias</Label><Input className="mt-1" type="number" min="1" max="365" value={form.validityDays} onChange={(event) => setForm({ ...form, validityDays: Number(event.target.value) })} /></div><div><Label>Pedido mínimo</Label><Input className="mt-1" type="number" min="0" value={form.minimumOrder} onChange={(event) => setForm({ ...form, minimumOrder: Number(event.target.value) })} /></div></div>{error ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{getApiErrorMessage(error)}</p> : null}<div className="mt-4 flex justify-end"><Button disabled={!form.template.trim() || (form.benefitType === 'coupon' && !form.couponId) || saveMutation.isPending} onClick={() => saveMutation.mutate()}>{saveMutation.isPending ? 'A guardar...' : 'Guardar configuração'}</Button></div></Card>
  </div>;
}
