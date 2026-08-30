'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, MapPin, Pencil, Plus } from 'lucide-react';
import {
  archiveFoodCustomerAddress,
  archiveFoodV1Customer,
  createFoodCustomerAddress,
  createFoodV1Customer,
  getFoodContext,
  getFoodV1Customer,
  updateFoodCustomerAddress,
  updateFoodV1Customer,
} from '@/lib/api';
import type { FoodCustomerAddress, FoodV1Customer } from '@/lib/types';
import { getApiErrorMessage } from '@/lib/api-error-message';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FoodConfirmDialog } from '@/components/food/food-confirm-dialog';
import { FoodCustomerTimeline } from '@/components/food/food-customer-timeline';

type CustomerForm = {
  name: string;
  phone: string;
  email: string;
  company: string;
  location: string;
  birthDate: string;
  preferredBranchId: string;
  notes: string;
  tags: string;
  allergies: string;
  dietaryRestrictions: string;
  preferredChannel: 'WHATSAPP' | 'SMS' | 'EMAIL' | 'NONE';
  preferredOrderType: 'delivery' | 'pickup' | 'dine_in';
  favoriteNotes: string;
  marketingConsent: boolean;
  transactionalConsent: boolean;
};

type AddressForm = {
  id?: string;
  label: string;
  address: string;
  neighborhood: string;
  reference: string;
  isPrimary: boolean;
};

const emptyCustomer: CustomerForm = {
  name: '', phone: '', email: '', company: '', location: '', birthDate: '', preferredBranchId: '', notes: '', tags: '', allergies: '', dietaryRestrictions: '', preferredChannel: 'WHATSAPP', preferredOrderType: 'delivery', favoriteNotes: '', marketingConsent: false, transactionalConsent: true,
};
const emptyAddress: AddressForm = { label: 'Principal', address: '', neighborhood: '', reference: '', isPrimary: false };

function customerToForm(customer: FoodV1Customer): CustomerForm {
  return {
    name: customer.name || '',
    phone: customer.phone || '',
    email: customer.email || '',
    company: customer.company || '',
    location: customer.location || '',
    birthDate: customer.birthDate?.slice(0, 10) || '',
    preferredBranchId: customer.foodProfile?.preferredBranchId || '',
    notes: customer.foodProfile?.notes || '',
    tags: (() => {
      try {
        const tags = JSON.parse(customer.tags || '[]');
        return Array.isArray(tags) ? tags.filter((tag) => tag !== 'food').join(', ') : '';
      } catch (_error) {
        return '';
      }
    })(),
    allergies: customer.foodProfile?.preferences?.allergies?.join(', ') || '',
    dietaryRestrictions: customer.foodProfile?.preferences?.dietaryRestrictions?.join(', ') || '',
    preferredChannel: customer.foodProfile?.preferences?.preferredChannel || 'WHATSAPP',
    preferredOrderType: customer.foodProfile?.preferences?.preferredOrderType || 'delivery',
    favoriteNotes: customer.foodProfile?.preferences?.favoriteNotes || '',
    marketingConsent: customer.foodProfile?.marketingConsent === true,
    transactionalConsent: customer.foodProfile?.transactionalConsent !== false,
  };
}

function addressToForm(address: FoodCustomerAddress): AddressForm {
  return {
    id: address.id,
    label: address.label,
    address: address.address,
    neighborhood: address.neighborhood || '',
    reference: address.reference || '',
    isPrimary: address.isPrimary,
  };
}

