'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Play, Pause, RotateCcw, Trash2, ExternalLink, RefreshCw } from 'lucide-react';
import { getRecorrentes, updateRecorrente, deleteRecorrente, triggerRecorrente } from '@/lib/api';
import { RecorrenteForm } from './recorrente-form';
import type { FacturaRecorrente } from '@/lib/types';

const FREQ_LABELS: Record<string, { label: string; color: string }> = {
  WEEKLY:    { label: 'Semanal',    color: 'bg-blue-50 text-blue-700 border-blue-200' },
  MONTHLY:   { label: 'Mensal',     color: 'bg-violet-50 text-violet-700 border-violet-200' },
  QUARTERLY: { label: 'Trimestral', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  ANNUAL:    { label: 'Anual',      color: 'bg-green-50 text-green-700 border-green-200' },
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function RecorrentesTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [triggering, setTriggering] = useState<string | null>(null);

  const { data: items = [], isLoading } = useQuery<FacturaRecorrente[]>({
    queryKey: ['recorrentes'],
    queryFn: getRecorrentes,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateRecorrente(id, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recorrentes'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRecorrente(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recorrentes'] }),
  });

  async function handleTrigger(id: string) {
    setTriggering(id);
    try {
      await triggerRecorrente(id);
      qc.invalidateQueries({ queryKey: ['recorrentes'] });
      qc.invalidateQueries({ queryKey: ['facturas'] });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao emitir fatura';
      alert(message);
    } finally {
      setTriggering(null);
    }
  }

  const active = items.filter(i => i.isActive);
  const paused = items.filter(i => !i.isActive);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[#0A2540]">Faturas Recorrentes</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {active.length} ativa{active.length !== 1 ? 's' : ''} · {paused.length} pausada{paused.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button
          onClick={() => setShowForm(true)}
          className="bg-[#635BFF] hover:bg-[#4f46e5] text-white gap-2"
        >
          <Plus className="w-4 h-4" /> Nova Recorrente
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400 text-sm">A carregar...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto">
            <RefreshCw className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-gray-500 text-sm">Nenhuma fatura recorrente criada ainda.</p>
          <Button variant="outline" size="sm" onClick={() => setShowForm(true)} className="gap-1">
            <Plus className="w-3.5 h-3.5" /> Criar a primeira
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {[...active, ...paused].map(item => {
            const freq = FREQ_LABELS[item.frequency] ?? { label: item.frequency, color: 'bg-gray-100 text-gray-600' };
            const progressText = item.maxOccurrences
              ? `${item.totalGenerated} de ${item.maxOccurrences} emitidas`
              : `${item.totalGenerated} emitida${item.totalGenerated !== 1 ? 's' : ''}`;

            return (
              <div
                key={item.id}
                className={`p-4 rounded-xl border bg-white transition-all ${
                  item.isActive
                    ? 'border-gray-200 hover:border-gray-300'
                    : 'border-gray-100 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left: info */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-[#0A2540] text-sm truncate">
                        {item.clienteFaturacao?.customerName ?? item.customerName}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs border font-medium ${freq.color}`}>
                        {freq.label}
                      </span>
                      <Badge variant="outline" className={
                        item.isActive
                          ? 'text-green-700 border-green-200 bg-green-50 text-xs'
                          : 'text-gray-500 border-gray-200 bg-gray-50 text-xs'
                      }>
                        {item.isActive ? 'Ativa' : 'Pausada'}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                      <span>
                        <span className="text-gray-400">NIF:</span> {item.customerTaxID}
                      </span>
                      <span>
                        <span className="text-gray-400">Série:</span>{' '}
                        {item.serie
                          ? `${item.serie.seriesCode}/${item.serie.seriesYear}`
                          : item.serieId}
                      </span>
                      <span>
                        <span className="text-gray-400">Próxima emissão:</span>{' '}
                        <span className={item.isActive ? 'text-[#0A2540] font-medium' : ''}>
                          {fmtDate(item.nextRunDate)}
                        </span>
                      </span>
                      {item.lastRunDate && (
                        <span>
                          <span className="text-gray-400">Última:</span> {fmtDate(item.lastRunDate)}
                        </span>
                      )}
                      <span className="text-gray-500">{progressText}</span>
                    </div>

                    {item.notes && (
                      <p className="text-xs text-gray-400 italic">{item.notes}</p>
                    )}
                  </div>

                  {/* Right: actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Emit now */}
                    <Button
                      variant="outline" size="sm"
                      disabled={triggering === item.id}
                      onClick={() => handleTrigger(item.id)}
                      className="h-8 px-2.5 text-xs border-gray-200 text-gray-600 hover:bg-[#635BFF] hover:text-white hover:border-[#635BFF]"
                      title="Emitir agora"
                    >
                      {triggering === item.id
                        ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        : <Play className="w-3.5 h-3.5" />
                      }
                    </Button>

                    {/* Pause / Resume */}
                    <Button
                      variant="outline" size="sm"
                      onClick={() => toggleMutation.mutate({ id: item.id, isActive: !item.isActive })}
                      disabled={toggleMutation.isPending}
                      className="h-8 px-2.5 text-xs border-gray-200 text-gray-600 hover:bg-gray-50"
                      title={item.isActive ? 'Pausar' : 'Retomar'}
                    >
                      {item.isActive
                        ? <Pause className="w-3.5 h-3.5" />
                        : <RotateCcw className="w-3.5 h-3.5" />
                      }
                    </Button>

                    {/* View last invoice */}
                    {item.lastFacturaId && (
                      <Button
                        variant="outline" size="sm"
                        onClick={() => window.open(`/faturacao/${item.lastFacturaId}`, '_blank')}
                        className="h-8 px-2.5 text-xs border-gray-200 text-gray-600 hover:bg-gray-50"
                        title="Ver última fatura emitida"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                    )}

                    {/* Delete */}
                    <Button
                      variant="outline" size="sm"
                      onClick={() => {
                        if (confirm(`Eliminar fatura recorrente para ${item.customerName}?`))
                          deleteMutation.mutate(item.id);
                      }}
                      disabled={deleteMutation.isPending}
                      className="h-8 px-2.5 text-xs border-red-200 text-red-500 hover:bg-red-50"
                      title="Eliminar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <RecorrenteForm open={showForm} onClose={() => setShowForm(false)} />
    </div>
  );
}
