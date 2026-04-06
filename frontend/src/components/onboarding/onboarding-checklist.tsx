'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Banknote,
  Building2,
  CheckCircle2,
  Circle,
  FileOutput,
  FileText,
  Kanban,
  Package,
  ShoppingCart,
  Users,
  UserPlus,
  X,
  CheckSquare,
} from 'lucide-react';
import { dismissOnboarding, getOnboarding } from '@/lib/api';
import type { User } from '@/lib/api';

const STEP_ICONS: Record<string, React.ElementType> = {
  add_contact:    UserPlus,
  setup_store:    Building2,
  setup_pipeline: Kanban,
  create_task:    CheckSquare,
  create_form:    FileText,
  setup_billing:  Building2,
  create_invoice: FileOutput,
  add_product:    Package,
  open_cash:      Banknote,
  first_sale:     ShoppingCart,
  invite_member:  Users,
};

function isEligible(user: User | null | undefined): boolean {
  if (!user) return false;
  return !!(user.isSuperAdmin || user.role === 'admin' || !user.accountOwnerId);
}

interface OnboardingChecklistProps {
  currentUser: User | null | undefined;
}

export default function OnboardingChecklist({ currentUser }: OnboardingChecklistProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showDismissConfirm, setShowDismissConfirm] = useState(false);

  const eligible = isEligible(currentUser);

  const { data } = useQuery({
    queryKey: ['onboarding', currentUser?.workspaceMode],
    queryFn: getOnboarding,
    staleTime: 60_000,
    refetchInterval: 60_000,
    enabled: eligible,
  });

  const dismiss = useMutation({
    mutationFn: dismissOnboarding,
    onSuccess: () => {
      queryClient.setQueryData(['onboarding', currentUser?.workspaceMode], (old: typeof data) =>
        old ? { ...old, show: false, dismissed: true } : old
      );
    },
  });

  if (!eligible) return null;
  if (!data || !data.show) return null;
  if (data.dismissed) return null;
  if (data.allDone) return null;

  const { steps = [], completedCount, totalCount } = data;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="mb-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-sm font-semibold text-[#2c2f31]">Configura a tua conta</p>
            <p className="text-xs text-slate-500">{completedCount} de {totalCount} passos completos</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-3">
          <div className="h-2 w-32 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-[var(--workspace-primary)] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-slate-500">{progress}%</span>

          {!showDismissConfirm && (
            <button
              onClick={() => setShowDismissConfirm(true)}
              className="ml-1 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              aria-label="Dispensar onboarding"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Dismiss confirmation */}
      {showDismissConfirm && (
        <div className="border-b border-amber-100 bg-amber-50 px-5 py-3">
          <p className="text-sm text-amber-800">
            Tens a certeza? Podes encontrar isto em{' '}
            <span className="font-semibold">Ajuda</span>.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => dismiss.mutate()}
              disabled={dismiss.isPending}
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
            >
              Sim, dispensar
            </button>
            <button
              onClick={() => setShowDismissConfirm(false)}
              className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Steps list */}
      <div className="divide-y divide-slate-50 px-5 py-2">
        {steps.map((step, index) => {
          const Icon = STEP_ICONS[step.id] ?? Circle;
          const isNext = !step.completed && steps.slice(0, index).every((s) => s.completed);

          return (
            <div key={step.id} className="flex items-center gap-3 py-2.5">
              {step.completed ? (
                <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-500" />
              ) : isNext ? (
                <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 border-[var(--workspace-primary)]">
                  <div className="h-2 w-2 rounded-full bg-[var(--workspace-primary)]" />
                </div>
              ) : (
                <Circle className="h-5 w-5 flex-shrink-0 text-slate-300" />
              )}

              <Icon
                className={`h-4 w-4 flex-shrink-0 ${
                  step.completed ? 'text-emerald-400' : isNext ? 'text-[var(--workspace-primary)]' : 'text-slate-300'
                }`}
              />

              <span
                className={`flex-1 text-sm ${
                  step.completed
                    ? 'text-slate-400 line-through'
                    : isNext
                    ? 'font-medium text-[#2c2f31]'
                    : 'text-slate-500'
                }`}
              >
                {step.label}
              </span>

              {!step.completed && (
                <button
                  onClick={() => router.push(step.href)}
                  className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                    isNext
                      ? 'bg-[var(--workspace-primary)] text-[var(--workspace-on-primary)] hover:bg-[var(--workspace-primary-hover)]'
                      : 'border border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700'
                  }`}
                >
                  {isNext ? 'Começar' : 'Ir'}
                  <ArrowRight className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
