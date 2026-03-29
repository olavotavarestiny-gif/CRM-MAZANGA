'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { setMemberPermissions } from '@/lib/api';
import type { User, UserPermissions } from '@/lib/api';

interface Props {
  member: User;
  onClose: () => void;
  onSaved: () => void;
}

type SimpleLevel = 'none' | 'view' | 'edit';
type CommercialPermissionKey = 'dashboard_basic' | 'dashboard_analysis';
type CaixaPermissionKey = 'open' | 'close' | 'audit';
type StockPermissionKey = 'edit';

const SIMPLE_MODULES: { key: keyof Omit<UserPermissions, 'finances'>; label: string }[] = [
  { key: 'contacts',    label: 'Clientes' },
  { key: 'pipeline',    label: 'Processos' },
  { key: 'tasks',       label: 'Tarefas' },
  { key: 'vendas',      label: 'Vendas' },
  { key: 'calendario',  label: 'Calendário' },
  { key: 'automations', label: 'Automações' },
  { key: 'forms',       label: 'Formulários' },
];

const LEVEL_LABELS: Record<SimpleLevel, string> = {
  none: 'Nenhum',
  view: 'Ver',
  edit: 'Editar',
};

function initPerms(user: User): UserPermissions {
  if (!user.permissions) {
    // full access → convert to explicit edit for all
    const perms: UserPermissions = {};
    SIMPLE_MODULES.forEach(m => { perms[m.key] = 'edit'; });
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
  };
}

export default function MemberPermissionsModal({ member, onClose, onSaved }: Props) {
  const [perms, setPerms] = useState<UserPermissions>(initPerms(member));

  const setModule = (key: keyof Omit<UserPermissions, 'finances'>, level: SimpleLevel) => {
    setPerms(prev => ({ ...prev, [key]: level }));
  };

  const setFinance = (key: keyof NonNullable<UserPermissions['finances']>, value: boolean | 'none' | 'view' | 'edit') => {
    setPerms(prev => ({
      ...prev,
      finances: { ...prev.finances, [key]: value },
    }));
  };

  const setCommercial = (key: CommercialPermissionKey, value: boolean) => {
    setPerms(prev => ({
      ...prev,
      comercial: { ...prev.comercial, [key]: value },
    }));
  };

  const setCaixa = (key: CaixaPermissionKey, value: boolean) => {
    setPerms(prev => ({
      ...prev,
      caixa: { ...prev.caixa, view: true, [key]: value },
    }));
  };

  const setStock = (key: StockPermissionKey, value: boolean) => {
    setPerms(prev => ({
      ...prev,
      stock: { ...prev.stock, view: true, [key]: value },
    }));
  };

  const mutation = useMutation({
    mutationFn: () => setMemberPermissions(member.id, perms),
    onSuccess: () => { onSaved(); onClose(); },
  });

  const finances = perms.finances ?? {};
  const comercial = perms.comercial ?? {};
  const caixa = perms.caixa ?? {};
  const stock = perms.stock ?? {};

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Permissões — {member.name}</DialogTitle>
        </DialogHeader>

        <div className="py-2 space-y-5">
          {/* Simple modules */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#6b7e9a] mb-3">Módulos</p>
            <div className="space-y-2">
              {SIMPLE_MODULES.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between py-2 border-b border-[#f0f0f0] last:border-0">
                  <span className="text-sm font-medium text-[#0A2540]">{label}</span>
                  <div className="flex gap-1">
                    {(['none', 'view', 'edit'] as SimpleLevel[]).map(level => (
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

              {/* Chat: always edit */}
              <div className="flex items-center justify-between py-2">
                <span className="text-sm font-medium text-[#0A2540]">Conversas</span>
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#f8fafc] text-[#6b7e9a] border border-[#dde3ec]">
                  Sempre activo
                </span>
              </div>
            </div>
          </div>

          {/* Finance sub-permissions */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#6b7e9a] mb-3">Finanças</p>
            <div className="space-y-3 p-3 bg-[#f8fafc] rounded-xl border border-[#dde3ec]">
              {/* Transactions */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#0A2540]">Transacções</span>
                <div className="flex gap-1">
                  {(['none', 'view', 'edit'] as SimpleLevel[]).map(level => (
                    <button
                      key={level}
                      onClick={() => setFinance('transactions', level)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${
                        finances.transactions === level
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

              {/* Boolean finance permissions */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                {(
                  [
                    { key: 'view_invoices', label: 'Ver Faturas' },
                    { key: 'emit_invoices', label: 'Emitir Faturas' },
                    { key: 'view_reports',  label: 'Ver Relatórios' },
                    { key: 'saft',          label: 'SAF-T' },
                  ] as { key: keyof NonNullable<UserPermissions['finances']>; label: string }[]
                ).map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={!!(finances as Record<string, unknown>)[key as string]}
                      onChange={(e) => setFinance(key, e.target.checked)}
                      className="w-4 h-4 accent-[#0A2540]"
                    />
                    <span className="text-sm text-[#0A2540]">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#6b7e9a] mb-3">Permissões Comerciais</p>
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
                    onChange={(e) => setCommercial(key, e.target.checked)}
                    className="h-4 w-4 accent-[#0A2540]"
                  />
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#6b7e9a] mb-3">Caixa e Stock</p>
            <div className="space-y-3 p-3 bg-[#f8fafc] rounded-xl border border-[#dde3ec]">
              {([
                { key: 'open', label: 'Abrir caixa' },
                { key: 'close', label: 'Fechar caixa' },
                { key: 'audit', label: 'Ver auditoria de caixa' },
              ] as { key: CaixaPermissionKey; label: string }[]).map(({ key, label }) => (
                <label key={key} className="flex items-center justify-between gap-3 cursor-pointer select-none">
                  <span className="text-sm text-[#0A2540]">{label}</span>
                  <input
                    type="checkbox"
                    checked={!!caixa[key]}
                    onChange={(e) => setCaixa(key, e.target.checked)}
                    className="h-4 w-4 accent-[#0A2540]"
                  />
                </label>
              ))}

              <label className="flex items-center justify-between gap-3 cursor-pointer select-none border-t border-[#dde3ec] pt-3">
                <span className="text-sm text-[#0A2540]">Editar stock manualmente</span>
                <input
                  type="checkbox"
                  checked={!!stock.edit}
                  onChange={(e) => setStock('edit', e.target.checked)}
                  className="h-4 w-4 accent-[#0A2540]"
                />
              </label>
            </div>
          </div>
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
