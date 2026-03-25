'use client';

import { useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import { TabFacturas } from '@/components/finances/tab-facturas';
import { TabSaft } from '@/components/finances/tab-saft';
import { RecorrentesTab } from '@/components/faturacao/recorrentes-tab';
import ProdutosPage from '@/app/produtos/page';

const TABS = [
  { id: 'faturas',      label: 'Faturas' },
  { id: 'produtos',     label: 'Produtos' },
  { id: 'recorrentes',  label: 'Recorrentes' },
  { id: 'saft',         label: 'SAF-T (AGT)' },
] as const;

type Tab = (typeof TABS)[number]['id'];

export default function VendasPage() {
  const [activeTab, setActiveTab] = useState<Tab>('faturas');

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shrink-0">
            <ShoppingBag className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#0A2540]">Vendas</h1>
            <p className="text-gray-500 text-sm">Faturas, produtos, recorrentes e documentos fiscais</p>
          </div>
        </div>
        <a href="/faturacao/nova">
          <button className="bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 transition-opacity">
            Nova Fatura
          </button>
        </a>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-0 border-b border-gray-200 mb-6">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-[#0A2540] text-[#0A2540]'
                : 'border-transparent text-gray-500 hover:text-[#0A2540]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'faturas'     && <TabFacturas />}
      {activeTab === 'recorrentes' && <RecorrentesTab />}
      {activeTab === 'saft'        && <TabSaft />}
      {activeTab === 'produtos'    && (
        <div className="-mt-2">
          <ProdutosPage />
        </div>
      )}
    </div>
  );
}
