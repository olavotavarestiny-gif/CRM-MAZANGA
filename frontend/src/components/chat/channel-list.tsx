'use client';

import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Plus, Hash, MessageSquare } from 'lucide-react';
import { getChatChannels, getChatUsers, createDM } from '@/lib/api';
import { markChannelRead } from '@/lib/api';
import type { ChatChannel } from '@/lib/types';
import { CreateChannelModal } from './create-channel-modal';
import { cn } from '@/lib/utils';
import { ErrorState } from '@/components/ui/error-state';
import { useToast } from '@/components/ui/toast-provider';

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
        'w-full rounded-2xl border px-3.5 py-3 text-left text-sm transition-all',
        selected
          ? 'border-[#D6E4FF] bg-[#EEF4FF] text-[#0A2540] shadow-sm'
          : 'border-transparent text-[#6b7e9a] hover:border-slate-200 hover:bg-white hover:text-[#0A2540]'
      )}
    >
      {isDM ? (
        <div className={cn(
          'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
          selected ? 'bg-[#0A2540] text-white' : 'bg-[#E2E8F0] text-[#0A2540]'
        )}>
          {displayName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
        </div>
      ) : (
        <div className={cn(
          'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full',
          selected ? 'bg-[#0A2540] text-white' : 'bg-white text-[#526277]'
        )}>
          <Hash className="h-4 w-4" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <span className="block truncate font-medium">{displayName}</span>
        <span className="mt-0.5 block truncate text-[11px] text-[#94a3b8]">
          {isDM ? 'Mensagem directa' : 'Canal interno'}
        </span>
      </div>
      {channel.unreadCount > 0 && (
        <span className="min-w-[24px] rounded-full bg-[#0A2540] px-2 py-1 text-center text-[10px] font-bold leading-none text-white">
          {channel.unreadCount > 99 ? '99+' : channel.unreadCount}
        </span>
      )}
    </button>
  );
}

export function ChannelList({ selectedId, onSelect, currentUserId }: ChannelListProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [showDMPicker, setShowDMPicker] = useState(false);

  const { data: channels = [], isLoading, isError, refetch } = useQuery({
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
    onError: (error: any) => {
      toast({
        variant: 'error',
        title: 'Não foi possível abrir a conversa',
        description: error?.response?.data?.error || error?.message || 'Tenta novamente.',
      });
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
      <div className="flex h-full w-80 flex-shrink-0 flex-col border-r border-[#E2E8F0] bg-[#F8FAFC]">
        {/* Header */}
        <div className="border-b border-[#E2E8F0] px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white shadow-sm">
                <MessageSquare className="h-4 w-4 text-[#0A2540]" />
              </div>
              <div>
                <span className="block text-sm font-semibold text-[#0A2540]">Chat Equipa</span>
                <span className="block text-xs text-[#94a3b8]">Coordenação interna da operação</span>
              </div>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#6b7e9a] transition-colors hover:text-[#0A2540]"
              title="Criar canal"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-4 rounded-2xl bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">Estado</p>
            <p className="mt-1 text-sm font-medium text-[#0A2540]">
              {isLoading ? 'A carregar canais…' : `${channels.length} conversa${channels.length !== 1 ? 's' : ''} ativa${channels.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {/* Channels section */}
          <div>
            <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">Canais</p>
            <div className="space-y-2">
              {isLoading && Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="rounded-2xl border border-transparent bg-white px-3.5 py-3 shadow-sm">
                  <div className="flex animate-pulse items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-slate-200" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-24 rounded-full bg-slate-200" />
                      <div className="h-2.5 w-16 rounded-full bg-slate-100" />
                    </div>
                  </div>
                </div>
              ))}
              {isError && (
                <div className="rounded-2xl bg-white p-2 shadow-sm">
                  <ErrorState
                    compact
                    title="Erro ao carregar canais"
                    message="As conversas internas não responderam como esperado."
                    onRetry={() => refetch()}
                    secondaryAction={{ label: 'Ir para o Painel', href: '/' }}
                  />
                </div>
              )}
              {regularChannels.length === 0 && !isLoading && !isError && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-5 text-sm text-[#94a3b8] shadow-sm">
                  <p className="font-medium text-[#0A2540]">Sem canais ainda</p>
                  <p className="mt-1">
                    Cria o primeiro canal para organizar a coordenação interna da equipa.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowCreate(true)}
                    className="mt-3 text-sm font-medium text-[#0A2540] underline underline-offset-4"
                  >
                    Criar canal
                  </button>
                </div>
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
          </div>

          {/* DMs section */}
          <div>
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">Mensagens Directas</p>
              <button
                onClick={() => setShowDMPicker((v) => !v)}
                className="rounded-full p-1 text-[#94a3b8] transition-colors hover:bg-white hover:text-[#0A2540]"
                title="Nova mensagem directa"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* DM user picker */}
            {showDMPicker && (
              <div className="mb-2 overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm">
                {orgUsers
                  .filter((u) => u.id !== currentUserId)
                  .map((u) => (
                    <button
                      key={u.id}
                      onClick={() => dmMutation.mutate(u.id)}
                      disabled={dmMutation.isPending}
                      className="w-full px-3 py-2 text-left text-xs transition-colors hover:bg-[#F8FAFC]"
                    >
                      <p className="font-medium text-[#0A2540]">{u.name}</p>
                      <p className="mt-0.5 text-[11px] text-[#94a3b8]">{u.email}</p>
                    </button>
                  ))}
              </div>
            )}

            <div className="space-y-2">
              {dmChannels.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-4 text-xs text-[#94a3b8] shadow-sm">
                  <p className="font-medium text-[#0A2540]">Sem mensagens directas</p>
                  <p className="mt-1">Escolhe um colega para abrir uma conversa privada.</p>
                  <button
                    type="button"
                    onClick={() => setShowDMPicker(true)}
                    className="mt-3 text-sm font-medium text-[#0A2540] underline underline-offset-4"
                  >
                    Nova mensagem directa
                  </button>
                </div>
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
      </div>

      {showCreate && (
        <CreateChannelModal
          onClose={() => setShowCreate(false)}
          onCreated={(id) => { onSelect(id); }}
          channel={null}
        />
      )}
    </>
  );
}
