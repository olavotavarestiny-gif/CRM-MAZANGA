'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, Banknote, BarChart3, BookOpen, Boxes, CheckCircle2, ClipboardList, PackageSearch, Plus, ReceiptText, ShoppingCart, Store, UsersRound, Utensils } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  adjustFoodIngredient,
  createFoodIngredient,
  getFoodContext,
  getFoodIngredients,
  getFoodManagementOverview,
  getFoodSettings,
} from '@/lib/api';
import type { FoodIngredient } from '@/lib/types';
import { getApiErrorMessage } from '@/lib/api-error-message';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FoodEmptyState, FoodPageHeader, getFoodBrandStyle } from '@/components/food/food-ui';
import { FoodStockReplenishment } from '@/components/food/food-stock-replenishment';

function formatKz(value: number) {
  return `${new Intl.NumberFormat('pt-AO', { maximumFractionDigits: 2 }).format(value || 0)} Kz`;
}

function Metric({ label, value, detail, icon: Icon, tone }: { label: string; value: string | number; detail: string; icon: LucideIcon; tone: string }) {
  return (
    <div className="bg-white p-4 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-1.5 text-xl font-bold text-slate-950 md:text-2xl">{value}</p><p className="mt-1 text-xs text-slate-400">{detail}</p></div>
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${tone}`}><Icon className="h-4 w-4" /></div>
      </div>
    </div>
  );
}

function ManagementArea({ href, title, description, icon: Icon, tone, status }: { href: string; title: string; description: string; icon: LucideIcon; tone: string; status?: string }) {
  return (
    <Link href={href} className="group rounded-lg border border-transparent bg-slate-50/80 p-4 transition hover:border-slate-200 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-primary)]">
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tone}`}><Icon className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2"><h3 className="font-bold text-slate-900">{title}</h3><ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[var(--workspace-primary)]" /></div>
          <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p>
          {status ? <p className="mt-2 text-xs font-semibold text-slate-500">{status}</p> : null}
        </div>
      </div>
    </Link>
  );
}

