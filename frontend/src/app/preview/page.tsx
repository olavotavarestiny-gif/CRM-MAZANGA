'use client';

import StatWidget from '@/components/dashboard/stat-widget';
import WeeklyInsightCard from '@/components/dashboard/weekly-insight-card';

export default function PreviewPainel() {
  return (
    <div className="max-w-7xl">
      <h1 className="text-3xl font-extrabold text-[#2c2f31] tracking-tight mb-8">Painel</h1>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatWidget title="Total Contactos" value={106} color="#0049e6" subtitle="+12%" />
        <StatWidget title="Novos Este Mês" value={106} color="#006668" subtitle="Meta: 150" />
        <StatWidget title="Nas Negociações" value={11} color="#8d3a8b" subtitle="Ativos" />
        <StatWidget title="Tarefas Pendentes" value={1} color="#b31b25" subtitle="Urgente" />
      </div>

      {/* Weekly Insight Card */}
      <div className="mb-8 max-w-2xl">
        <WeeklyInsightCard pendingTasks={1} pipelineCount={11} />
      </div>

      {/* Rest of the dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline */}
        <div className="bg-white rounded-xl p-6 border border-slate-100 ambient-shadow">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-[#2c2f31]">Fluxo de Negociações</h3>
            <a href="/preview/pipeline" className="text-xs text-[#0049e6] font-semibold hover:text-[#0049e6]/80 transition-colors">
              Ver detalhes
            </a>
          </div>
          <p className="text-sm text-[#595c5e] text-center py-8">Nenhum contacto em pipeline</p>
        </div>

        {/* Tasks */}
        <div className="bg-white rounded-xl p-6 border border-slate-100 ambient-shadow">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-[#2c2f31]">Tarefas Pendentes</h3>
            <span className="text-xs font-bold text-white bg-[#b31b25] px-2 py-1 rounded-full">1</span>
          </div>
          <p className="text-sm text-[#595c5e] text-center py-8">Nenhuma tarefa pendente 🎉</p>
        </div>
      </div>
    </div>
  );
}
