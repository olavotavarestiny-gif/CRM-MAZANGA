'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  Copy,
  Edit3,
  ImageIcon,
  MoreHorizontal,
  Package,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Utensils,
} from 'lucide-react';
import {
  archiveFoodCategory,
  archiveFoodProduct,
  createFoodCategory,
  createFoodModifierGroup,
  createFoodModifierOption,
  createFoodProduct,
  getCurrentUser,
  getFoodCategories,
  getFoodModifierGroups,
  getFoodProducts,
  getFoodSettings,
  updateFoodCategory,
  updateFoodModifierGroup,
  updateFoodModifierOption,
  updateFoodProduct,
} from '@/lib/api';
import type { FoodCategory, FoodModifierGroup, FoodProduct } from '@/lib/types';
import { canFood } from '@/lib/permissions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { getApiErrorMessage } from '@/lib/api-error-message';
import { blobSrc } from '@/lib/file-utils';
import {
  FoodEmptyState,
  FoodImagePicker,
  FoodPageHeader,
  FoodTabs,
  SuccessNote,
  getFoodBrandStyle,
} from '@/components/food/food-ui';
import { FoodConfirmDialog } from '@/components/food/food-confirm-dialog';

type MenuTab = 'products' | 'categories' | 'extras';
type AvailabilityFilter = 'all' | 'available' | 'unavailable';

type ProductForm = {
  imageUrl: string;
  name: string;
  categoryId: string;
  price: string;
  preparationMinutes: string;
  available: boolean;
  internalCode: string;
  description: string;
  modifierGroupIds: string[];
};

type CategoryForm = {
  name: string;
  color: string;
  icon: string;
};

type ExtraOptionForm = { id?: string; name: string; priceDelta: string };

const emptyProductForm: ProductForm = {
  imageUrl: '',
  name: '',
  categoryId: '',
  price: '',
  preparationMinutes: '15',
  available: true,
  internalCode: '',
  description: '',
  modifierGroupIds: [],
};

function formatKz(value: number) {
  return `${new Intl.NumberFormat('pt-AO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0)} Kz`;
}

function generatedCode(name: string) {
  const prefix = String(name || 'ITEM')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 4)
    .toUpperCase() || 'ITEM';
  return `${prefix}-${Date.now().toString(36).toUpperCase().slice(-5)}`;
}

function productGroupIds(product: FoodProduct) {
  return (product.modifierGroups ?? []).filter((entry) => entry.group?.active !== false).map((entry) => entry.groupId);
}

