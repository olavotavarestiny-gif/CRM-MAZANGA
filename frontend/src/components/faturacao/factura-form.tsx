'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingButton } from '@/components/ui/loading-button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast-provider';
import { AsyncSearchPicker, SearchGroup } from '@/components/search/async-search-picker';
import {
  createClienteFaturacao,
  createFactura,
  createProduto,
  createSerie,
  getClientesFaturacao,
  getContacts,
  getEstabelecimentos,
  getSeries,
  updateProduto,
} from '@/lib/api';
import type { ClienteFaturacao, Contact, Produto } from '@/lib/types';
import { ProdutoAutocomplete } from './produto-autocomplete';

interface LineState {
  productId?: string;
  productCode: string;
  productDescription: string;
  quantity: number;
  unitPrice: number;
  unitOfMeasure: string;
  taxPercentage: number;
  isIncluded?: boolean;
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

type CustomerMode = 'search' | 'manual';
type CustomerSource = 'crm' | 'faturacao' | 'manual';

interface InvoiceCustomerFields {
  taxId: string;
  name: string;
  address: string;
  phone: string;
  email: string;
}

interface SelectedCustomerMeta {
  source: CustomerSource;
  id?: string;
  contactId?: number;
}

interface CustomerLookupItem {
  id: string;
  source: 'crm' | 'faturacao';
  label: string;
  customerName: string;
  customerTaxID: string;
  customerAddress?: string;
  customerPhone?: string;
  customerEmail?: string;
  company?: string;
  contactId?: number;
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

const SOURCE_BADGE_STYLES: Record<'crm' | 'faturacao', string> = {
  crm: 'border-slate-200 bg-slate-100 text-slate-600',
  faturacao: 'border-blue-200 bg-blue-50 text-blue-700',
};

const blankCustomerFields: InvoiceCustomerFields = {
  taxId: '',
  name: '',
  address: '',
  phone: '',
  email: '',
};

function fmtAmount(n: number, currency: string) {
  if (currency === 'AOA') {
    return n.toLocaleString('pt-AO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Kz';
  }
  const sym = CURRENCIES.find((c) => c.value === currency)?.symbol ?? currency;
  return sym + ' ' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function emptyDialog(lineIndex = 0, description = ''): ProdutoDialogState {
  return {
    open: true,
    lineIndex,
    mode: 'create',
    productId: undefined,
    productCode: '',
    productDescription: description,
    unitPrice: 0,
    unitOfMeasure: 'UN',
    taxPercentage: 14,
  };
}

function normalizeLookupValue(value: string | undefined | null) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function getContactTaxIdFallback(contact: Contact) {
  const digits = (contact.phone || '').replace(/\D/g, '');
  return digits || `CONTACT-${contact.id}`;
}

function rankCustomerOption(option: CustomerLookupItem, query: string) {
  const normalizedQuery = normalizeLookupValue(query);
  const fields = [
    option.customerName,
    option.customerTaxID,
    option.customerPhone,
    option.company,
    option.customerEmail,
  ].map(normalizeLookupValue);

  if (fields.some((field) => field === normalizedQuery)) {
    return 0;
  }

  if (fields.some((field) => field.startsWith(normalizedQuery))) {
    return 1;
  }

  return 2;
}

function buildFieldsFromBillingClient(cliente: ClienteFaturacao): InvoiceCustomerFields {
  return {
    taxId: cliente.customerTaxID || '',
    name: cliente.customerName || '',
    address: cliente.customerAddress || '',
    phone: cliente.customerPhone || '',
    email: cliente.customerEmail || '',
  };
}

function buildFieldsFromContact(contact: Contact): InvoiceCustomerFields {
  return {
    taxId: getContactTaxIdFallback(contact),
    name: contact.company?.trim() || contact.name,
    address: '',
    phone: contact.phone || '',
    email: contact.email || '',
  };
}

export function FacturaForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [documentType, setDocumentType] = useState('FT');
  const [serieId, setSerieId] = useState('');
  const [estabelecimentoId, setEstabelecimentoId] = useState('');
  const [customerMode, setCustomerMode] = useState<CustomerMode>('search');
  const [selectedCustomerMeta, setSelectedCustomerMeta] = useState<SelectedCustomerMeta | null>(null);
  const [customerFields, setCustomerFields] = useState<InvoiceCustomerFields>(blankCustomerFields);
  const [customerWarning, setCustomerWarning] = useState('');
  const [lines, setLines] = useState<LineState[]>([
    { productCode: '', productDescription: '', quantity: 1, unitPrice: 0, unitOfMeasure: 'UN', taxPercentage: 14 },
  ]);
  const [currencyCode, setCurrencyCode] = useState('AOA');
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const [paymentMethod, setPaymentMethod] = useState('Transferência Bancária');
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState<ProdutoDialogState | null>(null);
  const [dialogError, setDialogError] = useState('');
  const [dialogSaving, setDialogSaving] = useState(false);
  const [seriesModalOpen, setSeriesModalOpen] = useState(false);
  const [seriesError, setSeriesError] = useState('');
  const [showSeriesOverride, setShowSeriesOverride] = useState(false);
  const [seriesForm, setSeriesForm] = useState({
    estabelecimentoId: '',
    seriesCode: '',
    seriesYear: String(new Date().getFullYear()),
    documentType: 'FT',
    firstDocumentNumber: '1',
  });

  const seriesQuery = useQuery({
    queryKey: ['series'],
    queryFn: getSeries,
  });
  const estabsQuery = useQuery({
    queryKey: ['estabelecimentos'],
    queryFn: getEstabelecimentos,
  });

  const series = seriesQuery.data || [];
  const estabs = estabsQuery.data || [];
  const selectedEstabelecimento = estabs.find((estabelecimento) => estabelecimento.id === estabelecimentoId);

  const searchCustomers = useMemo(
    () => async (query: string): Promise<SearchGroup<CustomerLookupItem>[]> => {
      const [billingData, contacts] = await Promise.all([
        getClientesFaturacao({ search: query }),
        getContacts({ search: query }),
      ]);

      const billingClients = billingData.clientes
        .map((cliente) => ({
          id: cliente.id,
          source: 'faturacao' as const,
          label: 'Faturação',
          customerName: cliente.customerName,
          customerTaxID: cliente.customerTaxID,
          customerAddress: cliente.customerAddress,
          customerPhone: cliente.customerPhone,
          customerEmail: cliente.customerEmail,
          contactId: cliente.contactId,
        }))
        .sort((a, b) => {
          const rankDiff = rankCustomerOption(a, query) - rankCustomerOption(b, query);
          return rankDiff || a.customerName.localeCompare(b.customerName);
        });

      const crmContacts = contacts
        .map((contact) => ({
          id: String(contact.id),
          source: 'crm' as const,
          label: 'CRM',
          customerName: contact.company?.trim() || contact.name,
          customerTaxID: getContactTaxIdFallback(contact),
          customerPhone: contact.phone,
          customerEmail: contact.email,
          company: contact.company,
          contactId: contact.id,
        }))
        .sort((a, b) => {
          const rankDiff = rankCustomerOption(a, query) - rankCustomerOption(b, query);
          return rankDiff || a.customerName.localeCompare(b.customerName);
        });

      return [
        {
          id: 'billing',
          label: 'Clientes de faturação',
          items: billingClients,
        },
        {
          id: 'crm',
          label: 'Contactos CRM',
          items: crmContacts,
        },
      ]
        .filter((group) => group.items.length > 0)
        .sort((a, b) => {
          const aRank = a.items.length > 0 ? rankCustomerOption(a.items[0], query) : Number.MAX_SAFE_INTEGER;
          const bRank = b.items.length > 0 ? rankCustomerOption(b.items[0], query) : Number.MAX_SAFE_INTEGER;
          if (aRank !== bRank) {
            return aRank - bRank;
          }
          return a.id === 'billing' ? -1 : 1;
        });
    },
    []
  );

  const mutation = useMutation({
    mutationFn: async () => {
      let clienteFaturacaoId: string | undefined;
      let customerTaxID = '';
      let customerName = '';
      let customerAddress = '';

      if (!customerFields.taxId.trim() || !customerFields.name.trim()) {
        throw new Error('NIF e nome do cliente são obrigatórios');
      }

      if (customerMode === 'manual') {
        const createdCustomer = await createClienteFaturacao({
          customerTaxID: customerFields.taxId.trim(),
          customerName: customerFields.name.trim(),
          customerAddress: customerFields.address.trim() || undefined,
          customerPhone: customerFields.phone.trim() || undefined,
          customerEmail: customerFields.email.trim() || undefined,
        });
        clienteFaturacaoId = createdCustomer.id;
      } else if (selectedCustomerMeta?.source === 'faturacao') {
        clienteFaturacaoId = selectedCustomerMeta.id;
      }

      customerTaxID = customerFields.taxId.trim();
      customerName = customerFields.name.trim();
      customerAddress = customerFields.address.trim();

      if (!estabelecimentoId) {
        throw new Error('Selecione um ponto de venda');
      }
      if (lines.some((line) => !line.productDescription.trim())) {
        throw new Error('Preencha todos os produtos ou serviços');
      }

      const isAOA = currencyCode === 'AOA';

      return createFactura({
        documentType,
        serieId: serieId || undefined,
        estabelecimentoId,
        customerTaxID,
        customerName,
        customerAddress,
        clienteFaturacaoId,
        currencyCode,
        currencyAmount: isAOA ? undefined : grossTotal,
        exchangeRate: isAOA ? undefined : exchangeRate,
        paymentMethod,
        lines: lines.map((line) => ({
          productCode:
            line.productCode ||
            line.productDescription.substring(0, 10).toUpperCase().replace(/\s/g, '_'),
          productDescription: line.productDescription,
          quantity: line.quantity,
          unitPrice: line.isIncluded ? 0 : line.unitPrice,
          unitOfMeasure: line.unitOfMeasure,
          settlementAmount: line.isIncluded ? 0 : line.quantity * line.unitPrice,
          isIncluded: line.isIncluded || false,
          taxes: [
            {
              taxType: 'IVA',
              taxCode: line.isIncluded || line.taxPercentage === 0 ? 'ISE' : line.taxPercentage === 5 ? 'RED' : 'NOR',
              taxPercentage: line.isIncluded ? 0 : line.taxPercentage,
            },
          ],
        })),
      });
    },
    onSuccess: (factura) => {
      queryClient.invalidateQueries({ queryKey: ['facturas'] });
      queryClient.invalidateQueries({ queryKey: ['faturacao-dashboard'] });
      toast({
        variant: 'success',
        title: 'Fatura emitida',
        description: 'O documento foi criado com sucesso.',
      });
      router.push(`/faturacao/${factura.id}`);
    },
    onError: (err: Error) => {
      setError(err.message);
      toast({
        variant: 'error',
        title: 'Não foi possível emitir a fatura',
        description: err.message,
      });
    },
  });

  const createSerieMutation = useMutation({
    mutationFn: () =>
      createSerie({
        estabelecimentoId: seriesForm.estabelecimentoId,
        seriesCode: seriesForm.seriesCode.trim(),
        seriesYear: Number(seriesForm.seriesYear),
        documentType: seriesForm.documentType,
        firstDocumentNumber: Number(seriesForm.firstDocumentNumber || '1'),
      }),
    onSuccess: async (serie) => {
      await queryClient.invalidateQueries({ queryKey: ['series'] });
      setSerieId(serie.id);
      if (!estabelecimentoId) {
        setEstabelecimentoId(seriesForm.estabelecimentoId);
      }
      setSeriesModalOpen(false);
      setSeriesError('');
      toast({
        variant: 'success',
        title: 'Série criada',
        description: 'A nova série ficou disponível e já foi selecionada na fatura.',
      });
    },
    onError: (err: Error) => {
      setSeriesError(err.message);
      toast({
        variant: 'error',
        title: 'Não foi possível criar a série',
        description: err.message,
      });
    },
  });

  const netTotal = lines.reduce((sum, line) => sum + (line.isIncluded ? 0 : line.quantity * line.unitPrice), 0);
  const taxPayable = lines.reduce(
    (sum, line) => sum + (line.isIncluded ? 0 : line.quantity * line.unitPrice * (line.taxPercentage / 100)),
    0
  );
  const grossTotal = netTotal + taxPayable;

  const activeSeries = series.filter(
    (serie) =>
      serie.seriesStatus !== 'F' &&
      serie.documentType === documentType &&
      (!estabelecimentoId || serie.estabelecimento?.id === estabelecimentoId)
  );
  const selectedSerie = activeSeries.find((serie) => serie.id === serieId) || series.find((serie) => serie.id === serieId) || null;

  useEffect(() => {
    if (!estabelecimentoId) {
      if (serieId) {
        setSerieId('');
      }
      return;
    }

    const defaultSerieForEstabelecimento = selectedEstabelecimento?.defaultSerieId
      ? series.find(
          (serie) =>
            serie.id === selectedEstabelecimento.defaultSerieId &&
            serie.documentType === documentType &&
            serie.seriesStatus !== 'F'
        )
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
  }, [activeSeries, documentType, estabelecimentoId, selectedEstabelecimento?.defaultSerieId, serieId, series]);

  useEffect(() => {
    if (!showSeriesOverride) {
      return;
    }

    const currentSeriesStillValid = activeSeries.some((serie) => serie.id === serieId);
    if (!currentSeriesStillValid && selectedEstabelecimento?.defaultSerieId) {
      setShowSeriesOverride(false);
    }
  }, [activeSeries, selectedEstabelecimento?.defaultSerieId, serieId, showSeriesOverride]);

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      { productCode: '', productDescription: '', quantity: 1, unitPrice: 0, unitOfMeasure: 'UN', taxPercentage: 14, isIncluded: false },
    ]);
  };

