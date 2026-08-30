'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, Plus, Save, Trash2 } from 'lucide-react';
import {
  getFoodContext,
  getFoodIngredients,
  getFoodProductRecipe,
  getFoodProducts,
  getFoodSettings,
  saveFoodProductRecipe,
} from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api-error-message';
import { FoodEmptyState, FoodPageHeader, getFoodBrandStyle } from '@/components/food/food-ui';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type RecipeRow = { ingredientId: string; quantity: string; wastePercent: string };

function formatKz(value: number) {
  return `${new Intl.NumberFormat('pt-AO', { maximumFractionDigits: 2 }).format(value || 0)} Kz`;
}

export default function FoodRecipesPage() {
  const queryClient = useQueryClient();
  const [productId, setProductId] = useState('');
  const [rows, setRows] = useState<RecipeRow[]>([]);
  const settingsQuery = useQuery({ queryKey: ['food-settings'], queryFn: getFoodSettings });
  const contextQuery = useQuery({ queryKey: ['food-context'], queryFn: getFoodContext });
  const canView = contextQuery.data?.permissions.includes('*') || contextQuery.data?.permissions.includes('stock.view') || false;
  const canEdit = contextQuery.data?.permissions.includes('*') || contextQuery.data?.permissions.includes('stock.edit') || false;
  const productsQuery = useQuery({ queryKey: ['food-products', 'recipes'], queryFn: () => getFoodProducts({ active: true }), enabled: canView });
  const ingredientsQuery = useQuery({ queryKey: ['food-ingredients'], queryFn: () => getFoodIngredients({ active: true }), enabled: canView });
  const recipeQuery = useQuery({
    queryKey: ['food-product-recipe', productId],
    queryFn: () => getFoodProductRecipe(productId),
    enabled: canView && Boolean(productId),
  });
  const products = productsQuery.data ?? [];
  const selectedProduct = products.find((product) => product.id === productId);
  const availableIngredients = useMemo(
    () => (ingredientsQuery.data ?? []).filter((ingredient) => !ingredient.branchId || ingredient.branchId === selectedProduct?.branchId),
    [ingredientsQuery.data, selectedProduct?.branchId]
  );

  useEffect(() => {
    if (!productId && products.length) setProductId(products[0].id);
  }, [productId, products]);
  useEffect(() => {
    if (!recipeQuery.data) return;
    setRows(recipeQuery.data.map((item) => ({
      ingredientId: item.ingredientId,
      quantity: String(item.quantity),
      wastePercent: String(item.wastePercent),
    })));
  }, [productId, recipeQuery.data]);

  const recipeCost = rows.reduce((sum, row) => {
    const ingredient = availableIngredients.find((item) => item.id === row.ingredientId);
    return sum + Number(ingredient?.averageCost || 0) * Number(row.quantity || 0) * (1 + Number(row.wastePercent || 0) / 100);
  }, 0);
  const grossMargin = selectedProduct && Number(selectedProduct.price) > 0
    ? ((Number(selectedProduct.price) - recipeCost) / Number(selectedProduct.price)) * 100
    : 0;
  const saveMutation = useMutation({
    mutationFn: () => saveFoodProductRecipe(productId, rows.map((row) => ({
      ingredientId: row.ingredientId,
      quantity: Number(row.quantity),
      unit: availableIngredients.find((ingredient) => ingredient.id === row.ingredientId)?.unit,
      wastePercent: Number(row.wastePercent || 0),
    }))),
    onSuccess: (recipe) => {
      queryClient.setQueryData(['food-product-recipe', productId], recipe);
      queryClient.invalidateQueries({ queryKey: ['food-ingredients'] });
    },
  });
  const updateRow = (index: number, field: keyof RecipeRow, value: string) => {
    setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row));
  };
  const valid = Boolean(productId && rows.every((row) => row.ingredientId && Number(row.quantity) > 0 && Number(row.wastePercent || 0) >= 0));
  const error = contextQuery.error || productsQuery.error || ingredientsQuery.error || recipeQuery.error;
  if (error) {
    return <div className="mx-auto max-w-7xl p-4 md:p-6"><ErrorState title="Não foi possível carregar as fichas técnicas" message={getApiErrorMessage(error)} onRetry={() => Promise.all([contextQuery.refetch(), productsQuery.refetch(), ingredientsQuery.refetch(), recipeQuery.refetch()])} /></div>;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6" style={getFoodBrandStyle(settingsQuery.data)}>
      <FoodPageHeader eyebrow="Gestão Food" title="Fichas técnicas" description="Defina o consumo real de matérias-primas por unidade vendida.">
        <Button asChild variant="outline"><Link href="/food/gestao"><ArrowLeft className="mr-2 h-4 w-4" />Gestão</Link></Button>
        <Button asChild variant="outline"><Link href="/food/produtos">Menu</Link></Button>
      </FoodPageHeader>

      {products.length === 0 ? (
        <FoodEmptyState icon={BookOpen} title="Ainda não há produtos" description="Crie os produtos do menu antes de configurar as fichas técnicas." />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_repeat(3,minmax(150px,220px))]">
            <div><Label>Produto</Label><select className="mt-1 h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold" value={productId} onChange={(event) => { setProductId(event.target.value); setRows([]); }}>{products.map((product) => <option key={product.id} value={product.id}>{product.name}{product.branch?.name ? ` · ${product.branch.name}` : ''}</option>)}</select></div>
            <Card className="border-slate-200 bg-white p-3 shadow-sm"><p className="text-xs font-bold uppercase text-slate-500">Preço de venda</p><p className="mt-1 text-lg font-black text-slate-950">{formatKz(Number(selectedProduct?.price || 0))}</p></Card>
            <Card className="border-slate-200 bg-white p-3 shadow-sm"><p className="text-xs font-bold uppercase text-slate-500">Custo estimado</p><p className="mt-1 text-lg font-black text-slate-950">{formatKz(recipeCost)}</p></Card>
            <Card className="border-slate-200 bg-white p-3 shadow-sm"><p className="text-xs font-bold uppercase text-slate-500">Margem bruta</p><p className={`mt-1 text-lg font-black ${grossMargin >= 30 ? 'text-emerald-700' : 'text-amber-700'}`}>{new Intl.NumberFormat('pt-AO', { maximumFractionDigits: 1 }).format(grossMargin)}%</p></Card>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-black text-slate-950">Ingredientes de {selectedProduct?.name}</h2><p className="text-sm text-slate-500">O consumo ocorre uma única vez quando o pedido é enviado à cozinha.</p></div>
            <div className="space-y-3 p-5">
              {recipeQuery.isLoading ? <div className="h-24 animate-pulse rounded-lg bg-slate-100" /> : rows.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">Este produto ainda não tem ingredientes associados.</p> : rows.map((row, index) => {
                const ingredient = availableIngredients.find((item) => item.id === row.ingredientId);
                return <div key={index} className="grid grid-cols-1 gap-2 border-b border-slate-100 pb-3 last:border-0 sm:grid-cols-[minmax(0,1fr)_130px_130px_40px] sm:pb-0"><select aria-label="Ingrediente" className="h-10 min-w-0 rounded-md border border-slate-200 bg-white px-3 text-sm" value={row.ingredientId} onChange={(event) => updateRow(index, 'ingredientId', event.target.value)}><option value="">Ingrediente</option>{availableIngredients.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>)}</select><Input aria-label={`Quantidade em ${ingredient?.unit || 'unidade'}`} placeholder={`Quantidade (${ingredient?.unit || 'un'})`} type="number" min="0.001" step="0.001" value={row.quantity} onChange={(event) => updateRow(index, 'quantity', event.target.value)} /><Input aria-label="Desperdício percentual" placeholder="Desperdício (%)" type="number" min="0" max="100" value={row.wastePercent} onChange={(event) => updateRow(index, 'wastePercent', event.target.value)} /><Button className="justify-self-end sm:justify-self-auto" aria-label="Remover ingrediente" title="Remover ingrediente" size="icon" variant="ghost" onClick={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}><Trash2 className="h-4 w-4" /></Button></div>;
              })}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2"><Button size="sm" variant="outline" disabled={!availableIngredients.length} onClick={() => setRows((current) => [...current, { ingredientId: '', quantity: '1', wastePercent: '0' }])}><Plus className="mr-2 h-4 w-4" />Ingrediente</Button>{canEdit ? <Button disabled={!valid || saveMutation.isPending} onClick={() => saveMutation.mutate()}><Save className="mr-2 h-4 w-4" />Guardar ficha</Button> : null}</div>
              {saveMutation.isSuccess ? <p className="text-right text-sm font-semibold text-emerald-700">Ficha técnica atualizada.</p> : null}
              {saveMutation.isError ? <p className="text-right text-sm font-semibold text-red-600">{getApiErrorMessage(saveMutation.error)}</p> : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
