'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ONBOARDING_TASKS,
  ONBOARDING_KEY,
  ONBOARDING_DISMISSED,
  ONBOARDING_OPEN,
} from '@/lib/onboarding-tasks';

function loadDone(): Set<string> {
  try {
    if (typeof window === 'undefined') return new Set();
    return new Set(JSON.parse(localStorage.getItem(ONBOARDING_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

function saveDone(done: Set<string>) {
  localStorage.setItem(ONBOARDING_KEY, JSON.stringify(Array.from(done)));
}

export default function OnboardingChecklist() {
  const pathname = usePathname();
  const router = useRouter();
  const [done, setDone] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    setMounted(true);
    setDone(loadDone());
    setDismissed(!!localStorage.getItem(ONBOARDING_DISMISSED));
    // Auto-open if flagged (e.g. from WelcomeModal)
    if (localStorage.getItem(ONBOARDING_OPEN) === '1') {
      localStorage.removeItem(ONBOARDING_OPEN);
      setOpen(true);
    }
    // Listen for storage events to open panel (cross-component trigger)
    const onStorage = (e: StorageEvent) => {
      if (e.key === ONBOARDING_OPEN && localStorage.getItem(ONBOARDING_OPEN) === '1') {
        localStorage.removeItem(ONBOARDING_OPEN);
        setDismissed(false);
        setOpen(true);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Auto-complete task when visiting matching route
  useEffect(() => {
    if (!mounted) return;
    const task = ONBOARDING_TASKS.find((t) => t.route === pathname);
    if (!task) return;
    setDone((prev) => {
      if (prev.has(task.id)) return prev;
      const next = new Set(prev);
      next.add(task.id);
      saveDone(next);
      return next;
    });
  }, [pathname, mounted]);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(ONBOARDING_DISMISSED, '1');
    setDismissed(true);
    setOpen(false);
  }, []);

  // Don't render until mounted (avoids SSR hydration mismatch)
  if (!mounted || dismissed) return null;

  const total = ONBOARDING_TASKS.length;
  const completed = done.size;
  const progress = Math.round((completed / total) * 100);
  const allDone = completed === total;

  // Minimised floating button
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-[#0A2540] text-white pl-2.5 pr-4 py-2.5 rounded-full shadow-xl hover:bg-[#0d3060] transition-all text-sm font-semibold"
        aria-label="Abrir guia de início"
      >
        {/* Circular progress ring */}
        <div className="relative w-7 h-7 flex-shrink-0">
          <svg className="w-7 h-7 -rotate-90" viewBox="0 0 28 28">
            <circle cx="14" cy="14" r="11" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2.5" />
            <circle
              cx="14" cy="14" r="11"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeDasharray={`${2 * Math.PI * 11}`}
              strokeDashoffset={`${2 * Math.PI * 11 * (1 - progress / 100)}`}
              strokeLinecap="round"
              className="transition-all duration-500"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">
            {completed}
          </span>
        </div>
        Primeiros Passos
      </button>
    );
  }

  // Expanded panel
  return (
    <div className="fixed bottom-6 right-6 z-50 w-72 bg-white border border-[#dde3ec] rounded-2xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="bg-[#0A2540] px-4 py-3 flex items-center justify-between">
        <span className="text-white font-semibold text-sm">🚀 Primeiros Passos</span>
        <button
          onClick={() => setOpen(false)}
          className="p-0.5 hover:bg-white/10 rounded transition-colors"
          aria-label="Minimizar"
        >
          <X className="w-4 h-4 text-white/70" />
        </button>
      </div>

      {/* Task list */}
      <div className="p-3 space-y-0.5 max-h-72 overflow-y-auto">
        {ONBOARDING_TASKS.map((task) => {
          const isComplete = done.has(task.id);
          const Icon = task.icon;
          return (
            <button
              key={task.id}
              onClick={() => { router.push(task.route); setOpen(false); }}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all',
                isComplete
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'hover:bg-[#f8fafc] text-[#0A2540]'
              )}
            >
              <div className={cn(
                'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0',
                isComplete ? 'bg-emerald-100' : 'bg-[#0A2540]/8'
              )}>
                {isComplete
                  ? <Check className="w-3.5 h-3.5 text-emerald-600" />
                  : <Icon className="w-3.5 h-3.5 text-[#0A2540]" />
                }
              </div>
              <div className="min-w-0">
                <p className={cn('text-xs font-semibold leading-none', isComplete ? 'line-through opacity-70' : '')}>
                  {task.label}
                </p>
                <p className="text-[10px] text-[#6b7e9a] mt-0.5 truncate">{task.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[#dde3ec]">
        {allDone ? (
          <div className="text-center">
            <p className="text-sm font-semibold text-[#0A2540] mb-2">Parabéns! Exploraste tudo 🎉</p>
            <button
              onClick={handleDismiss}
              className="w-full py-2 rounded-lg bg-[#0A2540] text-white text-xs font-medium hover:bg-[#0d3060] transition-colors"
            >
              Fechar guia
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-[#6b7e9a]">Progresso</span>
              <span className="text-xs font-semibold text-[#0A2540]">{completed}/{total}</span>
            </div>
            <div className="h-1.5 bg-[#f0f4f9] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#0A2540] rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <button
              onClick={handleDismiss}
              className="mt-2.5 w-full text-xs text-[#6b7e9a] hover:text-[#0A2540] transition-colors"
            >
              Dispensar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
