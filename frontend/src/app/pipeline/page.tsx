'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getContacts, updateContact, getPipelineStages } from '@/lib/api';
import { Contact } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import KanbanBoard from '@/components/pipeline/kanban-board';
import PipelineStageManager from '@/components/pipeline/pipeline-stage-manager';
import { EmptyState } from '@/components/ui/empty-state';
import { Settings2, Users } from 'lucide-react';

export default function PipelinePage() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isStageManagerOpen, setIsStageManagerOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const queryClient = useQueryClient();

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

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#2c2f31]">Negociações</h1>
          <p className="mt-1 text-sm text-[#6b7e9a]">
            Pipeline visual por etapas com gestão rápida de oportunidades.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsStageManagerOpen(true)} className="border-slate-200 bg-white">
            <Settings2 className="w-4 h-4 mr-2" />
            Gerir Etapas
          </Button>
          <Button data-tour="pipeline-add" onClick={() => setIsAddModalOpen(true)}>
            + Adicionar Contacto
          </Button>
        </div>
      </div>

      <div data-tour="pipeline-board" className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
        <KanbanBoard contacts={pipelineContacts} stages={stages} />
      </div>

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
