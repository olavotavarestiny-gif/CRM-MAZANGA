'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTasks, updateTask } from '@/lib/api';
import { Task } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import TaskItem from '@/components/tasks/task-item';
import TaskFormModal from '@/components/tasks/task-form-modal';
import WidgetWrapper from './widget-wrapper';

export default function TasksWidget() {
  const queryClient = useQueryClient();
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const {
    data: tasks = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['tasks', 'pending'],
    queryFn: () => getTasks({ done: false }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, done }: { id: number; done: boolean }) => updateTask(id, { done }),
    onMutate: async ({ id, done }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks', 'pending'] });
      const previous = queryClient.getQueryData<Task[]>(['tasks', 'pending']);
      queryClient.setQueryData<Task[]>(['tasks', 'pending'], (old = []) =>
        done ? old.filter((t) => t.id !== id) : old.map((t) => (t.id === id ? { ...t, done } : t))
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => { if (ctx?.previous) queryClient.setQueryData(['tasks', 'pending'], ctx.previous); },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setModalOpen(true);
  };

  const handleClose = () => {
    setModalOpen(false);
    setEditingTask(null);
  };

  return (
    <>
      <Card className="col-span-full rounded-xl">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base font-bold">Tarefas Pendentes</CardTitle>
          <Link href="/tasks" className="text-xs text-[#0049e6] font-semibold hover:text-[#0049e6]/80 transition-colors">Ver todas</Link>
        </CardHeader>
        <CardContent className="divide-y divide-slate-100">
          <WidgetWrapper
            title="tarefas pendentes"
            isLoading={isLoading}
            error={isError}
            isEmpty={!isLoading && !isError && tasks.length === 0}
            onRetry={() => refetch()}
            className="border-0 bg-transparent p-0"
          >
            <div className="space-y-0">
              {tasks.slice(0, 8).map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onToggleDone={(id, done) => toggleMutation.mutate({ id, done })}
                  onEdit={handleEdit}
                  onDelete={() => {}}
                  canDelete={false}
                />
              ))}
              {tasks.length > 8 && (
                <Link href="/tasks" className="text-xs text-[#0049e6] font-semibold hover:text-[#0049e6]/80 transition-colors block pt-2">
                  + {tasks.length - 8} mais tarefas
                </Link>
              )}
            </div>
          </WidgetWrapper>
        </CardContent>
      </Card>

      <TaskFormModal
        open={modalOpen}
        onClose={handleClose}
        task={editingTask}
      />
    </>
  );
}
