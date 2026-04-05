'use client';

import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastVariant = 'success' | 'error' | 'info';

type ToastItem = {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
  durationMs?: number;
};

type ToastContextValue = {
  toast: (input: Omit<ToastItem, 'id'>) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_STYLES: Record<ToastVariant, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  error: 'border-red-200 bg-red-50 text-red-900',
  info: 'border-slate-200 bg-white text-slate-900',
};

const TOAST_ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
} satisfies Record<ToastVariant, typeof Info>;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const toast = useCallback((input: Omit<ToastItem, 'id'>) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { ...input, id }]);
    window.setTimeout(() => dismiss(id), input.durationMs ?? 4000);
  }, [dismiss]);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div className="pointer-events-none fixed right-4 top-4 z-[90] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((item) => {
          const Icon = TOAST_ICONS[item.variant];
          return (
            <div
              key={item.id}
              className={cn(
                'pointer-events-auto rounded-2xl border px-4 py-3 shadow-lg backdrop-blur-sm',
                TOAST_STYLES[item.variant]
              )}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{item.title}</p>
                  {item.description && (
                    <p className="mt-1 text-xs opacity-80">{item.description}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(item.id)}
                  className="rounded-full p-1 opacity-60 transition hover:bg-black/5 hover:opacity-100"
                  aria-label="Fechar notificação"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}
