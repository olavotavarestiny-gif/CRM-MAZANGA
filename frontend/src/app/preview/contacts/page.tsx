'use client';

import { Search } from 'lucide-react';

export default function PreviewContacts() {
  return (
    <div className="max-w-7xl">
      <h1 className="text-3xl font-extrabold text-[#2c2f31] tracking-tight mb-8">Clientes</h1>

      {/* Search & Filters */}
      <div className="bg-white rounded-xl p-6 border border-slate-100 mb-6 ambient-shadow">
        <div className="flex gap-4 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#595c5e]" />
            <input
              type="text"
              placeholder="Pesquisar contacto..."
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0049e6] text-[#2c2f31]"
              disabled
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 border-b border-slate-200">
          <button className="px-4 py-2 font-medium text-[#0049e6] border-b-2 border-[#0049e6]">
            Interessados
          </button>
          <button className="px-4 py-2 font-medium text-[#595c5e] hover:text-[#0049e6]">
            Clientes
          </button>
        </div>
      </div>

      {/* Empty Table State */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden ambient-shadow">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="px-6 py-4 text-left text-xs font-bold text-[#595c5e] uppercase tracking-wide">Nome</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-[#595c5e] uppercase tracking-wide">Contacto</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-[#595c5e] uppercase tracking-wide">Tipo</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-[#595c5e] uppercase tracking-wide">Stage</th>
                <th className="px-6 py-4 text-center text-xs font-bold text-[#595c5e] uppercase tracking-wide">Ações</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center">
                  <p className="text-[#595c5e] text-sm">0 contactos</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <div className="bg-white rounded-xl p-6 border border-slate-100 ambient-shadow">
          <p className="text-xs font-medium text-[#595c5e] uppercase tracking-wide mb-1">Novos Leads</p>
          <p className="text-3xl font-extrabold text-[#2c2f31]">42</p>
          <p className="text-xs text-[#595c5e] mt-1">+12.5%</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-slate-100 ambient-shadow">
          <p className="text-xs font-medium text-[#595c5e] uppercase tracking-wide mb-1">Propostas Pendentes</p>
          <p className="text-3xl font-extrabold text-[#2c2f31]">18</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-slate-100 ambient-shadow">
          <p className="text-xs font-medium text-[#595c5e] uppercase tracking-wide mb-1">Taxa de Conversão</p>
          <p className="text-3xl font-extrabold text-[#2c2f31]">24%</p>
        </div>
      </div>
    </div>
  );
}
