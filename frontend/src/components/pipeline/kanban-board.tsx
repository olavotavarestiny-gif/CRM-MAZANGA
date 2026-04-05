'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Contact, PipelineStage } from '@/lib/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateContact } from '@/lib/api';
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from '@hello-pangea/dnd';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Check, GripVertical, Pencil, X } from 'lucide-react';

function formatKz(value?: number | null) {
  if (value === null || value === undefined || value <= 0) {
    return 'Sem valor';
  }

  return `${new Intl.NumberFormat('pt-PT').format(Math.round(value))} Kz`;
}

export default function KanbanBoard({
  contacts,
  stages,
}: {
  contacts: Contact[];
  stages: PipelineStage[];
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedStage, setSelectedStage] = useState<string>(stages[0]?.name ?? '');
  const [editingValueContactId, setEditingValueContactId] = useState<number | null>(null);
  const [dealValueDraft, setDealValueDraft] = useState('');

  const updateMutation = useMutation({
    mutationFn: (params: { id: number; stage: string }) =>
      updateContact(params.id.toString(), { stage: params.stage }),
    onMutate: async ({ id, stage }) => {
      await queryClient.cancelQueries({ queryKey: ['contacts', 'pipeline'] });
      const previous = queryClient.getQueryData<Contact[]>(['contacts', 'pipeline']);
      queryClient.setQueryData<Contact[]>(['contacts', 'pipeline'], (old = []) =>
        old.map((c) => c.id === id ? { ...c, stage } : c)
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['contacts', 'pipeline'], context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) =>
      updateContact(id.toString(), { inPipeline: false }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['contacts', 'pipeline'] });
      const previous = queryClient.getQueryData<Contact[]>(['contacts', 'pipeline']);
      queryClient.setQueryData<Contact[]>(['contacts', 'pipeline'], (old = []) =>
        old.filter((c) => c.id !== id)
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['contacts', 'pipeline'], context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });

  const valueMutation = useMutation({
    mutationFn: ({ id, dealValueKz }: { id: number; dealValueKz: number | null }) =>
      updateContact(id.toString(), { dealValueKz }),
    onMutate: async ({ id, dealValueKz }) => {
      await queryClient.cancelQueries({ queryKey: ['contacts', 'pipeline'] });
      const previous = queryClient.getQueryData<Contact[]>(['contacts', 'pipeline']);
      queryClient.setQueryData<Contact[]>(['contacts', 'pipeline'], (old = []) =>
        old.map((contact) => (
          contact.id === id ? { ...contact, dealValueKz } : contact
        ))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['contacts', 'pipeline'], context.previous);
    },
    onSettled: () => {
      setEditingValueContactId(null);
      setDealValueDraft('');
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });

  const startValueEdit = (contact: Contact) => {
    setEditingValueContactId(contact.id);
    setDealValueDraft(
      contact.dealValueKz !== null && contact.dealValueKz !== undefined ? String(contact.dealValueKz) : ''
    );
  };

  const submitValueEdit = (contactId: number) => {
    const trimmed = dealValueDraft.trim();
    valueMutation.mutate({
      id: contactId,
      dealValueKz: trimmed ? Number(trimmed) : null,
    });
  };

  const handleDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;
    const contactId = parseInt(draggableId.split('-')[1]);
    updateMutation.mutate({ id: contactId, stage: destination.droppableId });
  };

  if (stages.length === 0) {
    return (
      <div className="text-center py-16 text-[#6b7e9a]">
        Sem etapas configuradas. Clique em &quot;Gerir Etapas&quot; para adicionar.
      </div>
    );
  }

  return (
    <>
      {/* Mobile View */}
      <div className="md:hidden space-y-4">
        <div className="px-4">
          <Select value={selectedStage} onValueChange={setSelectedStage}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {stages.map((stage) => (
                <SelectItem key={stage.id} value={stage.name}>
                  {stage.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="px-4 space-y-2">
          {contacts
            .filter((c) => c.stage === selectedStage)
            .map((contact) => (
              <Card
                key={contact.id}
                className="p-3 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => router.push(`/contacts/${contact.id}`)}
              >
                <p className="font-medium text-sm text-[#0A2540]">{contact.name}</p>
                <p className="text-xs text-[#6b7e9a]">{contact.company}</p>
                <p className="text-xs text-[#6b7e9a]">{contact.phone}</p>
                <div className="mt-2 flex items-center gap-2">
                  {editingValueContactId === contact.id ? (
                    <>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={dealValueDraft}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => setDealValueDraft(event.target.value)}
                        className="h-7 text-xs"
                        placeholder="Valor em Kz"
                      />
                      <button
                        type="button"
                        className="text-green-600"
                        onClick={(event) => {
                          event.stopPropagation();
                          submitValueEdit(contact.id);
                        }}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="text-slate-500"
                        onClick={(event) => {
                          event.stopPropagation();
                          setEditingValueContactId(null);
                          setDealValueDraft('');
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-xs font-medium text-[#0A2540]">
                        {formatKz(contact.dealValueKz)}
                      </span>
                      <button
                        type="button"
                        className="text-slate-400"
                        onClick={(event) => {
                          event.stopPropagation();
                          startValueEdit(contact);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
                {contact.sector && (
                  <Badge variant="outline" className="text-xs mt-2">
                    {contact.sector}
                  </Badge>
                )}
              </Card>
            ))}
          {contacts.filter((c) => c.stage === selectedStage).length === 0 && (
            <p className="text-center text-[#6b7e9a] py-8">Nenhum contacto nesta etapa</p>
          )}
        </div>
      </div>

      {/* Desktop View */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div
          className="hidden md:grid gap-4"
          style={{ gridTemplateColumns: `repeat(${Math.min(stages.length, 4)}, minmax(0, 1fr))` }}
        >
          {stages.map((stage) => {
            const stageContacts = contacts.filter((c) => c.stage === stage.name);
            return (
              <div key={stage.id} className="bg-[#f5f7fa] border border-[#dde3ec] rounded-xl p-4 min-h-96">
                <div className="mb-4 flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: stage.color }}
                  />
                  <h3 className="font-semibold text-[#0A2540] text-sm">
                    {stage.name}
                    <span className="ml-1.5 text-[#6b7e9a] font-normal">({stageContacts.length})</span>
                  </h3>
                </div>

                <Droppable droppableId={stage.name}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`space-y-2 min-h-48 ${
                        snapshot.isDraggingOver ? 'bg-blue-50 border border-blue-200 rounded-lg p-1' : ''
                      }`}
                    >
                      {stageContacts.map((contact, index) => (
                        <Draggable
                          key={contact.id}
                          draggableId={`contact-${contact.id}`}
                          index={index}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={snapshot.isDragging ? 'opacity-50' : 'opacity-100'}
                            >
                              <Card
                                className="p-3 hover:shadow-md transition-shadow cursor-pointer"
                                onClick={() => {
                                  if (!snapshot.isDragging) {
                                    router.push(`/contacts/${contact.id}`);
                                  }
                                }}
                              >
                                <div className="flex gap-2">
                                  <div
                                    {...provided.dragHandleProps}
                                    className="text-slate-400 flex-shrink-0"
                                  >
                                    <GripVertical className="w-4 h-4" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm text-[#0A2540] truncate">
                                      {contact.name}
                                    </p>
                                    <p className="text-xs text-[#6b7e9a] truncate">{contact.company}</p>
                                    <p className="text-xs text-[#6b7e9a] truncate">{contact.phone}</p>
                                    <div className="mt-1.5 flex items-center gap-2">
                                      {editingValueContactId === contact.id ? (
                                        <>
                                          <Input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={dealValueDraft}
                                            onClick={(event) => event.stopPropagation()}
                                            onChange={(event) => setDealValueDraft(event.target.value)}
                                            className="h-7 text-xs"
                                            placeholder="Valor em Kz"
                                          />
                                          <button
                                            type="button"
                                            className="text-green-600"
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              submitValueEdit(contact.id);
                                            }}
                                          >
                                            <Check className="h-3.5 w-3.5" />
                                          </button>
                                          <button
                                            type="button"
                                            className="text-slate-500"
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              setEditingValueContactId(null);
                                              setDealValueDraft('');
                                            }}
                                          >
                                            <X className="h-3.5 w-3.5" />
                                          </button>
                                        </>
                                      ) : (
                                        <>
                                          <span className="text-xs font-medium text-[#0A2540]">
                                            {formatKz(contact.dealValueKz)}
                                          </span>
                                          <button
                                            type="button"
                                            className="text-slate-400"
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              startValueEdit(contact);
                                            }}
                                          >
                                            <Pencil className="h-3.5 w-3.5" />
                                          </button>
                                        </>
                                      )}
                                    </div>
                                    {contact.sector && (
                                      <Badge variant="outline" className="text-xs mt-1.5">
                                        {contact.sector}
                                      </Badge>
                                    )}
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="flex-shrink-0 h-6 w-6 p-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeMutation.mutate(contact.id);
                                    }}
                                  >
                                    <X className="w-3 h-3" />
                                  </Button>
                                </div>
                              </Card>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>
    </>
  );
}
