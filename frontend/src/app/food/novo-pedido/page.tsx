'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bike,
  ChevronRight,
  MapPin,
  Minus,
  PackageOpen,
  Plus,
  RotateCcw,
  Search,
  ShoppingBag,
  Trash2,
  UserRound,
  Utensils,
} from 'lucide-react';
import {
  createFoodOrder,
  getFoodCategories,
  getFoodContext,
  getFoodProducts,
  getFoodSettings,
  searchFoodCustomers,
} from '@/lib/api';
import type { FoodCustomerSearchResult, FoodModifierGroup, FoodOrderType, FoodProduct } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getApiErrorMessage } from '@/lib/api-error-message';
import { blobSrc } from '@/lib/file-utils';
import { getFoodBrandStyle } from '@/components/food/food-ui';
import { cn } from '@/lib/utils';

type CartItem = {
  key: string;
  product: FoodProduct;
  quantity: number;
  modifierOptionIds: string[];
  notes: string;
};

const ORDER_TYPE_META: Record<FoodOrderType, { label: string; icon: typeof Bike }> = {
  delivery: { label: 'Delivery', icon: Bike },
  pickup: { label: 'Levantamento', icon: ShoppingBag },
  dine_in: { label: 'No local', icon: Utensils },
};

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Dinheiro',
  MULTICAIXA: 'Multicaixa',
  TPA: 'TPA',
  TRANSFER: 'Transferência',
  OTHER: 'Outro',
};

function formatKz(value: number) {
  return `${new Intl.NumberFormat('pt-AO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0)} Kz`;
}

function productModifierOptions(product: FoodProduct) {
  return productModifierGroups(product).flatMap((group) =>
    (group.options ?? []).map((option) => ({
      ...option,
      groupId: group.id,
      groupName: group.name,
    }))
  );
}

function productModifierGroups(product: FoodProduct): FoodModifierGroup[] {
  return (product.modifierGroups ?? [])
    .map((entry) => entry.group)
    .filter((group): group is FoodModifierGroup =>
      Boolean(group && group.active !== false && (group.options ?? []).some((option) => option.active !== false))
    )
    .map((group) => ({
      ...group,
      options: (group.options ?? []).filter((option) => option.active !== false),
    }));
}

function modifierSelectionError(product: FoodProduct, selectedOptionIds: string[]) {
  for (const group of productModifierGroups(product)) {
    const groupOptionIds = new Set((group.options ?? []).map((option) => option.id));
    const selectedCount = selectedOptionIds.filter((id) => groupOptionIds.has(id)).length;
    const minSelection = group.required ? Math.max(1, Number(group.minSelection || 0)) : Number(group.minSelection || 0);
    const maxSelection = group.maxSelection ? Number(group.maxSelection) : null;
    if (minSelection > 0 && selectedCount < minSelection) {
      return `Escolha pelo menos ${minSelection} opção(ões) em ${group.name}.`;
    }
    if (maxSelection && selectedCount > maxSelection) {
      return `Escolha no máximo ${maxSelection} opção(ões) em ${group.name}.`;
    }
  }
  return '';
}

function cartItemUnitTotal(item: CartItem) {
  const options = productModifierOptions(item.product).filter((option) => item.modifierOptionIds.includes(option.id));
  return item.product.price + options.reduce((sum, option) => sum + Number(option.priceDelta || 0), 0);
}

function makeCartKey(productId: string, optionIds: string[], notes = '') {
  return `${productId}:${[...optionIds].sort().join(',')}:${notes.trim()}`;
}

function itemCount(cart: CartItem[]) {
  return cart.reduce((sum, item) => sum + item.quantity, 0);
}

function paymentLabel(method: string) {
  return PAYMENT_LABELS[method] || method;
}

