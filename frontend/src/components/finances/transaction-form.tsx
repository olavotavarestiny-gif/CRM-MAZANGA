'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createTransaction, updateTransaction, getFinancialCategories, getContacts } from '@/lib/api';
import { Transaction } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type FormData = {
  type: 'entrada' | 'saida';
  revenueType: 'recorrente' | 'one-off' | '';
  date: string;
  clientId: string;
  clientName: string;
  category: string;
  subcategory: string;
  description: string;
  amountKz: string;
  amountForeign: string; // valor na moeda de origem
  currencyOrigin: 'KZ' | 'CHF' | 'EUR' | 'USD';
  exchangeRate: string;
  paymentMethod: string;
  status: 'pago' | 'pendente' | 'atrasado';
  receiptNumber: string;
  notes: string;
  contractDurationMonths: string;
  nextPaymentDate: string;
};

const defaultForm: FormData = {
  type: 'entrada',
  revenueType: '',
  date: new Date().toISOString().slice(0, 10),
  clientId: '',
  clientName: '',
  category: '',
  subcategory: '',
  description: '',
  amountKz: '',
  amountForeign: '',
  currencyOrigin: 'KZ',
  exchangeRate: '1',
  paymentMethod: '',
  status: 'pago',
  receiptNumber: '',
  notes: '',
  contractDurationMonths: '',
  nextPaymentDate: '',
};

