'use client';

import { useMemo } from 'react';
import type { ClienteFaturacao } from '@/lib/types';
import { getClientesFaturacao } from '@/lib/api';
import { AsyncSearchPicker, SearchGroup } from '@/components/search/async-search-picker';

interface Props {
  onChange: (cliente: ClienteFaturacao) => void;
  value?: string;
}

export function ClienteAutocomplete({ onChange, value }: Props) {
  const searchFn = useMemo(
    () => async (query: string): Promise<SearchGroup<ClienteFaturacao>[]> => {
      const data = await getClientesFaturacao({ search: query });
      return [
        {
          id: 'billing-clients',
          label: 'Clientes de faturação',
          items: data.clientes,
        },
      ];
    },
    []
  );

  return (
    <AsyncSearchPicker
      label="Cliente (nome ou NIF)"
      placeholder="Pesquisar cliente..."
      initialValue={value}
      helperText="Pesquisa rápida na base de clientes de faturação."
      searchFn={searchFn}
      getItemKey={(cliente) => cliente.id}
      getSelectedLabel={(cliente) => cliente.customerName}
      onSelect={onChange}
      emptyState={{
        title: 'Nenhum cliente encontrado',
        message: 'Tenta outro nome ou NIF para localizar o cliente pretendido.',
      }}
      renderItem={(cliente) => (
        <div>
          <p className="text-sm font-medium text-[#2c2f31]">{cliente.customerName}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            NIF: {cliente.customerTaxID}
            {cliente.customerPhone ? ` · ${cliente.customerPhone}` : ''}
          </p>
        </div>
      )}
    />
  );
}
