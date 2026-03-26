'use client';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';

function fmt(v: number, unit: string) {
  if (unit === 'Kz') return new Intl.NumberFormat('pt-PT').format(Math.round(v)) + ' Kz';
  return new Intl.NumberFormat('pt-PT').format(v);
}

export default function StatWidget({
  title,
  value,
  unit = '',
  color = '#0049e6',
  subtitle,
  icon: Icon = TrendingUp,
}: {
  title: string;
  value: number;
  unit?: string;
  color?: string;
  subtitle?: string;
  icon?: React.ElementType;
}) {
  return (
    <Card className="group overflow-hidden transition-all duration-300 hover:shadow-md" style={{ borderLeft: `4px solid ${color}` }}>
      <CardContent className="p-6">
        {/* Icon Box */}
        <div className="inline-flex items-center justify-center p-2.5 rounded-lg mb-4" style={{ background: color + '18', color }}>
          <Icon className="w-5 h-5" />
        </div>

        {/* Label */}
        <p className="text-xs font-medium text-[#595c5e] uppercase tracking-wide mb-1">{title}</p>

        {/* Value */}
        <p className="text-4xl font-extrabold text-[#2c2f31] leading-none tracking-tighter">
          {fmt(value, unit)}
        </p>

        {/* Subtitle */}
        {subtitle && <p className="text-xs text-[#595c5e] mt-1">{subtitle}</p>}
        {unit && unit !== 'Kz' && <p className="text-xs text-[#595c5e] mt-0.5">{unit}</p>}
      </CardContent>
    </Card>
  );
}