function ProductCard({
  product,
  onToggle,
  onEdit,
  onDuplicate,
  onArchive,
  busy,
}: {
  product: FoodProduct;
  onToggle: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
  busy?: boolean;
}) {
  return (
    <Card className="overflow-hidden rounded-2xl border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative aspect-[4/3] bg-slate-100">
        {product.imageUrl ? (
          <img src={blobSrc(product.imageUrl)} alt={product.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-300">
            <ImageIcon className="h-10 w-10" />
          </div>
        )}
        <div className="absolute left-3 top-3">
          <Badge variant={product.available ? 'success' : 'secondary'}>{product.available ? 'Disponível' : 'Indisponível'}</Badge>
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-black text-slate-950">{product.name}</p>
            <p className="mt-1 text-sm font-semibold text-[var(--workspace-primary)]">{formatKz(product.price)}</p>
          </div>
          <button type="button" aria-label="Mais acções" className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
          <span className="rounded-full bg-slate-100 px-2.5 py-1">{product.category?.name || 'Sem categoria'}</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1">{product.preparationMinutes} minutos</span>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2">
          <button
            type="button"
            onClick={onToggle}
            disabled={busy}
            className="col-span-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {product.available ? 'Indisponível' : 'Disponível'}
          </button>
          <button type="button" onClick={onEdit} aria-label="Editar produto" className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50">
            <Edit3 className="mx-auto h-4 w-4" />
          </button>
          <button type="button" onClick={onDuplicate} aria-label="Duplicar produto" className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50">
            <Copy className="mx-auto h-4 w-4" />
          </button>
        </div>
        <button type="button" onClick={onArchive} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700">
          <Archive className="h-3.5 w-3.5" />
          Arquivar
        </button>
      </div>
    </Card>
  );
}

export default function FoodProductsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<MenuTab>('products');
  const [search, setSearch] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [extrasDialogOpen, setExtrasDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<FoodProduct | null>(null);
  const [editingCategory, setEditingCategory] = useState<FoodCategory | null>(null);
  const [editingExtraGroup, setEditingExtraGroup] = useState<FoodModifierGroup | null>(null);
  const [productForm, setProductForm] = useState<ProductForm>(emptyProductForm);
  const [categoryForm, setCategoryForm] = useState<CategoryForm>({ name: '', color: '#0f766e', icon: '' });
  const [extraName, setExtraName] = useState('');
  const [extraRequired, setExtraRequired] = useState(false);
  const [extraMin, setExtraMin] = useState('0');
  const [extraMax, setExtraMax] = useState('');
  const [extraOptions, setExtraOptions] = useState<ExtraOptionForm[]>([{ name: '', priceDelta: '' }]);
  const [extraProductIds, setExtraProductIds] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState('');
  const [archiveTarget, setArchiveTarget] = useState<{ type: 'product' | 'category'; id: string; name: string } | null>(null);

  const currentUserQuery = useQuery({ queryKey: ['currentUser'], queryFn: getCurrentUser, retry: false });
  const settingsQuery = useQuery({ queryKey: ['food-settings'], queryFn: getFoodSettings, retry: 2 });
  const enabled = settingsQuery.data?.isEnabled === true;
  const currentUser = currentUserQuery.data;
  const canEdit = currentUser ? canFood(currentUser, 'products_edit') : false;

  const categoriesQuery = useQuery({ queryKey: ['food-categories'], queryFn: getFoodCategories, retry: 2, enabled });
  const productsQuery = useQuery({ queryKey: ['food-products'], queryFn: () => getFoodProducts({ active: true }), retry: 2, enabled });
  const modifierGroupsQuery = useQuery({ queryKey: ['food-modifier-groups'], queryFn: getFoodModifierGroups, retry: 2, enabled });

  useEffect(() => {
    const requestedTab = searchParams.get('tab');
    if (requestedTab === 'products' || requestedTab === 'categories' || requestedTab === 'extras') {
      setActiveTab(requestedTab);
    }
    const target = searchParams.get('novo');
    if (target === 'produto') {
      setActiveTab('products');
      setEditingProduct(null);
      setProductForm(emptyProductForm);
      setProductDialogOpen(true);
    }
    if (target === 'categoria') {
      setActiveTab('categories');
      setEditingCategory(null);
      setCategoryForm({ name: '', color: '#0f766e', icon: '' });
      setCategoryDialogOpen(true);
    }
  }, [searchParams]);

  const selectTab = (tab: MenuTab) => {
    setActiveTab(tab);
    router.replace(`/food/produtos?tab=${tab}`, { scroll: false });
  };

  const invalidateCatalog = () => {
    queryClient.invalidateQueries({ queryKey: ['food-categories'] });
    queryClient.invalidateQueries({ queryKey: ['food-products'] });
    queryClient.invalidateQueries({ queryKey: ['food-modifier-groups'] });
    queryClient.invalidateQueries({ queryKey: ['food-overview'] });
  };

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    window.setTimeout(() => setSuccessMessage(''), 3000);
  };

  const saveProductMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        internalCode: productForm.internalCode.trim() || generatedCode(productForm.name),
        name: productForm.name.trim(),
        categoryId: productForm.categoryId || null,
        description: productForm.description.trim() || null,
        imageUrl: productForm.imageUrl || null,
        price: Number(productForm.price || 0),
        preparationMinutes: Number(productForm.preparationMinutes || 15),
        available: productForm.available,
        modifierGroupIds: productForm.modifierGroupIds,
      };
      return editingProduct
        ? updateFoodProduct(editingProduct.id, payload)
        : createFoodProduct(payload);
    },
    onSuccess: () => {
      setProductDialogOpen(false);
      setEditingProduct(null);
      setProductForm(emptyProductForm);
      invalidateCatalog();
      showSuccess('Produto guardado.');
    },
  });

  const saveCategoryMutation = useMutation({
    mutationFn: () => editingCategory
      ? updateFoodCategory(editingCategory.id, categoryForm)
      : createFoodCategory(categoryForm),
    onSuccess: () => {
      setCategoryDialogOpen(false);
      setEditingCategory(null);
      setCategoryForm({ name: '', color: '#0f766e', icon: '' });
      invalidateCatalog();
      showSuccess('Categoria guardada.');
    },
  });

  const saveExtrasMutation = useMutation({
    mutationFn: async () => {
      const groupPayload = {
        name: extraName,
        required: extraRequired,
        minSelection: Number(extraMin || 0),
        maxSelection: extraMax ? Number(extraMax) : null,
      };
      const validOptions = extraOptions.filter((option) => option.name.trim());
      const group = editingExtraGroup
        ? await updateFoodModifierGroup(editingExtraGroup.id, groupPayload)
        : await createFoodModifierGroup({
            ...groupPayload,
            options: validOptions.map((option, index) => ({
              name: option.name.trim(),
              priceDelta: Number(option.priceDelta || 0),
              sortOrder: index,
            })),
          });

      if (editingExtraGroup) {
        const retainedOptionIds = new Set(validOptions.map((option) => option.id).filter(Boolean));
        const removedOptions = (editingExtraGroup.options ?? []).filter((option) => !retainedOptionIds.has(option.id));

        await Promise.all(removedOptions.map((option) => updateFoodModifierOption(editingExtraGroup.id, option.id, { active: false })));
        await Promise.all(validOptions.map((option, index) => option.id
          ? updateFoodModifierOption(editingExtraGroup.id, option.id, {
              name: option.name.trim(),
              priceDelta: Number(option.priceDelta || 0),
              sortOrder: index,
              active: true,
            })
          : createFoodModifierOption(editingExtraGroup.id, {
              name: option.name.trim(),
              priceDelta: Number(option.priceDelta || 0),
              sortOrder: index,
            })));
      }

      const selectedProductIds = new Set(extraProductIds);
      const affectedProducts = (productsQuery.data ?? []).filter((product) => {
        const wasLinked = productGroupIds(product).includes(group.id);
        return wasLinked !== selectedProductIds.has(product.id);
      });
      await Promise.all(affectedProducts.map((product) => {
        const currentIds = productGroupIds(product).filter((groupId) => groupId !== group.id);
        return updateFoodProduct(product.id, {
          modifierGroupIds: selectedProductIds.has(product.id) ? [...currentIds, group.id] : currentIds,
        });
      }));

      return group;
    },
    onSuccess: () => {
      setExtrasDialogOpen(false);
      setEditingExtraGroup(null);
      setExtraName('');
      setExtraRequired(false);
      setExtraMin('0');
      setExtraMax('');
      setExtraOptions([{ name: '', priceDelta: '' }]);
      setExtraProductIds([]);
      invalidateCatalog();
      showSuccess(editingExtraGroup ? 'Grupo de extras actualizado.' : 'Grupo de extras criado.');
    },
  });

  const toggleAvailabilityMutation = useMutation({
    mutationFn: (product: FoodProduct) => updateFoodProduct(product.id, { available: !product.available }),
    onSuccess: invalidateCatalog,
  });
  const duplicateProductMutation = useMutation({
    mutationFn: (product: FoodProduct) => createFoodProduct({
      internalCode: generatedCode(product.name),
      name: `${product.name} cópia`,
      categoryId: product.categoryId || null,
      description: product.description || null,
      imageUrl: product.imageUrl || null,
      price: product.price,
      preparationMinutes: product.preparationMinutes,
      available: product.available,
      modifierGroupIds: productGroupIds(product),
    }),
    onSuccess: () => {
      invalidateCatalog();
      showSuccess('Produto duplicado.');
    },
  });
  const archiveProductMutation = useMutation({ mutationFn: archiveFoodProduct, onSuccess: () => { setArchiveTarget(null); invalidateCatalog(); } });
  const archiveCategoryMutation = useMutation({ mutationFn: archiveFoodCategory, onSuccess: () => { setArchiveTarget(null); invalidateCatalog(); } });
  const archiveExtrasMutation = useMutation({
    mutationFn: (groupId: string) => updateFoodModifierGroup(groupId, { active: false }),
    onSuccess: invalidateCatalog,
  });

  const openProductDialog = (product?: FoodProduct) => {
    setEditingProduct(product ?? null);
    setProductForm(product ? {
      imageUrl: product.imageUrl || '',
      name: product.name,
      categoryId: product.categoryId || '',
      price: String(product.price || ''),
      preparationMinutes: String(product.preparationMinutes || 15),
      available: product.available,
      internalCode: product.internalCode || '',
      description: product.description || '',
      modifierGroupIds: productGroupIds(product),
    } : emptyProductForm);
    setProductDialogOpen(true);
  };

  const openCategoryDialog = (category?: FoodCategory) => {
    setEditingCategory(category ?? null);
    setCategoryForm(category ? {
      name: category.name,
      color: category.color || '#0f766e',
      icon: category.icon || '',
    } : { name: '', color: '#0f766e', icon: '' });
    setCategoryDialogOpen(true);
  };

  const openExtrasDialog = (group?: FoodModifierGroup) => {
    setEditingExtraGroup(group ?? null);
    setExtraName(group?.name ?? '');
    setExtraRequired(group?.required ?? false);
    setExtraMin(String(group?.required ? Math.max(1, group.minSelection) : group?.minSelection ?? 0));
    setExtraMax(group?.maxSelection == null ? '' : String(group.maxSelection));
    setExtraOptions(group?.options?.length
      ? group.options.map((option) => ({ id: option.id, name: option.name, priceDelta: String(option.priceDelta || '') }))
      : [{ name: '', priceDelta: '' }]);
    setExtraProductIds(group
      ? (productsQuery.data ?? []).filter((product) => productGroupIds(product).includes(group.id)).map((product) => product.id)
      : []);
    saveExtrasMutation.reset();
    setExtrasDialogOpen(true);
  };

  const products = productsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const modifierGroups = (modifierGroupsQuery.data ?? []).filter((group) => group.active !== false);
  const validExtraOptionCount = extraOptions.filter((option) => option.name.trim()).length;
  const minExtraSelection = Number(extraMin || 0);
  const maxExtraSelection = extraMax ? Number(extraMax) : null;
  const extraSelectionError = minExtraSelection > validExtraOptionCount
    ? 'O mínimo não pode ser maior do que o número de opções.'
    : maxExtraSelection !== null && maxExtraSelection < minExtraSelection
      ? 'O máximo não pode ser menor do que o mínimo.'
      : maxExtraSelection !== null && maxExtraSelection > validExtraOptionCount
        ? 'O máximo não pode ser maior do que o número de opções.'
        : '';
  const canSaveExtras = Boolean(extraName.trim() && validExtraOptionCount > 0 && !extraSelectionError);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((product) => {
      if (term && ![product.name, product.internalCode, product.category?.name].some((value) => String(value || '').toLowerCase().includes(term))) return false;
      if (availabilityFilter === 'available' && !product.available) return false;
      if (availabilityFilter === 'unavailable' && product.available) return false;
      if (categoryFilter && product.categoryId !== categoryFilter) return false;
      return true;
    });
  }, [products, search, availabilityFilter, categoryFilter]);

  if (settingsQuery.isLoading || currentUserQuery.isLoading) {
    return (
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <div className="h-56 animate-pulse rounded-2xl bg-white" />
      </div>
    );
  }

  if (settingsQuery.isError) {
    return (
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <ErrorState
          title="Não foi possível abrir o menu"
          message={getApiErrorMessage(settingsQuery.error, 'Verifique a ligação e tente novamente.')}
          onRetry={() => settingsQuery.refetch()}
        />
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="mx-auto max-w-6xl p-4 md:p-6" style={getFoodBrandStyle(settingsQuery.data)}>
        <FoodEmptyState
          icon={Utensils}
          title="Restaurante inactivo"
          description="Active o restaurante antes de montar o menu."
          actionLabel="Abrir configurações"
          onAction={() => { window.location.href = '/food/configuracoes'; }}
        />
      </div>
    );
  }

  const loadError = categoriesQuery.error || productsQuery.error || modifierGroupsQuery.error;
  const primaryAction = activeTab === 'products'
    ? { label: 'Novo produto', action: () => openProductDialog() }
    : activeTab === 'categories'
      ? { label: 'Nova categoria', action: () => openCategoryDialog() }
      : { label: 'Novo grupo de extras', action: () => openExtrasDialog() };

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-6" style={getFoodBrandStyle(settingsQuery.data)}>
      <FoodPageHeader title="Menu" description="Produtos, categorias e extras.">
        {canEdit ? (
          <Button type="button" size="lg" onClick={primaryAction.action}>
            <Plus className="mr-2 h-4 w-4" />
            {primaryAction.label}
          </Button>
        ) : null}
      </FoodPageHeader>

      {successMessage ? <SuccessNote onClose={() => setSuccessMessage('')}>{successMessage}</SuccessNote> : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <FoodTabs
          value={activeTab}
          onChange={selectTab}
          tabs={[
            { value: 'products', label: 'Produtos', count: products.length },
            { value: 'categories', label: 'Categorias', count: categories.length },
            { value: 'extras', label: 'Extras', count: modifierGroups.length },
          ]}
        />
        {activeTab === 'products' ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Pesquisar produto"
                className="h-11 w-full rounded-xl border-slate-200 pl-9 sm:w-72"
              />
            </div>
            <button
              type="button"
              aria-label="Actualizar"
              onClick={() => {
                categoriesQuery.refetch();
                productsQuery.refetch();
                modifierGroupsQuery.refetch();
              }}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>

      {loadError ? (
        <ErrorState
          title="Não foi possível carregar o menu"
          message={getApiErrorMessage(loadError, 'Tente novamente para ver os dados.')}
          onRetry={() => {
            categoriesQuery.refetch();
            productsQuery.refetch();
            modifierGroupsQuery.refetch();
          }}
        />
      ) : null}

      {activeTab === 'products' ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {([
                ['all', 'Todos'],
                ['available', 'Disponíveis'],
                ['unavailable', 'Indisponíveis'],
              ] as Array<[AvailabilityFilter, string]>).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAvailabilityFilter(value)}
                  className={availabilityFilter === value
                    ? 'rounded-xl bg-[var(--workspace-primary)] px-4 py-2 text-sm font-semibold text-[var(--workspace-on-primary)]'
                    : 'rounded-xl px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100'}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-slate-400" />
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--workspace-primary)]"
              >
                <option value="">Todas as categorias</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </div>
          </div>

          {products.length === 0 ? (
            <FoodEmptyState
              icon={Utensils}
              title="Ainda não existem produtos"
              description="Adicione pratos, bebidas ou outros itens do seu menu."
              actionLabel={canEdit ? 'Adicionar primeiro produto' : undefined}
              onAction={canEdit ? () => openProductDialog() : undefined}
            />
          ) : filteredProducts.length === 0 ? (
            <FoodEmptyState icon={Search} title="Nenhum produto encontrado" description="Ajuste a pesquisa ou os filtros." />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  busy={toggleAvailabilityMutation.isPending}
                  onToggle={() => toggleAvailabilityMutation.mutate(product)}
                  onEdit={() => openProductDialog(product)}
                  onDuplicate={() => duplicateProductMutation.mutate(product)}
                  onArchive={() => setArchiveTarget({ type: 'product', id: product.id, name: product.name })}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}

      {activeTab === 'categories' ? (
        categories.length === 0 ? (
          <FoodEmptyState
            icon={Package}
            title="Ainda não existem categorias"
            description="Crie grupos simples para organizar o menu."
            actionLabel={canEdit ? 'Nova categoria' : undefined}
            onAction={canEdit ? () => openCategoryDialog() : undefined}
          />
        ) : (
          <Card className="overflow-hidden rounded-2xl border-slate-200 bg-white shadow-sm">
            <div className="divide-y divide-slate-100">
              {categories.map((category) => {
                const count = products.filter((product) => product.categoryId === category.id).length;
                return (
                  <div key={category.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="h-4 w-4 rounded-full" style={{ backgroundColor: category.color || '#6b7e9a' }} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-950">{category.name}</p>
                        <p className="text-xs text-slate-500">{count} produto{count === 1 ? '' : 's'}</p>
                      </div>
                    </div>
                    {canEdit ? (
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => openCategoryDialog(category)}>
                          Editar
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setArchiveTarget({ type: 'category', id: category.id, name: category.name })} className="text-red-600 hover:text-red-700">
                          Arquivar
                        </Button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Card>
        )
      ) : null}

      {activeTab === 'extras' ? (
        modifierGroups.length === 0 ? (
          <FoodEmptyState
            icon={SlidersHorizontal}
            title="Ainda não existem extras"
            description="Crie molhos, bebidas, tamanhos ou acompanhamentos."
            actionLabel={canEdit ? 'Novo grupo de extras' : undefined}
            onAction={canEdit ? () => openExtrasDialog() : undefined}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {modifierGroups.map((group) => {
              const linkedProductsCount = products.filter((product) => productGroupIds(product).includes(group.id)).length;
              return (
              <Card key={group.id} className="rounded-2xl border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-black text-slate-950">{group.name}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {group.options?.length ?? 0} opção{group.options?.length === 1 ? '' : 'ões'} · {linkedProductsCount} produto{linkedProductsCount === 1 ? '' : 's'}
                    </p>
                  </div>
                  <Badge variant={group.required ? 'default' : 'secondary'}>{group.required ? 'Obrigatório' : 'Opcional'}</Badge>
                </div>
                <div className="mt-4 space-y-2">
                  {(group.options ?? []).slice(0, 4).map((option) => (
                    <div key={option.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                      <span className="truncate font-medium text-slate-700">{option.name}</span>
                      <span className="font-bold text-slate-950">{option.priceDelta > 0 ? `+${formatKz(option.priceDelta)}` : 'Grátis'}</span>
                    </div>
                  ))}
                </div>
                {canEdit ? (
                  <div className="mt-4 flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => openExtrasDialog(group)}>
                      <Edit3 className="mr-2 h-4 w-4" />
                      Editar
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => archiveExtrasMutation.mutate(group.id)} className="text-red-600 hover:text-red-700">
                      Arquivar
                    </Button>
                  </div>
                ) : null}
              </Card>
              );
            })}
          </div>
        )
      ) : null}

      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Editar produto' : 'Novo produto'}</DialogTitle>
            <DialogDescription>Preencha o essencial primeiro. As opções avançadas ficam abaixo.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              if (!productForm.name.trim()) return;
              saveProductMutation.mutate();
            }}
            className="space-y-5"
          >
            <FoodImagePicker value={productForm.imageUrl} onChange={(imageUrl) => setProductForm((prev) => ({ ...prev, imageUrl: imageUrl || '' }))} />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label htmlFor="food-product-name">Nome</Label>
                <Input id="food-product-name" value={productForm.name} onChange={(event) => setProductForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="Burger clássico" />
              </div>
              <div>
                <Label htmlFor="food-product-category">Categoria</Label>
                <select id="food-product-category" value={productForm.categoryId} onChange={(event) => setProductForm((prev) => ({ ...prev, categoryId: event.target.value }))} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm">
                  <option value="">Sem categoria</option>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="food-product-price">Preço</Label>
                <Input id="food-product-price" type="number" min="0" step="0.01" value={productForm.price} onChange={(event) => setProductForm((prev) => ({ ...prev, price: event.target.value }))} placeholder="0" />
              </div>
            </div>

            <details className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <summary className="cursor-pointer text-sm font-black text-slate-800">Mais opções</summary>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="food-product-time">Tempo de preparação</Label>
                  <div className="flex items-center gap-2">
                    <Input id="food-product-time" type="number" min="1" value={productForm.preparationMinutes} onChange={(event) => setProductForm((prev) => ({ ...prev, preparationMinutes: event.target.value }))} />
                    <span className="text-sm font-medium text-slate-500">minutos</span>
                  </div>
                </div>
                <div>
                  <Label htmlFor="food-product-code">Código interno opcional</Label>
                  <Input id="food-product-code" value={productForm.internalCode} onChange={(event) => setProductForm((prev) => ({ ...prev, internalCode: event.target.value }))} placeholder="Gerado automaticamente" />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="food-product-description">Descrição</Label>
                  <Textarea id="food-product-description" value={productForm.description} onChange={(event) => setProductForm((prev) => ({ ...prev, description: event.target.value }))} placeholder="Ingredientes, tamanho ou observações." />
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 md:col-span-2">
                  <div>
                    <p className="text-sm font-bold text-slate-900">Disponível</p>
                    <p className="text-xs text-slate-500">Aparece para novos pedidos quando activo.</p>
                  </div>
                  <Switch checked={productForm.available} onCheckedChange={(available) => setProductForm((prev) => ({ ...prev, available }))} />
                </div>
                {modifierGroups.length > 0 ? (
                  <div className="md:col-span-2">
                    <Label>Extras ligados ao produto</Label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {modifierGroups.map((group) => {
                        const checked = productForm.modifierGroupIds.includes(group.id);
                        return (
                          <button
                            key={group.id}
                            type="button"
                            onClick={() => setProductForm((prev) => ({
                              ...prev,
                              modifierGroupIds: checked
                                ? prev.modifierGroupIds.filter((id) => id !== group.id)
                                : [...prev.modifierGroupIds, group.id],
                            }))}
                            className={checked
                              ? 'rounded-xl bg-[var(--workspace-primary)] px-3 py-2 text-sm font-semibold text-[var(--workspace-on-primary)]'
                              : 'rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50'}
                          >
                            {group.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            </details>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setProductDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saveProductMutation.isPending || !productForm.name.trim()}>
                {saveProductMutation.isPending ? 'A guardar...' : 'Guardar produto'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Editar categoria' : 'Nova categoria'}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!categoryForm.name.trim()) return;
              saveCategoryMutation.mutate();
            }}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="food-category-name">Nome</Label>
              <Input id="food-category-name" value={categoryForm.name} onChange={(event) => setCategoryForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="Hambúrgueres" />
            </div>
            <div className="grid grid-cols-[80px_minmax(0,1fr)] items-end gap-3">
              <div>
                <Label htmlFor="food-category-color">Cor</Label>
                <Input id="food-category-color" type="color" value={categoryForm.color} onChange={(event) => setCategoryForm((prev) => ({ ...prev, color: event.target.value }))} className="h-10" />
              </div>
              <div>
                <Label htmlFor="food-category-icon">Ícone opcional</Label>
                <Input id="food-category-icon" value={categoryForm.icon} onChange={(event) => setCategoryForm((prev) => ({ ...prev, icon: event.target.value }))} placeholder="burger" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCategoryDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saveCategoryMutation.isPending || !categoryForm.name.trim()}>
                {saveCategoryMutation.isPending ? 'A guardar...' : 'Guardar categoria'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={extrasDialogOpen}
        onOpenChange={(open) => {
          setExtrasDialogOpen(open);
          if (!open) {
            setEditingExtraGroup(null);
            saveExtrasMutation.reset();
          }
        }}
      >
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editingExtraGroup ? 'Editar grupo de extras' : 'Novo grupo de extras'}</DialogTitle>
            <DialogDescription>
              {editingExtraGroup ? 'Actualize opções, preços e os produtos onde este grupo aparece.' : 'Crie várias opções dentro do mesmo grupo.'}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!canSaveExtras) return;
              saveExtrasMutation.mutate();
            }}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="food-extra-name">Nome do grupo</Label>
              <Input id="food-extra-name" value={extraName} onChange={(event) => setExtraName(event.target.value)} placeholder="Molhos" />
            </div>
            <div className="space-y-2">
              <Label>Opções</Label>
              <div className="grid grid-cols-[minmax(0,1fr)_120px_40px] gap-2 px-1 text-xs font-semibold text-slate-500">
                <span>Nome</span>
                <span>Preço (Kz)</span>
                <span />
              </div>
              {extraOptions.map((option, index) => (
                <div key={index} className="grid grid-cols-[minmax(0,1fr)_120px_40px] gap-2">
                  <Input value={option.name} onChange={(event) => setExtraOptions((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} placeholder="Molho especial" />
                  <Input type="number" min="0" step="0.01" value={option.priceDelta} onChange={(event) => setExtraOptions((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, priceDelta: event.target.value } : item))} placeholder="0" />
                  <button
                    type="button"
                    onClick={() => setExtraOptions((prev) => prev.length <= 1 ? [{ name: '', priceDelta: '' }] : prev.filter((_, itemIndex) => itemIndex !== index))}
                    aria-label="Remover opção"
                    title="Arquivar opção"
                    className="rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Archive className="mx-auto h-4 w-4" />
                  </button>
                </div>
              ))}
              {validExtraOptionCount === 0 ? <p className="text-xs font-semibold text-red-600">Adicione pelo menos uma opção com nome.</p> : null}
              <Button type="button" variant="secondary" size="sm" onClick={() => setExtraOptions((prev) => [...prev, { name: '', priceDelta: '' }])}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar opção
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2 md:col-span-1">
                <span className="text-sm font-semibold text-slate-700">Obrigatório</span>
                <Switch
                  checked={extraRequired}
                  onCheckedChange={(checked) => {
                    setExtraRequired(checked);
                    if (checked) setExtraMin((value) => String(Math.max(1, Number(value || 0))));
                  }}
                />
              </div>
              <div>
                <Label htmlFor="food-extra-min">Mínimo</Label>
                <Input id="food-extra-min" type="number" min="0" value={extraMin} onChange={(event) => setExtraMin(event.target.value)} />
              </div>
              <div>
                <Label htmlFor="food-extra-max">Máximo</Label>
                <Input id="food-extra-max" type="number" min="1" value={extraMax} onChange={(event) => setExtraMax(event.target.value)} placeholder="Sem limite" />
              </div>
            </div>
            {products.length > 0 ? (
              <div>
                <Label>Aplicar a produtos</Label>
                <div className="mt-2 max-h-40 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-2">
                  {products.map((product) => {
                    const checked = extraProductIds.includes(product.id);
                    return (
                      <label key={product.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => setExtraProductIds((prev) => event.target.checked ? [...prev, product.id] : prev.filter((id) => id !== product.id))}
                          className="h-4 w-4 accent-[var(--workspace-primary)]"
                        />
                        <span>{product.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : null}
            {extraSelectionError ? <p className="text-sm font-semibold text-red-600">{extraSelectionError}</p> : null}
            {saveExtrasMutation.isError ? (
              <p className="text-sm font-semibold text-red-600">
                {getApiErrorMessage(saveExtrasMutation.error, 'Não foi possível guardar os extras.')}
              </p>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setExtrasDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saveExtrasMutation.isPending || !canSaveExtras}>
                {saveExtrasMutation.isPending ? 'A guardar...' : editingExtraGroup ? 'Guardar alterações' : 'Guardar extras'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <FoodConfirmDialog
        open={Boolean(archiveTarget)}
        onOpenChange={(open) => { if (!open) setArchiveTarget(null); }}
        title={`Arquivar ${archiveTarget?.type === 'category' ? 'categoria' : 'produto'}`}
        description={`“${archiveTarget?.name || ''}” deixa de aparecer no menu, mas o histórico permanece guardado.`}
        confirmLabel="Arquivar"
        destructive
        pending={archiveProductMutation.isPending || archiveCategoryMutation.isPending}
        onConfirm={() => {
          if (!archiveTarget) return;
          if (archiveTarget.type === 'product') archiveProductMutation.mutate(archiveTarget.id);
          else archiveCategoryMutation.mutate(archiveTarget.id);
        }}
      />
    </div>
  );
}
