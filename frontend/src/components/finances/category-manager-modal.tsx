'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getFinancialCategories,
  createFinancialCategory,
  updateFinancialCategory,
  deleteFinancialCategory,
  seedFinancialCategories,
} from '@/lib/api';
import { FinancialCategory } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, X, Check, Loader2, RefreshCw } from 'lucide-react';

const ICON_OPTIONS = ['📂', '💰', '🧾', '🚀', '✨', '💡', '🛠️', '🚗', '💻', '📢', '🏢', '👤', '⚖️', '🏦', '🤝', '🎨', '📸', '🎬', '📦', '🔧', '💼', '🏪', '🌐', '📱'];
const COLOR_OPTIONS = ['#6366F1', '#10B981', '#3B82F6', '#8B5CF6', '#06B6D4', '#F59E0B', '#EF4444', '#EC4899', '#F97316', '#84CC16', '#14B8A6', '#0EA5E9', '#64748B', '#A855F7'];

type EditState = {
  id: string | null;
  type: 'entrada' | 'saida';
  category: string;
  icon: string;
  color: string;
  subcategories: string[];
  newSub: string;
};

const defaultEdit = (type: 'entrada' | 'saida' = 'saida'): EditState => ({
  id: null,
  type,
  category: '',
  icon: '📂',
  color: '#6366F1',
  subcategories: [],
  newSub: '',
});

