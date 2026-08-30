'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, PackageCheck, Plus, Trash2, Truck } from 'lucide-react';
import {
  createFoodPurchase,
  createFoodSupplier,
  getFoodContext,
  getFoodIngredients,
  getFoodPurchases,
  getFoodSettings,
  getFoodSuppliers,
} from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api-error-message';
import { FoodEmptyState, FoodPageHeader, getFoodBrandStyle } from '@/components/food/food-ui';
import { FoodPurchasePlanning } from '@/components/food/food-purchase-planning';
import { FoodPurchaseLifecycle, FoodPurchaseStatus } from '@/components/food/food-purchase-lifecycle';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type PurchaseRow = { ingredientId: string; quantity: string; unitCost: string };

function formatKz(value: number) {
  return `${new Intl.NumberFormat('pt-AO', { maximumFractionDigits: 2 }).format(value || 0)} Kz`;
}

export default function FoodPurchasesPage() {
  const queryClient = useQueryClient();
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [showPurchaseForm, setShowPurchaseForm] = useState(false);
  const [supplierForm, setSupplierForm] = useState({ name: '', nif: '', phone: '', email: '', branchId: '' });
  const [purchaseForm, setPurchaseForm] = useState({ branchId: '', supplierId: '', reference: '' });
  const [purchaseRows, setPurchaseRows] = useState<PurchaseRow[]>([{ ingredientId: '', quantity: '1', unitCost: '0' }]);

  const settingsQuery = useQuery({ queryKey: ['food-settings'], queryFn: getFoodSettings });
  const contextQuery = useQuery({ queryKey: ['food-context'], queryFn: getFoodContext });
  const canView = contextQuery.data?.permissions.includes('*') || contextQuery.data?.permissions.includes('stock.view') || false;
  const canEdit = contextQuery.data?.permissions.includes('*') || contextQuery.data?.permissions.includes('stock.edit') || false;
  const ingredientsQuery = useQuery({ queryKey: ['food-ingredients'], queryFn: () => getFoodIngredients({ active: true }), enabled: canView });
  const suppliersQuery = useQuery({ queryKey: ['food-suppliers'], queryFn: getFoodSuppliers, enabled: canView });
  const purchasesQuery = useQuery({ queryKey: ['food-purchases'], queryFn: getFoodPurchases, enabled: canView });
  const branches = contextQuery.data?.branches ?? [];

  useEffect(() => {
    if (!purchaseForm.branchId && branches.length) {
      setPurchaseForm((current) => ({ ...current, branchId: branches.find((branch) => branch.isMain)?.id || branches[0].id }));
    }
  }, [branches, purchaseForm.branchId]);

  const selectedBranchId = purchaseForm.branchId;
  const availableIngredients = useMemo(
    () => (ingredientsQuery.data ?? []).filter((ingredient) => !ingredient.branchId || ingredient.branchId === selectedBranchId),
    [ingredientsQuery.data, selectedBranchId]
  );
  const availableSuppliers = useMemo(
    () => (suppliersQuery.data ?? []).filter((supplier) => !supplier.branchId || supplier.branchId === selectedBranchId),
    [suppliersQuery.data, selectedBranchId]
  );
  const purchaseTotal = purchaseRows.reduce(
    (sum, row) => sum + (Number(row.quantity) || 0) * (Number(row.unitCost) || 0),
    0
  );

  const supplierMutation = useMutation({
    mutationFn: () => createFoodSupplier({
      name: supplierForm.name,
      nif: supplierForm.nif,
      phone: supplierForm.phone,
      email: supplierForm.email,
      branchId: supplierForm.branchId || null,
    }),
    onSuccess: () => {
      setSupplierForm({ name: '', nif: '', phone: '', email: '', branchId: '' });
      setShowSupplierForm(false);
      queryClient.invalidateQueries({ queryKey: ['food-suppliers'] });
    },
  });
  const purchaseMutation = useMutation({
    mutationFn: () => createFoodPurchase({
      ...purchaseForm,
      supplierId: purchaseForm.supplierId || undefined,
      reference: purchaseForm.reference || undefined,
      items: purchaseRows.map((row) => ({
        ingredientId: row.ingredientId,
        quantity: Number(row.quantity),
        unitCost: Number(row.unitCost),
      })),
    }),
    onSuccess: () => {
      setPurchaseRows([{ ingredientId: '', quantity: '1', unitCost: '0' }]);
      setPurchaseForm((current) => ({ ...current, supplierId: '', reference: '' }));
      setShowPurchaseForm(false);
      queryClient.invalidateQueries({ queryKey: ['food-purchases'] });
      queryClient.invalidateQueries({ queryKey: ['food-stock-replenishment'] });
    },
  });
  const updateRow = (index: number, field: keyof PurchaseRow, value: string) => {
    setPurchaseRows((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row));
  };
  const formValid = Boolean(
    purchaseForm.branchId
    && purchaseRows.length
    && purchaseRows.every((row) => row.ingredientId && Number(row.quantity) > 0 && Number(row.unitCost) >= 0)
  );
  const error = contextQuery.error || purchasesQuery.error || ingredientsQuery.error || suppliersQuery.error;
  if (error) {
    return <div className="mx-auto max-w-7xl p-4 md:p-6"><ErrorState title="Não foi possível carregar as compras" message={getApiErrorMessage(error)} onRetry={() => Promise.all([contextQuery.refetch(), purchasesQuery.refetch(), ingredientsQuery.refetch(), suppliersQuery.refetch()])} /></div>;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6" style={getFoodBrandStyle(settingsQuery.data)}>
      <FoodPageHeader eyebrow="Gestão Food" title="Compras e fornecedores" description="Registe encomendas e confirme a receção para atualizar o stock e o custo médio.">
        <Button asChild variant="outline"><Link href="/food/gestao"><ArrowLeft className="mr-2 h-4 w-4" />Gestão</Link></Button>
        {canEdit ? <Button variant="outline" onClick={() => setShowSupplierForm((value) => !value)}><Truck className="mr-2 h-4 w-4" />Fornecedor</Button> : null}
        {canEdit ? <Button onClick={() => setShowPurchaseForm((value) => !value)}><Plus className="mr-2 h-4 w-4" />Compra</Button> : null}
      </FoodPageHeader>

      {canView ? <FoodPurchasePlanning branchId={purchaseForm.branchId} canEdit={canEdit} ingredients={ingredientsQuery.data || []} suppliers={suppliersQuery.data || []} onUseSuggestion={(group) => { setPurchaseForm({ branchId: group.branch.id, supplierId: group.supplier.id, reference: `Reposição ${new Date().toISOString().slice(0, 10)}` }); setPurchaseRows(group.items.map((item) => ({ ingredientId: item.ingredient.id, quantity: String(item.quantity), unitCost: String(item.unitCost) }))); setShowPurchaseForm(true); }} /> : null}

      {showSupplierForm && canEdit ? (
        <Card className="border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">Novo fornecedor</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-5">
            <div className="md:col-span-2"><Label>Nome</Label><Input className="mt-1" value={supplierForm.name} onChange={(event) => setSupplierForm({ ...supplierForm, name: event.target.value })} /></div>
            <div><Label>NIF</Label><Input className="mt-1" value={supplierForm.nif} onChange={(event) => setSupplierForm({ ...supplierForm, nif: event.target.value })} /></div>
            <div><Label>Telefone</Label><Input className="mt-1" value={supplierForm.phone} onChange={(event) => setSupplierForm({ ...supplierForm, phone: event.target.value })} /></div>
            <div><Label>Unidade</Label><select className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={supplierForm.branchId} onChange={(event) => setSupplierForm({ ...supplierForm, branchId: event.target.value })}><option value="">Todas</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></div>
            <div className="md:col-span-2"><Label>Email</Label><Input className="mt-1" type="email" value={supplierForm.email} onChange={(event) => setSupplierForm({ ...supplierForm, email: event.target.value })} /></div>
          </div>
          {supplierMutation.isError ? <p className="mt-3 text-sm font-semibold text-red-600">{getApiErrorMessage(supplierMutation.error)}</p> : null}
          <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setShowSupplierForm(false)}>Cancelar</Button><Button disabled={!supplierForm.name.trim() || supplierMutation.isPending} onClick={() => supplierMutation.mutate()}>Guardar fornecedor</Button></div>
        </Card>
      ) : null}

      {showPurchaseForm && canEdit ? (
        <Card className="border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-lg font-black text-slate-950">Nova compra</h2><p className="text-sm text-slate-500">O stock só é alterado quando a compra for recebida.</p></div><p className="text-xl font-black text-slate-950">{formatKz(purchaseTotal)}</p></div>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div><Label>Unidade</Label><select className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={purchaseForm.branchId} onChange={(event) => setPurchaseForm({ ...purchaseForm, branchId: event.target.value, supplierId: '' })}>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></div>
            <div><Label>Fornecedor</Label><select className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={purchaseForm.supplierId} onChange={(event) => setPurchaseForm({ ...purchaseForm, supplierId: event.target.value })}><option value="">Sem fornecedor</option>{availableSuppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></div>
            <div><Label>Referência</Label><Input className="mt-1" value={purchaseForm.reference} onChange={(event) => setPurchaseForm({ ...purchaseForm, reference: event.target.value })} /></div>
          </div>
          <div className="mt-5 space-y-3">
            {purchaseRows.map((row, index) => <div key={index} className="grid grid-cols-1 gap-2 border-b border-slate-100 pb-3 last:border-0 sm:grid-cols-[minmax(0,1fr)_110px_140px_40px] sm:pb-0"><select aria-label="Ingrediente" className="h-10 min-w-0 rounded-md border border-slate-200 bg-white px-3 text-sm" value={row.ingredientId} onChange={(event) => updateRow(index, 'ingredientId', event.target.value)}><option value="">Ingrediente</option>{availableIngredients.map((ingredient) => <option key={ingredient.id} value={ingredient.id}>{ingredient.name} ({ingredient.unit})</option>)}</select><Input aria-label="Quantidade" placeholder="Quantidade" type="number" min="0.001" step="0.001" value={row.quantity} onChange={(event) => updateRow(index, 'quantity', event.target.value)} /><Input aria-label="Custo unitário" placeholder="Custo unitário" type="number" min="0" value={row.unitCost} onChange={(event) => updateRow(index, 'unitCost', event.target.value)} /><Button className="justify-self-end sm:justify-self-auto" aria-label="Remover item" title="Remover item" size="icon" variant="ghost" disabled={purchaseRows.length === 1} onClick={() => setPurchaseRows((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}><Trash2 className="h-4 w-4" /></Button></div>)}
          </div>
          <Button className="mt-3" size="sm" variant="outline" onClick={() => setPurchaseRows((rows) => [...rows, { ingredientId: '', quantity: '1', unitCost: '0' }])}><Plus className="mr-2 h-4 w-4" />Adicionar item</Button>
          {purchaseMutation.isError ? <p className="mt-3 text-sm font-semibold text-red-600">{getApiErrorMessage(purchaseMutation.error)}</p> : null}
          <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setShowPurchaseForm(false)}>Cancelar</Button><Button disabled={!formValid || purchaseMutation.isPending} onClick={() => purchaseMutation.mutate()}>Registar compra</Button></div>
        </Card>
      ) : null}

      {(purchasesQuery.data ?? []).length === 0 ? (
        <FoodEmptyState icon={PackageCheck} title="Ainda não há compras" description="Registe a primeira encomenda de matérias-primas." actionLabel={canEdit ? 'Nova compra' : undefined} onAction={canEdit ? () => setShowPurchaseForm(true) : undefined} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Compra</th><th className="px-4 py-3">Unidade</th><th className="px-4 py-3">Fornecedor</th><th className="px-4 py-3">Receção</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3 text-right">Acção</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{(purchasesQuery.data ?? []).map((purchase) => {
                const ordered = (purchase.items || []).reduce((sum, item) => sum + Number(item.quantity), 0);
                const received = (purchase.items || []).reduce((sum, item) => sum + Number(item.receivedQuantity || 0), 0);
                return <tr key={purchase.id}><td className="px-4 py-3"><p className="font-bold text-slate-950">{purchase.reference || `Compra ${purchase.id.slice(-6)}`}</p><p className="text-xs text-slate-500">{new Date(purchase.createdAt).toLocaleString('pt-AO')}</p></td><td className="px-4 py-3 text-slate-600">{purchase.branch?.name || '—'}</td><td className="px-4 py-3 text-slate-600">{purchase.supplier?.name || '—'}</td><td className="px-4 py-3"><p className="font-semibold text-slate-700">{received.toLocaleString('pt-AO')} / {ordered.toLocaleString('pt-AO')}</p><p className="text-xs text-slate-500">{purchase.items?.length || 0} itens</p></td><td className="px-4 py-3 font-bold text-slate-950">{formatKz(Number(purchase.total))}</td><td className="px-4 py-3"><FoodPurchaseStatus purchase={purchase} /></td><td className="px-4 py-3 text-right"><FoodPurchaseLifecycle purchase={purchase} canEdit={canEdit} /></td></tr>;
              })}</tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
