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
    !summary ? 'text-[#64748B]' :
    summary.marginPercent >= 50 ? 'text-emerald-600' :
    summary.marginPercent >= 20 ? 'text-amber-600' :
    'text-red-600';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white border-[#E2E8F0]">
        <DialogHeader>
          <DialogTitle className="text-[#0A2540]">
            {data?.contact?.name || client?.clientName || '—'}
            {data?.contact?.company && (
              <span className="text-[#64748B] font-normal text-sm ml-2">
                — {data.contact.company}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="py-12 text-center text-[#64748B]">A carregar...</div>
        ) : data ? (
          <div className="space-y-6 mt-2">
            {/* Resumo financeiro */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4">
                <div className="text-xs text-[#64748B] mb-1">Receita Total</div>
                <div className="text-lg font-bold text-emerald-700">{fmt(summary?.totalRevenue || 0)}</div>
              </div>
              <div className="bg-red-50 border border-red-100 rounded-lg p-4">
                <div className="text-xs text-[#64748B] mb-1">Custos Directos</div>
                <div className="text-lg font-bold text-red-600">{fmt(summary?.totalCosts || 0)}</div>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                <div className="text-xs text-[#64748B] mb-1">Margem Líquida</div>
                <div className={`text-lg font-bold ${marginColor}`}>{fmt(summary?.netMargin || 0)}</div>
              </div>
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-4">
                <div className="text-xs text-[#64748B] mb-1">Margem %</div>
                <div className={`text-lg font-bold ${marginColor}`}>{summary?.marginPercent.toFixed(1)}%</div>
              </div>
            </div>

            {/* Contratos recorrentes activos */}
            {data.activeContracts.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-[#0A2540] mb-3">Contratos Recorrentes Activos</h3>
                <div className="space-y-2">
                  {data.activeContracts.map((contract) => (
                    <div
                      key={contract.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]"
                    >
                      <div>
                        <div className="text-sm text-[#0A2540] font-medium">{contract.category}</div>
                        <div className="text-xs text-[#64748B]">
                          {fmt(contract.amountKz)}/mês
                          {contract.contractDurationMonths && ` · ${contract.contractDurationMonths} meses`}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-xs text-[#64748B]">Próximo</div>
                          <div className="text-sm font-medium text-amber-600">
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
                <h3 className="text-sm font-semibold text-[#0A2540] mb-3">Custos por Categoria</h3>
                <div className="space-y-1.5">
                  {data.costsByCategory.map((c) => (
                    <div key={c.category} className="flex justify-between items-center py-1.5 border-b border-[#E2E8F0]">
                      <span className="text-sm text-[#0A2540]">{c.category}</span>
                      <span className="text-sm font-medium text-red-600">-{fmt(c.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Últimas transações */}
            {data.recentTransactions.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-[#0A2540] mb-3">Últimas Transações</h3>
                <div className="space-y-1.5">
                  {data.recentTransactions.slice(0, 10).map((t) => (
                    <div key={t.id} className="flex justify-between items-center py-1.5 border-b border-[#E2E8F0]">
                      <div>
                        <span className="text-sm text-[#0A2540]">{t.category}</span>
                        {t.description && (
                          <span className="text-xs text-[#64748B] ml-2">{t.description}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-[#64748B]">
                          {new Date(t.date).toLocaleDateString('pt-PT')}
                        </span>
                        <span className={`text-sm font-medium ${t.type === 'entrada' ? 'text-emerald-600' : 'text-red-600'}`}>
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
          <div className="py-12 text-center text-[#64748B]">Sem dados disponíveis.</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
