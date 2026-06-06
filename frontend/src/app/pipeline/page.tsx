'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getContacts, updateContact, getPipelineStages, getCurrentUser } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ErrorState } from '@/components/ui/error-state';
import KanbanBoard from '@/components/pipeline/kanban-board';
import PipelineStageManager from '@/components/pipeline/pipeline-stage-manager';
import PipelineAnalyticsView from '@/components/pipeline/pipeline-analytics-view';
import { EmptyState } from '@/components/ui/empty-state';
import { getApiErrorMessage } from '@/lib/api-error-message';
import Link from 'next/link';
import { Settings2, Users, User, Building2 } from 'lucide-react';

export default function PipelinePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isStageManagerOpen, setIsStageManagerOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const queryClient = useQueryClient();

  const requestedTab = searchParams?.get('tab');
  const [activeTab, setActiveTab] = useState<'pipeline' | 'analytics'>(
    requestedTab === 'analytics' ? 'analytics' : 'pipeline'
  );

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
  const canLoadPipelineData = !!currentUser && currentUser.workspaceMode !== 'comercio';

  const canSeeAnalytics = !!(
    currentUser &&
    currentUser.workspaceMode !== 'comercio' &&
    (currentUser.isSuperAdmin || currentUser.role === 'admin' || !currentUser.accountOwnerId)
  );

  useEffect(() => {
    if (requestedTab === 'analytics' && canSeeAnalytics) {
      setActiveTab('analytics');
      return;
    }

    setActiveTab('pipeline');
  }, [canSeeAnalytics, requestedTab]);

  const stagesQuery = useQuery({
    queryKey: ['pipeline-stages'],
    queryFn: getPipelineStages,
    enabled: canLoadPipelineData,
    retry: false,
  });
  const stages = stagesQuery.data ?? [];

  const pipelineContactsQuery = useQuery({
    queryKey: ['contacts', 'pipeline'],
    queryFn: () => getContacts({ inPipeline: 'true' }),
    enabled: canLoadPipelineData,
    retry: false,
  });
  const pipelineContacts = pipelineContactsQuery.data ?? [];

  const availableContactsQuery = useQuery({
    queryKey: ['contacts', 'available'],
    queryFn: () => getContacts({ inPipeline: 'false' }),
    enabled: canLoadPipelineData,
    retry: false,
  });
  const availableContacts = availableContactsQuery.data ?? [];

  const addMutation = useMutation({
    mutationFn: (id: number) =>
      updateContact(id.toString(), { inPipeline: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setSearchTerm('');
    },
  });

  const filteredContacts = availableContacts.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.company || '').toLowerCase().includes(searchTerm.toLowerCase())
  );
  const pipelineLoadError =
    currentUserLoadError ||
    stagesQuery.error ||
    pipelineContactsQuery.error ||
    availableContactsQuery.error;

  const refetchPipelineData = () => {
    if (currentUserError) {
      refetchCurrentUser();
      return;
    }

    stagesQuery.refetch();
    pipelineContactsQuery.refetch();
    availableContactsQuery.refetch();
  };

  const pageTitle = activeTab === 'analytics' ? 'Processos de Venda e Analytics' : 'Processos de Venda';
  const pageDescription = activeTab === 'analytics'
    ? 'Processos de venda visuais e analytics avançado no mesmo módulo.'
    : 'Processos de venda visuais por etapas com gestão rápida de oportunidades.';

  const tabButtonClass = (tab: 'pipeline' | 'analytics') =>
    activeTab === tab
      ? 'bg-[var(--workspace-primary)] text-[var(--workspace-on-primary)] shadow-sm'
      : 'text-[#6b7e9a] hover:bg-[var(--workspace-primary-soft)] hover:text-[var(--workspace-primary)]';

  const changeTab = (tab: 'pipeline' | 'analytics') => {
    setActiveTab(tab);
    router.replace(tab === 'analytics' ? '/pipeline?tab=analytics' : '/pipeline');
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      {/* Toggle modo */}
      <div className="flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-xl w-full sm:w-fit shadow-sm">
        <div className="flex flex-1 sm:flex-initial items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium bg-[#0A2540] text-white shadow-sm">
          <User className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">Cliente Individual</span>
        </div>
        <Link
          href="/negociacoes"
          className="flex flex-1 sm:flex-initial items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium text-[#6b7e9a] hover:bg-slate-50 hover:text-[#0A2540] transition-colors"
        >
          <Building2 className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">Empresa</span>
        </Link>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#2c2f31]">{pageTitle}</h1>
          <p className="mt-1 text-sm text-[#6b7e9a]">
            {pageDescription}
          </p>
        </div>
        <div className="flex flex-col gap-3 lg:items-end">
          <div className="inline-flex w-full items-center gap-1 overflow-x-auto rounded-2xl border border-[#dde3ec] bg-white p-1 lg:w-auto">
            <button
              type="button"
              onClick={() => changeTab('pipeline')}
              className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${tabButtonClass('pipeline')}`}
            >
              Processos
            </button>
            {canSeeAnalytics ? (
              <button
                type="button"
                onClick={() => changeTab('analytics')}
                className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${tabButtonClass('analytics')}`}
              >
                Analytics
              </button>
            ) : null}
          </div>

          {activeTab === 'pipeline' ? (
            <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
              <Button
                variant="outline"
                onClick={() => setIsStageManagerOpen(true)}
                disabled={currentUserLoading || Boolean(pipelineLoadError)}
                className="w-full border-slate-200 bg-white sm:w-auto"
              >
                <Settings2 className="w-4 h-4 mr-2" />
                Gerir Etapas
              </Button>
              <Button
                className="w-full sm:w-auto"
                data-tour="pipeline-add"
                onClick={() => setIsAddModalOpen(true)}
                disabled={currentUserLoading || Boolean(pipelineLoadError)}
              >
                + Adicionar aos Processos
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {currentUserLoading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-[#6b7e9a] shadow-sm">
          A carregar Processos de Venda...
        </div>
      ) : pipelineLoadError ? (
        <ErrorState
          title="Falha ao carregar Processos de Venda"
          message={getApiErrorMessage(
            pipelineLoadError,
            'Não foi possível carregar etapas ou contactos dos processos de venda.'
          )}
          onRetry={refetchPipelineData}
        />
      ) : null}

      {activeTab === 'pipeline' ? (
        !currentUserLoading && !pipelineLoadError ? (
          <div data-tour="pipeline-board" className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
            <KanbanBoard contacts={pipelineContacts} stages={stages} />
          </div>
        ) : null
      ) : (
        <PipelineAnalyticsView />
      )}

      <PipelineStageManager
        open={isStageManagerOpen}
        onClose={() => setIsStageManagerOpen(false)}
      />

      {/* Add to Pipeline Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Adicionar Contacto aos Processos de Venda</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <Input
              placeholder="Pesquisar por nome ou empresa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            <div className="max-h-96 overflow-y-auto">
              {filteredContacts.length === 0 ? (
                <EmptyState
                  variant={searchTerm ? 'no-results' : 'empty'}
                  icon={Users}
                  title={searchTerm ? 'Nenhum contacto encontrado' : 'Todos os contactos já estão em Processos de Venda'}
                  description={searchTerm ? 'Tenta outro nome ou empresa.' : 'Cria novos contactos em /contactos para os adicionar aos processos de venda.'}
                  compact
                />
              ) : (
                <div className="space-y-2">
                  {filteredContacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-3 transition-colors hover:bg-[#F8FAFC]"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-[#0A2540]">{contact.name}</p>
                        <p className="text-sm text-[#6b7e9a]">
                          {contact.company} • {contact.phone}
                        </p>
                        <p className="text-xs text-[#6b7e9a]">
                          Etapa: {contact.stage}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => {
                          addMutation.mutate(contact.id);
                          setIsAddModalOpen(false);
                        }}
                        disabled={addMutation.isPending}
                      >
                        Adicionar
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
