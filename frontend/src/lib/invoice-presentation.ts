import type { Factura } from './types';

export type InvoiceDisplayMode = 'DOCUMENT_ONLY' | 'DOCUMENT_PLUS_INTERNAL';

const CURRENCY_LABELS: Record<string, string> = {
  AOA: 'Kz',
  USD: 'USD',
  EUR: 'EUR',
  GBP: 'GBP',
  CHF: 'CHF',
  CNY: 'CNY',
};

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  FT: 'Factura',
  FR: 'Factura-Recibo',
  ND: 'Nota de Débito',
  NC: 'Nota de Crédito',
  FA: 'Factura Simplificada',
  PF: 'Proforma',
};

export const DISPLAY_MODE_LABELS: Record<InvoiceDisplayMode, string> = {
  DOCUMENT_ONLY: 'Só moeda do documento',
  DOCUMENT_PLUS_INTERNAL: 'Moeda do documento + referência interna',
};

export function resolveInvoiceBaseCurrency(invoice: Partial<Factura> | null | undefined) {
  return invoice?.baseCurrency || 'AOA';
}

export function resolveInvoiceDisplayCurrency(invoice: Partial<Factura> | null | undefined) {
  return invoice?.displayCurrency || invoice?.currencyCode || 'AOA';
}

export function resolveInvoiceDisplayMode(invoice: Partial<Factura> | null | undefined): InvoiceDisplayMode {
  const storedMode = invoice?.displayMode;
  if (storedMode === 'DOCUMENT_ONLY' || storedMode === 'DOCUMENT_PLUS_INTERNAL') {
    return storedMode;
  }

  return resolveInvoiceDisplayCurrency(invoice) !== resolveInvoiceBaseCurrency(invoice)
    ? 'DOCUMENT_PLUS_INTERNAL'
    : 'DOCUMENT_ONLY';
}

export function formatInvoiceAmount(amount: number, currency = 'AOA') {
  const normalizedCurrency = (currency || 'AOA').toUpperCase();
  const prefix = CURRENCY_LABELS[normalizedCurrency] ?? normalizedCurrency;
  const value = Number(amount || 0).toLocaleString(
    normalizedCurrency === 'AOA' ? 'pt-AO' : undefined,
    { minimumFractionDigits: 2, maximumFractionDigits: 2 }
  );

  return normalizedCurrency === 'AOA' ? `${value} ${prefix}` : `${prefix} ${value}`;
}

export function formatInvoiceBaseEquivalent(invoice: Partial<Factura> | null | undefined) {
  if (!invoice) return null;
  const displayCurrency = resolveInvoiceDisplayCurrency(invoice);
  const baseCurrency = resolveInvoiceBaseCurrency(invoice);
  const exchangeRate = Number(invoice.exchangeRate || 0);
  const total = Number(invoice.grossTotal || 0);
  const displayMode = resolveInvoiceDisplayMode(invoice);

  if (
    displayCurrency === baseCurrency ||
    displayMode !== 'DOCUMENT_PLUS_INTERNAL' ||
    exchangeRate <= 0
  ) {
    return null;
  }

  return formatInvoiceAmount(total * exchangeRate, baseCurrency);
}

export function getInvoiceDocumentLabel(type?: string) {
  return DOCUMENT_TYPE_LABELS[type || ''] || type || 'Documento';
}
