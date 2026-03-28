'use client';

import { Task, Priority } from '@/lib/types';
import { format, isSameDay, isTomorrow, isPast, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Loader2, Pencil, Trash2 } from 'lucide-react';

interface TaskItemProps {
  task: Task;
  onToggleDone: (taskId: number, done: boolean) => void;
  onEdit: (task: Task) => void;
  onDelete: (taskId: number) => void;
  isLoading?: boolean;
  canDelete?: boolean;
  isSettlingDone?: boolean;
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

export default function TaskItem({
  task,
  onToggleDone,
  onEdit,
  onDelete,
  isLoading,
  canDelete = true,
  isSettlingDone = false,
}: TaskItemProps) {
  const { label: dueLabel, cls: dueCls } = formatDueDate(task.dueDate);
  const pStyle = PRIORITY_STYLES[task.priority] ?? PRIORITY_STYLES.Media;

  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border p-3 transition-[background-color,border-color,opacity,transform] duration-300 ease-out ${
        task.done
          ? 'border-emerald-200 bg-emerald-50/70 opacity-90'
          : 'border-[#E2E8F0] bg-white hover:bg-[#F8FAFC]'
      } ${isSettlingDone ? 'translate-y-0.5' : 'translate-y-0'}`}
    >
      <Checkbox
        checked={task.done}
        onCheckedChange={(checked) => onToggleDone(task.id, checked as boolean)}
        disabled={isLoading}
        className="mt-0.5"
      />

      <div className="flex-1 min-w-0">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          {task.done && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Concluída
            </span>
          )}
          {isSettlingDone && (
            <span className="inline-flex rounded-full bg-[#0A2540]/6 px-2.5 py-1 text-[11px] font-medium text-[#526277]">
              A mover para concluídas…
            </span>
          )}
          {isLoading && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-[#526277]">
              <Loader2 className="h-3 w-3 animate-spin" />
              A processar…
            </span>
          )}
        </div>
        <p
          className={`text-sm font-medium transition-[color,text-decoration-color,opacity] duration-300 ${
            task.done ? 'text-[#526277] line-through decoration-[#94A3B8]' : 'text-[#0A2540]'
          }`}
        >
          {task.title}
        </p>
        {task.notes && (
          <p className={`mt-0.5 line-clamp-2 text-xs transition-colors duration-300 ${task.done ? 'text-[#7B8798]' : 'text-[#6b7e9a]'}`}>
            {task.notes}
          </p>
        )}
        {task.contact && (
          <p className={`mt-1 flex items-center gap-1 text-xs ${task.done ? 'text-[#7B8798]' : 'text-[#6b7e9a]'}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-[#6b7e9a] inline-block" />
            {task.contact.name}
            {task.contact.company && ` · ${task.contact.company}`}
          </p>
        )}
        {task.assignedTo && (
          <p className={`mt-1 text-xs ${task.done ? 'text-[#7B8798]' : 'text-[#6b7e9a]'}`}>
            Responsável: <span className="font-medium text-[#526277]">{task.assignedTo.name}</span>
          </p>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
        {task.done && dueLabel !== 'Sem data' && (
          <span className="rounded-full border border-emerald-200 bg-white px-2 py-0.5 text-xs font-medium text-emerald-700">
            Resolvida
          </span>
        )}
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
          {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
        </Button>
      )}
      </div>
    </div>
  );
}
