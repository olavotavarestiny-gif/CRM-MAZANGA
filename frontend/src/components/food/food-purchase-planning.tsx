'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, MessageCircle, PackagePlus, Plus, Star } from 'lucide-react';
import {
  archiveFoodSupplierProduct,
  getFoodPurchaseSuggestions,
  getFoodSupplierProducts,
  prepareFoodSupplierWhatsApp,
  saveFoodSupplierProduct,
} from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api-error-message';
import type { FoodIngredient, FoodPurchaseSuggestionGroup, FoodSupplier, FoodSupplierProduct, FoodSupplierWhatsAppDraft } from '@/lib/types';
import { FoodConfirmDialog } from '@/components/food/food-confirm-dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type OfferForm = {
  supplierId: string;
  ingredientId: string;
  purchaseUnit: string;
  packageQuantity: string;
  packagePrice: string;
  minimumPackages: string;
  leadTimeDays: string;
  qualityRating: string;
  paymentTerms: string;
};

const emptyOffer: OfferForm = { supplierId: '', ingredientId: '', purchaseUnit: '', packageQuantity: '1', packagePrice: '0', minimumPackages: '1', leadTimeDays: '0', qualityRating: '', paymentTerms: '' };

function money(value: number) {
  return `${new Intl.NumberFormat('pt-AO', { maximumFractionDigits: 2 }).format(value || 0)} Kz`;
}

