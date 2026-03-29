'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Package, Pencil, Trash2, Search, Hash, PlusCircle, ArrowUpCircle, ClipboardList } from 'lucide-react';
import { getProdutos, createProduto, updateProduto, deleteProduto, addStock, getStockMovements, getSeries, getEstabelecimentos, createSerie, updateSerie } from '@/lib/api';
import type { Produto, StockMovement } from '@/lib/types';

const UNITS = ['UN', 'H', 'KG', 'L', 'M', 'M2', 'M3'];
const DOC_TYPES = ['FT', 'FR', 'ND', 'NC', 'FA', 'PF'];
const PRODUCT_TYPES = [
  { value: 'S', label: 'Serviço' },
  { value: 'P', label: 'Produto' },
  { value: 'O', label: 'Outro' },
];

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  A: { label: 'Ativa', className: 'bg-green-100 text-green-700 border-green-200' },
  U: { label: 'Em uso', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  F: { label: 'Fechada', className: 'bg-gray-100 text-gray-500 border-gray-200' },
};

interface ProdutoForm {
  productCode: string;
  productDescription: string;
  unitPrice: number;      // salePrice
  cost: number | '';      // custo — '' quando vazio
  productType: string;
  sku: string;
  unitOfMeasure: string;
  taxPercentage: number;
}

const EMPTY_FORM: ProdutoForm = {
  productCode: '', productDescription: '',
  unitPrice: 0, cost: '',
  productType: 'S', sku: '',
  unitOfMeasure: 'UN', taxPercentage: 14,
};

/** Calcula margem % a partir de custo e preço de venda. */
function calcMargin(cost: number | '', salePrice: number): number | null {
  if (cost === '' || cost <= 0 || salePrice <= 0) return null;
  return Math.round(((salePrice - cost) / salePrice) * 10000) / 100;
}

/** Calcula preço de venda a partir de custo e margem %. */
function calcSalePrice(cost: number, margin: number): number {
  if (margin >= 100) return 0;
  return Math.round((cost / (1 - margin / 100)) * 100) / 100;
}

