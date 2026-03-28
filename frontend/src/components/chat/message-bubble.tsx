'use client';

import { FileText, Image as ImageIcon } from 'lucide-react';
import type { ChatMessage } from '@/lib/types';

interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  showAvatar: boolean;
  orgUsers: { id: number; name: string }[];
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Hoje';
  if (d.toDateString() === yesterday.toDateString()) return 'Ontem';
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' });
}

function renderTextWithMentions(text: string, orgUsers: { id: number; name: string }[]) {
  const parts = text.split(/(@\w[\w\s]*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      return (
        <span key={i} className="text-violet-600 font-medium">
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function AttachmentPreview({ att }: { att: { url: string; name: string; size: number; type: string } }) {
  const isImage = att.type.startsWith('image/');
  const sizeKb = Math.round(att.size / 1024);

  if (isImage) {
    return (
      <a href={att.url} target="_blank" rel="noopener noreferrer" className="block mt-1">
        <img
          src={att.url}
          alt={att.name}
          className="max-w-[200px] max-h-[150px] rounded-lg object-cover border border-[#E2E8F0]"
        />
      </a>
    );
  }

  return (
    <a
      href={att.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 mt-1 px-3 py-2 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0] hover:bg-[#EFF2F7] transition-colors max-w-xs"
    >
      <FileText className="w-4 h-4 text-[#6b7e9a] shrink-0" />
      <div className="min-w-0">
        <p className="text-xs font-medium text-[#0A2540] truncate">{att.name}</p>
        <p className="text-[10px] text-[#6b7e9a]">{sizeKb} KB</p>
      </div>
    </a>
  );
}

interface DaySeparatorProps {
  dateStr: string;
}

export function DaySeparator({ dateStr }: DaySeparatorProps) {
  return (
    <div className="my-5 flex items-center gap-3">
      <div className="flex-1 h-px bg-[#E2E8F0]" />
      <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-[#94a3b8] shadow-sm">{formatDate(dateStr)}</span>
      <div className="flex-1 h-px bg-[#E2E8F0]" />
    </div>
  );
}

export function MessageBubble({ message, isOwn, showAvatar, orgUsers }: MessageBubbleProps) {
  const initials = message.senderName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : 'flex-row'} ${!showAvatar ? (isOwn ? 'pr-11' : 'pl-11') : ''}`}>
      {showAvatar ? (
        <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#0A2540] text-xs font-bold text-white shadow-sm">
          {initials}
        </div>
      ) : null}

      <div className={`max-w-[70%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
        {showAvatar && (
          <div className={`mb-1 flex items-baseline gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
            <span className="text-xs font-semibold text-[#0A2540]">{message.senderName}</span>
            <span className="text-[10px] text-[#94a3b8]">{formatTime(message.createdAt)}</span>
          </div>
        )}

        {message.text && (
          <div
            className={`rounded-[22px] px-4 py-3 text-sm leading-relaxed shadow-sm ${
              isOwn
                ? 'rounded-tr-md bg-[#0A2540] text-white'
                : 'rounded-tl-md border border-slate-200 bg-white text-[#0A2540]'
            }`}
          >
            {renderTextWithMentions(message.text, orgUsers)}
          </div>
        )}

        {message.attachments.map((att, i) => (
          <AttachmentPreview key={i} att={att} />
        ))}

        {!showAvatar && (
          <span className="mt-1 text-[10px] text-[#94a3b8]">{formatTime(message.createdAt)}</span>
        )}
      </div>
    </div>
  );
}
