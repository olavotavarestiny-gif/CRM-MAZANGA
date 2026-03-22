'use client';
import { Card, CardContent } from '@/components/ui/card';

function fmt(v: number, unit: string) {
  if (unit === 'Kz') return new Intl.NumberFormat('pt-PT').format(Math.round(v)) + ' Kz';
  return new Intl.NumberFormat('pt-PT').format(v);
}

export default function StatWidget({
  title,
  value,
  unit = '',
  color = '#0A2540',
  subtitle,
}: {
  title: string;
  value: number;
  unit?: string;
  color?: string;
  subtitle?: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1 h-full rounded-l-xl" style={{ background: color }} />
      <CardContent className="pl-5 pr-4 py-5">
        <p className="text-xs font-medium text-[#6b7e9a] uppercase tracking-wide mb-1">{title}</p>
        <p className="text-3xl font-bold text-[#0A2540] leading-none">
          {fmt(value, unit)}
        </p>
        {subtitle && <p className="text-xs text-[#6b7e9a] mt-1">{subtitle}</p>}
        {unit && unit !== 'Kz' && <p className="text-xs text-[#6b7e9a] mt-0.5">{unit}</p>}
      </CardContent>
    </Card>
  );
}