  const removeLine = (index: number) => {
    setLines((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
  };

  const updateLine = (index: number, field: keyof LineState, value: string | number | boolean) => {
    setLines((prev) =>
      prev.map((line, currentIndex) => (currentIndex === index ? { ...line, [field]: value } : line))
    );
  };

  const toggleIncluded = (index: number) => {
    setLines((prev) =>
      prev.map((line, currentIndex) =>
        currentIndex === index
          ? {
              ...line,
              isIncluded: !line.isIncluded,
              unitPrice: !line.isIncluded ? 0 : line.unitPrice,
            }
          : line
      )
    );
  };

  async function handleDialogSave() {
    if (!dialog || !dialog.productDescription.trim()) {
      return;
    }

    setDialogSaving(true);
    setDialogError('');
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
          productCode:
            dialog.productCode ||
            dialog.productDescription.substring(0, 10).toUpperCase().replace(/\s/g, '_'),
          productDescription: dialog.productDescription,
          unitPrice: dialog.unitPrice,
          unitOfMeasure: dialog.unitOfMeasure,
          taxPercentage: dialog.taxPercentage,
        });
      }

      queryClient.invalidateQueries({ queryKey: ['produtos'] });

      setLines((prev) =>
        prev.map((line, index) =>
          index === dialog.lineIndex
            ? {
                ...line,
                productId: produto.id,
                productCode: produto.productCode,
                productDescription: produto.productDescription,
                unitPrice: produto.unitPrice,
                unitOfMeasure: produto.unitOfMeasure,
                taxPercentage: produto.taxPercentage,
              }
            : line
        )
      );

