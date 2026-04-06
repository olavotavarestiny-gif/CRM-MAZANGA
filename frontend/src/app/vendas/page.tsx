'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import { TabFacturas } from '@/components/finances/tab-facturas';
import { TabSaft } from '@/components/finances/tab-saft';
import { TabRelatorios } from '@/components/finances/tab-relatorios';
import { RecorrentesTab } from '@/components/faturacao/recorrentes-tab';
import ProdutosPage from '@/app/produtos/page';
import { CommerceButton as Button } from '@/components/ui/button-commerce';

const TABS = [
  { id: 'faturas',      label: 'Faturas' },
  { id: 'produtos',     label: 'Produtos' },
  { id: 'recorrentes',  label: 'Recorrentes' },
  { id: 'relatorios',   label: 'Relatórios' },
  { id: 'saft',         label: 'SAF-T (AGT)' },
] as const;

type Tab = (typeof TABS)[number]['id'];

export default function VendasPage() {
  const [activeTab, setActiveTab] = useState<Tab>('faturas');

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100">
            <ShoppingBag className="h-5 w-5 text-[var(--workspace-primary)]" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-[#2c2f31]">Vendas</h1>
            <p className="mt-1 text-sm text-[#6b7e9a]">
              Faturas, produtos, recorrentes e documentos fiscais numa superfície única.
            </p>
          </div>
        </div>

        <Button asChild className="w-full gap-2 sm:w-auto">
          <Link href="/faturacao/nova">
            Nova Fatura
          </Link>
        </Button>
      </div>

      <div className="flex flex-nowrap gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-[var(--workspace-primary)] text-[var(--workspace-on-primary)] shadow-sm'
                : 'text-[#6b7e9a] hover:bg-[var(--workspace-primary-soft)] hover:text-[var(--workspace-primary)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'faturas'     && <TabFacturas />}
      {activeTab === 'recorrentes' && <RecorrentesTab />}
      {activeTab === 'relatorios'  && <TabRelatorios />}
      {activeTab === 'saft'        && <TabSaft />}
      {activeTab === 'produtos'    && (
        <div className="-mt-2">
          <ProdutosPage />
        </div>
      )}
    </div>
  );
}