export default function CategoryManagerModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'entrada' | 'saida'>('entrada');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['financial-categories'],
    queryFn: getFinancialCategories,
    enabled: open,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['financial-categories'] });
  };

  const createMut = useMutation({
    mutationFn: createFinancialCategory,
    onSuccess: () => { invalidate(); setEditing(null); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateFinancialCategory>[1] }) =>
      updateFinancialCategory(id, data),
    onSuccess: () => { invalidate(); setEditing(null); },
  });

  const deleteMut = useMutation({
    mutationFn: deleteFinancialCategory,
    onSuccess: () => { invalidate(); setConfirmDelete(null); },
  });

  const seedMut = useMutation({
    mutationFn: seedFinancialCategories,
    onSuccess: () => invalidate(),
  });

  const filtered = categories.filter((c) => c.type === tab);

  const openNew = () => setEditing(defaultEdit(tab));
  const openEdit = (c: FinancialCategory) =>
    setEditing({
      id: c.id,
      type: c.type as 'entrada' | 'saida',
      category: c.category,
      icon: c.icon || '📂',
      color: c.color || '#6366F1',
      subcategories: c.subcategories || [],
      newSub: '',
    });

  const handleSave = () => {
    if (!editing) return;
    if (!editing.category.trim()) return;
    const payload = {
      type: editing.type,
      category: editing.category.trim(),
      icon: editing.icon,
      color: editing.color,
      subcategories: editing.subcategories,
    };
    if (editing.id) {
      updateMut.mutate({ id: editing.id, data: payload });
    } else {
      createMut.mutate(payload);
    }
  };

  const addSub = () => {
    if (!editing || !editing.newSub.trim()) return;
    setEditing((e) => e && ({ ...e, subcategories: [...e.subcategories, e.newSub.trim()], newSub: '' }));
  };

  const removeSub = (i: number) => {
    setEditing((e) => e && ({ ...e, subcategories: e.subcategories.filter((_, idx) => idx !== i) }));
  };

  const isSaving = createMut.isPending || updateMut.isPending;
  const saveError = (createMut.error as any)?.response?.data?.error || (updateMut.error as any)?.response?.data?.error;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col bg-white border-slate-200">
        <DialogHeader>
          <DialogTitle className="text-[#2c2f31]">Gerir Categorias Financeiras</DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-100 pb-3">
          {(['entrada', 'saida'] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setEditing(null); setExpanded(null); }}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                tab === t
                  ? t === 'entrada'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-red-100 text-red-700'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {t === 'entrada' ? '↑ Entradas' : '↓ Saídas'}
            </button>
          ))}
          <div className="flex-1" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => seedMut.mutate()}
            disabled={seedMut.isPending}
            className="text-xs border-slate-200 text-slate-500"
            title="Repor categorias genéricas sugeridas"
          >
            {seedMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            <span className="ml-1.5">Repor sugestões</span>
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">
              Sem categorias. Cria uma ou usa "Repor sugestões".
            </div>
          ) : (
            filtered.map((cat) => (
              <div key={cat.id} className="rounded-xl border border-slate-200 overflow-hidden">
                {/* Category header */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 select-none"
                  onClick={() => setExpanded(expanded === cat.id ? null : cat.id)}
                >
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-base flex-shrink-0"
                    style={{ background: (cat.color || '#6366F1') + '20' }}
                  >
                    {cat.icon || '📂'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#2c2f31] truncate">{cat.category}</p>
                    <p className="text-xs text-slate-400">
                      {(cat.subcategories || []).length} subcategorias
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); openEdit(cat); }}
                      className="p-1.5 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {confirmDelete === cat.id ? (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => deleteMut.mutate(cat.id)}
                          disabled={deleteMut.isPending}
                          className="px-2 py-1 text-xs rounded bg-red-500 text-white hover:bg-red-600"
                        >
                          Confirmar
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="p-1.5 rounded hover:bg-slate-200 text-slate-500"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDelete(cat.id); }}
                        className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {expanded === cat.id
                      ? <ChevronDown className="h-4 w-4 text-slate-400 ml-1" />
                      : <ChevronRight className="h-4 w-4 text-slate-400 ml-1" />
                    }
                  </div>
                </div>

                {/* Subcategories */}
                {expanded === cat.id && (cat.subcategories || []).length > 0 && (
                  <div className="border-t border-slate-100 px-4 py-2 flex flex-wrap gap-1.5 bg-slate-50">
                    {(cat.subcategories || []).map((sub) => (
                      <span
                        key={sub}
                        className="px-2.5 py-1 rounded-full text-xs bg-white border border-slate-200 text-slate-600"
                      >
                        {sub}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Add new button */}
        {!editing && (
          <div className="pt-3 border-t border-slate-100">
            <Button
              onClick={openNew}
              className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white hover:opacity-90"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nova Categoria de {tab === 'entrada' ? 'Entrada' : 'Saída'}
            </Button>
          </div>
        )}

        {/* Inline editor */}
        {editing && (
          <div className="border-t border-slate-200 pt-4 space-y-4">
            <p className="text-sm font-semibold text-[#2c2f31]">
              {editing.id ? 'Editar Categoria' : 'Nova Categoria'}
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label className="text-[#2c2f31] mb-1 block">Nome do grupo *</Label>
                <Input
                  value={editing.category}
                  onChange={(e) => setEditing((s) => s && ({ ...s, category: e.target.value }))}
                  placeholder="ex: Fornecedores, Receitas de Serviços..."
                  className="border-[#dde3ec] text-[#2c2f31]"
                  autoFocus
                />
              </div>

              {/* Icon picker */}
              <div>
                <Label className="text-[#2c2f31] mb-1 block">Ícone</Label>
                <div className="flex flex-wrap gap-1.5 rounded-lg border border-[#dde3ec] p-2 max-h-24 overflow-y-auto">
                  {ICON_OPTIONS.map((ic) => (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => setEditing((s) => s && ({ ...s, icon: ic }))}
                      className={`h-8 w-8 flex items-center justify-center rounded text-base transition-colors ${editing.icon === ic ? 'bg-slate-200' : 'hover:bg-slate-100'}`}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color picker */}
              <div>
                <Label className="text-[#2c2f31] mb-1 block">Cor</Label>
                <div className="flex flex-wrap gap-1.5 rounded-lg border border-[#dde3ec] p-2">
                  {COLOR_OPTIONS.map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setEditing((s) => s && ({ ...s, color: col }))}
                      className="h-6 w-6 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                      style={{ background: col }}
                    >
                      {editing.color === col && <Check className="h-3 w-3 text-white" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Subcategories */}
            <div>
              <Label className="text-[#2c2f31] mb-1 block">Subcategorias</Label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {editing.subcategories.map((sub, i) => (
                  <span key={i} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700 border border-slate-200">
                    {sub}
                    <button type="button" onClick={() => removeSub(i)} className="hover:text-red-500">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={editing.newSub}
                  onChange={(e) => setEditing((s) => s && ({ ...s, newSub: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSub(); } }}
                  placeholder="Adicionar subcategoria..."
                  className="border-[#dde3ec] text-[#2c2f31] text-sm"
                />
                <Button type="button" variant="outline" onClick={addSub} className="border-slate-200">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {saveError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{saveError}</p>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setEditing(null)}
                className="flex-1 border-slate-200 text-slate-600"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving || !editing.category.trim()}
                className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 text-white hover:opacity-90"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                <span className="ml-1">{editing.id ? 'Actualizar' : 'Criar'}</span>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
