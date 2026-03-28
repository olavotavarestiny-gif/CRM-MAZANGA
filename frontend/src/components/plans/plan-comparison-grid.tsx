'use client';

import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PlanCatalogEntry, PlanName } from '@/lib/api';
import {
  PLAN_FEATURE_LABELS,
  buildWhatsAppPlanLink,
  formatLimitValue,
  getPlanBadgeClasses,
  getPlanBillingOptions,
} from '@/lib/plan-utils';

interface PlanComparisonGridProps {
  planEntries: Array<[PlanName, PlanCatalogEntry]>;
  currentPlan: PlanName;
  selectedBilling: Record<PlanName, string>;
  onBillingChange: (plan: PlanName, billing: string) => void;
  name?: string | null;
  company?: string | null;
}

export function PlanComparisonGrid({
  planEntries,
  currentPlan,
  selectedBilling,
  onBillingChange,
  name,
  company,
}: PlanComparisonGridProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      {planEntries.map(([plan, entry]) => {
        const billingOptions = getPlanBillingOptions(plan);
        const selectedOption = selectedBilling[plan] || billingOptions[0];
        const isCurrent = currentPlan === plan;

        return (
          <div key={plan} className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex h-full flex-col p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-[#0A2540]">{entry.label}</h2>
                  <p className="mt-2 text-sm text-gray-500">{entry.description}</p>
                </div>
                <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${getPlanBadgeClasses(plan)}`}>
                  {plan.toUpperCase()}
                </span>
              </div>

              {isCurrent && (
                <div className="mt-4 inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Plano atual
                </div>
              )}

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {[
                  { key: 'users', label: 'Utilizadores' },
                  { key: 'contacts', label: 'Contactos' },
                  { key: 'tasks', label: 'Tarefas' },
                  { key: 'automations', label: 'Automações' },
                ].map(({ key, label }) => (
                  <div key={key} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</p>
                    <p className="mt-2 text-lg font-bold text-[#0A2540]">
                      {formatLimitValue(entry.limits[key as keyof typeof entry.limits])}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-6 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Funcionalidades</p>
                <div className="grid gap-2">
                  {Object.entries(entry.features).map(([feature, enabled]) => (
                    <div key={feature} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <span className="text-sm font-medium text-[#0A2540]">
                        {PLAN_FEATURE_LABELS[feature as keyof typeof PLAN_FEATURE_LABELS]}
                      </span>
                      <span className={`text-xs font-semibold ${enabled ? 'text-emerald-700' : 'text-slate-500'}`}>
                        {enabled ? 'Incluído' : 'Não incluído'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Modalidade</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {billingOptions.map((billing) => (
                    <button
                      key={billing}
                      type="button"
                      onClick={() => onBillingChange(plan, billing)}
                      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                        selectedOption === billing
                          ? 'border-[#0A2540] bg-[#0A2540] text-white'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-[#0A2540]'
                      }`}
                    >
                      {billing}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <Button asChild className="w-full gap-2">
                  <a
                    href={buildWhatsAppPlanLink({
                      plan,
                      billing: selectedOption,
                      name,
                      company,
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Quero este plano
                  </a>
                </Button>
                <p className="mt-2 text-center text-xs text-gray-400">Ativação manual via WhatsApp</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
