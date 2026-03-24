'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Users, Hash, MessageSquare } from 'lucide-react';
import { getChatMessages, markChannelRead, getChatUsers } from '@/lib/api';
import { createClient } from '@/lib/supabase/client';
import { MessageBubble, DaySeparator } from './message-bubble';
import { MessageInput } from './message-input';
import type { ChatChannel, ChatMessage } from '@/lib/types';

interface MessageAreaProps {
  channel: ChatChannel;
  currentUserId: number;
}

function isSameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

export function MessageArea({ channel, currentUserId }: MessageAreaProps) {
  const queryClient = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: orgUsers = [] } = useQuery({
    queryKey: ['chat-users'],
    queryFn: getChatUsers,
  });

  // Initial load
  useEffect(() => {
    setMessages([]);
    setHasMore(true);
    getChatMessages(channel.id).then((msgs) => {
      setMessages(msgs);
      setHasMore(msgs.length >= 50);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'instant' }), 50);
    });

    // Mark as read
    markChannelRead(channel.id).then(() => {
      queryClient.invalidateQueries({ queryKey: ['chat-channels'] });
      queryClient.invalidateQueries({ queryKey: ['chat-unread'] });
    });
  }, [channel.id]);

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
    } finally {
      setLoadingOlder(false);
    }
  }, [channel.id, loadingOlder, hasMore, messages]);

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

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#E2E8F0] bg-white flex-shrink-0">
        <div className="w-8 h-8 rounded-full bg-[#EFF2F7] flex items-center justify-center">
          {isDM ? (
            <span className="text-sm font-bold text-[#0A2540]">
              {(otherMember?.name || channel.name).split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
            </span>
          ) : (
            <Hash className="w-4 h-4 text-[#0A2540]" />
          )}
        </div>
        <div>
          <h2 className="font-semibold text-[#0A2540] text-sm leading-tight">
            {isDM ? (otherMember?.name || channel.name) : channel.name}
          </h2>
          {!isDM && (
            <p className="text-xs text-[#94a3b8] flex items-center gap-1">
              <Users className="w-3 h-3" />
              {memberCount} {memberCount === 1 ? 'membro' : 'membros'}
            </p>
          )}
          {channel.description && (
            <p className="text-xs text-[#94a3b8]">{channel.description}</p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {loadingOlder && (
          <p className="text-center text-xs text-[#94a3b8] py-2">A carregar mensagens anteriores…</p>
        )}

        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <div className="w-12 h-12 rounded-full bg-[#EFF2F7] flex items-center justify-center mb-3">
              <MessageSquare className="w-6 h-6 text-[#6b7e9a]" />
            </div>
            <p className="text-[#0A2540] font-medium">Sem mensagens ainda</p>
            <p className="text-[#94a3b8] text-sm mt-1">Sê o primeiro a escrever algo!</p>
          </div>
        )}

        {messages.map((msg, i) => {
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
    </div>
  );
}