      setDialog(null);
      toast({
        variant: 'success',
        title: dialog.mode === 'edit' ? 'Produto atualizado' : 'Produto criado',
        description: 'A linha da fatura foi atualizada com os dados guardados.',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao guardar produto';
      setDialogError(message);
      toast({
        variant: 'error',
        title: 'Não foi possível guardar o produto',
        description: message,
      });
    } finally {
      setDialogSaving(false);
    }
  }

  function openCreateDialog(lineIndex: number, description: string) {
    setDialogError('');
    setDialog(emptyDialog(lineIndex, description));
  }

  function openEditDialog(lineIndex: number) {
    setDialogError('');
    const line = lines[lineIndex];
    setDialog({
      open: true,
      lineIndex,
      mode: 'edit',
      productId: line.productId,
      productCode: line.productCode,
      productDescription: line.productDescription,
      unitPrice: line.unitPrice,
      unitOfMeasure: line.unitOfMeasure,
      taxPercentage: line.taxPercentage,
    });
  }

  function handleCustomerSelect(customer: CustomerLookupItem) {
    setCustomerMode('search');
    setSelectedCustomerMeta({
      source: customer.source,
      id: customer.source === 'faturacao' ? customer.id : undefined,
      contactId: customer.contactId,
    });
    setCustomerFields({
      taxId: customer.customerTaxID || '',
      name: customer.customerName || '',
      address: customer.customerAddress || '',
      phone: customer.customerPhone || '',
      email: customer.customerEmail || '',
    });
    setCustomerWarning(
      customer.source === 'crm'
        ? 'Verifique os dados antes de emitir a fatura. Os dados vieram do CRM e podem precisar de ajuste fiscal.'
        : ''
    );
  }