export function FoodCustomerDialog({
  open,
  customerId,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  customerId: number | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CustomerForm>(emptyCustomer);
  const [addressForm, setAddressForm] = useState<AddressForm | null>(null);
  const [archiveCustomerOpen, setArchiveCustomerOpen] = useState(false);
  const [addressToArchive, setAddressToArchive] = useState<FoodCustomerAddress | null>(null);
  const contextQuery = useQuery({ queryKey: ['food-context'], queryFn: getFoodContext, enabled: open });
  const customerQuery = useQuery({
    queryKey: ['food-v1-customer', customerId],
    queryFn: () => getFoodV1Customer(customerId as number),
    enabled: open && customerId !== null,
  });

  useEffect(() => {
    if (!open) return;
    if (customerId === null) setForm(emptyCustomer);
  }, [open, customerId]);

  useEffect(() => {
    if (customerQuery.data) setForm(customerToForm(customerQuery.data));
  }, [customerQuery.data]);

  const refreshCustomer = async () => {
    await queryClient.invalidateQueries({ queryKey: ['food-v1-customer', customerId] });
    await queryClient.invalidateQueries({ queryKey: ['food-v1-customers'] });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        tags: Array.from(new Set(['food', ...form.tags.split(',').map((tag) => tag.trim()).filter(Boolean)])),
        preferences: {
          ...(customer?.foodProfile?.preferences || {}),
          allergies: form.allergies.split(',').map((item) => item.trim()).filter(Boolean),
          dietaryRestrictions: form.dietaryRestrictions.split(',').map((item) => item.trim()).filter(Boolean),
          preferredChannel: form.preferredChannel,
          preferredOrderType: form.preferredOrderType,
          favoriteNotes: form.favoriteNotes,
        },
        preferredBranchId: form.preferredBranchId || null,
        birthDate: form.birthDate || null,
      };
      return customerId === null
        ? createFoodV1Customer({ ...payload, name: form.name, phone: form.phone })
        : updateFoodV1Customer(customerId, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['food-v1-customers'] });
      await queryClient.invalidateQueries({ queryKey: ['food-marketing-overview'] });
      onSaved();
      onOpenChange(false);
    },
  });

  const archiveMutation = useMutation({
    mutationFn: () => archiveFoodV1Customer(customerId as number, 'Arquivado no CRM Food'),
    onSuccess: async () => {
      setArchiveCustomerOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['food-v1-customers'] });
      await queryClient.invalidateQueries({ queryKey: ['food-marketing-overview'] });
      onSaved();
      onOpenChange(false);
    },
  });

  const addressMutation = useMutation({
    mutationFn: () => {
      if (!addressForm || customerId === null) throw new Error('Morada inválida.');
      const payload = { ...addressForm };
      return addressForm.id
        ? updateFoodCustomerAddress(customerId, addressForm.id, payload)
        : createFoodCustomerAddress(customerId, payload);
    },
    onSuccess: async () => {
      setAddressForm(null);
      await refreshCustomer();
    },
  });

  const archiveAddressMutation = useMutation({
    mutationFn: () => archiveFoodCustomerAddress(customerId as number, addressToArchive?.id as string, 'Morada arquivada no CRM Food'),
    onSuccess: async () => {
      setAddressToArchive(null);
      await refreshCustomer();
    },
  });

  const error = saveMutation.error || archiveMutation.error || addressMutation.error || archiveAddressMutation.error || customerQuery.error;
  const customer = customerQuery.data;
  const addresses = customer?.foodProfile?.addresses || [];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto rounded-lg">
          <DialogHeader>
            <DialogTitle>{customerId === null ? 'Novo cliente Food' : 'Perfil do cliente'}</DialogTitle>
          </DialogHeader>

          {customerQuery.isLoading ? <div className="h-72 animate-pulse rounded-lg bg-slate-100" /> : (
            <div className="space-y-6">
              <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div><Label>Nome *</Label><Input className="mt-1" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div>
                <div><Label>Telefone *</Label><Input className="mt-1" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="9XXXXXXXX" /></div>
                <div><Label>Email</Label><Input className="mt-1" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></div>
                <div><Label>Empresa</Label><Input className="mt-1" value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} /></div>
                <div><Label>Zona/localização</Label><Input className="mt-1" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></div>
                <div><Label>Data de nascimento</Label><Input className="mt-1" type="date" value={form.birthDate} onChange={(event) => setForm({ ...form, birthDate: event.target.value })} /></div>
                <div className="sm:col-span-2"><Label>Unidade preferida</Label><select className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.preferredBranchId} onChange={(event) => setForm({ ...form, preferredBranchId: event.target.value })}><option value="">Sem preferência</option>{(contextQuery.data?.branches || []).map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></div>
                <div className="sm:col-span-2"><Label>Etiquetas</Label><Input className="mt-1" value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder="VIP, almoço, empresa" /><p className="mt-1 text-xs text-slate-500">Separe as etiquetas por vírgulas.</p></div>
                <div><Label>Alergias</Label><Input className="mt-1" value={form.allergies} onChange={(event) => setForm({ ...form, allergies: event.target.value })} placeholder="Amendoim, marisco" /></div>
                <div><Label>Restrições alimentares</Label><Input className="mt-1" value={form.dietaryRestrictions} onChange={(event) => setForm({ ...form, dietaryRestrictions: event.target.value })} placeholder="Sem glúten, vegetariano" /></div>
                <div><Label>Canal preferido</Label><select className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.preferredChannel} onChange={(event) => setForm({ ...form, preferredChannel: event.target.value as CustomerForm['preferredChannel'] })}><option value="WHATSAPP">WhatsApp</option><option value="SMS">SMS</option><option value="EMAIL">Email</option><option value="NONE">Não contactar</option></select></div>
                <div><Label>Tipo de pedido preferido</Label><select className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.preferredOrderType} onChange={(event) => setForm({ ...form, preferredOrderType: event.target.value as CustomerForm['preferredOrderType'] })}><option value="delivery">Entrega</option><option value="pickup">Recolha</option><option value="dine_in">No local</option></select></div>
                <div className="sm:col-span-2"><Label>Preferências do cliente</Label><Input className="mt-1" value={form.favoriteNotes} onChange={(event) => setForm({ ...form, favoriteNotes: event.target.value })} placeholder="Molho à parte, bebidas sem gelo" /></div>
                <div className="sm:col-span-2"><Label>Notas operacionais</Label><Textarea className="mt-1" rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></div>
              </section>

              {customer?.insights?.favoriteProducts.length ? <section><h3 className="font-black text-slate-950">Produtos mais pedidos</h3><div className="mt-2 flex flex-wrap gap-2">{customer.insights.favoriteProducts.map((product) => <span key={product.productId || product.name} className="rounded bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700">{product.name} · {product.quantity}</span>)}</div></section> : null}

              {customerId !== null ? <FoodCustomerTimeline contactId={customerId} /> : null}

              <section className="grid gap-3 border-y border-slate-200 py-4 sm:grid-cols-2">
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3"><Checkbox checked={form.marketingConsent} onCheckedChange={(checked) => setForm({ ...form, marketingConsent: checked === true })} /><span><span className="block text-sm font-bold text-slate-950">Marketing</span><span className="text-xs text-slate-500">Autoriza campanhas e promoções Food.</span></span></label>
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3"><Checkbox checked={form.transactionalConsent} onCheckedChange={(checked) => setForm({ ...form, transactionalConsent: checked === true })} /><span><span className="block text-sm font-bold text-slate-950">Mensagens do pedido</span><span className="text-xs text-slate-500">Autoriza comunicações operacionais.</span></span></label>
              </section>

              {customerId !== null ? <section className="space-y-3">
                <div className="flex items-center justify-between gap-3"><div><h3 className="font-black text-slate-950">Moradas</h3><p className="text-xs text-slate-500">A morada principal é usada primeiro no Caixa e Delivery.</p></div><Button type="button" size="sm" variant="outline" onClick={() => setAddressForm(emptyAddress)}><Plus className="mr-2 h-4 w-4" />Adicionar</Button></div>
                {addresses.length === 0 ? <div className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">Nenhuma morada registada.</div> : <div className="space-y-2">{addresses.map((address) => <div key={address.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 p-3"><div className="flex min-w-0 gap-3"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--workspace-primary)]" /><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-bold text-slate-950">{address.label}</p>{address.isPrimary ? <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">Principal</span> : null}</div><p className="mt-1 text-sm text-slate-700">{address.address}{address.neighborhood ? `, ${address.neighborhood}` : ''}</p>{address.reference ? <p className="mt-1 text-xs text-slate-500">Referência: {address.reference}</p> : null}</div></div><div className="flex shrink-0 gap-1"><Button type="button" size="icon" variant="ghost" title="Editar morada" onClick={() => setAddressForm(addressToForm(address))}><Pencil className="h-4 w-4" /></Button><Button type="button" size="icon" variant="ghost" title="Arquivar morada" onClick={() => setAddressToArchive(address)}><Archive className="h-4 w-4 text-red-600" /></Button></div></div>)}</div>}

                {addressForm ? <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2"><div><Label>Etiqueta</Label><Input className="mt-1 bg-white" value={addressForm.label} onChange={(event) => setAddressForm({ ...addressForm, label: event.target.value })} /></div><div><Label>Bairro</Label><Input className="mt-1 bg-white" value={addressForm.neighborhood} onChange={(event) => setAddressForm({ ...addressForm, neighborhood: event.target.value })} /></div><div className="sm:col-span-2"><Label>Morada *</Label><Input className="mt-1 bg-white" value={addressForm.address} onChange={(event) => setAddressForm({ ...addressForm, address: event.target.value })} /></div><div className="sm:col-span-2"><Label>Referência</Label><Input className="mt-1 bg-white" value={addressForm.reference} onChange={(event) => setAddressForm({ ...addressForm, reference: event.target.value })} /></div><label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Checkbox checked={addressForm.isPrimary} onCheckedChange={(checked) => setAddressForm({ ...addressForm, isPrimary: checked === true })} />Morada principal</label><div className="flex justify-end gap-2"><Button type="button" size="sm" variant="outline" onClick={() => setAddressForm(null)}>Cancelar</Button><Button type="button" size="sm" disabled={!addressForm.address.trim() || addressMutation.isPending} onClick={() => addressMutation.mutate()}>Guardar morada</Button></div></div> : null}
              </section> : null}

              {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{getApiErrorMessage(error)}</p> : null}
              <div className="flex flex-col-reverse justify-between gap-3 sm:flex-row"><div>{customerId !== null ? <Button type="button" variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => setArchiveCustomerOpen(true)}><Archive className="mr-2 h-4 w-4" />Arquivar cliente</Button> : null}</div><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="button" disabled={!form.name.trim() || !form.phone.trim() || saveMutation.isPending} onClick={() => saveMutation.mutate()}>{saveMutation.isPending ? 'A guardar...' : 'Guardar cliente'}</Button></div></div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <FoodConfirmDialog open={archiveCustomerOpen} onOpenChange={setArchiveCustomerOpen} title="Arquivar cliente?" description="O cliente deixa de aparecer no Food, mas os pedidos e o histórico são preservados." confirmLabel="Arquivar" destructive pending={archiveMutation.isPending} onConfirm={() => archiveMutation.mutate()} />
      <FoodConfirmDialog open={addressToArchive !== null} onOpenChange={(value) => { if (!value) setAddressToArchive(null); }} title="Arquivar morada?" description="A morada deixa de estar disponível para novos pedidos." confirmLabel="Arquivar" destructive pending={archiveAddressMutation.isPending} onConfirm={() => archiveAddressMutation.mutate()} />
    </>
  );
}
