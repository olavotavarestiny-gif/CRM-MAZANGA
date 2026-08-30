'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, BadgePercent, CheckCircle2, Eye, FileUp, Megaphone, MessageSquareText, RotateCcw, Search, UserPlus, Users } from 'lucide-react';
import {
  createFoodCoupon,
  createFoodMarketingCampaign,
  getFoodMarketingOverview,
  getFoodCustomerDuplicates,
  getFoodSettings,
  getFoodV1Customers,
} from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api-error-message';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FoodEmptyState, FoodPageHeader, FoodTabs, getFoodBrandStyle } from '@/components/food/food-ui';
import { FoodCustomerDialog } from '@/components/food/food-customer-dialog';
import { FoodCustomerDuplicatesDialog } from '@/components/food/food-customer-duplicates-dialog';
import { FoodCustomerImportDialog } from '@/components/food/food-customer-import-dialog';
import { FoodBirthdayPanel } from '@/components/food/food-birthday-panel';

type Tab = 'customers' | 'birthdays' | 'coupons' | 'campaigns';

const TAB_META: Record<Tab, { title: string; description: string }> = {
  customers: { title: 'Clientes Food', description: 'Identidade partilhada com o CRM, métricas e consentimentos próprios do restaurante.' },
  birthdays: { title: 'Aniversários', description: 'Oportunidades de relacionamento baseadas em data válida e consentimento.' },
  coupons: { title: 'Cupões', description: 'Incentivos controlados, regras de utilização e impacto comercial.' },
  campaigns: { title: 'Campanhas', description: 'Rascunhos segmentados com consentimento e atribuição de resultados.' },
};

function formatKz(value: number) {
  return `${new Intl.NumberFormat('pt-AO', { maximumFractionDigits: 2 }).format(Number(value || 0))} Kz`;
}

function customerTags(value?: string) {
  try {
    const tags = JSON.parse(value || '[]');
    return Array.isArray(tags) ? tags.filter((tag) => tag && tag !== 'food').slice(0, 3) as string[] : [];
  } catch (_error) {
    return [];
  }
}

