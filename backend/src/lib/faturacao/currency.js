'use strict';

const DEFAULT_BASE_CURRENCY = 'AOA';
const DISPLAY_MODES = {
  DOCUMENT_ONLY: 'DOCUMENT_ONLY',
  DOCUMENT_PLUS_INTERNAL: 'DOCUMENT_PLUS_INTERNAL',
};

function normalizeCurrencyCode(value, fallback = DEFAULT_BASE_CURRENCY) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toUpperCase();
  return normalized || fallback;
}

function normalizeExchangeRate(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDate(value) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function resolveBaseCurrency(record = {}) {
  return normalizeCurrencyCode(record.baseCurrency, DEFAULT_BASE_CURRENCY);
}

function resolveDisplayCurrency(record = {}) {
  return normalizeCurrencyCode(record.displayCurrency || record.currencyCode, resolveBaseCurrency(record));
}

function isForeignPresentation(record = {}) {
  return resolveDisplayCurrency(record) !== resolveBaseCurrency(record);
}

function resolveStoredDisplayMode(record = {}) {
  const requested = typeof record.displayMode === 'string' ? record.displayMode.trim().toUpperCase() : '';
  if (requested === DISPLAY_MODES.DOCUMENT_ONLY || requested === DISPLAY_MODES.DOCUMENT_PLUS_INTERNAL) {
    return requested;
  }

  return isForeignPresentation(record)
    ? DISPLAY_MODES.DOCUMENT_PLUS_INTERNAL
    : DISPLAY_MODES.DOCUMENT_ONLY;
}

function normalizeInvoiceCurrencyInput(payload = {}, now = new Date()) {
  const baseCurrency = resolveBaseCurrency(payload);
  const displayCurrency = normalizeCurrencyCode(payload.displayCurrency || payload.currencyCode, baseCurrency);
  const foreignPresentation = displayCurrency !== baseCurrency;
  const exchangeRate = foreignPresentation ? normalizeExchangeRate(payload.exchangeRate) : null;
  const exchangeRateDate = foreignPresentation
    ? (normalizeDate(payload.exchangeRateDate) || now)
    : null;
  const requestedDisplayMode = typeof payload.displayMode === 'string'
    ? payload.displayMode.trim().toUpperCase()
    : '';
  const displayMode = requestedDisplayMode === DISPLAY_MODES.DOCUMENT_PLUS_INTERNAL
    ? DISPLAY_MODES.DOCUMENT_PLUS_INTERNAL
    : DISPLAY_MODES.DOCUMENT_ONLY;

  return {
    baseCurrency,
    displayCurrency,
    currencyCode: displayCurrency,
    exchangeRate,
    exchangeRateDate,
    displayMode,
    isForeign: foreignPresentation,
  };
}

function getDocumentEquivalentInBase(record = {}) {
  const grossTotal = Number(record.grossTotal || 0);
  if (!isForeignPresentation(record)) {
    return grossTotal;
  }

  return grossTotal * Number(record.exchangeRate || 1);
}

module.exports = {
  DEFAULT_BASE_CURRENCY,
  DISPLAY_MODES,
  getDocumentEquivalentInBase,
  isForeignPresentation,
  normalizeInvoiceCurrencyInput,
  resolveBaseCurrency,
  resolveDisplayCurrency,
  resolveStoredDisplayMode,
};
