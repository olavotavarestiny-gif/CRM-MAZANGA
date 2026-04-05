'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle } from 'lucide-react';
import { getAutomationLogs } from '@/lib/api';
import type { Automation, AutomationLogEntry } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

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

const dateTimeFormatter = new Intl.DateTimeFormat('pt-PT', {
  dateStyle: 'short',
  timeStyle: 'short',
});

function getExecutionBadge(success: boolean) {
  return success
    ? { label: 'Sucesso', variant: 'success' as const }
    : { label: 'Falha', variant: 'destructive' as const };
}

function getActionDetail(log: AutomationLogEntry) {
  if (log.action_type === 'update_stage') {
    return `Mover para ${String(log.action_data?.targetStage || log.automation?.targetStage || '—')}`;
  }

  if (log.action_type === 'send_email') {
    return String(log.action_data?.emailSubject || log.automation?.emailSubject || 'Sem assunto');
  }

  if (log.action_type === 'create_task') {
    return String(log.action_data?.taskTitle || log.automation?.taskTitle || 'Criar tarefa');
  }

  return String(log.action_data?.templateName || log.automation?.templateName || ACTION_LABELS[log.action_type] || log.action_type);
}

interface AutomationHistoryDrawerProps {
  automation: Automation | null;
  open: boolean;
  onClose: () => void;
}

export default function AutomationHistoryDrawer({
  automation,
  open,
  onClose,
}: AutomationHistoryDrawerProps) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<'all' | 'success' | 'failed'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    setPage(1);
    setStatus('all');
    setDateFrom('');
    setDateTo('');
  }, [automation?.id, open]);

  const logsQuery = useQuery({
    queryKey: ['automation-logs', automation?.id, page, status, dateFrom, dateTo],
    queryFn: () =>
      getAutomationLogs(automation!.id, {
        page,
        pageSize: 10,
        status,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
    enabled: open && Boolean(automation?.id),
    retry: false,
  });

  const hasActiveFilters = status !== 'all' || Boolean(dateFrom) || Boolean(dateTo);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="left-auto right-0 top-0 h-screen w-full max-w-[760px] translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-none border-l border-[#dde3ec] p-0 sm:rounded-none">
        <div className="flex h-full flex-col">
          <DialogHeader className="border-b border-[#dde3ec] px-6 py-5">
            <DialogTitle>Histórico da automação</DialogTitle>
            <DialogDescription>
              {automation
                ? `${TRIGGER_LABELS[automation.trigger] || automation.trigger} · ${ACTION_LABELS[automation.action] || automation.action}`
                : 'Consulte as execuções recentes, falhas e tempos de resposta.'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[#0A2540]">
                  {automation?.action === 'update_stage'
                    ? `Mover para ${automation.targetStage}`
                    : ACTION_LABELS[automation?.action || ''] || automation?.action}
                </h3>
                <p className="mt-1 text-sm text-[#6b7e9a]">
                  Filtre por período ou estado para rever as execuções desta automação.
                </p>
              </div>

              <Badge variant="secondary" className="px-3 py-1 text-xs">
                {logsQuery.data?.pagination.total ?? 0} execução{(logsQuery.data?.pagination.total ?? 0) !== 1 ? 'ões' : ''}
              </Badge>
            </div>

            <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-[#dde3ec] bg-[#f8fafc] p-4 sm:flex-row sm:flex-wrap sm:items-end">
              <div className="min-w-[180px] flex-1">
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.12em] text-[#6b7e9a]">
                  Estado
                </label>
                <Select
                  value={status}
                  onValueChange={(value: 'all' | 'success' | 'failed') => {
                    setStatus(value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os estados</SelectItem>
                    <SelectItem value="success">Só sucessos</SelectItem>
                    <SelectItem value="failed">Só falhas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="min-w-[160px]">
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.12em] text-[#6b7e9a]">
                  De
                </label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => {
                    setDateFrom(event.target.value);
                    setPage(1);
                  }}
                  aria-label="Data inicial"
                />
              </div>

              <div className="min-w-[160px]">
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.12em] text-[#6b7e9a]">
                  Até
                </label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(event) => {
                    setDateTo(event.target.value);
                    setPage(1);
                  }}
                  aria-label="Data final"
                />
              </div>

              {hasActiveFilters ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setStatus('all');
                    setDateFrom('');
                    setDateTo('');
                    setPage(1);
                  }}
                  className="h-10 self-start"
                >
                  Limpar filtros
                </Button>
              ) : null}
            </div>

            {logsQuery.isError ? (
              <EmptyState
                variant="empty"
                icon={AlertCircle}
                title="Não foi possível carregar o histórico"
                description="Tenta novamente dentro de instantes."
              />
            ) : (
              <DataTable
                columns={[
                  {
                    key: 'created_at',
                    header: 'Execução',
                    cell: (log) => (
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-[#0A2540]">
                          {dateTimeFormatter.format(new Date(log.created_at))}
                        </p>
                        <p className="text-xs text-[#6b7e9a]">
                          {TRIGGER_LABELS[log.trigger_type] || log.trigger_type}
                        </p>
                      </div>
                    ),
                  },
                  {
                    key: 'success',
                    header: 'Resultado',
                    cell: (log) => {
                      const badge = getExecutionBadge(log.success);

                      return (
                        <div className="space-y-2">
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                          {log.error_message ? (
                            <p className="max-w-[220px] text-xs text-red-600">{log.error_message}</p>
                          ) : null}
                        </div>
                      );
                    },
                  },
                  {
                    key: 'action',
                    header: 'Ação',
                    responsive: 'hidden md:table-cell',
                    cell: (log) => (
                      <div className="space-y-1">
                        <p className="text-sm text-[#0A2540]">
                          {ACTION_LABELS[log.action_type] || log.action_type}
                        </p>
                        <p className="max-w-[220px] text-xs text-[#6b7e9a]">{getActionDetail(log)}</p>
                      </div>
                    ),
                  },
                  {
                    key: 'contact',
                    header: 'Contacto',
                    responsive: 'hidden lg:table-cell',
                    cell: (log) => (
                      <div className="space-y-1">
                        <p className="text-sm text-[#0A2540]">{log.contact?.name || 'Sem contacto associado'}</p>
                        <p className="text-xs text-[#6b7e9a]">{log.contact?.email || log.contact?.phone || '—'}</p>
                      </div>
                    ),
                  },
                  {
                    key: 'duration_ms',
                    header: 'Duração',
                    cell: (log) => (
                      <span className="text-sm text-[#0A2540]">
                        {log.duration_ms !== null && log.duration_ms !== undefined ? `${log.duration_ms} ms` : '—'}
                      </span>
                    ),
                  },
                ]}
                data={logsQuery.data?.data || []}
                getRowKey={(log) => log.id}
                isLoading={logsQuery.isLoading}
                emptyTitle="Sem execuções registadas"
                emptyDescription="Esta automação ainda não gerou logs com os filtros actuais."
                pagination={
                  logsQuery.data
                    ? {
                        page: logsQuery.data.pagination.page,
                        pageSize: logsQuery.data.pagination.pageSize,
                        total: logsQuery.data.pagination.total,
                        onPageChange: setPage,
                      }
                    : undefined
                }
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
