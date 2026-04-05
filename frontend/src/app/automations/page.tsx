'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteAutomation,
  getAutomationStats,
  getAutomations,
  getCurrentUser,
  updateAutomation,
} from '@/lib/api';
import type { User } from '@/lib/api';
import type { Automation, AutomationLogEntry } from '@/lib/types';
import AutomationHistoryDrawer from '@/components/automations/automation-history-drawer';
import AutomationForm from '@/components/automations/automation-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Modal } from '@/components/ui/modal';
import { Switch } from '@/components/ui/switch';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  History,
  Trash2,
  Zap,
} from 'lucide-react';

const TRIGGER_LABELS: Record<string, string> = {
  new_contact: 'Novo Contacto',
  form_submission: 'Submissão de Formulário',
  contact_tag: 'Contacto com Tag',
  contact_revenue: 'Contacto por Faturação',
  contact_sector: 'Contacto por Setor',
};

const ACTION_LABELS: Record<string, string> = {
  send_email: 'Enviar email',
  send_whatsapp_template: 'Template WhatsApp',
  send_whatsapp_text: 'Mensagem WhatsApp',
  update_stage: 'Mover etapa',
  create_task: 'Criar tarefa',
};

const percentFormatter = new Intl.NumberFormat('pt-PT', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

const integerFormatter = new Intl.NumberFormat('pt-PT');

const dateTimeFormatter = new Intl.DateTimeFormat('pt-PT', {
  dateStyle: 'short',
  timeStyle: 'short',
});

function formatRate(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return '—';
  }

  return `${percentFormatter.format(value)}%`;
}

function getLastExecutionBadge(automation: Automation) {
  const lastExecution = automation.executionSummary?.lastExecution;

  if (!lastExecution) {
    return { label: 'Nunca executou', variant: 'secondary' as const };
  }

  return lastExecution.success
    ? { label: 'Sucesso', variant: 'success' as const }
    : { label: 'Falha', variant: 'destructive' as const };
}

function getAutomationActionDetail(automation: Automation) {
  if (automation.action === 'update_stage') {
    return `Mover para ${automation.targetStage}`;
  }

  if (automation.action === 'create_task') {
    return automation.taskTitle || 'Criar tarefa';
  }

  if (automation.action === 'send_email') {
    return automation.emailSubject || 'Sem assunto';
  }

  return automation.templateName || ACTION_LABELS[automation.action] || automation.action;
}