export function FoodPurchasePlanning({
  branchId,
  canEdit,
  ingredients,
  suppliers,
  onUseSuggestion,
}: {
  branchId: string;
  canEdit: boolean;
  ingredients: FoodIngredient[];
  suppliers: FoodSupplier[];
  onUseSuggestion: (group: FoodPurchaseSuggestionGroup) => void;
}) {
  const queryClient = useQueryClient();
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [form, setForm] = useState<OfferForm>(emptyOffer);
  const [offerToArchive, setOfferToArchive] = useState<FoodSupplierProduct | null>(null);
  const [whatsAppDraft, setWhatsAppDraft] = useState<FoodSupplierWhatsAppDraft | null>(null);
  const [whatsAppMessage, setWhatsAppMessage] = useState('');
  const offersQuery = useQuery({ queryKey: ['food-supplier-products', branchId], queryFn: () => getFoodSupplierProducts({ branchId }), enabled: Boolean(branchId) });
  const suggestionsQuery = useQuery({ queryKey: ['food-purchase-suggestions', branchId], queryFn: () => getFoodPurchaseSuggestions(branchId), enabled: Boolean(branchId) });
  const saveMutation = useMutation({
    mutationFn: () => saveFoodSupplierProduct({
      supplierId: form.supplierId,
      ingredientId: form.ingredientId,
      purchaseUnit: form.purchaseUnit,
      packageQuantity: Number(form.packageQuantity),
      packagePrice: Number(form.packagePrice),
      minimumPackages: Number(form.minimumPackages),
      leadTimeDays: Number(form.leadTimeDays),
      qualityRating: form.qualityRating ? Number(form.qualityRating) : null,
      paymentTerms: form.paymentTerms,
    }),
    onSuccess: async () => {
      setForm(emptyOffer);
      setShowOfferForm(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['food-supplier-products'] }),
        queryClient.invalidateQueries({ queryKey: ['food-purchase-suggestions'] }),
      ]);
    },
  });
  const archiveMutation = useMutation({
    mutationFn: () => archiveFoodSupplierProduct(offerToArchive!.id, 'Condição arquivada na gestão de compras'),
    onSuccess: async () => {
      setOfferToArchive(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['food-supplier-products'] }),
        queryClient.invalidateQueries({ queryKey: ['food-purchase-suggestions'] }),
      ]);
    },
  });
  const whatsAppMutation = useMutation({
    mutationFn: (group: FoodPurchaseSuggestionGroup) => prepareFoodSupplierWhatsApp(group.supplier.id, {
      items: group.items.map((item) => ({ name: item.ingredient.name, packages: item.packages, purchaseUnit: item.offer.purchaseUnit })),
    }),
    onSuccess: (draft) => {
      setWhatsAppDraft(draft);
      setWhatsAppMessage(draft.message);
    },
  });
  const availableIngredients = ingredients.filter((ingredient) => !ingredient.branchId || ingredient.branchId === branchId);
  const availableSuppliers = suppliers.filter((supplier) => !supplier.branchId || supplier.branchId === branchId);
  const selectedIngredient = availableIngredients.find((ingredient) => ingredient.id === form.ingredientId);
  const editOffer = (offer: FoodSupplierProduct) => {
    setForm({
      supplierId: offer.supplierId,
      ingredientId: offer.ingredientId,
      purchaseUnit: offer.purchaseUnit,
      packageQuantity: String(offer.packageQuantity),
      packagePrice: String(offer.packagePrice),
      minimumPackages: String(offer.minimumPackages),
      leadTimeDays: String(offer.leadTimeDays),
      qualityRating: offer.qualityRating ? String(offer.qualityRating) : '',
      paymentTerms: offer.paymentTerms || '',
    });
    setShowOfferForm(true);
  };
  const valid = Boolean(form.supplierId && form.ingredientId && form.purchaseUnit.trim() && Number(form.packageQuantity) > 0 && Number(form.packagePrice) > 0 && Number(form.minimumPackages) >= 1 && Number(form.leadTimeDays) >= 0);
  const error = offersQuery.error || suggestionsQuery.error || saveMutation.error || whatsAppMutation.error;

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-black text-slate-950">Planeamento de compras</h2><p className="text-sm text-slate-500">Compare fornecedores e prepare compras a partir da reposição calculada.</p></div>{canEdit ? <Button type="button" size="sm" variant="outline" onClick={() => { setForm(emptyOffer); setShowOfferForm((value) => !value); }}><Plus className="mr-2 h-4 w-4" />Condição</Button> : null}</div>

      {showOfferForm && canEdit ? <Card className="border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-black text-slate-950">Condição de fornecimento</h3><div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4"><div><Label>Fornecedor</Label><select className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.supplierId} onChange={(event) => setForm({ ...form, supplierId: event.target.value })}><option value="">Seleccione</option>{availableSuppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></div><div><Label>Ingrediente</Label><select className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.ingredientId} onChange={(event) => { const ingredient = availableIngredients.find((item) => item.id === event.target.value); setForm({ ...form, ingredientId: event.target.value, purchaseUnit: ingredient?.purchaseUnit || ingredient?.unit || '' }); }}><option value="">Seleccione</option>{availableIngredients.map((ingredient) => <option key={ingredient.id} value={ingredient.id}>{ingredient.name}</option>)}</select></div><div><Label>Embalagem</Label><Input className="mt-1" value={form.purchaseUnit} onChange={(event) => setForm({ ...form, purchaseUnit: event.target.value })} placeholder="saco, caixa" /></div><div><Label>Conteúdo ({selectedIngredient?.unit || 'un'})</Label><Input className="mt-1" type="number" min="0.001" step="0.001" value={form.packageQuantity} onChange={(event) => setForm({ ...form, packageQuantity: event.target.value })} /></div><div><Label>Preço da embalagem</Label><Input className="mt-1" type="number" min="0" value={form.packagePrice} onChange={(event) => setForm({ ...form, packagePrice: event.target.value })} /></div><div><Label>Mínimo de embalagens</Label><Input className="mt-1" type="number" min="1" value={form.minimumPackages} onChange={(event) => setForm({ ...form, minimumPackages: event.target.value })} /></div><div><Label>Prazo (dias)</Label><Input className="mt-1" type="number" min="0" value={form.leadTimeDays} onChange={(event) => setForm({ ...form, leadTimeDays: event.target.value })} /></div><div><Label>Qualidade (1-5)</Label><Input className="mt-1" type="number" min="1" max="5" step="0.5" value={form.qualityRating} onChange={(event) => setForm({ ...form, qualityRating: event.target.value })} /></div><div className="md:col-span-2"><Label>Condições de pagamento</Label><Input className="mt-1" value={form.paymentTerms} onChange={(event) => setForm({ ...form, paymentTerms: event.target.value })} placeholder="Pronto pagamento, 15 dias" /></div></div><div className="mt-5 flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setShowOfferForm(false)}>Cancelar</Button><Button type="button" disabled={!valid || saveMutation.isPending} onClick={() => saveMutation.mutate()}>{saveMutation.isPending ? 'A guardar...' : 'Guardar condição'}</Button></div></Card> : null}

      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{getApiErrorMessage(error)}</p> : null}

      {(suggestionsQuery.data?.groups.length || suggestionsQuery.data?.unpriced.length) ? <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">{suggestionsQuery.data.groups.map((group) => <div key={group.supplier.id} className="border border-slate-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-black text-slate-950">{group.supplier.name}</p><p className="text-xs text-slate-500">{group.items.length} itens · {money(group.total)}</p></div>{canEdit ? <div className="flex gap-1">{group.supplier.phone ? <Button type="button" size="icon" variant="outline" title="Preparar mensagem WhatsApp" disabled={whatsAppMutation.isPending} onClick={() => whatsAppMutation.mutate(group)}><MessageCircle className="h-4 w-4" /></Button> : null}<Button type="button" size="sm" onClick={() => onUseSuggestion(group)}><PackagePlus className="mr-2 h-4 w-4" />Preparar</Button></div> : null}</div><div className="mt-3 divide-y divide-slate-100">{group.items.map((item) => <div key={item.ingredient.id} className="flex justify-between gap-3 py-2 text-sm"><span className="text-slate-700">{item.ingredient.name}</span><strong className="text-slate-950">{item.packages} {item.offer.purchaseUnit}</strong></div>)}</div></div>)}{suggestionsQuery.data.unpriced.length ? <div className="border border-dashed border-amber-300 bg-amber-50 p-4"><p className="font-bold text-amber-900">Sem preço configurado</p><p className="mt-1 text-sm text-amber-800">{suggestionsQuery.data.unpriced.map((item) => item.ingredient.name).join(', ')}</p></div> : null}</div> : <div className="border border-dashed border-slate-300 bg-white px-4 py-5 text-center text-sm text-slate-500">Não há compras sugeridas para esta unidade.</div>}

      {(offersQuery.data || []).length ? (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Ingrediente</th><th className="px-4 py-3">Fornecedor</th><th className="px-4 py-3">Embalagem</th><th className="px-4 py-3">Custo interno</th><th className="px-4 py-3">Prazo / qualidade</th><th className="px-4 py-3 text-right">Acções</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{(offersQuery.data || []).map((offer) => (
                <tr key={offer.id}>
                  <td className="px-4 py-3 font-bold text-slate-950">{offer.ingredient.name}</td>
                  <td className="px-4 py-3 text-slate-700">{offer.supplier.name}</td>
                  <td className="px-4 py-3 text-slate-600">{offer.packageQuantity} {offer.ingredient.unit} / {offer.purchaseUnit}<p className="text-xs text-slate-500">{money(offer.packagePrice)}</p></td>
                  <td className="px-4 py-3 font-semibold text-slate-950">{money(offer.normalizedUnitCost)} / {offer.ingredient.unit}</td>
                  <td className="px-4 py-3 text-slate-600">{offer.leadTimeDays} dias{offer.qualityRating ? <span className="ml-2 inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{offer.qualityRating}</span> : null}</td>
                  <td className="px-4 py-3 text-right">{canEdit ? <><Button type="button" size="sm" variant="ghost" onClick={() => editOffer(offer)}>Editar</Button><Button type="button" size="icon" variant="ghost" title="Arquivar condição" onClick={() => setOfferToArchive(offer)}><Archive className="h-4 w-4 text-red-600" /></Button></> : null}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      ) : null}

      <FoodConfirmDialog open={offerToArchive !== null} onOpenChange={(open) => { if (!open) setOfferToArchive(null); }} title="Arquivar condição?" description="Esta condição deixa de participar na comparação e nas sugestões de compra." confirmLabel="Arquivar" destructive pending={archiveMutation.isPending} onConfirm={() => archiveMutation.mutate()} />
      {whatsAppDraft ? <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-4 md:items-center" onMouseDown={(event) => { if (event.target === event.currentTarget) setWhatsAppDraft(null); }}><Card className="w-full max-w-xl border-slate-200 bg-white p-5 shadow-xl"><h3 className="text-lg font-black text-slate-950">Mensagem para {whatsAppDraft.supplier.name}</h3><p className="mt-1 text-sm text-slate-500">Revise o texto antes de abrir o WhatsApp. Nada será enviado automaticamente.</p><div className="mt-4"><Label>Mensagem</Label><Textarea className="mt-1" rows={10} value={whatsAppMessage} onChange={(event) => setWhatsAppMessage(event.target.value)} /></div><div className="mt-5 flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setWhatsAppDraft(null)}>Cancelar</Button><Button type="button" disabled={!whatsAppMessage.trim()} onClick={() => window.open(`https://wa.me/${whatsAppDraft.phone}?text=${encodeURIComponent(whatsAppMessage)}`, '_blank', 'noopener,noreferrer')}><MessageCircle className="mr-2 h-4 w-4" />Abrir WhatsApp</Button></div></Card></div> : null}
    </section>
  );
}