export default function NewFoodOrderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const submittingRef = useRef(false);
  const [productSearch, setProductSearch] = useState('');
  const [branchId, setBranchId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<FoodCustomerSearchResult | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryNeighborhood, setDeliveryNeighborhood] = useState('');
  const [deliveryReference, setDeliveryReference] = useState('');
  const [tableName, setTableName] = useState('');
  const [orderType, setOrderType] = useState<FoodOrderType>('delivery');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [deliveryFee, setDeliveryFee] = useState('0');
  const [notes, setNotes] = useState('');
  const [notesOpen, setNotesOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [configuringProduct, setConfiguringProduct] = useState<FoodProduct | null>(null);
  const [configuringCartItemKey, setConfiguringCartItemKey] = useState<string | null>(null);
  const [modifierOptionIds, setModifierOptionIds] = useState<string[]>([]);
  const [modifierNotes, setModifierNotes] = useState('');
  const [modifierQuantity, setModifierQuantity] = useState('1');
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [deliveryDialogOpen, setDeliveryDialogOpen] = useState(false);
  const [cartDialogOpen, setCartDialogOpen] = useState(false);

  const settingsQuery = useQuery({ queryKey: ['food-settings'], queryFn: getFoodSettings, retry: 2 });
  const contextQuery = useQuery({ queryKey: ['food-context'], queryFn: getFoodContext, retry: 2 });
  const settings = settingsQuery.data;
  const enabled = settings?.isEnabled === true;
  const categoriesQuery = useQuery({ queryKey: ['food-categories'], queryFn: getFoodCategories, retry: 2, enabled });
  const productsQuery = useQuery({ queryKey: ['food-products', 'available', branchId], queryFn: () => getFoodProducts({ active: true, available: true, branchId }), retry: 2, enabled: enabled && Boolean(branchId) });
  const customersQuery = useQuery({
    queryKey: ['food-customers', customerSearch],
    queryFn: () => searchFoodCustomers(customerSearch),
    enabled: enabled && customerSearch.trim().length >= 2,
    retry: 1,
  });

  const branches = contextQuery.data?.branches ?? [];
  useEffect(() => {
    if (branchId || branches.length === 0) return;
    const requestedBranchId = searchParams.get('branch');
    setBranchId(branches.find((branch) => branch.id === requestedBranchId)?.id || branches.find((branch) => branch.isMain)?.id || branches[0].id);
  }, [branchId, branches, searchParams]);

  const products = productsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const orderTypes = (settings?.orderTypes ?? ['delivery', 'pickup', 'dine_in']).filter((type): type is FoodOrderType => ['delivery', 'pickup', 'dine_in'].includes(type));
  const paymentMethods = settings?.paymentMethods ?? ['CASH', 'MULTICAIXA', 'TPA', 'TRANSFER'];
  const cartCount = itemCount(cart);
  const selectedCustomerLabel = selectedCustomer
    ? `${selectedCustomer.name} · ${selectedCustomer.phone}`
    : customerName || customerPhone
      ? `${customerName || 'Cliente'}${customerPhone ? ` · ${customerPhone}` : ''}`
      : '';

  const filteredProducts = useMemo(() => {
    const normalized = productSearch.trim().toLowerCase();
    return products.filter((product) => {
      const matchesCategory = !categoryId || product.categoryId === categoryId;
      const matchesBranch = !branchId || !product.branchId || product.branchId === branchId;
      const matchesSearch = !normalized || [product.name, product.internalCode, product.description].filter(Boolean).join(' ').toLowerCase().includes(normalized);
      return matchesBranch && matchesCategory && matchesSearch;
    });
  }, [branchId, categoryId, productSearch, products]);

  const productQuantities = useMemo(() => {
    const quantities = new Map<string, number>();
    for (const item of cart) quantities.set(item.product.id, (quantities.get(item.product.id) || 0) + item.quantity);
    return quantities;
  }, [cart]);

  const subtotal = cart.reduce((sum, item) => sum + cartItemUnitTotal(item) * item.quantity, 0);
  const deliveryTotal = orderType === 'delivery' ? Math.max(0, Number(deliveryFee || 0)) : 0;
  const total = Math.max(0, subtotal + deliveryTotal);
  const hasCustomer = Boolean(selectedCustomer || (customerName.trim() && customerPhone.trim()));
  const hasDelivery = orderType !== 'delivery' || Boolean(deliveryAddress.trim() || deliveryNeighborhood.trim());
  const disabledReason = !branchId
    ? 'Seleccione uma unidade'
    : cart.length === 0
      ? 'Adicione um produto'
    : !hasCustomer
      ? 'Informe o cliente'
      : !hasDelivery
        ? 'Adicione a morada'
        : !paymentMethod
          ? 'Escolha o pagamento'
          : '';
  const currentModifierGroups = configuringProduct ? productModifierGroups(configuringProduct) : [];
  const currentModifierError = configuringProduct ? modifierSelectionError(configuringProduct, modifierOptionIds) : '';

  const createOrderMutation = useMutation({
    mutationFn: () => createFoodOrder({
      branchId,
      contactId: selectedCustomer?.id ?? null,
      createCustomer: !selectedCustomer && !!customerPhone.trim(),
      customerName: selectedCustomer?.name || customerName || null,
      customerPhone: selectedCustomer?.phone || customerPhone || null,
      orderType,
      deliveryAddress: orderType === 'delivery' ? deliveryAddress || null : null,
      deliveryNeighborhood: orderType === 'delivery' ? deliveryNeighborhood || null : null,
      deliveryReference: orderType === 'delivery' ? deliveryReference || null : null,
      tableName: orderType === 'dine_in' ? tableName || null : null,
      paymentMethod,
      paymentStatus: 'pending',
      deliveryFee: deliveryTotal,
      notes: notes || null,
      sendToKitchen: true,
      items: cart.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
        modifierOptionIds: item.modifierOptionIds,
        notes: item.notes || null,
      })),
    }),
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ['food-orders'] });
      queryClient.invalidateQueries({ queryKey: ['food-v1-orders'] });
      queryClient.invalidateQueries({ queryKey: ['food-overview'] });
      router.push(`/food/pedidos?pedido=${order.id}`);
    },
    onSettled: () => {
      submittingRef.current = false;
    },
  });

  const addProductToCart = (product: FoodProduct, options: { quantity?: number; optionIds?: string[]; notes?: string } = {}) => {
    const quantity = Math.max(1, Number(options.quantity || 1));
    const optionIds = options.optionIds ?? [];
    const itemNotes = options.notes?.trim() || '';
    const key = makeCartKey(product.id, optionIds, itemNotes);
    setCart((prev) => {
      const existing = prev.find((item) => item.key === key);
      if (existing) return prev.map((item) => item.key === key ? { ...item, quantity: item.quantity + quantity } : item);
      return [...prev, { key, product, quantity, modifierOptionIds: optionIds, notes: itemNotes }];
    });
  };

  const openProductOptions = (product: FoodProduct, item?: CartItem) => {
    const activeOptionIds = new Set(productModifierOptions(product).map((option) => option.id));
    if (activeOptionIds.size === 0 && !item) {
      addProductToCart(product);
      return;
    }
    setConfiguringProduct(product);
    setConfiguringCartItemKey(item?.key ?? null);
    setModifierOptionIds(item ? item.modifierOptionIds.filter((id) => activeOptionIds.has(id)) : []);
    setModifierNotes(item?.notes ?? '');
    setModifierQuantity(String(item?.quantity ?? 1));
  };

  const toggleModifierOption = (group: FoodModifierGroup, optionId: string) => {
    const groupOptionIds = new Set((group.options ?? []).map((option) => option.id));
    const maxSelection = group.maxSelection ? Number(group.maxSelection) : null;
    setModifierOptionIds((prev) => {
      const selected = prev.includes(optionId);
      if (selected) return prev.filter((id) => id !== optionId);
      const selectedInGroup = prev.filter((id) => groupOptionIds.has(id));
      if (maxSelection === 1) return [...prev.filter((id) => !groupOptionIds.has(id)), optionId];
      if (maxSelection && selectedInGroup.length >= maxSelection) return prev;
      return [...prev, optionId];
    });
  };

  const submitConfiguredProduct = () => {
    if (!configuringProduct) return;
    if (modifierSelectionError(configuringProduct, modifierOptionIds)) return;
    if (configuringCartItemKey) {
      const quantity = Math.max(1, Number(modifierQuantity || 1));
      const itemNotes = modifierNotes.trim();
      const key = makeCartKey(configuringProduct.id, modifierOptionIds, itemNotes);
      const nextItem: CartItem = { key, product: configuringProduct, quantity, modifierOptionIds, notes: itemNotes };
      setCart((prev) => {
        const withoutEdited = prev.filter((item) => item.key !== configuringCartItemKey);
        const existing = withoutEdited.find((item) => item.key === nextItem.key);
        if (existing) {
          return withoutEdited.map((item) => item.key === nextItem.key ? { ...item, quantity: item.quantity + nextItem.quantity } : item);
        }
        return [...withoutEdited, nextItem];
      });
    } else {
      addProductToCart(configuringProduct, {
        quantity: Number(modifierQuantity || 1),
        optionIds: modifierOptionIds,
        notes: modifierNotes,
      });
    }
    setConfiguringCartItemKey(null);
    setConfiguringProduct(null);
  };

  const updateCartQuantity = (key: string, delta: number) => {
    setCart((prev) => prev
      .map((item) => item.key === key ? { ...item, quantity: item.quantity + delta } : item)
      .filter((item) => item.quantity > 0));
  };

  const selectCustomer = (customer: FoodCustomerSearchResult) => {
    setSelectedCustomer(customer);
    setCustomerName(customer.name);
    setCustomerPhone(customer.phone);
    setDeliveryAddress(customer.location || '');
    setCustomerSearch('');
    setCustomerDialogOpen(false);
  };

  const clearOrder = () => {
    setCart([]);
    setSelectedCustomer(null);
    setCustomerName('');
    setCustomerPhone('');
    setDeliveryAddress('');
    setDeliveryNeighborhood('');
    setDeliveryReference('');
    setTableName('');
    setPaymentMethod('');
    setDeliveryFee('0');
    setNotes('');
    setNotesOpen(false);
  };

  const submitOrder = () => {
    if (disabledReason || createOrderMutation.isPending || submittingRef.current) return;
    submittingRef.current = true;
    createOrderMutation.mutate();
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    submitOrder();
  };

  const renderCart = (mobile = false) => (
    <div className={cn('flex min-h-0 flex-col bg-white', mobile ? 'h-[calc(100vh-4rem)]' : 'h-[calc(100vh-14.5rem)] min-h-[560px] rounded-[14px] border border-[#EAECF0] shadow-sm')}>
      <div className="flex items-center justify-between border-b border-[#EAECF0] px-4 py-4">
        <div>
          <p className="text-lg font-black text-[#101828]">Pedido</p>
          <p className="text-sm font-medium text-[#667085]">{cartCount} item(ns)</p>
        </div>
        <button type="button" onClick={clearOrder} className="inline-flex min-h-10 items-center gap-2 rounded-[10px] border border-[#EAECF0] px-3 text-sm font-bold text-[#667085] hover:bg-[#F7F8FA]">
          <RotateCcw className="h-4 w-4" />
          Limpar
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="mb-3">
          <Label htmlFor={mobile ? 'mobile-food-branch' : 'food-branch'}>Unidade</Label>
          <select id={mobile ? 'mobile-food-branch' : 'food-branch'} className="mt-1 h-11 w-full rounded-[10px] border border-[#EAECF0] bg-white px-3 text-sm font-bold text-[#101828]" value={branchId} onChange={(event) => { setBranchId(event.target.value); setCart([]); }}>
            <option value="">Seleccionar unidade</option>
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </select>
        </div>
        <button
          type="button"
          onClick={() => setCustomerDialogOpen(true)}
          className="flex min-h-12 w-full items-center justify-between rounded-[14px] border border-[#EAECF0] px-3 text-left hover:bg-[#F7F8FA]"
        >
          <span className="flex min-w-0 items-center gap-3">
            <UserRound className="h-5 w-5 shrink-0 text-[#667085]" />
            <span className="min-w-0">
              <span className={cn('block truncate text-sm font-black', selectedCustomerLabel ? 'text-[#101828]' : 'text-[#667085]')}>
                {selectedCustomerLabel || 'Adicionar cliente'}
              </span>
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-[#98A2B3]" />
        </button>

        {orderType === 'delivery' ? (
          <button
            type="button"
            onClick={() => setDeliveryDialogOpen(true)}
            className="mt-3 flex min-h-14 w-full items-center justify-between rounded-[14px] border border-[#EAECF0] px-3 text-left hover:bg-[#F7F8FA]"
          >
            <span className="flex min-w-0 items-center gap-3">
              <MapPin className="h-5 w-5 shrink-0 text-[#667085]" />
              <span className="min-w-0">
                <span className={cn('block truncate text-sm font-black', deliveryNeighborhood || deliveryAddress ? 'text-[#101828]' : 'text-[#667085]')}>
                  {deliveryNeighborhood || deliveryAddress || 'Editar entrega'}
                </span>
                {deliveryNeighborhood || deliveryAddress ? <span className="block truncate text-xs text-[#667085]">{deliveryAddress || deliveryReference || 'Sem morada'}</span> : null}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-[#98A2B3]" />
          </button>
        ) : null}

        {orderType === 'dine_in' ? (
          <button
            type="button"
            onClick={() => setDeliveryDialogOpen(true)}
            className="mt-3 flex min-h-12 w-full items-center justify-between rounded-[14px] border border-[#EAECF0] px-3 text-left hover:bg-[#F7F8FA]"
          >
            <span className="flex min-w-0 items-center gap-3">
              <Utensils className="h-5 w-5 shrink-0 text-[#667085]" />
              <span className={cn('block truncate text-sm font-black', tableName ? 'text-[#101828]' : 'text-[#667085]')}>
                {tableName || 'Mesa'}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-[#98A2B3]" />
          </button>
        ) : null}

        <div className="mt-4 space-y-1">
          {cart.length === 0 ? (
            <div className="flex min-h-40 flex-col items-center justify-center rounded-[14px] border border-dashed border-[#EAECF0] text-center">
              <ShoppingBag className="h-8 w-8 text-[#98A2B3]" />
              <p className="mt-3 text-sm font-black text-[#101828]">Adicione produtos ao pedido</p>
            </div>
          ) : cart.map((item) => (
            <div key={item.key} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-[#EAECF0] py-3 last:border-b-0">
              <button type="button" onClick={() => openProductOptions(item.product, item)} className="min-w-0 text-left">
                <p className="truncate text-sm font-black text-[#101828]">{item.product.name}</p>
                {item.modifierOptionIds.length > 0 ? (
                  <p className="mt-0.5 truncate text-xs font-medium text-[#667085]">
                    {productModifierOptions(item.product).filter((option) => item.modifierOptionIds.includes(option.id)).map((option) => option.name).join(', ')}
                  </p>
                ) : null}
              </button>
              <button type="button" onClick={() => setCart((prev) => prev.filter((entry) => entry.key !== item.key))} className="rounded-[10px] p-2 text-[#D92D20] hover:bg-red-50">
                <Trash2 className="h-4 w-4" />
              </button>
              <div className="col-span-2 flex items-center justify-between gap-3">
                <div className="inline-flex items-center rounded-[10px] border border-[#EAECF0]">
                  <button type="button" onClick={() => updateCartQuantity(item.key, -1)} className="min-h-9 px-3 text-[#667085]"><Minus className="h-4 w-4" /></button>
                  <span className="w-8 text-center text-sm font-black text-[#101828]">{item.quantity}</span>
                  <button type="button" onClick={() => updateCartQuantity(item.key, 1)} className="min-h-9 px-3 text-[#667085]"><Plus className="h-4 w-4" /></button>
                </div>
                <strong className="text-sm text-[#101828]">{formatKz(cartItemUnitTotal(item) * item.quantity)}</strong>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <div className="grid grid-cols-2 gap-2">
            {paymentMethods.map((method) => {
              const active = paymentMethod === method;
              return (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={cn(
                    'min-h-11 rounded-[10px] border px-3 text-sm font-black',
                    active
                      ? 'border-[var(--workspace-primary)] bg-[var(--workspace-primary-soft)] text-[var(--workspace-primary)]'
                      : 'border-[#EAECF0] text-[#667085] hover:bg-[#F7F8FA]'
                  )}
                >
                  {paymentLabel(method)}
                </button>
              );
            })}
          </div>

          {notesOpen ? (
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Observação" rows={3} className="mt-3" />
          ) : (
            <button type="button" onClick={() => setNotesOpen(true)} className="mt-3 min-h-10 text-sm font-black text-[var(--workspace-primary)]">
              + Observação
            </button>
          )}
        </div>
      </div>

      <div className="border-t border-[#EAECF0] bg-white px-4 py-4">
        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-[#667085]"><span>Subtotal</span><strong className="text-[#101828]">{formatKz(subtotal)}</strong></div>
          <div className="flex justify-between text-[#667085]"><span>Entrega</span><strong className="text-[#101828]">{formatKz(deliveryTotal)}</strong></div>
        </div>
        <div className="mt-3 flex items-end justify-between">
          <span className="text-sm font-bold text-[#667085]">Total</span>
          <strong className="text-2xl font-black text-[#101828]">{formatKz(total)}</strong>
        </div>
        {disabledReason ? <p className="mt-2 text-center text-sm font-bold text-[#D92D20]">{disabledReason}</p> : null}
        <Button type="button" onClick={submitOrder} className="mt-3 min-h-12 w-full rounded-[10px] text-base font-black" disabled={Boolean(disabledReason) || createOrderMutation.isPending}>
          {createOrderMutation.isPending ? 'A enviar...' : `Enviar para a cozinha · ${formatKz(total)}`}
        </Button>
      </div>
    </div>
  );

  if (settingsQuery.isLoading) {
    return <div className="mx-auto max-w-7xl p-4 md:p-6"><div className="h-64 animate-pulse rounded-[14px] bg-white" /></div>;
  }

  if (!enabled) {
    return (
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <ErrorState title="KukuGest Food ainda não está activo" message="Active o módulo em Configurações para criar pedidos." />
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="min-h-full bg-[#F7F8FA] p-4 pb-24 md:p-5 xl:pb-5"
      style={getFoodBrandStyle(settings)}
    >
      <div className="mx-auto flex max-w-[1500px] flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-black tracking-normal text-[#101828]">Novo pedido</h1>
          <button type="button" onClick={clearOrder} className="inline-flex min-h-10 items-center gap-2 rounded-[10px] border border-[#EAECF0] bg-white px-3 text-sm font-bold text-[#667085] shadow-sm hover:bg-[#F7F8FA]">
            <RotateCcw className="h-4 w-4" />
            Limpar
          </button>
        </div>

        {createOrderMutation.isError ? (
          <ErrorState compact title="Não foi possível criar o pedido" message={getApiErrorMessage(createOrderMutation.error, 'Verifique os dados e tente novamente.')} />
        ) : null}

        <div className="flex max-w-full gap-2 overflow-x-auto">
          {orderTypes.map((type) => {
            const Icon = ORDER_TYPE_META[type].icon;
            const active = orderType === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => setOrderType(type)}
                className={cn(
                  'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-[10px] border px-4 text-sm font-black',
                  active
                    ? 'border-[var(--workspace-primary)] bg-[var(--workspace-primary)] text-[var(--workspace-on-primary)]'
                    : 'border-[#EAECF0] bg-white text-[#667085] hover:bg-white'
                )}
              >
                <Icon className="h-4 w-4" />
                {ORDER_TYPE_META[type].label}
              </button>
            );
          })}
        </div>

        <div className="grid min-h-0 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
          <section className="min-w-0 rounded-[14px] border border-[#EAECF0] bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
                <Input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Pesquisar no menu" className="min-h-11 rounded-[10px] border-[#EAECF0] pl-9" />
              </div>
            </div>

            <div className="mt-3 flex max-w-full gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setCategoryId('')}
                className={cn(
                  'min-h-10 shrink-0 rounded-full border px-4 text-sm font-black',
                  !categoryId ? 'border-[var(--workspace-primary)] bg-[var(--workspace-primary-soft)] text-[var(--workspace-primary)]' : 'border-[#EAECF0] text-[#667085]'
                )}
              >
                Todos
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setCategoryId(category.id)}
                  className={cn(
                    'min-h-10 shrink-0 rounded-full border px-4 text-sm font-black',
                    categoryId === category.id ? 'border-[var(--workspace-primary)] bg-[var(--workspace-primary-soft)] text-[var(--workspace-primary)]' : 'border-[#EAECF0] text-[#667085]'
                  )}
                >
                  {category.name}
                </button>
              ))}
            </div>

            {productsQuery.isError ? (
              <div className="mt-4">
                <ErrorState compact title="Não foi possível carregar produtos" message={getApiErrorMessage(productsQuery.error, 'Tente novamente.')} onRetry={() => productsQuery.refetch()} />
              </div>
            ) : null}

            {productsQuery.isLoading ? (
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, index) => <div key={index} className="aspect-square animate-pulse rounded-[14px] bg-[#F7F8FA]" />)}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="mt-8 flex min-h-52 flex-col items-center justify-center text-center">
                <PackageOpen className="h-9 w-9 text-[#98A2B3]" />
                <p className="mt-3 text-sm font-black text-[#101828]">Sem produtos disponíveis</p>
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-4">
                {filteredProducts.map((product) => {
                  const quantity = productQuantities.get(product.id) || 0;
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => openProductOptions(product)}
                      className="group relative overflow-hidden rounded-[14px] border border-[#EAECF0] bg-white text-left shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:-translate-y-0.5 hover:border-[var(--workspace-primary-border)] hover:shadow-[0_8px_18px_rgba(16,24,40,0.08)]"
                    >
                      <div className="aspect-square bg-[#F7F8FA]">
                        {product.imageUrl ? <img src={blobSrc(product.imageUrl)} alt={product.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-[#98A2B3]"><Utensils className="h-8 w-8" /></div>}
                      </div>
                      {quantity > 0 ? (
                        <span className="absolute right-2 top-2 flex h-7 min-w-7 items-center justify-center rounded-full bg-[var(--workspace-primary)] px-2 text-sm font-black text-[var(--workspace-on-primary)]">
                          {quantity}
                        </span>
                      ) : null}
                      <div className="p-3">
                        <p className="line-clamp-2 min-h-10 text-sm font-black leading-5 text-[#101828]">{product.name}</p>
                        <p className="mt-1 text-sm font-black text-[#101828]">{formatKz(product.price)}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="hidden xl:block">
            {renderCart()}
          </aside>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setCartDialogOpen(true)}
        className="fixed inset-x-4 bottom-4 z-30 flex min-h-14 items-center justify-center rounded-[14px] bg-[var(--workspace-primary)] px-4 text-base font-black text-[var(--workspace-on-primary)] shadow-lg xl:hidden"
      >
        Ver pedido · {cartCount} item(ns) · {formatKz(total)}
      </button>

      <Dialog open={cartDialogOpen} onOpenChange={setCartDialogOpen}>
        <DialogContent className="h-screen max-w-none rounded-none p-0 sm:h-auto sm:max-w-lg sm:rounded-[14px]">
          {renderCart(true)}
        </DialogContent>
      </Dialog>

      <Dialog open={customerDialogOpen} onOpenChange={setCustomerDialogOpen}>
        <DialogContent className="max-w-lg rounded-[14px]">
          <DialogHeader>
            <DialogTitle>Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
              <Input value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Nome ou telefone" className="pl-9" />
            </div>
            {customersQuery.data && customerSearch.trim().length >= 2 ? (
              <div className="grid gap-2">
                {customersQuery.data.map((customer) => (
                  <button key={customer.id} type="button" onClick={() => selectCustomer(customer)} className="rounded-[10px] border border-[#EAECF0] px-3 py-2 text-left hover:bg-[#F7F8FA]">
                    <span className="block text-sm font-black text-[#101828]">{customer.name}</span>
                    <span className="text-xs text-[#667085]">{customer.phone} · {customer.totalOrders || 0} pedidos</span>
                  </button>
                ))}
              </div>
            ) : null}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label>Nome</Label>
                <Input value={customerName} onChange={(event) => { setSelectedCustomer(null); setCustomerName(event.target.value); }} placeholder="Cliente" />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={customerPhone} onChange={(event) => { setSelectedCustomer(null); setCustomerPhone(event.target.value); }} placeholder="+244 923 000 000" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setCustomerDialogOpen(false)}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deliveryDialogOpen} onOpenChange={setDeliveryDialogOpen}>
        <DialogContent className="max-w-lg rounded-[14px]">
          <DialogHeader>
            <DialogTitle>{orderType === 'dine_in' ? 'Mesa' : 'Entrega'}</DialogTitle>
          </DialogHeader>
          {orderType === 'dine_in' ? (
            <div>
              <Label>Mesa</Label>
              <Input value={tableName} onChange={(event) => setTableName(event.target.value)} placeholder="Mesa 4" />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label>Bairro/zona</Label>
                <Input value={deliveryNeighborhood} onChange={(event) => setDeliveryNeighborhood(event.target.value)} placeholder="Zango 3" />
              </div>
              <div>
                <Label>Morada</Label>
                <Input value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} placeholder="Rua principal" />
              </div>
              <div>
                <Label>Referência</Label>
                <Input value={deliveryReference} onChange={(event) => setDeliveryReference(event.target.value)} placeholder="Ao lado do mercado" />
              </div>
              <div>
                <Label>Taxa</Label>
                <Input type="number" min="0" value={deliveryFee} onChange={(event) => setDeliveryFee(event.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" onClick={() => setDeliveryDialogOpen(false)}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!configuringProduct}
        onOpenChange={(open) => {
          if (!open) {
            setConfiguringProduct(null);
            setConfiguringCartItemKey(null);
          }
        }}
      >
        <DialogContent className="max-w-xl rounded-[14px]">
          <DialogHeader>
            <DialogTitle>{configuringProduct?.name}</DialogTitle>
            <DialogDescription>Escolha os extras do item antes de enviar para o pedido.</DialogDescription>
          </DialogHeader>
          {configuringProduct ? (
            <div className="space-y-4">
              {currentModifierGroups.map((group) => {
                const groupOptionIds = new Set((group.options ?? []).map((option) => option.id));
                const selectedInGroup = modifierOptionIds.filter((id) => groupOptionIds.has(id)).length;
                const minSelection = group.required ? Math.max(1, Number(group.minSelection || 0)) : Number(group.minSelection || 0);
                const maxSelection = group.maxSelection ? Number(group.maxSelection) : null;
                return (
                <div key={group.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-[#101828]">{group.name}</p>
                      <p className="mt-0.5 text-xs font-bold text-[#667085]">
                        {minSelection > 0 ? `Mín. ${minSelection}` : 'Opcional'}
                        {maxSelection ? ` · Máx. ${maxSelection}` : ''}
                      </p>
                    </div>
                    <span className="rounded-full bg-[#F7F8FA] px-2 py-1 text-xs font-black text-[#667085]">{selectedInGroup} seleccionado(s)</span>
                  </div>
                  <div className="mt-2 grid gap-2">
                    {(group.options ?? []).map((option) => {
                      const selected = modifierOptionIds.includes(option.id);
                      const maxReached = Boolean(maxSelection && !selected && selectedInGroup >= maxSelection);
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => toggleModifierOption(group, option.id)}
                          className={selected
                            ? 'flex min-h-11 items-center justify-between rounded-[10px] border border-[var(--workspace-primary-border)] bg-[var(--workspace-primary-soft)] px-3 text-left text-sm font-black text-[var(--workspace-primary)]'
                            : maxReached
                              ? 'flex min-h-11 items-center justify-between rounded-[10px] border border-[#EAECF0] bg-[#F7F8FA] px-3 text-left text-sm font-bold text-[#98A2B3]'
                              : 'flex min-h-11 items-center justify-between rounded-[10px] border border-[#EAECF0] px-3 text-left text-sm font-bold text-[#101828] hover:bg-[#F7F8FA]'}
                        >
                          <span>{option.name}</span>
                          <span>{option.priceDelta > 0 ? `+ ${formatKz(option.priceDelta)}` : 'Incluído'}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
              })}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[120px_minmax(0,1fr)]">
                <div>
                  <Label>Quantidade</Label>
                  <div className="mt-1 grid grid-cols-[40px_minmax(0,1fr)_40px] rounded-[10px] border border-[#EAECF0]">
                    <button type="button" onClick={() => setModifierQuantity((value) => String(Math.max(1, Number(value || 1) - 1)))} className="flex min-h-10 items-center justify-center text-[#667085]"><Minus className="h-4 w-4" /></button>
                    <Input type="number" min="1" value={modifierQuantity} onChange={(event) => setModifierQuantity(event.target.value)} className="border-0 text-center font-black shadow-none focus-visible:ring-0" />
                    <button type="button" onClick={() => setModifierQuantity((value) => String(Math.max(1, Number(value || 1) + 1)))} className="flex min-h-10 items-center justify-center text-[#667085]"><Plus className="h-4 w-4" /></button>
                  </div>
                </div>
                <div>
                  <Label>Observação</Label>
                  <Input value={modifierNotes} onChange={(event) => setModifierNotes(event.target.value)} placeholder="Sem gelo" />
                </div>
              </div>
              {currentModifierError ? <p className="text-sm font-bold text-[#D92D20]">{currentModifierError}</p> : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfiguringProduct(null)}>Cancelar</Button>
            <Button type="button" onClick={submitConfiguredProduct} disabled={Boolean(currentModifierError)}>
              {configuringCartItemKey ? 'Guardar extras' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
