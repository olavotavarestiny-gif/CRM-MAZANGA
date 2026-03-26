'use client';

import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getContacts, getTasks, updateTask } from '@/lib/api';
import { Task } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import TaskItem from '@/components/tasks/task-item';

export default function Dashboard() {
  const queryClient = useQueryClient();

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => getContacts(),
  });

  const { data: pendingTasks = [] } = useQuery({
    queryKey: ['tasks', 'pending'],
    queryFn: () => getTasks({ done: false }),
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, done }: { id: number; done: boolean }) =>
      updateTask(id, { done }),
    onMutate: async ({ id, done }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks', 'pending'] });
      const previous = queryClient.getQueryData<Task[]>(['tasks', 'pending']);
      queryClient.setQueryData<Task[]>(['tasks', 'pending'], (old = []) =>
        done ? old.filter((t) => t.id !== id) : old.map((t) => t.id === id ? { ...t, done } : t)
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['tasks', 'pending'], context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonth = contacts.filter(
    (c) => new Date(c.createdAt) >= startOfMonth && c.stage === 'Novo'
  ).length;

  const countByStage = (stage: string) =>
    contacts.filter((c) => c.stage === stage).length;

  const inPipelineCount = contacts.filter((c) => c.inPipeline).length;

  return (
    <div className="p-8">
      <h1 className="text-3xl font-extrabold mb-6 text-[#2c2f31] tracking-tight">Painel</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">
              Novos este mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{thisMonth}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">
              Qualificados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{countByStage('Qualificado')}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">
              Fechados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{countByStage('Fechado')}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">
              Nas Negociações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{inPipelineCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tarefas Pendentes */}
      <Card>
        <CardHeader className="flex justify-between items-center">
          <CardTitle>Tarefas Pendentes</CardTitle>
          <span className="text-sm text-gray-400">
            {pendingTasks.length} pendentes
          </span>
        </CardHeader>
        <CardContent>
          {pendingTasks.length > 0 ? (
            <div className="space-y-2">
              {pendingTasks.slice(0, 10).map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onToggleDone={(id, done) => {
                    updateTaskMutation.mutate({ id, done });
                  }}
                  onEdit={() => {}}
                  onDelete={() => {
                    // Eliminação não disponível no painel
                  }}
                  isLoading={false}
                />
              ))}
              {pendingTasks.length > 10 && (
                <Link
                  href="/tasks"
                  className="text-sm text-[#0A2540] hover:text-[#0d3060] block pt-2"
                >
                  Ver todas as tarefas ({pendingTasks.length})
                </Link>
              )}
            </div>
          ) : (
            <p className="text-center text-gray-400 py-8">
              Nenhuma tarefa pendente
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
