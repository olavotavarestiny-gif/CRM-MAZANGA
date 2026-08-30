'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, Boxes, PackageCheck, ShoppingCart } from 'lucide-react';
import { getFoodContext, getFoodIngredients, getFoodSettings, getFoodStockMovements, getFoodStockReport } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api-error-message';
import type { FoodStockMovement } from '@/lib/types';
import { FoodEmptyState, FoodPageHeader, getFoodBrandStyle } from '@/components/food/food-ui';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';

const movementLabels: Record<string, string> = {
  adjustment: 'Ajuste manual',
  purchase_receipt: 'Receção de compra',
  order_consumption: 'Consumo de pedido',
  order_reversal: 'Reposição de pedido',
};

function formatKz(value: number) {
  return `${new Intl.NumberFormat('pt-AO', { maximumFractionDigits: 2 }).format(value || 0)} Kz`;
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat('pt-AO', { maximumFractionDigits: 3 }).format(Math.abs(value || 0));
}

function Metric({ label, value, detail, icon: Icon, tone }: { label: string; value: string | number; detail: string; icon: typeof Boxes; tone: string }) {
  return (
    <div className="bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-1 text-xl font-bold text-slate-950">{value}</p><p className="mt-1 text-xs text-slate-400">{detail}</p></div>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone}`}><Icon className="h-4 w-4" /></div>
      </div>
    </div>
  );
}

export default function FoodStockHistoryPage() {
  const [branchId, setBranchId] = useState('');
  const [days, setDays] = useState(30);
  const [ingredientId, setIngredientId] = useState('');
  const [movementType, setMovementType] = useState('all');
  const settingsQuery = useQuery({ queryKey: ['food-settings'], queryFn: getFoodSettings });
  const contextQuery = useQuery({ queryKey: ['food-context'], queryFn: getFoodContext });
  const canView = contextQuery.data?.permissions.includes('*') || contextQuery.data?.permissions.includes('stock.view') || false;
  const ingredientsQuery = useQuery({ queryKey: ['food-ingredients'], queryFn: () => getFoodIngredients({ active: true }), enabled: canView });
  const reportQuery = useQuery({
    queryKey: ['food-stock-report', branchId, days],
    queryFn: () => getFoodStockReport({ branchId: branchId || undefined, days }),
    enabled: canView,
  });
  const movementsQuery = useQuery({
    queryKey: ['food-stock-movements', branchId, days, ingredientId, movementType],
    queryFn: () => getFoodStockMovements({ branchId: branchId || undefined, days, ingredientId: ingredientId || undefined, type: movementType, limit: 250 }),
    enabled: canView,
  });
  const branches = contextQuery.data?.branches ?? [];
  const ingredients = useMemo(
    () => (ingredientsQuery.data ?? []).filter((ingredient) => !branchId || !ingredient.branchId || ingredient.branchId === branchId),
    [branchId, ingredientsQuery.data]
  );
  const error = contextQuery.error || reportQuery.error || movementsQuery.error || ingredientsQuery.error;
  if (error) {
    return <div className="mx-auto max-w-7xl p-4 md:p-6"><ErrorState title="Não foi possível carregar o histórico" message={getApiErrorMessage(error)} onRetry={() => Promise.all([contextQuery.refetch(), reportQuery.refetch(), movementsQuery.refetch(), ingredientsQuery.refetch()])} /></div>;
  }

  const report = reportQuery.data;
  const movements = movementsQuery.data ?? [];
  return (
    <div className="mx-auto max-w-7xl space-y-8 p-4 md:p-6" style={getFoodBrandStyle(settingsQuery.data)}>
      <FoodPageHeader eyebrow="Gestão Food" title="Stock" description="Inventário, alertas e movimentos do período selecionado.">
        <Button asChild variant="outline"><Link href="/food/gestao"><ArrowLeft className="mr-2 h-4 w-4" />Gestão</Link></Button>
        <Button asChild variant="outline"><Link href="/food/gestao/compras"><ShoppingCart className="mr-2 h-4 w-4" />Compras</Link></Button>
      </FoodPageHeader>

      <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200/80 bg-slate-50/50 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm font-semibold text-slate-600">Unidade<select className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 font-normal text-slate-950" value={branchId} onChange={(event) => { setBranchId(event.target.value); setIngredientId(''); }}><option value="">Todas autorizadas</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
        <label className="text-sm font-semibold text-slate-600">Período<select className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 font-normal text-slate-950" value={days} onChange={(event) => setDays(Number(event.target.value))}><option value={7}>Últimos 7 dias</option><option value={30}>Últimos 30 dias</option><option value={90}>Últimos 90 dias</option></select></label>
        <label className="text-sm font-semibold text-slate-600">Ingrediente<select className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 font-normal text-slate-950" value={ingredientId} onChange={(event) => setIngredientId(event.target.value)}><option value="">Todos</option>{ingredients.map((ingredient) => <option key={ingredient.id} value={ingredient.id}>{ingredient.name}</option>)}</select></label>
        <label className="text-sm font-semibold text-slate-600">Movimento<select className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 font-normal text-slate-950" value={movementType} onChange={(event) => setMovementType(event.target.value)}><option value="all">Todos</option><option value="purchase_receipt">Receções</option><option value="order_consumption">Consumos</option><option value="order_reversal">Reposições</option><option value="adjustment">Ajustes</option></select></label>
      </div>

      {canView ? <>
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-slate-200/80 bg-slate-100 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Valor em stock" value={formatKz(report?.inventory.value ?? 0)} detail={`${report?.inventory.ingredients ?? 0} ingredientes ativos`} icon={Boxes} tone="bg-blue-50 text-blue-700" />
          <Metric label="Alertas abertos" value={report?.inventory.alerts ?? 0} detail="Abaixo do nível mínimo" icon={AlertTriangle} tone="bg-red-50 text-red-700" />
          <Metric label="Compras abertas" value={formatKz(report?.purchases.openValue ?? 0)} detail={`${report?.purchases.openCount ?? 0} compras no período`} icon={ShoppingCart} tone="bg-amber-50 text-amber-700" />
          <Metric label="Compras recebidas" value={formatKz(report?.purchases.receivedValue ?? 0)} detail={`${report?.purchases.receivedCount ?? 0} compras concluídas`} icon={PackageCheck} tone="bg-emerald-50 text-emerald-700" />
        </div>

        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-slate-200/80 bg-slate-100 sm:grid-cols-3">
          <div className="flex items-center justify-between bg-white px-4 py-3"><div><p className="text-xs font-medium text-slate-500">Movimentos</p><p className="mt-1 text-lg font-bold text-slate-950">{report?.movements.count ?? 0}</p></div><Boxes className="h-5 w-5 text-slate-400" /></div>
          <div className="flex items-center justify-between bg-white px-4 py-3"><div><p className="text-xs font-medium text-slate-500">Entradas</p><p className="mt-1 text-lg font-bold text-emerald-700">+{formatQuantity(report?.movements.entries ?? 0)}</p></div><ArrowUp className="h-5 w-5 text-emerald-600" /></div>
          <div className="flex items-center justify-between bg-white px-4 py-3"><div><p className="text-xs font-medium text-slate-500">Saídas</p><p className="mt-1 text-lg font-bold text-slate-700">-{formatQuantity(report?.movements.exits ?? 0)}</p></div><ArrowDown className="h-5 w-5 text-slate-500" /></div>
        </div>

        <section>
          <div className="mb-3"><h2 className="text-lg font-bold text-slate-950">Movimentos de stock</h2><p className="text-sm text-slate-500">Entradas e saídas, da mais recente para a mais antiga.</p></div>
          {movementsQuery.isLoading ? <div className="h-52 animate-pulse rounded-lg bg-white" /> : movements.length === 0 ? <FoodEmptyState icon={Boxes} title="Sem movimentos neste período" description="Altere os filtros ou registe uma receção, consumo ou ajuste de stock." /> : <MovementTable movements={movements} />}
        </section>
      </> : <ErrorState title="Acesso restrito" message="A sua função não possui permissão para consultar o stock Food." />}
    </div>
  );
}

function MovementTable({ movements }: { movements: FoodStockMovement[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200/80 bg-white">
      <div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-sm"><thead className="border-b border-slate-100 bg-slate-50/60 text-xs font-semibold text-slate-500"><tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Ingrediente</th><th className="px-4 py-3">Movimento</th><th className="px-4 py-3">Alteração</th><th className="px-4 py-3">Unidade / referência</th></tr></thead><tbody className="divide-y divide-slate-100">{movements.map((movement) => { const quantity = Number(movement.quantity); return <tr key={movement.id} className="hover:bg-slate-50/50"><td className="whitespace-nowrap px-4 py-4 text-slate-500">{new Date(movement.createdAt).toLocaleString('pt-AO')}</td><td className="px-4 py-4"><p className="font-semibold text-slate-950">{movement.ingredient.name}</p><p className="text-xs text-slate-500">{movement.ingredient.internalCode} · {movement.ingredient.unit}</p></td><td className="px-4 py-4"><p className="font-medium text-slate-700">{movementLabels[movement.type] || movement.type}</p>{movement.reason ? <p className="max-w-xs truncate text-xs text-slate-500" title={movement.reason}>{movement.reason}</p> : null}</td><td className="px-4 py-4"><p className={`font-bold ${quantity >= 0 ? 'text-emerald-700' : 'text-slate-700'}`}>{quantity >= 0 ? '+' : '-'}{formatQuantity(quantity)}</p><p className="mt-0.5 whitespace-nowrap text-xs text-slate-400">{formatQuantity(movement.previousStock)} → {formatQuantity(movement.newStock)}</p></td><td className="px-4 py-4"><p className="text-slate-700">{movement.branch?.name || 'Stock comum'}</p>{movement.purchase ? <p className="text-xs text-slate-500">{movement.purchase.reference || `Compra ${movement.purchase.id.slice(-6)}`}</p> : movement.referenceType ? <p className="text-xs text-slate-500">{movement.referenceType}</p> : null}</td></tr>; })}</tbody></table></div>
    </div>
  );
}
