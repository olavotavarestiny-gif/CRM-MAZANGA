'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getContact, updateTask, deleteTask, updateContact,
  getContactFieldConfigs, getContactFieldDefs, getPipelineStages,
  getContactNotes, createContactNote, updateContactNote, deleteContactNote,
  getContactSummary, getContactGroups, getContactFormSubmissions,
} from '@/lib/api';
import type { ContactFieldConfig, ContactFieldDef, ContactNote, NoteAttachment, FormSubmission, Task } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import TaskItem from '@/components/tasks/task-item';
import TaskFormModal from '@/components/tasks/task-form-modal';
import { ContactHistoryTimeline } from '@/components/contacts/contact-history-timeline';
import ContactGroupsManager from '@/components/contacts/contact-groups-manager';
import {
  Pencil, Check, X, ExternalLink, Phone, Download, Trash2, ChevronDown, ChevronUp,
  Upload, Loader2, Send, FileText, TrendingUp, Clock, Paperclip, Image, ZoomIn,
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
const NO_GROUP_VALUE = '__NONE__';
const CONTACT_SYNC_LABELS: Record<FormSubmission['contactSyncStatus'], string> = {
  created: 'Criado',
  updated: 'Atualizado',
  skipped: 'Sem contacto',
};
const PRIMARY_CONTACT_FIELDS = ['name', 'phone', 'email', 'company'];

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

function normalizeDocuments(
  value: unknown
): { name: string; url: string; size?: number; uploadedAt: string }[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function getAnswerContactFieldKey(answer: FormSubmission['answers'][number]): string {
  const contactField = answer.contactField || '';
  return contactField.startsWith('standard:') ? contactField.slice('standard:'.length) : contactField;
}

function getPrimarySubmissionAnswers(submission: FormSubmission) {
  const filledAnswers = submission.answers.filter((answer) => answer.value?.trim());
  const byContactField = new Map(filledAnswers.map((answer) => [getAnswerContactFieldKey(answer), answer]));
  const primary = PRIMARY_CONTACT_FIELDS
    .map((key) => byContactField.get(key))
    .filter((answer): answer is FormSubmission['answers'][number] => Boolean(answer));
  const remaining = filledAnswers.filter((answer) => !primary.some((item) => item.id === answer.id));

  return [...primary, ...remaining].slice(0, 4);
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

// ── Helpers de ficheiros ────────────────────────────────────────────────────────
function isImage(name: string, contentType?: string): boolean {
  if (contentType?.startsWith('image/')) return true;
  return /\.(jpg|jpeg|png|gif|webp|heic|heif)$/i.test(name);
}

// ── Lightbox simples ────────────────────────────────────────────────────────────
function Lightbox({ url, name, onClose }: { url: string; name: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 text-white/70 hover:text-white"
        onClick={onClose}
      >
        <X className="w-7 h-7" />
      </button>
      <img
        src={url}
        alt={name}
        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
        onClick={e => e.stopPropagation()}
      />
      <a
        href={url}
        download={name}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-4 right-4 flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg backdrop-blur-sm transition-colors"
        onClick={e => e.stopPropagation()}
      >
        <Download className="w-4 h-4" />Download
      </a>
    </div>
  );
}

// ── Lista de anexos (usado em notas e documentos) ───────────────────────────────
function AttachmentList({
  attachments,
  onDelete,
}: {
  attachments: NoteAttachment[];
  onDelete?: (url: string) => void;
}) {
  const [lightbox, setLightbox] = useState<NoteAttachment | null>(null);
  if (attachments.length === 0) return null;

  const images = attachments.filter(a => isImage(a.name, a.contentType));
  const docs   = attachments.filter(a => !isImage(a.name, a.contentType));

  return (
    <>
      {lightbox && (
        <Lightbox url={lightbox.url} name={lightbox.name} onClose={() => setLightbox(null)} />
      )}

      {/* Galeria de imagens */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {images.map((img, i) => (
            <div key={i} className="relative group/img w-20 h-20 rounded-lg overflow-hidden border border-white/10 flex-shrink-0">
              <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/40 transition-colors flex items-center justify-center gap-1">
                <button
                  onClick={() => setLightbox(img)}
                  className="opacity-0 group-hover/img:opacity-100 transition-opacity p-1.5 bg-white/20 hover:bg-white/40 rounded-full backdrop-blur-sm"
                  title="Ver imagem"
                >
                  <ZoomIn className="w-3.5 h-3.5 text-white" />
                </button>
                {onDelete && (
                  <button
                    onClick={() => onDelete(img.url)}
                    className="opacity-0 group-hover/img:opacity-100 transition-opacity p-1.5 bg-red-500/70 hover:bg-red-500 rounded-full backdrop-blur-sm"
                    title="Remover"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-white" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lista de documentos */}
      {docs.length > 0 && (
        <div className="mt-2 space-y-1">
          {docs.map((doc, i) => (
            <div key={i} className="group/doc flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
              <FileText className="w-4 h-4 text-zinc-400 flex-shrink-0" />
              <span className="flex-1 text-xs text-zinc-300 truncate">{doc.name}</span>
              {doc.size && <span className="text-xs text-zinc-500 flex-shrink-0">{formatFileSize(doc.size)}</span>}
              <a
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 p-1 text-zinc-400 hover:text-white transition-colors"
                title="Download"
              >
                <Download className="w-3.5 h-3.5" />
              </a>
              {onDelete && (
                <button
                  onClick={() => onDelete(doc.url)}
                  className="flex-shrink-0 p-1 text-zinc-500 hover:text-red-400 transition-colors opacity-0 group-hover/doc:opacity-100"
                  title="Remover"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ── Miniatura de imagem no card Documentos ──────────────────────────────────────
function DocImageThumb({
  doc,
  onDelete,
}: {
  doc: { name: string; url: string; size?: number; uploadedAt: string };
  onDelete: (url: string) => void;
}) {
  const [lightbox, setLightbox] = useState(false);
  return (
    <>
      {lightbox && <Lightbox url={doc.url} name={doc.name} onClose={() => setLightbox(false)} />}
      <div className="relative group/thumb aspect-square rounded-lg overflow-hidden border border-white/10 bg-white/5">
        <img src={doc.url} alt={doc.name} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/0 group-hover/thumb:bg-black/50 transition-colors" />
        <div className="absolute inset-0 flex items-center justify-center gap-1.5 opacity-0 group-hover/thumb:opacity-100 transition-opacity">
          <button
            onClick={() => setLightbox(true)}
            className="p-1.5 bg-white/20 hover:bg-white/40 rounded-full backdrop-blur-sm"
            title="Ver foto"
          >
            <ZoomIn className="w-4 h-4 text-white" />
          </button>
          <a
            href={doc.url}
            download={doc.name}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 bg-white/20 hover:bg-white/40 rounded-full backdrop-blur-sm"
            title="Download"
          >
            <Download className="w-4 h-4 text-white" />
          </a>
          <button
            onClick={() => onDelete(doc.url)}
            className="p-1.5 bg-red-500/70 hover:bg-red-500 rounded-full backdrop-blur-sm"
            title="Apagar"
          >
            <Trash2 className="w-4 h-4 text-white" />
          </button>
        </div>
        <div className="absolute bottom-0 left-0 right-0 px-1.5 py-1 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover/thumb:opacity-100 transition-opacity">
          <p className="text-[10px] text-white/80 truncate">{doc.name}</p>
        </div>
      </div>
    </>
  );
}

// ── Note item ──────────────────────────────────────────────────────────────────
function NoteItem({
  note,
  onUpdate,
  onDelete,
}: {
  note: ContactNote;
  onUpdate: (id: number, content: string, attachments: NoteAttachment[]) => void;
  onDelete: (id: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (editing) textareaRef.current?.focus(); }, [editing]);

  const attachments: NoteAttachment[] = Array.isArray(note.attachments) ? note.attachments : [];

  const commit = () => {
    if (draft.trim() && draft.trim() !== note.content) {
      onUpdate(note.id, draft.trim(), attachments);
    }
    setEditing(false);
  };

  return (
    <div className="group flex gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className="w-2 h-2 rounded-full bg-gray-300 mt-2 flex-shrink-0" />
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
              className="w-full text-sm text-[#2c2f31] bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#0A2540]/30"
              rows={3}
            />
            <div className="flex gap-2">
              <button onClick={commit} className="text-xs text-green-600 hover:text-green-700 font-medium flex items-center gap-1">
                <Check className="w-3 h-3" />Guardar
              </button>
              <button onClick={() => { setDraft(note.content); setEditing(false); }} className="text-xs text-gray-400 hover:text-red-500 font-medium flex items-center gap-1">
                <X className="w-3 h-3" />Cancelar
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-[#2c2f31] whitespace-pre-wrap break-words">{note.content}</p>
            <AttachmentList attachments={attachments} />
            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-xs text-[#6b7e9a]">{formatTime(note.createdAt)}{note.user ? ` · ${note.user.name}` : ''}</span>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                <button onClick={() => { setDraft(note.content); setEditing(true); }} className="text-xs text-gray-400 hover:text-[#0A2540] flex items-center gap-0.5">
                  <Pencil className="w-3 h-3" />Editar
                </button>
                <button onClick={() => onDelete(note.id)} className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-0.5">
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

function ContactFormSubmissionsCard({ contactId }: { contactId: number }) {
  const [expandedSubmissionId, setExpandedSubmissionId] = useState<string | null>(null);
  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ['contact-form-submissions', contactId],
    queryFn: () => getContactFormSubmissions(contactId),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Formulários preenchidos</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : submissions.length === 0 ? (
          <p className="text-center text-[#6b7e9a] text-sm py-6">
            Nenhuma submissão de formulário associada a este contacto.
          </p>
        ) : (
          <div className="space-y-3">
            {submissions.map((submission) => {
              const isExpanded = expandedSubmissionId === submission.id;
              const primaryAnswers = getPrimarySubmissionAnswers(submission);

              return (
                <div key={submission.id} className="rounded-xl border border-[#dde3ec] bg-white">
                  <button
                    type="button"
                    onClick={() => setExpandedSubmissionId(isExpanded ? null : submission.id)}
                    className="w-full px-4 py-3 text-left"
                  >
                    <span className="flex flex-wrap items-start justify-between gap-3">
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-[#0A2540]">
                            {submission.form?.title || 'Formulário'}
                          </span>
                          <Badge variant="outline">{CONTACT_SYNC_LABELS[submission.contactSyncStatus]}</Badge>
                        </span>
                        <span className="mt-1 block text-xs text-[#6b7e9a]">{formatTime(submission.submittedAt)}</span>
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="mt-1 h-4 w-4 text-[#6b7e9a]" />
                      ) : (
                        <ChevronDown className="mt-1 h-4 w-4 text-[#6b7e9a]" />
                      )}
                    </span>

                    {primaryAnswers.length > 0 ? (
                      <span className="mt-3 grid gap-2 sm:grid-cols-2">
                        {primaryAnswers.map((answer) => (
                          <span key={answer.id} className="min-w-0 rounded-lg bg-[#f5f7fa] px-3 py-2">
                            <span className="block truncate text-[11px] font-semibold uppercase text-[#6b7e9a]">{answer.fieldLabel}</span>
                            <span className="mt-0.5 block truncate text-sm text-[#0A2540]">{answer.value}</span>
                          </span>
                        ))}
                      </span>
                    ) : null}
                  </button>

                  {isExpanded ? (
                    <div className="border-t border-[#dde3ec] bg-[#FAFCFF] px-4 py-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        {submission.answers.map((answer) => (
                          <div key={answer.id} className="rounded-lg border border-[#E2E8F0] bg-white p-3">
                            <div className="text-xs font-semibold uppercase tracking-wide text-[#6b7e9a]">
                              {answer.fieldLabel}
                            </div>
                            <div className="mt-1 text-sm text-[#0A2540] break-words">
                              {answer.value || '—'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function ContactDetailPage({ params }: { params: { id: string } }) {
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [isGroupsOpen, setIsGroupsOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [noteInput, setNoteInput] = useState('');
  const [notesSkip, setNotesSkip] = useState(0);
  const [pendingNoteAttachments, setPendingNoteAttachments] = useState<NoteAttachment[]>([]);
  const [noteAttachUploading, setNoteAttachUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const noteAttachInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { upload, uploading: fileUploading } = useFileUpload();
  const { upload: uploadNote } = useFileUpload();

  const { data: contact } = useQuery({
    queryKey: ['contact', params.id],
    queryFn: () => getContact(params.id),
  });

  const { data: systemConfigsData } = useQuery({
    queryKey: ['contactFieldConfigs'],
    queryFn: getContactFieldConfigs,
    staleTime: 0,
  });
  const systemConfigs = Array.isArray(systemConfigsData)
    ? systemConfigsData.filter((config) => config && typeof config.fieldKey === 'string')
    : [];

  const { data: customFieldDefsData } = useQuery({
    queryKey: ['contactFieldDefs'],
    queryFn: getContactFieldDefs,
  });
  const customFieldDefs = Array.isArray(customFieldDefsData)
    ? customFieldDefsData.filter((field) => field && typeof field.id === 'string' && typeof field.key === 'string')
    : [];

  const { data: pipelineStagesData } = useQuery({
    queryKey: ['pipeline-stages'],
    queryFn: getPipelineStages,
  });
  const pipelineStages = Array.isArray(pipelineStagesData)
    ? pipelineStagesData.filter((stage) => stage && typeof stage.id === 'string' && typeof stage.name === 'string' && stage.name.trim().length > 0)
    : [];

  const { data: contactGroupsData } = useQuery({
    queryKey: ['contactGroups'],
    queryFn: getContactGroups,
  });
  const contactGroups = Array.isArray(contactGroupsData)
    ? contactGroupsData.filter((group) => group && typeof group.id === 'string' && group.id.trim().length > 0)
    : [];

  const { data: summary } = useQuery({
    queryKey: ['contact-summary', params.id],
    queryFn: () => getContactSummary(parseInt(params.id)),
    enabled: !!contact,
  });

  const { data: notesData } = useQuery({
    queryKey: ['contact-notes', params.id, notesSkip],
    queryFn: () => getContactNotes(parseInt(params.id), notesSkip),
    enabled: !!contact,
  });
  const notes = Array.isArray(notesData) ? notesData : [];

  const patchContact = useMutation({
    mutationFn: (data: Record<string, any>) => updateContact(params.id, data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact', params.id] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });

  const createNoteMutation = useMutation({
    mutationFn: ({ content, attachments }: { content: string; attachments: NoteAttachment[] }) =>
      createContactNote(parseInt(params.id), content, attachments),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-notes', params.id] });
      setNoteInput('');
      setPendingNoteAttachments([]);
    },
  });

  const updateNoteMutation = useMutation({
    mutationFn: ({ id, content, attachments }: { id: number; content: string; attachments: NoteAttachment[] }) =>
      updateContactNote(id, content, attachments),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contact-notes', params.id] }),
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (id: number) => deleteContactNote(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contact-notes', params.id] }),
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, done }: { id: number; done: boolean }) => updateTask(id, { done }),
    onMutate: async ({ id, done }) => {
      await queryClient.cancelQueries({ queryKey: ['contact', params.id] });
      const previous = queryClient.getQueryData(['contact', params.id]);
      queryClient.setQueryData<any>(['contact', params.id], (old: any) =>
        old ? { ...old, tasks: (Array.isArray(old.tasks) ? old.tasks : []).map((t: any) => t.id === id ? { ...t, done } : t) } : old
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
        old ? { ...old, tasks: (Array.isArray(old.tasks) ? old.tasks : []).filter((t: any) => t.id !== id) } : old
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => { if (ctx?.previous) queryClient.setQueryData(['contact', params.id], ctx.previous); },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['contact', params.id] }),
  });

  const addDocuments = useCallback(async (files: File[]) => {
    if (!contact || files.length === 0) return;
    for (const file of files) {
      const result = await upload(file, 'attachments');
      if (!result) continue;
      const existing = normalizeDocuments((contact as any).documents);
      const updated = [...existing, {
        name: file.name, url: result.url, size: result.size,
        contentType: file.type, uploadedAt: new Date().toISOString(),
      }];
      patchContact.mutate({ documents: updated });
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [contact, upload, patchContact]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    await addDocuments(files);
  }, [addDocuments]);

  const handleDocDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    await addDocuments(files);
  }, [addDocuments]);

  const deleteDocument = useCallback((url: string) => {
    if (!contact) return;
    const updated = normalizeDocuments((contact as any).documents).filter(d => d.url !== url);
    patchContact.mutate({ documents: updated });
  }, [contact, patchContact]);

  const handleNoteAttachFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setNoteAttachUploading(true);
    for (const file of files) {
      const result = await uploadNote(file, 'attachments');
      if (result) {
        setPendingNoteAttachments(prev => [...prev, {
          name: file.name, url: result.url, size: result.size,
          contentType: file.type, uploadedAt: new Date().toISOString(),
        }]);
      }
    }
    setNoteAttachUploading(false);
    if (noteAttachInputRef.current) noteAttachInputRef.current.value = '';
  }, [uploadNote]);

  if (!contact) return <div className="p-6 text-[#6b7e9a]">A carregar...</div>;

  const save = (field: string, value: any) => patchContact.mutate({ [field]: value });
  const saveCustom = (key: string, value: string) =>
    patchContact.mutate({ customFields: { ...(contact.customFields ?? {}), [key]: value } });

  const clienteType: 'empresa' | 'particular' = (contact as any).clienteType || 'particular';
  const isEmpresa = clienteType === 'empresa';

  // phone is hardcoded — always shown; exclude from config-driven loop
  const visibleSystem = systemConfigs
    .filter(c => c.visible)
    .filter(c => {
      if (['name', 'phone', 'nif', 'company', 'clienteType'].includes(c.fieldKey)) return false;
      if (!isEmpresa && c.fieldKey === 'sector') return false;
      return true;
    })
    .sort((a, b) => a.order - b.order);

  const nifConfig = systemConfigs.find(c => c.fieldKey === 'nif');
  const companyConfig = systemConfigs.find(c => c.fieldKey === 'company');
  const sectorConfig = systemConfigs.find(c => c.fieldKey === 'sector');

  const waNum = formatWA(contact.phone);
  const isAtivo = (contact as any).status !== 'inativo';
  const documents: { name: string; url: string; size?: number; uploadedAt: string }[] =
    normalizeDocuments((contact as any).documents);
  const contactTasks: Task[] = Array.isArray(contact.tasks) ? contact.tasks : [];
  const summaryTransactions = Array.isArray(summary?.transacoes) ? summary.transacoes : [];

  const renderSystemField = (cfg: ContactFieldConfig) => {
    const key = cfg.fieldKey;
    switch (key) {
      case 'email':
        return <InlineField key={key} label={cfg.label} value={contact.email ?? ''} onSave={v => save('email', v)} type="email" />;
      case 'phone':
        return <InlineField key={key} label={cfg.label} value={contact.phone ?? ''} onSave={v => save('phone', v)} />;
      case 'nif':
        return <InlineField key={key} label={cfg.label} value={contact.nif ?? ''} onSave={v => save('nif', v)} />;
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

      <ContactGroupsManager open={isGroupsOpen} onOpenChange={setIsGroupsOpen} />

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
              <InlineField label="Telefone" value={contact.phone ?? ''} onSave={v => save('phone', v)} />
              <InlineField
                label={`${nifConfig?.label || 'NIF'}${isEmpresa ? ' *' : ''}`}
                value={contact.nif ?? ''}
                onSave={v => save('nif', v)}
              />
              <div>
                <div className="mb-1 flex items-center justify-between gap-3">
                  <p className="text-xs text-[#6b7e9a]">Grupo</p>
                  <button
                    type="button"
                    onClick={() => setIsGroupsOpen(true)}
                    className="text-xs font-medium text-[#0A2540] hover:underline"
                  >
                    Gerir grupos
                  </button>
                </div>
                <Select
                  value={contact.contactGroupId ?? NO_GROUP_VALUE}
                  onValueChange={(value) => save('contactGroupId', value === NO_GROUP_VALUE ? null : value)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Sem grupo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_GROUP_VALUE}>Sem grupo</SelectItem>
                    {contactGroups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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

              <InlineField
                label="Valor da negociação (Kz)"
                value={contact.dealValueKz !== null && contact.dealValueKz !== undefined ? String(contact.dealValueKz) : ''}
                onSave={v => save('dealValueKz', v)}
                type="number"
                placeholder="Sem valor definido"
              />

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

          {/* Commercial summary card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#6b7e9a]" />
                Resumo comercial
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

              {summaryTransactions.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-[#6b7e9a] uppercase tracking-wide mb-2">Últimas transações</p>
                  <div className="space-y-2">
                    {summaryTransactions.map((t: any) => (
                      <div key={t.id} className="flex justify-between items-center text-sm">
                        <span className="text-[#0A2540] truncate flex-1 mr-2">{t.description || t.descricao || '—'}</span>
                        <span className="text-green-600 font-medium flex-shrink-0">{formatKz(t.amountKz ?? t.amount ?? 0)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(!summary || (summaryTransactions.length === 0 && !summary.ultimoServico)) && (
                <p className="text-sm text-[#6b7e9a] text-center py-2">Sem histórico de compras</p>
              )}
            </CardContent>
          </Card>

          <ContactHistoryTimeline contactId={contact.id} />

        </div>

        {/* Right column — Notes + Documents + Tasks */}
        <div className="lg:col-span-2 space-y-6">

          <ContactFormSubmissionsCard contactId={contact.id} />

          {/* Notes card */}
          <Card>
            <CardHeader>
              <CardTitle>Notas</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Input */}
              <div className="mb-4 space-y-2">
                <div className="flex gap-2">
                  <textarea
                    value={noteInput}
                    onChange={e => setNoteInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (noteInput.trim() || pendingNoteAttachments.length > 0) {
                          createNoteMutation.mutate({ content: noteInput.trim() || '📎', attachments: pendingNoteAttachments });
                        }
                      }
                    }}
                    placeholder="Adicionar nota... (Enter para guardar, Shift+Enter para nova linha)"
                    className="flex-1 text-sm bg-gray-50 text-[#2c2f31] placeholder-[#6b7e9a] border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#0A2540]/30 min-h-[72px]"
                    rows={3}
                  />
                  <div className="flex flex-col gap-1 flex-shrink-0 self-end">
                    {/* Botão de anexar */}
                    <input
                      ref={noteAttachInputRef}
                      type="file"
                      multiple
                      className="sr-only"
                      accept="image/*,application/pdf,application/vnd.openxmlformats-officedocument.*,.doc,.docx,.xls,.xlsx"
                      onChange={handleNoteAttachFile}
                    />
                    <button
                      onClick={() => noteAttachInputRef.current?.click()}
                      disabled={noteAttachUploading}
                      className="p-2 text-zinc-400 hover:text-white border border-white/10 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-40 transition-colors"
                      title="Anexar ficheiro"
                    >
                      {noteAttachUploading
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Paperclip className="w-4 h-4" />
                      }
                    </button>
                    {/* Botão enviar */}
                    <button
                      onClick={() => {
                        if (noteInput.trim() || pendingNoteAttachments.length > 0) {
                          createNoteMutation.mutate({ content: noteInput.trim() || '📎', attachments: pendingNoteAttachments });
                        }
                      }}
                      disabled={(!noteInput.trim() && pendingNoteAttachments.length === 0) || createNoteMutation.isPending}
                      className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Pré-visualização de anexos pendentes */}
                {pendingNoteAttachments.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {pendingNoteAttachments.map((a, i) => (
                      <div key={i} className="flex items-center gap-1.5 px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-xs text-zinc-300">
                        {isImage(a.name, a.contentType)
                          ? <Image className="w-3.5 h-3.5 text-blue-400" />
                          : <FileText className="w-3.5 h-3.5 text-zinc-400" />
                        }
                        <span className="max-w-[120px] truncate">{a.name}</span>
                        <button
                          onClick={() => setPendingNoteAttachments(prev => prev.filter((_, j) => j !== i))}
                          className="text-zinc-500 hover:text-red-400 ml-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Notes list */}
              {notes.length > 0 ? (
                <div>
                  {notes.map(note => (
                    <NoteItem
                      key={note.id}
                      note={note}
                      onUpdate={(id, content, attachments) => updateNoteMutation.mutate({ id, content, attachments })}
                      onDelete={(id) => deleteNoteMutation.mutate(id)}
                    />
                  ))}
                  {notes.length === 10 && (
                    <button
                      onClick={() => setNotesSkip(prev => prev + 10)}
                      className="mt-3 text-sm text-zinc-400 hover:text-white"
                    >
                      Ver mais →
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-center text-zinc-500 text-sm py-4">Nenhuma nota ainda</p>
              )}
            </CardContent>
          </Card>

          {/* Documents card */}
          <Card>
            <CardHeader className="flex justify-between items-center">
              <CardTitle>Ficheiros & Galeria</CardTitle>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
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
              {/* Zona de drop */}
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={handleDocDrop}
                className="relative"
              >
                {documents.length > 0 ? (
                  <>
                    {/* Galeria de imagens */}
                    {documents.filter(d => isImage(d.name, (d as any).contentType)).length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                          <Image className="w-3.5 h-3.5" />Fotos
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          {documents
                            .filter(d => isImage(d.name, (d as any).contentType))
                            .map((doc, idx) => (
                              <DocImageThumb key={idx} doc={doc} onDelete={deleteDocument} />
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Lista de documentos */}
                    {documents.filter(d => !isImage(d.name, (d as any).contentType)).length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5" />Documentos
                        </p>
                        <div className="space-y-1.5">
                          {documents
                            .filter(d => !isImage(d.name, (d as any).contentType))
                            .map((doc, idx) => (
                              <div key={idx} className="group/doc flex items-center gap-3 p-3 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] transition-colors">
                                <FileText className="w-5 h-5 text-zinc-400 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-white truncate">{doc.name}</p>
                                  <p className="text-xs text-zinc-500">
                                    {doc.size ? formatFileSize(doc.size) + ' · ' : ''}{formatDate(doc.uploadedAt)}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <a
                                    href={doc.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 text-zinc-400 hover:text-white rounded transition-colors"
                                    title="Abrir / Download"
                                  >
                                    <Download className="w-4 h-4" />
                                  </a>
                                  <button
                                    onClick={() => deleteDocument(doc.url)}
                                    className="p-1.5 text-zinc-500 hover:text-red-400 rounded transition-colors opacity-0 group-hover/doc:opacity-100"
                                    title="Apagar"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Área de drop sobreposta quando já há ficheiros */}
                    <div
                      className="mt-3 flex items-center justify-center py-3 border border-dashed border-white/10 rounded-lg cursor-pointer hover:bg-white/5 transition-colors text-zinc-500 text-xs gap-1.5"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Arraste ou clique para adicionar mais
                    </div>
                  </>
                ) : (
                  <div
                    className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-white/10 rounded-lg cursor-pointer hover:bg-white/5 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-8 h-8 text-zinc-500 mb-2" />
                    <p className="text-sm text-zinc-400 font-medium">Arraste ou clique para adicionar</p>
                    <p className="text-xs text-zinc-600 mt-0.5">Fotos, PDF, Word, Excel · max 10 MB</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Tasks card */}
          <Card>
            <CardHeader className="flex justify-between items-center">
              <CardTitle>Tarefas</CardTitle>
              <Button size="sm" onClick={() => { setEditingTask(null); setIsAddTaskOpen(true); }}>+ Nova Tarefa</Button>
            </CardHeader>
            <CardContent>
              {contactTasks.length > 0 ? (
                <div className="space-y-2">
                  {contactTasks.map(task => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onToggleDone={(id, done) => updateTaskMutation.mutate({ id, done })}
                      onEdit={(task) => {
                        setEditingTask(task);
                        setIsAddTaskOpen(true);
                      }}
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

      <TaskFormModal
        open={isAddTaskOpen}
        onClose={() => {
          setIsAddTaskOpen(false);
          setEditingTask(null);
        }}
        task={editingTask}
        defaultContactId={parseInt(params.id, 10)}
      />
    </div>
  );
}
