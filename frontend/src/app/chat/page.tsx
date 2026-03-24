'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare } from 'lucide-react';
import { getCurrentUser } from '@/lib/api';
import { getChatChannels } from '@/lib/api';
import { ChannelList } from '@/components/chat/channel-list';
import { MessageArea } from '@/components/chat/message-area';
import type { ChatChannel } from '@/lib/types';

export default function ChatPage() {
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);

  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: getCurrentUser,
  });

  const { data: channels = [] } = useQuery({
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

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <p className="text-[#94a3b8] text-sm">A carregar…</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-white">
      <ChannelList
        selectedId={selectedChannelId}
        onSelect={setSelectedChannelId}
        currentUserId={currentUser.id}
      />

      {selectedChannel ? (
        <MessageArea
          channel={selectedChannel}
          currentUserId={currentUser.id}
        />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center bg-[#F8FAFC]">
          <div className="w-16 h-16 rounded-full bg-[#EFF2F7] flex items-center justify-center mb-4">
            <MessageSquare className="w-8 h-8 text-[#6b7e9a]" />
          </div>
          <h2 className="text-[#0A2540] font-semibold text-lg mb-1">Chat da Equipa</h2>
          <p className="text-[#94a3b8] text-sm max-w-xs">
            Seleciona um canal na lista à esquerda ou cria um novo canal para começar.
          </p>
        </div>
      )}
    </div>
  );
}
