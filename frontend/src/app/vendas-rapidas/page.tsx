'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShoppingCart, Search, Plus, Minus, Trash2, X, CheckCircle, Printer,
  AlertCircle, Lock, Unlock, Clock, Store, TrendingUp, Hash, Download, ExternalLink,
  Banknote, CreditCard, Smartphone,
} from 'lucide-react';
import { getProdutos, getQuickSaleDefaults, getEstabelecimentos, emitQuickSale, getCaixaSessaoAtual, abrirCaixaSessao, fecharCaixaSessao, getCurrentUser, downloadFacturaPdf, openFacturaPdfInTab, getFaturacaoConfig, importContactToBillingCustomer } from '@/lib/api';
import type { QuickSaleItem } from '@/lib/api';
import type { Produto, Factura, Estabelecimento, CaixaSessao, FaturacaoConfig } from '@/lib/types';
import { printThermalRecibo } from '@/lib/thermal-print';
import { CommercialCustomerPicker } from '@/components/faturacao/commercial-customer-picker';
import type { CommercialCustomerLookupItem } from '@/lib/commercial-customer-lookup';
import { CommerceButton as Button } from '@/components/ui/button-commerce';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface CartItem extends QuickSaleItem {
  id: string;
}

const DEFAULT_CUSTOMER_TAX_ID = '000000000';
const DEFAULT_CUSTOMER_NAME = 'Consumidor Final';
const MAX_RESULTS = 10;

const PAYMENT_METHODS = [
  { value: 'CASH',       label: 'Numerário',  short: 'Num.',   icon: 'banknote'   },
  { value: 'MULTICAIXA', label: 'Multicaixa', short: 'MC',     icon: 'smartphone' },
  { value: 'TPA',        label: 'TPA',        short: 'TPA',    icon: 'credit'     },
] as const;

type PaymentMethodValue = typeof PAYMENT_METHODS[number]['value'];

