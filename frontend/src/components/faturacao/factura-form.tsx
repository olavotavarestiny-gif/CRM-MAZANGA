'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Trash2, Plus, AlertCircle } from 'lucide-react';
import { getSeries, getEstabelecimentos, createFactura, createClienteFaturacao, createProduto, updateProduto } from '@/lib/api';
import { ClienteAutocomplete } from './cliente-autocomplete';
import { ProdutoAutocomplete } from './produto-autocomplete';
import type { ClienteFaturacao, Produto } from '@/lib/types';

interface LineState {
  productId?: string;
  productCode: string;
  productDescription: string;
  quantity: number;
  unitPrice: number;
  unitOfMeasure: string;
  taxPercentage: number;
  isIncluded?: boolean; // Proforma: item sem custo extra ("Incluído")
}

const DOCUMENT_TYPES = [
  { value: 'FT', label: 'FT — Factura' },
  { value: 'FR', label: 'FR — Factura/Recibo' },
  { value: 'ND', label: 'ND — Nota de Débito' },
  { value: 'NC', label: 'NC — Nota de Crédito' },
  { value: 'FA', label: 'FA — Factura Simplificada' },
  { value: 'PF', label: 'PF — Fatura Proforma' },
];

const CURRENCIES = [
  { value: 'AOA', label: 'AOA — Kwanza', symbol: 'Kz' },
  { value: 'USD', label: 'USD — Dólar', symbol: '$' },
  { value: 'EUR', label: 'EUR — Euro', symbol: '€' },
  { value: 'GBP', label: 'GBP — Libra', symbol: '£' },
  { value: 'CHF', label: 'CHF — Franco Suíço', symbol: 'Fr' },
  { value: 'CNY', label: 'CNY — Yuan', symbol: '¥' },
];

const UNITS = ['UN', 'H', 'KG', 'L', 'M', 'M2', 'M3', 'CX', 'SV'];

const PAYMENT_METHODS = [
  'Transferência Bancária',
  'Numerário',
  'Cheque',
  'Multibanco',
  'Referência Bancária',
  'Cartão de Crédito',
  'Cartão de Débito',
];

