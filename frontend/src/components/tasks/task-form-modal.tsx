'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createTask, updateTask, getContacts } from '@/lib/api';
import { Task } from '@/lib/types';
import {
  Dialog,
  DialogContent,
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
import { Search, X } from 'lucide-react';

interface TaskFormModalProps {
  open: boolean;
  onClose: () => void;
  task?: Task | null; // if provided = edit mode
  defaultContactId?: number;
  defaultDate?: string; // pre-fill date "YYYY-MM-DD"
}

export default function TaskFormModal({ open, onClose, task, defaultContactId, defaultDate }: TaskFormModalProps) {
  const queryClient = useQueryClient();
  const isEdit = !!task;

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<'Alta' | 'Media' | 'Baixa'>('Media');
  const [contactSearch, setContactSearch] = useState('');
  const [selectedContact, setSelectedContact] = useState<{ id: number; name: string; company: string } | null>(null);
  const [showContactList, setShowContactList] = useState(false);

  // Populate form when editing
  useEffect(() => {
    if (open) {
      if (task) {
        setTitle(task.title);
        setNotes(task.notes ?? '');
        setDueDate(task.dueDate ? task.dueDate.slice(0, 10) : '');
        setPriority(task.priority as 'Alta' | 'Media' | 'Baixa');
        setSelectedContact(task.contact ?? null);
        setContactSearch(task.contact ? task.contact.name : '');
      } else {
        setTitle('');
        setNotes('');
        setDueDate(defaultDate || '');
        setPriority('Media');
        setContactSearch('');
        setSelectedContact(null);
      }
    }
  }, [open, task]);

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
      const data = {
        title,
        notes: notes || undefined,
        dueDate: dueDate || undefined,
        priority,
        contactId: selectedContact?.id ?? null,
      };
      return isEdit ? updateTask(task!.id, data) : createTask(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
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
      <DialogContent className="max-w-md bg-white text-[#0A2540]">
        <DialogHeader>
          <DialogTitle className="text-[#0A2540]">
            {isEdit ? 'Editar Tarefa' : 'Nova Tarefa'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Título */}
          <div>
            <Label className="text-[#0A2540]">Título *</Label>
            <Input
              className="mt-1"
              placeholder="Descrição da tarefa..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          {/* Data + Prioridade em linha */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[#0A2540]">Data limite</Label>
              <Input
                type="date"
                className="mt-1"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-[#0A2540]">Prioridade</Label>
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

          {/* Notas */}
          <div>
            <Label className="text-[#0A2540]">Notas</Label>
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
            <Label className="text-[#0A2540]">Contacto <span className="text-[#6b7e9a] font-normal">(opcional)</span></Label>

            {selectedContact ? (
              <div className="mt-1 flex items-center justify-between p-2.5 border border-[#E2E8F0] rounded-lg bg-[#F8FAFC]">
                <div>
                  <p className="text-sm font-medium text-[#0A2540]">{selectedContact.name}</p>
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
                        <p className="text-sm font-medium text-[#0A2540]">{c.name}</p>
                        <p className="text-xs text-[#6b7e9a]">{c.company}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Botões */}
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!title.trim() || mutation.isPending}>
              {isEdit ? 'Guardar' : 'Criar Tarefa'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
