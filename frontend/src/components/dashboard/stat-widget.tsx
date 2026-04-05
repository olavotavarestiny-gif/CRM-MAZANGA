'use client';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRight, Minus, TrendingDown, TrendingUp } from 'lucide-react';

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
  delta,
  href,
  icon: Icon = TrendingUp,
}: {
  title: string;
  value: number;
  unit?: string;
  color?: string;
  subtitle?: string;
  delta?: number;
  href?: string;
  icon?: React.ElementType;
}) {
  const deltaValue = typeof delta === 'number' ? Number(delta.toFixed(1)) : undefined;
  const DeltaIcon = deltaValue === undefined ? null : deltaValue > 0 ? TrendingUp : deltaValue < 0 ? TrendingDown : Minus;
  const deltaColor = deltaValue === undefined ? '' : deltaValue > 0 ? 'text-green-600' : deltaValue < 0 ? 'text-red-600' : 'text-slate-500';
  const deltaLabel = deltaValue === undefined ? null : deltaValue === 0 ? '= 0% vs mês anterior' : `${deltaValue > 0 ? '+' : ''}${deltaValue}% vs mês anterior`;

  const cardContent = (
    <Card className="group overflow-hidden transition-all duration-300 hover:shadow-md" style={{ borderLeft: `4px solid ${color}` }}>
      <CardContent className="p-6">
        <div className="inline-flex items-center justify-center p-2.5 rounded-lg mb-4" style={{ background: color + '18', color }}>
          <Icon className="w-5 h-5" />
        </div>

        <p className="text-xs font-medium text-[#595c5e] uppercase tracking-wide mb-1">{title}</p>

        <p className="text-4xl font-extrabold text-[#2c2f31] leading-none tracking-tighter">
          {fmt(value, unit)}
        </p>

        {deltaLabel && DeltaIcon && (
          <div className={`mt-2 inline-flex items-center gap-1 text-xs font-semibold ${deltaColor}`}>
            <DeltaIcon className="h-3.5 w-3.5" />
            <span>{deltaLabel}</span>
          </div>
        )}

        {subtitle && <p className="text-xs text-[#595c5e] mt-1">{subtitle}</p>}
        {unit && unit !== 'Kz' && <p className="text-xs text-[#595c5e] mt-0.5">{unit}</p>}
        {href && (
          <div className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#0049e6]">
            <span>Ver detalhe</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (!href) {
    return cardContent;
  }

  return (
    <Link href={href} className="block h-full">
      {cardContent}
    </Link>
  );
}
