'use client';

import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';

interface WidgetWrapperProps {
  title: string;
  isLoading?: boolean;
  isEmpty?: boolean;
  error?: boolean;
  onRetry?: () => void;
  children: React.ReactNode;
  className?: string;
}

export default function WidgetWrapper({
  title,
  isLoading = false,
  isEmpty = false,
  error = false,
  onRetry,
  children,
  className = '',
}: WidgetWrapperProps) {
  if (isLoading) {
    return (
      <div className={`rounded-xl border border-slate-200 bg-white p-5 ${className}`}>
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-24 rounded-full bg-slate-200" />
          <div className="h-9 w-32 rounded-full bg-slate-200" />
          <div className="h-3 w-40 rounded-full bg-slate-200" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`rounded-xl border border-slate-200 bg-white p-2 ${className}`}>
        <ErrorState
          compact
          title={`Falha ao carregar ${title.toLowerCase()}`}
          message="Tenta novamente para actualizar este widget."
          onRetry={onRetry}
        />
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className={`rounded-xl border border-slate-200 bg-white ${className}`}>
        <EmptyState
          compact
          variant="empty"
          title="Sem dados disponíveis"
          description={`Ainda não há informação suficiente para ${title.toLowerCase()}.`}
        />
      </div>
    );
  }

  return <>{children}</>;
}
