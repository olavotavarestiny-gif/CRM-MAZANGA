'use client';

import { Badge } from '@/components/ui/badge';
import type { PlanComparisonItem } from '@/lib/plan-utils';
import { cn } from '@/lib/utils';

const TONE_CLASSES: Record<PlanComparisonItem['tone'], string> = {
  growth: 'border-[var(--workspace-primary-border)] bg-[var(--workspace-primary-soft)] text-[var(--workspace-primary)]',
  pro: 'border-slate-200 bg-slate-100 text-slate-800',
  soon: 'border-amber-200 bg-amber-50 text-amber-700',
};

type PlanComparisonListProps = {
  items: PlanComparisonItem[];
};

export default function PlanComparisonList({ items }: PlanComparisonListProps) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-6 py-5">
        <h2 className="text-lg font-bold tracking-tight text-[#0A2540]">Comparação rápida</h2>
        <p className="mt-1 text-sm text-[#6b7e9a]">
          Veja rapidamente em que plano cada funcionalidade estratégica fica disponível.
        </p>
      </div>

      <div className="divide-y divide-slate-100">
        {items.map((item) => (
          <div key={item.feature} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-[#1f2937]">{item.feature}</p>
            <Badge
              variant="secondary"
              className={cn('w-fit border font-medium', TONE_CLASSES[item.tone])}
            >
              {item.availabilityLabel}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
