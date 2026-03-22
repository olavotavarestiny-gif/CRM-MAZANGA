'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getClientProfitabilityDetail, markTransactionPaid } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ClientProfitability } from '@/lib/types';

function fmt(n: number) {
  return new Intl.NumberFormat('pt-PT').format(Math.round(n)) + ' Kz';
}

export default function ClientProfitabilityModal({
  client,
  onClose,
}: {
  client: ClientProfitability | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const open = !!client;

  const { data, isLoading } = useQuery({
    queryKey: ['profitability-detail', client?.clientId],
    queryFn: () => getClientProfitabilityDetail(client!.clientId),
    enabled: !!client,
  });

  const markPaidMutation = useMutation({
    mutationFn: markTransactionPaid,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profitability-detail', client?.clientId] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['finance-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['profitability'] });
    },
  });

  const summary = data?.summary;
  const marginColor =
    !summary ? 'text-slate-500' :
    summary.marginPercent >= 50 ? 'text-emerald-400' :
    summary.marginPercent >= 20 ? 'text-yellow-400' :
    'text-red-400';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-zinc-900 border-slate-200">
        <DialogHeader>
          <DialogTitle className="text-slate-900">
            {data?.contact?.name || client?.clientName || '—'}
            {data?.contact?.company && (
              <span className="text-slate-500 font-normal text-sm ml-2">
                — {data.contact.company}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="py-12 text-center text-slate-400">A carregar...</div>
        ) : data ? (
          <div className="space-y-6 mt-2">
            {/* Resumo financeiro */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
                <div className="text-xs text-slate-500 mb-1">Receita Total</div>
                <div className="text-lg font-bold text-emerald-400">{fmt(summary?.totalRevenue || 0)}</div>
              </div>
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                <div className="text-xs text-slate-500 mb-1">Custos Directos</div>
                <div className="text-lg font-bold text-red-400">{fmt(summary?.totalCosts || 0)}</div>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <div className="text-xs text-slate-500 mb-1">Margem Líquida</div>
                <div className={`text-lg font-bold ${marginColor}`}>{fmt(summary?.netMargin || 0)}</div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-xs text-slate-500 mb-1">Margem %</div>
                <div className={`text-lg font-bold ${marginColor}`}>{summary?.marginPercent.toFixed(1)}%</div>
              </div>
            </div>

            {/* Contratos recorrentes activos */}
            {data.activeContracts.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-600 mb-3">Contratos Recorrentes Activos</h3>
                <div className="space-y-2">
                  {data.activeContracts.map((contract) => (
                    <div
                      key={contract.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200"
                    >
                      <div>
                        <div className="text-sm text-[#0A2540] font-medium">{contract.category}</div>
                        <div className="text-xs text-[#6b7e9a]">
                          {fmt(contract.amountKz)}/mês
                          {contract.contractDurationMonths && ` · ${contract.contractDurationMonths} meses`}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-xs text-slate-400">Próximo</div>
                          <div className="text-sm text-yellow-300">
                            {contract.nextPaymentDate
                              ? new Date(contract.nextPaymentDate).toLocaleDateString('pt-PT')
                              : '—'}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => markPaidMutation.mutate(contract.id)}
                          disabled={markPaidMutation.isPending}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
                        >
                          Marcar Pago
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Custos por categoria */}
            {data.costsByCategory.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-600 mb-3">Custos por Categoria</h3>
                <div className="space-y-1.5">
                  {data.costsByCategory.map((c) => (
                    <div key={c.category} className="flex justify-between items-center py-1.5 border-b border-slate-100">
                      <span className="text-sm text-slate-600">{c.category}</span>
                      <span className="text-sm text-red-400">-{fmt(c.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Últimas transações */}
            {data.recentTransactions.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-600 mb-3">Últimas Transações</h3>
                <div className="space-y-1.5">
                  {data.recentTransactions.slice(0, 10).map((t) => (
                    <div key={t.id} className="flex justify-between items-center py-1.5 border-b border-slate-100">
                      <div>
                        <span className="text-sm text-slate-600">{t.category}</span>
                        {t.description && (
                          <span className="text-xs text-slate-400 ml-2">{t.description}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400">
                          {new Date(t.date).toLocaleDateString('pt-PT')}
                        </span>
                        <span className={`text-sm font-medium ${t.type === 'entrada' ? 'text-emerald-400' : 'text-red-400'}`}>
                          {t.type === 'entrada' ? '+' : '-'}{fmt(t.amountKz)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="py-12 text-center text-slate-400">Sem dados disponíveis.</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
