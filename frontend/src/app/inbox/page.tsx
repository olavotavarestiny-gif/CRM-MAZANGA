'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getConversations, getContacts } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import ChatWindow from '@/components/inbox/chat-window';
import { formatDistanceToNow } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Plus } from 'lucide-react';

export default function InboxPage() {
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const [newConvoOpen, setNewConvoOpen] = useState(false);
  const [search, setSearch] = useState('');

  const { data: conversations = [] } = useQuery({
    queryKey: ['inbox'],
    queryFn: () => getConversations(),
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  const { data: allContacts = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => getContacts(),
    enabled: newConvoOpen,
  });

  const filteredContacts = useMemo(() => {
    return allContacts.filter(
      (contact: any) =>
        contact.name?.toLowerCase().includes(search.toLowerCase()) ||
        contact.phone?.includes(search) ||
        (contact.company || '').toLowerCase().includes(search.toLowerCase())
    );
  }, [allContacts, search]);

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-3xl font-bold mb-6 text-[#0A2540]">Conversas</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className={`col-span-1 ${selectedContactId ? 'hidden md:block' : 'block'}`}>
          <Card className="p-4 bg-gray-50 border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Conversas</h2>
              <Dialog open={newConvoOpen} onOpenChange={setNewConvoOpen}>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setNewConvoOpen(true)}
                  className="h-8 w-8 p-0"
                >
                  <Plus className="w-4 h-4" />
                </Button>
                <DialogContent className="bg-gray-50 border-gray-200">
                  <DialogHeader>
                    <DialogTitle className="text-gray-900">Nova Conversa</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <Input
                      placeholder="Pesquisar contacto..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="bg-gray-100 border-gray-300 text-gray-900"
                    />
                    <div className="max-h-48 overflow-y-auto space-y-2">
                      {filteredContacts.length === 0 ? (
                        <p className="text-sm text-gray-400">Sem contactos encontrados</p>
                      ) : (
                        filteredContacts.map((contact: any) => (
                          <button
                            key={contact.id}
                            onClick={() => {
                              setSelectedContactId(contact.id);
                              setNewConvoOpen(false);
                              setSearch('');
                            }}
                            className="w-full p-3 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 text-left transition"
                          >
                            <p className="font-medium text-sm text-gray-900">{contact.name}</p>
                            <p className="text-xs text-gray-400">{contact.phone}</p>
                            {contact.company && (
                              <p className="text-xs text-gray-500">{contact.company}</p>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="space-y-2">
              {conversations.length === 0 ? (
                <p className="text-sm text-gray-400">Sem conversas</p>
              ) : (
                conversations.map((contact: any) => (
                  <div
                    key={contact.id}
                    onClick={() => setSelectedContactId(contact.id)}
                    className={`p-3 rounded-lg cursor-pointer transition ${
                      selectedContactId === contact.id
                        ? 'bg-red-50 border border-red-200'
                        : 'hover:bg-gray-50 border border-transparent'
                    }`}
                  >
                    <p className="font-medium text-sm text-gray-900">{contact.name}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {contact.messages[0]?.text?.substring(0, 50)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {contact.messages[0]?.timestamp && formatDistanceToNow(new Date(contact.messages[0].timestamp), { locale: pt, addSuffix: true })}
                    </p>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <div className={`col-span-3 ${!selectedContactId ? 'hidden md:block' : 'block'}`}>
          {selectedContactId ? (
            <>
              <div className="md:hidden mb-4">
                <button
                  onClick={() => setSelectedContactId(null)}
                  className="flex items-center gap-2 text-sm text-[#0A2540] hover:text-[#0d3060] transition"
                >
                  ← Voltar
                </button>
              </div>
              <ChatWindow
                contactId={selectedContactId.toString()}
                defaultMode={
                  conversations.some((c: any) => c.id === selectedContactId) ? 'text' : 'template'
                }
              />
            </>
          ) : (
            <Card className="p-8 text-center text-gray-400 bg-gray-50 border-gray-200">
              Selecione uma conversa
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
