'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createTask, updateTask, getContacts, getChatUsers, getCurrentUser } from '@/lib/api';
import { Task } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingButton } from '@/components/ui/loading-button';
import { useToast } from '@/components/ui/toast-provider';
import {
  canAssignTasksToAdminOwner,
  canAssignTasksToAnyOrgMember,
  isPrivilegedTaskAssignee,
} from '@/lib/permissions';
import { Search, X } from 'lucide-react';

interface TaskFormModalProps {
  open: boolean;
  onClose: () => void;
  task?: Task | null; // if provided = edit mode
  defaultContactId?: number;
  defaultDate?: string; // pre-fill date "YYYY-MM-DD"
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function splitDueDate(dueDate?: string | null): { date: string; time: string } {
  if (!dueDate) return { date: '', time: '' };
  if (!dueDate.includes('T') || /T00:00(:00(?:\.000)?)?Z?$/.test(dueDate)) {
    return { date: dueDate.slice(0, 10), time: '' };
  }

  const parsed = new Date(dueDate);
  if (Number.isNaN(parsed.getTime())) {
    return { date: dueDate.slice(0, 10), time: '' };
  }

  return {
    date: `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`,
    time: `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`,
  };
}

function buildDueDateValue(date: string, time: string): string | null {
  if (!date) return null;
  if (!time) return date;

  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  const localDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
  const offsetMinutes = -localDate.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const offsetHours = pad(Math.floor(Math.abs(offsetMinutes) / 60));
  const offsetRemainder = pad(Math.abs(offsetMinutes) % 60);

  return `${date}T${time}:00${sign}${offsetHours}:${offsetRemainder}`;
}

export default function TaskFormModal({ open, onClose, task, defaultContactId, defaultDate }: TaskFormModalProps) {
  const queryClient = useQueryClient();
  const isEdit = !!task;
  const { toast } = useToast();

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [priority, setPriority] = useState<'Alta' | 'Media' | 'Baixa'>('Media');
  const [assignedToUserId, setAssignedToUserId] = useState<string>('');
  const [contactSearch, setContactSearch] = useState('');
  const [selectedContact, setSelectedContact] = useState<{ id: number; name: string; company: string } | null>(null);
  const [showContactList, setShowContactList] = useState(false);

  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: getCurrentUser,
  });

  const { data: teamUsers = [] } = useQuery({
    queryKey: ['chat-users'],
    queryFn: getChatUsers,
    enabled: open,
  });

  const canAssignAnyOrgMember = currentUser ? canAssignTasksToAnyOrgMember(currentUser) : false;
  const canAssignAdminOwnerTargets = currentUser ? canAssignTasksToAdminOwner(currentUser) : false;
  const assignableUsers = useMemo(() => {
    if (!currentUser) return [];
    if (canAssignAnyOrgMember) return teamUsers;
    if (canAssignAdminOwnerTargets) {
      return teamUsers.filter((user) => user.id === currentUser.id || isPrivilegedTaskAssignee(user));
    }
    return teamUsers.filter((user) => user.id === currentUser.id);
  }, [canAssignAdminOwnerTargets, canAssignAnyOrgMember, currentUser, teamUsers]);

  const assigneeHelperText = canAssignAnyOrgMember
    ? 'Podes atribuir tarefas a qualquer utilizador ativo da organização.'
    : canAssignAdminOwnerTargets
      ? 'Podes atribuir tarefas a ti mesmo, a administradores e ao dono da conta.'
      : 'Nesta conta, só podes atribuir tarefas a ti mesmo.';

  // Populate form when editing
  useEffect(() => {
    if (open) {
      if (task) {
        const { date, time } = splitDueDate(task.dueDate);
        setTitle(task.title);
        setNotes(task.notes ?? '');
        setDueDate(date);
        setDueTime(time);
        setPriority(task.priority as 'Alta' | 'Media' | 'Baixa');
        setAssignedToUserId(task.assignedToUserId ? String(task.assignedToUserId) : currentUser?.id ? String(currentUser.id) : '');
        setSelectedContact(task.contact ?? null);
        setContactSearch(task.contact ? task.contact.name : '');
      } else {
        setTitle('');
        setNotes('');
        setDueDate(defaultDate || '');
        setDueTime('');
        setPriority('Media');
        setAssignedToUserId(currentUser?.id ? String(currentUser.id) : '');
        setContactSearch('');
        setSelectedContact(null);
      }
    }
  }, [open, task, currentUser?.id]);

  // Search contacts
  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts-search', contactSearch],
    queryFn: () => getContacts({ search: contactSearch }),
    enabled: showContactList && contactSearch.length > 0,
  });

  // Also pre-load default contact
  useEffect(() => {
    if (defaultContactId && !task) {
      // defaultContact should be passed in — noop here, handled by caller
    }
  }, [defaultContactId, task]);

  const mutation = useMutation({
    mutationFn: () => {
      const serializedDueDate = buildDueDateValue(dueDate, dueTime);
      const data = {
        title,
        notes: notes || undefined,
        dueDate: serializedDueDate,
        priority,
        contactId: selectedContact?.id ?? defaultContactId ?? null,
        assignedToUserId: assignedToUserId ? Number(assignedToUserId) : null,
      };
      return isEdit ? updateTask(task!.id, data) : createTask(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      if (selectedContact?.id != null) {
        queryClient.invalidateQueries({ queryKey: ['contact', String(selectedContact.id)] });
      } else if (task?.contact?.id != null) {
        queryClient.invalidateQueries({ queryKey: ['contact', String(task.contact.id)] });
      } else if (defaultContactId != null) {
        queryClient.invalidateQueries({ queryKey: ['contact', String(defaultContactId)] });
      }
      toast({
        variant: 'success',
        title: isEdit ? 'Tarefa atualizada' : 'Tarefa criada',
        description: isEdit ? 'As alterações foram guardadas.' : 'A nova tarefa já está disponível.',
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        variant: 'error',
        title: 'Não foi possível guardar a tarefa',
        description: error?.response?.data?.error || error?.message || 'Tenta novamente.',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !assignedToUserId) return;
    mutation.mutate();
  };

  const clearContact = () => {
    setSelectedContact(null);
    setContactSearch('');
  };

  const PRIORITY_STYLES = {
    Alta: 'text-red-600',
    Media: 'text-amber-600',
    Baixa: 'text-green-600',
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md bg-white text-[#2c2f31]">
        <DialogHeader>
          <DialogTitle className="text-[#2c2f31]">
            {isEdit ? 'Editar Tarefa' : 'Nova Tarefa'}
          </DialogTitle>
        </DialogHeader>

        <form id="task-form" onSubmit={handleSubmit} className="space-y-4">
          {/* Título */}
          <div>
            <Label className="text-[#2c2f31]">Título *</Label>
            <Input
              className="mt-1"
              placeholder="Descrição da tarefa..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          {/* Data + Prioridade em linha */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <Label className="text-[#2c2f31]">Data limite</Label>
              <Input
                type="date"
                className="mt-1"
                value={dueDate}
                onChange={(e) => {
                  const nextDate = e.target.value;
                  setDueDate(nextDate);
                  if (!nextDate) setDueTime('');
                }}
              />
            </div>
            <div>
              <Label className="text-[#2c2f31]">Hora <span className="text-[#6b7e9a] font-normal">(opcional)</span></Label>
              <Input
                type="time"
                className="mt-1"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                disabled={!dueDate}
              />
            </div>
            <div>
              <Label className="text-[#2c2f31]">Prioridade</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Alta">
                    <span className={PRIORITY_STYLES.Alta}>● Alta</span>
                  </SelectItem>
                  <SelectItem value="Media">
                    <span className={PRIORITY_STYLES.Media}>● Média</span>
                  </SelectItem>
                  <SelectItem value="Baixa">
                    <span className={PRIORITY_STYLES.Baixa}>● Baixa</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-[#2c2f31]">Responsável *</Label>
            <Select value={assignedToUserId} onValueChange={setAssignedToUserId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecionar responsável" />
              </SelectTrigger>
              <SelectContent>
                {assignableUsers.map((user) => (
                  <SelectItem key={user.id} value={String(user.id)}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-[#6b7e9a]">
              {assigneeHelperText}
            </p>
          </div>

          {/* Notas */}
          <div>
            <Label className="text-[#2c2f31]">Notas</Label>
            <Textarea
              className="mt-1 resize-none"
              placeholder="Detalhes adicionais..."
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Contacto (opcional) */}
          <div>
            <Label className="text-[#2c2f31]">Contacto <span className="text-[#6b7e9a] font-normal">(opcional)</span></Label>

            {selectedContact ? (
              <div className="mt-1 flex items-center justify-between p-2.5 border border-[#E2E8F0] rounded-lg bg-[#F8FAFC]">
                <div>
                  <p className="text-sm font-medium text-[#2c2f31]">{selectedContact.name}</p>
                  <p className="text-xs text-[#6b7e9a]">{selectedContact.company}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-[#6b7e9a] hover:text-red-500"
                  onClick={clearContact}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            ) : (
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b7e9a]" />
                <Input
                  className="pl-9"
                  placeholder="Pesquisar contacto..."
                  value={contactSearch}
                  onChange={(e) => { setContactSearch(e.target.value); setShowContactList(true); }}
                  onFocus={() => setShowContactList(true)}
                  onBlur={() => setTimeout(() => setShowContactList(false), 150)}
                />
                {showContactList && contactSearch.length > 0 && contacts.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-[#E2E8F0] rounded-lg shadow-md max-h-44 overflow-y-auto">
                    {contacts.slice(0, 6).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-[#F8FAFC] transition-colors"
                        onMouseDown={() => {
                          setSelectedContact({ id: c.id, name: c.name, company: c.company });
                          setContactSearch(c.name);
                          setShowContactList(false);
                        }}
                      >
                        <p className="text-sm font-medium text-[#2c2f31]">{c.name}</p>
                        <p className="text-xs text-[#6b7e9a]">{c.company}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Erro inline */}
          {mutation.isError && (
            <ErrorState
              compact
              title="Não foi possível guardar a tarefa"
              message={(mutation.error as any)?.response?.data?.error || (mutation.error as Error)?.message || 'Verifica os dados e tenta novamente.'}
              onRetry={() => mutation.mutate()}
              secondaryAction={{ label: 'Fechar', onClick: onClose }}
            />
          )}
        </form>
        <DialogFooter className="pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <LoadingButton
            type="submit"
            form="task-form"
            disabled={!title.trim() || !assignedToUserId}
            loading={mutation.isPending}
            loadingLabel={isEdit ? 'A guardar...' : 'A criar...'}
          >
            {isEdit ? 'Guardar' : 'Criar Tarefa'}
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