function renderRecentExecutionItem(log: AutomationLogEntry) {
  const triggerLabel = TRIGGER_LABELS[log.trigger_type] || log.trigger_type;
  const actionLabel = ACTION_LABELS[log.action_type] || log.action_type;

  return (
    <div
      key={log.id}
      className="flex items-start justify-between gap-3 rounded-2xl border border-[#dde3ec] bg-white px-4 py-3"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-[#0A2540]">
          {log.contact?.name || triggerLabel}
        </p>
        <p className="truncate text-xs text-[#6b7e9a]">
          {actionLabel} · {triggerLabel}
        </p>
      </div>
      <div className="text-right">
        <Badge variant={log.success ? 'success' : 'destructive'}>
          {log.success ? 'Sucesso' : 'Falha'}
        </Badge>
        <p className="mt-1 text-xs text-[#6b7e9a]">
          {dateTimeFormatter.format(new Date(log.created_at))}
        </p>
      </div>
    </div>
  );
}

export default function AutomationsPage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedAutomationId, setSelectedAutomationId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const statsFilters = useMemo(
    () => ({
      dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    }),
    []
  );

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

  const statsQuery = useQuery({
    queryKey: ['automation-stats', statsFilters],
    queryFn: () => getAutomationStats(statsFilters),
    retry: false,
  });

  const refreshAutomationData = () => {
    queryClient.invalidateQueries({ queryKey: ['automations'] });
    queryClient.invalidateQueries({ queryKey: ['automation-stats'] });
  };

  const toggleMutation = useMutation({
    mutationFn: (params: { id: string; active: boolean }) =>
      updateAutomation(params.id, { active: params.active }),
    onSuccess: refreshAutomationData,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAutomation,
    onSuccess: () => {
      if (selectedAutomationId) {
        setSelectedAutomationId(null);
      }
      refreshAutomationData();
    },
  });

  const selectedAutomation = automations.find((automation) => automation.id === selectedAutomationId) || null;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Automações</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#6b7e9a]">
            Acompanhe o estado de cada automação, veja falhas recentes e consulte o histórico completo de execuções.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={() => setIsFormOpen(true)}>Nova Automação</Button>
          <Modal open={isFormOpen} onClose={() => setIsFormOpen(false)} title="Nova Automação">
            <AutomationForm
              onSuccess={() => {
                setIsFormOpen(false);
                refreshAutomationData();
              }}
            />
          </Modal>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-[#d8e2f0] bg-[#f8fbff]">
          <CardHeader className="pb-3">
            <CardDescription>Taxa de sucesso dos últimos 30 dias</CardDescription>
            <CardTitle className="flex items-center gap-2 text-3xl">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              {formatRate(statsQuery.data?.successRate)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-[#6b7e9a]">
              {integerFormatter.format(statsQuery.data?.successfulExecutions || 0)} execuções com sucesso em{' '}
              {integerFormatter.format(statsQuery.data?.totalExecutions || 0)} tentativas.
            </p>
          </CardContent>
        </Card>

        <Card className="border-[#f0dfd2] bg-[#fffaf5]">
          <CardHeader className="pb-3">
            <CardDescription>Falhas identificadas</CardDescription>
            <CardTitle className="flex items-center gap-2 text-3xl">
              <AlertTriangle className="h-6 w-6 text-[#B84D0E]" />
              {integerFormatter.format(statsQuery.data?.failedExecutions || 0)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-[#6b7e9a]">
              {statsQuery.data?.mostFailingAutomations?.[0]
                ? `${ACTION_LABELS[statsQuery.data.mostFailingAutomations[0].automation.action] || statsQuery.data.mostFailingAutomations[0].automation.action} lidera as falhas recentes.`
                : 'Sem falhas registadas no período seleccionado.'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-[#dde3ec] bg-white">
          <CardHeader className="pb-3">
            <CardDescription>Automações sem execução recente</CardDescription>
            <CardTitle className="flex items-center gap-2 text-3xl">
              <Clock3 className="h-6 w-6 text-[#0A2540]" />
              {integerFormatter.format(statsQuery.data?.neverExecutedCount || 0)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-[#6b7e9a]">
              {integerFormatter.format(automations.length)} automações activas ou configuradas nesta conta.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Automações com mais falhas</CardTitle>
            <CardDescription>Top ocorrências negativas dos últimos 30 dias.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {statsQuery.data?.mostFailingAutomations?.length ? (
              statsQuery.data.mostFailingAutomations.map((entry) => (
                <div
                  key={entry.automation_id}
                  className="flex items-center justify-between rounded-2xl border border-[#dde3ec] px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#0A2540]">
                      {ACTION_LABELS[entry.automation.action] || entry.automation.action}
                    </p>
                    <p className="truncate text-xs text-[#6b7e9a]">
                      {TRIGGER_LABELS[entry.automation.trigger] || entry.automation.trigger}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-[#0A2540]">
                      {integerFormatter.format(entry.failedExecutions)} falha{entry.failedExecutions !== 1 ? 's' : ''}
                    </p>
                    <p className="text-xs text-[#6b7e9a]">{formatRate(entry.successRate)} sucesso</p>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                variant="empty"
                icon={CheckCircle2}
                title="Sem falhas recentes"
                description="As execuções dos últimos 30 dias não registaram erros."
                compact
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Últimas execuções</CardTitle>
            <CardDescription>Histórico mais recente em toda a conta.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {statsQuery.data?.recentExecutions?.length ? (
              statsQuery.data.recentExecutions.slice(0, 4).map(renderRecentExecutionItem)
            ) : (
              <EmptyState
                variant="empty"
                icon={History}
                title="Ainda sem histórico"
                description="Os logs vão aparecer aqui assim que uma automação correr."
                compact
              />
            )}
          </CardContent>
        </Card>
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
                cell: (automation) => (
                  <div className="space-y-1">
                    <span className="text-sm font-medium text-[#0A2540]">
                      {TRIGGER_LABELS[automation.trigger] || automation.trigger}
                    </span>
                    <p className="text-xs text-[#6b7e9a]">
                      {automation.trigger === 'form_submission'
                        ? automation.form?.title || 'Todos os formulários'
                        : automation.triggerValue || 'Sem condição extra'}
                    </p>
                  </div>
                ),
              },
              {
                key: 'action',
                header: 'Ação',
                cell: (automation) => (
                  <div className="space-y-1">
                    <span className="text-sm text-[#0A2540]">
                      {ACTION_LABELS[automation.action] || automation.action}
                    </span>
                    <p className="max-w-[240px] text-xs text-[#6b7e9a]">
                      {getAutomationActionDetail(automation)}
                    </p>
                  </div>
                ),
              },
              {
                key: 'executions',
                header: 'Execuções',
                responsive: 'hidden md:table-cell',
                cell: (automation) => (
                  <div className="space-y-1">
                    <span className="text-sm font-medium text-[#0A2540]">
                      {integerFormatter.format(automation.executionSummary?.totalExecutions || 0)} total
                    </span>
                    <p className="text-xs text-[#6b7e9a]">
                      {formatRate(automation.executionSummary?.successRateLast30Days)} nos últimos 30 dias
                    </p>
                  </div>
                ),
              },
              {
                key: 'lastExecution',
                header: 'Última execução',
                cell: (automation) => {
                  const badge = getLastExecutionBadge(automation);
                  const lastExecution = automation.executionSummary?.lastExecution;

                  return (
                    <div className="space-y-2">
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                      <p className="text-xs text-[#6b7e9a]">
                        {lastExecution ? dateTimeFormatter.format(new Date(lastExecution.created_at)) : 'Sem histórico'}
                      </p>
                    </div>
                  );
                },
              },
              {
                key: 'status',
                header: 'Activo',
                cell: (automation) => (
                  <Switch
                    checked={automation.active}
                    onCheckedChange={(checked) => toggleMutation.mutate({ id: automation.id, active: checked })}
                  />
                ),
              },
              {
                key: 'acoes',
                header: 'Ações',
                cell: (automation) => (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedAutomationId(automation.id)}
                      className="gap-1.5"
                    >
                      <History className="h-4 w-4" />
                      Ver histórico
                    </Button>

                    {!currentUser?.accountOwnerId ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteMutation.mutate(automation.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                ),
              },
            ]}
            data={automations}
            getRowKey={(automation) => automation.id}
            isLoading={isLoading}
            emptyTitle="Nenhuma automação criada"
            emptyDescription="Cria a primeira automação para enviar mensagens, mover contactos ou atribuir tarefas automaticamente."
            emptyAction={{ label: 'Nova Automação', onClick: () => setIsFormOpen(true) }}
          />
        )}
      </Card>

      <AutomationHistoryDrawer
        automation={selectedAutomation}
        open={Boolean(selectedAutomationId)}
        onClose={() => setSelectedAutomationId(null)}
      />
    </div>
  );
}