export default function ProdutosPage() {
  const qc = useQueryClient();

  // Produtos state
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Produto | null>(null);
  const [showNewProduto, setShowNewProduto] = useState(false);
  const [prodForm, setProdForm] = useState<ProdutoForm>(EMPTY_FORM);
  const [marginInput, setMarginInput] = useState<number | ''>(''); // margem editada pelo user
  const [prodErr, setProdErr] = useState('');

  // Stock state
  const [stockTarget, setStockTarget] = useState<Produto | null>(null); // produto cujo stock estamos a editar
  const [stockQty, setStockQty] = useState<number | ''>('');
  const [stockReason, setStockReason] = useState('');
  const [stockNotes, setStockNotes] = useState('');
  const [stockErr, setStockErr] = useState('');

  // Histórico de movimentos
  const [movementsTarget, setMovementsTarget] = useState<Produto | null>(null);

  // Séries state
  const [showNewSerie, setShowNewSerie] = useState(false);
  const [serieForm, setSerieForm] = useState({
    estabelecimentoId: '', seriesCode: '',
    seriesYear: new Date().getFullYear(), documentType: 'FT', firstDocumentNumber: 1,
  });
  const [serieErr, setSerieErr] = useState('');

  const { data: produtos = [], isLoading: prodLoading } = useQuery({
    queryKey: ['produtos', search],
    queryFn: () => getProdutos({ search: search || undefined, active: true }),
  });

  const { data: series = [], isLoading: seriesLoading } = useQuery({ queryKey: ['series'], queryFn: getSeries });
  const { data: estabs = [] } = useQuery({ queryKey: ['estabelecimentos'], queryFn: getEstabelecimentos });

  const { data: movements = [], isLoading: movementsLoading } = useQuery({
    queryKey: ['stock-movements', movementsTarget?.id],
    queryFn: () => getStockMovements(movementsTarget!.id),
    enabled: !!movementsTarget,
  });

  // ── Margem/Preço reactivos ─────────────────────────────────────────────────

  const handleSalePriceChange = useCallback((val: number) => {
    setProdForm((p) => {
      const m = calcMargin(p.cost, val);
      setMarginInput(m ?? '');
      return { ...p, unitPrice: val };
    });
  }, []);

  const handleCostChange = useCallback((val: number | '') => {
    setProdForm((p) => {
      const m = calcMargin(val, p.unitPrice);
      setMarginInput(m ?? '');
      return { ...p, cost: val };
    });
  }, []);

  const handleMarginChange = useCallback((val: number | '') => {
    setMarginInput(val);
    if (val === '' || typeof val !== 'number') return;
    setProdForm((p) => {
      if (p.cost !== '' && p.cost > 0) {
        const newPrice = calcSalePrice(p.cost as number, val);
        return { ...p, unitPrice: newPrice };
      }
      return p;
    });
  }, []);

  // ── Mutations ────────────────────────────────────────────────────────────

  const createProdMutation = useMutation({
    mutationFn: () => createProduto({
      ...prodForm,
      cost: prodForm.cost === '' ? null : Number(prodForm.cost),
      unitPrice: Number(prodForm.unitPrice),
      taxPercentage: Number(prodForm.taxPercentage),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['produtos'] });
      setShowNewProduto(false);
      setProdForm(EMPTY_FORM);
      setMarginInput('');
      setProdErr('');
    },
    onError: (e: Error) => setProdErr(e.message),
  });

  const editProdMutation = useMutation({
    mutationFn: () => updateProduto(editing!.id, {
      ...prodForm,
      cost: prodForm.cost === '' ? null : Number(prodForm.cost),
      unitPrice: Number(prodForm.unitPrice),
      taxPercentage: Number(prodForm.taxPercentage),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['produtos'] });
      setEditing(null);
      setProdErr('');
    },
    onError: (e: Error) => setProdErr(e.message),
  });

  const deleteProdMutation = useMutation({
    mutationFn: (id: string) => deleteProduto(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['produtos'] }),
  });

  const addStockMutation = useMutation({
    mutationFn: () => addStock(stockTarget!.id, {
      quantity: Number(stockQty),
      reason: stockReason || undefined,
      notes: stockNotes || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['produtos'] });
      qc.invalidateQueries({ queryKey: ['stock-movements', stockTarget?.id] });
      setStockTarget(null);
      setStockQty('');
      setStockReason('');
      setStockNotes('');
      setStockErr('');
    },
    onError: (e: Error) => setStockErr(e.message),
  });

  // Séries mutations
  const createSerieMutation = useMutation({
    mutationFn: () => createSerie({ ...serieForm, seriesYear: Number(serieForm.seriesYear), firstDocumentNumber: Number(serieForm.firstDocumentNumber) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['series'] }); setShowNewSerie(false); setSerieErr(''); },
    onError: (e: Error) => setSerieErr(e.message),
  });

  const closeSerieMutation = useMutation({
    mutationFn: (id: string) => updateSerie(id, { seriesStatus: 'F' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['series'] }),
  });

  const openNew = () => {
    setEditing(null);
    setProdForm(EMPTY_FORM);
    setMarginInput('');
    setProdErr('');
    setShowNewProduto(true);
  };

  const openEdit = (p: Produto) => {
    setEditing(p);
    const costVal = p.cost ?? '';
    const m = calcMargin(costVal, p.unitPrice);
    setProdForm({
      productCode: p.productCode,
      productDescription: p.productDescription,
      unitPrice: p.unitPrice,
      cost: costVal,
      productType: p.productType ?? 'S',
      sku: p.sku ?? '',
      unitOfMeasure: p.unitOfMeasure,
      taxPercentage: p.taxPercentage,
    });
    setMarginInput(m ?? '');
    setProdErr('');
  };

  const openAddStock = (p: Produto) => {
    setStockTarget(p);
    setStockQty('');
    setStockReason('');
    setStockNotes('');
    setStockErr('');
  };

  const computedMargin = calcMargin(prodForm.cost, prodForm.unitPrice);

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
          <Button onClick={openNew} className="gap-2">
            <Plus className="w-4 h-4" /> Novo Produto
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Pesquisar produto, serviço ou SKU..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
          <div className="grid grid-cols-12 text-xs text-gray-500 font-medium uppercase tracking-wide px-4 py-2 border-b border-gray-200">
            <span className="col-span-2">Código</span>
            <span className="col-span-3">Descrição</span>
            <span className="col-span-1 text-center">Tipo</span>
            <span className="col-span-1 text-right">Custo</span>
            <span className="col-span-1 text-right">Preço</span>
            <span className="col-span-1 text-center">Margem</span>
            <span className="col-span-1 text-center">Stock</span>
            <span className="col-span-2"></span>
          </div>
          {prodLoading && <div className="py-8 text-center text-gray-400">A carregar...</div>}
          {!prodLoading && produtos.length === 0 && (
            <div className="py-12 text-center text-gray-400">
              <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Nenhum produto criado</p>
            </div>
          )}
          {produtos.map(p => {
            const margin = p.margin ?? calcMargin(p.cost ?? '', p.unitPrice);
            const stock = p.stock ?? 0;
            const stockLow = stock <= 5;
            return (
              <div key={p.id} className="grid grid-cols-12 px-4 py-3 border-b border-gray-100 items-center hover:bg-white transition-colors">
                <span className="col-span-2 text-gray-500 font-mono text-sm">{p.productCode}</span>
                <span className="col-span-3 text-[#0A2540] text-sm truncate" title={p.productDescription}>{p.productDescription}</span>
                <span className="col-span-1 text-center">
                  <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">
                    {p.productType === 'P' ? 'Prod.' : p.productType === 'S' ? 'Serv.' : 'Outro'}
                  </span>
                </span>
                <span className="col-span-1 text-right text-gray-400 font-mono text-xs">
                  {p.cost != null ? `${p.cost.toLocaleString('pt-AO', { minimumFractionDigits: 2 })}` : '—'}
                </span>
                <span className="col-span-1 text-right text-[#0A2540] font-mono text-sm">
                  {p.unitPrice.toLocaleString('pt-AO', { minimumFractionDigits: 2 })}
                </span>
                <span className="col-span-1 text-center">
                  {margin != null ? (
                    <span className={`text-xs font-semibold ${margin >= 30 ? 'text-green-600' : margin >= 10 ? 'text-amber-600' : 'text-red-500'}`}>
                      {margin.toFixed(1)}%
                    </span>
                  ) : <span className="text-gray-300 text-xs">—</span>}
                </span>
                {/* Stock */}
                <span className="col-span-1 text-center">
                  <button
                    onClick={() => openAddStock(p)}
                    className="group inline-flex items-center gap-1"
                    title="Adicionar stock"
                  >
                    <span className={`text-xs font-semibold tabular-nums ${stockLow ? 'text-red-500' : 'text-gray-700'}`}>
                      {stock}
                    </span>
                    <PlusCircle className="w-3 h-3 text-gray-300 group-hover:text-blue-500 transition-colors" />
                  </button>
                </span>
                <div className="col-span-2 flex justify-end gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setMovementsTarget(p)} className="text-gray-400 hover:text-[#0A2540] h-7 w-7 p-0" title="Histórico de stock">
                    <ClipboardList className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(p)} className="text-gray-400 hover:text-[#0A2540] h-7 w-7 p-0">
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteProdMutation.mutate(p.id)} className="text-gray-400 hover:text-red-500 h-7 w-7 p-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
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
            Precisa de criar um Ponto de Venda antes de poder criar séries. Vá a <a href="/configuracoes?tab=empresa&section=faturacao" className="underline font-medium">Configuração Fiscal</a>.
          </div>
        )}

        <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
          <div className="grid grid-cols-12 text-xs text-gray-500 font-medium uppercase tracking-wide px-4 py-2 border-b border-gray-200">
            <span className="col-span-2">Código</span>
            <span className="col-span-1">Tipo</span>
            <span className="col-span-2">Ano</span>
            <span className="col-span-3">Ponto de Venda</span>
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

      {/* ── Dialog: Novo/Editar Produto ── */}
      <Dialog open={showNewProduto || !!editing} onOpenChange={open => { if (!open) { setShowNewProduto(false); setEditing(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Editar Produto' : 'Novo Produto / Serviço'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {prodErr && <p className="text-red-500 text-sm">{prodErr}</p>}

            {/* Código + Tipo */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Código *</Label>
                <Input
                  value={prodForm.productCode}
                  onChange={e => setProdForm(p => ({ ...p, productCode: e.target.value }))}
                  placeholder="ex: CONS001"
                  className="mt-1"
                  disabled={!!editing}
                />
              </div>
              <div>
                <Label className="text-sm">Tipo (AGT)</Label>
                <Select value={prodForm.productType} onValueChange={v => setProdForm(p => ({ ...p, productType: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRODUCT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Descrição */}
            <div>
              <Label className="text-sm">Descrição *</Label>
              <Input
                value={prodForm.productDescription}
                onChange={e => setProdForm(p => ({ ...p, productDescription: e.target.value }))}
                placeholder="ex: Consultoria Marketing Digital"
                className="mt-1"
              />
            </div>

            {/* SKU */}
            <div>
              <Label className="text-sm">SKU / Referência interna</Label>
              <Input
                value={prodForm.sku}
                onChange={e => setProdForm(p => ({ ...p, sku: e.target.value }))}
                placeholder="opcional"
                className="mt-1"
              />
            </div>

            {/* Trio: Custo / Preço venda / Margem */}
            <div>
              <Label className="text-sm font-semibold text-gray-700">Preços</Label>
              <p className="text-xs text-gray-400 mb-2">Altere qualquer campo — os outros recalculam automaticamente</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs text-gray-500">Custo (Kz)</Label>
                  <Input
                    type="number" min="0" step="0.01"
                    value={prodForm.cost === '' ? '' : prodForm.cost}
                    onChange={e => handleCostChange(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="—"
                    className="mt-1 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Preço venda (Kz)</Label>
                  <Input
                    type="number" min="0" step="0.01"
                    value={prodForm.unitPrice}
                    onChange={e => handleSalePriceChange(Number(e.target.value))}
                    className="mt-1 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Margem (%)</Label>
                  <div className="relative mt-1">
                    <Input
                      type="number" min="0" max="99" step="0.1"
                      value={marginInput === '' ? '' : marginInput}
                      onChange={e => handleMarginChange(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder={computedMargin != null ? computedMargin.toFixed(1) : '—'}
                      className={`text-sm ${computedMargin != null ? (computedMargin >= 30 ? 'text-green-600' : computedMargin >= 10 ? 'text-amber-600' : 'text-red-500') : ''}`}
                    />
                  </div>
                  {computedMargin != null && (
                    <p className={`text-xs mt-0.5 font-medium ${computedMargin >= 30 ? 'text-green-600' : computedMargin >= 10 ? 'text-amber-600' : 'text-red-500'}`}>
                      {computedMargin.toFixed(2)}%
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Unidade + IVA */}
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
                    <SelectItem value="5">5% (Taxa Reduzida)</SelectItem>
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
              className="bg-[#0A2540] text-white hover:bg-[#0A2540]/90"
            >
              {(createProdMutation.isPending || editProdMutation.isPending) ? 'A guardar...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Adicionar Stock ── */}
      <Dialog open={!!stockTarget} onOpenChange={open => { if (!open) setStockTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpCircle className="w-5 h-5 text-blue-600" />
              Adicionar Stock
            </DialogTitle>
          </DialogHeader>
          {stockTarget && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
                <p className="text-xs text-gray-500">Produto</p>
                <p className="text-sm font-medium text-[#0A2540]">{stockTarget.productDescription}</p>
                <p className="text-xs text-gray-400 font-mono">{stockTarget.productCode}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Stock atual: <span className="font-semibold text-gray-700">{stockTarget.stock ?? 0}</span>
                </p>
              </div>

              {stockErr && <p className="text-red-500 text-sm">{stockErr}</p>}

              <div>
                <Label className="text-sm">Quantidade a adicionar *</Label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={stockQty === '' ? '' : stockQty}
                  onChange={e => setStockQty(e.target.value === '' ? '' : Math.max(1, Math.floor(Number(e.target.value))))}
                  placeholder="ex: 50"
                  className="mt-1"
                  autoFocus
                />
                {stockQty !== '' && (
                  <p className="text-xs text-gray-400 mt-1">
                    Novo stock: <span className="font-semibold text-gray-700">{(stockTarget.stock ?? 0) + Number(stockQty)}</span>
                  </p>
                )}
              </div>

              <div>
                <Label className="text-sm">Motivo / Origem</Label>
                <Input
                  value={stockReason}
                  onChange={e => setStockReason(e.target.value)}
                  placeholder="ex: Compra fornecedor, ajuste inventário..."
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-sm">Observação</Label>
                <Input
                  value={stockNotes}
                  onChange={e => setStockNotes(e.target.value)}
                  placeholder="opcional"
                  className="mt-1"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setStockTarget(null)}>Cancelar</Button>
            <Button
              onClick={() => addStockMutation.mutate()}
              disabled={addStockMutation.isPending || !stockQty || Number(stockQty) <= 0}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              {addStockMutation.isPending ? 'A guardar...' : 'Confirmar entrada'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Histórico de Stock ── */}
      <Dialog open={!!movementsTarget} onOpenChange={open => { if (!open) setMovementsTarget(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-gray-600" />
              Histórico de Stock
            </DialogTitle>
          </DialogHeader>
          {movementsTarget && (
            <div className="space-y-3 py-1">
              <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
                <p className="text-sm font-medium text-[#0A2540]">{movementsTarget.productDescription}</p>
                <p className="text-xs text-gray-400 font-mono">{movementsTarget.productCode}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Stock atual: <span className="font-semibold text-gray-700">{movementsTarget.stock ?? 0}</span>
                </p>
              </div>

              {movementsLoading && <p className="text-center text-gray-400 py-4">A carregar...</p>}
              {!movementsLoading && movements.length === 0 && (
                <p className="text-center text-gray-400 py-6 text-sm">Sem movimentos registados</p>
              )}
              {!movementsLoading && movements.length > 0 && (
                <div className="max-h-72 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
                  {movements.map((m: StockMovement) => (
                    <div key={m.id} className="px-3 py-2.5 flex items-start gap-3">
                      <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                        m.type === 'entry' ? 'bg-green-500' : m.type === 'exit' ? 'bg-red-500' : 'bg-amber-500'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-semibold ${
                            m.type === 'entry' ? 'text-green-600' : m.type === 'exit' ? 'text-red-600' : 'text-amber-600'
                          }`}>
                            {m.type === 'entry' ? '+' : m.type === 'exit' ? '-' : '~'}{m.quantity}
                          </span>
                          <span className="text-xs text-gray-400">
                            {m.previousStock} → {m.newStock}
                          </span>
                        </div>
                        {m.reason && <p className="text-xs text-gray-600 truncate">{m.reason}</p>}
                        {m.notes && <p className="text-xs text-gray-400 truncate">{m.notes}</p>}
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {new Date(m.createdAt).toLocaleString('pt-AO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          {m.referenceType && m.referenceType !== 'manual' && ` · ${m.referenceType}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMovementsTarget(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Nova Série ── */}
      <Dialog open={showNewSerie} onOpenChange={setShowNewSerie}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Série</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {serieErr && <p className="text-red-500 text-sm">{serieErr}</p>}
            <div>
              <Label className="text-sm">Ponto de Venda *</Label>
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
              className="bg-[#0A2540] text-white hover:bg-[#0A2540]/90">
              {createSerieMutation.isPending ? 'A criar...' : 'Criar Série'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
