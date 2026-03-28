'use client';

import Link from 'next/link';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  secondaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  compact?: boolean;
}

export function ErrorState({
  title = 'Algo correu mal',
  message,
  onRetry,
  retryLabel = 'Tentar novamente',
  secondaryAction,
  compact = false,
}: ErrorStateProps) {
  const content = (
    <div className={`rounded-3xl border border-red-200 bg-red-50 ${compact ? 'p-4' : 'p-6'} text-center`}>
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white">
        <AlertCircle className="h-7 w-7 text-red-500" />
      </div>
      <h2 className="text-base font-semibold text-[#0A2540]">{title}</h2>
      <p className="mt-2 text-sm text-[#64748B]">{message}</p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {onRetry && (
          <Button onClick={onRetry} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            {retryLabel}
          </Button>
        )}
        {secondaryAction?.href ? (
          <Button asChild variant="outline">
            <Link href={secondaryAction.href}>{secondaryAction.label}</Link>
          </Button>
        ) : secondaryAction?.onClick ? (
          <Button variant="outline" onClick={secondaryAction.onClick}>
            {secondaryAction.label}
          </Button>
        ) : null}
      </div>
    </div>
  );

  return compact ? content : <div className="px-0">{content}</div>;
}
