'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getContacts, updateContact, getPipelineStages } from '@/lib/api';
import { Contact } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import KanbanBoard from '@/components/pipeline/kanban-board';
import PipelineStageManager from '@/components/pipeline/pipeline-stage-manager';
import { Settings2 } from 'lucide-react';

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
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-[#0A2540]">Negociações</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsStageManagerOpen(true)}>
            <Settings2 className="w-4 h-4 mr-2" />
            Gerir Etapas
          </Button>
          <Button data-tour="pipeline-add" onClick={() => setIsAddModalOpen(true)}>
            + Adicionar Contacto
          </Button>
        </div>
      </div>

      <div data-tour="pipeline-board">
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
                <p className="text-center text-[#6b7e9a] py-8">
                  {searchTerm
                    ? 'Nenhum contacto encontrado'
                    : 'Todos os contactos estão no pipeline'}
                </p>
              ) : (
                <div className="space-y-2">
                  {filteredContacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="flex justify-between items-center p-3 border border-[#E2E8F0] rounded-lg hover:bg-[#F8FAFC]"
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
        </DialogContent>
      </Dialog>
    </div>
  );
}
