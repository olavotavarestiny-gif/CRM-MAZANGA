'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getContacts, updateContact, getPipelineStages, getCurrentUser } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import KanbanBoard from '@/components/pipeline/kanban-board';
import PipelineStageManager from '@/components/pipeline/pipeline-stage-manager';
import PipelineAnalyticsView from '@/components/pipeline/pipeline-analytics-view';
import { EmptyState } from '@/components/ui/empty-state';
import { Settings2, Users } from 'lucide-react';

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

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
    staleTime: 30_000,
  });

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

  const { data: stages = [] } = useQuery({
    queryKey: ['pipeline-stages'],
    queryFn: getPipelineStages,
  });

  const { data: pipelineContacts = [] } = useQuery({
    queryKey: ['contacts', 'pipeline'],
    queryFn: () => getContacts({ inPipeline: 'true' }),
  });

  const { data: availableContacts = [] } = useQuery({
    queryKey: ['contacts', 'available'],
    queryFn: () => getContacts({ inPipeline: 'false' }),
  });

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
    c.company.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pageTitle = activeTab === 'analytics' ? 'Processos e Analytics' : 'Negociações';
  const pageDescription = activeTab === 'analytics'
    ? 'Pipeline visual e analytics avançado no mesmo módulo.'
    : 'Pipeline visual por etapas com gestão rápida de oportunidades.';

  const tabButtonClass = (tab: 'pipeline' | 'analytics') =>
    activeTab === tab
      ? 'bg-[#0A2540] text-white shadow-sm'
      : 'text-[#6b7e9a] hover:bg-slate-100 hover:text-[#0A2540]';

  const changeTab = (tab: 'pipeline' | 'analytics') => {
    setActiveTab(tab);
    router.replace(tab === 'analytics' ? '/pipeline?tab=analytics' : '/pipeline');
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#2c2f31]">{pageTitle}</h1>
          <p className="mt-1 text-sm text-[#6b7e9a]">
            {pageDescription}
          </p>
        </div>
        <div className="flex flex-col gap-3 lg:items-end">
          <div className="inline-flex items-center gap-1 rounded-2xl border border-[#dde3ec] bg-white p-1">
            <button
              type="button"
              onClick={() => changeTab('pipeline')}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${tabButtonClass('pipeline')}`}
            >
              Pipeline
            </button>
            {canSeeAnalytics ? (
              <button
                type="button"
                onClick={() => changeTab('analytics')}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${tabButtonClass('analytics')}`}
              >
                Analytics
              </button>
            ) : null}
          </div>

          {activeTab === 'pipeline' ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsStageManagerOpen(true)} className="border-slate-200 bg-white">
                <Settings2 className="w-4 h-4 mr-2" />
                Gerir Etapas
              </Button>
              <Button data-tour="pipeline-add" onClick={() => setIsAddModalOpen(true)}>
                + Adicionar Contacto
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {activeTab === 'pipeline' ? (
        <div data-tour="pipeline-board" className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
          <KanbanBoard contacts={pipelineContacts} stages={stages} />
        </div>
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
            <DialogTitle>Adicionar Contacto ao Pipeline</DialogTitle>
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
                  title={searchTerm ? 'Nenhum contacto encontrado' : 'Todos os contactos estão no pipeline'}
                  description={searchTerm ? 'Tenta outro nome ou empresa.' : 'Cria novos contactos em /contactos para os adicionar ao pipeline.'}
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
