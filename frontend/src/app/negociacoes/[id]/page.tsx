'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getDeal, closeDeal, reopenDeal,
  getDealNotes, createDealNote, updateDealNote, deleteDealNote,
} from '@/lib/api';
import type { DealNote, DealNoteType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import DealStakeholdersPanel from '@/components/pipeline/deal-stakeholders-panel';
import { getApiErrorMessage } from '@/lib/api-error-message';
import {
  ArrowLeft, CheckCircle2, XCircle, RotateCcw,
  FileText, Users, Phone, Mail, ArrowRight,
  Pencil, Trash2, Check, X, Send,
} from 'lucide-react';

function formatKz(value?: number | null) {
  if (value === null || value === undefined) return '—';
  return `${new Intl.NumberFormat('pt-PT').format(Math.round(value))} Kz`;
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora mesmo';
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'ontem';
  if (days < 7) return `há ${days} dias`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `há ${weeks} sem`;
  const months = Math.floor(days / 30);
  return `há ${months} mês${months > 1 ? 'es' : ''}`;
}

const NOTE_TYPES: { type: DealNoteType; label: string; icon: React.ReactNode; color: string; bg: string }[] = [
  { type: 'nota',          label: 'Nota',         icon: <FileText className="w-3.5 h-3.5" />,  color: 'text-zinc-500',   bg: 'bg-zinc-100' },
  { type: 'reuniao',       label: 'Reunião',      icon: <Users className="w-3.5 h-3.5" />,     color: 'text-blue-600',   bg: 'bg-blue-100' },
  { type: 'chamada',       label: 'Chamada',      icon: <Phone className="w-3.5 h-3.5" />,     color: 'text-green-600',  bg: 'bg-green-100' },
  { type: 'email',         label: 'Email',        icon: <Mail className="w-3.5 h-3.5" />,      color: 'text-violet-600', bg: 'bg-violet-100' },
  { type: 'proximo_passo', label: 'Próximo Passo',icon: <ArrowRight className="w-3.5 h-3.5" />,color: 'text-orange-600', bg: 'bg-orange-100' },
];

function noteTypeMeta(type: DealNoteType) {
  return NOTE_TYPES.find(t => t.type === type) ?? NOTE_TYPES[0];
}

const STATUS_LABELS = {
  aberto: 'Aberto',
  ganho: 'Ganho',
  perdido: 'Perdido',
} as const;

// ── Componente de item da timeline ─────────────────────────────────────────────
function NoteTimelineItem({
  note,
  currentUserId,
  onUpdate,
  onDelete,
}: {
  note: DealNote;
  currentUserId?: number;
  onUpdate: (id: string, content: string, noteType: DealNoteType) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.content);
  const [draftType, setDraftType] = useState<DealNoteType>(note.noteType);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const meta = noteTypeMeta(note.noteType);
  const canEdit = currentUserId === note.userId;

  useEffect(() => { if (editing) textRef.current?.focus(); }, [editing]);

  const commit = () => {
    if (draft.trim()) onUpdate(note.id, draft.trim(), draftType);
    setEditing(false);
  };

  return (
    <div className="group flex gap-3">
      {/* Ícone do tipo */}
      <div className="flex flex-col items-center">
        <div className={`flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0 ${meta.bg} ${meta.color}`}>
          {meta.icon}
        </div>
        <div className="mt-1 flex-1 w-px bg-slate-200" />
      </div>

      {/* Conteúdo */}
      <div className="flex-1 pb-6 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-xs font-semibold ${meta.color}`}>{meta.label}</span>
          <span className="text-xs text-[#6b7e9a]">
            {note.user?.name ?? 'Utilizador'} · {formatRelativeTime(note.createdAt)}
          </span>
        </div>

        {editing ? (
          <div className="space-y-2">
            {/* Selecção de tipo ao editar */}
            <div className="flex flex-wrap gap-1">
              {NOTE_TYPES.map(t => (
                <button
                  key={t.type}
                  onClick={() => setDraftType(t.type)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border transition-colors ${
                    draftType === t.type
                      ? `${t.bg} ${t.color} border-current`
                      : 'bg-white text-[#6b7e9a] border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {t.icon}{t.label}
                </button>
              ))}
            </div>
            <textarea
              ref={textRef}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); }
                if (e.key === 'Escape') { setDraft(note.content); setEditing(false); }
              }}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#0A2540]/20"
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
          <div>
            <p className="text-sm text-[#0A2540] whitespace-pre-wrap break-words">{note.content}</p>
            {canEdit && (
              <div className="mt-1 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => { setDraft(note.content); setDraftType(note.noteType); setEditing(true); }}
                  className="text-xs text-[#6b7e9a] hover:text-[#0A2540] flex items-center gap-0.5"
                >
                  <Pencil className="w-3 h-3" />Editar
                </button>
                <button
                  onClick={() => onDelete(note.id)}
                  className="text-xs text-[#6b7e9a] hover:text-red-500 flex items-center gap-0.5"
                >
                  <Trash2 className="w-3 h-3" />Apagar
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Página principal ────────────────────────────────────────────────────────────
export default function DealDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const queryClient = useQueryClient();

  const [isLossOpen, setIsLossOpen] = useState(false);
  const [lossReason, setLossReason] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteType, setNoteType] = useState<DealNoteType>('nota');
  const [notesSkip, setNotesSkip] = useState(0);

  const {
    data: deal,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['deal', id],
    queryFn: () => getDeal(id),
    retry: false,
  });

  const { data: notesData } = useQuery({
    queryKey: ['deal-notes', id, notesSkip],
    queryFn: () => getDealNotes(id, notesSkip),
    enabled: !!deal,
  });
  const notes: DealNote[] = Array.isArray(notesData) ? notesData : [];

  const invalidateDeal = () => {
    queryClient.invalidateQueries({ queryKey: ['deal', id] });
    queryClient.invalidateQueries({ queryKey: ['deals'] });
  };
  const invalidateNotes = () => queryClient.invalidateQueries({ queryKey: ['deal-notes', id] });

  const winMutation = useMutation({ mutationFn: () => closeDeal(id, { status: 'ganho' }), onSuccess: invalidateDeal });
  const lossMutation = useMutation({
    mutationFn: () => closeDeal(id, { status: 'perdido', lossReason: lossReason.trim() }),
    onSuccess: () => { invalidateDeal(); setIsLossOpen(false); setLossReason(''); },
  });
  const reopenMutation = useMutation({ mutationFn: () => reopenDeal(id), onSuccess: invalidateDeal });

  const createNoteMutation = useMutation({
    mutationFn: () => createDealNote(id, noteContent.trim(), noteType),
    onSuccess: () => { invalidateNotes(); setNoteContent(''); setNoteType('nota'); },
  });
  const updateNoteMutation = useMutation({
    mutationFn: ({ noteId, content, type }: { noteId: string; content: string; type: DealNoteType }) =>
      updateDealNote(noteId, content, type),
    onSuccess: invalidateNotes,
  });
  const deleteNoteMutation = useMutation({
    mutationFn: (noteId: string) => deleteDealNote(noteId),
    onSuccess: invalidateNotes,
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl p-4 md:p-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-[#6b7e9a] shadow-sm">
          A carregar negociação...
        </div>
      </div>
    );
  }

  if (isError || !deal) {
    return (
      <div className="mx-auto max-w-5xl p-4 md:p-6">
        <ErrorState
          title="Falha ao carregar negociação"
          message={getApiErrorMessage(error, 'Não foi possível carregar a negociação.')}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const isOpen = deal.status === 'aberto';
  const closeError = winMutation.error || lossMutation.error || reopenMutation.error;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <Link
        href="/negociacoes"
        className="inline-flex items-center gap-1 text-sm text-[#6b7e9a] hover:text-[#0A2540]"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar às negociações
      </Link>

      {/* Header do deal */}
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            {deal.company?.name && (
              <p className="text-sm font-semibold uppercase tracking-wide text-[#6b7e9a]">
                {deal.company.name}
              </p>
            )}
            <h1 className="text-3xl font-extrabold tracking-tight text-[#0A2540]">
              {deal.title}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-semibold text-[#0A2540]">
                {formatKz(deal.valueKz)}
              </span>
              {deal.stage && (
                <Badge variant="outline" style={{ borderColor: deal.stage.color, color: deal.stage.color }}>
                  {deal.stage.name}
                </Badge>
              )}
              <Badge
                variant={deal.status === 'ganho' ? 'success' : deal.status === 'perdido' ? 'destructive' : 'secondary'}
              >
                {STATUS_LABELS[deal.status]}
              </Badge>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
            {isOpen ? (
              <>
                <Button onClick={() => winMutation.mutate()} disabled={winMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700">
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {winMutation.isPending ? 'A fechar...' : 'Marcar como Ganho'}
                </Button>
                <Button variant="outline" onClick={() => setIsLossOpen(true)} className="border-red-200 text-red-600 hover:bg-red-50">
                  <XCircle className="mr-2 h-4 w-4" />
                  Marcar como Perdido
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => reopenMutation.mutate()} disabled={reopenMutation.isPending}>
                <RotateCcw className="mr-2 h-4 w-4" />
                {reopenMutation.isPending ? 'A reabrir...' : 'Reabrir'}
              </Button>
            )}
          </div>
        </div>

        {!isOpen && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-[#f9fafc] p-4">
            <p className="text-sm font-semibold text-[#0A2540]">
              Negociação {deal.status === 'ganho' ? 'ganha' : 'perdida'}.
            </p>
            {deal.status === 'perdido' && deal.lossReason && (
              <p className="mt-1 text-sm text-[#6b7e9a]">Motivo: {deal.lossReason}</p>
            )}
          </div>
        )}

        {closeError && (
          <p className="mt-3 text-sm text-red-500">
            {getApiErrorMessage(closeError, 'Não foi possível atualizar o estado da negociação.')}
          </p>
        )}
      </div>

      {/* Stakeholders */}
      <DealStakeholdersPanel deal={deal} />

      {/* Actividade — Timeline de notas */}
      <Card>
        <CardHeader>
          <CardTitle>Actividade</CardTitle>
          <p className="text-xs text-[#6b7e9a] -mt-1">Regista chamadas, reuniões, emails e próximos passos</p>
        </CardHeader>
        <CardContent>
          {/* Formulário de nova entrada */}
          <div className="mb-6 rounded-xl border border-slate-200 bg-[#f9fafc] p-4 space-y-3">
            {/* Selecção de tipo */}
            <div className="flex flex-wrap gap-1.5">
              {NOTE_TYPES.map(t => (
                <button
                  key={t.type}
                  onClick={() => setNoteType(t.type)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    noteType === t.type
                      ? `${t.bg} ${t.color} border-current shadow-sm scale-105`
                      : 'bg-white text-[#6b7e9a] border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {t.icon}{t.label}
                </button>
              ))}
            </div>

            {/* Textarea + botão */}
            <div className="flex gap-2">
              <textarea
                value={noteContent}
                onChange={e => setNoteContent(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey && noteContent.trim()) {
                    e.preventDefault();
                    createNoteMutation.mutate();
                  }
                }}
                placeholder={
                  noteType === 'reuniao' ? 'O que foi discutido? Quem esteve presente?' :
                  noteType === 'chamada' ? 'Com quem falou? O que ficou decidido?' :
                  noteType === 'email' ? 'Resumo do email enviado/recebido...' :
                  noteType === 'proximo_passo' ? 'O que acontece a seguir? Quem é responsável?' :
                  'Adicionar nota... (Enter para guardar)'
                }
                className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#0A2540]/20 min-h-[72px]"
                rows={3}
              />
              <button
                onClick={() => { if (noteContent.trim()) createNoteMutation.mutate(); }}
                disabled={!noteContent.trim() || createNoteMutation.isPending}
                className="flex-shrink-0 self-end p-2 bg-[#0A2540] text-white rounded-lg hover:bg-[#0A2540]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

            {createNoteMutation.isError && (
              <p className="text-xs text-red-500">{getApiErrorMessage(createNoteMutation.error, 'Erro ao guardar.')}</p>
            )}
          </div>

          {/* Timeline */}
          {notes.length === 0 ? (
            <p className="text-center text-sm text-[#6b7e9a] py-6">
              Nenhuma actividade registada ainda. Começa por adicionar uma nota acima.
            </p>
          ) : (
            <div>
              {notes.map(note => (
                <NoteTimelineItem
                  key={note.id}
                  note={note}
                  currentUserId={deal.userId}
                  onUpdate={(noteId, content, type) => updateNoteMutation.mutate({ noteId, content, type })}
                  onDelete={noteId => deleteNoteMutation.mutate(noteId)}
                />
              ))}
              {notes.length === 20 && (
                <button
                  onClick={() => setNotesSkip(prev => prev + 20)}
                  className="mt-2 text-sm text-[#0A2540] hover:underline"
                >
                  Ver mais →
                </button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de perda */}
      <Dialog open={isLossOpen} onOpenChange={(o) => !o && setIsLossOpen(false)}>
        <DialogContent className="max-w-md bg-white text-[#0A2540]">
          <DialogHeader>
            <DialogTitle className="text-[#0A2540]">Marcar como Perdido</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="mb-1.5 block text-sm font-medium text-[#0A2540]">
                Motivo da perda <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="Ex.: Preço acima do orçamento"
                value={lossReason}
                onChange={(e) => setLossReason(e.target.value)}
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter' && lossReason.trim()) lossMutation.mutate(); }}
              />
            </div>
            {lossMutation.isError && (
              <p className="text-sm text-red-500">
                {getApiErrorMessage(lossMutation.error, 'Não foi possível fechar a negociação.')}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setIsLossOpen(false)} disabled={lossMutation.isPending}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={() => lossMutation.mutate()}
                disabled={!lossReason.trim() || lossMutation.isPending}
              >
                {lossMutation.isPending ? 'A fechar...' : 'Confirmar perda'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