export default function TransactionForm({
  open,
  onClose,
  transaction,
}: {
  open: boolean;
  onClose: () => void;
  transaction?: Transaction;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!transaction;

  const [form, setForm] = useState<FormData>(defaultForm);
  const [error, setError] = useState('');

  const { data: categories = [] } = useQuery({
    queryKey: ['financial-categories'],
    queryFn: getFinancialCategories,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => getContacts(),
  });

  // Auto-calculate amountKz when amountForeign or exchangeRate changes (if moeda ≠ KZ)
  useEffect(() => {
    if (form.currencyOrigin === 'KZ') return;

    const foreign = parseFloat(form.amountForeign);
    const rate = parseFloat(form.exchangeRate);

    if (!isNaN(foreign) && !isNaN(rate) && rate > 0 && form.amountForeign) {
      const calculated = Math.round(foreign * rate);
      setForm((prev) => ({ ...prev, amountKz: String(calculated) }));
    }
  }, [form.amountForeign, form.exchangeRate, form.currencyOrigin]);

  useEffect(() => {
    if (transaction) {
      // Calcular amountForeign a partir de amountKz / exchangeRate (se moeda não for KZ)
      let amountForeign = '';
      if (transaction.currencyOrigin !== 'KZ' && transaction.exchangeRate > 0) {
        const foreign = Math.round((transaction.amountKz / transaction.exchangeRate) * 100) / 100;
        amountForeign = String(foreign);
      }

      setForm({
        type: transaction.type,
        revenueType: transaction.revenueType || '',
        date: transaction.date?.slice(0, 10) || defaultForm.date,
        clientId: transaction.clientId?.toString() || '',
        clientName: transaction.clientName || '',
        category: transaction.category || '',
        subcategory: transaction.subcategory || '',
        description: transaction.description || '',
        amountKz: transaction.amountKz?.toString() || '',
        amountForeign,
        currencyOrigin: transaction.currencyOrigin || 'KZ',
        exchangeRate: transaction.exchangeRate?.toString() || '1',
        paymentMethod: transaction.paymentMethod || '',
        status: transaction.status || 'pago',
        receiptNumber: transaction.receiptNumber || '',
        notes: transaction.notes || '',
        contractDurationMonths: transaction.contractDurationMonths?.toString() || '',
        nextPaymentDate: transaction.nextPaymentDate?.slice(0, 10) || '',
      });
    } else {
      setForm(defaultForm);
    }
    setError('');
  }, [transaction, open]);

  const filteredCategories = categories.filter((c) => c.type === form.type);
  const selectedCategory = filteredCategories.find((c) => c.category === form.category);
  const subcategoryOptions = selectedCategory?.subcategories || [];

  const mutation = useMutation({
    mutationFn: (data: Partial<Transaction>) =>
      isEdit ? updateTransaction(transaction!.id, data) : createTransaction(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['finance-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['profitability'] });
      onClose();
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Erro ao guardar transação.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Se moeda não for KZ, validar amountForeign
    if (form.currencyOrigin !== 'KZ') {
      if (!form.amountForeign || parseFloat(form.amountForeign) <= 0) {
        setError('Valor em moeda estrangeira deve ser maior que 0.');
        return;
      }
      if (!form.exchangeRate || parseFloat(form.exchangeRate) <= 0) {
        setError('Taxa de câmbio deve ser maior que 0.');
        return;
      }
    } else {
      // Se for KZ, validar amountKz
      if (!form.amountKz || parseFloat(form.amountKz) <= 0) {
        setError('Valor deve ser maior que 0.');
        return;
      }
    }
    if (form.type === 'entrada' && form.revenueType === 'recorrente') {
      if (!form.contractDurationMonths || parseInt(form.contractDurationMonths) < 1) {
        setError('Duração do contrato é obrigatória para receitas recorrentes.');
        return;
      }
      if (!form.nextPaymentDate) {
        setError('Próximo pagamento é obrigatório para receitas recorrentes.');
        return;
      }
    }

    const payload: Partial<Transaction> = {
      type: form.type,
      date: form.date,
      clientId: form.clientId ? parseInt(form.clientId) : undefined,
      clientName: form.clientName || undefined,
      category: form.category,
      subcategory: form.subcategory || undefined,
      description: form.description || undefined,
      amountKz: parseFloat(form.amountKz),
      currencyOrigin: form.currencyOrigin,
      exchangeRate: parseFloat(form.exchangeRate) || 1,
      paymentMethod: form.paymentMethod || undefined,
      status: form.status,
      receiptNumber: form.receiptNumber || undefined,
      notes: form.notes || undefined,
      revenueType: form.type === 'entrada' && form.revenueType ? (form.revenueType as any) : undefined,
      contractDurationMonths:
        form.type === 'entrada' && form.revenueType === 'recorrente' && form.contractDurationMonths
          ? parseInt(form.contractDurationMonths)
          : undefined,
      nextPaymentDate:
        form.type === 'entrada' && form.revenueType === 'recorrente' && form.nextPaymentDate
          ? form.nextPaymentDate
          : undefined,
    };

    mutation.mutate(payload);
  };

  const set = (key: keyof FormData, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      // Reset category/subcategory when type changes
      if (key === 'type') {
        next.category = '';
        next.subcategory = '';
        if (value === 'saida') next.revenueType = '';
      }
      // Reset subcategory when category changes
      if (key === 'category') next.subcategory = '';
      // Handle currency change
      if (key === 'currencyOrigin') {
        if (value === 'KZ') {
          // Switching to KZ: keep amountKz, clear amountForeign and reset exchangeRate
          next.amountForeign = '';
          next.exchangeRate = '1';
        } else {
          // Switching to foreign currency: clear both amounts, reset exchangeRate
          next.amountKz = '';
          next.amountForeign = '';
          next.exchangeRate = '1';
        }
      }
      // Auto-fill clientName from contacts
      if (key === 'clientId' && value) {
        const contact = contacts.find((c) => c.id.toString() === value);
        if (contact) next.clientName = contact.name;
      }
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-zinc-900 border-slate-200">
        <DialogHeader>
          <DialogTitle className="text-[#0A2540]">
            {isEdit ? 'Editar Transação' : 'Nova Transação'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-2">
          {/* Tipo */}
          <div>
            <Label className="text-[#0A2540] mb-2 block">Tipo *</Label>
            <div className="flex gap-3">
              {(['entrada', 'saida'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set('type', t)}
                  className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    form.type === t
                      ? t === 'entrada'
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                        : 'bg-red-500/20 border-red-500/50 text-red-300'
                      : 'border-[#dde3ec] text-[#6b7e9a] hover:border-[#0A2540]'
                  }`}
                >
                  {t === 'entrada' ? '↑ Entrada' : '↓ Saída'}
                </button>
              ))}
            </div>
          </div>

          {/* Tipo de Receita (só para entradas) */}
          {form.type === 'entrada' && (
            <div>
              <Label className="text-[#0A2540] mb-2 block">Tipo de Receita</Label>
              <div className="flex gap-3">
                {(['recorrente', 'one-off'] as const).map((rt) => (
                  <button
                    key={rt}
                    type="button"
                    onClick={() => set('revenueType', rt)}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      form.revenueType === rt
                        ? 'bg-purple-500/20 border-purple-500/50 text-blue-500'
                        : 'border-[#dde3ec] text-[#6b7e9a] hover:border-[#0A2540]'
                    }`}
                  >
                    {rt === 'recorrente' ? '🔄 Recorrente' : '⚡ Pontual'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Campos recorrentes */}
          {form.type === 'entrada' && form.revenueType === 'recorrente' && (
            <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-blue-50 border border-blue-200">
              <div>
                <Label className="text-[#0A2540] mb-1 block">Duração (meses) *</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.contractDurationMonths}
                  onChange={(e) => set('contractDurationMonths', e.target.value)}
                  placeholder="ex: 12"
                  className="border-[#dde3ec] text-[#0A2540]"
                  required
                />
              </div>
              <div>
                <Label className="text-[#0A2540] mb-1 block">Próximo Pagamento *</Label>
                <Input
                  type="date"
                  value={form.nextPaymentDate}
                  onChange={(e) => set('nextPaymentDate', e.target.value)}
                  className="border-[#dde3ec] text-[#0A2540]"
                  required
                />
              </div>
            </div>
          )}

          {/* Data e Cliente */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-[#0A2540] mb-1 block">Data *</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => set('date', e.target.value)}
                className="border-[#dde3ec] text-[#0A2540]"
                required
              />
            </div>
            <div>
              <Label className="text-[#0A2540] mb-1 block">Cliente</Label>
              <Select value={form.clientId || 'none'} onValueChange={(v) => set('clientId', v === 'none' ? '' : v)}>
                <SelectTrigger className="border-[#dde3ec] text-[#0A2540]">
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent className="bg-white border-[#E2E8F0]">
                  <SelectItem value="none" className="text-[#6b7e9a]">Sem cliente</SelectItem>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id.toString()} className="text-[#0A2540]">
                      {c.name} — {c.company}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Categoria e Subcategoria */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-[#0A2540] mb-1 block">Categoria *</Label>
              <Select value={form.category} onValueChange={(v) => set('category', v)} required>
                <SelectTrigger className="border-[#dde3ec] text-[#0A2540]">
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent className="bg-white border-[#E2E8F0]">
                  {filteredCategories.map((c) => (
                    <SelectItem key={c.id} value={c.category} className="text-[#0A2540]">
                      {c.icon} {c.category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[#0A2540] mb-1 block">Subcategoria</Label>
              <Select
                value={form.subcategory}
                onValueChange={(v) => set('subcategory', v)}
                disabled={subcategoryOptions.length === 0}
              >
                <SelectTrigger className="border-[#dde3ec] text-[#0A2540] disabled:opacity-50">
                  <SelectValue placeholder="Opcional..." />
                </SelectTrigger>
                <SelectContent className="bg-white border-[#E2E8F0]">
                  {subcategoryOptions.map((s) => (
                    <SelectItem key={s} value={s} className="text-[#0A2540]">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Descrição */}
          <div>
            <Label className="text-[#0A2540] mb-1 block">Descrição</Label>
            <Input
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Breve descrição..."
              className="border-[#dde3ec] text-[#0A2540]"
            />
          </div>

          {/* Valores e Moeda - Layout adaptativo */}
          {form.currencyOrigin === 'KZ' ? (
            // Se moeda é KZ: campo simples de Valor
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <Label className="text-[#0A2540] mb-1 block">Valor (Kz) *</Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.amountKz}
                  onChange={(e) => set('amountKz', e.target.value)}
                  placeholder="ex: 587000"
                  className="border-[#dde3ec] text-[#0A2540]"
                  required
                />
              </div>
              <div>
                <Label className="text-[#0A2540] mb-1 block">Moeda</Label>
                <Select value={form.currencyOrigin} onValueChange={(v) => set('currencyOrigin', v)}>
                  <SelectTrigger className="border-[#dde3ec] text-[#0A2540]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-[#E2E8F0]">
                    {['KZ', 'USD', 'EUR', 'CHF'].map((c) => (
                      <SelectItem key={c} value={c} className="text-[#0A2540]">{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            // Se moeda é estrangeira: três campos em linha + campo calculado
            <>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-[#0A2540] mb-1 block">Valor ({form.currencyOrigin}) *</Label>
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.amountForeign}
                    onChange={(e) => set('amountForeign', e.target.value)}
                    placeholder="ex: 1"
                    className="border-[#dde3ec] text-[#0A2540]"
                    required
                  />
                </div>
                <div>
                  <Label className="text-[#0A2540] mb-1 block">Taxa (1 {form.currencyOrigin} = ? Kz)</Label>
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.exchangeRate}
                    onChange={(e) => set('exchangeRate', e.target.value)}
                    className="border-[#dde3ec] text-[#0A2540]"
                    required
                  />
                </div>
                <div>
                  <Label className="text-[#0A2540] mb-1 block">Moeda</Label>
                  <Select value={form.currencyOrigin} onValueChange={(v) => set('currencyOrigin', v)}>
                    <SelectTrigger className="border-[#dde3ec] text-[#0A2540]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-[#E2E8F0]">
                      {['KZ', 'USD', 'EUR', 'CHF'].map((c) => (
                        <SelectItem key={c} value={c} className="text-[#0A2540]">{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Campo de valor calculado em Kz */}
              <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                <div className="flex items-center justify-between">
                  <Label className="text-[#0A2540]">Valor em Kz (calculado)</Label>
                  <span className="text-xs px-2 py-1 bg-emerald-500/30 text-emerald-300 rounded-full">auto</span>
                </div>
                <div className="mt-2 text-2xl font-bold text-emerald-400">
                  {form.amountKz
                    ? new Intl.NumberFormat('pt-PT').format(Math.round(parseFloat(form.amountKz)))
                    : '0'}{' '}
                  <span className="text-sm text-slate-500">Kz</span>
                </div>
              </div>
            </>
          )}

          {/* Método de Pagamento e Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-[#0A2540] mb-1 block">Método de Pagamento</Label>
              <Select value={form.paymentMethod} onValueChange={(v) => set('paymentMethod', v)}>
                <SelectTrigger className="border-[#dde3ec] text-[#0A2540]">
                  <SelectValue placeholder="Opcional..." />
                </SelectTrigger>
                <SelectContent className="bg-white border-[#E2E8F0]">
                  {['Transferência Bancária', 'Dinheiro', 'TPA', 'Multicaixa Express', 'Paypal', 'Wise'].map((m) => (
                    <SelectItem key={m} value={m} className="text-[#0A2540]">{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[#0A2540] mb-2 block">Status *</Label>
              <div className="flex gap-2">
                {(['pago', 'pendente', 'atrasado'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => set('status', s)}
                    className={`flex-1 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                      form.status === s
                        ? s === 'pago'
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                          : s === 'pendente'
                          ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300'
                          : 'bg-red-500/20 border-red-500/50 text-red-300'
                        : 'border-[#dde3ec] text-[#6b7e9a] hover:border-[#0A2540]'
                    }`}
                  >
                    {s === 'pago' ? '✅ Pago' : s === 'pendente' ? '⏳ Pendente' : '🔴 Atrasado'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Nº Recibo e Notas */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-[#0A2540] mb-1 block">Nº Recibo</Label>
              <Input
                value={form.receiptNumber}
                onChange={(e) => set('receiptNumber', e.target.value)}
                placeholder="Opcional"
                className="border-[#dde3ec] text-[#0A2540]"
              />
            </div>
            <div>
              <Label className="text-[#0A2540] mb-1 block">Notas</Label>
              <Input
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                placeholder="Opcional"
                className="border-[#dde3ec] text-[#0A2540]"
              />
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 text-white hover:opacity-90"
            >
              {mutation.isPending ? 'A guardar...' : isEdit ? 'Actualizar' : 'Criar Transação'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
