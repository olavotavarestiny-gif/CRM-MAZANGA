'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check, Mail, Phone } from 'lucide-react';
import { getFoodCustomerDuplicates, mergeFoodCustomers } from '@/lib/api';
import type { FoodCustomerDuplicatePair, FoodV1Customer } from '@/lib/types';
import { getApiErrorMessage } from '@/lib/api-error-message';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FoodConfirmDialog } from '@/components/food/food-confirm-dialog';

const reasonLabels: Record<FoodCustomerDuplicatePair['reasons'][number], string> = {
  phone: 'Mesmo telefone',
  email: 'Mesmo email',
  name_context: 'Mesmo nome e contexto',
};

function CustomerCandidate({ customer, onKeep }: { customer: FoodV1Customer; onKeep: () => void }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col rounded-lg border border-slate-200 bg-white p-4">
      <p className="truncate font-black text-slate-950">{customer.name}</p>
      <p className="mt-1 text-xs text-slate-500">Contacto #{customer.id}</p>
      <div className="mt-3 space-y-1 text-sm text-slate-700">
        <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-slate-400" />{customer.phone || 'Sem telefone'}</p>
        <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-slate-400" />{customer.email || 'Sem email'}</p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-2 text-xs"><div><span className="block text-slate-500">Pedidos</span><strong className="text-slate-950">{customer.foodProfile?.totalOrders || 0}</strong></div><div><span className="block text-slate-500">Valor</span><strong className="text-slate-950">{new Intl.NumberFormat('pt-AO').format(customer.foodProfile?.totalSpent || 0)} Kz</strong></div></div>
      <Button type="button" size="sm" variant="outline" className="mt-4" onClick={onKeep}><Check className="mr-2 h-4 w-4" />Manter este</Button>
    </div>
  );
}

export function FoodCustomerDuplicatesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const [mergeChoice, setMergeChoice] = useState<{ target: FoodV1Customer; source: FoodV1Customer; pair: FoodCustomerDuplicatePair } | null>(null);
  const duplicatesQuery = useQuery({ queryKey: ['food-customer-duplicates'], queryFn: getFoodCustomerDuplicates, enabled: open });
  const mergeMutation = useMutation({
    mutationFn: () => mergeFoodCustomers(
      mergeChoice?.target.id as number,
      mergeChoice?.source.id as number,
      `Duplicado confirmado manualmente: ${mergeChoice?.pair.reasons.map((reason) => reasonLabels[reason]).join(', ')}`
    ),
    onSuccess: async () => {
      setMergeChoice(null);
      await queryClient.invalidateQueries({ queryKey: ['food-v1-customers'] });
      await queryClient.invalidateQueries({ queryKey: ['food-customer-duplicates'] });
      await queryClient.invalidateQueries({ queryKey: ['food-marketing-overview'] });
    },
  });
  const pairs = duplicatesQuery.data || [];

  const chooseTarget = (pair: FoodCustomerDuplicatePair, targetIndex: 0 | 1) => {
    setMergeChoice({ target: pair.customers[targetIndex], source: pair.customers[targetIndex === 0 ? 1 : 0], pair });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto rounded-lg">
          <DialogHeader><DialogTitle>Possíveis duplicados</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-500">Confirme os dados e escolha o contacto que deve permanecer. A consolidação não apaga pedidos nem histórico.</p>
          {duplicatesQuery.isLoading ? <div className="h-60 animate-pulse rounded-lg bg-slate-100" /> : duplicatesQuery.isError ? <p className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{getApiErrorMessage(duplicatesQuery.error)}</p> : pairs.length === 0 ? <div className="rounded-lg border border-dashed border-slate-300 px-5 py-12 text-center"><Check className="mx-auto h-8 w-8 text-emerald-600" /><p className="mt-3 font-bold text-slate-950">Nenhum duplicado forte encontrado</p><p className="mt-1 text-sm text-slate-500">Telefone, email e contexto dos contactos activos foram verificados.</p></div> : <div className="space-y-4">{pairs.map((pair) => <section key={pair.id} className="rounded-lg border border-amber-200 bg-amber-50/40 p-4"><div className="mb-3 flex flex-wrap items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-700" />{pair.reasons.map((reason) => <span key={reason} className="rounded bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">{reasonLabels[reason]}</span>)}</div><div className="flex flex-col gap-3 md:flex-row"><CustomerCandidate customer={pair.customers[0]} onKeep={() => chooseTarget(pair, 0)} /><div className="flex items-center justify-center text-xs font-black text-slate-400">OU</div><CustomerCandidate customer={pair.customers[1]} onKeep={() => chooseTarget(pair, 1)} /></div></section>)}</div>}
        </DialogContent>
      </Dialog>

      <FoodConfirmDialog
        open={mergeChoice !== null}
        onOpenChange={(value) => { if (!value) setMergeChoice(null); }}
        title="Consolidar clientes?"
        description={mergeMutation.isError ? getApiErrorMessage(mergeMutation.error) : mergeChoice ? `${mergeChoice.target.name} será mantido. Os dados e históricos de ${mergeChoice.source.name} serão transferidos e o contacto de origem será arquivado.` : ''}
        confirmLabel="Consolidar"
        pending={mergeMutation.isPending}
        onConfirm={() => mergeMutation.mutate()}
      />
    </>
  );
}
