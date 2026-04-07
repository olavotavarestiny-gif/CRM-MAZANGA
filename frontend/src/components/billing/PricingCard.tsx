'use client';

import { CheckCircle2, Clock3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type PricingCardProps = {
  name: string;
  price: string;
  description: string;
  features: string[];
  highlight?: boolean;
  badge?: string;
  buttonText: string;
  statusLabel?: string;
  buttonHref?: string;
  buttonVariant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive';
  disabled?: boolean;
  emphasize?: boolean;
  className?: string;
  isCurrent?: boolean;
  isRecommended?: boolean;
};

function splitFeatureMeta(feature: string) {
  if (feature.toLowerCase().includes('(em breve)')) {
    return {
      label: feature.replace(/\s*\(Em breve\)\s*/i, '').trim(),
      isSoon: true,
    };
  }

  return {
    label: feature,
    isSoon: false,
  };
}

export default function PricingCard({
  name,
  price,
  description,
  features,
  highlight = false,
  badge,
  buttonText,
  statusLabel,
  buttonHref,
  buttonVariant = 'default',
  disabled = false,
  emphasize = false,
  className,
  isCurrent = false,
  isRecommended = false,
}: PricingCardProps) {
  const isExternal = !!buttonHref && buttonHref.startsWith('http');
  const isPremium = emphasize;

  return (
    <Card
      className={cn(
        'relative flex h-full flex-col overflow-hidden rounded-[28px] border bg-white p-7 text-[#0A2540] shadow-[0_20px_60px_-42px_rgba(15,23,42,0.35)] transition-all md:p-8',
        highlight && 'border-[var(--workspace-primary)] shadow-[0_28px_70px_-42px_rgba(15,23,42,0.4)]',
        isPremium && 'border-slate-900 shadow-[0_30px_90px_-48px_rgba(15,23,42,0.55)]',
        isCurrent && 'ring-2 ring-[var(--workspace-primary)]/20',
        className
      )}
    >
      <div
        className={cn(
          'absolute inset-x-0 top-0 h-1 bg-[var(--workspace-primary)]',
          isPremium && 'bg-gradient-to-r from-slate-900 via-[var(--workspace-primary)] to-slate-900'
        )}
      />

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-2xl font-black tracking-tight text-[#0A2540]">{name}</h3>
            {badge ? (
              <Badge className="border-transparent bg-[var(--workspace-primary)] text-[var(--workspace-on-primary)]">
                {badge}
              </Badge>
            ) : null}
            {statusLabel ? (
              <Badge
                variant={isCurrent ? 'default' : 'secondary'}
                className={cn(
                  'border-[var(--workspace-primary-border)] bg-[var(--workspace-primary-soft)] text-[var(--workspace-primary)]',
                  isCurrent && 'border-transparent bg-[var(--workspace-primary)] text-[var(--workspace-on-primary)]',
                  isRecommended && !isCurrent && 'font-semibold'
                )}
              >
                {statusLabel}
              </Badge>
            ) : null}
          </div>
          <p className="max-w-sm text-sm leading-6 text-[#5f728e]">{description}</p>
        </div>
      </div>

      <div className="mt-8 flex items-end gap-2">
        <span className="text-4xl font-black tracking-tight text-[#0A2540]">{price}</span>
        <span className="pb-1 text-sm font-medium text-[#6b7e9a]">/mês</span>
      </div>

      <div className="mt-8 flex-1">
        <ul className="space-y-3.5">
          {features.map((feature) => {
            const meta = splitFeatureMeta(feature);
            return (
              <li key={feature} className="flex items-start gap-3 text-sm text-[#425466]">
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--workspace-primary)]" />
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span>{meta.label}</span>
                  {meta.isSoon ? (
                    <Badge variant="secondary" className="border-amber-200 bg-amber-50 text-amber-700">
                      <Clock3 className="mr-1 h-3 w-3" />
                      Em breve
                    </Badge>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-8">
        {buttonHref ? (
          <Button asChild className="w-full" variant={buttonVariant}>
            <a
              href={buttonHref}
              target={isExternal ? '_blank' : undefined}
              rel={isExternal ? 'noopener noreferrer' : undefined}
            >
              {buttonText}
            </a>
          </Button>
        ) : (
          <Button className="w-full" variant={buttonVariant} disabled={disabled}>
            {buttonText}
          </Button>
        )}
      </div>
    </Card>
  );
}
