'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getPipelineStages,
  createPipelineStage,
  updatePipelineStage,
  deletePipelineStage,
  reorderPipelineStages,
} from '@/lib/api';
import { PipelineStage } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GripVertical, Pencil, Trash2, Plus, Check, X } from 'lucide-react';

const PRESET_COLORS = [
  '#3B82F6', '#F59E0B', '#8B5CF6', '#F97316',
  '#10B981', '#6B7280', '#EF4444', '#EC4899',
  '#06B6D4', '#84CC16',
];

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {PRESET_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          className="w-6 h-6 rounded-full border-2 transition-all"
          style={{
            background: c,
            borderColor: value === c ? '#0A2540' : 'transparent',
            transform: value === c ? 'scale(1.2)' : 'scale(1)',
          }}
          onClick={() => onChange(c)}
        />
      ))}
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-6 h-6 rounded cursor-pointer border border-[#E2E8F0]"
        title="Cor personalizada"
      />
    </div>
  );
}

function StageRow({
  stage,
  onEdit,
  onDelete,
  dragHandleProps,
}: {
  stage: PipelineStage;
  onEdit: (stage: PipelineStage) => void;
  onDelete: (stage: PipelineStage) => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}) {
  return (
    <div className="flex items-center gap-3 p-3 bg-white border border-[#E2E8F0] rounded-lg">
      <div {...dragHandleProps} className="text-[#6b7e9a] cursor-grab active:cursor-grabbing">
        <GripVertical className="w-4 h-4" />
      </div>
      <div
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{ background: stage.color }}
      />
      <span className="flex-1 text-sm font-medium text-[#0A2540]">{stage.name}</span>
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-[#6b7e9a] hover:text-[#0A2540]"
          onClick={() => onEdit(stage)}
        >
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-[#6b7e9a] hover:text-red-500"
          onClick={() => onDelete(stage)}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

export default function PipelineStageManager({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [editingStage, setEditingStage] = useState<PipelineStage | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#3B82F6');
  const [addName, setAddName] = useState('');
  const [addColor, setAddColor] = useState('#3B82F6');
  const [deletingStage, setDeletingStage] = useState<PipelineStage | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const { data: stages = [] } = useQuery({
    queryKey: ['pipeline-stages'],
    queryFn: getPipelineStages,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['pipeline-stages'] });
    queryClient.invalidateQueries({ queryKey: ['contacts'] });
  };

  const createMutation = useMutation({
    mutationFn: createPipelineStage,
    onSuccess: () => { invalidate(); setAddName(''); setAddColor('#3B82F6'); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; color?: string } }) =>
      updatePipelineStage(id, data),
    onSuccess: () => { invalidate(); setEditingStage(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePipelineStage(id),
    onSuccess: () => { invalidate(); setDeletingStage(null); },
  });

  const reorderMutation = useMutation({
    mutationFn: reorderPipelineStages,
    onSuccess: invalidate,
  });

  const handleEditSave = () => {
    if (!editingStage || !editName.trim()) return;
    updateMutation.mutate({ id: editingStage.id, data: { name: editName.trim(), color: editColor } });
  };

  const handleAdd = () => {
    if (!addName.trim()) return;
    createMutation.mutate({ name: addName.trim(), color: addColor });
  };

  // Simple drag-and-drop reorder (HTML5 drag API)
  const handleDragStart = (id: string) => setDragging(id);
  const handleDragEnter = (id: string) => setDragOver(id);
  const handleDragEnd = () => {
    if (dragging && dragOver && dragging !== dragOver) {
      const from = stages.findIndex((s) => s.id === dragging);
      const to = stages.findIndex((s) => s.id === dragOver);
      const reordered = [...stages];
      const [moved] = reordered.splice(from, 1);
      reordered.splice(to, 0, moved);
      reorderMutation.mutate(reordered.map((s, i) => ({ id: s.id, order: i })));
    }
    setDragging(null);
    setDragOver(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-md bg-white text-[#0A2540]">
          <DialogHeader>
            <DialogTitle className="text-[#0A2540]">Gerir Etapas do Pipeline</DialogTitle>
          </DialogHeader>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {stages.map((stage) => (
              <div
                key={stage.id}
                draggable
                onDragStart={() => handleDragStart(stage.id)}
                onDragEnter={() => handleDragEnter(stage.id)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => e.preventDefault()}
                className={`transition-opacity ${dragging === stage.id ? 'opacity-40' : 'opacity-100'} ${dragOver === stage.id && dragging !== stage.id ? 'ring-2 ring-[#635BFF] rounded-lg' : ''}`}
              >
                <StageRow
                  stage={stage}
                  onEdit={(s) => { setEditingStage(s); setEditName(s.name); setEditColor(s.color); }}
                  onDelete={setDeletingStage}
                  dragHandleProps={{}}
                />
              </div>
            ))}
          </div>

          {/* Add new stage */}
          <div className="border-t border-[#E2E8F0] pt-4 space-y-3">
            <p className="text-sm font-semibold text-[#0A2540]">Adicionar nova etapa</p>
            <Input
              placeholder="Nome da etapa"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <ColorPicker value={addColor} onChange={setAddColor} />
            <Button
              className="w-full"
              onClick={handleAdd}
              disabled={!addName.trim() || createMutation.isPending}
            >
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Etapa
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit stage dialog */}
      <Dialog open={!!editingStage} onOpenChange={(o) => !o && setEditingStage(null)}>
        <DialogContent className="max-w-sm bg-white text-[#0A2540]">
          <DialogHeader>
            <DialogTitle className="text-[#0A2540]">Editar Etapa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[#0A2540] block mb-1.5">Nome</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleEditSave()}
                autoFocus
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[#0A2540] block mb-1.5">Cor</label>
              <ColorPicker value={editColor} onChange={setEditColor} />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setEditingStage(null)}>
                <X className="w-4 h-4 mr-1" /> Cancelar
              </Button>
              <Button
                onClick={handleEditSave}
                disabled={!editName.trim() || updateMutation.isPending}
              >
                <Check className="w-4 h-4 mr-1" /> Guardar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deletingStage} onOpenChange={(o) => !o && setDeletingStage(null)}>
        <DialogContent className="max-w-sm bg-white text-[#0A2540]">
          <DialogHeader>
            <DialogTitle className="text-[#0A2540]">Eliminar Etapa</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[#6b7e9a]">
            Tens a certeza que queres eliminar a etapa{' '}
            <strong className="text-[#0A2540]">{deletingStage?.name}</strong>?
            Os contactos nesta etapa serão movidos para a primeira etapa disponível.
          </p>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setDeletingStage(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingStage && deleteMutation.mutate(deletingStage.id)}
              disabled={deleteMutation.isPending}
            >
              Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
