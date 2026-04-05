'use client';

import { LucideIcon, Inbox, SearchX, ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

type EmptyVariant = 'empty' | 'no-results' | 'no-permission';

interface EmptyStateAction {
  label: string;
  onClick?: () => void;
  href?: string;
}

interface EmptyStateProps {
  /** Variant controls default icon + messaging tone */
  variant?: EmptyVariant;
  /** Override the default icon for the chosen variant */
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** Primary CTA button */
  action?: EmptyStateAction;
  /** Secondary / destructive-style link */
  secondaryAction?: EmptyStateAction;
  /** Reduces padding for use inside cards/panels */
  compact?: boolean;
  className?: string;
}

const VARIANT_DEFAULTS: Record<EmptyVariant, { Icon: LucideIcon; iconClass: string }> = {
  empty:         { Icon: Inbox,    iconClass: 'text-slate-300' },
  'no-results':  { Icon: SearchX,  iconClass: 'text-slate-300' },
  'no-permission': { Icon: ShieldOff, iconClass: 'text-amber-300' },
};

export function EmptyState({
  variant = 'empty',
  icon: IconOverride,
  title,
  description,
  action,
  secondaryAction,
  compact = false,
  className = '',
}: EmptyStateProps) {
  const { Icon: DefaultIcon, iconClass } = VARIANT_DEFAULTS[variant];
  const Icon = IconOverride ?? DefaultIcon;

  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${compact ? 'py-8 px-4' : 'py-16 px-6'} ${className}`}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 border border-slate-100">
        <Icon className={`h-7 w-7 ${iconClass}`} />
      </div>

      <h3 className="text-sm font-semibold text-[#0A2540]">{title}</h3>

      {description && (
        <p className="mt-1.5 max-w-xs text-sm text-[#6b7e9a]">{description}</p>
      )}

      {(action || secondaryAction) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {action && (
            action.href ? (
              <Button asChild size="sm">
                <a href={action.href}>{action.label}</a>
              </Button>
            ) : (
              <Button size="sm" onClick={action.onClick}>
                {action.label}
              </Button>
            )
          )}
          {secondaryAction && (
            secondaryAction.href ? (
              <Button asChild variant="outline" size="sm">
                <a href={secondaryAction.href}>{secondaryAction.label}</a>
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={secondaryAction.onClick}>
                {secondaryAction.label}
              </Button>
            )
          )}
        </div>
      )}
    </div>
  );
}
