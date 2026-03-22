'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTasks, updateTask, deleteTask } from '@/lib/api';
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
import { isSameDay, isPast, parseISO } from 'date-fns';
import { Plus, ClipboardList } from 'lucide-react';

type FilterType = 'todas' | 'hoje' | 'atrasadas' | 'concluidas';

export default function TasksPage() {
  const [filter, setFilter] = useState<FilterType>('todas');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const queryClient = useQueryClient();

  const { data: allTasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => getTasks(),
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, done }: { id: number; done: boolean }) => updateTask(id, { done }),
    onMutate: async ({ id, done }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      const previous = queryClient.getQueryData<Task[]>(['tasks']);
      queryClient.setQueryData<Task[]>(['tasks'], (old = []) =>
        old.map((t) => (t.id === id ? { ...t, done } : t))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['tasks'], context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (id: number) => deleteTask(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      const previous = queryClient.getQueryData<Task[]>(['tasks']);
      queryClient.setQueryData<Task[]>(['tasks'], (old = []) => old.filter((t) => t.id !== id));
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['tasks'], context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const filterTasks = (): Task[] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return allTasks.filter((task) => {
      if (filter === 'concluidas') return task.done;
      if (task.done) return false; // exclude done from other filters
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

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#0A2540]">Tarefas</h1>
          <p className="text-sm text-[#6b7e9a] mt-0.5">Agenda e gestão de tarefas</p>
        </div>
        <Button onClick={() => { setEditingTask(null); setIsFormOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Tarefa
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <button
          onClick={() => setFilter('todas')}
          className={`p-4 rounded-xl border text-left transition-all ${filter === 'todas' ? 'border-[#0A2540] bg-[#0A2540] text-white' : 'border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-[#0A2540]'}`}
        >
          <div className={`text-2xl font-bold`}>{pending}</div>
          <div className={`text-xs mt-0.5 ${filter === 'todas' ? 'text-white/70' : 'text-[#6b7e9a]'}`}>Pendentes</div>
        </button>
        <button
          onClick={() => setFilter('hoje')}
          className={`p-4 rounded-xl border text-left transition-all ${filter === 'hoje' ? 'border-blue-600 bg-blue-600 text-white' : 'border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-[#0A2540]'}`}
        >
          <div className="text-2xl font-bold">{todayCount}</div>
          <div className={`text-xs mt-0.5 ${filter === 'hoje' ? 'text-white/70' : 'text-[#6b7e9a]'}`}>Para hoje</div>
        </button>
        <button
          onClick={() => setFilter('atrasadas')}
          className={`p-4 rounded-xl border text-left transition-all ${filter === 'atrasadas' ? 'border-red-500 bg-red-500 text-white' : 'border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-[#0A2540]'}`}
        >
          <div className="text-2xl font-bold">{overdueCount}</div>
          <div className={`text-xs mt-0.5 ${filter === 'atrasadas' ? 'text-white/70' : 'text-[#6b7e9a]'}`}>Atrasadas</div>
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-[#6b7e9a]">
          {filtered.length} {filter === 'concluidas' ? 'concluída' : 'tarefa'}{filtered.length !== 1 ? 's' : ''}
        </p>
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
      </div>

      {/* Task list */}
      <Card>
        <CardContent className="p-4">
          {filtered.length > 0 ? (
            <div className="space-y-2">
              {filtered.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onToggleDone={(id, done) => updateTaskMutation.mutate({ id, done })}
                  onEdit={handleEdit}
                  onDelete={(id) => deleteTaskMutation.mutate(id)}
                  isLoading={false}
                  canDelete={true}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <ClipboardList className="w-10 h-10 text-[#dde3ec] mx-auto mb-3" />
              <p className="text-[#6b7e9a] text-sm">
                {filter === 'todas' ? 'Nenhuma tarefa pendente' :
                 filter === 'hoje' ? 'Nenhuma tarefa para hoje' :
                 filter === 'atrasadas' ? 'Nenhuma tarefa atrasada' :
                 'Nenhuma tarefa concluída'}
              </p>
              {filter === 'todas' && (
                <Button
                  size="sm"
                  className="mt-3"
                  onClick={() => { setEditingTask(null); setIsFormOpen(true); }}
                >
                  <Plus className="w-4 h-4 mr-1" /> Criar primeira tarefa
                </Button>
              )}
            </div>
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
