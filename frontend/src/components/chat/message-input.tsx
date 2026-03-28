'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Loader2, Paperclip, Send, X, File } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getChatUsers, sendChatMessage } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import type { ChatAttachment } from '@/lib/types';
import { PlanLimitModal } from './plan-limit-modal';
import { ErrorState } from '@/components/ui/error-state';
import { useToast } from '@/components/ui/toast-provider';

interface MessageInputProps {
  channelId: string;
  onMessageSent: (message: any) => void;
}

export function MessageInput({ channelId, onMessageSent }: MessageInputProps) {
  const { toast } = useToast();
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionStart, setMentionStart] = useState(-1);
  const [limitError, setLimitError] = useState<any>(null);
  const [composerError, setComposerError] = useState<{ message: string; action: 'send' | 'upload' } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: orgUsers = [] } = useQuery({
    queryKey: ['chat-users'],
    queryFn: getChatUsers,
  });

  const filteredMentions = orgUsers.filter((u) =>
    mentionQuery === '' || u.name.toLowerCase().includes(mentionQuery.toLowerCase())
  );

  const handleTextChange = (value: string) => {
    setText(value);

    // Detect @ mention
    const cursor = textareaRef.current?.selectionStart ?? value.length;
    const textBefore = value.slice(0, cursor);
    const atMatch = textBefore.match(/@(\w[\w\s]*)$/);
    if (atMatch) {
      setMentionStart(cursor - atMatch[0].length);
      setMentionQuery(atMatch[1] || '');
      setShowMentions(true);
    } else if (textBefore.endsWith('@')) {
      setMentionStart(cursor - 1);
      setMentionQuery('');
      setShowMentions(true);
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (user: { id: number; name: string }) => {
    const before = text.slice(0, mentionStart);
    const after = text.slice(textareaRef.current?.selectionStart ?? text.length);
    const newText = `${before}@${user.name} ${after}`;
    setText(newText);
    setShowMentions(false);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!showMentions) handleSend();
    }
    if (e.key === 'Escape') setShowMentions(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setUploading(true);
    setComposerError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('folder', 'attachments');
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      if (!res.ok) throw new Error('Upload falhou');
      const data = await res.json();
      setAttachments((prev) => [...prev, { url: data.url, name: file.name, size: file.size, type: file.type }]);
      toast({
        variant: 'success',
        title: 'Ficheiro anexado',
        description: `${file.name} está pronto para envio.`,
      });
    } catch {
      const message = 'Não foi possível carregar o ficheiro para esta conversa.';
      setComposerError({ message, action: 'upload' });
      toast({
        variant: 'error',
        title: 'Falha no upload',
        description: message,
      });
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = (i: number) => {
    setAttachments((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleSend = async () => {
    if ((!text.trim() && attachments.length === 0) || sending) return;

    setSending(true);
    setComposerError(null);
    try {
      const msg = await sendChatMessage(channelId, text.trim(), attachments);
      setText('');
      setAttachments([]);
      setComposerError(null);
      onMessageSent(msg);
    } catch (err: any) {
      if (err?.response?.status === 429) {
        const d = err.response.data;
        setLimitError({ feature: d.feature, featureLabel: 'mensagens por dia', current: d.current, limit: d.limit, plan: d.plan });
      } else {
        const message = err?.response?.data?.error || err?.message || 'Não foi possível enviar a mensagem.';
        setComposerError({ message, action: 'send' });
        toast({
          variant: 'error',
          title: 'Falha ao enviar mensagem',
          description: message,
        });
      }
    } finally {
      setSending(false);
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [text]);

  if (limitError) {
    return (
      <PlanLimitModal
        {...limitError}
        onClose={() => setLimitError(null)}
      />
    );
  }

  return (
    <div className="border-t border-[#E2E8F0] bg-white px-5 py-4">
      {composerError && (
        <div className="mb-3">
          <ErrorState
            compact
            title={composerError.action === 'upload' ? 'Falha no anexo' : 'Falha no envio'}
            message={composerError.message}
            onRetry={
              composerError.action === 'upload'
                ? () => fileInputRef.current?.click()
                : () => handleSend()
            }
            retryLabel={composerError.action === 'upload' ? 'Escolher ficheiro' : 'Repetir envio'}
            secondaryAction={{ label: 'Fechar', onClick: () => setComposerError(null) }}
          />
        </div>
      )}

      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {attachments.map((att, i) => (
            <div key={i} className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-[#F8FAFC] px-3 py-2 text-xs text-[#0A2540]">
              <File className="w-3.5 h-3.5 text-[#6b7e9a]" />
              <span className="max-w-[120px] truncate">{att.name}</span>
              <button onClick={() => removeAttachment(i)} className="text-[#94a3b8] hover:text-[#0A2540] ml-0.5">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="relative rounded-[22px] border border-[#E2E8F0] bg-[#FBFDFF] p-2 shadow-sm">
        {/* Mentions dropdown */}
        {showMentions && filteredMentions.length > 0 && (
          <div className="absolute bottom-full left-0 right-12 z-10 mb-2 max-h-40 overflow-y-auto rounded-2xl border border-[#E2E8F0] bg-white shadow-lg">
            {filteredMentions.map((u) => (
              <button
                key={u.id}
                type="button"
                className="w-full px-3 py-2 text-left transition-colors hover:bg-[#F8FAFC]"
                onMouseDown={(e) => { e.preventDefault(); insertMention(u); }}
              >
                <p className="text-sm font-medium text-[#0A2540]">{u.name}</p>
                <p className="text-xs text-[#94a3b8]">{u.email}</p>
              </button>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="shrink-0 rounded-2xl p-2 text-[#94a3b8] transition-colors hover:bg-white hover:text-[#0A2540] disabled:opacity-50"
            title="Anexar ficheiro"
          >
            <Paperclip className="w-4.5 h-4.5" />
          </button>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />

          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escreve uma mensagem… (Enter para enviar, Shift+Enter para nova linha)"
            rows={1}
            className="min-h-[44px] flex-1 resize-none rounded-2xl border border-transparent bg-transparent px-3 py-2 text-sm text-[#0A2540] placeholder:text-[#94a3b8] focus:border-transparent focus:outline-none focus:ring-0"
          />

          <Button
            type="button"
            onClick={handleSend}
            disabled={sending || uploading || (!text.trim() && attachments.length === 0)}
            className="h-11 w-11 shrink-0 rounded-2xl bg-[#0A2540] p-0 text-white hover:bg-[#0A2540]/90"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      <p className="mt-2 text-right text-[10px] text-[#94a3b8]">
        {uploading ? 'A carregar anexo… · ' : ''}
        Enter para enviar · Shift+Enter para nova linha
      </p>
    </div>
  );
}
