'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createContactGroup,
  deleteContactGroup,
  getContactGroups,
  updateContactGroup,
} from '@/lib/api';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ErrorState } from '@/components/ui/error-state';
import { useToast } from '@/components/ui/toast-provider';
import { Check, Pencil, Trash2, Users, X } from 'lucide-react';

interface ContactGroupsManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ContactGroupsManager({
  open,
  onOpenChange,
}: ContactGroupsManagerProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [newGroupName, setNewGroupName] = useState('');
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const invalidateGroups = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['contactGroups'] }),
      queryClient.invalidateQueries({ queryKey: ['contacts'] }),
      queryClient.invalidateQueries({ queryKey: ['contact'] }),
    ]);
  };

  const groupsQuery = useQuery({
    queryKey: ['contactGroups'],
    queryFn: getContactGroups,
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: () => createContactGroup({ name: newGroupName }),
    onSuccess: async () => {
      setNewGroupName('');
      await invalidateGroups();
      toast({
        variant: 'success',
        title: 'Grupo criado',
        description: 'O novo grupo já está disponível para os contactos.',
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'error',
        title: 'Falha ao criar grupo',
        description: error.message || 'Tenta novamente.',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => updateContactGroup(id, { name }),
    onSuccess: async () => {
      setEditingGroupId(null);
      setEditingName('');
      await invalidateGroups();
      toast({
        variant: 'success',
        title: 'Grupo atualizado',
        description: 'As alterações ao grupo foram guardadas.',
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'error',
        title: 'Falha ao atualizar grupo',
        description: error.message || 'Tenta novamente.',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteContactGroup,
    onSuccess: async (result) => {
      await invalidateGroups();
      toast({
        variant: 'success',
        title: 'Grupo removido',
        description:
          result.detachedContactsCount > 0
            ? `${result.detachedContactsCount} contacto(s) ficaram sem grupo.`
            : 'O grupo foi removido sem contactos associados.',
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'error',
        title: 'Falha ao remover grupo',
        description: error.message || 'Tenta novamente.',
      });
    },
  });

  const groups = groupsQuery.data ?? [];
  const isBusy = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <Modal
      open={open}
      onClose={() => onOpenChange(false)}
      title="Grupos de contactos"
      description="Cria, renomeia e remove grupos usados para organizar a tua base de contactos."
      size="md"
      scrollable
    >
      <div className="space-y-5">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-medium text-[#0A2540]">Novo grupo</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Ex: Anúncios, Prospecção ativa..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (newGroupName.trim()) {
                    createMutation.mutate();
                  }
                }
              }}
              disabled={createMutation.isPending}
            />
            <Button
              type="button"
              onClick={() => createMutation.mutate()}
              disabled={!newGroupName.trim() || createMutation.isPending}
              className="sm:w-auto"
            >
              Criar grupo
            </Button>
          </div>
        </div>

        {groupsQuery.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-14 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        ) : groupsQuery.isError ? (
          <ErrorState
            compact
            title="Não foi possível carregar os grupos"
            message={(groupsQuery.error as Error)?.message || 'Tenta novamente.'}
            onRetry={() => groupsQuery.refetch()}
          />
        ) : groups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-10 text-center">
            <Users className="mx-auto mb-3 h-8 w-8 text-[#6b7e9a]" />
            <p className="text-sm font-medium text-[#0A2540]">Ainda não existem grupos</p>
            <p className="mt-1 text-sm text-[#6b7e9a]">
              Cria o primeiro grupo para começar a organizar os contactos por origem ou segmento.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {groups.map((group) => {
              const isEditing = editingGroupId === group.id;
              return (
                <div
                  key={group.id}
                  className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center"
                >
                  {isEditing ? (
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (editingName.trim()) {
                            updateMutation.mutate({ id: group.id, name: editingName });
                          }
                        }
                        if (e.key === 'Escape') {
                          setEditingGroupId(null);
                          setEditingName('');
                        }
                      }}
                      disabled={updateMutation.isPending}
                      className="flex-1"
                    />
                  ) : (
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[#0A2540]">{group.name}</p>
                    </div>
                  )}

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {isEditing ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => updateMutation.mutate({ id: group.id, name: editingName })}
                          disabled={!editingName.trim() || updateMutation.isPending}
                        >
                          <Check className="mr-1.5 h-3.5 w-3.5" />
                          Guardar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingGroupId(null);
                            setEditingName('');
                          }}
                        >
                          <X className="mr-1.5 h-3.5 w-3.5" />
                          Cancelar
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingGroupId(group.id);
                            setEditingName(group.name);
                          }}
                        >
                          <Pencil className="mr-1.5 h-3.5 w-3.5" />
                          Renomear
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
                          disabled={isBusy}
                          onClick={() => {
                            const confirmed = window.confirm(
                              `Remover o grupo "${group.name}"? Os contactos associados vão ficar sem grupo.`
                            );
                            if (confirmed) {
                              deleteMutation.mutate(group.id);
                            }
                          }}
                        >
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                          Remover
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
