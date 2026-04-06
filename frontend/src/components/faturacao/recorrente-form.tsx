'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Trash2, AlertCircle } from 'lucide-react';
import { getSeries, getEstabelecimentos, createRecorrente } from '@/lib/api';
import { ClienteAutocomplete } from './cliente-autocomplete';
import { ProdutoAutocomplete } from './produto-autocomplete';
import type { ClienteFaturacao } from '@/lib/types';

interface LineState {
  productId?: string;
  productCode: string;
  productDescription: string;
  quantity: number;
  unitPrice: number;
  unitOfMeasure: string;
  taxPercentage: number;
}

const DOCUMENT_TYPES = [
  { value: 'FT', label: 'FT — Factura' },
  { value: 'FR', label: 'FR — Factura/Recibo' },
  { value: 'ND', label: 'ND — Nota de Débito' },
  { value: 'FA', label: 'FA — Factura Simplificada' },
];

const UNITS = ['UN', 'H', 'KG', 'L', 'M', 'M2', 'M3', 'CX', 'SV'];

const CURRENCIES = [
  { value: 'AOA', label: 'AOA — Kwanza Angolano' },
  { value: 'USD', label: 'USD — Dólar Americano' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — Libra Esterlina' },
  { value: 'CHF', label: 'CHF — Franco Suíço' },
  { value: 'CNY', label: 'CNY — Yuan Chinês' },
];

const PAYMENT_METHODS = [
  'Transferência Bancária',
  'Numerário',
  'Cheque',
  'Multibanco',
  'Referência Bancária',
  'Cartão de Crédito',
  'Cartão de Débito',
];

const FREQUENCIES = [
  { value: 'WEEKLY',    label: 'Semanal' },
  { value: 'MONTHLY',   label: 'Mensal' },
  { value: 'QUARTERLY', label: 'Trimestral' },
  { value: 'ANNUAL',    label: 'Anual' },
];

const DISPLAY_MODES = [
  { value: 'DOCUMENT_ONLY', label: 'Só moeda do documento' },
  { value: 'DOCUMENT_PLUS_INTERNAL', label: 'Moeda do documento + referência interna em AOA' },
] as const;

const defaultLine = (): LineState => ({
  productId: undefined,
  productCode: '', productDescription: '', quantity: 1,
  unitPrice: 0, unitOfMeasure: 'UN', taxPercentage: 14,
});

function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function RecorrenteForm({ open, onClose }: Props) {
  const qc = useQueryClient();
  const [documentType, setDocumentType] = useState('FT');
  const [serieId, setSerieId] = useState('');
  const [estabelecimentoId, setEstabelecimentoId] = useState('');
  const [showSeriesOverride, setShowSeriesOverride] = useState(false);
  const [cliente, setCliente] = useState<ClienteFaturacao | undefined>(undefined);
  const [manualNif, setManualNif] = useState('');
  const [manualNome, setManualNome] = useState('');
  const [manualCliente, setManualCliente] = useState(false);
  const [lines, setLines] = useState<LineState[]>([defaultLine()]);
  const [frequency, setFrequency] = useState('MONTHLY');
  const [startDate, setStartDate] = useState(tomorrow());
  const [maxOccurrences, setMaxOccurrences] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Transferência Bancária');
  const [currency, setCurrency] = useState('AOA');
  const [exchangeRate, setExchangeRate] = useState('');
  const [displayMode, setDisplayMode] = useState<'DOCUMENT_ONLY' | 'DOCUMENT_PLUS_INTERNAL'>('DOCUMENT_ONLY');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const { data: series = [] } = useQuery({ queryKey: ['series'], queryFn: getSeries });
  const { data: estabelecimentos = [] } = useQuery({ queryKey: ['estabelecimentos'], queryFn: getEstabelecimentos });
  const selectedEstabelecimento = useMemo(
    () => estabelecimentos.find((estabelecimento) => estabelecimento.id === estabelecimentoId),
    [estabelecimentos, estabelecimentoId]
  );
  const activeSeries = useMemo(
    () =>
      series.filter((serie) =>
        serie.documentType === documentType &&
        serie.seriesStatus !== 'F' &&
        (!estabelecimentoId || serie.estabelecimento?.id === estabelecimentoId)
      ),
    [documentType, estabelecimentoId, series]
  );
  const selectedSerie = activeSeries.find((serie) => serie.id === serieId) || series.find((serie) => serie.id === serieId) || null;

  useEffect(() => {
    const defaultSerieForEstabelecimento = selectedEstabelecimento?.defaultSerieId
      ? activeSeries.find((serie) => serie.id === selectedEstabelecimento.defaultSerieId)
      : null;

    if (defaultSerieForEstabelecimento && serieId !== defaultSerieForEstabelecimento.id) {
      setSerieId(defaultSerieForEstabelecimento.id);
      return;
    }

    if (serieId) {
      const serieStillValid = activeSeries.some((serie) => serie.id === serieId);
      if (!serieStillValid) {
        setSerieId(activeSeries[0]?.id || '');
      }
      return;
    }

    if (activeSeries.length > 0) {
      setSerieId(activeSeries[0].id);
    }
  }, [activeSeries, selectedEstabelecimento?.defaultSerieId, serieId]);

  useEffect(() => {
    if (!showSeriesOverride) {
      return;
    }

    const currentSeriesStillValid = activeSeries.some((serie) => serie.id === serieId);
    if (!currentSeriesStillValid && selectedEstabelecimento?.defaultSerieId) {
      setShowSeriesOverride(false);
    }
  }, [activeSeries, selectedEstabelecimento?.defaultSerieId, serieId, showSeriesOverride]);

  // Calculate totals preview
  const netTotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const taxPayable = lines.reduce((s, l) => s + l.quantity * l.unitPrice * (l.taxPercentage / 100), 0);
  const grossTotal = netTotal + taxPayable;

  const mutation = useMutation({
    mutationFn: async () => {
      setError('');
      const nif  = manualCliente ? manualNif  : (cliente?.customerTaxID ?? '');
      const nome = manualCliente ? manualNome : (cliente?.customerName ?? '');
      if (!nif || !nome)        throw new Error('Selecione ou introduza os dados do cliente');
      if (!estabelecimentoId)   throw new Error('Selecione um estabelecimento');
      if (currency !== 'AOA' && (!exchangeRate || parseFloat(exchangeRate) <= 0)) {
        throw new Error(`Defina uma taxa de câmbio válida para recorrentes em ${currency}.`);
      }
      if (lines.some(l => !l.productDescription || l.quantity <= 0 || l.unitPrice < 0))
        throw new Error('Verifique as linhas: descrição, quantidade e preço são obrigatórios');

      const linesPayload = lines.map((l, i) => ({
        lineNumber: i + 1,
        productCode: l.productCode || `P${i + 1}`,
        productDescription: l.productDescription,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        unitOfMeasure: l.unitOfMeasure,
        settlementAmount: l.quantity * l.unitPrice,
        taxes: [{ taxType: 'IVA', taxCode: l.taxPercentage === 0 ? 'ISE' : 'NOR', taxPercentage: l.taxPercentage, taxAmount: l.quantity * l.unitPrice * (l.taxPercentage / 100) }],
      }));

      return createRecorrente({
        serieId: serieId || undefined, estabelecimentoId,
        clienteFaturacaoId: !manualCliente ? cliente?.id : undefined,
        customerTaxID: nif,
        customerName: nome,
        customerAddress: !manualCliente ? cliente?.customerAddress : undefined,
        documentType,
        lines: linesPayload as unknown as string,
        paymentMethod,
        baseCurrency: 'AOA',
        displayCurrency: currency,
        currencyCode: currency,
        exchangeRate: currency !== 'AOA' && exchangeRate ? parseFloat(exchangeRate) : undefined,
        displayMode: currency === 'AOA' ? 'DOCUMENT_ONLY' : displayMode,
        frequency: frequency as 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL',
        startDate,
        maxOccurrences: maxOccurrences ? parseInt(maxOccurrences) as unknown as number : undefined,
        notes: notes || undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recorrentes'] });
      handleClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  function handleClose() {
    setDocumentType('FT'); setSerieId(''); setEstabelecimentoId('');
    setShowSeriesOverride(false);
    setCliente(undefined); setManualNif(''); setManualNome(''); setManualCliente(false);
    setLines([defaultLine()]); setFrequency('MONTHLY'); setStartDate(tomorrow());
    setMaxOccurrences(''); setPaymentMethod('Transferência Bancária'); setCurrency('AOA'); setExchangeRate(''); setDisplayMode('DOCUMENT_ONLY'); setNotes(''); setError('');
    onClose();
  }

  function updateLine(i: number, patch: Partial<LineState>) {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#2c2f31]">Nova Fatura Recorrente</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{error}
            </div>
          )}

          {/* Document + Serie */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">Tipo de Documento</Label>
              <Select value={documentType} onValueChange={setDocumentType}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map(dt => <SelectItem key={dt.value} value={dt.value}>{dt.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <Label className="text-xs text-gray-500">Série</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setShowSeriesOverride((current) => !current)}
                  disabled={!estabelecimentoId || activeSeries.length === 0}
                >
                  {showSeriesOverride ? 'Usar automática' : 'Alterar manualmente'}
                </Button>
              </div>
              {showSeriesOverride ? (
                <>
                  <Select value={serieId} onValueChange={setSerieId}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                    <SelectContent>
                      {activeSeries.map((s: { id: string; seriesCode: string; seriesYear: number }) => (
                        <SelectItem key={s.id} value={s.id}>{s.seriesCode}/{s.seriesYear}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-[11px] text-gray-500">
                    Só altera manualmente a série quando esta recorrente não deve seguir a configuração padrão do ponto de venda.
                  </p>
                </>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <p className="text-sm font-semibold text-[#2c2f31]">
                    {selectedSerie
                      ? `${selectedSerie.seriesCode} / ${selectedSerie.seriesYear}`
                      : estabelecimentoId
                      ? 'Sem série padrão disponível'
                      : 'Seleciona primeiro o ponto de venda'}
                  </p>
                  <p className="mt-1 text-[11px] text-gray-500">
                    {selectedSerie
                      ? 'A recorrente vai usar automaticamente a série padrão do ponto de venda.'
                      : estabelecimentoId
                      ? 'Este ponto de venda ainda não tem uma série padrão ativa para este tipo de documento.'
                      : 'A série aparece automaticamente depois de escolheres o ponto de venda.'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Ponto de venda */}
          <div>
            <Label className="text-xs text-gray-500 mb-1 block">Ponto de Venda</Label>
            <Select value={estabelecimentoId} onValueChange={setEstabelecimentoId}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
              <SelectContent>
                {estabelecimentos.map((e: { id: string; nome: string; nif?: string }) => (
                  <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-[11px] text-gray-500">
              As recorrentes usam a série padrão do ponto de venda selecionado.
            </p>
          </div>

          {/* Cliente */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs text-gray-500">Cliente</Label>
              <button
                type="button"
                className="text-xs text-[var(--workspace-primary)] hover:underline"
                onClick={() => { setManualCliente(v => !v); setCliente(undefined); setManualNif(''); setManualNome(''); }}
              >
                {manualCliente ? 'Pesquisar cliente' : 'Introduzir manualmente'}
              </button>
            </div>
            {manualCliente ? (
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="NIF *" value={manualNif} onChange={e => setManualNif(e.target.value)} className="h-9" />
                <Input placeholder="Nome *" value={manualNome} onChange={e => setManualNome(e.target.value)} className="h-9" />
              </div>
            ) : (
              <ClienteAutocomplete value={cliente?.customerName} onChange={setCliente} />
            )}
          </div>

          {/* Lines */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs text-gray-500">Artigos / Serviços</Label>
              <button type="button" onClick={() => setLines(p => [...p, defaultLine()])}
                className="flex items-center gap-1 text-xs text-[var(--workspace-primary)] hover:underline">
                <Plus className="w-3 h-3" />Adicionar linha
              </button>
            </div>
            <div className="space-y-2">
              {lines.map((line, i) => (
                <div key={i} className="grid grid-cols-12 gap-1.5 items-start">
                  <div className="col-span-4">
                    <ProdutoAutocomplete
                      value={line.productDescription}
                      placeholder="Pesquisar produto..."
                      hasSelection={!!line.productId}
                      onChange={(produto) => updateLine(i, {
                        productId: produto.id,
                        productCode: produto.productCode,
                        productDescription: produto.productDescription,
                        unitPrice: produto.unitPrice,
                        unitOfMeasure: produto.unitOfMeasure,
                        taxPercentage: produto.taxPercentage,
                      })}
                    />
                    {!line.productId && (
                      <Input
                        placeholder="Ou escrever descrição manualmente *"
                        value={line.productDescription}
                        onChange={e => updateLine(i, {
                          productId: undefined,
                          productCode: '',
                          productDescription: e.target.value,
                        })}
                        className="mt-1 h-8 text-sm"
                      />
                    )}
                  </div>
                  <div className="col-span-2">
                    <Input
                      placeholder="Qtd" type="number" min={0} step="any" value={line.quantity}
                      onChange={e => updateLine(i, { quantity: parseFloat(e.target.value) || 0 })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      placeholder="Preço" type="number" min={0} step="any" value={line.unitPrice}
                      onChange={e => updateLine(i, {
                        productId: line.productId,
                        unitPrice: parseFloat(e.target.value) || 0,
                      })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="col-span-2">
                    <Select value={String(line.taxPercentage)} onValueChange={v => updateLine(i, { taxPercentage: parseFloat(v) })}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="14">IVA 14%</SelectItem>
                        <SelectItem value="5">IVA 5%</SelectItem>
                        <SelectItem value="0">Isento</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-1">
                    <Select value={line.unitOfMeasure} onValueChange={v => updateLine(i, { unitOfMeasure: v })}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-1 flex justify-center pt-1.5">
                    {lines.length > 1 && (
                      <button type="button" onClick={() => setLines(p => p.filter((_, idx) => idx !== i))}
                        className="text-red-400 hover:text-red-600">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {/* Totals preview */}
            {grossTotal > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100 flex justify-end gap-4 text-sm text-gray-600">
                <span>Total s/IVA: <b className="text-[#2c2f31]">{netTotal.toLocaleString('pt-PT', { minimumFractionDigits: 2 })} Kz</b></span>
                <span>Total c/IVA: <b className="text-[var(--workspace-primary)]">{grossTotal.toLocaleString('pt-PT', { minimumFractionDigits: 2 })} Kz</b></span>
              </div>
            )}
          </div>

          {/* Recurrence settings */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">Frequência *</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">Data de início *</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">Método de Pagamento</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">Máx. de emissões</Label>
              <Input
                type="number" min={1} placeholder="Ilimitado"
                value={maxOccurrences}
                onChange={e => setMaxOccurrences(e.target.value)}
                className="h-9"
              />
            </div>
          </div>

          {/* Moeda */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">Moeda</Label>
              <Select
                value={currency}
                onValueChange={(value) => {
                  setCurrency(value);
                  if (value === 'AOA') {
                    setDisplayMode('DOCUMENT_ONLY');
                    setExchangeRate('');
                  }
                }}
              >
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {currency !== 'AOA' && (
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">Taxa de Câmbio (1 {currency} = ? AOA)</Label>
                <Input
                  type="number" min={0} step="any" placeholder="Ex: 850"
                  value={exchangeRate}
                  onChange={e => setExchangeRate(e.target.value)}
                  className="h-9"
                />
              </div>
            )}
          </div>
          {currency !== 'AOA' && (
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">Modo de apresentação</Label>
              <Select value={displayMode} onValueChange={(value) => setDisplayMode(value as 'DOCUMENT_ONLY' | 'DOCUMENT_PLUS_INTERNAL')}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DISPLAY_MODES.map((mode) => (
                    <SelectItem key={mode.value} value={mode.value}>
                      {mode.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-2 text-xs text-slate-500">
                Cada emissão vai usar {currency} como moeda principal do documento.
              </p>
            </div>
          )}

          <div>
            <Label className="text-xs text-gray-500 mb-1 block">Notas internas</Label>
            <Textarea
              value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Notas opcionais..." rows={2} className="resize-none text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="text-white"
          >
            {mutation.isPending ? 'A guardar...' : 'Criar Fatura Recorrente'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
