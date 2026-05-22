'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Task, Priority } from '@/lib/types';
import { format, isSameDay, isTomorrow, isPast, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Pencil, RotateCcw, User, Calendar, Building2, FileText } from 'lucide-react';

interface TaskDetailModalProps {
  task: Task | null;
  open: boolean;
  onClose: () => void;
  onEdit: (task: Task) => void;
  onToggleDone: (taskId: number, done: boolean) => void;
}

const PRIORITY_STYLES: Record<Priority, { dot: string; badge: string }> = {
  Alta:  { dot: 'bg-red-500',   badge: 'text-red-600 bg-red-50 border border-red-100' },
  Media: { dot: 'bg-amber-500', badge: 'text-amber-600 bg-amber-50 border border-amber-100' },
  Baixa: { dot: 'bg-green-500', badge: 'text-green-600 bg-green-50 border border-green-100' },
};

function formatDueDateFull(dueDate?: string | null): { label: string; cls: string } {
  if (!dueDate) return { label: 'Sem data definida', cls: 'text-[#94A3B8]' };
  try {
    const date = parseISO(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    let prefix = '';
    let cls = 'text-[#526277]';
    if (isSameDay(due, today)) { prefix = 'Hoje · '; cls = 'text-[var(--workspace-primary)]'; }
    else if (isTomorrow(due)) { prefix = 'Amanhã · '; cls = 'text-purple-600'; }
    else if (isPast(due)) { prefix = 'Vencida · '; cls = 'text-red-600'; }

    const dateStr = format(due, "d 'de' MMMM yyyy", { locale: ptBR });
    const hasTime = dueDate.includes('T') && !/T00:00(:00(?:\.000)?)?Z?$/.test(dueDate);
    const timeStr = hasTime ? ` às ${format(parseISO(dueDate), 'HH:mm')}` : '';
    return { label: `${prefix}${dateStr}${timeStr}`, cls };
  } catch {
    return { label: 'Data inválida', cls: 'text-[#94A3B8]' };
  }
}

export default function TaskDetailModal({
  task,
  open,
  onClose,
  onEdit,
  onToggleDone,
}: TaskDetailModalProps) {
  if (!task) return null;

  const pStyle = PRIORITY_STYLES[task.priority] ?? PRIORITY_STYLES.Media;
  const { label: dueDateLabel, cls: dueDateCls } = formatDueDateFull(task.dueDate);

  const handleEdit = () => {
    onClose();
    setTimeout(() => onEdit(task), 80);
  };

  const handleToggle = () => {
    onToggleDone(task.id, !task.done);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto bg-white text-[#2c2f31]">
        <DialogHeader className="pb-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${pStyle.badge}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${pStyle.dot}`} />
              {task.priority}
            </span>
            {task.done && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Concluída
              </span>
            )}
          </div>
          <DialogTitle
            className={`mt-2 text-lg font-bold leading-snug ${
              task.done ? 'text-[#526277] line-through decoration-[#94A3B8]' : 'text-[#0A2540]'
            }`}
          >
            {task.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Metadata grid */}
          <div className="grid grid-cols-1 gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 sm:grid-cols-2">
            {task.assignedTo && (
              <div className="flex items-start gap-2">
                <User className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#6b7e9a]" />
                <div>
                  <p className="text-xs font-medium text-[#6b7e9a]">Responsável</p>
                  <p className="text-sm font-semibold text-[#0A2540]">{task.assignedTo.name}</p>
                </div>
              </div>
            )}

            {task.contact && (
              <div className="flex items-start gap-2">
                <Building2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#6b7e9a]" />
                <div>
                  <p className="text-xs font-medium text-[#6b7e9a]">Contacto</p>
                  <p className="text-sm font-semibold text-[#0A2540]">{task.contact.name}</p>
                  {task.contact.company && (
                    <p className="text-xs text-[#6b7e9a]">{task.contact.company}</p>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-start gap-2">
              <Calendar className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#6b7e9a]" />
              <div>
                <p className="text-xs font-medium text-[#6b7e9a]">Data limite</p>
                <p className={`text-sm font-semibold ${dueDateCls}`}>{dueDateLabel}</p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Calendar className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#6b7e9a]" />
              <div>
                <p className="text-xs font-medium text-[#6b7e9a]">Criada em</p>
                <p className="text-sm font-semibold text-[#526277]">
                  {format(parseISO(task.createdAt), "d 'de' MMMM yyyy", { locale: ptBR })}
                </p>
              </div>
            </div>
          </div>

          {/* Notes section */}
          <div>
            <div className="mb-2 flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-[#6b7e9a]" />
              <span className="text-sm font-semibold text-[#0A2540]">Notas</span>
            </div>

            {task.notes ? (
              <div
                className={`
                  rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4
                  prose prose-sm max-w-none
                  prose-p:text-[#526277] prose-p:leading-relaxed prose-p:my-1
                  prose-a:text-blue-600 prose-a:underline prose-a:break-all hover:prose-a:text-blue-800
                  prose-strong:text-[#0A2540]
                  prose-em:text-[#526277]
                  prose-ul:text-[#526277] prose-ol:text-[#526277]
                  prose-li:my-0.5
                  prose-headings:text-[#0A2540] prose-headings:font-bold
                  prose-code:bg-slate-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:text-[#0A2540]
                  prose-blockquote:border-l-[var(--workspace-primary)] prose-blockquote:text-[#6b7e9a]
                `}
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    a: ({ href, children }) => (
                      <a href={href} target="_blank" rel="noopener noreferrer">
                        {children}
                      </a>
                    ),
                  }}
                >
                  {task.notes}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[#E2E8F0] px-4 py-6 text-center">
                <p className="text-sm text-[#94A3B8]">Sem notas adicionadas.</p>
                <p className="mt-0.5 text-xs text-[#B0BEC5]">
                  Clica em Editar para adicionar notas, links e mais.
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="mt-2 flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="ghost"
            className="gap-1.5 text-[#6b7e9a] hover:text-[#0A2540]"
            onClick={handleEdit}
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </Button>
          <Button
            type="button"
            variant={task.done ? 'outline' : 'default'}
            className="gap-1.5"
            onClick={handleToggle}
          >
            {task.done ? (
              <>
                <RotateCcw className="h-3.5 w-3.5" />
                Reabrir
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                Concluir
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
