'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { CheckCircle2, Clock, XCircle, AlertCircle, FileDown, Ban } from 'lucide-react';
import { anularFactura, downloadFacturaPdf } from '@/lib/api';
import type { Factura, IBANEntry } from '@/lib/types';

const CURRENCY_SYMBOLS: Record<string, string> = { AOA: 'Kz', USD: '$', EUR: '€', GBP: '£', CHF: 'Fr', CNY: '¥' };

function fmtAmount(n: number, currency = 'AOA') {
  if (currency === 'AOA') {
    return n.toLocaleString('pt-AO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Kz';
  }
  const sym = CURRENCY_SYMBOLS[currency] ?? currency;
  return sym + ' ' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtKz(n: number) {
  return n.toLocaleString('pt-AO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Kz';
}

function AgtBadge({ status, mock }: { status: string; mock?: boolean }) {
  const map: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    P: { label: 'Pendente AGT', className: 'bg-yellow-50 text-yellow-700 border-yellow-200', icon: <Clock className="w-3 h-3" /> },
    V: { label: mock ? 'Válida (MOCK)' : 'Válida', className: 'bg-green-50 text-green-700 border-green-200', icon: <CheckCircle2 className="w-3 h-3" /> },
    I: { label: 'Inválida', className: 'bg-red-50 text-red-700 border-red-200', icon: <XCircle className="w-3 h-3" /> },
    A: { label: 'Anulada', className: 'bg-gray-100 text-gray-600 border-gray-200', icon: <Ban className="w-3 h-3" /> },
  };
  const b = map[status] || map.P;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${b.className}`}>
      {b.icon}{b.label}
    </span>
  );
}

interface Props {
  factura: Factura;
  isMock?: boolean;
  ibans?: IBANEntry[];
}

export function FacturaDetail({ factura, isMock, ibans }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const [showAnular, setShowAnular] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);

  const handleDownloadPdf = async () => {
    setPdfLoading(true);
    try { await downloadFacturaPdf(factura.id); }
    finally { setPdfLoading(false); }
  };

  const lines = typeof factura.lines === 'string' ? JSON.parse(factura.lines as unknown as string) : factura.lines;

  const anularMutation = useMutation({
    mutationFn: () => anularFactura(factura.id, motivo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['factura', factura.id] });
      qc.invalidateQueries({ queryKey: ['facturas'] });
      setShowAnular(false);
    },
  });

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-[#0A2540]">{factura.documentNo}</h1>
            <AgtBadge status={factura.agtValidationStatus} mock={isMock} />
            {factura.documentStatus === 'A' && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-red-50 text-red-600 border border-red-200 line-through">ANULADA</span>
            )}
          </div>
          <p className="text-gray-500 text-sm">
            {new Date(factura.documentDate).toLocaleDateString('pt-PT', { year: 'numeric', month: 'long', day: 'numeric' })}
            {' · '}{factura.documentType}
            {factura.paymentMethod && <> · <span className="text-gray-600">{factura.paymentMethod}</span></>}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={pdfLoading} className="border-gray-200 text-gray-700 hover:bg-gray-50">
            <FileDown className="w-3.5 h-3.5 mr-1" /> {pdfLoading ? 'A gerar...' : 'Exportar PDF'}
          </Button>
          {factura.documentStatus === 'N' && (
            <Button variant="outline" size="sm" onClick={() => setShowAnular(true)} className="border-red-200 text-red-600 hover:bg-red-50">
              <Ban className="w-3.5 h-3.5 mr-1" /> Anular
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Emitente */}
        <Card>
          <CardHeader><CardTitle className="text-sm text-gray-500">Emitente</CardTitle></CardHeader>
          <CardContent>
            <p className="text-[#0A2540] font-medium">{factura.estabelecimento?.nome}</p>
            <p className="text-gray-500 text-sm">NIF: {factura.estabelecimento?.nif}</p>
          </CardContent>
        </Card>
        {/* Cliente */}
        <Card>
          <CardHeader><CardTitle className="text-sm text-gray-500">Cliente</CardTitle></CardHeader>
          <CardContent>
            <p className="text-[#0A2540] font-medium">{factura.customerName}</p>
            <p className="text-gray-500 text-sm">NIF: {factura.customerTaxID}</p>
            {factura.customerAddress && <p className="text-gray-500 text-sm">{factura.customerAddress}</p>}
          </CardContent>
        </Card>
      </div>

      {/* Linhas */}
      <Card>
        <CardHeader><CardTitle className="text-[#0A2540] text-base">Artigos</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="grid grid-cols-12 text-xs text-gray-500 uppercase tracking-wide pb-2 border-b border-gray-100">
              <span className="col-span-5">Descrição</span>
              <span className="col-span-1 text-right">Qtd.</span>
              <span className="col-span-2 text-right">Preço</span>
              <span className="col-span-1 text-right">IVA%</span>
              <span className="col-span-2 text-right">Total</span>
              <span className="col-span-1 text-right">c/IVA</span>
            </div>
            {lines.map((line: any, i: number) => {
              const sub = line.quantity * line.unitPrice;
              const tax = line.taxes?.[0]?.taxPercentage ?? 14;
              return (
                <div key={i} className="grid grid-cols-12 text-sm py-1.5">
                  <div className="col-span-5">
                    <p className="text-[#0A2540]">{line.productDescription}</p>
                    <p className="text-gray-400 text-xs">{line.productCode}</p>
                  </div>
                  <span className="col-span-1 text-right text-gray-700">{line.quantity}</span>
                  <span className="col-span-2 text-right text-gray-700 font-mono">{line.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  <span className="col-span-1 text-right text-gray-500">{tax}%</span>
                  <span className="col-span-2 text-right text-gray-700 font-mono">{sub.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  <span className="col-span-1 text-right text-[#0A2540] font-mono font-medium">{(sub * (1 + tax / 100)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200 space-y-1.5">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Total s/ IVA</span>
              <span className="font-mono">{fmtAmount(factura.netTotal, factura.currencyCode)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>IVA</span>
              <span className="font-mono">{fmtAmount(factura.taxPayable, factura.currencyCode)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold">
              <span className="text-[#0A2540]">Total c/ IVA</span>
              <span className="font-mono text-violet-700">{fmtAmount(factura.grossTotal, factura.currencyCode)}</span>
            </div>
            {factura.currencyCode && factura.currencyCode !== 'AOA' && factura.exchangeRate && (
              <div className="flex justify-between text-sm text-gray-500 border-t border-gray-100 pt-2">
                <span>Equivalente AOA (taxa {factura.exchangeRate})</span>
                <span className="font-mono">{fmtKz(factura.grossTotal * factura.exchangeRate)}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* QR Code + JWS */}
      <div className="grid grid-cols-2 gap-4">
        {factura.qrCodeImage && (
          <Card>
            <CardHeader><CardTitle className="text-sm text-gray-500">QR Code</CardTitle></CardHeader>
            <CardContent className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={factura.qrCodeImage} alt="QR Code" className="w-32 h-32" />
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader><CardTitle className="text-sm text-gray-500">Informações AGT</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div><span className="text-gray-500">Série: </span><span className="text-[#0A2540] font-medium">{factura.serie?.seriesCode}/{factura.serie?.seriesYear}</span></div>
            <div><span className="text-gray-500">Estado AGT: </span><AgtBadge status={factura.agtValidationStatus} mock={isMock} /></div>
            {factura.agtRequestId && <div><span className="text-gray-500">Request ID: </span><span className="text-[#0A2540] font-mono text-xs">{factura.agtRequestId}</span></div>}
            <div><span className="text-gray-500">JWS: </span><span className="text-gray-400 font-mono text-xs">{factura.jwsSignature?.substring(0, 20)}...</span></div>
          </CardContent>
        </Card>
      </div>

      {/* Dados Bancários */}
      {ibans && ibans.length > 0 && (
        <Card>
          <CardContent className="pt-4 space-y-2">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Dados Bancários</p>
            {ibans.map((entry, i) => (
              <div key={i} className="flex items-baseline gap-2">
                {entry.label && <span className="text-xs text-gray-500 shrink-0">{entry.label}:</span>}
                <span className="text-[#0A2540] font-mono text-sm">{entry.iban}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Modal Anular */}
      <Dialog open={showAnular} onOpenChange={setShowAnular}>
        <DialogContent>
          <DialogHeader><DialogTitle>Anular Factura {factura.documentNo}</DialogTitle></DialogHeader>
          <div className="py-2 space-y-3">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Esta acção é irreversível. A factura ficará marcada como anulada no sistema e na AGT.</span>
            </div>
            <div>
              <Label className="text-gray-600 text-sm">Motivo de anulação *</Label>
              <Textarea
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                placeholder="Descreva o motivo da anulação..."
                className="mt-1"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAnular(false)}>Cancelar</Button>
            <Button
              onClick={() => anularMutation.mutate()}
              disabled={!motivo.trim() || anularMutation.isPending}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {anularMutation.isPending ? 'A anular...' : 'Confirmar Anulação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
