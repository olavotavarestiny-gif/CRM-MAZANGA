'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Package, Pencil, Trash2, Search, Hash } from 'lucide-react';
import { getProdutos, createProduto, updateProduto, deleteProduto, getSeries, getEstabelecimentos, createSerie, updateSerie } from '@/lib/api';
import type { Produto } from '@/lib/types';

const UNITS = ['UN', 'H', 'KG', 'L', 'M', 'M2', 'M3'];
const DOC_TYPES = ['FT', 'FR', 'ND', 'NC', 'FA', 'PF'];

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  A: { label: 'Ativa', className: 'bg-green-100 text-green-700 border-green-200' },
  U: { label: 'Em uso', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  F: { label: 'Fechada', className: 'bg-gray-100 text-gray-500 border-gray-200' },
};

interface ProdutoForm {
  productCode: string;
  productDescription: string;
  unitPrice: number;
  unitOfMeasure: string;
  taxPercentage: number;
}

const EMPTY_PRODUTO: ProdutoForm = { productCode: '', productDescription: '', unitPrice: 0, unitOfMeasure: 'UN', taxPercentage: 14 };

export default function ProdutosPage() {
  const qc = useQueryClient();

  // Produtos state
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Produto | null>(null);
  const [showNewProduto, setShowNewProduto] = useState(false);
  const [prodForm, setProdForm] = useState<ProdutoForm>(EMPTY_PRODUTO);
  const [prodErr, setProdErr] = useState('');

  // Séries state
  const [showNewSerie, setShowNewSerie] = useState(false);
  const [serieForm, setSerieForm] = useState({ estabelecimentoId: '', seriesCode: '', seriesYear: new Date().getFullYear(), documentType: 'FT', firstDocumentNumber: 1 });
  const [serieErr, setSerieErr] = useState('');

  const { data: produtos = [], isLoading: prodLoading } = useQuery({
    queryKey: ['produtos', search],
    queryFn: () => getProdutos({ search: search || undefined, active: true }),
  });

  const { data: series = [], isLoading: seriesLoading } = useQuery({ queryKey: ['series'], queryFn: getSeries });
  const { data: estabs = [] } = useQuery({ queryKey: ['estabelecimentos'], queryFn: getEstabelecimentos });

  // Product mutations
  const createProdMutation = useMutation({
    mutationFn: () => createProduto({ ...prodForm, unitPrice: Number(prodForm.unitPrice), taxPercentage: Number(prodForm.taxPercentage) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['produtos'] }); setShowNewProduto(false); setProdForm(EMPTY_PRODUTO); setProdErr(''); },
    onError: (e: Error) => setProdErr(e.message),
  });

  const editProdMutation = useMutation({
    mutationFn: () => updateProduto(editing!.id, { ...prodForm, unitPrice: Number(prodForm.unitPrice), taxPercentage: Number(prodForm.taxPercentage) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['produtos'] }); setEditing(null); setProdErr(''); },
    onError: (e: Error) => setProdErr(e.message),
  });

  const deleteProdMutation = useMutation({
    mutationFn: (id: string) => deleteProduto(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['produtos'] }),
  });

  // Series mutations
  const createSerieMutation = useMutation({
    mutationFn: () => createSerie({ ...serieForm, seriesYear: Number(serieForm.seriesYear), firstDocumentNumber: Number(serieForm.firstDocumentNumber) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['series'] }); setShowNewSerie(false); setSerieErr(''); },
    onError: (e: Error) => setSerieErr(e.message),
  });

  const closeSerieMutation = useMutation({
    mutationFn: (id: string) => updateSerie(id, { seriesStatus: 'F' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['series'] }),
  });

  const openEdit = (p: Produto) => {
    setEditing(p);
    setProdForm({ productCode: p.productCode, productDescription: p.productDescription, unitPrice: p.unitPrice, unitOfMeasure: p.unitOfMeasure, taxPercentage: p.taxPercentage });
    setProdErr('');
  };

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#0A2540]">Produtos & Serviços</h1>
        <p className="text-gray-500 text-sm mt-1">Catálogo de produtos e séries de numeração</p>
      </div>

      {/* ── SECÇÃO 1: Produtos ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Catálogo</h2>
          <Button onClick={() => { setShowNewProduto(true); setProdForm(EMPTY_PRODUTO); setEditing(null); setProdErr(''); }}
            className="bg-gradient-to-r from-orange-500 to-red-500 text-white hover:opacity-90 gap-2">
            <Plus className="w-4 h-4" /> Novo Produto
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Pesquisar produto ou serviço..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
          <div className="grid grid-cols-12 text-xs text-gray-500 font-medium uppercase tracking-wide px-4 py-2 border-b border-gray-200">
            <span className="col-span-2">Código</span>
            <span className="col-span-4">Descrição</span>
            <span className="col-span-2 text-right">Preço</span>
            <span className="col-span-1 text-center">Unid.</span>
            <span className="col-span-1 text-center">IVA</span>
            <span className="col-span-2"></span>
          </div>
          {prodLoading && <div className="py-8 text-center text-gray-400">A carregar...</div>}
          {!prodLoading && produtos.length === 0 && (
            <div className="py-12 text-center text-gray-400">
              <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Nenhum produto criado</p>
            </div>
          )}
          {produtos.map(p => (
            <div key={p.id} className="grid grid-cols-12 px-4 py-3 border-b border-gray-100 items-center hover:bg-white transition-colors">
              <span className="col-span-2 text-gray-500 font-mono text-sm">{p.productCode}</span>
              <span className="col-span-4 text-[#0A2540] text-sm">{p.productDescription}</span>
              <span className="col-span-2 text-right text-[#0A2540] font-mono text-sm">{p.unitPrice.toLocaleString('pt-AO', { minimumFractionDigits: 2 })} Kz</span>
              <span className="col-span-1 text-center text-gray-500 text-sm">{p.unitOfMeasure}</span>
              <span className="col-span-1 text-center text-gray-500 text-sm">{p.taxPercentage}%</span>
              <div className="col-span-2 flex justify-end gap-1">
                <Button variant="ghost" size="sm" onClick={() => openEdit(p)} className="text-gray-400 hover:text-[#0A2540] h-7 w-7 p-0">
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => deleteProdMutation.mutate(p.id)} className="text-gray-400 hover:text-red-500 h-7 w-7 p-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── SECÇÃO 2: Séries ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Séries de Numeração</h2>
            <p className="text-gray-400 text-xs mt-0.5">Sequências de numeração para emissão de documentos fiscais</p>
          </div>
          <Button onClick={() => setShowNewSerie(true)} variant="outline" className="border-gray-200 text-gray-600 hover:bg-gray-50 gap-2">
            <Plus className="w-4 h-4" /> Nova Série
          </Button>
        </div>

        {estabs.length === 0 && (
          <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm">
            Precisa de criar um Estabelecimento antes de poder criar séries. Vá a <a href="/configuracoes" className="underline font-medium">Configurações</a>.
          </div>
        )}

        <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
          <div className="grid grid-cols-12 text-xs text-gray-500 font-medium uppercase tracking-wide px-4 py-2 border-b border-gray-200">
            <span className="col-span-2">Código</span>
            <span className="col-span-1">Tipo</span>
            <span className="col-span-2">Ano</span>
            <span className="col-span-3">Estabelecimento</span>
            <span className="col-span-2">Último nº</span>
            <span className="col-span-1">Estado</span>
            <span className="col-span-1"></span>
          </div>
          {seriesLoading && <div className="py-8 text-center text-gray-400">A carregar...</div>}
          {!seriesLoading && series.length === 0 && (
            <div className="py-12 text-center text-gray-400">
              <Hash className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Sem séries criadas</p>
            </div>
          )}
          {series.map(s => {
            const st = STATUS_MAP[s.seriesStatus] || STATUS_MAP.A;
            return (
              <div key={s.id} className="grid grid-cols-12 px-4 py-3 border-b border-gray-100 items-center hover:bg-white transition-colors">
                <span className="col-span-2 text-[#0A2540] font-mono font-medium">{s.seriesCode}</span>
                <span className="col-span-1 text-purple-600 font-medium text-sm">{s.documentType}</span>
                <span className="col-span-2 text-gray-600">{s.seriesYear}</span>
                <span className="col-span-3 text-gray-600 text-sm truncate">{s.estabelecimento?.nome}</span>
                <span className="col-span-2 text-gray-500 text-sm">#{s.lastDocumentNumber ?? 0}</span>
                <span className="col-span-1">
                  <span className={`px-1.5 py-0.5 rounded text-xs border ${st.className}`}>{st.label}</span>
                </span>
                <div className="col-span-1 flex justify-end">
                  {s.seriesStatus !== 'F' && (
                    <button onClick={() => closeSerieMutation.mutate(s.id)} className="text-xs text-gray-400 hover:text-red-500 underline">
                      Fechar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Dialog: Novo/Editar Produto */}
      <Dialog open={showNewProduto || !!editing} onOpenChange={open => { if (!open) { setShowNewProduto(false); setEditing(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Editar Produto' : 'Novo Produto / Serviço'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            {prodErr && <p className="text-red-500 text-sm">{prodErr}</p>}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Código *</Label>
                <Input value={prodForm.productCode} onChange={e => setProdForm(p => ({ ...p, productCode: e.target.value }))} placeholder="ex: CONS001" className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">Preço Unit. (Kz)</Label>
                <Input type="number" min="0" step="0.01" value={prodForm.unitPrice} onChange={e => setProdForm(p => ({ ...p, unitPrice: Number(e.target.value) }))} className="mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-sm">Descrição *</Label>
              <Input value={prodForm.productDescription} onChange={e => setProdForm(p => ({ ...p, productDescription: e.target.value }))} placeholder="ex: Consultoria Marketing Digital" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Unidade</Label>
                <Select value={prodForm.unitOfMeasure} onValueChange={v => setProdForm(p => ({ ...p, unitOfMeasure: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm">Taxa IVA</Label>
                <Select value={String(prodForm.taxPercentage)} onValueChange={v => setProdForm(p => ({ ...p, taxPercentage: Number(v) }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="14">14% (Normal)</SelectItem>
                    <SelectItem value="0">0% (Isento)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowNewProduto(false); setEditing(null); }}>Cancelar</Button>
            <Button
              onClick={() => editing ? editProdMutation.mutate() : createProdMutation.mutate()}
              disabled={createProdMutation.isPending || editProdMutation.isPending}
              className="bg-gradient-to-r from-orange-500 to-red-500 text-white hover:opacity-90"
            >
              {(createProdMutation.isPending || editProdMutation.isPending) ? 'A guardar...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Nova Série */}
      <Dialog open={showNewSerie} onOpenChange={setShowNewSerie}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Série</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {serieErr && <p className="text-red-500 text-sm">{serieErr}</p>}
            <div>
              <Label className="text-sm">Estabelecimento *</Label>
              <Select value={serieForm.estabelecimentoId} onValueChange={v => setSerieForm(p => ({ ...p, estabelecimentoId: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>{estabs.map(e => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Código da Série *</Label>
                <Input value={serieForm.seriesCode} onChange={e => setSerieForm(p => ({ ...p, seriesCode: e.target.value }))} placeholder="ex: 2026" className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">Ano *</Label>
                <Input type="number" value={serieForm.seriesYear} onChange={e => setSerieForm(p => ({ ...p, seriesYear: Number(e.target.value) }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">Tipo Documento *</Label>
                <Select value={serieForm.documentType} onValueChange={v => setSerieForm(p => ({ ...p, documentType: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{DOC_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm">Primeiro nº</Label>
                <Input type="number" min="1" value={serieForm.firstDocumentNumber} onChange={e => setSerieForm(p => ({ ...p, firstDocumentNumber: Number(e.target.value) }))} className="mt-1" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewSerie(false)}>Cancelar</Button>
            <Button onClick={() => createSerieMutation.mutate()} disabled={createSerieMutation.isPending}
              className="bg-gradient-to-r from-orange-500 to-red-500 text-white hover:opacity-90">
              {createSerieMutation.isPending ? 'A criar...' : 'Criar Série'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
