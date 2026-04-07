'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { getCurrentUser } from '@/lib/api';
import type { PlanName } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import PricingCardsGrid from '@/components/billing/PricingCardsGrid';
import PlanComparisonList from '@/components/billing/PlanComparisonList';
import {
  buildWhatsAppPlanLink,
  getPlanComparisonItems,
  getPricingTierDetails,
  getUpgradeSummary,
  getUpgradeTargetPlan,
  getWorkspaceLabel,
} from '@/lib/plan-utils';

export default function PlanosPage() {
  const { data: currentUser, isLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });
  const currentPlan = (currentUser?.plan || 'essencial') as PlanName;
  const workspaceMode = currentUser?.workspaceMode || 'servicos';
  const currentTier = getPricingTierDetails(workspaceMode, currentPlan);
  const upgradeSummary = getUpgradeSummary(workspaceMode, currentPlan);
  const comparisonItems = getPlanComparisonItems(workspaceMode);
  const upgradePlan = getUpgradeTargetPlan(currentPlan);
  const isTopPlan = currentPlan === 'enterprise';

  if (isLoading) {
    return <div className="mx-auto max-w-6xl p-6" />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-4 md:p-6">
      <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_30px_80px_-48px_rgba(15,23,42,0.35)]">
        <div className="border-b border-slate-100 px-6 py-6 md:px-8 md:py-7">
          <Badge variant="secondary" className="border-[var(--workspace-primary-border)] bg-[var(--workspace-primary-soft)] text-[var(--workspace-primary)]">
            Planos KukuGest
          </Badge>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-[#0A2540] md:text-4xl">Planos</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5f728e] md:text-base">
            Escolha o plano mais indicado para a fase do seu negócio, perceba o que já tem hoje e veja claramente o que desbloqueia ao fazer upgrade.
          </p>
        </div>

        <div className="grid gap-4 px-6 py-6 md:grid-cols-3 md:px-8">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Plano atual</p>
            <p className="mt-2 text-2xl font-black text-[#0A2540]">{currentTier.name}</p>
            <p className="mt-2 text-sm text-gray-500">{currentTier.description}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Workspace atual</p>
            <p className="mt-2 text-2xl font-black text-[#0A2540]">{getWorkspaceLabel(workspaceMode)}</p>
            <p className="mt-2 text-sm text-gray-500">A comparação abaixo mostra apenas os planos deste workspace.</p>
          </div>
          <div className="rounded-2xl border border-[var(--workspace-primary-border)] bg-[var(--workspace-primary-soft)] px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--workspace-primary)]/70">Estado</p>
            <p className="mt-2 text-2xl font-black text-[var(--workspace-primary)]">Ativo</p>
            <p className="mt-2 text-sm text-[var(--workspace-primary)]">Upgrade manual com apoio da equipa KukuGest.</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#0A2540]">Compare os planos do seu workspace</h2>
          <p className="mt-1 text-sm text-[#6b7e9a]">
            O plano Growth fica em destaque como a evolução mais natural para a maioria das contas.
          </p>
        </div>

        <PricingCardsGrid
          workspaceMode={workspaceMode}
          currentPlan={currentPlan}
          name={currentUser?.name}
          company={currentUser?.accountOwnerName || null}
          source="crm"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <PlanComparisonList items={comparisonItems} />

        <Card className="overflow-hidden rounded-[28px] border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-5">
            <h2 className="text-lg font-bold tracking-tight text-[#0A2540]">O que desbloqueia a seguir</h2>
            <p className="mt-1 text-sm text-[#6b7e9a]">
              Uma leitura curta para perceber rapidamente o valor do próximo passo.
            </p>
          </div>

          <div className="space-y-5 px-6 py-6">
            <div>
              <p className="text-base font-semibold text-[#0A2540]">{upgradeSummary.title}</p>
              <p className="mt-2 text-sm leading-6 text-[#5f728e]">{upgradeSummary.description}</p>
            </div>

            <ul className="space-y-3">
              {upgradeSummary.bullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-3 text-sm text-[#334155]">
                  <span className="mt-1 h-2 w-2 rounded-full bg-[var(--workspace-primary)]" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>

            <div className="rounded-2xl border border-[var(--workspace-primary-border)] bg-[var(--workspace-primary-soft)] px-4 py-4 text-sm text-[var(--workspace-primary)]">
              <p className="font-semibold">Fluxo de upgrade desta fase</p>
              <p className="mt-1">
                O upgrade continua manual nesta etapa, para manter a integração simples enquanto o billing real não é ligado ao CRM.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild className="sm:flex-1">
                <a
                  href={buildWhatsAppPlanLink({
                    plan: upgradePlan,
                    visualPlanLabel: isTopPlan ? currentTier.name : undefined,
                    workspaceMode,
                    source: 'crm',
                    name: currentUser?.name,
                    company: currentUser?.accountOwnerName || null,
                    note: isTopPlan
                      ? 'Quero falar sobre a melhor configuração possível para a minha conta.'
                      : `Quero fazer upgrade para o plano ${getPricingTierDetails(workspaceMode, upgradePlan).name}.`,
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {isTopPlan ? 'Falar com a equipa' : 'Fazer upgrade'}
                </a>
              </Button>

              <Button asChild variant="outline" className="sm:flex-1">
                <Link href="/configuracoes?tab=plano">Ver resumo em Configurações</Link>
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <Card className="border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 p-6 text-sm text-[#5f728e] md:flex-row md:items-center md:justify-between">
          <p>Todos os planos incluem faturação completa. Mensagens em massa aparecem apenas no Pro e continuam marcadas como Em breve.</p>
          <Button asChild variant="outline">
            <a
              href={buildWhatsAppPlanLink({
                workspaceMode,
                source: 'crm',
                name: currentUser?.name,
                company: currentUser?.accountOwnerName || null,
                note: 'Quero ajuda para escolher o melhor plano para a minha operação.',
              })}
              target="_blank"
              rel="noopener noreferrer"
            >
              Falar com a equipa
            </a>
          </Button>
        </div>
      </Card>
    </div>
  );
}
