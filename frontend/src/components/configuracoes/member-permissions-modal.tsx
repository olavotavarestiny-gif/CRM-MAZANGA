'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { getEstabelecimentos, setMemberPermissions } from '@/lib/api';
import type { User, UserPermissions } from '@/lib/api';

interface Props {
  member: User;
  workspaceMode?: User['workspaceMode'];
  onClose: () => void;
  onSaved: () => void;
}

type SimpleLevel = 'none' | 'view' | 'edit';
type CommercialPermissionKey = 'dashboard_basic' | 'dashboard_analysis';
type CaixaPermissionKey = 'view' | 'open' | 'close' | 'audit';
type StockPermissionKey = 'view' | 'edit';
type TaskAssignmentPermissionKey = 'assign_admin_owner';
type FoodPermissionKey = keyof NonNullable<UserPermissions['food']>;

const SERVICOS_SIMPLE_MODULES: { key: keyof Omit<UserPermissions, 'finances'>; label: string }[] = [
  { key: 'contacts', label: 'Contactos' },
  { key: 'pipeline', label: 'Processos' },
  { key: 'tasks', label: 'Tarefas' },
  { key: 'vendas', label: 'Vendas' },
  { key: 'calendario', label: 'Calendário' },
  { key: 'automations', label: 'Automações' },
  { key: 'forms', label: 'Formulários' },
];

const COMERCIO_SIMPLE_MODULES: { key: keyof Omit<UserPermissions, 'finances'>; label: string }[] = [
  { key: 'contacts', label: 'Contactos' },
  { key: 'vendas', label: 'Venda Rápida' },
];

const FOOD_PERMISSION_ITEMS: { key: FoodPermissionKey; label: string }[] = [
  { key: 'overview', label: 'Ver visão geral' },
  { key: 'settings', label: 'Gerir configurações' },
  { key: 'products_view', label: 'Ver produtos' },
  { key: 'products_edit', label: 'Editar produtos' },
  { key: 'orders_create', label: 'Criar pedidos' },
  { key: 'orders_view_all', label: 'Ver todos os pedidos' },
  { key: 'kitchen', label: 'Operar cozinha' },
  { key: 'delivery', label: 'Operar delivery' },
  { key: 'reports', label: 'Ver relatórios' },
  { key: 'discounts', label: 'Autorizar descontos' },
  { key: 'cancel_orders', label: 'Cancelar pedidos' },
];

const LEVEL_LABELS: Record<SimpleLevel, string> = {
  none: 'Nenhum',
  view: 'Ver',
  edit: 'Editar',
};

function initPerms(user: User): UserPermissions {
  if (!user.permissions) {
    const perms: UserPermissions = {};
    SERVICOS_SIMPLE_MODULES.forEach((module) => { perms[module.key] = 'edit'; });
    perms.vendas = 'edit';
    perms.finances = {
      transactions: 'edit',
      view_invoices: true,
      emit_invoices: true,
      view_reports: true,
      saft: false,
    };
    perms.comercial = {
      dashboard_basic: true,
      dashboard_analysis: true,
      view_store_ranking: true,
      view_product_performance: true,
    };
    perms.caixa = {
      view: true,
      open: true,
      close: true,
      audit: true,
    };
    perms.stock = {
      view: true,
      edit: true,
    };
    perms.taskAssignment = {
      assign_admin_owner: true,
    };
    perms.food = {
      overview: true,
      settings: true,
      products_view: true,
      products_edit: true,
      orders_create: true,
      orders_view_all: true,
      kitchen: true,
      delivery: true,
      reports: true,
      discounts: true,
      cancel_orders: true,
    };
    return perms;
  }

  return {
    ...user.permissions,
    comercial: {
      dashboard_basic: user.permissions.comercial?.dashboard_basic !== false,
      dashboard_analysis: user.permissions.comercial?.dashboard_analysis === true,
      view_store_ranking: user.permissions.comercial?.view_store_ranking === true,
      view_product_performance: user.permissions.comercial?.view_product_performance === true,
    },
    caixa: {
      view: user.permissions.caixa?.view !== false,
      open: user.permissions.caixa?.open === true,
      close: user.permissions.caixa?.close === true,
      audit: user.permissions.caixa?.audit === true,
    },
    stock: {
      view: user.permissions.stock?.view !== false,
      edit: user.permissions.stock?.edit === true,
    },
    taskAssignment: {
      assign_admin_owner: user.permissions.taskAssignment?.assign_admin_owner === true,
    },
    food: {
      overview: user.permissions.food?.overview !== false,
      settings: user.permissions.food?.settings === true,
      products_view: user.permissions.food?.products_view !== false,
      products_edit: user.permissions.food?.products_edit === true,
      orders_create: user.permissions.food?.orders_create === true,
      orders_view_all: user.permissions.food?.orders_view_all === true,
      kitchen: user.permissions.food?.kitchen === true,
      delivery: user.permissions.food?.delivery === true,
      reports: user.permissions.food?.reports === true,
      discounts: user.permissions.food?.discounts === true,
      cancel_orders: user.permissions.food?.cancel_orders === true,
    },
  };
}

