'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, PackageSearch, Settings2 } from 'lucide-react';
import { getFoodStockReplenishment, getFoodSuppliers, updateFoodIngredientPolicy } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api-error-message';
import type { FoodStockReplenishmentItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type PolicyForm = {
  minimumStock: string;
  idealStock: string;
  purchaseUnit: string;
  purchaseConversion: string;
  preferredSupplierId: string;
};

function policyForm(item: FoodStockReplenishmentItem): PolicyForm {
  return {
    minimumStock: String(item.minimumStock),
    idealStock: String(item.idealStock),
    purchaseUnit: item.ingredient.purchaseUnit || item.ingredient.unit,
    purchaseConversion: String(item.ingredient.purchaseConversion || 1),
    preferredSupplierId: item.ingredient.preferredSupplierId || '',
  };
}

function quantity(value: number) {
  return new Intl.NumberFormat('pt-AO', { maximumFractionDigits: 3 }).format(value || 0);
}

export function FoodStockReplenishment({ canEdit }: { canEdit: boolean }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<FoodStockReplenishmentItem | null>(null);
  const [form, setForm] = useState<PolicyForm | null>(null);
  const replenishmentQuery = useQuery({ queryKey: ['food-stock-replenishment'], queryFn: getFoodStockReplenishment, refetchInterval: 15_000 });
  const suppliersQuery = useQuery({ queryKey: ['food-suppliers'], queryFn: getFoodSuppliers, enabled: canEdit });
  const saveMutation = useMutation({
    mutationFn: () => updateFoodIngredientPolicy(editing!.ingredient.id, {
      minimumStock: Number(form!.minimumStock),
      idealStock: Number(form!.idealStock),
      purchaseUnit: form!.purchaseUnit,
      purchaseConversion: Number(form!.purchaseConversion),
      preferredSupplierId: form!.preferredSupplierId || null,
      reason: 'Política de reposição actualizada',
    }),
    onSuccess: async () => {
      setEditing(null);
      setForm(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['food-stock-replenishment'] }),
        queryClient.invalidateQueries({ queryKey: ['food-ingredients'] }),
        queryClient.invalidateQueries({ queryKey: ['food-management-overview'] }),
      ]);
    },
  });
  const data = replenishmentQuery.data;
  const openPolicy = (item: FoodStockReplenishmentItem) => {
    setEditing(item);
    setForm(policyForm(item));
  };
  const suppliers = (suppliersQuery.data || []).filter((supplier) => !supplier.branchId || supplier.branchId === editing?.ingredient.branchId);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-lg font-bold text-slate-950">Reposição</h2><p className="text-sm text-slate-500">Sugestões baseadas no nível ideal e nas compras pendentes.</p></div>
        {data?.summary.alerts ? <div className="flex gap-2 text-xs font-bold"><span className="rounded bg-amber-50 px-2.5 py-1 text-amber-700">{data.summary.alerts} alertas</span>{data.summary.critical ? <span className="rounded bg-red-50 px-2.5 py-1 text-red-700">{data.summary.critical} críticos</span> : null}</div> : null}
      </div>

      {replenishmentQuery.isLoading ? <div className="h-32 animate-pulse rounded-lg bg-white" /> : null}
      {replenishmentQuery.error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{getApiErrorMessage(replenishmentQuery.error)}</p> : null}
      {!replenishmentQuery.isLoading && !data?.items.length ? <div className="flex items-center gap-3 rounded-lg border border-emerald-100 bg-emerald-50/60 px-4 py-4"><CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" /><div><p className="text-sm font-semibold text-emerald-900">Stock dentro dos níveis definidos.</p><p className="text-xs text-emerald-700">Sem necessidades de reposição.</p></div></div> : null}

      {data?.items.length ? <div className="overflow-hidden rounded-lg border border-slate-200/80 bg-white"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-slate-100 bg-slate-50/60 text-xs font-semibold text-slate-500"><tr><th className="px-5 py-3">Ingrediente</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Níveis</th><th className="px-4 py-3">Reposição</th><th className="px-5 py-3 text-right">Acção</th></tr></thead><tbody className="divide-y divide-slate-100">{data.items.map((item) => <tr key={item.ingredient.id} className="hover:bg-slate-50/50"><td className="px-5 py-4"><div className="flex items-center gap-2">{item.needsAlert ? <AlertTriangle className={`h-4 w-4 shrink-0 ${item.severity === 'critical' ? 'text-red-600' : 'text-amber-600'}`} /> : <PackageSearch className="h-4 w-4 shrink-0 text-slate-400" />}<div><p className="font-semibold text-slate-900">{item.ingredient.name}</p><p className="mt-0.5 text-xs text-slate-500">{item.ingredient.branch?.name || 'Todas as unidades'} · {item.ingredient.unit}</p></div></div></td><td className="px-4 py-4">{item.severity === 'critical' ? <Badge className="border-0 bg-red-50 text-red-700">Crítico</Badge> : item.needsAlert ? <Badge className="border-0 bg-amber-50 text-amber-700">Atenção</Badge> : <Badge className="border-0 bg-emerald-50 text-emerald-700">Normal</Badge>}</td><td className="px-4 py-4"><div className="grid grid-cols-3 gap-3 text-xs"><div><p className="text-slate-400">Actual</p><p className="mt-0.5 font-bold text-slate-900">{quantity(item.currentStock)}</p></div><div><p className="text-slate-400">Mínimo</p><p className="mt-0.5 font-semibold text-slate-600">{quantity(item.minimumStock)}</p></div><div><p className="text-slate-400">Ideal</p><p className="mt-0.5 font-semibold text-slate-600">{quantity(item.idealStock)}</p></div></div></td><td className="px-4 py-4">{item.recommendedQuantity > 0 ? <><p className="font-bold text-slate-900">{quantity(item.recommendedQuantity)} {item.ingredient.unit}</p><p className="mt-0.5 text-xs text-slate-500">{item.recommendedPackages} {item.ingredient.purchaseUnit}{item.pendingQuantity > 0 ? ` · ${quantity(item.pendingQuantity)} pendente` : ''}</p></> : <span className="text-slate-400">Não necessária</span>}</td><td className="px-5 py-4"><div className="flex justify-end gap-1">{canEdit && item.recommendedQuantity > 0 ? <Button asChild size="sm" variant="secondary"><Link href="/food/gestao/compras">Repor</Link></Button> : null}{canEdit ? <Button type="button" size="icon" variant="ghost" title="Editar política" aria-label={`Editar política de ${item.ingredient.name}`} onClick={() => openPolicy(item)}><Settings2 className="h-4 w-4" /></Button> : null}</div></td></tr>)}</tbody></table></div></div> : null}

      {editing && form ? <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-4 md:items-center" onMouseDown={(event) => { if (event.target === event.currentTarget) { setEditing(null); setForm(null); } }}><Card className="w-full max-w-xl border-slate-200 bg-white p-5 shadow-xl"><h3 className="text-lg font-black text-slate-950">Política de {editing.ingredient.name}</h3><p className="mt-1 text-sm text-slate-500">A compra é convertida para {editing.ingredient.unit}, unidade usada nas fichas técnicas.</p><div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2"><div><Label>Stock mínimo</Label><Input className="mt-1" type="number" min="0" value={form.minimumStock} onChange={(event) => setForm({ ...form, minimumStock: event.target.value })} /></div><div><Label>Nível ideal</Label><Input className="mt-1" type="number" min="0" value={form.idealStock} onChange={(event) => setForm({ ...form, idealStock: event.target.value })} /></div><div><Label>Unidade de compra</Label><Input className="mt-1" value={form.purchaseUnit} onChange={(event) => setForm({ ...form, purchaseUnit: event.target.value })} placeholder="caixa, saco, garrafa" /></div><div><Label>Quantidade por embalagem</Label><Input className="mt-1" type="number" min="0.000001" step="0.001" value={form.purchaseConversion} onChange={(event) => setForm({ ...form, purchaseConversion: event.target.value })} /></div><div className="sm:col-span-2"><Label>Fornecedor preferencial</Label><select className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.preferredSupplierId} onChange={(event) => setForm({ ...form, preferredSupplierId: event.target.value })}><option value="">Não definido</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></div></div>{saveMutation.error ? <p className="mt-3 text-sm font-semibold text-red-600">{getApiErrorMessage(saveMutation.error)}</p> : null}<div className="mt-5 flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => { setEditing(null); setForm(null); }}>Cancelar</Button><Button type="button" disabled={Number(form.purchaseConversion) <= 0 || Number(form.idealStock) < Number(form.minimumStock) || saveMutation.isPending} onClick={() => saveMutation.mutate()}>{saveMutation.isPending ? 'A guardar...' : 'Guardar política'}</Button></div></Card></div> : null}
    </section>
  );
}
