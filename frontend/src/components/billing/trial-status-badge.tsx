'use client';

import { Clock3 } from 'lucide-react';
import type { SubscriptionAccess } from '@/lib/api';
import { cn } from '@/lib/utils';

function getTrialLabel(daysUntilExpiry: number) {
  if (daysUntilExpiry === 0) return 'Teste · termina hoje';
  if (daysUntilExpiry === 1) return 'Teste · 1 dia';
  return `Teste · ${daysUntilExpiry} dias`;
}

export default function TrialStatusBadge({
  subscription,
  compact = false,
  className = '',
}: {
  subscription?: SubscriptionAccess | null;
  compact?: boolean;
  className?: string;
}) {
  const daysUntilExpiry = subscription?.daysUntilExpiry;

  if (
    subscription?.billingType !== 'trial' ||
    subscription.accountStatus !== 'active' ||
    typeof daysUntilExpiry !== 'number' ||
    daysUntilExpiry < 0
  ) {
    return null;
  }

  const label = getTrialLabel(daysUntilExpiry);

  return (
    <span
      title={subscription.trialEndsAt ? `Termina em ${new Date(subscription.trialEndsAt).toLocaleDateString('pt-PT')}` : label}
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-full border border-amber-200 bg-amber-50 text-amber-900 shadow-sm',
        compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]',
        className
      )}
    >
      <Clock3 className={cn('flex-shrink-0 text-amber-600', compact ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
      <span className="truncate font-semibold leading-none">{label}</span>
    </span>
  );
}