function FinanceBooleanGrid({
  finances,
  setFinance,
}: {
  finances: NonNullable<UserPermissions['finances']>;
  setFinance: (key: keyof NonNullable<UserPermissions['finances']>, value: boolean | SimpleLevel) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {(
        [
          { key: 'view_invoices', label: 'Ver Faturas' },
          { key: 'emit_invoices', label: 'Emitir Faturas' },
          { key: 'view_reports', label: 'Ver Relatórios' },
          { key: 'saft', label: 'SAF-T' },
        ] as { key: keyof NonNullable<UserPermissions['finances']>; label: string }[]
      ).map(({ key, label }) => (
        <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={!!finances[key]}
            onChange={(event) => setFinance(key, event.target.checked)}
            className="w-4 h-4 accent-[#0A2540]"
          />
          <span className="text-sm text-[#0A2540]">{label}</span>
        </label>
      ))}
    </div>
  );
}

export default function MemberPermissionsModal({
  member,
  workspaceMode = 'servicos',
  onClose,
  onSaved,
}: Props) {
  const [perms, setPerms] = useState<UserPermissions>(initPerms(member));
  const isComercioWorkspace = workspaceMode === 'comercio';
  const isFoodWorkspace = workspaceMode === 'food';
  const visibleSimpleModules = isFoodWorkspace ? [] : isComercioWorkspace ? COMERCIO_SIMPLE_MODULES : SERVICOS_SIMPLE_MODULES;
  const [assignedEstabelecimentoId, setAssignedEstabelecimentoId] = useState(member.assignedEstabelecimentoId ?? 'unassigned');

  const {
    data: estabelecimentos = [],
    isLoading: loadingEstabelecimentos,
    isError: estabelecimentosError,
    refetch: refetchEstabelecimentos,
  } = useQuery({
    queryKey: ['member-permissions-estabelecimentos'],
    queryFn: getEstabelecimentos,
    enabled: isComercioWorkspace,
  });

  const setModule = (key: keyof Omit<UserPermissions, 'finances'>, level: SimpleLevel) => {
    setPerms((prev) => ({ ...prev, [key]: level }));
  };

  const setFinance = (key: keyof NonNullable<UserPermissions['finances']>, value: boolean | SimpleLevel) => {
    setPerms((prev) => ({
      ...prev,
      finances: { ...prev.finances, [key]: value },
    }));
  };

  const setCommercial = (key: CommercialPermissionKey, value: boolean) => {
    setPerms((prev) => ({
      ...prev,
      comercial: {
        ...prev.comercial,
        dashboard_basic: key === 'dashboard_analysis' && value ? true : prev.comercial?.dashboard_basic,
        dashboard_analysis: key === 'dashboard_basic' && !value ? false : prev.comercial?.dashboard_analysis,
        [key]: value,
      },
    }));
  };

  const setCaixa = (key: CaixaPermissionKey, value: boolean) => {
    setPerms((prev) => {
      const nextCaixa = { ...prev.caixa, [key]: value };

      if (key === 'view' && !value) {
        nextCaixa.open = false;
        nextCaixa.close = false;
        nextCaixa.audit = false;
      }

      if (key !== 'view' && value) {
        nextCaixa.view = true;
      }

      return {
        ...prev,
        caixa: nextCaixa,
      };
    });
  };

  const setStock = (key: StockPermissionKey, value: boolean) => {
    setPerms((prev) => {
      const nextStock = { ...prev.stock, [key]: value };

      if (key === 'view' && !value) {
        nextStock.edit = false;
      }

      if (key === 'edit' && value) {
        nextStock.view = true;
      }

      return {
        ...prev,
        stock: nextStock,
      };
    });
  };

  const setTaskAssignment = (key: TaskAssignmentPermissionKey, value: boolean) => {
    setPerms((prev) => ({
      ...prev,
      taskAssignment: {
        ...prev.taskAssignment,
        [key]: value,
      },
    }));
  };

  const setFood = (key: FoodPermissionKey, value: boolean) => {
    setPerms((prev) => ({
      ...prev,
      food: {
        ...prev.food,
        [key]: value,
      },
    }));
  };

  const canManageTaskAssignment = (perms.tasks ?? 'none') === 'edit';

  const mutation = useMutation({
    mutationFn: () => {
      const sanitizedPerms: UserPermissions = {
        ...perms,
        taskAssignment: {
          ...perms.taskAssignment,
          assign_admin_owner: canManageTaskAssignment
            ? perms.taskAssignment?.assign_admin_owner === true
            : false,
        },
      };

      return setMemberPermissions(
        member.id,
        sanitizedPerms,
        isComercioWorkspace
          ? (assignedEstabelecimentoId === 'unassigned' ? null : assignedEstabelecimentoId)
          : member.assignedEstabelecimentoId
      );
    },
    onSuccess: () => { onSaved(); onClose(); },
  });

  const finances: NonNullable<UserPermissions['finances']> = perms.finances ?? {};
  const comercial: NonNullable<UserPermissions['comercial']> = perms.comercial ?? {};
  const caixa: NonNullable<UserPermissions['caixa']> = perms.caixa ?? {};
  const stock: NonNullable<UserPermissions['stock']> = perms.stock ?? {};
  const foodPerms: NonNullable<UserPermissions['food']> = perms.food ?? {};
  const financeTransactionsLevel: SimpleLevel = finances.transactions ?? 'none';

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Permissões — {member.name}</DialogTitle>
        </DialogHeader>

        <div className="py-2 space-y-5">
          {isComercioWorkspace ? (
            <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              Estás a editar as permissões do workspace de comércio. Esta vista segue as abas reais desse modo.
            </div>
          ) : null}

          {isFoodWorkspace ? (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              Estás a editar permissões do KukuGest Food. A fundação usa Visão geral, Produtos e Configurações; as restantes permissões ficam preparadas para pedidos, cozinha e delivery.
            </div>
          ) : null}

          {isComercioWorkspace ? (
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#6b7e9a]">Ponto de Venda Atribuído</p>
              <div className="space-y-3 rounded-xl border border-[#dde3ec] bg-[#f8fafc] p-3">
                {estabelecimentosError ? (
                  <ErrorState
                    compact
                    title="Não foi possível carregar os pontos de venda"
                    message="Tenta novamente para definir o ponto atribuído deste membro."
                    onRetry={() => refetchEstabelecimentos()}
                  />
                ) : (
                  <>
                    <Select value={assignedEstabelecimentoId} onValueChange={setAssignedEstabelecimentoId}>
                      <SelectTrigger>
                        <SelectValue placeholder={loadingEstabelecimentos ? 'A carregar...' : 'Selecionar ponto de venda'} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Sem atribuição</SelectItem>
                        {estabelecimentos.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-600">
                      Sem atribuição, este membro não consegue abrir caixa até o ponto de venda ser definido.
                    </p>
                  </>
                )}
              </div>
            </div>
          ) : null}

          {isFoodWorkspace ? (
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#6b7e9a]">KukuGest Food</p>
              <div className="space-y-3 rounded-xl border border-[#dde3ec] bg-[#f8fafc] p-3">
                {FOOD_PERMISSION_ITEMS.map(({ key, label }) => (
                  <label key={key} className="flex cursor-pointer select-none items-center justify-between gap-3">
                    <span className="text-sm text-[#0A2540]">{label}</span>
                    <input
                      type="checkbox"
                      checked={!!foodPerms[key]}
                      onChange={(event) => setFood(key, event.target.checked)}
                      className="h-4 w-4 accent-[#0A2540]"
                    />
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          {!isFoodWorkspace ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#6b7e9a] mb-3">
              {isComercioWorkspace ? 'Operação diária' : 'Módulos'}
            </p>
            <div className="space-y-2">
              {visibleSimpleModules.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between py-2 border-b border-[#f0f0f0] last:border-0">
                  <span className="text-sm font-medium text-[#0A2540]">{label}</span>
                  <div className="flex gap-1">
                    {(['none', 'view', 'edit'] as SimpleLevel[]).map((level) => (
                      <button
                        key={level}
                        onClick={() => setModule(key, level)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${
                          perms[key] === level
                            ? level === 'none'
                              ? 'bg-red-100 text-red-700 border-red-200'
                              : level === 'view'
                              ? 'bg-blue-100 text-blue-700 border-blue-200'
                              : 'bg-green-100 text-green-700 border-green-200'
                            : 'bg-transparent text-[#6b7e9a] border-[#dde3ec] hover:border-[#0A2540]'
                        }`}
                      >
                        {LEVEL_LABELS[level]}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {!isComercioWorkspace ? (
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm font-medium text-[#0A2540]">Conversas</span>
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#f8fafc] text-[#6b7e9a] border border-[#dde3ec]">
                    Sempre ativo
                  </span>
                </div>
              ) : null}
            </div>
          </div>
          ) : null}

          {visibleSimpleModules.some((module) => module.key === 'tasks') ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[#6b7e9a] mb-3">Atribuição de Tarefas</p>
              <div className={`space-y-2 rounded-xl border border-[#dde3ec] bg-[#f8fafc] p-3 ${canManageTaskAssignment ? '' : 'opacity-70'}`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-[#0A2540]">Pode atribuir tarefas para admin/owner</p>
                    <p className="text-xs text-[#6b7e9a]">
                      Mantém a criação para si próprio e, quando ativo, permite também enviar tarefas para administradores e dono da conta.
                    </p>
                  </div>
                  <Switch
                    checked={!!perms.taskAssignment?.assign_admin_owner && canManageTaskAssignment}
                    onCheckedChange={(checked) => setTaskAssignment('assign_admin_owner', checked)}
                    disabled={!canManageTaskAssignment}
                  />
                </div>
                {!canManageTaskAssignment ? (
                  <p className="text-xs text-[#6b7e9a]">
                    Esta opção só fica disponível quando o módulo de tarefas está em `Editar`.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {!isComercioWorkspace && !isFoodWorkspace ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[#6b7e9a] mb-3">Finanças</p>
              <div className="space-y-3 p-3 bg-[#f8fafc] rounded-xl border border-[#dde3ec]">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#0A2540]">Transações</span>
                  <div className="flex gap-1">
                    {(['none', 'view', 'edit'] as SimpleLevel[]).map((level) => (
                      <button
                        key={level}
                        onClick={() => setFinance('transactions', level)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${
                          financeTransactionsLevel === level
                            ? level === 'none'
                              ? 'bg-red-100 text-red-700 border-red-200'
                              : level === 'view'
                              ? 'bg-blue-100 text-blue-700 border-blue-200'
                              : 'bg-green-100 text-green-700 border-green-200'
                            : 'bg-white text-[#6b7e9a] border-[#dde3ec] hover:border-[#0A2540]'
                        }`}
                      >
                        {LEVEL_LABELS[level]}
                      </button>
                    ))}
                  </div>
                </div>

                <FinanceBooleanGrid
                  finances={finances}
                  setFinance={setFinance}
                />
              </div>
            </div>
          ) : null}

          {!isFoodWorkspace ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#6b7e9a] mb-3">
              {isComercioWorkspace ? 'Painel Comercial' : 'Permissões Comerciais'}
            </p>
            <div className="space-y-3 p-3 bg-[#f8fafc] rounded-xl border border-[#dde3ec]">
              {([
                { key: 'dashboard_basic', label: 'Ver painel resumo' },
                { key: 'dashboard_analysis', label: 'Ver análise detalhada' },
              ] as { key: CommercialPermissionKey; label: string }[]).map(({ key, label }) => (
                <label key={key} className="flex items-center justify-between gap-3 cursor-pointer select-none">
                  <span className="text-sm text-[#0A2540]">{label}</span>
                  <input
                    type="checkbox"
                    checked={!!comercial[key]}
                    onChange={(event) => setCommercial(key, event.target.checked)}
                    className="h-4 w-4 accent-[#0A2540]"
                  />
                </label>
              ))}
            </div>
          </div>
          ) : null}

          {!isFoodWorkspace ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#6b7e9a] mb-3">
              Caixa
            </p>
            <div className="space-y-3 p-3 bg-[#f8fafc] rounded-xl border border-[#dde3ec]">
              {([
                { key: 'view', label: 'Ver caixa' },
                { key: 'open', label: 'Abrir caixa' },
                { key: 'close', label: 'Fechar caixa' },
                { key: 'audit', label: 'Ver auditoria de caixa' },
              ] as { key: CaixaPermissionKey; label: string }[]).map(({ key, label }) => (
                <label key={key} className="flex items-center justify-between gap-3 cursor-pointer select-none">
                  <span className="text-sm text-[#0A2540]">{label}</span>
                  <input
                    type="checkbox"
                    checked={!!caixa[key]}
                    onChange={(event) => setCaixa(key, event.target.checked)}
                    className="h-4 w-4 accent-[#0A2540]"
                  />
                </label>
              ))}
            </div>
          </div>
          ) : null}

          {!isFoodWorkspace ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#6b7e9a] mb-3">
              {isComercioWorkspace ? 'Produtos e Stock' : 'Stock'}
            </p>
            <div className="space-y-3 p-3 bg-[#f8fafc] rounded-xl border border-[#dde3ec]">
              <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
                <span className="text-sm text-[#0A2540]">Ver produtos e stock</span>
                <input
                  type="checkbox"
                  checked={!!stock.view}
                  onChange={(event) => setStock('view', event.target.checked)}
                  className="h-4 w-4 accent-[#0A2540]"
                />
              </label>
              <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
                <span className="text-sm text-[#0A2540]">Editar stock manualmente</span>
                <input
                  type="checkbox"
                  checked={!!stock.edit}
                  onChange={(event) => setStock('edit', event.target.checked)}
                  className="h-4 w-4 accent-[#0A2540]"
                />
              </label>
            </div>
          </div>
          ) : null}

          {isComercioWorkspace ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[#6b7e9a] mb-3">Finanças</p>
              <div className="space-y-3 p-3 bg-[#f8fafc] rounded-xl border border-[#dde3ec]">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#0A2540]">Transações</span>
                  <div className="flex gap-1">
                    {(['none', 'view', 'edit'] as SimpleLevel[]).map((level) => (
                      <button
                        key={level}
                        onClick={() => setFinance('transactions', level)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${
                          financeTransactionsLevel === level
                            ? level === 'none'
                              ? 'bg-red-100 text-red-700 border-red-200'
                              : level === 'view'
                              ? 'bg-blue-100 text-blue-700 border-blue-200'
                              : 'bg-green-100 text-green-700 border-green-200'
                            : 'bg-white text-[#6b7e9a] border-[#dde3ec] hover:border-[#0A2540]'
                        }`}
                      >
                        {LEVEL_LABELS[level]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {isComercioWorkspace ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[#6b7e9a] mb-3">Faturação</p>
              <div className="space-y-3 p-3 bg-[#f8fafc] rounded-xl border border-[#dde3ec]">
                <FinanceBooleanGrid
                  finances={finances}
                  setFinance={setFinance}
                />
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="bg-gradient-to-r from-orange-500 to-red-500 text-white hover:opacity-90"
          >
            {mutation.isPending ? 'A guardar...' : 'Guardar Permissões'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
