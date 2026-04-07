'use client';

import { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function ReportMetricCard({
  title,
  value,
  description,
  icon: Icon,
  accentClass,
}: {
  title: string;
  value: string;
  description?: string;
  icon: LucideIcon;
  accentClass?: string;
}) {
  return (
    <Card className="overflow-hidden border-[#dde3ec] shadow-sm">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{title}</p>
            <p className="mt-3 text-2xl font-black tracking-tight text-[#2c2f31]">{value}</p>
            {description ? <p className="mt-2 text-sm text-slate-500">{description}</p> : null}
          </div>
          <div className={cn('rounded-2xl p-3 text-white', accentClass || 'bg-[var(--workspace-primary)]')}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </div>
    </Card>
  );
}

export function ReportMetricCardSkeleton() {
  return (
    <Card className="overflow-hidden border-[#dde3ec] shadow-sm">
      <div className="space-y-3 p-5">
        <div className="h-3 w-28 animate-pulse rounded bg-slate-200" />
        <div className="h-9 w-36 animate-pulse rounded bg-slate-200" />
        <div className="h-4 w-40 animate-pulse rounded bg-slate-100" />
      </div>
    </Card>
  );
}
