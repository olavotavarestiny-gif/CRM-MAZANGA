'use client';

export default function PreviewVendas() {
  return (
    <div className="max-w-7xl">
      <h1 className="text-3xl font-extrabold text-[#2c2f31] tracking-tight mb-8">Vendas</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 border border-slate-100 ambient-shadow" style={{ borderLeftColor: '#0049e6', borderLeftWidth: '4px' }}>
          <p className="text-xs font-medium text-[#595c5e] uppercase tracking-wide mb-1">Vendas Este Mês</p>
          <p className="text-4xl font-extrabold text-[#2c2f31]">0</p>
          <p className="text-xs text-[#595c5e] mt-1">0 Kz</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-slate-100 ambient-shadow" style={{ borderLeftColor: '#006668', borderLeftWidth: '4px' }}>
          <p className="text-xs font-medium text-[#595c5e] uppercase tracking-wide mb-1">Ticket Médio</p>
          <p className="text-4xl font-extrabold text-[#2c2f31]">0 Kz</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-slate-100 ambient-shadow" style={{ borderLeftColor: '#8d3a8b', borderLeftWidth: '4px' }}>
          <p className="text-xs font-medium text-[#595c5e] uppercase tracking-wide mb-1">Crescimento</p>
          <p className="text-4xl font-extrabold text-[#2c2f31]">0%</p>
        </div>
      </div>

      {/* Chart Placeholder */}
      <div className="bg-white rounded-xl p-12 border border-slate-100 text-center ambient-shadow">
        <p className="text-[#595c5e] text-sm">Sem dados de vendas configurado</p>
      </div>
    </div>
  );
}
