'use client';

import { useState } from 'react';
import type { PlanName } from '@/lib/api';
import type { WorkspaceMode } from '@/lib/business-modes';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import PricingCardsGrid from '@/components/billing/PricingCardsGrid';
import {
  buildWhatsAppPlanLink,
  getWorkspaceLabel,
  type PricingSource,
} from '@/lib/plan-utils';

type PricingSectionProps = {
  initialWorkspaceMode?: WorkspaceMode;
  allowWorkspaceToggle?: boolean;
  currentPlan?: PlanName | null;
  name?: string | null;
  company?: string | null;
  source?: PricingSource;
  title?: string;
  subtitle?: string;
  showFooter?: boolean;
};
export { default as PricingCardsGrid } from '@/components/billing/PricingCardsGrid';

export default function PricingSection({
  initialWorkspaceMode = 'servicos',
  allowWorkspaceToggle = true,
  currentPlan,
  name,
  company,
  source = 'landing',
  title = 'Planos simples para cada tipo de negócio',
  subtitle = 'Escolha o plano ideal para a fase do seu negócio e comece a gerir melhor com o KukuGest.',
  showFooter = true,
}: PricingSectionProps) {
  const [selectedWorkspace, setSelectedWorkspace] = useState<WorkspaceMode>(initialWorkspaceMode);
  const workspaceMode = allowWorkspaceToggle ? selectedWorkspace : initialWorkspaceMode;
  const workspaceClass = workspaceMode === 'comercio' ? 'workspace-comercio' : 'workspace-servicos';

  return (
    <section className={workspaceClass}>
      <div className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-16">
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="secondary" className="border-[var(--workspace-primary-border)] bg-[var(--workspace-primary-soft)] text-[var(--workspace-primary)]">
            Pricing KukuGest
          </Badge>
          <h2 className="mt-4 text-3xl font-black tracking-tight text-[#0A2540] md:text-5xl">{title}</h2>
          <p className="mt-4 text-base leading-7 text-[#6b7e9a] md:text-lg">{subtitle}</p>
        </div>

        {allowWorkspaceToggle ? (
          <div className="mt-8 flex justify-center">
            <div className="inline-flex rounded-full border border-[var(--workspace-primary-border)] bg-white p-1 shadow-sm">
              {(['servicos', 'comercio'] as const).map((mode) => {
                const active = workspaceMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSelectedWorkspace(mode)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                      active
                        ? 'bg-[var(--workspace-primary)] text-[var(--workspace-on-primary)]'
                        : 'text-[#6b7e9a] hover:text-[var(--workspace-primary)]'
                    }`}
                  >
                    {getWorkspaceLabel(mode)}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="mt-10">
          <PricingCardsGrid
            workspaceMode={workspaceMode}
            currentPlan={currentPlan}
            name={name}
            company={company}
            source={source}
          />
        </div>

        {showFooter ? (
          <div className="mt-10 rounded-3xl border border-[var(--workspace-primary-border)] bg-[var(--workspace-primary-soft)] px-6 py-6 text-center">
            <p className="text-sm font-medium text-[var(--workspace-primary)]">
              Todos os planos incluem faturação completa. Mensagens em massa chegam em breve no plano Pro.
            </p>
            <p className="mt-2 text-sm text-[#425466]">Precisa de algo personalizado? Fale connosco.</p>
            <div className="mt-5 flex justify-center">
              <Button asChild>
                <a
                  href={buildWhatsAppPlanLink({
                    visualPlanLabel: 'Personalizado',
                    workspaceMode,
                    source,
                    name,
                    company,
                    note: 'Preciso de uma proposta personalizada.',
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Falar com a equipa
                </a>
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
