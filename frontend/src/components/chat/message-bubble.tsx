'use client';

import Link from 'next/link';
import { CheckCheck, ClipboardCheck, FileText } from 'lucide-react';
import type { ChatMessage } from '@/lib/types';

interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  showAvatar: boolean;
  showReadReceipt?: boolean;
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

function renderTextWithMentions(text: string) {
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
          className="max-h-[150px] max-w-[min(220px,75vw)] rounded-lg border border-[#E2E8F0] object-cover"
        />
      </a>
    );
  }

  return (
    <a
      href={att.url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1 flex max-w-[min(20rem,78vw)] items-center gap-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 transition-colors hover:bg-[#EFF2F7]"
    >
      <FileText className="w-4 h-4 text-[#6b7e9a] shrink-0" />
      <div className="min-w-0">
        <p className="text-xs font-medium text-[#0A2540] truncate">{att.name}</p>
        <p className="text-[10px] text-[#6b7e9a]">{sizeKb} KB</p>
      </div>
    </a>
  );
}

function TaskAssignmentCard({ message, isOwn }: { message: ChatMessage; isOwn: boolean }) {
  const metadata = message.metadata;
  if (metadata?.type !== 'task_assignment') return null;

  const taskTitle = metadata.taskTitle || 'Nova tarefa';
  const assignedByName = metadata.assignedByName || message.senderName;
  const href = metadata.href || (metadata.taskId ? `/tasks?taskId=${metadata.taskId}` : '/tasks');

  return (
    <div
      className={`mt-1 w-full max-w-[min(22rem,78vw)] rounded-2xl border p-3 shadow-sm ${
        isOwn
          ? 'border-slate-700 bg-slate-900 text-white'
          : 'border-amber-200 bg-amber-50 text-[#0A2540]'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
            isOwn ? 'bg-white/10 text-white' : 'bg-amber-100 text-amber-700'
          }`}
        >
          <ClipboardCheck className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${isOwn ? 'text-white/60' : 'text-amber-700'}`}>
            Nova tarefa
          </p>
          <p className="mt-1 truncate text-sm font-semibold">{taskTitle}</p>
          <p className={`mt-1 text-xs ${isOwn ? 'text-white/60' : 'text-[#6b7e9a]'}`}>
            Atribuída por {assignedByName}
          </p>
          <Link
            href={href}
            className={`mt-3 inline-flex items-center justify-center rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
              isOwn
                ? 'bg-white text-[#0A2540] hover:bg-white/90'
                : 'bg-[#0A2540] text-white hover:bg-[#0A2540]/90'
            }`}
          >
            Ver tarefa
          </Link>
        </div>
      </div>
    </div>
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

export function MessageBubble({ message, isOwn, showAvatar, showReadReceipt = false }: MessageBubbleProps) {
  const initials = message.senderName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  const isTaskAssignment = message.metadata?.type === 'task_assignment';

  return (
    <div className={`flex gap-2 md:gap-3 ${isOwn ? 'flex-row-reverse' : 'flex-row'} ${!showAvatar ? (isOwn ? 'pr-8 md:pr-11' : 'pl-8 md:pl-11') : ''}`}>
      {showAvatar ? (
        <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#0A2540] text-xs font-bold text-white shadow-sm">
          {initials}
        </div>
      ) : null}

      <div className={`max-w-[82%] md:max-w-[70%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
        {showAvatar && (
          <div className={`mb-1 flex items-baseline gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
            <span className="text-xs font-semibold text-[#0A2540]">{message.senderName}</span>
            <span className="text-[10px] text-[#94a3b8]">{formatTime(message.createdAt)}</span>
          </div>
        )}

        {message.text && !isTaskAssignment && (
          <div
            className={`rounded-[22px] px-4 py-3 text-sm leading-relaxed shadow-sm break-words ${
              isOwn
                ? 'rounded-tr-md bg-[#0A2540] text-white'
                : 'rounded-tl-md border border-slate-200 bg-white text-[#0A2540]'
            }`}
          >
            {renderTextWithMentions(message.text)}
          </div>
        )}

        {isTaskAssignment && <TaskAssignmentCard message={message} isOwn={isOwn} />}

        {message.attachments.map((att, i) => (
          <AttachmentPreview key={i} att={att} />
        ))}

        {!showAvatar && (
          <span className="mt-1 text-[10px] text-[#94a3b8]">{formatTime(message.createdAt)}</span>
        )}
        {showReadReceipt && message.readByOtherAt && (
          <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-[#94a3b8]">
            <CheckCheck className="h-3 w-3" />
            Visto {formatTime(message.readByOtherAt)}
          </span>
        )}
      </div>
    </div>
  );
}
