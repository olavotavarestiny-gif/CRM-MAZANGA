'use client';

import { Task, Priority } from '@/lib/types';
import { format, isSameDay, isTomorrow, isPast, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';

interface TaskItemProps {
  task: Task;
  onToggleDone: (taskId: number, done: boolean) => void;
  onEdit: (task: Task) => void;
  onDelete: (taskId: number) => void;
  isLoading?: boolean;
  canDelete?: boolean;
}

const PRIORITY_STYLES: Record<Priority, { dot: string; badge: string }> = {
  Alta:  { dot: 'bg-red-500',   badge: 'text-red-600 bg-red-50 border border-red-100' },
  Media: { dot: 'bg-amber-500', badge: 'text-amber-600 bg-amber-50 border border-amber-100' },
  Baixa: { dot: 'bg-green-500', badge: 'text-green-600 bg-green-50 border border-green-100' },
};

function formatDueDate(dueDate?: string): { label: string; cls: string } {
  if (!dueDate) return { label: 'Sem data', cls: 'text-[#6b7e9a]' };
  try {
    const date = parseISO(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (isSameDay(due, today))   return { label: 'Hoje', cls: 'text-blue-600 bg-blue-50 border border-blue-100' };
    if (isTomorrow(due))         return { label: 'Amanhã', cls: 'text-purple-600 bg-purple-50 border border-purple-100' };
    if (isPast(due))             return { label: 'Vencida', cls: 'text-red-600 bg-red-50 border border-red-100' };
    return { label: format(due, 'dd MMM', { locale: ptBR }), cls: 'text-[#6b7e9a] bg-[#F8FAFC] border border-[#E2E8F0]' };
  } catch {
    return { label: 'Sem data', cls: 'text-[#6b7e9a]' };
  }
}

export default function TaskItem({ task, onToggleDone, onEdit, onDelete, isLoading, canDelete = true }: TaskItemProps) {
  const { label: dueLabel, cls: dueCls } = formatDueDate(task.dueDate);
  const pStyle = PRIORITY_STYLES[task.priority] ?? PRIORITY_STYLES.Media;

  return (
    <div className={`flex items-start gap-3 p-3 border border-[#E2E8F0] rounded-lg transition-colors ${task.done ? 'bg-[#F8FAFC]' : 'bg-white hover:bg-[#F8FAFC]'}`}>
      <Checkbox
        checked={task.done}
        onCheckedChange={(checked) => onToggleDone(task.id, checked as boolean)}
        disabled={isLoading}
        className="mt-0.5"
      />

      <div className="flex-1 min-w-0">
        <p className={`font-medium text-sm ${task.done ? 'line-through text-[#6b7e9a]' : 'text-[#0A2540]'}`}>
          {task.title}
        </p>
        {task.notes && (
          <p className="text-xs text-[#6b7e9a] mt-0.5 line-clamp-2">{task.notes}</p>
        )}
        {task.contact && (
          <p className="text-xs text-[#6b7e9a] mt-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#6b7e9a] inline-block" />
            {task.contact.name}
            {task.contact.company && ` · ${task.contact.company}`}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${dueCls}`}>
          {dueLabel}
        </span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${pStyle.badge}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${pStyle.dot}`} />
          {task.priority}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-[#6b7e9a] hover:text-[#0A2540]"
          onClick={() => onEdit(task)}
        >
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        {canDelete && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-[#6b7e9a] hover:text-red-500"
            onClick={() => onDelete(task.id)}
            disabled={isLoading}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