export default function FoodCrmPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>('customers');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [duplicatesDialogOpen, setDuplicatesDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [customerFilters, setCustomerFilters] = useState({ segment: 'all', zone: '', tag: '', marketingConsent: 'all', minOrders: '', minSpent: '' });
  const [coupon, setCoupon] = useState({ code: '', name: '', discountType: 'percentage' as 'fixed' | 'percentage', discountValue: '10', minimumOrder: '0' });
  const [campaign, setCampaign] = useState({ name: '', channel: 'SMS' as 'SMS' | 'WHATSAPP', content: '', couponId: '' });

  useEffect(() => {
    const requestedTab = searchParams.get('tab');
    if (requestedTab === 'customers' || requestedTab === 'birthdays' || requestedTab === 'coupons' || requestedTab === 'campaigns') {
      setTab(requestedTab);
      setShowCreate(false);
    }
  }, [searchParams]);

  const selectTab = (value: Tab) => {
    setTab(value);
    setShowCreate(false);
    router.replace(`/food/crm?tab=${value}`, { scroll: false });
  };
  const settingsQuery = useQuery({ queryKey: ['food-settings'], queryFn: getFoodSettings });
  const overviewQuery = useQuery({ queryKey: ['food-marketing-overview'], queryFn: getFoodMarketingOverview });
  const customerQueryParams = {
    search,
    segment: customerFilters.segment as 'all' | 'new' | 'recurring' | 'vip' | 'inactive' | 'at_risk',
    zone: customerFilters.zone || undefined,
    tag: customerFilters.tag || undefined,
    marketingConsent: customerFilters.marketingConsent === 'all' ? null : customerFilters.marketingConsent === 'true',
    minOrders: customerFilters.minOrders ? Number(customerFilters.minOrders) : null,
    minSpent: customerFilters.minSpent ? Number(customerFilters.minSpent) : null,
  };
  const customersQuery = useQuery({ queryKey: ['food-v1-customers', customerQueryParams], queryFn: () => getFoodV1Customers(customerQueryParams), enabled: tab === 'customers' });
  const duplicatesQuery = useQuery({ queryKey: ['food-customer-duplicates'], queryFn: getFoodCustomerDuplicates, enabled: tab === 'customers' });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['food-marketing-overview'] });
  const couponMutation = useMutation({
    mutationFn: () => createFoodCoupon({ code: coupon.code, name: coupon.name, discountType: coupon.discountType, discountValue: Number(coupon.discountValue), minimumOrder: Number(coupon.minimumOrder) }),
    onSuccess: async () => {
      setCoupon({ code: '', name: '', discountType: 'percentage', discountValue: '10', minimumOrder: '0' });
      setShowCreate(false);
      await refresh();
    },
  });
  const campaignMutation = useMutation({
    mutationFn: () => createFoodMarketingCampaign({ name: campaign.name, channel: campaign.channel, content: campaign.content, couponId: campaign.couponId || undefined }),
    onSuccess: async () => {
      setCampaign({ name: '', channel: 'SMS', content: '', couponId: '' });
      setShowCreate(false);
      await refresh();
    },
  });
  const overview = overviewQuery.data;
  const consentRate = overview?.customers ? Math.round((overview.consented / overview.customers) * 100) : 0;
  const error = overviewQuery.error || customersQuery.error;
  if (error) {
    return <div className="mx-auto max-w-7xl p-4 md:p-6"><ErrorState title="Não foi possível abrir o CRM Food" message={getApiErrorMessage(error)} onRetry={() => Promise.all([overviewQuery.refetch(), customersQuery.refetch()])} /></div>;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6" style={getFoodBrandStyle(settingsQuery.data)}>
      <FoodPageHeader eyebrow="CRM & Marketing" title={TAB_META[tab].title} description={TAB_META[tab].description}>
        {tab === 'customers' ? <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setDuplicatesDialogOpen(true)}><AlertTriangle className="mr-2 h-4 w-4" />Duplicados{duplicatesQuery.data?.length ? ` (${duplicatesQuery.data.length})` : ''}</Button><Button variant="outline" onClick={() => setImportDialogOpen(true)}><FileUp className="mr-2 h-4 w-4" />Importar CSV</Button><Button onClick={() => { setSelectedCustomerId(null); setCustomerDialogOpen(true); }}><UserPlus className="mr-2 h-4 w-4" />Novo cliente</Button></div> : tab === 'coupons' ? <Button onClick={() => setShowCreate((value) => !value)}><BadgePercent className="mr-2 h-4 w-4" />Novo cupão</Button> : tab === 'campaigns' ? <Button onClick={() => setShowCreate((value) => !value)}><Megaphone className="mr-2 h-4 w-4" />Nova campanha</Button> : null}
      </FoodPageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-slate-500">Clientes Food</p><p className="mt-2 text-3xl font-black text-slate-950">{overview?.customers ?? 0}</p></Card>
        <Card className="border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-slate-500">Com consentimento</p><p className="mt-2 text-3xl font-black text-emerald-700">{overview?.consented ?? 0}</p></Card>
        <Card className="border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-slate-500">Taxa de autorização</p><p className="mt-2 text-3xl font-black text-slate-950">{consentRate}%</p></Card>
      </div>

      <FoodTabs value={tab} onChange={selectTab} tabs={[{ value: 'customers', label: 'Clientes', count: overview?.customers }, { value: 'birthdays', label: 'Aniversários' }, { value: 'coupons', label: 'Cupões', count: overview?.coupons.length }, { value: 'campaigns', label: 'Campanhas', count: overview?.campaigns.length }]} />

      {showCreate && tab === 'coupons' ? <Card className="border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-black text-slate-950">Novo cupão</h2><div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-5"><div><Label>Código</Label><Input className="mt-1 uppercase" value={coupon.code} onChange={(event) => setCoupon({ ...coupon, code: event.target.value.toUpperCase() })} /></div><div className="md:col-span-2"><Label>Nome</Label><Input className="mt-1" value={coupon.name} onChange={(event) => setCoupon({ ...coupon, name: event.target.value })} /></div><div><Label>Tipo</Label><select className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={coupon.discountType} onChange={(event) => setCoupon({ ...coupon, discountType: event.target.value as 'fixed' | 'percentage' })}><option value="percentage">Percentagem</option><option value="fixed">Valor fixo</option></select></div><div><Label>Desconto</Label><Input className="mt-1" type="number" min="0" value={coupon.discountValue} onChange={(event) => setCoupon({ ...coupon, discountValue: event.target.value })} /></div></div><div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button><Button disabled={!coupon.code.trim() || !coupon.name.trim() || couponMutation.isPending} onClick={() => couponMutation.mutate()}>Guardar cupão</Button></div>{couponMutation.isError ? <p className="mt-3 text-sm font-semibold text-red-600">{getApiErrorMessage(couponMutation.error)}</p> : null}</Card> : null}

      {showCreate && tab === 'campaigns' ? <Card className="border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-black text-slate-950">Nova campanha</h2><p className="mt-1 text-sm text-slate-500">A campanha fica em rascunho. O envio será activado apenas com integração tenant-aware.</p><div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3"><div className="md:col-span-2"><Label>Nome</Label><Input className="mt-1" value={campaign.name} onChange={(event) => setCampaign({ ...campaign, name: event.target.value })} /></div><div><Label>Canal</Label><select className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={campaign.channel} onChange={(event) => setCampaign({ ...campaign, channel: event.target.value as 'SMS' | 'WHATSAPP' })}><option value="SMS">SMS</option><option value="WHATSAPP">WhatsApp</option></select></div><div className="md:col-span-3"><Label>Mensagem</Label><Textarea className="mt-1" rows={4} value={campaign.content} onChange={(event) => setCampaign({ ...campaign, content: event.target.value })} /></div><div><Label>Cupão opcional</Label><select className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={campaign.couponId} onChange={(event) => setCampaign({ ...campaign, couponId: event.target.value })}><option value="">Sem cupão</option>{(overview?.coupons ?? []).filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.code}</option>)}</select></div></div><div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button><Button disabled={!campaign.name.trim() || !campaign.content.trim() || campaignMutation.isPending} onClick={() => campaignMutation.mutate()}>Guardar rascunho</Button></div>{campaignMutation.isError ? <p className="mt-3 text-sm font-semibold text-red-600">{getApiErrorMessage(campaignMutation.error)}</p> : null}</Card> : null}

      {tab === 'customers' ? <section className="space-y-4">
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-4">
          <div className="relative md:col-span-2"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome, telefone, email ou morada" /></div>
          <select className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" value={customerFilters.segment} onChange={(event) => setCustomerFilters({ ...customerFilters, segment: event.target.value })}><option value="all">Todos os clientes</option><option value="new">Novos</option><option value="recurring">Recorrentes</option><option value="vip">VIP</option><option value="at_risk">Em risco</option><option value="inactive">Inactivos</option></select>
          <select className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" value={customerFilters.marketingConsent} onChange={(event) => setCustomerFilters({ ...customerFilters, marketingConsent: event.target.value })}><option value="all">Qualquer consentimento</option><option value="true">Marketing autorizado</option><option value="false">Sem autorização</option></select>
          <Input value={customerFilters.zone} onChange={(event) => setCustomerFilters({ ...customerFilters, zone: event.target.value })} placeholder="Zona ou bairro" />
          <Input value={customerFilters.tag} onChange={(event) => setCustomerFilters({ ...customerFilters, tag: event.target.value })} placeholder="Etiqueta" />
          <Input type="number" min="0" value={customerFilters.minOrders} onChange={(event) => setCustomerFilters({ ...customerFilters, minOrders: event.target.value })} placeholder="Mínimo de compras" />
          <div className="flex gap-2"><Input type="number" min="0" value={customerFilters.minSpent} onChange={(event) => setCustomerFilters({ ...customerFilters, minSpent: event.target.value })} placeholder="Valor mínimo Kz" /><Button type="button" size="icon" variant="outline" title="Limpar filtros" onClick={() => { setSearch(''); setCustomerFilters({ segment: 'all', zone: '', tag: '', marketingConsent: 'all', minOrders: '', minSpent: '' }); }}><RotateCcw className="h-4 w-4" /></Button></div>
        </div>

        {customersQuery.isLoading ? <div className="h-52 animate-pulse rounded-lg bg-white" /> : (customersQuery.data ?? []).length === 0 ? <FoodEmptyState icon={Users} title="Nenhum cliente encontrado" description="Ajuste os filtros ou crie um novo cliente Food." actionLabel="Novo cliente" onAction={() => { setSelectedCustomerId(null); setCustomerDialogOpen(true); }} /> : <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Contacto</th><th className="px-4 py-3">Pedidos</th><th className="px-4 py-3">Valor total</th><th className="px-4 py-3">Marketing</th><th className="w-14 px-4 py-3"><span className="sr-only">Acções</span></th></tr></thead><tbody className="divide-y divide-slate-100">{(customersQuery.data ?? []).map((customer) => <tr key={customer.id} className="transition-colors hover:bg-slate-50"><td className="px-4 py-3"><button type="button" className="text-left" onClick={() => { setSelectedCustomerId(customer.id); setCustomerDialogOpen(true); }}><span className="block font-bold text-slate-950 hover:text-[var(--workspace-primary)]">{customer.name}</span><span className="block text-xs text-slate-500">{customer.company || customer.location || 'Cliente particular'}</span>{customerTags(customer.tags).length ? <span className="mt-1 flex flex-wrap gap-1">{customerTags(customer.tags).map((tag) => <span key={tag} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">{tag}</span>)}</span> : null}</button></td><td className="px-4 py-3"><p className="text-slate-700">{customer.phone}</p><p className="text-xs text-slate-500">{customer.email}</p></td><td className="px-4 py-3 font-bold text-slate-950">{customer.foodProfile?.totalOrders ?? 0}</td><td className="px-4 py-3 font-bold text-slate-950">{formatKz(customer.foodProfile?.totalSpent ?? 0)}</td><td className="px-4 py-3">{customer.foodProfile?.marketingConsent ? <Badge variant="success"><CheckCircle2 className="mr-1 h-3 w-3" />Autorizado</Badge> : <Badge variant="secondary">Sem consentimento</Badge>}</td><td className="px-4 py-3"><Button type="button" size="icon" variant="ghost" title="Abrir perfil" onClick={() => { setSelectedCustomerId(customer.id); setCustomerDialogOpen(true); }}><Eye className="h-4 w-4" /></Button></td></tr>)}</tbody></table></div></div>}
      </section> : null}

      {tab === 'birthdays' ? <FoodBirthdayPanel /> : null}

      {tab === 'coupons' ? ((overview?.coupons ?? []).length === 0 ? <FoodEmptyState icon={BadgePercent} title="Sem cupões" description="Crie incentivos controlados para campanhas e retenção." actionLabel="Criar cupão" onAction={() => setShowCreate(true)} /> : <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{overview?.coupons.map((item) => <Card key={item.id} className="border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-lg font-black text-slate-950">{item.code}</p><p className="mt-1 text-sm text-slate-600">{item.name}</p></div><Badge variant={item.active ? 'success' : 'secondary'}>{item.active ? 'Activo' : 'Inactivo'}</Badge></div><p className="mt-4 text-2xl font-black text-[var(--workspace-primary)]">{item.discountType === 'percentage' ? `${Number(item.discountValue)}%` : formatKz(Number(item.discountValue))}</p><p className="mt-1 text-xs text-slate-500">{item._count?.redemptions ?? 0} utilizações</p></Card>)}</div>) : null}

      {tab === 'campaigns' ? ((overview?.campaigns ?? []).length === 0 ? <FoodEmptyState icon={MessageSquareText} title="Sem campanhas" description="Prepare campanhas com consentimento e atribuição de vendas." actionLabel="Criar rascunho" onAction={() => setShowCreate(true)} /> : <div className="space-y-3">{overview?.campaigns.map((item) => <Card key={item.id} className="border-slate-200 bg-white p-4 shadow-sm"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><div className="flex items-center gap-2"><p className="font-black text-slate-950">{item.name}</p><Badge variant="secondary">{item.status}</Badge></div><p className="mt-1 line-clamp-2 text-sm text-slate-600">{item.content}</p></div><div className="flex shrink-0 gap-5 text-sm"><div><p className="text-xs text-slate-500">Canal</p><p className="font-bold text-slate-950">{item.channel}</p></div><div><p className="text-xs text-slate-500">Conversões</p><p className="font-bold text-slate-950">{item.conversionsCount}</p></div><div><p className="text-xs text-slate-500">Receita</p><p className="font-bold text-slate-950">{formatKz(item.attributedRevenue)}</p></div></div></div></Card>)}</div>) : null}

      <FoodCustomerDialog open={customerDialogOpen} customerId={selectedCustomerId} onOpenChange={setCustomerDialogOpen} onSaved={() => customersQuery.refetch()} />
      <FoodCustomerDuplicatesDialog open={duplicatesDialogOpen} onOpenChange={setDuplicatesDialogOpen} />
      <FoodCustomerImportDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} />
    </div>
  );
}
