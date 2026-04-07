'use client';

import { X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { UsageBar } from '@/components/common/usage-bar';
import { buildWhatsAppPlanLink, getPlanLimitModalCopy, getPricingTierLabel, getUpgradeTargetPlan } from '@/lib/plan-utils';

interface PlanLimitModalProps {
  feature: string;
  featureLabel: string;
  current: number;
  limit: number;
  plan: string;
  onClose: () => void;
}

export function PlanLimitModal({ feature, featureLabel, current, limit, plan, onClose }: PlanLimitModalProps) {
  const router = useRouter();
  const planLabel = getPricingTierLabel(plan as any);
  const modalCopy = getPlanLimitModalCopy({ featureLabel, plan });
  const upgradePlan = getUpgradeTargetPlan(plan as any);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h2 className="text-[#0A2540] font-semibold text-lg">Limite Atingido</h2>
              <p className="text-[#6b7e9a] text-sm">Plano {planLabel}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#6b7e9a] hover:text-[#0A2540] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-[#374151] text-sm mb-4">
          Atingiste o limite de <strong>{limit} {featureLabel}</strong> do plano{' '}
          <strong>{planLabel}</strong>.
        </p>

        <div className="mb-4 rounded-xl border border-[var(--workspace-primary-border)] bg-[var(--workspace-primary-soft)] px-4 py-3 text-sm text-[var(--workspace-primary)]">
          <p className="font-semibold">{modalCopy.title}</p>
          <p className="mt-1">{modalCopy.description}</p>
        </div>

        <div className="mb-6">
          <UsageBar label={featureLabel} current={current} limit={limit} />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Fechar
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              onClose();
              router.push('/planos');
            }}
          >
            Ver planos
          </Button>
          <Button
            className="flex-1 bg-[var(--workspace-primary)] text-[var(--workspace-on-primary)] hover:bg-[var(--workspace-primary-hover)]"
            onClick={() => {
              onClose();
              window.open(
                buildWhatsAppPlanLink({
                  plan: upgradePlan,
                  visualPlanLabel: getPricingTierLabel(upgradePlan),
                  source: 'blocked-feature',
                  note: `${modalCopy.description} Limite atual: ${feature}.`,
                }),
                '_blank',
                'noopener,noreferrer'
              );
            }}
          >
            {modalCopy.ctaLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
