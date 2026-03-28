'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Settings2, Trash2, Users, Hash, MessageSquare } from 'lucide-react';
import { deleteChatChannel, getChatMessages, markChannelRead, getChatUsers, User } from '@/lib/api';
import { createClient } from '@/lib/supabase/client';
import { MessageBubble, DaySeparator } from './message-bubble';
import { MessageInput } from './message-input';
import { CreateChannelModal } from './create-channel-modal';
import type { ChatChannel, ChatMessage } from '@/lib/types';
import { ErrorState } from '@/components/ui/error-state';
import { useToast } from '@/components/ui/toast-provider';

interface MessageAreaProps {
  channel: ChatChannel;
  currentUserId: number;
  currentUser: User;
}

function isSameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

export function MessageArea({ channel, currentUserId, currentUser }: MessageAreaProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showManageModal, setShowManageModal] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: orgUsers = [] } = useQuery({
    queryKey: ['chat-users'],
    queryFn: getChatUsers,
  });

  const loadMessages = useCallback(async () => {
    setMessages([]);
    setHasMore(true);
    setIsInitialLoading(true);
    setLoadError(null);
    try {
      const msgs = await getChatMessages(channel.id);
      setMessages(msgs);
      setHasMore(msgs.length >= 50);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'auto' }), 50);
    } catch {
      setLoadError('Não foi possível carregar as mensagens deste canal.');
    } finally {
      setIsInitialLoading(false);
    }
  }, [channel.id]);

  // Initial load
  useEffect(() => {
    loadMessages();
    // Mark as read
    markChannelRead(channel.id).then(() => {
      queryClient.invalidateQueries({ queryKey: ['chat-channels'] });
      queryClient.invalidateQueries({ queryKey: ['chat-unread'] });
    });
  }, [channel.id, loadMessages, queryClient]);

  // Supabase Realtime broadcast
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase.channel(`chat-${channel.id}`, {
      config: { broadcast: { self: false } },
    });

    ch.on('broadcast', { event: 'new_message' }, ({ payload }) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === payload.message.id)) return prev;
        return [...prev, payload.message];
      });
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      markChannelRead(channel.id).then(() => {
        queryClient.invalidateQueries({ queryKey: ['chat-channels'] });
        queryClient.invalidateQueries({ queryKey: ['chat-unread'] });
      });
    }).subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [channel.id]);

  // Scroll-to-top to load older messages
  const handleScroll = useCallback(async () => {
    if (!containerRef.current || loadingOlder || !hasMore || messages.length === 0) return;
    if (containerRef.current.scrollTop > 60) return;

    const oldestId = messages[0]?.id;
    setLoadingOlder(true);
    try {
      const older = await getChatMessages(channel.id, oldestId);
      if (older.length === 0) { setHasMore(false); return; }
      const prevHeight = containerRef.current.scrollHeight;
      setMessages((prev) => [...older, ...prev]);
      setHasMore(older.length >= 50);
      // Preserve scroll position
      requestAnimationFrame(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = containerRef.current.scrollHeight - prevHeight;
        }
      });
    } catch {
      toast({
        variant: 'error',
        title: 'Falha ao carregar histórico',
        description: 'Não foi possível obter as mensagens anteriores deste canal.',
      });
    } finally {
      setLoadingOlder(false);
    }
  }, [channel.id, loadingOlder, hasMore, messages, toast]);

  useEffect(() => {
    const el = containerRef.current;
    el?.addEventListener('scroll', handleScroll);
    return () => el?.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const handleMessageSent = (msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

    // Broadcast to other members via Supabase
    const supabase = createClient();
    supabase.channel(`chat-${channel.id}`).send({
      type: 'broadcast',
      event: 'new_message',
      payload: { message: msg },
    });

    queryClient.invalidateQueries({ queryKey: ['chat-channels'] });
    queryClient.invalidateQueries({ queryKey: ['chat-unread'] });
  };

  const isDM = channel.type === 'dm';
  const otherMember = isDM
    ? channel.members.find((m) => m.userId !== currentUserId)
    : null;

  const memberCount = channel.members.length;
  const isChannelCreator = channel.createdById === currentUser.id && channel.members.some((member) => member.userId === currentUser.id);
  const canManageChannel = channel.type === 'channel' && (
    currentUser.isSuperAdmin ||
    currentUser.role === 'admin' ||
    !currentUser.accountOwnerId ||
    isChannelCreator
  );

  const deleteChannelMutation = useMutation({
    mutationFn: () => deleteChatChannel(channel.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['chat-channels'] });
      await queryClient.invalidateQueries({ queryKey: ['chat-unread'] });
      toast({
        variant: 'success',
        title: 'Canal eliminado',
        description: 'A conversa foi removida com sucesso.',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'error',
        title: 'Não foi possível eliminar o canal',
        description: error?.response?.data?.error || error?.message || 'Tenta novamente.',
      });
    },
  });

  const handleDeleteChannel = () => {
    if (!window.confirm(`Eliminar o canal "${channel.name}"? Esta ação remove também o histórico de mensagens.`)) {
      return;
    }
    deleteChannelMutation.mutate();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center gap-3 border-b border-[#E2E8F0] bg-white px-5 py-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EFF2F7]">
          {isDM ? (
            <span className="text-sm font-bold text-[#0A2540]">
              {(otherMember?.name || channel.name).split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
            </span>
          ) : (
            <Hash className="w-4 h-4 text-[#0A2540]" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold leading-tight text-[#0A2540]">
            {isDM ? (otherMember?.name || channel.name) : channel.name}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[#94a3b8]">
            {!isDM && (
              <p className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {memberCount} {memberCount === 1 ? 'membro' : 'membros'}
              </p>
            )}
            {channel.description && <p className="truncate">{channel.description}</p>}
          </div>
        </div>
        <div className="hidden rounded-full bg-[#F8FAFC] px-3 py-1.5 text-xs font-medium text-[#526277] md:block">
          {isDM ? 'Mensagem directa' : 'Canal interno'}
        </div>
        {canManageChannel && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowManageModal(true)}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-[#526277] transition-colors hover:bg-[#F8FAFC]"
            >
              <Settings2 className="h-3.5 w-3.5" />
              Gerir
            </button>
            <button
              type="button"
              onClick={handleDeleteChannel}
              disabled={deleteChannelMutation.isPending}
              className="inline-flex items-center gap-1 rounded-xl border border-red-200 px-3 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60"
            >
              {deleteChannelMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              Eliminar
            </button>
          </div>
        )}
      </div>

      {/* Messages */}
      <div ref={containerRef} className="flex-1 space-y-1 overflow-y-auto bg-[#FCFDFE] px-5 py-5">
        {loadingOlder && (
          <p className="text-center text-xs text-[#94a3b8] py-2">A carregar mensagens anteriores…</p>
        )}

        {isInitialLoading && (
          <div className="space-y-4 py-6">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className={`flex gap-3 ${index % 2 === 0 ? '' : 'justify-end'}`}>
                {index % 2 === 0 && <div className="h-8 w-8 animate-pulse rounded-full bg-slate-200" />}
                <div className="max-w-[70%] space-y-2">
                  <div className="h-3 w-20 animate-pulse rounded-full bg-slate-200" />
                  <div className="h-16 animate-pulse rounded-3xl bg-white shadow-sm" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isInitialLoading && loadError && (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <div className="max-w-md">
              <ErrorState
                title="Erro ao abrir a conversa"
                message={loadError}
                onRetry={() => loadMessages()}
                secondaryAction={{ label: 'Voltar ao chat', href: '/chat' }}
              />
            </div>
          </div>
        )}

        {!isInitialLoading && !loadError && messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center py-16 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#EFF2F7]">
              <MessageSquare className="h-7 w-7 text-[#6b7e9a]" />
            </div>
            <p className="text-base font-semibold text-[#0A2540]">Sem mensagens ainda</p>
            <p className="mt-1 max-w-xs text-sm text-[#94a3b8]">
              Este canal está pronto para começar. A primeira mensagem fica logo visível para toda a equipa.
            </p>
          </div>
        )}

        {!isInitialLoading && !loadError && messages.map((msg, i) => {
          const prev = messages[i - 1];
          const showDaySep = !prev || !isSameDay(prev.createdAt, msg.createdAt);
          const isSameSender = prev && prev.senderId === msg.senderId && !showDaySep;
          const isOwn = msg.senderId === currentUserId;

          return (
            <div key={msg.id}>
              {showDaySep && <DaySeparator dateStr={msg.createdAt} />}
              <MessageBubble
                message={msg}
                isOwn={isOwn}
                showAvatar={!isSameSender}
                orgUsers={orgUsers}
              />
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <MessageInput channelId={channel.id} onMessageSent={handleMessageSent} />

      {showManageModal && (
        <CreateChannelModal
          channel={channel}
          onClose={() => setShowManageModal(false)}
          onCreated={() => setShowManageModal(false)}
        />
      )}
    </div>
  );
}