function formatKz(value: number) {
  return value.toLocaleString('pt-AO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Kz';
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' });
}

function sortByRelevance(results: Produto[], query: string): Produto[] {
  const q = query.toLowerCase().trim();
  const score = (p: Produto): number => {
    const code = p.productCode.toLowerCase();
    const desc = p.productDescription.toLowerCase();
    const sku = (p.sku ?? '').toLowerCase();
    const barcode = (p.barcode ?? '').toLowerCase();
    if (barcode && barcode === q) return 0;
    if (code === q) return 1;
    if (sku === q) return 2;
    if (desc.startsWith(q)) return 3;
    if (code.startsWith(q)) return 4;
    return 5;
  };
  return [...results].sort((a, b) => score(a) - score(b));
}

function resolveInitialEstabelecimentoId(
  estabs: Estabelecimento[],
  defaultEstabelecimentoId?: string | null
) {
  const configDefault = defaultEstabelecimentoId
    ? estabs.find((e) => e.id === defaultEstabelecimentoId) ?? null
    : null;
  const principalWithSerie = estabs.find((e) => e.isPrincipal && e.defaultSerieId);
  const firstWithSerie = estabs.find((e) => e.defaultSerieId);
  const fallback = estabs[0] ?? null;

  return (
    (configDefault?.defaultSerieId ? configDefault.id : '') ||
    principalWithSerie?.id ||
    firstWithSerie?.id ||
    configDefault?.id ||
    fallback?.id ||
    ''
  );
}

export default function VendasRapidasPage() {
  const qc = useQueryClient();

  // Config / estabelecimentos
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [estabelecimentos, setEstabelecimentos] = useState<Estabelecimento[]>([]);
  const [estabelecimentosError, setEstabelecimentosError] = useState<string | null>(null);
  const [defaultEstabelecimentoId, setDefaultEstabelecimentoId] = useState<string | null>(null);
  const [selectedEstabelecimentoId, setSelectedEstabelecimentoId] = useState('');

  // Cart
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Produto[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerTaxID, setCustomerTaxID] = useState(DEFAULT_CUSTOMER_TAX_ID);
  const [customerName, setCustomerName] = useState(DEFAULT_CUSTOMER_NAME);
  const [selectedCustomer, setSelectedCustomer] = useState<CommercialCustomerLookupItem | null>(null);
  const [customerWarning, setCustomerWarning] = useState<string | null>(null);
  const [showClientePicker, setShowClientePicker] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodValue>('CASH');
  const [emitting, setEmitting] = useState(false);
  const [successFactura, setSuccessFactura] = useState<Factura | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [faturacaoConfig, setFaturacaoConfig] = useState<FaturacaoConfig | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [printBlocked, setPrintBlocked] = useState(false);

  // Abrir caixa modal
  const [showAbrirCaixa, setShowAbrirCaixa] = useState(false);
  const [abrirEstabelecimentoId, setAbrirEstabelecimentoId] = useState('');
  const [abrirBalance, setAbrirBalance] = useState<number | ''>('');
  const [abrirNotes, setAbrirNotes] = useState('');
  const [abrirErr, setAbrirErr] = useState('');

  // Fechar caixa modal
  const [showFecharCaixa, setShowFecharCaixa] = useState(false);
  const [fecharCounted, setFecharCounted] = useState<number | ''>('');
  const [fecharNotes, setFecharNotes] = useState('');
  const [fecharErr, setFecharErr] = useState('');

  const searchRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const vendaSelectionTouchedRef = useRef(false);
  const abrirSelectionTouchedRef = useRef(false);
  const { data: currentUser, isLoading: loadingUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
    retry: false,
  });
  const isRestrictedTeamMember = !!currentUser?.accountOwnerId && currentUser.role !== 'admin' && !currentUser.isSuperAdmin;
  const assignedEstabelecimentoId = isRestrictedTeamMember ? currentUser?.assignedEstabelecimentoId ?? null : null;

  // ── Sessão actual ──────────────────────────────────────────────────────────
  const { data: sessao = null, isLoading: loadingSessao } = useQuery<CaixaSessao | null>({
    queryKey: ['caixa-sessao-atual'],
    queryFn: () => getCaixaSessaoAtual(),
  });

  const sessaoAberta = sessao?.status === 'open';
  const abrirEstabelecimentos = assignedEstabelecimentoId
    ? estabelecimentos.filter((item) => item.id === assignedEstabelecimentoId)
    : isRestrictedTeamMember
    ? []
    : estabelecimentos;
  const assignedEstabelecimento = assignedEstabelecimentoId
    ? estabelecimentos.find((item) => item.id === assignedEstabelecimentoId) ?? null
    : null;
  const membroSemPontoAtribuido = isRestrictedTeamMember && !assignedEstabelecimentoId;
  const membroComPontoAtribuidoIndisponivel = isRestrictedTeamMember && !!assignedEstabelecimentoId && !assignedEstabelecimento;

  // ── Mutations de sessão ────────────────────────────────────────────────────
  const abrirMutation = useMutation({
    mutationFn: () => abrirCaixaSessao({
      estabelecimentoId: abrirEstabelecimentoId,
      openingBalance: Number(abrirBalance) || 0,
      notes: abrirNotes || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['caixa-sessao-atual'] });
      setShowAbrirCaixa(false);
      setAbrirBalance('');
      setAbrirNotes('');
      setAbrirErr('');
    },
    onError: (e: Error) => setAbrirErr(e.message),
  });

  const fecharMutation = useMutation({
    mutationFn: () => fecharCaixaSessao(sessao!.id, {
      closingCountedAmount: fecharCounted !== '' ? Number(fecharCounted) : undefined,
      notes: fecharNotes || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['caixa-sessao-atual'] });
      setShowFecharCaixa(false);
      setFecharCounted('');
      setFecharNotes('');
      setFecharErr('');
    },
    onError: (e: Error) => setFecharErr(e.message),
  });

  const handleSelectedEstabelecimentoChange = useCallback((value: string) => {
    vendaSelectionTouchedRef.current = true;
    setSelectedEstabelecimentoId(value);
  }, []);

  const handleAbrirEstabelecimentoChange = useCallback((value: string) => {
    abrirSelectionTouchedRef.current = true;
    setAbrirEstabelecimentoId(value);
  }, []);

  // ── Config load ────────────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    getEstabelecimentos()
      .then((estabs) => {
        if (!active) return;
        setEstabelecimentos(estabs);
        setEstabelecimentosError(null);
      })
      .catch(() => {
        if (!active) return;
        setEstabelecimentos([]);
        setEstabelecimentosError('Não foi possível carregar os pontos de venda.');
      })
      .finally(() => {
        if (active) setLoadingConfig(false);
      });

    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    getQuickSaleDefaults()
      .then((defaults) => {
        if (!active) return;
        setDefaultEstabelecimentoId(defaults.defaultEstabelecimentoId);
      })
      .catch((err) => {
        if (!active) return;
        setDefaultEstabelecimentoId(null);
        console.warn('Falha ao carregar defaults da venda rápida:', err);
      });

    return () => { active = false; };
  }, []);

  useEffect(() => {
    getFaturacaoConfig().then(setFaturacaoConfig).catch(() => {});
  }, []);

  useEffect(() => {
    const selectedStillValid = estabelecimentos.some((e) => e.id === selectedEstabelecimentoId);
    const abrirStillValid = abrirEstabelecimentos.some((e) => e.id === abrirEstabelecimentoId);
    const defaultForUser = isRestrictedTeamMember ? assignedEstabelecimentoId : defaultEstabelecimentoId;
    const initial = isRestrictedTeamMember && assignedEstabelecimentoId
      ? assignedEstabelecimentoId
      : resolveInitialEstabelecimentoId(estabelecimentos, defaultForUser);
    const abrirInitial = isRestrictedTeamMember && assignedEstabelecimentoId
      ? assignedEstabelecimentoId
      : resolveInitialEstabelecimentoId(abrirEstabelecimentos, assignedEstabelecimentoId);

    if (!sessaoAberta) {
      if ((!selectedStillValid && selectedEstabelecimentoId !== initial) ||
        (!vendaSelectionTouchedRef.current && initial && selectedEstabelecimentoId !== initial)) {
        setSelectedEstabelecimentoId(initial);
      }
    }

    if ((!abrirStillValid && abrirEstabelecimentoId !== abrirInitial) ||
      (!abrirSelectionTouchedRef.current && abrirInitial && abrirEstabelecimentoId !== abrirInitial)) {
      setAbrirEstabelecimentoId(abrirInitial);
    }
  }, [
    abrirEstabelecimentoId,
    abrirEstabelecimentos,
    assignedEstabelecimentoId,
    defaultEstabelecimentoId,
    estabelecimentos,
    isRestrictedTeamMember,
    selectedEstabelecimentoId,
    sessaoAberta,
  ]);

  // Phase 4: lock selectedEstabelecimentoId to the session's estabelecimento when a session is active
  useEffect(() => {
    if (sessaoAberta && sessao?.estabelecimentoId) {
      setSelectedEstabelecimentoId(sessao.estabelecimentoId);
    }
  }, [sessaoAberta, sessao?.estabelecimentoId]);

  useEffect(() => {
    if (!loadingConfig && sessaoAberta) searchRef.current?.focus();
  }, [loadingConfig, sessaoAberta]);

  // ── Product search ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!search.trim()) { setSearchResults([]); setShowDropdown(false); setHighlightedIndex(-1); return; }
    const t = setTimeout(async () => {
      try {
        const raw = await getProdutos({ search: search.trim(), active: true });
        const sorted = sortByRelevance(raw, search.trim()).slice(0, MAX_RESULTS);
        setSearchResults(sorted);
        setShowDropdown(sorted.length > 0);
        setHighlightedIndex(-1);
        itemRefs.current = new Array(sorted.length).fill(null);
      } catch { setSearchResults([]); }
    }, 220);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node)) { setShowDropdown(false); setHighlightedIndex(-1); }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Cart helpers ───────────────────────────────────────────────────────────
  const addProduct = useCallback((produto: Produto) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.productCode === produto.productCode);
      if (existing) return prev.map((i) => i.productCode === produto.productCode ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, {
        id: `${produto.productCode}-${Date.now()}`,
        productCode: produto.productCode, productDescription: produto.productDescription,
        quantity: 1, unitPrice: produto.unitPrice, unitOfMeasure: produto.unitOfMeasure,
        taxCode: produto.taxCode, taxPercentage: produto.taxPercentage,
      }];
    });
    setSearch(''); setShowDropdown(false); searchRef.current?.focus();
  }, []);

  const updateQty = useCallback((id: string, delta: number) => {
    setCart((prev) => prev.map((i) => i.id === id ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i));
  }, []);

  const setQty = useCallback((id: string, val: number) => {
    setCart((prev) => prev.map((i) => i.id === id ? { ...i, quantity: Math.max(1, val || 1) } : i));
  }, []);

  const removeItem = useCallback((id: string) => setCart((prev) => prev.filter((i) => i.id !== id)), []);

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || searchResults.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => { const next = Math.min(prev + 1, searchResults.length - 1); itemRefs.current[next]?.scrollIntoView({ block: 'nearest' }); return next; });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => { const next = Math.max(prev - 1, 0); itemRefs.current[next]?.scrollIntoView({ block: 'nearest' }); return next; });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const idx = highlightedIndex >= 0 ? highlightedIndex : 0;
      if (searchResults[idx]) addProduct(searchResults[idx]);
    } else if (e.key === 'Escape') {
      e.preventDefault(); setShowDropdown(false); setHighlightedIndex(-1); searchRef.current?.focus();
    }
  }, [showDropdown, searchResults, highlightedIndex, addProduct]);

  const setCustomer = (customer: CommercialCustomerLookupItem) => {
    setSelectedCustomer(customer);
    setCustomerTaxID(customer.customerTaxID || '');
    setCustomerName(customer.customerName || DEFAULT_CUSTOMER_NAME);
    setCustomerWarning(
      customer.source === 'crm' && customer.requiresContactFix
        ? 'Este contacto empresa ainda não tem NIF no CRM. Atualize o contacto antes de usar a venda rápida.'
        : customer.source === 'crm'
        ? 'Cliente selecionado a partir do CRM. A venda será ligada automaticamente ao contacto na faturação.'
        : null
    );
    setShowClientePicker(false);
  };
  const resetCustomer = () => {
    setSelectedCustomer(null);
    setCustomerWarning(null);
    setCustomerTaxID(DEFAULT_CUSTOMER_TAX_ID);
    setCustomerName(DEFAULT_CUSTOMER_NAME);
  };

  // ── Totals ─────────────────────────────────────────────────────────────────
  const subtotal = cart.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const totalIva = cart.reduce((s, i) => s + i.quantity * i.unitPrice * ((i.taxPercentage ?? 14) / 100), 0);
  const total = subtotal + totalIva;

  const selectedEstabelecimento = useMemo(
    () => estabelecimentos.find((e) => e.id === selectedEstabelecimentoId) || null,
    [estabelecimentos, selectedEstabelecimentoId]
  );
  const abrirEstabelecimento = useMemo(
    () => estabelecimentos.find((e) => e.id === abrirEstabelecimentoId) || null,
    [abrirEstabelecimentoId, estabelecimentos]
  );
  const hasSelectableEstabelecimento = useMemo(() => abrirEstabelecimentos.some((e) => Boolean(e.defaultSerieId)), [abrirEstabelecimentos]);
  const configReady = Boolean(selectedEstabelecimento?.defaultSerieId);

  // Fechar caixa — cálculo preview
  const expectedClosing = sessao ? sessao.openingBalance + sessao.totalSalesAmount : 0;
  const diferenca = fecharCounted !== '' ? Number(fecharCounted) - expectedClosing : null;

  // ── Emit ───────────────────────────────────────────────────────────────────
  const handleEmit = async () => {
    if (cart.length === 0) return;
    setEmitting(true); setError(null);
    try {
      let clienteFaturacaoId: string | undefined;

      if (selectedCustomer?.source === 'crm' && selectedCustomer.contactId) {
        if (selectedCustomer.requiresContactFix) {
          throw new Error('Este contacto empresa ainda não tem NIF no CRM. Atualize o contacto antes de emitir a venda.');
        }

        const importedCustomer = await importContactToBillingCustomer({
          contactId: selectedCustomer.contactId,
        });
        clienteFaturacaoId = importedCustomer.id;
      } else if (selectedCustomer?.source === 'faturacao') {
        clienteFaturacaoId = selectedCustomer.id;
      }

      const factura = await emitQuickSale({
        items: cart.map(({ id: _id, ...item }) => item),
        estabelecimentoId: selectedEstabelecimentoId,
        customerTaxID,
        customerName,
        clienteFaturacaoId,
        paymentMethod,
      });
      setSuccessFactura(factura);
      setCart([]);
      resetCustomer();
      qc.invalidateQueries({ queryKey: ['caixa-sessao-atual'] });
    } catch (err: any) {
      setError(err.message || 'Erro ao emitir fatura.');
    } finally {
      setEmitting(false);
    }
  };

  // ── Handlers de saída pós-venda ───────────────────────────────────────────
  const handlePrintRecibo = () => {
    if (!successFactura || !faturacaoConfig) return;
    const ok = printThermalRecibo(successFactura, faturacaoConfig);
    if (!ok) setPrintBlocked(true);
  };

  const handleAbrirPdf = async () => {
    if (!successFactura) return;
    setPdfLoading(true);
    try { await openFacturaPdfInTab(successFactura.id); }
    catch { /* silent — o utilizador verá o popup de erro do browser */ }
    finally { setPdfLoading(false); }
  };

  const handleDescarregarPdf = async () => {
    if (!successFactura) return;
    setPdfLoading(true);
    try { await downloadFacturaPdf(successFactura.id); }
    catch { /* silent */ }
    finally { setPdfLoading(false); }
  };

  const handleNovaVenda = () => {
    setSuccessFactura(null);
    setPrintBlocked(false);
    setPdfLoading(false);
    setPaymentMethod('CASH');
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loadingConfig || loadingSessao || loadingUser) {
    return <div className="min-h-screen bg-[#f5f7f9]" />;
  }

  // ── GATE: sem caixa aberto ─────────────────────────────────────────────────
  if (!sessaoAberta) {
    return (
      <div className="mx-auto max-w-5xl p-4 md:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100">
            <ShoppingCart className="h-5 w-5 text-[var(--workspace-primary)]" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[#2c2f31]">Venda Rápida</h1>
            <p className="text-sm text-[#6b7e9a]">Abra o caixa para começar a vender.</p>
          </div>
        </div>

        {/* Gate card */}
        <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white px-8 py-16 text-center shadow-sm space-y-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
            <Lock className="h-8 w-8 text-slate-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#2c2f31]">Caixa fechado</h2>
            <p className="mt-1 text-sm text-slate-500 max-w-sm">
              Precisa de abrir o caixa para começar a vender. Defina o saldo inicial e use o ponto de venda autorizado para este utilizador.
            </p>
          </div>
          <Button onClick={() => { setAbrirErr(''); setShowAbrirCaixa(true); }} className="gap-2 px-6" size="lg">
            <Unlock className="h-4 w-4" />
            Abrir caixa
          </Button>
        </div>

        {/* Modal: Abrir Caixa */}
        <Dialog open={showAbrirCaixa} onOpenChange={(o) => { if (!o) setShowAbrirCaixa(false); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Unlock className="w-4 h-4 text-green-600" /> Abrir Caixa</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              {abrirErr && <p className="text-red-500 text-sm">{abrirErr}</p>}
              <div>
                <Label className="text-sm">Ponto de Venda *</Label>
                <Select
                  value={abrirEstabelecimentoId}
                  onValueChange={handleAbrirEstabelecimentoChange}
                  disabled={isRestrictedTeamMember || membroSemPontoAtribuido || membroComPontoAtribuidoIndisponivel}
                >
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {abrirEstabelecimentos.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.nome}{!e.defaultSerieId ? ' · sem série' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {estabelecimentosError && (
                  <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {estabelecimentosError}
                  </p>
                )}
                {!estabelecimentosError && membroSemPontoAtribuido && (
                  <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Este membro da equipa ainda não tem um ponto de venda atribuído. O dono da conta precisa de defini-lo em Configurações → Equipa.
                  </p>
                )}
                {!estabelecimentosError && membroComPontoAtribuidoIndisponivel && (
                  <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    O ponto de venda atribuído a este membro já não está disponível nesta conta.
                  </p>
                )}
                {!estabelecimentosError && assignedEstabelecimento && isRestrictedTeamMember && (
                  <p className="mt-2 rounded-lg border border-[var(--workspace-primary-border)] bg-[var(--workspace-primary-soft)] px-3 py-2 text-xs text-[var(--workspace-primary)]">
                    Este membro só pode abrir caixa em {assignedEstabelecimento.nome}.
                  </p>
                )}
                {!estabelecimentosError && abrirEstabelecimentos.length === 0 && !membroSemPontoAtribuido && !membroComPontoAtribuidoIndisponivel && (
                  <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Ainda não existem pontos de venda. Crie o primeiro em{' '}
                    <a href="/configuracoes?tab=empresa&section=faturacao" className="font-medium underline">
                      Configurações → Empresa → Configuração Fiscal
                    </a>.
                  </p>
                )}
                {!estabelecimentosError && abrirEstabelecimentos.length > 0 && !hasSelectableEstabelecimento && (
                  <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Os pontos de venda já existem, mas ainda não têm série padrão. Pode abrir o caixa, porém a emissão só ficará disponível após configurar a série em{' '}
                    <a href="/configuracoes?tab=empresa&section=faturacao" className="font-medium underline">
                      Configuração Fiscal
                    </a>.
                  </p>
                )}
                {!estabelecimentosError && abrirEstabelecimento && !abrirEstabelecimento.defaultSerieId && (
                  <p className="mt-2 text-xs text-amber-700">
                    Este ponto de venda está sem série padrão no momento.
                  </p>
                )}
              </div>
              <div>
                <Label className="text-sm">Saldo inicial (Kz)</Label>
                <Input type="number" min="0" step="0.01" value={abrirBalance} onChange={(e) => setAbrirBalance(e.target.value === '' ? '' : Number(e.target.value))} placeholder="0,00" className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">Observação</Label>
                <Input value={abrirNotes} onChange={(e) => setAbrirNotes(e.target.value)} placeholder="opcional" className="mt-1" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAbrirCaixa(false)}>Cancelar</Button>
              <Button
                onClick={() => abrirMutation.mutate()}
                disabled={abrirMutation.isPending || !abrirEstabelecimentoId || membroSemPontoAtribuido || membroComPontoAtribuidoIndisponivel}
                className="bg-green-600 text-white hover:bg-green-700"
              >
                {abrirMutation.isPending ? 'A abrir...' : 'Abrir caixa'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── MAIN VIEW: caixa aberto ────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100">
            <ShoppingCart className="h-5 w-5 text-[var(--workspace-primary)]" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[#2c2f31]">Venda Rápida</h1>
            <p className="text-sm text-[#6b7e9a]">Adicione produtos, confirme o cliente e emita a fatura.</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-slate-600 border-slate-200 hover:border-red-300 hover:text-red-600 hover:bg-red-50"
          onClick={() => { setFecharErr(''); setFecharCounted(''); setFecharNotes(''); setShowFecharCaixa(true); }}
        >
          <Lock className="h-3.5 w-3.5" />
          Fechar caixa
        </Button>
      </div>

      {/* Banner: sessão aberta */}
      <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span className="flex items-center gap-1.5 font-semibold text-green-700">
            <Unlock className="h-3.5 w-3.5" />
            Caixa aberto
          </span>
          <span className="flex items-center gap-1.5 text-green-800">
            <Store className="h-3.5 w-3.5 text-green-600" />
            {sessao!.estabelecimento?.nome}
          </span>
          <span className="flex items-center gap-1.5 text-green-800">
            <Clock className="h-3.5 w-3.5 text-green-600" />
            Abertura: {formatTime(sessao!.openedAt)}
          </span>
          <span className="flex items-center gap-1.5 text-green-800">
            Saldo inicial: <strong>{formatKz(sessao!.openingBalance)}</strong>
          </span>
          <span className="flex items-center gap-1.5 text-green-800">
            <TrendingUp className="h-3.5 w-3.5 text-green-600" />
            Total vendido: <strong>{formatKz(sessao!.totalSalesAmount)}</strong>
          </span>
          <span className="flex items-center gap-1.5 text-green-800">
            <Hash className="h-3.5 w-3.5 text-green-600" />
            {sessao!.salesCount} venda{sessao!.salesCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Not configured warning */}
      {!configReady && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold">Configuração em falta</p>
            <p className="mt-0.5 text-amber-800/90">
              {!estabelecimentos.length
                ? 'Crie primeiro um ponto de venda em '
                : hasSelectableEstabelecimento
                ? 'O ponto de venda selecionado ainda não tem série padrão. Escolha outro em '
                : 'Os pontos de venda ainda não têm série padrão. Configure em '}
              <a href="/configuracoes?tab=empresa&section=faturacao" className="font-medium underline">
                Configurações → Empresa → Configuração Fiscal
              </a>.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
        {/* Left: search + cart */}
        <div className="space-y-4">
          <div className="relative" ref={dropdownRef}>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm focus-within:ring-2 focus-within:ring-[var(--workspace-primary)]/30">
              <Search className="h-4 w-4 shrink-0 text-[#6b7e9a]" />
              <input
                ref={searchRef} type="text"
                placeholder="Pesquisar produto por nome ou código..."
                className="flex-1 bg-transparent text-sm text-[#2c2f31] outline-none placeholder:text-[#6b7e9a]"
                value={search} onChange={(e) => setSearch(e.target.value)}
                onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                onKeyDown={handleSearchKeyDown}
                disabled={!configReady} autoComplete="off"
              />
              {search && <button onClick={() => { setSearch(''); setShowDropdown(false); }}><X className="h-4 w-4 text-slate-400 hover:text-slate-600" /></button>}
            </div>
            {showDropdown && (
              <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                {searchResults.map((p, idx) => (
                  <button
                    key={p.id} ref={(el) => { itemRefs.current[idx] = el; }}
                    onClick={() => addProduct(p)}
                    className={`flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors ${idx === highlightedIndex ? 'bg-[var(--workspace-primary-soft)] text-[var(--workspace-primary)]' : 'hover:bg-slate-50'}`}
                  >
                    <div>
                      <p className="text-sm font-medium text-[var(--workspace-primary)]">{p.productDescription}</p>
                      <p className="text-xs text-slate-500">{p.productCode} · IVA {p.taxPercentage}%{p.stock != null ? ` · Stock: ${p.stock}` : ''}</p>
                    </div>
                    <span className="ml-4 text-sm font-semibold text-[var(--workspace-primary)]">{formatKz(p.unitPrice)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Cart */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <ShoppingCart className="mb-3 h-10 w-10 text-slate-200" />
                <p className="text-sm font-medium text-slate-500">Carrinho vazio</p>
                <p className="mt-1 text-xs text-slate-400">Pesquise um produto acima para começar.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {cart.map((item) => {
                  const lineTotal = item.quantity * item.unitPrice;
                  return (
                    <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium text-[#2c2f31]">{item.productDescription}</p>
                        <p className="text-xs text-slate-500">{item.productCode} · {formatKz(item.unitPrice)}</p>
                      </div>
                      <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50">
                        <button onClick={() => updateQty(item.id, -1)} className="flex h-7 w-7 items-center justify-center rounded-l-lg text-slate-500 hover:bg-slate-100 transition-colors"><Minus className="h-3 w-3" /></button>
                        <input type="number" min={1} value={item.quantity} onChange={(e) => setQty(item.id, parseInt(e.target.value) || 1)} className="w-10 bg-transparent text-center text-sm font-semibold text-[#2c2f31] outline-none" />
                        <button onClick={() => updateQty(item.id, 1)} className="flex h-7 w-7 items-center justify-center rounded-r-lg text-slate-500 hover:bg-slate-100 transition-colors"><Plus className="h-3 w-3" /></button>
                      </div>
                      <span className="w-24 text-right text-sm font-semibold text-[var(--workspace-primary)]">{formatKz(lineTotal)}</span>
                      <button onClick={() => removeItem(item.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: ponto de venda + cliente + totais */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[#6b7e9a]/60">Ponto de Venda</p>
            {sessaoAberta ? (
              <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5">
                <Store className="h-4 w-4 shrink-0 text-green-600" />
                <span className="flex-1 text-sm font-medium text-[#2c2f31]">{sessao!.estabelecimento?.nome}</span>
                <span className="text-xs text-green-600">sessão activa</span>
              </div>
            ) : (
              <Select value={selectedEstabelecimentoId} onValueChange={handleSelectedEstabelecimentoChange}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Selecionar ponto de venda" /></SelectTrigger>
                <SelectContent>
                  {estabelecimentos.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nome}{!e.defaultSerieId ? ' · sem série padrão' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <p className="mt-2 text-xs text-slate-500">
              {sessaoAberta
                ? 'O ponto de venda é fixo enquanto a sessão de caixa estiver aberta.'
                : 'A venda rápida usa automaticamente a série padrão do ponto de venda selecionado.'}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[#6b7e9a]/60">Cliente</p>
            {!showClientePicker ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#2c2f31]">{customerName}</p>
                    <p className="text-xs text-slate-500">NIF: {customerTaxID || 'em falta'}</p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => setShowClientePicker(true)} className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--workspace-primary)] hover:bg-[var(--workspace-primary-soft)] transition-colors">Alterar</button>
                    {customerTaxID !== DEFAULT_CUSTOMER_TAX_ID && (
                      <button onClick={resetCustomer} className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 transition-colors">Limpar</button>
                    )}
                  </div>
                </div>
                {customerWarning && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    {customerWarning}
                    {selectedCustomer?.source === 'crm' && selectedCustomer.contactId ? (
                      <>
                        {' '}
                        <a href={`/contacts/${selectedCustomer.contactId}`} className="font-medium underline">
                          Abrir contacto
                        </a>
                      </>
                    ) : null}
                  </div>
                )}
                {selectedCustomer?.source === 'crm' && (
                  <p className="text-xs text-slate-500">
                    A venda rápida vai criar ou reutilizar automaticamente o cliente de faturação ligado a este contacto.
                  </p>
                )}
              </div>
            ) : (
              <div>
                <CommercialCustomerPicker
                  onChange={setCustomer}
                  value={customerName !== DEFAULT_CUSTOMER_NAME ? customerName : undefined}
                />
                <button onClick={() => setShowClientePicker(false)} className="mt-2 text-xs text-slate-500 hover:text-slate-700">Cancelar</button>
              </div>
            )}
          </div>

          {selectedCustomer?.source === 'crm' && selectedCustomer.requiresContactFix && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
              Este contacto empresa ainda não tem NIF no CRM. A emissão fica bloqueada até completares o contacto.
              {' '}
              <a href={`/contacts/${selectedCustomer.contactId}`} className="font-medium underline">
                Abrir contacto
              </a>
            </div>
          )}

          {/* Método de pagamento */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[#6b7e9a]/60">Pagamento</p>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_METHODS.map((m) => {
                const active = paymentMethod === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setPaymentMethod(m.value)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border py-3 px-2 text-xs font-semibold transition-colors ${
                      active
                        ? 'border-[var(--workspace-primary)] bg-[var(--workspace-primary-soft)] text-[var(--workspace-primary)]'
                        : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {m.icon === 'banknote'   && <Banknote   className="h-5 w-5" />}
                    {m.icon === 'smartphone' && <Smartphone className="h-5 w-5" />}
                    {m.icon === 'credit'     && <CreditCard className="h-5 w-5" />}
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-2">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#6b7e9a]/60">Resumo</p>
            <div className="flex justify-between text-sm text-slate-600"><span>Subtotal</span><span>{formatKz(subtotal)}</span></div>
            <div className="flex justify-between text-sm text-slate-600"><span>IVA</span><span>{formatKz(totalIva)}</span></div>
            <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-bold text-[#2c2f31]"><span>Total</span><span>{formatKz(total)}</span></div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span>
            </div>
          )}

          <Button
            onClick={handleEmit}
            disabled={!configReady || !selectedEstabelecimentoId || cart.length === 0 || emitting || !!selectedCustomer?.requiresContactFix}
            className="w-full gap-2"
            size="lg"
          >
            {emitting ? 'A emitir...' : 'Emitir Fatura'}
          </Button>
        </div>
      </div>

      {/* Modal de Sucesso Pós-Venda */}
      {successFactura && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex flex-col items-center text-center">
              {/* Ícone + Info */}
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 mb-3">
                <CheckCircle className="h-7 w-7 text-green-600" />
              </div>
              <h2 className="text-lg font-bold text-[#2c2f31]">Venda concluída!</h2>
              <p className="mt-0.5 text-sm text-slate-500">{successFactura.documentNo}</p>
              <p className="text-sm font-semibold text-[#2c2f31]">{formatKz(successFactura.grossTotal)}</p>

              {/* QR Code */}
              {successFactura.qrCodeImage && (
                <img src={successFactura.qrCodeImage} alt="QR Code AGT" className="mt-3 h-28 w-28 rounded-xl border border-slate-100 p-1" />
              )}

              {/* Método de pagamento usado */}
              {successFactura.paymentMethod && (() => {
                const pm = PAYMENT_METHODS.find((m) => m.value === successFactura.paymentMethod);
                return (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                    {pm?.icon === 'banknote'   && <Banknote   className="h-3.5 w-3.5" />}
                    {pm?.icon === 'smartphone' && <Smartphone className="h-3.5 w-3.5" />}
                    {pm?.icon === 'credit'     && <CreditCard className="h-3.5 w-3.5" />}
                    <span>{pm?.label ?? successFactura.paymentMethod}</span>
                  </div>
                );
              })()}

              {/* Aviso popup bloqueado */}
              {printBlocked && (
                <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 text-left w-full">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>Popups bloqueados. Permita popups para este site e tente novamente.</span>
                </div>
              )}

              {/* 3 botões de saída */}
              <div className="mt-4 grid w-full grid-cols-3 gap-2">
                <Button variant="outline" size="sm" className="flex-col gap-1 h-auto py-2.5 text-xs"
                  onClick={handlePrintRecibo} disabled={!faturacaoConfig}>
                  <Printer className="h-4 w-4" />
                  Imprimir Recibo
                </Button>
                <Button variant="outline" size="sm" className="flex-col gap-1 h-auto py-2.5 text-xs"
                  onClick={handleAbrirPdf} disabled={pdfLoading}>
                  <ExternalLink className="h-4 w-4" />
                  Abrir PDF
                </Button>
                <Button variant="outline" size="sm" className="flex-col gap-1 h-auto py-2.5 text-xs"
                  onClick={handleDescarregarPdf} disabled={pdfLoading}>
                  <Download className="h-4 w-4" />
                  Descarregar
                </Button>
              </div>

              {/* CTA principal */}
              <Button className="mt-3 w-full" onClick={handleNovaVenda}>
                Nova Venda
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Fechar Caixa */}
      <Dialog open={showFecharCaixa} onOpenChange={(o) => { if (!o) setShowFecharCaixa(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Lock className="w-4 h-4 text-red-500" /> Fechar Caixa</DialogTitle></DialogHeader>
          {sessao && (
            <div className="space-y-4 py-2">
              {fecharErr && <p className="text-red-500 text-sm">{fecharErr}</p>}

              <div className="rounded-lg bg-gray-50 border border-gray-200 divide-y divide-gray-100 text-sm">
                <div className="flex justify-between px-3 py-2">
                  <span className="text-gray-500">Saldo inicial</span>
                  <span className="font-medium">{formatKz(sessao.openingBalance)}</span>
                </div>
                <div className="flex justify-between px-3 py-2">
                  <span className="text-gray-500">Total vendido</span>
                  <span className="font-medium text-green-700">{formatKz(sessao.totalSalesAmount)}</span>
                </div>
                <div className="flex justify-between px-3 py-2">
                  <span className="text-gray-500">Esperado em caixa</span>
                  <span className="font-semibold">{formatKz(expectedClosing)}</span>
                </div>
              </div>

              <div>
                <Label className="text-sm">Valor contado (Kz)</Label>
                <Input
                  type="number" min="0" step="0.01"
                  value={fecharCounted}
                  onChange={(e) => setFecharCounted(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder={formatKz(expectedClosing)}
                  className="mt-1"
                  autoFocus
                />
                {diferenca !== null && (
                  <p className={`text-xs mt-1 font-medium ${diferenca === 0 ? 'text-green-600' : diferenca > 0 ? 'text-[var(--workspace-primary)]' : 'text-red-500'}`}>
                    Diferença: {diferenca >= 0 ? '+' : ''}{formatKz(diferenca)}
                    {diferenca > 0 ? ' (excesso)' : diferenca < 0 ? ' (em falta)' : ' (conferido)'}
                  </p>
                )}
              </div>

              <div>
                <Label className="text-sm">Observação</Label>
                <Input value={fecharNotes} onChange={(e) => setFecharNotes(e.target.value)} placeholder="opcional" className="mt-1" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFecharCaixa(false)}>Cancelar</Button>
            <Button
              onClick={() => fecharMutation.mutate()}
              disabled={fecharMutation.isPending}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {fecharMutation.isPending ? 'A fechar...' : 'Confirmar fecho'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
