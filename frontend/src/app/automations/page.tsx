'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAutomations,
  updateAutomation,
  deleteAutomation,
  getCurrentUser,
} from '@/lib/api';
import type { User } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Switch } from '@/components/ui/switch';
import { Modal } from '@/components/ui/modal';
import AutomationForm from '@/components/automations/automation-form';
import { EmptyState } from '@/components/ui/empty-state';
import { Trash2, Zap } from 'lucide-react';

const TRIGGER_LABELS: Record<string, string> = {
  new_contact: 'Novo Contacto',
  form_submission: 'Submissão de Formulário',
  contact_tag: 'Contacto com Tag',
  contact_revenue: 'Contacto por Faturação',
  contact_sector: 'Contacto por Setor',
};

export default function AutomationsPage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    getCurrentUser().then(setCurrentUser).catch(() => {});
  }, []);

  const {
    data: automations = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['automations'],
    queryFn: () => getAutomations(),
    retry: false,
  });

  const toggleMutation = useMutation({
    mutationFn: (params: { id: string; active: boolean }) =>
      updateAutomation(params.id, { active: params.active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAutomation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
    },
  });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Automações</h1>
        <Button onClick={() => setIsFormOpen(true)}>Nova Automação</Button>
        <Modal open={isFormOpen} onClose={() => setIsFormOpen(false)} title="Nova Automação">
          <AutomationForm
            onSuccess={() => {
              setIsFormOpen(false);
              queryClient.invalidateQueries({ queryKey: ['automations'] });
            }}
          />
        </Modal>
      </div>

      <Card className="overflow-hidden">
        {isError ? (
          <EmptyState
            variant="empty"
            icon={Zap}
            title="Não foi possível carregar as automações"
            description="Recarrega a página para tentar novamente."
            action={{ label: 'Recarregar', onClick: () => window.location.reload() }}
          />
        ) : (
          <DataTable
            columns={[
              {
                key: 'trigger',
                header: 'Trigger',
                cell: (a) => <span className="text-sm">{TRIGGER_LABELS[a.trigger] || a.trigger}</span>,
              },
              {
                key: 'condition',
                header: 'Condição',
                responsive: 'hidden sm:table-cell',
                cell: (a) => (
                  <span className="text-xs text-gray-500">
                    {a.trigger === 'form_submission'
                      ? a.form?.title || 'Todos os formulários'
                      : a.triggerValue || '—'}
                  </span>
                ),
              },
              {
                key: 'action',
                header: 'Ação',
                cell: (a) => (
                  <span className="text-sm">
                    {a.action === 'update_stage'
                      ? `→ ${a.targetStage}`
                      : a.action === 'create_task'
                      ? 'Nova tarefa'
                      : a.action}
                  </span>
                ),
              },
              {
                key: 'detail',
                header: 'Detalhe',
                responsive: 'hidden md:table-cell',
                cell: (a) => (
                  <span className="text-xs">
                    {a.action === 'send_email'
                      ? a.emailSubject
                      : a.action === 'update_stage'
                      ? `Mover para ${a.targetStage}`
                      : a.action === 'create_task'
                      ? `${a.taskTitle || 'Sem título'}${a.taskAssignedToUserId ? ` • Resp. #${a.taskAssignedToUserId}` : ''}`
                      : a.templateName}
                  </span>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                cell: (a) => (
                  <Switch
                    checked={a.active}
                    onCheckedChange={(checked) => toggleMutation.mutate({ id: a.id, active: checked })}
                  />
                ),
              },
              {
                key: 'acoes',
                header: 'Ações',
                cell: (a) =>
                  !currentUser?.accountOwnerId ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteMutation.mutate(a.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  ) : null,
              },
            ]}
            data={automations}
            getRowKey={(a) => a.id}
            isLoading={isLoading}
            emptyTitle="Nenhuma automação criada"
            emptyDescription="Cria a primeira automação para enviar mensagens, mover contactos ou atribuir tarefas automaticamente."
            emptyAction={{ label: 'Nova Automação', onClick: () => setIsFormOpen(true) }}
          />
        )}
      </Card>
    </div>
  );
}
