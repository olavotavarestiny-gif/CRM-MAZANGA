'use client';

export default function PreviewTasks() {
  return (
    <div className="max-w-7xl">
      <h1 className="text-3xl font-extrabold text-[#2c2f31] tracking-tight mb-8">Tarefas</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 border border-slate-100 ambient-shadow">
          <p className="text-xs font-medium text-[#595c5e] uppercase tracking-wide mb-1">Pendentes</p>
          <p className="text-4xl font-extrabold text-[#2c2f31]">0</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-slate-100 ambient-shadow">
          <p className="text-xs font-medium text-[#595c5e] uppercase tracking-wide mb-1">Para Hoje</p>
          <p className="text-4xl font-extrabold text-[#2c2f31]">0</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-slate-100 ambient-shadow">
          <p className="text-xs font-medium text-[#595c5e] uppercase tracking-wide mb-1">Atrasadas</p>
          <p className="text-4xl font-extrabold text-[#2c2f31]">0</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white rounded-xl border border-slate-100 mb-6 ambient-shadow">
        <div className="flex gap-4 px-6 py-4 border-b border-slate-200">
          <button className="px-3 py-2 font-medium text-[#0049e6] border-b-2 border-[#0049e6] text-sm">
            Todas
          </button>
          <button className="px-3 py-2 font-medium text-[#595c5e] hover:text-[#0049e6] text-sm">
            Hoje
          </button>
          <button className="px-3 py-2 font-medium text-[#595c5e] hover:text-[#0049e6] text-sm">
            Atrasadas
          </button>
          <button className="px-3 py-2 font-medium text-[#595c5e] hover:text-[#0049e6] text-sm">
            Concluídas
          </button>
        </div>

        {/* Task List */}
        <div className="p-6 text-center">
          <p className="text-[#595c5e] text-sm">Nenhuma tarefa pendente 🎉</p>
        </div>
      </div>

      {/* Add Task Button */}
      <div className="bg-white rounded-xl p-6 border border-slate-100 text-center ambient-shadow">
        <button className="text-[#0049e6] font-bold text-sm hover:text-[#0049e6]/80 transition-colors">
          + Nova Tarefa
        </button>
      </div>
    </div>
  );
}
