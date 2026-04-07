'use client';

import { useMemo } from 'react';
import type { PlanName } from '@/lib/api';
import type { WorkspaceMode } from '@/lib/business-modes';
import PricingCard from '@/components/billing/PricingCard';
import {
  buildWhatsAppPlanLink,
  getPricingButtonText,
  getPricingCatalog,
  getPricingTierStatusLabel,
  mapPlanNameToPricingTier,
  type PricingSource,
  type PricingTier,
} from '@/lib/plan-utils';

export type PricingCardsGridProps = {
  workspaceMode: WorkspaceMode;
  currentPlan?: PlanName | null;
  name?: string | null;
  company?: string | null;
  source?: PricingSource;
};

function getCardHref({
  tier,
  currentPlan,
  workspaceMode,
  source,
  name,
  company,
}: {
  tier: PricingTier;
  currentPlan?: PlanName | null;
  workspaceMode: WorkspaceMode;
  source: PricingSource;
  name?: string | null;
  company?: string | null;
}) {
  const currentTier = currentPlan ? mapPlanNameToPricingTier(currentPlan) : null;

  if (currentTier === tier.key) {
    return undefined;
  }

  return buildWhatsAppPlanLink({
    plan: tier.internalPlan,
    visualPlanLabel: tier.name,
    workspaceMode,
    source,
    name,
    company,
  });
}

export default function PricingCardsGrid({
  workspaceMode,
  currentPlan,
  name,
  company,
  source = 'crm',
}: PricingCardsGridProps) {
  const plans = useMemo(() => getPricingCatalog(workspaceMode), [workspaceMode]);
  const currentTier = currentPlan ? mapPlanNameToPricingTier(currentPlan) : null;

  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {plans.map((plan) => {
        const statusLabel = getPricingTierStatusLabel(currentPlan, plan.key);
        return (
          <PricingCard
            key={`${workspaceMode}-${plan.key}`}
            name={plan.name}
            price={plan.price}
            description={plan.description}
            features={plan.features}
            highlight={plan.highlight}
            badge={plan.badge}
            emphasize={plan.emphasize}
            isCurrent={currentTier === plan.key}
            isRecommended={statusLabel === 'Recomendado para si' || statusLabel === 'Próximo passo'}
            statusLabel={statusLabel}
            buttonText={getPricingButtonText(plan, source, currentPlan)}
            buttonHref={getCardHref({
              tier: plan,
              currentPlan,
              workspaceMode,
              source,
              name,
              company,
            })}
            buttonVariant={currentTier === plan.key ? 'secondary' : plan.highlight ? 'default' : 'outline'}
            disabled={currentTier === plan.key}
          />
        );
      })}
    </div>
  );
}
