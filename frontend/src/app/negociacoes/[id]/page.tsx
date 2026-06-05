'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDeal, closeDeal, reopenDeal } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ErrorState } from '@/components/ui/error-state';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import DealStakeholdersPanel from '@/components/pipeline/deal-stakeholders-panel';
import { getApiErrorMessage } from '@/lib/api-error-message';
import { ArrowLeft, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';

function formatKz(value?: number | null) {
  if (value === null || value === undefined) {
    return '—';
  }
  return `${new Intl.NumberFormat('pt-PT').format(Math.round(value))} Kz`;
}

const STATUS_LABELS = {
  aberto: 'Aberto',
  ganho: 'Ganho',
  perdido: 'Perdido',
} as const;

export default function DealDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const queryClient = useQueryClient();

  const [isLossOpen, setIsLossOpen] = useState(false);
  const [lossReason, setLossReason] = useState('');

  const {
    data: deal,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['deal', id],
    queryFn: () => getDeal(id),
    retry: false,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['deal', id] });
    queryClient.invalidateQueries({ queryKey: ['deals'] });
  };

  const winMutation = useMutation({
    mutationFn: () => closeDeal(id, { status: 'ganho' }),
    onSuccess: invalidate,
  });

  const lossMutation = useMutation({
    mutationFn: () => closeDeal(id, { status: 'perdido', lossReason: lossReason.trim() }),
    onSuccess: () => {
      invalidate();
      setIsLossOpen(false);
      setLossReason('');
    },
  });

  const reopenMutation = useMutation({
    mutationFn: () => reopenDeal(id),
    onSuccess: invalidate,
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl p-4 md:p-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-[#6b7e9a] shadow-sm">
          A carregar negociação...
        </div>
      </div>
    );
  }

  if (isError || !deal) {
    return (
      <div className="mx-auto max-w-5xl p-4 md:p-6">
        <ErrorState
          title="Falha ao carregar negociação"
          message={getApiErrorMessage(error, 'Não foi possível carregar a negociação.')}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const isOpen = deal.status === 'aberto';
  const closeError = winMutation.error || lossMutation.error || reopenMutation.error;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <Link
        href="/negociacoes"
        className="inline-flex items-center gap-1 text-sm text-[#6b7e9a] hover:text-[#0A2540]"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar às negociações
      </Link>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            {deal.company?.name && (
              <p className="text-sm font-semibold uppercase tracking-wide text-[#6b7e9a]">
                {deal.company.name}
              </p>
            )}
            <h1 className="text-3xl font-extrabold tracking-tight text-[#0A2540]">
              {deal.title}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-semibold text-[#0A2540]">
                {formatKz(deal.valueKz)}
              </span>
              {deal.stage && (
                <Badge
                  variant="outline"
                  style={{
                    borderColor: deal.stage.color,
                    color: deal.stage.color,
                  }}
                >
                  {deal.stage.name}
                </Badge>
              )}
              <Badge
                variant={
                  deal.status === 'ganho'
                    ? 'success'
                    : deal.status === 'perdido'
                    ? 'destructive'
                    : 'secondary'
                }
              >
                {STATUS_LABELS[deal.status]}
              </Badge>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
            {isOpen ? (
              <>
                <Button
                  onClick={() => winMutation.mutate()}
                  disabled={winMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {winMutation.isPending ? 'A fechar...' : 'Marcar como Ganho'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsLossOpen(true)}
                  className="border-red-200 text-red-600 hover:bg-red-50"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Marcar como Perdido
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                onClick={() => reopenMutation.mutate()}
                disabled={reopenMutation.isPending}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                {reopenMutation.isPending ? 'A reabrir...' : 'Reabrir'}
              </Button>
            )}
          </div>
        </div>

        {!isOpen && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-[#f9fafc] p-4">
            <p className="text-sm font-semibold text-[#0A2540]">
              Negociação {deal.status === 'ganho' ? 'ganha' : 'perdida'}.
            </p>
            {deal.status === 'perdido' && deal.lossReason && (
              <p className="mt-1 text-sm text-[#6b7e9a]">
                Motivo: {deal.lossReason}
              </p>
            )}
          </div>
        )}

        {closeError && (
          <p className="mt-3 text-sm text-red-500">
            {getApiErrorMessage(closeError, 'Não foi possível atualizar o estado da negociação.')}
          </p>
        )}
      </div>

      <DealStakeholdersPanel deal={deal} />

      <Dialog open={isLossOpen} onOpenChange={(o) => !o && setIsLossOpen(false)}>
        <DialogContent className="max-w-md bg-white text-[#0A2540]">
          <DialogHeader>
            <DialogTitle className="text-[#0A2540]">Marcar como Perdido</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="mb-1.5 block text-sm font-medium text-[#0A2540]">
                Motivo da perda <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="Ex.: Preço acima do orçamento"
                value={lossReason}
                onChange={(e) => setLossReason(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && lossReason.trim()) {
                    lossMutation.mutate();
                  }
                }}
              />
            </div>

            {lossMutation.isError && (
              <p className="text-sm text-red-500">
                {getApiErrorMessage(lossMutation.error, 'Não foi possível fechar a negociação.')}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setIsLossOpen(false)}
                disabled={lossMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={() => lossMutation.mutate()}
                disabled={!lossReason.trim() || lossMutation.isPending}
              >
                {lossMutation.isPending ? 'A fechar...' : 'Confirmar perda'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
