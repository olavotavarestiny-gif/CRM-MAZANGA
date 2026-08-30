export function formatKz(value: number | string | null | undefined): string {
  const amount = Number(value || 0);
  return `${new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 0 }).format(amount)} Kz`;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-PT', { timeZone: 'Africa/Luanda', day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'Não disponível';
  return `${new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 1 }).format(value)}%`;
}

export function downloadCsv(filename: string, rows: Array<Record<string, unknown>>): void {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const csv = [headers.map(escape).join(';'), ...rows.map((row) => headers.map((header) => escape(row[header])).join(';'))].join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
}
