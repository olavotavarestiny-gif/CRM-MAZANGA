'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createChatChannel, getChatUsers } from '@/lib/api';
import { PlanLimitModal } from './plan-limit-modal';

interface CreateChannelModalProps {
  onClose: () => void;
  onCreated: (channelId: string) => void;
}

export function CreateChannelModal({ onClose, onCreated }: CreateChannelModalProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [search, setSearch] = useState('');
  const [limitError, setLimitError] = useState<{
    feature: string; featureLabel: string; current: number; limit: number; plan: string;
  } | null>(null);

  const { data: users = [] } = useQuery({
    queryKey: ['chat-users'],
    queryFn: getChatUsers,
  });

  const mutation = useMutation({
    mutationFn: () => createChatChannel({ name: name.trim(), description: description.trim() || undefined, memberIds: selectedIds }),
    onSuccess: (channel) => {
      queryClient.invalidateQueries({ queryKey: ['chat-channels'] });
      onCreated(channel.id);
      onClose();
    },
    onError: (err: any) => {
      if (err?.response?.status === 429) {
        const d = err.response.data;
        setLimitError({ feature: d.feature, featureLabel: 'canais', current: d.current, limit: d.limit, plan: d.plan });
      }
    },
  });

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const toggleUser = (id: number) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  if (limitError) {
    return (
      <PlanLimitModal
        {...limitError}
        onClose={() => setLimitError(null)}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-2">
            <Hash className="w-5 h-5 text-[#0A2540]" />
            <h2 className="text-[#0A2540] font-semibold text-lg">Criar Canal</h2>
          </div>
          <button onClick={onClose} className="text-[#6b7e9a] hover:text-[#0A2540] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div>
            <Label htmlFor="channel-name">Nome *</Label>
            <Input
              id="channel-name"
              placeholder="ex: marketing"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="channel-desc">Descrição (opcional)</Label>
            <Input
              id="channel-desc"
              placeholder="Para que serve este canal?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label>Membros da equipa</Label>
            <Input
              placeholder="Pesquisar por nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mt-1 mb-2"
            />
            <div className="max-h-40 overflow-y-auto border border-[#E2E8F0] rounded-lg divide-y divide-[#F1F5F9]">
              {filteredUsers.length === 0 && (
                <p className="text-sm text-[#94a3b8] p-3">Nenhum membro encontrado</p>
              )}
              {filteredUsers.map((u) => (
                <label
                  key={u.id}
                  className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-[#F8FAFC] transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(u.id)}
                    onChange={() => toggleUser(u.id)}
                    className="rounded"
                  />
                  <div>
                    <p className="text-sm font-medium text-[#0A2540]">{u.name}</p>
                    <p className="text-xs text-[#94a3b8]">{u.email}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-[#E2E8F0]">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            className="flex-1 bg-[#0A2540] hover:bg-[#0A2540]/90 text-white"
            disabled={!name.trim() || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Criando...' : 'Criar Canal'}
          </Button>
        </div>
      </div>
    </div>
  );
}
