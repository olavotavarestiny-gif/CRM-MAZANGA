export const REPORT_PERIOD_OPTIONS = [
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
  { value: 'month', label: 'Este mês' },
  { value: 'custom', label: 'Personalizado' },
] as const;

export type ReportPeriodOption = (typeof REPORT_PERIOD_OPTIONS)[number]['value'];

const moneyFormatter = new Intl.NumberFormat('pt-PT', {
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat('pt-PT', {
  maximumFractionDigits: 0,
});

export function formatKz(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  return `${moneyFormatter.format(Math.round(value))} Kz`;
}

export function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  return numberFormatter.format(value);
}

export function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  return `${value.toFixed(1)}%`;
}

export function formatDays(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  return `${value.toFixed(1)} dias`;
}

export function formatGrowthLabel(value: number | null | undefined, fallback = 'Sem base anterior') {
  if (value === null || value === undefined) return fallback;
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}% vs período anterior`;
}

export function formatDateLabel(value: string) {
  return new Date(value).toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: 'short',
  });
}

export function formatDateRange(start: string, end: string) {
  return `${formatDateLabel(start)} - ${formatDateLabel(end)}`;
}

export function formatPaymentMethodLabel(value: string | null | undefined) {
  const normalized = String(value || 'OUTRO').toUpperCase();

  switch (normalized) {
    case 'DINHEIRO':
      return 'Dinheiro';
    case 'TRANSFERENCIA':
      return 'Transferência';
    case 'MULTICAIXA':
      return 'Multicaixa';
    case 'TPA':
      return 'TPA';
    case 'CREDITO':
      return 'Crédito';
    default:
      return normalized.replace(/_/g, ' ');
  }
}
