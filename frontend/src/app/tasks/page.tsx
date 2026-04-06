'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCurrentUser, getTasks, updateTask, deleteTask } from '@/lib/api';
import { Task } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import TaskItem from '@/components/tasks/task-item';
import TaskFormModal from '@/components/tasks/task-form-modal';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterBar } from '@/components/ui/filter-bar';
import { isSameDay, isPast, parseISO } from 'date-fns';
import { Plus, ClipboardList } from 'lucide-react';
import { canDelete } from '@/lib/permissions';
import { useToast } from '@/components/ui/toast-provider';

type FilterType = 'todas' | 'hoje' | 'atrasadas' | 'concluidas';

export default function TasksPage() {
  const [filter, setFilter] = useState<FilterType>('todas');
  const [search, setSearch] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [settlingTaskIds, setSettlingTaskIds] = useState<number[]>([]);
  const [pendingToggleIds, setPendingToggleIds] = useState<number[]>([]);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<number[]>([]);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: getCurrentUser,
  });

  const { data: allTasks = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => getTasks(),
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, done }: { id: number; done: boolean }) => updateTask(id, { done }),
    onMutate: async ({ id, done }) => {
      setPendingToggleIds((prev) => [...prev, id]);
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      const previous = queryClient.getQueryData<Task[]>(['tasks']);
      queryClient.setQueryData<Task[]>(['tasks'], (old = []) =>
        old.map((t) => (t.id === id ? { ...t, done } : t))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['tasks'], context.previous);
      toast({
        variant: 'error',
        title: 'Não foi possível atualizar a tarefa',
        description: 'Tenta novamente.',
      });
    },
    onSettled: (_data, _error, variables) => {
      setPendingToggleIds((prev) => prev.filter((taskId) => taskId !== variables.id));
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (id: number) => deleteTask(id),
    onMutate: async (id) => {
      setPendingDeleteIds((prev) => [...prev, id]);
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      const previous = queryClient.getQueryData<Task[]>(['tasks']);
      queryClient.setQueryData<Task[]>(['tasks'], (old = []) => old.filter((t) => t.id !== id));
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['tasks'], context.previous);
      toast({
        variant: 'error',
        title: 'Não foi possível eliminar a tarefa',
        description: 'Tenta novamente.',
      });
    },
    onSettled: (_data, _error, id) => {
      setPendingDeleteIds((prev) => prev.filter((taskId) => taskId !== id));
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const filterTasks = (): Task[] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const q = search.toLowerCase().trim();

    return allTasks.filter((task) => {
      // text search
      if (q && !task.title.toLowerCase().includes(q) && !(task.notes ?? '').toLowerCase().includes(q) && !(task.contact?.name ?? '').toLowerCase().includes(q)) return false;
      if (filter === 'concluidas') return task.done;
      if (filter === 'todas') return true;
      if (!task.dueDate) return false;
      const due = parseISO(task.dueDate);
      const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
      if (filter === 'hoje') return isSameDay(dueDay, today);
      if (filter === 'atrasadas') return isPast(dueDay) && !isSameDay(dueDay, today);
      return false;
    });
  };

  const filtered = filterTasks();
  const pendingTasks = useMemo(
    () => filtered.filter((task) => !task.done || settlingTaskIds.includes(task.id)),
    [filtered, settlingTaskIds]
  );
  const completedTasks = useMemo(
    () => filtered.filter((task) => task.done && !settlingTaskIds.includes(task.id)),
    [filtered, settlingTaskIds]
  );
  const mixedView = filter !== 'concluidas';
  const canDeleteTasks = currentUser ? canDelete(currentUser) : false;

  // Stats
  const pending = allTasks.filter((t) => !t.done).length;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const overdueCount = allTasks.filter((t) => {
    if (t.done || !t.dueDate) return false;
    const d = parseISO(t.dueDate);
    const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return isPast(dd) && !isSameDay(dd, today);
  }).length;
  const todayCount = allTasks.filter((t) => {
    if (t.done || !t.dueDate) return false;
    const d = parseISO(t.dueDate);
    const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return isSameDay(dd, today);
  }).length;

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setIsFormOpen(true);
  };

  const handleClose = () => {
    setIsFormOpen(false);
    setEditingTask(null);
  };

  const handleToggleDone = (id: number, done: boolean) => {
    if (done && filter !== 'concluidas') {
      setSettlingTaskIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
      window.setTimeout(() => {
        setSettlingTaskIds((prev) => prev.filter((taskId) => taskId !== id));
      }, 520);
    } else {
      setSettlingTaskIds((prev) => prev.filter((taskId) => taskId !== id));
    }

    updateTaskMutation.mutate({ id, done });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#2c2f31]">Tarefas</h1>
          <p className="mt-1 text-sm text-[#6b7e9a]">Agenda, prioridades e execução diária da equipa.</p>
        </div>
        <Button className="w-full sm:w-auto" data-tour="tasks-new" onClick={() => { setEditingTask(null); setIsFormOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Tarefa
        </Button>
      </div>

      <div data-tour="tasks-stats" className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <button
          onClick={() => setFilter('todas')}
          className={`rounded-2xl border p-4 text-left shadow-sm transition-all ${filter === 'todas' ? 'border-[var(--workspace-primary)] bg-[var(--workspace-primary)] text-[var(--workspace-on-primary)]' : 'border-slate-200 bg-white text-[#0A2540] hover:bg-[#F8FAFC]'}`}
        >
          <div className={`text-2xl font-bold`}>{pending}</div>
          <div className={`text-xs mt-0.5 ${filter === 'todas' ? 'text-white/70' : 'text-[#6b7e9a]'}`}>Pendentes</div>
        </button>
        <button
          onClick={() => setFilter('hoje')}
          className={`rounded-2xl border p-4 text-left shadow-sm transition-all ${filter === 'hoje' ? 'border-sky-600 bg-sky-600 text-white' : 'border-slate-200 bg-white text-[#0A2540] hover:bg-[#F8FAFC]'}`}
        >
          <div className="text-2xl font-bold">{todayCount}</div>
          <div className={`text-xs mt-0.5 ${filter === 'hoje' ? 'text-white/70' : 'text-[#6b7e9a]'}`}>Para hoje</div>
        </button>
        <button
          onClick={() => setFilter('atrasadas')}
          className={`rounded-2xl border p-4 text-left shadow-sm transition-all ${filter === 'atrasadas' ? 'border-red-500 bg-red-500 text-white' : 'border-slate-200 bg-white text-[#0A2540] hover:bg-[#F8FAFC]'}`}
        >
          <div className="text-2xl font-bold">{overdueCount}</div>
          <div className={`text-xs mt-0.5 ${filter === 'atrasadas' ? 'text-white/70' : 'text-[#6b7e9a]'}`}>Atrasadas</div>
        </button>
      </div>

      {/* Filter bar */}
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        placeholder="Pesquisar tarefas..."
        hasActiveFilters={!!search || filter !== 'todas'}
        onClearFilters={() => { setSearch(''); setFilter('todas'); }}
        className="mb-4"
      >
        <Select value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="hoje">Hoje</SelectItem>
            <SelectItem value="atrasadas">Atrasadas</SelectItem>
            <SelectItem value="concluidas">Concluídas</SelectItem>
          </SelectContent>
        </Select>
      </FilterBar>
      <p className="mb-4 text-sm text-[#6b7e9a]">
        {filtered.length} {filter === 'concluidas' ? 'concluída' : 'tarefa'}{filtered.length !== 1 ? 's' : ''}
      </p>

      {/* Task list */}
      <Card data-tour="tasks-list" className="border-slate-200 shadow-sm">
        <CardContent className="p-4">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-20 animate-pulse rounded-2xl bg-slate-100" />
              ))}
            </div>
          ) : isError ? (
            <ErrorState
              title="Não foi possível carregar as tarefas"
              message="A lista de tarefas não respondeu como esperado."
              onRetry={() => refetch()}
              secondaryAction={{ label: 'Ir para Painel', href: '/' }}
            />
          ) : filtered.length > 0 ? (
            <div className="space-y-4">
              {mixedView && completedTasks.length > 0 && (
                <div className="flex items-center justify-between rounded-2xl bg-[#F8FAFC] px-4 py-2 text-xs font-medium text-[#64748B]">
                  <span>{pendingTasks.length} pendente{pendingTasks.length !== 1 ? 's' : ''}</span>
                  <span>{completedTasks.length} concluída{completedTasks.length !== 1 ? 's' : ''}</span>
                </div>
              )}

              {pendingTasks.length > 0 && (
                <div className="space-y-2">
                  {pendingTasks.map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onToggleDone={handleToggleDone}
                      onEdit={handleEdit}
                      onDelete={(id) => deleteTaskMutation.mutate(id)}
                      isLoading={pendingToggleIds.includes(task.id) || pendingDeleteIds.includes(task.id)}
                      canDelete={canDeleteTasks}
                      isSettlingDone={task.done && settlingTaskIds.includes(task.id)}
                    />
                  ))}
                </div>
              )}

              {completedTasks.length > 0 && (
                <div className="space-y-3">
                  {mixedView && (
                    <div className="flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#94A3B8]">
                      <span className="h-px flex-1 bg-[#E2E8F0]" />
                      Concluídas
                      <span className="h-px flex-1 bg-[#E2E8F0]" />
                    </div>
                  )}
                  <div className="space-y-2">
                    {completedTasks.map((task) => (
                      <TaskItem
                        key={task.id}
                        task={task}
                        onToggleDone={handleToggleDone}
                        onEdit={handleEdit}
                        onDelete={(id) => deleteTaskMutation.mutate(id)}
                        isLoading={pendingToggleIds.includes(task.id) || pendingDeleteIds.includes(task.id)}
                        canDelete={canDeleteTasks}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <EmptyState
              variant={search ? 'no-results' : 'empty'}
              icon={ClipboardList}
              title={
                search ? 'Sem resultados' :
                filter === 'todas' ? 'Nenhuma tarefa pendente' :
                filter === 'hoje' ? 'Nenhuma tarefa para hoje' :
                filter === 'atrasadas' ? 'Nenhuma tarefa atrasada' :
                'Nenhuma tarefa concluída'
              }
              description={
                search ? `Nenhuma tarefa corresponde a "${search}".` :
                filter === 'todas' ? 'Cria a primeira tarefa para começar a gerir a agenda da equipa.' :
                filter === 'hoje' ? 'Não há tarefas agendadas para hoje.' :
                filter === 'atrasadas' ? 'Tudo em dia! Não há tarefas em atraso.' :
                undefined
              }
              action={!search && filter === 'todas' ? {
                label: 'Criar primeira tarefa',
                onClick: () => { setEditingTask(null); setIsFormOpen(true); },
              } : undefined}
              compact
            />
          )}
        </CardContent>
      </Card>

      <TaskFormModal
        open={isFormOpen}
        onClose={handleClose}
        task={editingTask}
      />
    </div>
  );
}