function fmtAmount(n: number, currency: string) {
  if (currency === 'AOA') {
    return n.toLocaleString('pt-AO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Kz';
  }
  const sym = CURRENCIES.find(c => c.value === currency)?.symbol ?? currency;
  return sym + ' ' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface ProdutoDialogState {
  open: boolean;
  lineIndex: number;
  mode: 'create' | 'edit';
  productId?: string;
  productCode: string;
  productDescription: string;
  unitPrice: number;
  unitOfMeasure: string;
  taxPercentage: number;
}

const emptyDialog = (lineIndex = 0, description = ''): ProdutoDialogState => ({
  open: true, lineIndex, mode: 'create', productId: undefined,
  productCode: '', productDescription: description,
  unitPrice: 0, unitOfMeasure: 'UN', taxPercentage: 14,
});

export function FacturaForm() {
  const router = useRouter();
  const qc = useQueryClient();
  const [documentType, setDocumentType] = useState('FT');
  const [serieId, setSerieId] = useState('');
  const [estabelecimentoId, setEstabelecimentoId] = useState('');
  const [cliente, setCliente] = useState<ClienteFaturacao | null>(null);
  const [newNif, setNewNif] = useState('');
  const [newNome, setNewNome] = useState('');
  const [newMorada, setNewMorada] = useState('');
  const [manualCliente, setManualCliente] = useState(false);
  const [lines, setLines] = useState<LineState[]>([
    { productCode: '', productDescription: '', quantity: 1, unitPrice: 0, unitOfMeasure: 'UN', taxPercentage: 14 },
  ]);
  const [currencyCode, setCurrencyCode] = useState('AOA');
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const [paymentMethod, setPaymentMethod] = useState('Transferência Bancária');
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState<ProdutoDialogState | null>(null);
  const [dialogSaving, setDialogSaving] = useState(false);

  const { data: series = [] } = useQuery({ queryKey: ['series'], queryFn: getSeries });
  const { data: estabs = [] } = useQuery({ queryKey: ['estabelecimentos'], queryFn: getEstabelecimentos });

  const mutation = useMutation({
    mutationFn: async () => {
      let clienteFaturacaoId: string | undefined;
      let customerTaxID = '';
      let customerName = '';
      let customerAddress = '';

      if (manualCliente) {
        if (!newNif.trim() || !newNome.trim()) throw new Error('NIF e nome do cliente obrigatórios');
        const c = await createClienteFaturacao({ customerTaxID: newNif, customerName: newNome, customerAddress: newMorada });
        clienteFaturacaoId = c.id;
        customerTaxID = c.customerTaxID;
        customerName = c.customerName;
        customerAddress = newMorada;
      } else {
        if (!cliente) throw new Error('Selecione um cliente');
        clienteFaturacaoId = cliente.id;
        customerTaxID = cliente.customerTaxID;
        customerName = cliente.customerName;
        customerAddress = cliente.customerAddress || '';
      }

      if (!serieId) throw new Error('Selecione uma série');
      if (!estabelecimentoId) throw new Error('Selecione um estabelecimento');
      if (lines.some(l => !l.productDescription)) throw new Error('Preencha todos os produtos/serviços');

      const isAOA = currencyCode === 'AOA';

      return createFactura({
        documentType, serieId, estabelecimentoId,
        customerTaxID, customerName, customerAddress, clienteFaturacaoId,
        currencyCode,
        currencyAmount: isAOA ? undefined : grossTotal,
        exchangeRate: isAOA ? undefined : exchangeRate,
        paymentMethod,
        lines: lines.map(l => ({
          productCode: l.productCode || l.productDescription.substring(0, 10).toUpperCase().replace(/\s/g, '_'),
          productDescription: l.productDescription,
          quantity: l.quantity,
          unitPrice: l.isIncluded ? 0 : l.unitPrice,
          unitOfMeasure: l.unitOfMeasure,
          settlementAmount: l.isIncluded ? 0 : l.quantity * l.unitPrice,
          isIncluded: l.isIncluded || false,
          taxes: [{ taxType: 'IVA', taxCode: l.isIncluded || l.taxPercentage === 0 ? 'ISE' : 'NOR', taxPercentage: l.isIncluded ? 0 : l.taxPercentage }],
        })),
      });
    },
    onSuccess: (factura) => {
      qc.invalidateQueries({ queryKey: ['facturas'] });
      qc.invalidateQueries({ queryKey: ['faturacao-dashboard'] });
      router.push(`/faturacao/${factura.id}`);
    },
    onError: (err: Error) => setError(err.message),
  });

  // Linhas "incluído" contribuem 0 ao total
  const netTotal = lines.reduce((s, l) => s + (l.isIncluded ? 0 : l.quantity * l.unitPrice), 0);
  const taxPayable = lines.reduce((s, l) => s + (l.isIncluded ? 0 : l.quantity * l.unitPrice * (l.taxPercentage / 100)), 0);
  const grossTotal = netTotal + taxPayable;

  const addLine = () => setLines(p => [...p, { productCode: '', productDescription: '', quantity: 1, unitPrice: 0, unitOfMeasure: 'UN', taxPercentage: 14, isIncluded: false }]);
  const removeLine = (i: number) => setLines(p => p.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: keyof LineState, val: string | number) =>
    setLines(p => p.map((l, idx) => idx === i ? { ...l, [field]: val } : l));
  const toggleIncluded = (i: number) =>
    setLines(p => p.map((l, idx) => idx === i ? { ...l, isIncluded: !l.isIncluded, unitPrice: !l.isIncluded ? 0 : l.unitPrice } : l));

  const activeSeries = series.filter(s => s.seriesStatus !== 'F' && s.documentType === documentType);

  // --- Produto Dialog handlers ---
  async function handleDialogSave() {
    if (!dialog) return;
    if (!dialog.productDescription.trim()) return;
    setDialogSaving(true);
    try {
      let produto: Produto;
      if (dialog.mode === 'edit' && dialog.productId) {
        produto = await updateProduto(dialog.productId, {
          productDescription: dialog.productDescription,
          unitPrice: dialog.unitPrice,
          unitOfMeasure: dialog.unitOfMeasure,
          taxPercentage: dialog.taxPercentage,
        });
      } else {
        produto = await createProduto({
          productCode: dialog.productCode || dialog.productDescription.substring(0, 10).toUpperCase().replace(/\s/g, '_'),
          productDescription: dialog.productDescription,
          unitPrice: dialog.unitPrice,
          unitOfMeasure: dialog.unitOfMeasure,
          taxPercentage: dialog.taxPercentage,
        });
      }
      qc.invalidateQueries({ queryKey: ['produtos'] });
      const i = dialog.lineIndex;
      setLines(p => p.map((l, idx) => idx === i ? {
        ...l,
        productId: produto.id,
        productCode: produto.productCode,
        productDescription: produto.productDescription,
        unitPrice: produto.unitPrice,
        unitOfMeasure: produto.unitOfMeasure,
        taxPercentage: produto.taxPercentage,
      } : l));
      setDialog(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erro ao guardar produto');
    } finally {
      setDialogSaving(false);
    }
  }

  function openCreateDialog(lineIndex: number, description: string) {
    setDialog(emptyDialog(lineIndex, description));
  }

  function openEditDialog(lineIndex: number) {
    const l = lines[lineIndex];
    setDialog({
      open: true, lineIndex, mode: 'edit',
      productId: l.productId,
      productCode: l.productCode,
      productDescription: l.productDescription,
      unitPrice: l.unitPrice,
      unitOfMeasure: l.unitOfMeasure,
      taxPercentage: l.taxPercentage,
    });
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {documentType === 'PF' && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
          <div>
            <p className="font-semibold">Fatura Proforma — Documento sem validade fiscal</p>
            <p className="text-xs mt-0.5 text-amber-700">Este documento é uma proposta comercial. Não é submetido à AGT e não substitui uma fatura. Para faturar oficialmente, emita uma FT ou FR.</p>
          </div>
        </div>
      )}

      {/* Tipo e Série */}
      <Card>
        <CardHeader><CardTitle className="text-[#0A2540] text-base">Documento</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-gray-600">Tipo de Documento</Label>
            <Select value={documentType} onValueChange={v => { setDocumentType(v); setSerieId(''); }}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-gray-600">Série</Label>
            <Select value={serieId} onValueChange={setSerieId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecionar série..." />
              </SelectTrigger>
              <SelectContent>
                {activeSeries.length === 0 && <SelectItem value="none" disabled>Sem séries ativas para este tipo</SelectItem>}
                {activeSeries.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.seriesCode} / {s.seriesYear} · #{(s.lastDocumentNumber ?? 0) + 1}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-gray-600">Estabelecimento</Label>
            <Select value={estabelecimentoId} onValueChange={setEstabelecimentoId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecionar estabelecimento..." />
              </SelectTrigger>
              <SelectContent>
                {estabs.map(e => <SelectItem key={e.id} value={e.id}>{e.nome} — {e.nif}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-gray-600">Moeda</Label>
            <Select value={currencyCode} onValueChange={v => { setCurrencyCode(v); setExchangeRate(1); }}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {currencyCode !== 'AOA' && (
            <div className="col-span-2">
              <Label className="text-xs text-gray-600">Taxa de câmbio (1 {currencyCode} = ? AOA)</Label>
              <Input
                type="number" min="0.01" step="0.01" value={exchangeRate}
                onChange={e => setExchangeRate(parseFloat(e.target.value) || 1)}
                className="mt-1 w-48"
              />
            </div>
          )}
          <div className="col-span-2">
            <Label className="text-xs text-gray-600">Método de Pagamento</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Cliente */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-[#0A2540] text-base">Cliente</CardTitle>
          <button
            type="button"
            onClick={() => { setManualCliente(!manualCliente); setCliente(null); }}
            className="text-xs text-violet-600 hover:text-violet-700 underline"
          >
            {manualCliente ? 'Pesquisar existente' : 'Novo cliente'}
          </button>
        </CardHeader>
        <CardContent className="space-y-3">
          {manualCliente ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-600">NIF *</Label>
                <Input value={newNif} onChange={e => setNewNif(e.target.value)} placeholder="5000123456" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs text-gray-600">Nome *</Label>
                <Input value={newNome} onChange={e => setNewNome(e.target.value)} placeholder="Nome da empresa" className="mt-1" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-gray-600">Morada</Label>
                <Input value={newMorada} onChange={e => setNewMorada(e.target.value)} placeholder="Endereço completo" className="mt-1" />
              </div>
            </div>
          ) : (
            <>
              <ClienteAutocomplete onChange={setCliente} />
              {cliente && (
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 space-y-1">
                  <p className="text-sm font-medium text-[#0A2540]">{cliente.customerName}</p>
                  <p className="text-xs text-gray-500">NIF: {cliente.customerTaxID}</p>
                  {cliente.customerAddress && <p className="text-xs text-gray-500">{cliente.customerAddress}</p>}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Artigos */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-[#0A2540] text-base">Artigos / Serviços</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={addLine} className="border-gray-200 text-gray-700 hover:bg-gray-50">
            <Plus className="w-3 h-3 mr-1" /> Adicionar linha
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {lines.map((line, i) => (
            <div key={i} className={`grid grid-cols-12 gap-2 items-end p-3 rounded-lg border ${line.isIncluded ? 'bg-emerald-50 border-emerald-100' : 'bg-gray-50 border-gray-100'}`}>
              <div className="col-span-4">
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs text-gray-600">Produto / Serviço</Label>
                  {documentType === 'PF' && (
                    <button
                      type="button"
                      onClick={() => toggleIncluded(i)}
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors ${line.isIncluded ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-500 border-gray-300 hover:border-emerald-400 hover:text-emerald-600'}`}
                    >
                      {line.isIncluded ? '✓ Incluído' : '+ Incluído'}
                    </button>
                  )}
                </div>
                <div>
                  <ProdutoAutocomplete
                    value={line.productDescription}
                    placeholder="Pesquisar ou digitar..."
                    hasSelection={!!line.productDescription}
                    onCreateNew={(desc) => openCreateDialog(i, desc)}
                    onEditCurrent={() => openEditDialog(i)}
                    onChange={p => {
                      setLines(prev => prev.map((l, idx) => idx === i ? {
                        ...l,
                        productId: p.id,
                        productCode: p.productCode,
                        productDescription: p.productDescription,
                        unitPrice: l.isIncluded ? 0 : p.unitPrice,
                        taxPercentage: p.taxPercentage,
                        unitOfMeasure: p.unitOfMeasure,
                      } : l));
                    }}
                  />
                  {!line.productDescription && (
                    <Input
                      placeholder="Descrição manual"
                      className="mt-1 text-sm"
                      onChange={e => updateLine(i, 'productDescription', e.target.value)}
                    />
                  )}
                </div>
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-gray-600">Qtd.</Label>
                <Input type="number" min="0.01" step="0.01" value={line.quantity}
                  onChange={e => updateLine(i, 'quantity', parseFloat(e.target.value) || 1)}
                  className="mt-1 text-sm" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-gray-600">Preço Unit.</Label>
                {line.isIncluded ? (
                  <div className="mt-1 h-9 flex items-center px-3 bg-emerald-100 rounded-md border border-emerald-200">
                    <span className="text-xs font-semibold text-emerald-700">Incluído</span>
                  </div>
                ) : (
                  <Input type="number" min="0" step="0.01" value={line.unitPrice}
                    onChange={e => updateLine(i, 'unitPrice', parseFloat(e.target.value) || 0)}
                    className="mt-1 text-sm" />
                )}
              </div>
              <div className="col-span-1">
                <Label className="text-xs text-gray-600">IVA%</Label>
                {line.isIncluded ? (
                  <div className="mt-1 h-9 flex items-center px-3 bg-emerald-100 rounded-md border border-emerald-200">
                    <span className="text-xs text-emerald-700">—</span>
                  </div>
                ) : (
                  <Select value={String(line.taxPercentage)} onValueChange={v => updateLine(i, 'taxPercentage', Number(v))}>
                    <SelectTrigger className="mt-1 text-sm h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="14">14%</SelectItem>
                      <SelectItem value="0">0% (ISE)</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-gray-600">Total (s/IVA)</Label>
                <div className={`mt-1 h-9 flex items-center px-3 rounded-md border ${line.isIncluded ? 'bg-emerald-100 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
                  {line.isIncluded
                    ? <span className="text-xs font-semibold text-emerald-700">Incluído</span>
                    : <span className="text-sm text-[#0A2540] font-mono">{(line.quantity * line.unitPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>}
                </div>
              </div>
              <div className="col-span-1 flex justify-center">
                <Button type="button" variant="ghost" size="sm" onClick={() => removeLine(i)} disabled={lines.length === 1}
                  className="text-gray-400 hover:text-red-600 hover:bg-red-50 mt-1">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Totais */}
      <Card>
        <CardContent className="pt-4 space-y-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Total sem IVA</span>
            <span className="font-mono text-[#0A2540]">{fmtAmount(netTotal, currencyCode)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>IVA</span>
            <span className="font-mono text-[#0A2540]">{fmtAmount(taxPayable, currencyCode)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2">
            <span className="text-[#0A2540]">Total com IVA</span>
            <span className="font-mono text-violet-700">{fmtAmount(grossTotal, currencyCode)}</span>
          </div>
          {currencyCode !== 'AOA' && exchangeRate > 0 && (
            <div className="flex justify-between text-sm text-gray-500 border-t border-gray-100 pt-2">
              <span>Equivalente AOA (taxa {exchangeRate})</span>
              <span className="font-mono">{(grossTotal * exchangeRate).toLocaleString('pt-AO', { minimumFractionDigits: 2 })} Kz</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Acções */}
      <div className="flex gap-3">
        <Button
          onClick={() => { setError(''); mutation.mutate(); }}
          disabled={mutation.isPending}
          className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold"
        >
          {mutation.isPending ? 'A emitir...' : 'Emitir Factura'}
        </Button>
        <Button variant="outline" onClick={() => router.back()} className="border-gray-200 text-gray-700 hover:bg-gray-50">
          Cancelar
        </Button>
      </div>

      {/* Dialog: Criar / Editar Produto */}
      {dialog && (
        <Dialog open={dialog.open} onOpenChange={(open) => !open && setDialog(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{dialog.mode === 'edit' ? 'Editar Produto' : 'Criar Produto'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-600">Código (opcional)</Label>
                  <Input
                    value={dialog.productCode}
                    onChange={e => setDialog(d => d ? { ...d, productCode: e.target.value } : d)}
                    placeholder="Auto-gerado"
                    className="mt-1 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Unidade</Label>
                  <Select value={dialog.unitOfMeasure} onValueChange={v => setDialog(d => d ? { ...d, unitOfMeasure: v } : d)}>
                    <SelectTrigger className="mt-1 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs text-gray-600">Descrição *</Label>
                <Input
                  value={dialog.productDescription}
                  onChange={e => setDialog(d => d ? { ...d, productDescription: e.target.value } : d)}
                  placeholder="Nome do produto ou serviço"
                  className="mt-1 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-600">Preço Unitário *</Label>
                  <Input
                    type="number" min="0" step="0.01"
                    value={dialog.unitPrice}
                    onChange={e => setDialog(d => d ? { ...d, unitPrice: parseFloat(e.target.value) || 0 } : d)}
                    className="mt-1 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-600">IVA</Label>
                  <Select value={String(dialog.taxPercentage)} onValueChange={v => setDialog(d => d ? { ...d, taxPercentage: Number(v) } : d)}>
                    <SelectTrigger className="mt-1 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="14">14% (NOR)</SelectItem>
                      <SelectItem value="0">0% (ISE)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialog(null)}>
                Cancelar
              </Button>
              <Button
                onClick={handleDialogSave}
                disabled={dialogSaving || !dialog.productDescription.trim()}
                className="bg-gradient-to-r from-orange-500 to-red-500 text-white hover:opacity-90"
              >
                {dialogSaving ? 'A guardar...' : (dialog.mode === 'edit' ? 'Actualizar' : 'Criar e Adicionar')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
