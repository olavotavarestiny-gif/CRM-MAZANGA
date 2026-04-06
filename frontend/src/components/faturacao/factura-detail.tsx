'use client';

import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Ban,
  Building2,
  CheckCircle2,
  Clock,
  FileDown,
  Printer,
  QrCode,
  ReceiptText,
  Wallet,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { anularFactura, downloadFacturaPdf, getFaturacaoConfig } from '@/lib/api';
import type { Factura, FacturaLine, IBANEntry } from '@/lib/types';
import { printThermalRecibo } from '@/lib/thermal-print';
import {
  DISPLAY_MODE_LABELS,
  formatInvoiceAmount,
  formatInvoiceBaseEquivalent,
  getInvoiceDocumentLabel,
  resolveInvoiceDisplayCurrency,
  resolveInvoiceDisplayMode,
} from '@/lib/invoice-presentation';

function fmtDateLong(date: string) {
  return new Date(date).toLocaleDateString('pt-PT', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function AgtBadge({ status, mock }: { status: string; mock?: boolean }) {
  const map = {
    P: { label: 'Pendente AGT', className: 'bg-amber-50 text-amber-700 border-amber-200', icon: <Clock className="h-3.5 w-3.5" /> },
    V: { label: mock ? 'Válida (MOCK)' : 'Válida', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
    I: { label: 'Inválida', className: 'bg-red-50 text-red-700 border-red-200', icon: <XCircle className="h-3.5 w-3.5" /> },
    A: { label: 'Anulada', className: 'bg-slate-100 text-slate-600 border-slate-200', icon: <Ban className="h-3.5 w-3.5" /> },
    NA: { label: 'Não fiscal', className: 'bg-slate-100 text-slate-600 border-slate-200', icon: <ReceiptText className="h-3.5 w-3.5" /> },
  } as const;
  const badge = map[status as keyof typeof map] || map.P;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${badge.className}`}>
      {badge.icon}
      {badge.label}
    </span>
  );
}

function InfoCard({
  title,
  icon,
  lines,
}: {
  title: string;
  icon: ReactNode;
  lines: Array<{ label?: string; value: string; strong?: boolean; accent?: boolean }>;
}) {
  return (
    <Card className="overflow-hidden border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-100 bg-slate-50/80">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-5">
        {lines.map((line, index) => (
          <div key={`${title}-${index}`} className="space-y-1">
            {line.label ? (
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
                {line.label}
              </p>
            ) : null}
            <p className={`break-words text-sm ${
              line.strong
                ? 'font-semibold text-slate-900'
                : line.accent
                  ? 'text-blue-700'
                  : 'text-slate-600'
            }`}>
              {line.value}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SummaryRow({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 ${emphasis ? 'text-white' : 'text-slate-200'}`}>
      <span className={emphasis ? 'text-sm font-medium text-blue-100' : 'text-sm'}>{label}</span>
      <span className={`font-mono ${emphasis ? 'text-2xl font-bold tracking-tight text-white' : 'text-sm font-semibold'}`}>
        {value}
      </span>
    </div>
  );
}

interface Props {
  factura: Factura;
  isMock?: boolean;
  ibans?: IBANEntry[];
}

export function FacturaDetail({ factura, isMock, ibans }: Props) {
  const qc = useQueryClient();
  const [showAnular, setShowAnular] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const { data: faturacaoConfig } = useQuery({
    queryKey: ['faturacao-config'],
    queryFn: getFaturacaoConfig,
    staleTime: 30_000,
  });

  const handleDownloadPdf = async () => {
    setPdfLoading(true);
    try {
      await downloadFacturaPdf(factura.id);
    } finally {
      setPdfLoading(false);
    }
  };

  const handlePrintRecibo = () => {
    if (!faturacaoConfig) return;
    printThermalRecibo(factura, faturacaoConfig);
  };

  const lines: FacturaLine[] = typeof factura.lines === 'string'
    ? JSON.parse(factura.lines as unknown as string)
    : factura.lines;
  const documentCurrency = resolveInvoiceDisplayCurrency(factura);
  const resolvedDisplayMode = resolveInvoiceDisplayMode(factura);
  const baseEquivalent = formatInvoiceBaseEquivalent(factura);
  const documentLabel = getInvoiceDocumentLabel(factura.documentType);
  const issuerName = faturacaoConfig?.nomeEmpresa || factura.estabelecimento?.nome || 'Empresa';
  const issuerNif = faturacaoConfig?.nifEmpresa || factura.estabelecimento?.nif || '—';
  const issuerAddress = faturacaoConfig?.moradaEmpresa || factura.estabelecimento?.morada || '';
  const issuerPhone = faturacaoConfig?.telefoneEmpresa || factura.estabelecimento?.telefone || '';
  const issuerEmail = faturacaoConfig?.emailEmpresa || factura.estabelecimento?.email || '';
  const issuerWebsite = faturacaoConfig?.websiteEmpresa || '';
  const customerPhone = factura.clienteFaturacao?.customerPhone || '';
  const customerEmail = factura.clienteFaturacao?.customerEmail || '';
  const logoUrl = faturacaoConfig?.logoUrl || '';
  const isConsumidorFinal = !factura.customerTaxID || factura.customerTaxID === '000000000';

  const anularMutation = useMutation({
    mutationFn: () => anularFactura(factura.id, motivo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['factura', factura.id] });
      qc.invalidateQueries({ queryKey: ['facturas'] });
      setShowAnular(false);
    },
  });

  return (
    <div className="max-w-6xl space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-800/20 bg-[#0A2540] px-6 py-6 text-white">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex items-start gap-4">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt={issuerName}
                  className="h-16 w-16 rounded-2xl border border-white/10 bg-white object-contain p-2"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-lg font-bold text-white">
                  {issuerName.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">
                    Documento Fiscal
                  </p>
                  <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white">
                    {documentLabel}
                  </h1>
                  <p className="mt-2 text-lg font-semibold text-blue-100">
                    {factura.documentNo}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <AgtBadge status={factura.agtValidationStatus} mock={isMock} />
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
                    factura.documentStatus === 'A'
                      ? 'border-red-200 bg-red-50 text-red-700'
                      : 'border-white/15 bg-white/10 text-blue-50'
                  }`}>
                    {factura.documentStatus === 'A' ? 'Documento anulado' : 'Documento normal'}
                  </span>
                  <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-xs font-medium text-blue-50">
                    Moeda: {documentCurrency}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row xl:justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrintRecibo}
                disabled={!faturacaoConfig}
                className="border-white/15 bg-white/5 text-white hover:bg-white/10"
              >
                <Printer className="mr-1.5 h-3.5 w-3.5" />
                Imprimir Recibo
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadPdf}
                disabled={pdfLoading}
                className="border-white/15 bg-white/5 text-white hover:bg-white/10"
              >
                <FileDown className="mr-1.5 h-3.5 w-3.5" />
                {pdfLoading ? 'A gerar...' : 'Exportar PDF'}
              </Button>
              {factura.documentStatus === 'N' ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAnular(true)}
                  className="border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                >
                  <Ban className="mr-1.5 h-3.5 w-3.5" />
                  Anular
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1.3fr)_320px]">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[
              { label: 'Data de emissão', value: fmtDateLong(factura.documentDate) },
              { label: 'Série', value: factura.serie ? `${factura.serie.seriesCode}/${factura.serie.seriesYear}` : '—' },
              { label: 'Ponto de venda', value: factura.estabelecimento?.nome || '—' },
              { label: 'Pagamento', value: factura.paymentMethod || '—' },
              { label: 'Modo de apresentação', value: DISPLAY_MODE_LABELS[resolvedDisplayMode] || 'Só moeda do documento' },
              { label: 'Data da taxa', value: factura.exchangeRateDate ? fmtDateLong(factura.exchangeRateDate) : '—' },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
                  {item.label}
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-[24px] bg-[#0A2540] p-5 shadow-sm">
            <div className="flex items-center gap-2 text-blue-200">
              <Wallet className="h-4 w-4" />
              <p className="text-sm font-semibold">Resumo do Documento</p>
            </div>
            <div className="mt-5 space-y-3">
              <SummaryRow label="Subtotal" value={formatInvoiceAmount(factura.netTotal, documentCurrency)} />
              <SummaryRow label="IVA" value={formatInvoiceAmount(factura.taxPayable, documentCurrency)} />
              <div className="border-t border-white/10 pt-3">
                <SummaryRow label="Total" value={formatInvoiceAmount(factura.grossTotal, documentCurrency)} emphasis />
              </div>
              {baseEquivalent ? (
                <div className="rounded-2xl bg-white/8 px-4 py-3 text-sm text-blue-100">
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-blue-200">
                    Referência interna
                  </p>
                  <p className="mt-2 font-mono text-base font-semibold text-white">
                    {baseEquivalent}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <InfoCard
          title="Emitente"
          icon={<Building2 className="h-4 w-4 text-blue-600" />}
          lines={[
            { value: issuerName, strong: true },
            { label: 'NIF', value: issuerNif },
            ...(issuerAddress ? [{ label: 'Morada', value: issuerAddress }] : []),
            ...(issuerPhone ? [{ label: 'Telefone', value: issuerPhone }] : []),
            ...(issuerEmail ? [{ label: 'Email', value: issuerEmail }] : []),
            ...(issuerWebsite ? [{ label: 'Website', value: issuerWebsite, accent: true }] : []),
          ]}
        />
        <InfoCard
          title="Cliente / Faturado a"
          icon={<ReceiptText className="h-4 w-4 text-blue-600" />}
          lines={[
            { value: factura.customerName || 'Consumidor Final', strong: true },
            { label: 'NIF', value: isConsumidorFinal ? 'Consumidor Final' : factura.customerTaxID },
            ...(factura.customerAddress ? [{ label: 'Morada', value: factura.customerAddress }] : []),
            ...(customerPhone ? [{ label: 'Telefone', value: customerPhone }] : []),
            ...(customerEmail ? [{ label: 'Email', value: customerEmail }] : []),
          ]}
        />
      </div>

      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 bg-slate-50/80">
          <CardTitle className="text-base text-slate-900">Itens do documento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-5">
          <div className="hidden grid-cols-12 border-b border-slate-200 pb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400 md:grid">
            <span className="col-span-6">Descrição</span>
            <span className="col-span-1 text-right">Qtd.</span>
            <span className="col-span-2 text-right">Preço Unit.</span>
            <span className="col-span-1 text-right">IVA</span>
            <span className="col-span-2 text-right">Total</span>
          </div>
          {lines.map((line, index) => {
            const qty = Number(line.quantity || 0);
            const unitPrice = Number(line.unitPrice || 0);
            const tax = line.taxes?.[0]?.taxPercentage ?? 14;
            const total = line.isIncluded ? 0 : qty * unitPrice * (1 + tax / 100);

            return (
              <div
                key={`${line.lineNumber}-${index}`}
                className={`rounded-2xl border px-4 py-4 md:grid md:grid-cols-12 md:items-start md:gap-3 ${
                  line.isIncluded
                    ? 'border-emerald-200 bg-emerald-50'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div className="md:col-span-6">
                  <p className={`text-sm font-semibold ${line.isIncluded ? 'text-emerald-700' : 'text-slate-900'}`}>
                    {line.productDescription}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    {line.productCode ? <span className="rounded-full bg-slate-100 px-2 py-1">{line.productCode}</span> : null}
                    {line.unitOfMeasure ? <span className="rounded-full bg-slate-100 px-2 py-1">{line.unitOfMeasure}</span> : null}
                    {line.isIncluded ? <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">Incluído</span> : null}
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:col-span-6 md:mt-0 md:grid-cols-4">
                  <div className="md:text-right">
                    <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400 md:hidden">Qtd.</p>
                    <p className="font-mono text-slate-700">{qty.toLocaleString('pt-PT')}</p>
                  </div>
                  <div className="md:text-right">
                    <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400 md:hidden">Preço</p>
                    <p className="font-mono text-slate-700">
                      {line.isIncluded ? 'Incluído' : formatInvoiceAmount(unitPrice, documentCurrency)}
                    </p>
                  </div>
                  <div className="md:text-right">
                    <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400 md:hidden">IVA</p>
                    <p className="font-mono text-slate-500">{line.isIncluded ? '—' : `${tax}%`}</p>
                  </div>
                  <div className="md:text-right">
                    <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400 md:hidden">Total</p>
                    <p className={`font-mono font-semibold ${line.isIncluded ? 'text-emerald-700' : 'text-slate-900'}`}>
                      {line.isIncluded ? 'Incluído' : formatInvoiceAmount(total, documentCurrency)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_360px]">
        <InfoCard
          title="Pagamento e observações"
          icon={<Wallet className="h-4 w-4 text-blue-600" />}
          lines={[
            { label: 'Método', value: factura.paymentMethod || '—' },
            { label: 'Moeda do documento', value: documentCurrency },
            ...(factura.exchangeRate ? [{ label: 'Taxa usada', value: `1 ${documentCurrency} = ${formatInvoiceAmount(factura.exchangeRate, 'AOA')}` }] : []),
            ...((ibans || []).map((entry) => ({ label: entry.label || 'IBAN', value: entry.iban }))),
          ]}
        />

        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100 bg-slate-50/80">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <QrCode className="h-4 w-4 text-blue-600" />
              QR e informação AGT
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            {factura.qrCodeImage ? (
              <div className="flex justify-center rounded-2xl border border-slate-200 bg-white p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={factura.qrCodeImage} alt="QR Code AGT" className="h-32 w-32" />
              </div>
            ) : null}
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">Estado AGT</p>
                <div className="mt-2">
                  <AgtBadge status={factura.agtValidationStatus} mock={isMock} />
                </div>
              </div>
              {factura.serie ? (
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">Série</p>
                  <p className="mt-1 text-slate-700">{factura.serie.seriesCode}/{factura.serie.seriesYear}</p>
                </div>
              ) : null}
              {factura.agtRequestId ? (
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">Request ID</p>
                  <p className="mt-1 break-all font-mono text-xs text-slate-700">{factura.agtRequestId}</p>
                </div>
              ) : null}
              {factura.jwsSignature && factura.jwsSignature !== 'PLACEHOLDER' ? (
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">Assinatura</p>
                  <p className="mt-1 break-all font-mono text-xs text-slate-700">{factura.jwsSignature}</p>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      {factura.documentStatus === 'A' && factura.documentCancelReason ? (
        <Card className="border-red-200 bg-red-50/70 shadow-sm">
          <CardContent className="flex items-start gap-3 pt-5 text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="text-sm font-semibold">Motivo de anulação</p>
              <p className="mt-1 text-sm">{factura.documentCancelReason}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={showAnular} onOpenChange={setShowAnular}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anular {documentLabel} {factura.documentNo}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Esta ação é irreversível. O documento ficará marcado como anulado no sistema e na AGT.</span>
            </div>
            <div>
              <Label className="text-sm text-slate-600">Motivo de anulação *</Label>
              <Textarea
                value={motivo}
                onChange={(event) => setMotivo(event.target.value)}
                placeholder="Descreva o motivo da anulação..."
                className="mt-1"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAnular(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => anularMutation.mutate()}
              disabled={!motivo.trim() || anularMutation.isPending}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {anularMutation.isPending ? 'A anular...' : 'Confirmar anulação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
