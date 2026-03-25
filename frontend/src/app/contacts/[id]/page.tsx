'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getContact, createTask, updateTask, deleteTask, updateContact,
  getContactFieldConfigs, getContactFieldDefs, getPipelineStages,
  getContactNotes, createContactNote, updateContactNote, deleteContactNote,
  getContactSummary,
} from '@/lib/api';
import { ContactFieldConfig, ContactFieldDef, ContactNote } from '@/lib/types';
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
import {
  Pencil, Check, X, ExternalLink, Phone, Download, Trash2,
  Upload, Loader2, Send, FileText, TrendingUp, Clock,
} from 'lucide-react';
import { useFileUpload } from '@/hooks/use-file-upload';

const SECTOR_SUGGESTIONS = [
  'Serviços','Construção','Retalho','Energia','Oil & Gas',
  'Logística','E-commerce','Telecomunicações',
];
const REVENUE_OPTIONS = [
  '- 50 Milhões De Kwanzas','Entre 50 - 100 Milhões',
  'Entre 100 Milhões - 500 Milhões','+ 500 M',
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatWA(phone: string | undefined | null): string | null {
  if (!phone) return null;
  let n = phone.replace(/[\s\-\(\)\+]/g, '');
  if (!n.startsWith('244') && n.length <= 9) n = '244' + n;
  return n.length >= 9 ? n : null;
}

function formatKz(val: number): string {
  return val.toLocaleString('pt-AO', { minimumFractionDigits: 0 }) + ' Kz';
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(d: string): string {
  const date = new Date(d);
  return date.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' }) + ' às ' +
    date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

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

// ── Note item ──────────────────────────────────────────────────────────────────
function NoteItem({
  note,
  onUpdate,
  onDelete,
}: {
  note: ContactNote;
  onUpdate: (id: number, content: string) => void;
  onDelete: (id: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (editing) textareaRef.current?.focus(); }, [editing]);

  const commit = () => {
    if (draft.trim() && draft.trim() !== note.content) {
      onUpdate(note.id, draft.trim());
    }
    setEditing(false);
  };

  return (
    <div className="group flex gap-3 py-3 border-b border-[#f0f4f9] last:border-0">
      <div className="w-2 h-2 rounded-full bg-[#0A2540]/30 mt-2 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="space-y-2">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); }
                if (e.key === 'Escape') { setDraft(note.content); setEditing(false); }
              }}
              className="w-full text-sm text-[#0A2540] border border-[#dde3ec] rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#0A2540]/20"
              rows={3}
            />
            <div className="flex gap-2">
              <button onClick={commit} className="text-xs text-green-600 hover:text-green-700 font-medium flex items-center gap-1">
                <Check className="w-3 h-3" />Guardar
              </button>
              <button onClick={() => { setDraft(note.content); setEditing(false); }} className="text-xs text-[#6b7e9a] hover:text-red-500 font-medium flex items-center gap-1">
                <X className="w-3 h-3" />Cancelar
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-[#0A2540] whitespace-pre-wrap break-words">{note.content}</p>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-[#6b7e9a]">{formatTime(note.createdAt)}{note.user ? ` · ${note.user.name}` : ''}</span>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                <button onClick={() => { setDraft(note.content); setEditing(true); }} className="text-xs text-[#6b7e9a] hover:text-[#0A2540] flex items-center gap-0.5">
                  <Pencil className="w-3 h-3" />Editar
                </button>
                <button onClick={() => onDelete(note.id)} className="text-xs text-[#6b7e9a] hover:text-red-500 flex items-center gap-0.5">
                  <Trash2 className="w-3 h-3" />Apagar
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function ContactDetailPage({ params }: { params: { id: string } }) {
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', dueDate: '', priority: 'Media', notes: '' });
  const [noteInput, setNoteInput] = useState('');
  const [notesSkip, setNotesSkip] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { upload, uploading: fileUploading } = useFileUpload();

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

  const { data: summary } = useQuery({
    queryKey: ['contact-summary', params.id],
    queryFn: () => getContactSummary(parseInt(params.id)),
    enabled: !!contact,
  });

  const { data: notes = [] } = useQuery({
    queryKey: ['contact-notes', params.id, notesSkip],
    queryFn: () => getContactNotes(parseInt(params.id), notesSkip),
    enabled: !!contact,
  });

  const patchContact = useMutation({
    mutationFn: (data: Record<string, any>) => updateContact(params.id, data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact', params.id] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });

  const createNoteMutation = useMutation({
    mutationFn: (content: string) => createContactNote(parseInt(params.id), content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-notes', params.id] });
      setNoteInput('');
    },
  });

  const updateNoteMutation = useMutation({
    mutationFn: ({ id, content }: { id: number; content: string }) => updateContactNote(id, content),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contact-notes', params.id] }),
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (id: number) => deleteContactNote(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contact-notes', params.id] }),
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

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !contact) return;
    const result = await upload(file, 'attachments');
    if (!result) return;
    const existing: { name: string; url: string; size?: number; uploadedAt: string }[] =
      contact.documents ?? [];
    const updated = [...existing, { name: file.name, url: result.url, size: result.size, uploadedAt: new Date().toISOString() }];
    patchContact.mutate({ documents: updated });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [contact, upload, patchContact]);

  const deleteDocument = useCallback((url: string) => {
    if (!contact) return;
    const updated = (contact.documents ?? []).filter(d => d.url !== url);
    patchContact.mutate({ documents: updated });
  }, [contact, patchContact]);

  if (!contact) return <div className="p-6 text-[#6b7e9a]">A carregar...</div>;

  const save = (field: string, value: any) => patchContact.mutate({ [field]: value });
  const saveCustom = (key: string, value: string) =>
    patchContact.mutate({ customFields: { ...(contact.customFields ?? {}), [key]: value } });

  const clienteType: 'empresa' | 'particular' = (contact as any).clienteType || 'particular';
  const isEmpresa = clienteType === 'empresa';

  const visibleSystem = systemConfigs
    .filter(c => c.visible)
    .filter(c => {
      // For particulares, hide company and sector
      if (!isEmpresa && (c.fieldKey === 'company' || c.fieldKey === 'sector')) return false;
      return true;
    })
    .sort((a, b) => a.order - b.order);

  const companyConfig = systemConfigs.find(c => c.fieldKey === 'company');
  const sectorConfig = systemConfigs.find(c => c.fieldKey === 'sector');

  const waNum = formatWA(contact.phone);
  const isAtivo = (contact as any).status !== 'inativo';
  const documents: { name: string; url: string; size?: number; uploadedAt: string }[] =
    (contact as any).documents ?? [];

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
        type={def.type === 'number' ? 'number' : def.type === 'url' ? 'url' : 'text'}
      />
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold text-[#0A2540] flex-1 min-w-0">{contact.name}</h1>

        {/* Tipo de cliente badge */}
        <button
          onClick={() => save('clienteType', isEmpresa ? 'particular' : 'empresa')}
          title="Clique para alternar tipo"
          className={`text-xs font-semibold px-3 py-1 rounded-full border transition-colors ${
            isEmpresa
              ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
              : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
          }`}
        >
          {isEmpresa ? 'Empresa' : 'Particular'}
        </button>

        {/* Status badge */}
        <button
          onClick={() => save('status', isAtivo ? 'inativo' : 'ativo')}
          className={`text-xs font-semibold px-3 py-1 rounded-full border transition-colors ${
            isAtivo
              ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
              : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
          }`}
        >
          {isAtivo ? '● Ativo' : '○ Inativo'}
        </button>

        {/* WhatsApp button */}
        {waNum ? (
          <a
            href={`https://wa.me/${waNum}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-[#25D366] hover:bg-[#1ebe5d] text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <Phone className="w-4 h-4" />
            WhatsApp
          </a>
        ) : (
          <button disabled className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-400 text-sm font-semibold rounded-lg cursor-not-allowed opacity-60">
            <Phone className="w-4 h-4" />
            WhatsApp
          </button>
        )}
      </div>

      {/* ── Layout grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left column — Info */}
        <div className="lg:col-span-1 space-y-6">

          {/* Info panel */}
          <Card>
            <CardHeader>
              <CardTitle>Informações</CardTitle>
              <p className="text-xs text-[#6b7e9a] -mt-1">Passa o rato sobre um campo para editar</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <InlineField label="Nome" value={contact.name} onSave={v => save('name', v)} />
              {/* Force company + sector for Empresa regardless of visibility config */}
              {isEmpresa && companyConfig && (
                <InlineField label={companyConfig.label} value={contact.company ?? ''} onSave={v => save('company', v)} />
              )}
              {isEmpresa && sectorConfig && (
                <ComboField label={sectorConfig.label} value={contact.sector ?? ''} onSave={v => save('sector', v)} suggestions={SECTOR_SUGGESTIONS} />
              )}
              {/* Other visible system fields (company/sector excluded above) */}
              {visibleSystem.filter(c => c.fieldKey !== 'company' && c.fieldKey !== 'sector').map(cfg => renderSystemField(cfg))}

              <div>
                <p className="text-xs text-[#6b7e9a] mb-1">Etapa</p>
                <Select value={contact.stage} onValueChange={(v) => save('stage', v)}>
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

              {customFieldDefs.length > 0 && (
                <div className="border-t border-[#dde3ec] pt-3">
                  <p className="text-xs font-semibold text-[#6b7e9a] uppercase tracking-wide mb-3">Campos personalizados</p>
                  <div className="space-y-4">
                    {customFieldDefs.map(def => renderCustomField(def))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* History card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#6b7e9a]" />
                Histórico
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-[#f5f7fa] rounded-lg p-4">
                <p className="text-xs text-[#6b7e9a] mb-1">Total comprado</p>
                <p className="text-2xl font-bold text-[#0A2540]">
                  {summary ? formatKz(summary.totalComprado) : '—'}
                </p>
              </div>

              {summary?.ultimoServico && (
                <div>
                  <p className="text-xs text-[#6b7e9a] mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />Último serviço
                  </p>
                  <p className="text-sm font-medium text-[#0A2540]">{summary.ultimoServico.descricao}</p>
                  <p className="text-xs text-[#6b7e9a]">
                    {formatDate(summary.ultimoServico.data)} · {formatKz(summary.ultimoServico.valor)}
                  </p>
                </div>
              )}

              {summary && summary.transacoes.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-[#6b7e9a] uppercase tracking-wide mb-2">Últimas transações</p>
                  <div className="space-y-2">
                    {summary.transacoes.map((t: any) => (
                      <div key={t.id} className="flex justify-between items-center text-sm">
                        <span className="text-[#0A2540] truncate flex-1 mr-2">{t.description || t.descricao || '—'}</span>
                        <span className="text-green-600 font-medium flex-shrink-0">{formatKz(t.amountKz ?? t.amount ?? 0)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(!summary || (summary.transacoes.length === 0 && !summary.ultimoServico)) && (
                <p className="text-sm text-[#6b7e9a] text-center py-2">Sem histórico de compras</p>
              )}
            </CardContent>
          </Card>

        </div>

        {/* Right column — Notes + Documents + Tasks */}
        <div className="lg:col-span-2 space-y-6">

          {/* Notes card */}
          <Card>
            <CardHeader>
              <CardTitle>Notas</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Input */}
              <div className="flex gap-2 mb-4">
                <textarea
                  value={noteInput}
                  onChange={e => setNoteInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (noteInput.trim()) createNoteMutation.mutate(noteInput.trim());
                    }
                  }}
                  placeholder="Adicionar nota... (Enter para guardar, Shift+Enter para nova linha)"
                  className="flex-1 text-sm border border-[#dde3ec] rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#0A2540]/20 min-h-[72px]"
                  rows={3}
                />
                <button
                  onClick={() => { if (noteInput.trim()) createNoteMutation.mutate(noteInput.trim()); }}
                  disabled={!noteInput.trim() || createNoteMutation.isPending}
                  className="flex-shrink-0 self-end p-2 bg-[#0A2540] text-white rounded-lg hover:bg-[#0A2540]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>

              {/* Notes list */}
              {notes.length > 0 ? (
                <div>
                  {notes.map(note => (
                    <NoteItem
                      key={note.id}
                      note={note}
                      onUpdate={(id, content) => updateNoteMutation.mutate({ id, content })}
                      onDelete={(id) => deleteNoteMutation.mutate(id)}
                    />
                  ))}
                  {notes.length === 10 && (
                    <button
                      onClick={() => setNotesSkip(prev => prev + 10)}
                      className="mt-3 text-sm text-[#0A2540] hover:underline"
                    >
                      Ver mais →
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-center text-[#6b7e9a] text-sm py-4">Nenhuma nota ainda</p>
              )}
            </CardContent>
          </Card>

          {/* Documents card */}
          <Card>
            <CardHeader className="flex justify-between items-center">
              <CardTitle>Documentos</CardTitle>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="sr-only"
                  accept="image/*,application/pdf,application/vnd.openxmlformats-officedocument.*,.doc,.docx,.xls,.xlsx"
                  onChange={handleFileUpload}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={fileUploading}
                >
                  {fileUploading ? (
                    <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />A enviar...</>
                  ) : (
                    <><Upload className="w-4 h-4 mr-1.5" />Adicionar</>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {documents.length > 0 ? (
                <div className="space-y-2">
                  {documents.map((doc, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 rounded-lg border border-[#dde3ec] hover:bg-[#f5f7fa] transition-colors group">
                      <FileText className="w-5 h-5 text-[#6b7e9a] flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#0A2540] truncate">{doc.name}</p>
                        <p className="text-xs text-[#6b7e9a]">
                          {doc.size ? formatFileSize(doc.size) + ' · ' : ''}{formatDate(doc.uploadedAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-[#6b7e9a] hover:text-[#0A2540] rounded transition-colors"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                        <button
                          onClick={() => deleteDocument(doc.url)}
                          className="p-1.5 text-[#6b7e9a] hover:text-red-500 rounded transition-colors opacity-0 group-hover:opacity-100"
                          title="Apagar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-[#dde3ec] rounded-lg cursor-pointer hover:bg-[#f5f7fa] transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-8 h-8 text-[#6b7e9a] mb-2" />
                  <p className="text-sm text-[#6b7e9a]">Arraste ou clique para adicionar documentos</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tasks card */}
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

        </div>
      </div>

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
