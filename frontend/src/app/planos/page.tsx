'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCurrentUser } from '@/lib/api';
import type { PlanName } from '@/lib/api';
import { PlanComparisonGrid } from '@/components/plans/plan-comparison-grid';
import { getSortedPlanEntries } from '@/lib/plan-utils';

export default function PlanosPage() {
  const { data: currentUser, isLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });
  const currentPlan = (currentUser?.plan || 'essencial') as PlanName;
  const planEntries = getSortedPlanEntries(currentUser?.availablePlans);
  const [selectedBilling, setSelectedBilling] = useState<Record<PlanName, string>>({
    essencial: 'Mensal',
    profissional: '6 meses',
    enterprise: 'Personalizado',
  });

  if (isLoading) {
    return <div className="mx-auto max-w-6xl p-6" />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-[#2c2f31]">Planos</h1>
        <p className="mt-1 text-sm text-gray-500">
          Compara os planos disponíveis e fala connosco no WhatsApp para ativação manual.
        </p>
      </div>

      <PlanComparisonGrid
        planEntries={planEntries}
        currentPlan={currentPlan}
        selectedBilling={selectedBilling}
        onBillingChange={(plan, billing) =>
          setSelectedBilling((prev) => ({ ...prev, [plan]: billing }))
        }
        name={currentUser?.name}
        company={currentUser?.accountOwnerName || null}
      />
    </div>
  );
}
