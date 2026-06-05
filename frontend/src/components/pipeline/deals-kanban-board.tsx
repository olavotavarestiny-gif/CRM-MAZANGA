'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Deal, DealStage } from '@/lib/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateDeal } from '@/lib/api';
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from '@hello-pangea/dnd';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GripVertical } from 'lucide-react';

function formatKz(value?: number | null) {
  if (value === null || value === undefined || value <= 0) {
    return 'Sem valor';
  }

  return `${new Intl.NumberFormat('pt-PT').format(Math.round(value))} Kz`;
}

function daysInStage(date: string) {
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
}

function daysInStageLabel(date: string) {
  const days = daysInStage(date);
  if (days <= 0) return 'hoje';
  if (days === 1) return 'há 1 dia';
  return `há ${days} dias`;
}

export default function DealsKanbanBoard({
  deals,
  stages,
}: {
  deals: Deal[];
  stages: DealStage[];
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedStage, setSelectedStage] = useState<string>(stages[0]?.id ?? '');

  const openDeals = deals.filter((d) => d.status === 'aberto');

  const updateMutation = useMutation({
    mutationFn: (params: { id: string; stageId: string }) =>
      updateDeal(params.id, { stageId: params.stageId }),
    onMutate: async ({ id, stageId }) => {
      await queryClient.cancelQueries({ queryKey: ['deals'] });
      const previous = queryClient.getQueryData<Deal[]>(['deals']);
      queryClient.setQueryData<Deal[]>(['deals'], (old = []) =>
        old.map((d) => (d.id === id ? { ...d, stageId } : d))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['deals'], context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
    },
  });

  const handleDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;
    if (source.droppableId === destination.droppableId) return;
    updateMutation.mutate({ id: draggableId, stageId: destination.droppableId });
  };

  if (stages.length === 0) {
    return (
      <div className="text-center py-16 text-[#6b7e9a]">
        Sem etapas configuradas.
      </div>
    );
  }

  const peopleCount = (deal: Deal) =>
    deal._count?.stakeholders ?? deal.stakeholders?.length ?? 0;

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
                <SelectItem key={stage.id} value={stage.id}>
                  {stage.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="px-4 space-y-2">
          {openDeals
            .filter((d) => d.stageId === selectedStage)
            .map((deal) => (
              <Card
                key={deal.id}
                className="p-3 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => router.push(`/negociacoes/${deal.id}`)}
              >
                <p className="font-medium text-sm text-[#0A2540] truncate">
                  {deal.company?.name}
                </p>
                <p className="text-xs text-[#6b7e9a] truncate">{deal.title}</p>
                <p className="text-xs font-medium text-[#0A2540] mt-1.5">
                  {formatKz(deal.valueKz)}
                </p>
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs">
                    {peopleCount(deal)} pessoas
                  </Badge>
                  <span className="text-xs text-[#6b7e9a]">
                    {daysInStageLabel(deal.stageEnteredAt)} nesta fase
                  </span>
                </div>
              </Card>
            ))}
          {openDeals.filter((d) => d.stageId === selectedStage).length === 0 && (
            <p className="text-center text-[#6b7e9a] py-8">Nenhuma negociação nesta etapa</p>
          )}
        </div>
      </div>

      {/* Desktop View */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div
          className="hidden md:grid gap-4 overflow-x-auto pb-2"
          style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(240px, 1fr))` }}
        >
          {stages.map((stage) => {
            const stageDeals = openDeals.filter((d) => d.stageId === stage.id);
            return (
              <div key={stage.id} className="bg-[#f5f7fa] border border-[#dde3ec] rounded-xl p-4 min-h-96">
                <div className="mb-4 flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: stage.color }}
                  />
                  <h3 className="font-semibold text-[#0A2540] text-sm">
                    {stage.name}
                    <span className="ml-1.5 text-[#6b7e9a] font-normal">({stageDeals.length})</span>
                  </h3>
                </div>

                <Droppable droppableId={stage.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`space-y-2 min-h-48 ${
                        snapshot.isDraggingOver ? 'bg-blue-50 border border-blue-200 rounded-lg p-1' : ''
                      }`}
                    >
                      {stageDeals.map((deal, index) => (
                        <Draggable
                          key={deal.id}
                          draggableId={deal.id}
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
                                    router.push(`/negociacoes/${deal.id}`);
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
                                      {deal.company?.name}
                                    </p>
                                    <p className="text-xs text-[#6b7e9a] truncate">{deal.title}</p>
                                    <p className="text-xs font-medium text-[#0A2540] mt-1.5">
                                      {formatKz(deal.valueKz)}
                                    </p>
                                    <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                                      <Badge variant="outline" className="text-xs">
                                        {peopleCount(deal)} pessoas
                                      </Badge>
                                      <span className="text-xs text-[#6b7e9a]">
                                        {daysInStageLabel(deal.stageEnteredAt)} nesta fase
                                      </span>
                                    </div>
                                  </div>
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