export default function FoodManagementPage() {
  const queryClient = useQueryClient();
  const [showNewIngredient, setShowNewIngredient] = useState(false);
  const [form, setForm] = useState({ internalCode: '', name: '', unit: 'un', currentStock: '0', minimumStock: '0', idealStock: '0', purchaseUnit: 'un', purchaseConversion: '1', averageCost: '0', branchId: '' });
  const [adjusting, setAdjusting] = useState<FoodIngredient | null>(null);
  const [adjustment, setAdjustment] = useState({ quantity: '', reason: '' });
  const settingsQuery = useQuery({ queryKey: ['food-settings'], queryFn: getFoodSettings });
  const contextQuery = useQuery({ queryKey: ['food-context'], queryFn: getFoodContext });
  const canViewStock = contextQuery.data?.permissions.includes('*') || contextQuery.data?.permissions.includes('stock.view') || false;
  const canEditStock = contextQuery.data?.permissions.includes('*') || contextQuery.data?.permissions.includes('stock.edit') || false;
  const overviewQuery = useQuery({ queryKey: ['food-management-overview'], queryFn: getFoodManagementOverview, refetchInterval: 15_000 });
  const ingredientsQuery = useQuery({ queryKey: ['food-ingredients'], queryFn: () => getFoodIngredients({ active: true }), enabled: canViewStock });

  const createMutation = useMutation({
    mutationFn: () => createFoodIngredient({
      internalCode: form.internalCode,
      name: form.name,
      unit: form.unit,
      currentStock: Number(form.currentStock),
      minimumStock: Number(form.minimumStock),
      idealStock: Number(form.idealStock),
      purchaseUnit: form.purchaseUnit,
      purchaseConversion: Number(form.purchaseConversion),
      averageCost: Number(form.averageCost),
      branchId: form.branchId || null,
    }),
    onSuccess: () => {
      setShowNewIngredient(false);
      setForm({ internalCode: '', name: '', unit: 'un', currentStock: '0', minimumStock: '0', idealStock: '0', purchaseUnit: 'un', purchaseConversion: '1', averageCost: '0', branchId: '' });
      queryClient.invalidateQueries({ queryKey: ['food-ingredients'] });
      queryClient.invalidateQueries({ queryKey: ['food-management-overview'] });
      queryClient.invalidateQueries({ queryKey: ['food-stock-replenishment'] });
    },
  });
  const adjustMutation = useMutation({
    mutationFn: () => adjustFoodIngredient(adjusting!.id, { quantity: Number(adjustment.quantity), reason: adjustment.reason }),
    onSuccess: () => {
      setAdjusting(null);
      setAdjustment({ quantity: '', reason: '' });
      queryClient.invalidateQueries({ queryKey: ['food-ingredients'] });
      queryClient.invalidateQueries({ queryKey: ['food-management-overview'] });
      queryClient.invalidateQueries({ queryKey: ['food-stock-replenishment'] });
    },
  });

  const lowStock = useMemo(() => (ingredientsQuery.data ?? []).filter((item) => item.lowStock), [ingredientsQuery.data]);
  const error = overviewQuery.error || (canViewStock ? ingredientsQuery.error : null) || contextQuery.error;
  if (error) {
    return <div className="mx-auto max-w-7xl p-4 md:p-6"><ErrorState title="Não foi possível abrir a gestão" message={getApiErrorMessage(error)} onRetry={() => Promise.all([overviewQuery.refetch(), ingredientsQuery.refetch(), contextQuery.refetch()])} /></div>;
  }

  const overview = overviewQuery.data;
  const branches = contextQuery.data?.branches ?? [];
  const lowStockCount = lowStock.length || overview?.lowStock || 0;
  const openSessions = overview?.openSessions ?? 0;
  const cancelledOrders = overview?.orders.cancelled ?? 0;
  const hasAttention = lowStockCount > 0 || openSessions > 0;
  const managementDate = new Intl.DateTimeFormat('pt-AO', { weekday: 'long', day: '2-digit', month: 'long' }).format(new Date());
  return (
    <div className="mx-auto max-w-7xl space-y-8 p-4 md:p-6" style={getFoodBrandStyle(settingsQuery.data)}>
      <FoodPageHeader eyebrow="Gestão Food" title="Painel operacional" description={`${managementDate} · ${branches.length} ${branches.length === 1 ? 'unidade autorizada' : 'unidades autorizadas'}`}>
        <Button asChild variant="outline"><Link href="/food/gestao/relatorios"><BarChart3 className="mr-2 h-4 w-4" />Relatórios</Link></Button>
        <Button asChild><Link href="/food/novo-pedido"><Plus className="mr-2 h-4 w-4" />Novo pedido</Link></Button>
      </FoodPageHeader>

      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-slate-200/80 bg-slate-100 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Pedidos" value={overview?.orders.total ?? 0} detail={`${cancelledOrders} cancelado${cancelledOrders === 1 ? '' : 's'}`} icon={ClipboardList} tone="bg-blue-50 text-blue-700" />
        <Metric label="Receita recebida" value={formatKz(overview?.revenue ?? 0)} detail="Pagamentos confirmados" icon={Banknote} tone="bg-emerald-50 text-emerald-700" />
        <Metric label="Ticket médio" value={formatKz(overview?.averageTicket ?? 0)} detail={`${overview?.paymentsCount ?? 0} pagamento${overview?.paymentsCount === 1 ? '' : 's'}`} icon={ReceiptText} tone="bg-amber-50 text-amber-700" />
        <Metric label="Stock em alerta" value={lowStockCount} detail="No mínimo ou abaixo" icon={AlertTriangle} tone="bg-red-50 text-red-700" />
      </div>

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.2fr)]">
        <div>
          <div className="mb-3"><h2 className="text-lg font-bold text-slate-950">Atenção agora</h2><p className="text-sm text-slate-500">Só aparecem situações que precisam de decisão.</p></div>
          {!hasAttention ? (
            <div className="flex items-center gap-3 rounded-lg border border-emerald-100 bg-emerald-50/60 px-4 py-4 text-emerald-900">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
              <div><p className="font-semibold">Tudo certo por agora.</p><p className="text-sm text-emerald-700">Sem alertas de stock ou Caixas por fechar.</p></div>
            </div>
          ) : <div className="overflow-hidden rounded-lg border border-slate-200/80 bg-white">
            {lowStockCount > 0 ? <Link href="/food/gestao/stock" className="flex items-center gap-3 border-b border-slate-100 px-4 py-4 last:border-b-0 hover:bg-slate-50/70">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${lowStockCount ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{lowStockCount ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}</div>
              <div className="min-w-0 flex-1"><p className="font-bold text-slate-950">Stock baixo</p><p className="text-sm text-slate-500">{lowStockCount ? `${lowStockCount} ingrediente${lowStockCount === 1 ? '' : 's'} para rever` : 'Sem alertas de reposição'}</p></div>
              <ArrowRight className="h-4 w-4 text-slate-300" />
            </Link> : null}
            {openSessions > 0 ? <Link href="/food/gestao/equipa" className="flex items-center gap-3 px-4 py-4 hover:bg-slate-50/70">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${openSessions ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{openSessions ? <Store className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}</div>
              <div className="min-w-0 flex-1"><p className="font-bold text-slate-950">Caixas abertos</p><p className="text-sm text-slate-500">{openSessions ? `${openSessions} ${openSessions === 1 ? 'sessão' : 'sessões'} por fechar` : 'Nenhuma sessão aberta'}</p></div>
              <ArrowRight className="h-4 w-4 text-slate-300" />
            </Link> : null}
          </div>}
        </div>

        <div>
          <div className="mb-3"><h2 className="text-lg font-bold text-slate-950">Ações rápidas</h2><p className="text-sm text-slate-500">Abra directamente a ferramenta necessária.</p></div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ManagementArea href="/food/produtos?tab=products" title="Menu" description="Produtos, categorias e extras." icon={Utensils} tone="bg-rose-50 text-rose-700" />
            {canViewStock ? <ManagementArea href="/food/gestao/stock" title="Stock" description="Inventário e movimentos." icon={PackageSearch} tone="bg-cyan-50 text-cyan-700" status={lowStockCount ? `${lowStockCount} em alerta` : 'Sem alertas'} /> : null}
            {canViewStock ? <ManagementArea href="/food/gestao/fichas" title="Fichas técnicas" description="Consumo, custo e margem." icon={BookOpen} tone="bg-violet-50 text-violet-700" /> : null}
            {canViewStock ? <ManagementArea href="/food/gestao/compras" title="Compras" description="Fornecedores e recepções." icon={ShoppingCart} tone="bg-blue-50 text-blue-700" /> : null}
            <ManagementArea href="/food/gestao/equipa" title="Equipa e Caixas" description="Horários, turnos e diferenças." icon={UsersRound} tone="bg-amber-50 text-amber-700" status={openSessions ? `${openSessions} ${openSessions === 1 ? 'Caixa aberto' : 'Caixas abertos'}` : undefined} />
            <ManagementArea href="/food/gestao/relatorios" title="Relatórios" description="Reconciliação e fecho mensal." icon={BarChart3} tone="bg-emerald-50 text-emerald-700" />
          </div>
        </div>
      </section>

      {canViewStock ? (
        <div className="flex flex-col gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-end sm:justify-between">
          <div><h2 className="text-xl font-bold text-slate-950">Stock e abastecimento</h2><p className="mt-1 text-sm text-slate-500">Reposição recomendada e inventário actual.</p></div>
          {canEditStock ? <Button onClick={() => setShowNewIngredient((value) => !value)}><Plus className="mr-2 h-4 w-4" />Novo ingrediente</Button> : null}
        </div>
      ) : null}

      {showNewIngredient && canEditStock ? (
        <Card className="border-slate-200/80 bg-white p-5 shadow-none">
          <div className="mb-4"><h2 className="text-lg font-black text-slate-950">Novo ingrediente</h2><p className="text-sm text-slate-500">O stock Food é independente do catálogo comercial.</p></div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div><Label>Código</Label><Input className="mt-1" value={form.internalCode} onChange={(event) => setForm({ ...form, internalCode: event.target.value })} /></div>
            <div className="md:col-span-2"><Label>Nome</Label><Input className="mt-1" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div>
            <div><Label>Unidade</Label><Input className="mt-1" value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} /></div>
            <div><Label>Stock actual</Label><Input className="mt-1" type="number" min="0" value={form.currentStock} onChange={(event) => setForm({ ...form, currentStock: event.target.value })} /></div>
            <div><Label>Stock mínimo</Label><Input className="mt-1" type="number" min="0" value={form.minimumStock} onChange={(event) => setForm({ ...form, minimumStock: event.target.value })} /></div>
            <div><Label>Nível ideal</Label><Input className="mt-1" type="number" min="0" value={form.idealStock} onChange={(event) => setForm({ ...form, idealStock: event.target.value })} /></div>
            <div><Label>Unidade de compra</Label><Input className="mt-1" value={form.purchaseUnit} onChange={(event) => setForm({ ...form, purchaseUnit: event.target.value })} /></div>
            <div><Label>Quantidade por embalagem</Label><Input className="mt-1" type="number" min="0.000001" step="0.001" value={form.purchaseConversion} onChange={(event) => setForm({ ...form, purchaseConversion: event.target.value })} /></div>
            <div><Label>Custo médio</Label><Input className="mt-1" type="number" min="0" value={form.averageCost} onChange={(event) => setForm({ ...form, averageCost: event.target.value })} /></div>
            <div><Label>Unidade Food</Label><select className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.branchId} onChange={(event) => setForm({ ...form, branchId: event.target.value })}><option value="">Todas</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></div>
          </div>
          <div className="mt-5 flex items-center justify-end gap-2"><Button variant="outline" onClick={() => setShowNewIngredient(false)}>Cancelar</Button><Button disabled={!form.internalCode.trim() || !form.name.trim() || Number(form.purchaseConversion) <= 0 || Number(form.idealStock) < Number(form.minimumStock) || createMutation.isPending} onClick={() => createMutation.mutate()}>Guardar ingrediente</Button></div>
          {createMutation.isError ? <p className="mt-3 text-sm font-semibold text-red-600">{getApiErrorMessage(createMutation.error)}</p> : null}
        </Card>
      ) : null}

      {canViewStock ? <FoodStockReplenishment canEdit={canEditStock} /> : null}

      {canViewStock ? <section>
        <div className="mb-3"><h2 className="text-lg font-bold text-slate-950">Matérias-primas</h2><p className="text-sm text-slate-500">Stock actual e limite mínimo. Os ajustes ficam registados.</p></div>
        {ingredientsQuery.isLoading ? <div className="h-40 animate-pulse rounded-lg bg-white" /> : (ingredientsQuery.data ?? []).length === 0 ? (
          <FoodEmptyState icon={Boxes} title="Ainda não há ingredientes" description="Registe as matérias-primas usadas nas fichas técnicas." actionLabel="Adicionar ingrediente" onAction={() => setShowNewIngredient(true)} />
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200/80 bg-white">
            <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b border-slate-100 bg-slate-50/60 text-xs font-semibold text-slate-500"><tr><th className="px-5 py-3">Ingrediente</th><th className="px-4 py-3">Stock actual</th><th className="px-4 py-3">Mínimo</th><th className="px-4 py-3">Estado</th><th className="px-5 py-3 text-right">Acção</th></tr></thead><tbody className="divide-y divide-slate-100">{(ingredientsQuery.data ?? []).map((ingredient) => { const current = Number(ingredient.currentStock); const minimum = Number(ingredient.minimumStock); const critical = minimum > 0 && current <= 0; return <tr key={ingredient.id} className="hover:bg-slate-50/50"><td className="px-5 py-4"><p className="font-semibold text-slate-900">{ingredient.name}</p><p className="mt-0.5 text-xs text-slate-500">{ingredient.internalCode} · {ingredient.unit}{ingredient.branch?.name ? ` · ${ingredient.branch.name}` : ''}</p></td><td className="px-4 py-4"><span className="font-bold text-slate-900">{current.toLocaleString('pt-AO')}</span> <span className="text-xs text-slate-400">{ingredient.unit}</span></td><td className="px-4 py-4"><span className="font-medium text-slate-600">{minimum.toLocaleString('pt-AO')}</span> <span className="text-xs text-slate-400">{ingredient.unit}</span></td><td className="px-4 py-4">{critical ? <Badge className="border-0 bg-red-50 text-red-700">Crítico</Badge> : ingredient.lowStock ? <Badge className="border-0 bg-amber-50 text-amber-700">Atenção</Badge> : <Badge className="border-0 bg-emerald-50 text-emerald-700">Normal</Badge>}</td><td className="px-5 py-4 text-right"><Button size="sm" variant="ghost" onClick={() => setAdjusting(ingredient)}>Ajustar</Button></td></tr>; })}</tbody></table></div>
          </div>
        )}
      </section> : null}

      {adjusting && canEditStock ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-4 md:items-center" onMouseDown={(event) => { if (event.target === event.currentTarget) setAdjusting(null); }}>
          <Card className="w-full max-w-md border-slate-200 bg-white p-5 shadow-xl">
            <h2 className="text-lg font-black text-slate-950">Ajustar {adjusting.name}</h2><p className="mt-1 text-sm text-slate-500">Use valor positivo para entrada e negativo para saída.</p>
            <div className="mt-4 space-y-4"><div><Label>Quantidade</Label><Input className="mt-1" type="number" value={adjustment.quantity} onChange={(event) => setAdjustment({ ...adjustment, quantity: event.target.value })} /></div><div><Label>Motivo</Label><Input className="mt-1" value={adjustment.reason} onChange={(event) => setAdjustment({ ...adjustment, reason: event.target.value })} /></div></div>
            {adjustMutation.isError ? <p className="mt-3 text-sm font-semibold text-red-600">{getApiErrorMessage(adjustMutation.error)}</p> : null}
            <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setAdjusting(null)}>Cancelar</Button><Button disabled={!adjustment.quantity || !adjustment.reason.trim() || adjustMutation.isPending} onClick={() => adjustMutation.mutate()}>Confirmar ajuste</Button></div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
