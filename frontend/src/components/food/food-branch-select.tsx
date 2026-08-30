'use client';

import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export function FoodBranchSelect({
  branches,
  value,
  onChange,
  label = 'Unidade',
  allowAll = false,
  disabled = false,
  className,
}: {
  branches: Array<{ id: string; name: string; active?: boolean }>;
  value: string;
  onChange: (branchId: string) => void;
  label?: string;
  allowAll?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('w-full', className)}>
      <Label>{label}</Label>
      <select
        className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      >
        {allowAll ? <option value="">Todas as unidades</option> : null}
        {branches.filter((branch) => branch.active !== false).map((branch) => (
          <option key={branch.id} value={branch.id}>{branch.name}</option>
        ))}
      </select>
    </div>
  );
}
