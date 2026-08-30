import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function ManagementPage({ title, description, action, children }: { title: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return <main className="mx-auto w-full max-w-[1600px] space-y-6 p-4 md:p-6 lg:p-8"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white md:text-3xl">{title}</h1>{description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>}</div>{action}</div>{children}</main>;
}

export function KpiCard({ label, value, hint, tone = 'blue' }: { label: string; value: string | number; hint?: string; tone?: 'blue' | 'green' | 'red' | 'amber' }) {
  const tones = { blue: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300', green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300', red: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300', amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' };
  return <Card className="print-card border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"><CardContent className="p-4"><span className={cn('inline-flex rounded-lg px-2 py-1 text-[11px] font-bold uppercase tracking-wide', tones[tone])}>{label}</span><p className="mt-3 text-2xl font-bold text-slate-950 dark:text-white">{value}</p>{hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}</CardContent></Card>;
}

export function StatusBadge({ value }: { value: string }) {
  const success = ['ativo','ganho','concluido','recebido','pago','aprovado','verde'];
  const danger = ['cancelado','perdido','atrasado','em_atraso','vermelho'];
  const warning = ['pendente','pausado','em_negociacao','amarelo'];
  return <span className={cn('inline-flex rounded-full px-2.5 py-1 text-xs font-semibold', success.includes(value) ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : danger.includes(value) ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' : warning.includes(value) ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300')}>{value.replaceAll('_', ' ')}</span>;
}

export function ManagementLoading() { return <div className="flex min-h-[280px] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-blue-600" /></div>; }
export function ManagementEmpty({ title = 'Ainda não existem dados', description = 'Crie o primeiro registo para começar.' }: { title?: string; description?: string }) { return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900"><p className="font-semibold text-slate-800 dark:text-slate-100">{title}</p><p className="mt-1 text-sm text-slate-500">{description}</p></div>; }
export const tableClass = 'w-full min-w-[760px] text-left text-sm';
export const thClass = 'border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-950/60';
export const tdClass = 'border-b border-slate-100 px-4 py-3 text-slate-700 dark:border-slate-800 dark:text-slate-200';
