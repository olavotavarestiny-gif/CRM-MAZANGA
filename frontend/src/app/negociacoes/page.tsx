'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { getDeals, getDealStages, getCurrentUser } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import DealsKanbanBoard from '@/components/pipeline/deals-kanban-board';
import DealStageManager from '@/components/pipeline/deal-stage-manager';
import NewDealDialog from '@/components/pipeline/new-deal-dialog';
import { getApiErrorMessage } from '@/lib/api-error-message';
import { Settings2, Handshake, User, Building2 } from 'lucide-react';

export default function NegociacoesPage() {
  const [isStageManagerOpen, setIsStageManagerOpen] = useState(false);
  const [isNewDealOpen, setIsNewDealOpen] = useState(false);

  const {
    data: currentUser,
    isLoading: currentUserLoading,
    isError: currentUserError,
    error: currentUserLoadError,
    refetch: refetchCurrentUser,
  } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
    staleTime: 30_000,
    retry: false,
  });
  const canLoadDealsData = !!currentUser && currentUser.workspaceMode !== 'comercio';

  const stagesQuery = useQuery({
    queryKey: ['dealStages'],
    queryFn: getDealStages,
    enabled: canLoadDealsData,
    retry: false,
  });
  const stages = stagesQuery.data ?? [];

  const dealsQuery = useQuery({
    queryKey: ['deals'],
    queryFn: () => getDeals('aberto'),
    enabled: canLoadDealsData,
    retry: false,
  });
  const deals = dealsQuery.data ?? [];

  const dealsLoadError =
    currentUserLoadError || stagesQuery.error || dealsQuery.error;

  const refetchDealsData = () => {
    if (currentUserError) {
      refetchCurrentUser();
      return;
    }

    stagesQuery.refetch();
    dealsQuery.refetch();
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      {/* Toggle modo */}
      <div className="flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-xl w-fit shadow-sm">
        <Link
          href="/pipeline"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-[#6b7e9a] hover:bg-slate-50 hover:text-[#0A2540] transition-colors"
        >
          <User className="w-4 h-4" />
          Cliente Individual
        </Link>
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#0A2540] text-white shadow-sm">
          <Building2 className="w-4 h-4" />
          Empresa
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#2c2f31]">Negociações</h1>
          <p className="mt-1 text-sm text-[#6b7e9a]">
            Acompanha as negociações B2B por fase com gestão rápida de oportunidades.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto lg:items-end">
          <Button
            variant="outline"
            onClick={() => setIsStageManagerOpen(true)}
            disabled={currentUserLoading || Boolean(dealsLoadError)}
            className="w-full border-slate-200 bg-white sm:w-auto"
          >
            <Settings2 className="w-4 h-4 mr-2" />
            Gerir Fases
          </Button>
          <Button
            className="w-full sm:w-auto"
            onClick={() => setIsNewDealOpen(true)}
            disabled={currentUserLoading || Boolean(dealsLoadError)}
          >
            + Nova Negociação
          </Button>
        </div>
      </div>

      {currentUserLoading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-[#6b7e9a] shadow-sm">
          A carregar Negociações...
        </div>
      ) : dealsLoadError ? (
        <ErrorState
          title="Falha ao carregar Negociações"
          message={getApiErrorMessage(
            dealsLoadError,
            'Não foi possível carregar fases ou negociações.'
          )}
          onRetry={refetchDealsData}
        />
      ) : deals.length === 0 ? (
        <EmptyState
          icon={Handshake}
          title="Ainda não há negociações"
          description="Cria a tua primeira negociação para começares a acompanhar oportunidades B2B por fase."
        />
      ) : (
        <div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
          <DealsKanbanBoard deals={deals} stages={stages} />
        </div>
      )}

      <DealStageManager
        open={isStageManagerOpen}
        onClose={() => setIsStageManagerOpen(false)}
      />

      <NewDealDialog
        open={isNewDealOpen}
        onClose={() => setIsNewDealOpen(false)}
      />
    </div>
  );
}
