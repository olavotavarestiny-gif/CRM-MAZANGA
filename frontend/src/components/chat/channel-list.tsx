'use client';

import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Plus, Hash, MessageSquare } from 'lucide-react';
import { getChatChannels, getChatUsers, createDM } from '@/lib/api';
import { markChannelRead } from '@/lib/api';
import type { ChatChannel } from '@/lib/types';
import { CreateChannelModal } from './create-channel-modal';
import { cn } from '@/lib/utils';

interface ChannelListProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
  currentUserId: number;
}

function ChannelItem({
  channel,
  selected,
  onClick,
  currentUserId,
}: {
  channel: ChatChannel;
  selected: boolean;
  onClick: () => void;
  currentUserId: number;
}) {
  const isDM = channel.type === 'dm';
  const otherMember = isDM
    ? channel.members.find((m) => m.userId !== currentUserId)
    : null;
  const displayName = isDM ? (otherMember?.name || channel.name) : channel.name;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-left transition-colors text-sm',
        selected
          ? 'bg-[#0A2540]/10 text-[#0A2540] font-semibold'
          : 'text-[#6b7e9a] hover:bg-[#0A2540]/5 hover:text-[#0A2540]'
      )}
    >
      {isDM ? (
        <div className="w-5 h-5 rounded-full bg-[#E2E8F0] flex items-center justify-center text-[10px] font-bold text-[#0A2540] flex-shrink-0">
          {displayName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
        </div>
      ) : (
        <Hash className="w-3.5 h-3.5 flex-shrink-0" />
      )}
      <span className="flex-1 truncate">{displayName}</span>
      {channel.unreadCount > 0 && (
        <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none min-w-[18px] text-center">
          {channel.unreadCount > 99 ? '99+' : channel.unreadCount}
        </span>
      )}
    </button>
  );
}

export function ChannelList({ selectedId, onSelect, currentUserId }: ChannelListProps) {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [showDMPicker, setShowDMPicker] = useState(false);

  const { data: channels = [], isLoading } = useQuery({
    queryKey: ['chat-channels'],
    queryFn: getChatChannels,
    refetchInterval: 10_000,
  });

  const { data: orgUsers = [] } = useQuery({
    queryKey: ['chat-users'],
    queryFn: getChatUsers,
    enabled: showDMPicker,
  });

  const dmMutation = useMutation({
    mutationFn: (targetUserId: number) => createDM(targetUserId),
    onSuccess: (channel) => {
      queryClient.invalidateQueries({ queryKey: ['chat-channels'] });
      onSelect(channel.id);
      setShowDMPicker(false);
    },
  });

  const handleSelect = (channel: ChatChannel) => {
    onSelect(channel.id);
    markChannelRead(channel.id).then(() => {
      queryClient.invalidateQueries({ queryKey: ['chat-channels'] });
      queryClient.invalidateQueries({ queryKey: ['chat-unread'] });
    });
  };

  const regularChannels = channels.filter((c) => c.type === 'channel');
  const dmChannels = channels.filter((c) => c.type === 'dm');

  return (
    <>
      <div className="w-56 flex-shrink-0 border-r border-[#E2E8F0] bg-[#F8FAFC] flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-3 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#0A2540]" />
            <span className="font-semibold text-[#0A2540] text-sm">Chat Equipa</span>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="w-6 h-6 flex items-center justify-center rounded-md text-[#6b7e9a] hover:text-[#0A2540] hover:bg-[#E2E8F0] transition-colors"
            title="Criar canal"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
          {/* Channels section */}
          <div>
            <p className="text-[10px] font-semibold text-[#94a3b8] uppercase tracking-wider px-1 mb-1">Canais</p>
            {isLoading && <p className="text-xs text-[#94a3b8] px-1">A carregar…</p>}
            {regularChannels.length === 0 && !isLoading && (
              <p className="text-xs text-[#94a3b8] px-1">Sem canais. Cria um!</p>
            )}
            {regularChannels.map((ch) => (
              <ChannelItem
                key={ch.id}
                channel={ch}
                selected={selectedId === ch.id}
                onClick={() => handleSelect(ch)}
                currentUserId={currentUserId}
              />
            ))}
          </div>

          {/* DMs section */}
          <div>
            <div className="flex items-center justify-between px-1 mb-1">
              <p className="text-[10px] font-semibold text-[#94a3b8] uppercase tracking-wider">Mensagens Directas</p>
              <button
                onClick={() => setShowDMPicker((v) => !v)}
                className="text-[#94a3b8] hover:text-[#0A2540] transition-colors"
                title="Nova mensagem directa"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* DM user picker */}
            {showDMPicker && (
              <div className="mb-2 bg-white border border-[#E2E8F0] rounded-lg shadow-sm overflow-hidden">
                {orgUsers
                  .filter((u) => u.id !== currentUserId)
                  .map((u) => (
                    <button
                      key={u.id}
                      onClick={() => dmMutation.mutate(u.id)}
                      disabled={dmMutation.isPending}
                      className="w-full text-left px-3 py-2 hover:bg-[#F8FAFC] transition-colors text-xs"
                    >
                      <p className="font-medium text-[#0A2540]">{u.name}</p>
                    </button>
                  ))}
              </div>
            )}

            {dmChannels.length === 0 && (
              <p className="text-xs text-[#94a3b8] px-1">Sem mensagens directas.</p>
            )}
            {dmChannels.map((ch) => (
              <ChannelItem
                key={ch.id}
                channel={ch}
                selected={selectedId === ch.id}
                onClick={() => handleSelect(ch)}
                currentUserId={currentUserId}
              />
            ))}
          </div>
        </div>
      </div>

      {showCreate && (
        <CreateChannelModal
          onClose={() => setShowCreate(false)}
          onCreated={(id) => { onSelect(id); }}
        />
      )}
    </>
  );
}
