'use client';

interface UsageBarProps {
  label: string;
  current: number;
  limit: number;
  unit?: string;
}

export function UsageBar({ label, current, limit, unit = '' }: UsageBarProps) {
  const isUnlimited = limit === Infinity || limit >= 999999;
  const pct = isUnlimited ? 0 : Math.min(100, Math.round((current / limit) * 100));

  const barColor =
    pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-400' : 'bg-emerald-500';

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-[#0A2540] font-medium">{label}</span>
        <span className="text-[#6b7e9a]">
          {isUnlimited
            ? `${current.toLocaleString()} / Ilimitado`
            : `${current.toLocaleString()} / ${limit.toLocaleString()}${unit ? ` ${unit}` : ''}`}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-1.5 w-full bg-[#E2E8F0] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}
