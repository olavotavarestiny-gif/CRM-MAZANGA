'use client';

export default function PreviewPipeline() {
  const stages = [
    { name: 'Novo', color: '#0049e6' },
    { name: 'Contactado', color: '#006668' },
    { name: 'Proposta', color: '#8d3a8b' },
    { name: 'Fechado', color: '#b31b25' },
  ];

  return (
    <div className="max-w-7xl">
      <h1 className="text-3xl font-extrabold text-[#2c2f31] tracking-tight mb-8">Negociações</h1>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stages.map((stage) => (
          <div key={stage.name} className="bg-white rounded-xl border border-slate-100 overflow-hidden ambient-shadow">
            {/* Column Header */}
            <div className="px-4 py-3 border-b border-slate-100" style={{ borderLeftColor: stage.color, borderLeftWidth: '4px' }}>
              <h3 className="font-bold text-[#2c2f31] text-sm">{stage.name}</h3>
              <p className="text-xs text-[#595c5e] mt-0.5">0 negócios</p>
            </div>

            {/* Empty State */}
            <div className="p-4 min-h-96 flex items-center justify-center">
              <p className="text-sm text-[#595c5e] text-center">Sem contactos</p>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <div className="bg-white rounded-xl p-6 border border-slate-100 ambient-shadow">
          <h3 className="font-bold text-[#2c2f31] mb-4">Resumo do Pipeline</h3>
          <p className="text-sm text-[#595c5e]">Total: 0 negócios</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-slate-100 ambient-shadow">
          <h3 className="font-bold text-[#2c2f31] mb-4">Valor Total</h3>
          <p className="text-2xl font-bold text-[#0049e6]">0 Kz</p>
        </div>
      </div>
    </div>
  );
}
