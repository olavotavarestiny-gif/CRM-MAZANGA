'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Paperclip, Send, X, File } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getChatUsers, sendChatMessage } from '@/lib/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ChatAttachment } from '@/lib/types';
import { PlanLimitModal } from './plan-limit-modal';

interface MessageInputProps {
  channelId: string;
  onMessageSent: (message: any) => void;
}

export function MessageInput({ channelId, onMessageSent }: MessageInputProps) {
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionStart, setMentionStart] = useState(-1);
  const [limitError, setLimitError] = useState<any>(null);
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
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('folder', 'attachments');
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      if (!res.ok) throw new Error('Upload falhou');
      const data = await res.json();
      setAttachments((prev) => [...prev, { url: data.url, name: file.name, size: file.size, type: file.type }]);
    } catch {
      alert('Erro ao fazer upload do ficheiro');
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
    try {
      const msg = await sendChatMessage(channelId, text.trim(), attachments);
      setText('');
      setAttachments([]);
      onMessageSent(msg);
    } catch (err: any) {
      if (err?.response?.status === 429) {
        const d = err.response.data;
        setLimitError({ feature: d.feature, featureLabel: 'mensagens por dia', current: d.current, limit: d.limit, plan: d.plan });
      } else {
        alert('Erro ao enviar mensagem');
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
    <div className="border-t border-[#E2E8F0] bg-white px-4 py-3">
      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {attachments.map((att, i) => (
            <div key={i} className="flex items-center gap-1.5 bg-[#F1F5F9] rounded-lg px-2.5 py-1.5 text-xs text-[#0A2540]">
              <File className="w-3.5 h-3.5 text-[#6b7e9a]" />
              <span className="max-w-[120px] truncate">{att.name}</span>
              <button onClick={() => removeAttachment(i)} className="text-[#94a3b8] hover:text-[#0A2540] ml-0.5">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="relative flex items-end gap-2">
        {/* Mentions dropdown */}
        {showMentions && filteredMentions.length > 0 && (
          <div className="absolute bottom-full mb-1 left-0 right-12 bg-white border border-[#E2E8F0] rounded-lg shadow-lg max-h-40 overflow-y-auto z-10">
            {filteredMentions.map((u) => (
              <button
                key={u.id}
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-[#F8FAFC] transition-colors"
                onMouseDown={(e) => { e.preventDefault(); insertMention(u); }}
              >
                <p className="text-sm font-medium text-[#0A2540]">{u.name}</p>
                <p className="text-xs text-[#94a3b8]">{u.email}</p>
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="shrink-0 p-2 text-[#94a3b8] hover:text-[#0A2540] hover:bg-[#F1F5F9] rounded-lg transition-colors disabled:opacity-50"
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
          className="flex-1 resize-none rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0A2540] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#0A2540]/20 focus:border-[#0A2540]/30 min-h-[40px]"
        />

        <Button
          type="button"
          onClick={handleSend}
          disabled={sending || uploading || (!text.trim() && attachments.length === 0)}
          className="shrink-0 bg-[#0A2540] hover:bg-[#0A2540]/90 text-white h-9 w-9 p-0 rounded-lg"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>

      <p className="text-[10px] text-[#94a3b8] mt-1 text-right">Enter para enviar · Shift+Enter para nova linha</p>
    </div>
  );
}
