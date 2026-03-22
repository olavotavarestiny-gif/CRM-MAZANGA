'use client';
import { useState } from 'react';
import { DashboardWidget, WidgetSource, SOURCE_LABELS, SOURCE_UNITS, WidgetType } from './types';
import { useDashboardConfig } from './use-dashboard-config';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { GripVertical, Pencil, Trash2, Plus, X, Check, RotateCcw } from 'lucide-react';

const COLORS = ['#3B82F6','#8B5CF6','#10B981','#F59E0B','#EF4444','#F97316','#EC4899','#06B6D4','#0A2540','#635BFF'];

const SOURCES = Object.entries(SOURCE_LABELS) as [WidgetSource, string][];

interface WidgetEditorProps {
  initial?: Partial<DashboardWidget>;
  onSave: (w: Omit<DashboardWidget, 'id' | 'visible'>) => void;
  onCancel: () => void;
}

function WidgetEditor({ initial, onSave, onCancel }: WidgetEditorProps) {
  const [type, setType] = useState<WidgetType>(initial?.type ?? 'stat');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [source, setSource] = useState<WidgetSource>(initial?.source ?? 'contacts_total');
  const [target, setTarget] = useState(initial?.target?.toString() ?? '');
  const [unit, setUnit] = useState(initial?.unit ?? SOURCE_UNITS[initial?.source ?? 'contacts_total']);
  const [color, setColor] = useState(initial?.color ?? '#635BFF');

  const handleSourceChange = (s: WidgetSource) => {
    setSource(s);
    setUnit(SOURCE_UNITS[s]);
    if (!title) setTitle(SOURCE_LABELS[s]);
  };

  return (
    <div className="space-y-4 border border-[#E2E8F0] rounded-xl p-4 bg-[#F8FAFC]">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-[#0A2540]">Tipo</Label>
          <Select value={type} onValueChange={(v) => setType(v as WidgetType)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="stat">Estatística simples</SelectItem>
              <SelectItem value="goal">Meta com progresso</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[#0A2540]">Fonte de dados</Label>
          <Select value={source} onValueChange={(v) => handleSourceChange(v as WidgetSource)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SOURCES.map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label className="text-[#0A2540]">Título</Label>
        <Input className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nome do widget" />
      </div>

      {type === 'goal' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-[#0A2540]">Objetivo</Label>
            <Input className="mt-1" type="number" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Ex: 1000000" />
          </div>
          <div>
            <Label className="text-[#0A2540]">Unidade</Label>
            <Input className="mt-1" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Kz, leads..." />
          </div>
        </div>
      )}

      {/* Color picker */}
      <div>
        <Label className="text-[#0A2540] block mb-2">Cor</Label>
        <div className="flex gap-1.5 flex-wrap">
          {COLORS.map((c) => (
            <button key={c} type="button"
              className="w-6 h-6 rounded-full border-2 transition-all"
              style={{ background: c, borderColor: color === c ? '#0A2540' : 'transparent', transform: color === c ? 'scale(1.2)' : 'scale(1)' }}
              onClick={() => setColor(c)}
            />
          ))}
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-6 h-6 rounded cursor-pointer border border-[#E2E8F0]" />
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={() => onSave({ type, title: title || SOURCE_LABELS[source], source, target: target ? Number(target) : undefined, unit, color })}>
          <Check className="w-3.5 h-3.5 mr-1" /> Guardar
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          <X className="w-3.5 h-3.5 mr-1" /> Cancelar
        </Button>
      </div>
    </div>
  );
}

export default function DashboardCustomizer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { widgets, addWidget, removeWidget, updateWidget, reorder, reset } = useDashboardConfig();
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const handleDragEnd = () => {
    if (dragging && dragOver && dragging !== dragOver) {
      const from = widgets.findIndex((w) => w.id === dragging);
      const to = widgets.findIndex((w) => w.id === dragOver);
      const next = [...widgets];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      reorder(next);
    }
    setDragging(null);
    setDragOver(null);
  };

  const isFixed = (w: DashboardWidget) => w.type === 'tasks' || w.type === 'pipeline';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg bg-white text-[#0A2540] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#0A2540]">Personalizar Painel</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 mb-4">
          {widgets.map((widget) => (
            <div
              key={widget.id}
              draggable={!isFixed(widget)}
              onDragStart={() => setDragging(widget.id)}
              onDragEnter={() => setDragOver(widget.id)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => e.preventDefault()}
              className={`transition-opacity ${dragging === widget.id ? 'opacity-40' : ''} ${dragOver === widget.id && dragging !== widget.id ? 'ring-2 ring-[#635BFF] rounded-xl' : ''}`}
            >
              {editing === widget.id ? (
                <WidgetEditor
                  initial={widget}
                  onSave={(data) => { updateWidget(widget.id, data); setEditing(null); }}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <div className="flex items-center gap-2 p-3 border border-[#E2E8F0] rounded-xl bg-white">
                  <div className="text-[#6b7e9a] cursor-grab">
                    <GripVertical className="w-4 h-4" />
                  </div>
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: widget.color || '#6b7e9a' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#0A2540] truncate">{widget.title}</p>
                    <p className="text-xs text-[#6b7e9a]">
                      {widget.type === 'goal' ? `Meta: ${widget.target?.toLocaleString('pt-PT')} ${widget.unit}` :
                       widget.type === 'tasks' ? 'Lista de tarefas' :
                       widget.type === 'pipeline' ? 'Resumo do pipeline' :
                       SOURCE_LABELS[widget.source!] ?? widget.source}
                    </p>
                  </div>
                  <Switch
                    checked={widget.visible}
                    onCheckedChange={(v) => updateWidget(widget.id, { visible: v })}
                  />
                  {!isFixed(widget) && (
                    <>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-[#6b7e9a] hover:text-[#0A2540]" onClick={() => setEditing(widget.id)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-[#6b7e9a] hover:text-red-500" onClick={() => removeWidget(widget.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {adding ? (
          <WidgetEditor
            onSave={(data) => {
              addWidget({ ...data, id: `custom-${Date.now()}`, visible: true });
              setAdding(false);
            }}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <Button variant="outline" className="w-full" onClick={() => setAdding(true)}>
            <Plus className="w-4 h-4 mr-2" /> Adicionar Widget
          </Button>
        )}

        <div className="border-t border-[#E2E8F0] pt-3 mt-2 flex justify-between">
          <Button variant="ghost" size="sm" className="text-[#6b7e9a] text-xs" onClick={() => { if (confirm('Repor configuração padrão?')) { reset(); } }}>
            <RotateCcw className="w-3.5 h-3.5 mr-1" /> Repor padrão
          </Button>
          <Button size="sm" onClick={onClose}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
