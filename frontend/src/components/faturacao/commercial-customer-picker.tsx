'use client';

import { useMemo } from 'react';
import { AsyncSearchPicker, SearchGroup } from '@/components/search/async-search-picker';
import {
  CommercialCustomerLookupItem,
  searchCommercialCustomers,
} from '@/lib/commercial-customer-lookup';

const SOURCE_BADGE_STYLES: Record<'crm' | 'faturacao', string> = {
  crm: 'border-slate-200 bg-slate-100 text-slate-600',
  faturacao: 'border-[color:var(--workspace-primary-border)] bg-[var(--workspace-primary-soft)] text-[var(--workspace-primary)]',
};

interface Props {
  onChange: (customer: CommercialCustomerLookupItem) => void;
  value?: string;
  label?: string;
  placeholder?: string;
  helperText?: string;
  footerAction?: {
    label: string;
    onClick: () => void;
  };
  emptyState?: {
    title: string;
    message: string;
  };
}

export function CommercialCustomerPicker({
  onChange,
  value,
  label = 'Cliente (CRM + Faturação)',
  placeholder = 'Pesquisar por nome, telefone, NIF ou empresa...',
  helperText = 'Pesquisa unificada entre contactos CRM e clientes já registados na faturação.',
  footerAction,
  emptyState = {
    title: 'Nenhum cliente encontrado',
    message: 'Tenta outro nome, empresa, telefone ou NIF.',
  },
}: Props) {
  const searchFn = useMemo(
    () => async (query: string): Promise<SearchGroup<CommercialCustomerLookupItem>[]> =>
      searchCommercialCustomers(query),
    []
  );

  return (
    <AsyncSearchPicker
      label={label}
      placeholder={placeholder}
      initialValue={value}
      helperText={helperText}
      searchFn={searchFn}
      getItemKey={(customer) => `${customer.source}-${customer.id}`}
      getSelectedLabel={(customer) => customer.customerName}
      onSelect={onChange}
      footerAction={footerAction}
      emptyState={emptyState}
      renderItem={(customer) => (
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-[#2c2f31]">{customer.customerName}</p>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${SOURCE_BADGE_STYLES[customer.source]}`}>
              {customer.label}
            </span>
            {customer.requiresContactFix && (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                Empresa sem NIF
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            NIF: {customer.customerTaxID || 'em falta'}
            {customer.customerPhone ? ` · ${customer.customerPhone}` : ''}
            {customer.company ? ` · ${customer.company}` : ''}
          </p>
        </div>
      )}
    />
  );
}