  function handleOpenSeriesModal() {
    setSeriesError('');
    setSeriesForm({
      estabelecimentoId: estabelecimentoId || estabs[0]?.id || '',
      seriesCode: '',
      seriesYear: String(new Date().getFullYear()),
      documentType,
      firstDocumentNumber: '1',
    });
    setSeriesModalOpen(true);
  }

  const customerSourceLabel =
    selectedCustomerMeta?.source === 'crm'
      ? 'CRM'
      : selectedCustomerMeta?.source === 'faturacao'
      ? 'Faturação'
      : 'Manual';

  const shouldShowCustomerFields = customerMode === 'manual' || !!selectedCustomerMeta;

  return (
    <div className="max-w-4xl space-y-6">
      {error && (
        <ErrorState
          compact
          title="Não foi possível preparar a emissão"
          message={error}
          onRetry={() => {
            setError('');
            mutation.mutate();
          }}
          secondaryAction={{ label: 'Voltar', onClick: () => setError('') }}
        />
      )}

      {documentType === 'PF' && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold">Fatura Proforma — Documento sem validade fiscal</p>
            <p className="mt-0.5 text-xs text-amber-700">
              Este documento é uma proposta comercial. Não é submetido à AGT e não substitui uma fatura.
            </p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base text-[#0A2540]">Documento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {seriesQuery.isError || estabsQuery.isError ? (
            <ErrorState
              compact
              title="Não foi possível carregar a configuração da fatura"
              message="As séries ou os estabelecimentos não responderam como esperado."
              onRetry={() => {
                seriesQuery.refetch();
                estabsQuery.refetch();
              }}
              secondaryAction={{ label: 'Voltar', onClick: () => router.back() }}
            />
          ) : seriesQuery.isLoading || estabsQuery.isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="space-y-2">
                  <div className="h-3 w-24 animate-pulse rounded-full bg-slate-200" />
                  <div className="h-10 animate-pulse rounded-xl bg-slate-100" />
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-xs text-gray-600">Tipo de Documento</Label>
                  <Select
                    value={documentType}
                    onValueChange={(value) => {
                      setDocumentType(value);
                      setSerieId('');
                    }}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs text-gray-600">Ponto de Venda</Label>
                  <Select value={estabelecimentoId} onValueChange={setEstabelecimentoId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecionar ponto de venda..." />
                    </SelectTrigger>
                    <SelectContent>
                      {estabs.map((estabelecimento) => (
                        <SelectItem key={estabelecimento.id} value={estabelecimento.id}>
                          {estabelecimento.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-slate-400">
                    Cada ponto de venda pode ter a sua própria série padrão.
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-3">
                    <Label className="text-xs text-gray-600">Série</Label>
                    <div className="flex items-center gap-2">
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
                      <button
                        type="button"
                        onClick={handleOpenSeriesModal}
                        className="text-xs font-medium text-[#0A2540] underline underline-offset-4"
                      >
                        Criar série
                      </button>
                    </div>
                  </div>

                  {showSeriesOverride ? (
                    <>
                      <Select value={serieId} onValueChange={setSerieId}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Selecionar série..." />
                        </SelectTrigger>
                        <SelectContent>
                          {activeSeries.length === 0 && (
                            <SelectItem value="none" disabled>
                              Sem séries ativas para este tipo
                            </SelectItem>
                          )}
                          {activeSeries.map((serie) => (
                            <SelectItem key={serie.id} value={serie.id}>
                              {serie.seriesCode} / {serie.seriesYear} · #{(serie.lastDocumentNumber ?? 0) + 1}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="mt-1 text-xs text-slate-400">
                        Só precisas escolher manualmente a série quando quiseres sair da configuração padrão do ponto de venda.
                      </p>
                    </>
                  ) : (
                    <div className="mt-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                      <p className="text-sm font-semibold text-[#0A2540]">
                        {selectedSerie
                          ? `${selectedSerie.seriesCode} / ${selectedSerie.seriesYear}`
                          : estabelecimentoId
                          ? 'Sem série padrão disponível'
                          : 'Seleciona primeiro o ponto de venda'}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {selectedSerie
                          ? 'Esta série foi escolhida automaticamente a partir do ponto de venda selecionado.'
                          : estabelecimentoId
                          ? 'Este ponto de venda ainda não tem uma série padrão ativa para este tipo de documento.'
                          : 'A série aparece automaticamente depois de escolheres o ponto de venda.'}
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <Label className="text-xs text-gray-600">Moeda</Label>
                  <Select
                    value={currencyCode}
                    onValueChange={(value) => {
                      setCurrencyCode(value);
                      setExchangeRate(1);
                    }}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((currency) => (
                        <SelectItem key={currency.value} value={currency.value}>
                          {currency.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {currencyCode !== 'AOA' && (
                <div>
                  <Label className="text-xs text-gray-600">
                    Taxa de câmbio (1 {currencyCode} = ? AOA)
                  </Label>
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={exchangeRate}
                    onChange={(event) => setExchangeRate(parseFloat(event.target.value) || 1)}
                    className="mt-1 w-full sm:w-52"
                  />
                </div>
              )}

              <div>
                <Label className="text-xs text-gray-600">Método de Pagamento</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((method) => (
                      <SelectItem key={method} value={method}>
                        {method}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base text-[#0A2540]">Cliente</CardTitle>
          <button
            type="button"
            onClick={() => {
              setCustomerMode((prev) => (prev === 'manual' ? 'search' : 'manual'));
              if (customerMode !== 'manual') {
                setSelectedCustomerMeta(null);
                setCustomerFields(blankCustomerFields);
                setCustomerWarning('');
              }
            }}
            className="text-xs font-medium text-[#0A2540] underline underline-offset-4"
          >
            {customerMode === 'manual' ? 'Pesquisar cliente existente' : 'Introduzir manualmente'}
          </button>
        </CardHeader>
        <CardContent className="space-y-4">
          {customerMode === 'manual' ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-sm font-medium text-[#0A2540]">Novo cliente</p>
              <p className="mt-1 text-xs text-slate-500">
                Estes dados serão usados na emissão e o cliente será criado automaticamente na faturação.
              </p>
            </div>
          ) : (
            <AsyncSearchPicker
              label="Cliente (CRM + Faturação)"
              placeholder="Pesquisar por nome, telefone, NIF ou empresa..."
              helperText="Pesquisa unificada entre contactos CRM e clientes já registados na faturação."
              searchFn={searchCustomers}
              getItemKey={(customer) => `${customer.source}-${customer.id}`}
              getSelectedLabel={(customer) => customer.customerName}
              onSelect={handleCustomerSelect}
              footerAction={{
                label: '+ Criar novo cliente',
                onClick: () => {
                  setCustomerMode('manual');
                  setSelectedCustomerMeta(null);
                  setCustomerFields(blankCustomerFields);
                  setCustomerWarning('');
                },
              }}
              emptyState={{
                title: 'Nenhum cliente encontrado',
                message: 'Tenta outro nome, empresa, telefone ou NIF.',
              }}
              renderItem={(customer) => (
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[#0A2540]">{customer.customerName}</p>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${SOURCE_BADGE_STYLES[customer.source]}`}>
                      {customer.label}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    NIF: {customer.customerTaxID}
                    {customer.customerPhone ? ` · ${customer.customerPhone}` : ''}
                    {customer.company ? ` · ${customer.company}` : ''}
                  </p>
                </div>
              )}
            />
          )}

          {selectedCustomerMeta && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-[#0A2540]">{customerFields.name || 'Cliente selecionado'}</p>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${selectedCustomerMeta.source === 'crm' ? SOURCE_BADGE_STYLES.crm : SOURCE_BADGE_STYLES.faturacao}`}>
                  {customerSourceLabel}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Podes ajustar os dados abaixo antes de emitir o documento.
              </p>
            </div>
          )}

          {customerWarning && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {customerWarning}
            </div>
          )}

          {shouldShowCustomerFields && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs text-gray-600">NIF *</Label>
                <Input
                  value={customerFields.taxId}
                  onChange={(event) =>
                    setCustomerFields((prev) => ({ ...prev, taxId: event.target.value }))
                  }
                  placeholder="5000123456"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-600">Nome *</Label>
                <Input
                  value={customerFields.name}
                  onChange={(event) =>
                    setCustomerFields((prev) => ({ ...prev, name: event.target.value }))
                  }
                  placeholder="Nome da empresa ou cliente"
                  className="mt-1"
                />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs text-gray-600">Morada</Label>
                <Input
                  value={customerFields.address}
                  onChange={(event) =>
                    setCustomerFields((prev) => ({ ...prev, address: event.target.value }))
                  }
                  placeholder="Endereço completo"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-600">Telefone</Label>
                <Input
                  value={customerFields.phone}
                  onChange={(event) =>
                    setCustomerFields((prev) => ({ ...prev, phone: event.target.value }))
                  }
                  placeholder="923 000 000"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-600">Email</Label>
                <Input
                  value={customerFields.email}
                  onChange={(event) =>
                    setCustomerFields((prev) => ({ ...prev, email: event.target.value }))
                  }
                  placeholder="cliente@empresa.ao"
                  className="mt-1"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base text-[#0A2540]">Artigos / Serviços</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={addLine} className="border-gray-200 text-gray-700 hover:bg-gray-50">
            <Plus className="mr-1 h-3 w-3" /> Adicionar linha
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {lines.map((line, index) => (
            <div
              key={index}
              className={`grid grid-cols-12 items-end gap-2 rounded-lg border p-3 ${
                line.isIncluded ? 'border-emerald-100 bg-emerald-50' : 'border-gray-100 bg-gray-50'
              }`}
            >
              <div className="col-span-12 lg:col-span-4">
                <div className="mb-1 flex items-center justify-between">
                  <Label className="text-xs text-gray-600">Produto / Serviço</Label>
                  {documentType === 'PF' && (
                    <button
                      type="button"
                      onClick={() => toggleIncluded(index)}
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                        line.isIncluded
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : 'border-gray-300 bg-white text-gray-500 hover:border-emerald-400 hover:text-emerald-600'
                      }`}
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
                    onCreateNew={(description) => openCreateDialog(index, description)}
                    onEditCurrent={() => openEditDialog(index)}
                    onChange={(product) => {
                      setLines((prev) =>
                        prev.map((currentLine, currentIndex) =>
                          currentIndex === index
                            ? {
                                ...currentLine,
                                productId: product.id,
                                productCode: product.productCode,
                                productDescription: product.productDescription,
                                unitPrice: currentLine.isIncluded ? 0 : product.unitPrice,
                                taxPercentage: product.taxPercentage,
                                unitOfMeasure: product.unitOfMeasure,
                              }
                            : currentLine
                        )
                      );
                    }}
                  />
                  {!line.productId && (
                    <Input
                      value={line.productDescription}
                      placeholder="Ou digitar descrição diretamente..."
                      className="mt-1 text-sm"
                      onChange={(event) => updateLine(index, 'productDescription', event.target.value)}
                    />
                  )}
                </div>
              </div>

              <div className="col-span-4 lg:col-span-2">
                <Label className="text-xs text-gray-600">Qtd.</Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={line.quantity}
                  onChange={(event) => updateLine(index, 'quantity', parseFloat(event.target.value) || 1)}
                  className="mt-1 text-sm"
                />
              </div>

              <div className="col-span-4 lg:col-span-2">
                <Label className="text-xs text-gray-600">Preço Unit.</Label>
                {line.isIncluded ? (
                  <div className="mt-1 flex h-9 items-center rounded-md border border-emerald-200 bg-emerald-100 px-3">
                    <span className="text-xs font-semibold text-emerald-700">Incluído</span>
                  </div>
                ) : (
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.unitPrice}
                    onChange={(event) => updateLine(index, 'unitPrice', parseFloat(event.target.value) || 0)}
                    className="mt-1 text-sm"
                  />
                )}
              </div>

              <div className="col-span-4 lg:col-span-1">
                <Label className="text-xs text-gray-600">IVA%</Label>
                {line.isIncluded ? (
                  <div className="mt-1 flex h-9 items-center rounded-md border border-emerald-200 bg-emerald-100 px-3">
                    <span className="text-xs text-emerald-700">—</span>
                  </div>
                ) : (
                  <Select
                    value={String(line.taxPercentage)}
                    onValueChange={(value) => updateLine(index, 'taxPercentage', Number(value))}
                  >
                    <SelectTrigger className="mt-1 h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="14">14% (NOR)</SelectItem>
                      <SelectItem value="5">5% (RED)</SelectItem>
                      <SelectItem value="0">0% (ISE)</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="col-span-10 lg:col-span-2">
                <Label className="text-xs text-gray-600">Total (s/IVA)</Label>
                <div className={`mt-1 flex h-9 items-center rounded-md border px-3 ${line.isIncluded ? 'border-emerald-200 bg-emerald-100' : 'border-gray-200 bg-gray-50'}`}>
                  {line.isIncluded ? (
                    <span className="text-xs font-semibold text-emerald-700">Incluído</span>
                  ) : (
                    <span className="font-mono text-sm text-[#0A2540]">
                      {(line.quantity * line.unitPrice).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  )}
                </div>
              </div>

              <div className="col-span-2 flex justify-center lg:col-span-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeLine(index)}
                  disabled={lines.length === 1}
                  className="mt-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 pt-4">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Total sem IVA</span>
            <span className="font-mono text-[#0A2540]">{fmtAmount(netTotal, currencyCode)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>IVA</span>
            <span className="font-mono text-[#0A2540]">{fmtAmount(taxPayable, currencyCode)}</span>
          </div>
          <div className="flex justify-between border-t border-gray-200 pt-2 text-lg font-bold">
            <span className="text-[#0A2540]">Total com IVA</span>
            <span className="font-mono text-violet-700">{fmtAmount(grossTotal, currencyCode)}</span>
          </div>
          {currencyCode !== 'AOA' && exchangeRate > 0 && (
            <div className="flex justify-between border-t border-gray-100 pt-2 text-sm text-gray-500">
              <span>Equivalente AOA (taxa {exchangeRate})</span>
              <span className="font-mono">
                {(grossTotal * exchangeRate).toLocaleString('pt-AO', { minimumFractionDigits: 2 })} Kz
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <LoadingButton
          onClick={() => {
            setError('');
            mutation.mutate();
          }}
          loading={mutation.isPending}
          loadingLabel="A emitir..."
          className="flex-1 bg-[#0A2540] font-semibold text-white hover:bg-[#0A2540]/90"
        >
          Emitir Factura
        </LoadingButton>
        <Button variant="outline" onClick={() => router.back()} className="border-gray-200 text-gray-700 hover:bg-gray-50">
          Cancelar
        </Button>
      </div>

      {dialog && (
        <Dialog open={dialog.open} onOpenChange={(open) => !open && setDialog(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{dialog.mode === 'edit' ? 'Editar Produto' : 'Criar Produto'}</DialogTitle>
            </DialogHeader>

            <div className="space-y-3 py-2">
              {dialogError && (
                <ErrorState
                  compact
                  title="Não foi possível guardar o produto"
                  message={dialogError}
                  onRetry={handleDialogSave}
                  secondaryAction={{ label: 'Fechar', onClick: () => setDialogError('') }}
                />
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-600">Código (opcional)</Label>
                  <Input
                    value={dialog.productCode}
                    onChange={(event) =>
                      setDialog((prev) => (prev ? { ...prev, productCode: event.target.value } : prev))
                    }
                    placeholder="Auto-gerado"
                    className="mt-1 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Unidade</Label>
                  <Select
                    value={dialog.unitOfMeasure}
                    onValueChange={(value) =>
                      setDialog((prev) => (prev ? { ...prev, unitOfMeasure: value } : prev))
                    }
                  >
                    <SelectTrigger className="mt-1 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNITS.map((unit) => (
                        <SelectItem key={unit} value={unit}>
                          {unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-xs text-gray-600">Descrição *</Label>
                <Input
                  value={dialog.productDescription}
                  onChange={(event) =>
                    setDialog((prev) =>
                      prev ? { ...prev, productDescription: event.target.value } : prev
                    )
                  }
                  placeholder="Nome do produto ou serviço"
                  className="mt-1 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-600">Preço Unitário *</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={dialog.unitPrice}
                    onChange={(event) =>
                      setDialog((prev) =>
                        prev ? { ...prev, unitPrice: parseFloat(event.target.value) || 0 } : prev
                      )
                    }
                    className="mt-1 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-600">IVA</Label>
                  <Select
                    value={String(dialog.taxPercentage)}
                    onValueChange={(value) =>
                      setDialog((prev) => (prev ? { ...prev, taxPercentage: Number(value) } : prev))
                    }
                  >
                    <SelectTrigger className="mt-1 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="14">14% (NOR)</SelectItem>
                      <SelectItem value="5">5% (RED)</SelectItem>
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
              <LoadingButton
                onClick={handleDialogSave}
                loading={dialogSaving}
                loadingLabel="A guardar..."
                disabled={!dialog.productDescription.trim()}
                className="bg-[#0A2540] text-white hover:bg-[#0A2540]/90"
              >
                {dialog.mode === 'edit' ? 'Actualizar' : 'Criar e Adicionar'}
              </LoadingButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={seriesModalOpen} onOpenChange={(open) => !open && setSeriesModalOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Criar Série</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {seriesError && (
              <ErrorState
                compact
                title="Não foi possível criar a série"
                message={seriesError}
                onRetry={() => createSerieMutation.mutate()}
                secondaryAction={{ label: 'Fechar', onClick: () => setSeriesError('') }}
              />
            )}

            <div>
              <Label className="text-xs text-gray-600">Ponto de Venda *</Label>
              <Select
                value={seriesForm.estabelecimentoId}
                onValueChange={(value) =>
                  setSeriesForm((prev) => ({ ...prev, estabelecimentoId: value }))
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  {estabs.map((estabelecimento) => (
                    <SelectItem key={estabelecimento.id} value={estabelecimento.id}>
                      {estabelecimento.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-600">Código da Série *</Label>
                <Input
                  value={seriesForm.seriesCode}
                  onChange={(event) =>
                    setSeriesForm((prev) => ({ ...prev, seriesCode: event.target.value.toUpperCase() }))
                  }
                  placeholder="2026A"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-600">Ano *</Label>
                <Input
                  type="number"
                  value={seriesForm.seriesYear}
                  onChange={(event) =>
                    setSeriesForm((prev) => ({ ...prev, seriesYear: event.target.value }))
                  }
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-600">Tipo de Documento *</Label>
                <Select
                  value={seriesForm.documentType}
                  onValueChange={(value) =>
                    setSeriesForm((prev) => ({ ...prev, documentType: value }))
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-gray-600">Primeiro Número *</Label>
                <Input
                  type="number"
                  min="1"
                  value={seriesForm.firstDocumentNumber}
                  onChange={(event) =>
                    setSeriesForm((prev) => ({
                      ...prev,
                      firstDocumentNumber: event.target.value,
                    }))
                  }
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSeriesModalOpen(false)}>
              Cancelar
            </Button>
            <LoadingButton
              onClick={() => {
                setSeriesError('');
                createSerieMutation.mutate();
              }}
              loading={createSerieMutation.isPending}
              loadingLabel="A criar..."
              disabled={
                !seriesForm.estabelecimentoId ||
                !seriesForm.seriesCode.trim() ||
                !seriesForm.seriesYear.trim()
              }
              className="bg-[#0A2540] text-white hover:bg-[#0A2540]/90"
            >
              Criar Série
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
