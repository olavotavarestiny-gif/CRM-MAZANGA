'use client';

export default function PreviewFinances() {
  return (
    <div className="max-w-7xl">
      <h1 className="text-3xl font-extrabold text-[#2c2f31] tracking-tight mb-8">Finanças</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 border border-slate-100 ambient-shadow" style={{ borderLeftColor: '#10B981', borderLeftWidth: '4px' }}>
          <p className="text-xs font-medium text-[#595c5e] uppercase tracking-wide mb-1">Receita</p>
          <p className="text-4xl font-extrabold text-[#2c2f31]">0 Kz</p>
          <p className="text-xs text-[#595c5e] mt-1">Este mês</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-slate-100 ambient-shadow" style={{ borderLeftColor: '#F59E0B', borderLeftWidth: '4px' }}>
          <p className="text-xs font-medium text-[#595c5e] uppercase tracking-wide mb-1">Despesas</p>
          <p className="text-4xl font-extrabold text-[#2c2f31]">0 Kz</p>
          <p className="text-xs text-[#595c5e] mt-1">Este mês</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-slate-100 ambient-shadow" style={{ borderLeftColor: '#0049e6', borderLeftWidth: '4px' }}>
          <p className="text-xs font-medium text-[#595c5e] uppercase tracking-wide mb-1">Lucro</p>
          <p className="text-4xl font-extrabold text-[#2c2f31]">0 Kz</p>
          <p className="text-xs text-[#595c5e] mt-1">Este mês</p>
        </div>
      </div>

      {/* Charts Placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-12 border border-slate-100 text-center ambient-shadow">
          <p className="text-[#595c5e] text-sm">Sem dados financeiros configurado</p>
        </div>
        <div className="bg-white rounded-xl p-12 border border-slate-100 text-center ambient-shadow">
          <p className="text-[#595c5e] text-sm">Sem facturas registadas</p>
        </div>
      </div>
    </div>
  );
}
