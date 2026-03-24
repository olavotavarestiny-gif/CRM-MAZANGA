'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getContact, createTask, updateTask, deleteTask, updateContact,
  getContactFieldConfigs, getContactFieldDefs, getPipelineStages,
} from '@/lib/api';
import { ContactFieldConfig, ContactFieldDef } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import TaskItem from '@/components/tasks/task-item';
import { Badge } from '@/components/ui/badge';
import { Pencil, Check, X, ExternalLink } from 'lucide-react';


const SECTOR_SUGGESTIONS = [
  'Serviços','Construção','Retalho','Energia','Oil & Gas',
  'Logística','E-commerce','Telecomunicações',
];
const REVENUE_OPTIONS = [
  '- 50 Milhões De Kwanzas','Entre 50 - 100 Milhões',
  'Entre 100 Milhões - 500 Milhões','+ 500 M',
];

// ── Inline text field ──────────────────────────────────────────────────────────
function InlineField({
  label,
  value,
  onSave,
  type = 'text',
  placeholder = '—',
}: {
  label: string;
  value: string;
  onSave: (v: string) => void;
  type?: 'text' | 'email' | 'url' | 'number';
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const commit = () => {
    onSave(draft.trim());
    setEditing(false);
  };
  const cancel = () => { setDraft(value); setEditing(false); };

  const isUrl = type === 'url' || (value && value.startsWith('http'));

  return (
    <div className="group">
      <p className="text-xs text-[#6b7e9a] mb-0.5">{label}</p>
      {editing ? (
        <div className="flex items-center gap-1.5">
          <Input
            ref={inputRef}
            type={type}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }}
            className="h-8 text-sm flex-1"
          />
          <button onClick={commit} className="text-[#0A2540] hover:text-green-600 p-1"><Check className="w-4 h-4" /></button>
          <button onClick={cancel} className="text-[#6b7e9a] hover:text-red-500 p-1"><X className="w-4 h-4" /></button>
        </div>
      ) : (
        <div className="flex items-center gap-2 min-h-[28px]">
          {isUrl && value ? (
            <a href={value.startsWith('http') ? value : `https://${value}`} target="_blank" rel="noopener noreferrer"
              className="text-sm text-[#0A2540] font-medium underline decoration-[#dde3ec] hover:decoration-[#0A2540] flex items-center gap-1 truncate">
              {value} <ExternalLink className="w-3 h-3 flex-shrink-0" />
            </a>
          ) : (
            <span className={`text-sm font-medium ${value ? 'text-[#0A2540]' : 'text-[#6b7e9a] italic'}`}>
              {value || placeholder}
            </span>
          )}
          <button
            onClick={() => { setDraft(value); setEditing(true); }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-[#6b7e9a] hover:text-[#0A2540]"
          >
            <Pencil className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Combobox field (select + free text) ────────────────────────────────────────
function ComboField({
  label,
  value,
  onSave,
  suggestions,
}: {
  label: string;
  value: string;
  onSave: (v: string) => void;
  suggestions: string[];
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (editing) { inputRef.current?.focus(); setShowDropdown(true); } }, [editing]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        setEditing(false);
        setDraft(value);
      }
    };
    if (editing) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [editing, value]);

  const commit = (v?: string) => {
    const val = (v ?? draft).trim();
    onSave(val);
    setEditing(false);
    setShowDropdown(false);
  };

  const filtered = suggestions.filter(s =>
    s.toLowerCase().includes(draft.toLowerCase()) && s !== draft
  );

  return (
    <div className="group">
      <p className="text-xs text-[#6b7e9a] mb-0.5">{label}</p>
      {editing ? (
        <div ref={wrapRef} className="relative">
          <div className="flex items-center gap-1.5">
            <Input
              ref={inputRef}
              value={draft}
              onChange={(e) => { setDraft(e.target.value); setShowDropdown(true); }}
              onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setEditing(false); setDraft(value); } }}
              placeholder="Escrever ou selecionar..."
              className="h-8 text-sm flex-1"
            />
            <button onClick={() => commit()} className="text-[#0A2540] hover:text-green-600 p-1"><Check className="w-4 h-4" /></button>
            <button onClick={() => { setEditing(false); setDraft(value); }} className="text-[#6b7e9a] hover:text-red-500 p-1"><X className="w-4 h-4" /></button>
          </div>
          {showDropdown && filtered.length > 0 && (
            <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-[#dde3ec] rounded-lg shadow-lg overflow-hidden">
              {filtered.map(s => (
                <button key={s} type="button"
                  className="w-full text-left px-3 py-2 text-sm text-[#0A2540] hover:bg-[#f5f7fa] transition-colors"
                  onMouseDown={(e) => { e.preventDefault(); commit(s); }}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 min-h-[28px]">
          <span className={`text-sm font-medium ${value ? 'text-[#0A2540]' : 'text-[#6b7e9a] italic'}`}>
            {value || '—'}
          </span>
          <button
            onClick={() => { setDraft(value); setEditing(true); }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-[#6b7e9a] hover:text-[#0A2540]"
          >
            <Pencil className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Select field (fixed options) ───────────────────────────────────────────────
function SelectField({
  label,
  value,
  onSave,
  options,
}: {
  label: string;
  value: string;
  onSave: (v: string) => void;
  options: string[];
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="group">
      <p className="text-xs text-[#6b7e9a] mb-0.5">{label}</p>
      {editing ? (
        <div className="flex items-center gap-1.5">
          <Select value={value} onValueChange={(v) => { onSave(v); setEditing(false); }}>
            <SelectTrigger className="h-8 text-sm flex-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
          <button onClick={() => setEditing(false)} className="text-[#6b7e9a] hover:text-red-500 p-1"><X className="w-4 h-4" /></button>
        </div>
      ) : (
        <div className="flex items-center gap-2 min-h-[28px]">
          <span className={`text-sm font-medium ${value ? 'text-[#0A2540]' : 'text-[#6b7e9a] italic'}`}>
            {value || '—'}
          </span>
          <button
            onClick={() => setEditing(true)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-[#6b7e9a] hover:text-[#0A2540]"
          >
            <Pencil className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Tags field ─────────────────────────────────────────────────────────────────
function TagsField({
  label,
  tags,
  onSave,
}: {
  label: string;
  tags: string[];
  onSave: (tags: string[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState('');
  const [draft, setDraft] = useState<string[]>(tags);

  useEffect(() => { if (!editing) setDraft(tags); }, [tags, editing]);

  const addTag = () => {
    const v = input.trim();
    if (v && !draft.includes(v)) setDraft(prev => [...prev, v]);
    setInput('');
  };
  const removeTag = (t: string) => setDraft(prev => prev.filter(x => x !== t));
  const commit = () => { onSave(draft); setEditing(false); };

  return (
    <div className="group">
      <p className="text-xs text-[#6b7e9a] mb-1">{label}</p>
      {editing ? (
        <div className="space-y-2">
          <div className="flex gap-1.5">
            <Input value={input} onChange={e => setInput(e.target.value)} placeholder="Nova tag..."
              className="h-8 text-sm flex-1"
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } if (e.key === 'Escape') { setEditing(false); } }} />
            <Button type="button" variant="outline" size="sm" className="h-8 px-2" onClick={addTag}>+</Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {draft.map(t => (
              <span key={t} className="inline-flex items-center gap-1 bg-[#0A2540]/8 border border-[#dde3ec] rounded-full px-2.5 py-0.5 text-xs text-[#0A2540]">
                {t}
                <button type="button" onClick={() => removeTag(t)}><X className="w-3 h-3 hover:text-red-500" /></button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={commit}><Check className="w-3.5 h-3.5 mr-1" />Guardar</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2">
          <div className="flex flex-wrap gap-1.5 flex-1 min-h-[24px]">
            {tags.length > 0 ? tags.map(t => (
              <span key={t} className="inline-flex items-center bg-[#0A2540]/8 border border-[#dde3ec] rounded-full px-2.5 py-0.5 text-xs text-[#0A2540]">{t}</span>
            )) : <span className="text-sm text-[#6b7e9a] italic">—</span>}
          </div>
          <button
            onClick={() => { setDraft(tags); setEditing(true); }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-[#6b7e9a] hover:text-[#0A2540] mt-0.5 flex-shrink-0"
          >
            <Pencil className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function ContactDetailPage({ params }: { params: { id: string } }) {
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', dueDate: '', priority: 'Media', notes: '' });
  const queryClient = useQueryClient();

  const { data: contact } = useQuery({
    queryKey: ['contact', params.id],
    queryFn: () => getContact(params.id),
  });

  const { data: systemConfigs = [] } = useQuery({
    queryKey: ['contactFieldConfigs'],
    queryFn: getContactFieldConfigs,
  });

  const { data: customFieldDefs = [] } = useQuery({
    queryKey: ['contactFieldDefs'],
    queryFn: getContactFieldDefs,
  });

  const { data: pipelineStages = [] } = useQuery({
    queryKey: ['pipeline-stages'],
    queryFn: getPipelineStages,
  });

  const patchContact = useMutation({
    mutationFn: (data: Record<string, any>) => updateContact(params.id, data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact', params.id] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: (data: { title: string; dueDate?: string; priority: string; notes?: string }) =>
      createTask({ contactId: parseInt(params.id), ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact', params.id] });
      setNewTask({ title: '', dueDate: '', priority: 'Media', notes: '' });
      setIsAddTaskOpen(false);
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, done }: { id: number; done: boolean }) => updateTask(id, { done }),
    onMutate: async ({ id, done }) => {
      await queryClient.cancelQueries({ queryKey: ['contact', params.id] });
      const previous = queryClient.getQueryData(['contact', params.id]);
      queryClient.setQueryData<any>(['contact', params.id], (old: any) =>
        old ? { ...old, tasks: old.tasks.map((t: any) => t.id === id ? { ...t, done } : t) } : old
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => { if (ctx?.previous) queryClient.setQueryData(['contact', params.id], ctx.previous); },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['contact', params.id] }),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (id: number) => deleteTask(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['contact', params.id] });
      const previous = queryClient.getQueryData(['contact', params.id]);
      queryClient.setQueryData<any>(['contact', params.id], (old: any) =>
        old ? { ...old, tasks: old.tasks.filter((t: any) => t.id !== id) } : old
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => { if (ctx?.previous) queryClient.setQueryData(['contact', params.id], ctx.previous); },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['contact', params.id] }),
  });

  if (!contact) return <div className="p-6 text-[#6b7e9a]">A carregar...</div>;

  const save = (field: string, value: any) => patchContact.mutate({ [field]: value });
  const saveCustom = (key: string, value: string) =>
    patchContact.mutate({ customFields: { ...(contact.customFields ?? {}), [key]: value } });

  // Visible system fields sorted by order
  const visibleSystem = systemConfigs.filter(c => c.visible).sort((a, b) => a.order - b.order);

  const renderSystemField = (cfg: ContactFieldConfig) => {
    const key = cfg.fieldKey;
    switch (key) {
      case 'email':
        return <InlineField key={key} label={cfg.label} value={contact.email ?? ''} onSave={v => save('email', v)} type="email" />;
      case 'phone':
        return <InlineField key={key} label={cfg.label} value={contact.phone ?? ''} onSave={v => save('phone', v)} />;
      case 'company':
        return <InlineField key={key} label={cfg.label} value={contact.company ?? ''} onSave={v => save('company', v)} />;
      case 'revenue':
        return <SelectField key={key} label={cfg.label} value={contact.revenue ?? ''} onSave={v => save('revenue', v)} options={REVENUE_OPTIONS} />;
      case 'sector':
        return <ComboField key={key} label={cfg.label} value={contact.sector ?? ''} onSave={v => save('sector', v)} suggestions={SECTOR_SUGGESTIONS} />;
      case 'tags':
        return <TagsField key={key} label={cfg.label} tags={contact.tags ?? []} onSave={v => save('tags', v)} />;
      default:
        return null;
    }
  };

  const renderCustomField = (def: ContactFieldDef) => {
    const val = (contact.customFields ?? {})[def.key] ?? '';
    if (def.type === 'select') {
      return <SelectField key={def.id} label={def.label} value={val} onSave={v => saveCustom(def.key, v)} options={def.options ?? []} />;
    }
    return (
      <InlineField
        key={def.id}
        label={def.label}
        value={val}
        onSave={v => saveCustom(def.key, v)}
        type={def.type === 'number' ? 'number' : def.type === 'url' ? 'url' : def.type === 'date' ? 'text' : 'text'}
      />
    );
  };

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-3xl font-bold mb-6 text-[#0A2540]">{contact.name}</h1>

      <div className="mb-6">

        {/* Info panel */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Informações</CardTitle>
              <p className="text-xs text-[#6b7e9a] -mt-1">Passa o rato sobre um campo para editar</p>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* Name — inline editable */}
              <InlineField label="Nome" value={contact.name} onSave={v => save('name', v)} />

              {/* System fields */}
              {visibleSystem.map(cfg => renderSystemField(cfg))}

              {/* Stage — always visible, select */}
              <div>
                <p className="text-xs text-[#6b7e9a] mb-1">Etapa</p>
                <Select
                  value={contact.stage}
                  onValueChange={(v) => save('stage', v)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {pipelineStages.map(s => (
                      <SelectItem key={s.id} value={s.name}>
                        <span className="flex items-center gap-1.5">
                          <span className="inline-block w-2 h-2 rounded-full" style={{ background: s.color }} />
                          {s.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Custom fields */}
              {customFieldDefs.length > 0 && (
                <>
                  <div className="border-t border-[#dde3ec] pt-3">
                    <p className="text-xs font-semibold text-[#6b7e9a] uppercase tracking-wide mb-3">Campos personalizados</p>
                    <div className="space-y-4">
                      {customFieldDefs.map(def => renderCustomField(def))}
                    </div>
                  </div>
                </>
              )}

            </CardContent>
          </Card>
        </div>

      </div>

      {/* Tasks */}
      <Card>
        <CardHeader className="flex justify-between items-center">
          <CardTitle>Tarefas</CardTitle>
          <Button size="sm" onClick={() => setIsAddTaskOpen(true)}>+ Nova Tarefa</Button>
        </CardHeader>
        <CardContent>
          {contact.tasks && contact.tasks.length > 0 ? (
            <div className="space-y-2">
              {contact.tasks.map(task => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onToggleDone={(id, done) => updateTaskMutation.mutate({ id, done })}
                  onEdit={() => {}}
                  onDelete={(id) => deleteTaskMutation.mutate(id)}
                  isLoading={false}
                />
              ))}
            </div>
          ) : (
            <p className="text-center text-[#6b7e9a] py-8">Nenhuma tarefa</p>
          )}
        </CardContent>
      </Card>

      {/* Nova Tarefa Modal */}
      <Dialog open={isAddTaskOpen} onOpenChange={setIsAddTaskOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova Tarefa</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input placeholder="Ex: Ligar ao cliente" value={newTask.title}
                onChange={e => setNewTask({ ...newTask, title: e.target.value })} />
            </div>
            <div>
              <Label>Data Limite</Label>
              <Input type="date" value={newTask.dueDate}
                onChange={e => setNewTask({ ...newTask, dueDate: e.target.value })} />
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select value={newTask.priority} onValueChange={v => setNewTask({ ...newTask, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Alta">Alta</SelectItem>
                  <SelectItem value="Media">Média</SelectItem>
                  <SelectItem value="Baixa">Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notas</Label>
              <Input placeholder="Notas adicionais..." value={newTask.notes}
                onChange={e => setNewTask({ ...newTask, notes: e.target.value })} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setIsAddTaskOpen(false)} className="flex-1">Cancelar</Button>
              <Button onClick={() => { if (newTask.title.trim()) createTaskMutation.mutate(newTask); }}
                disabled={!newTask.title.trim() || createTaskMutation.isPending} className="flex-1">
                {createTaskMutation.isPending ? 'A criar...' : 'Criar Tarefa'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
