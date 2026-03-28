'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare, Radio } from 'lucide-react';
import { getCurrentUser } from '@/lib/api';
import { getChatChannels } from '@/lib/api';
import { ChannelList } from '@/components/chat/channel-list';
import { MessageArea } from '@/components/chat/message-area';
import { ErrorState } from '@/components/ui/error-state';

export default function ChatPage() {
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);

  const { data: currentUser, isLoading: userLoading, isError: userError } = useQuery({
    queryKey: ['current-user'],
    queryFn: getCurrentUser,
    retry: false,
  });

  const { data: channels = [], isLoading: channelsLoading, isError: channelsError, refetch: refetchChannels } = useQuery({
    queryKey: ['chat-channels'],
    queryFn: getChatChannels,
    enabled: !!currentUser,
  });

  // Auto-select first channel
  useEffect(() => {
    if (!selectedChannelId && channels.length > 0) {
      setSelectedChannelId(channels[0].id);
    }
  }, [channels, selectedChannelId]);

  const selectedChannel = channels.find((c) => c.id === selectedChannelId) ?? null;

  if (userLoading) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6">
        <div className="space-y-2">
          <div className="h-10 w-52 animate-pulse rounded-2xl bg-slate-200" />
          <div className="h-4 w-80 animate-pulse rounded-full bg-slate-100" />
        </div>
        <div className="h-[calc(100vh-15rem)] animate-pulse rounded-[28px] border border-slate-200 bg-white shadow-sm" />
      </div>
    );
  }

  if (!currentUser || userError) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#2c2f31]">Conversas</h1>
          <p className="mt-1 text-sm text-[#6b7e9a]">
            Canais internos, acompanhamento em tempo real e contexto da equipa.
          </p>
        </div>
        <div className="flex h-[calc(100vh-15rem)] items-center justify-center rounded-[28px] border border-red-200 bg-white px-6 text-center shadow-sm">
          <div className="max-w-md">
            <ErrorState
              title="Não foi possível carregar o chat"
              message="O estado da sessão ou os canais não responderam como esperado."
              onRetry={() => {
                refetchChannels();
              }}
              secondaryAction={{ label: 'Ir para Painel', href: '/' }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#2c2f31]">Conversas</h1>
          <p className="mt-1 text-sm text-[#6b7e9a]">
            Canais internos, acompanhamento em tempo real e contexto da equipa.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-[#526277] shadow-sm">
            <Radio className="h-3.5 w-3.5 text-emerald-500" />
            Comunicação interna em tempo real
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-[#F8FAFC] px-4 py-2 text-xs font-medium text-[#64748B]">
            {channelsLoading ? 'A carregar canais…' : `${channels.length} conversa${channels.length !== 1 ? 's' : ''} disponível${channels.length !== 1 ? 'eis' : ''}`}
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-15rem)] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <ChannelList
          selectedId={selectedChannelId}
          onSelect={setSelectedChannelId}
          currentUserId={currentUser.id}
        />

        {selectedChannel ? (
          <MessageArea
            channel={selectedChannel}
            currentUserId={currentUser.id}
            currentUser={currentUser}
          />
        ) : channelsError ? (
          <div className="flex flex-1 flex-col items-center justify-center bg-[#FBFDFF] px-6 text-center">
            <div className="max-w-md">
              <ErrorState
                title="Erro ao carregar conversas"
                message="Não foi possível obter a lista de canais."
                onRetry={() => refetchChannels()}
                secondaryAction={{ label: 'Ir para Painel', href: '/' }}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center bg-[#FBFDFF] px-6 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#EFF2F7]">
              <MessageSquare className="h-8 w-8 text-[#6b7e9a]" />
            </div>
            <h2 className="mb-1 text-lg font-semibold text-[#0A2540]">Chat da Equipa</h2>
            <p className="max-w-xs text-sm text-[#94a3b8]">
              {channelsLoading
                ? 'Estamos a preparar as tuas conversas.'
                : 'Seleciona um canal na lista à esquerda ou cria um novo canal para começar.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
