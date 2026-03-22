'use client';
import { Card, CardContent } from '@/components/ui/card';

function fmt(v: number, unit: string) {
  if (unit === 'Kz') return new Intl.NumberFormat('pt-PT').format(Math.round(v)) + ' Kz';
  return new Intl.NumberFormat('pt-PT').format(v);
}

export default function GoalWidget({
  title,
  current,
  target,
  unit = '',
  color = '#10B981',
}: {
  title: string;
  current: number;
  target: number;
  unit?: string;
  color?: string;
}) {
  const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  const over = target > 0 && current > target;

  const statusColor =
    pct >= 100 ? '#10B981' :
    pct >= 70  ? '#F59E0B' :
    pct >= 40  ? color :
    '#6b7e9a';

  return (
    <Card className="col-span-2">
      <CardContent className="py-5 px-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-xs font-medium text-[#6b7e9a] uppercase tracking-wide mb-0.5">{title}</p>
            <p className="text-2xl font-bold text-[#0A2540]">{fmt(current, unit)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-[#6b7e9a]">Objetivo</p>
            <p className="text-sm font-semibold text-[#0A2540]">{fmt(target, unit)}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-3 rounded-full overflow-hidden bg-[#E2E8F0]">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: statusColor }}
          />
        </div>

        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-[#6b7e9a]">
            {over ? '🎉 Meta atingida!' : `Falta ${fmt(Math.max(target - current, 0), unit)}`}
          </p>
          <p className="text-sm font-bold" style={{ color: statusColor }}>
            {pct.toFixed(0)}%
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
