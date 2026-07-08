'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, CheckCircle2 } from 'lucide-react';
import {
  createSubscriptionCharge,
  getSubscriptionPricing,
  type BillingCycle,
  type PlanName,
} from '@/lib/api';
import type { WorkspaceMode } from '@/lib/business-modes';
import { formatKz, getPricingCatalog } from '@/lib/plan-utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast-provider';
import { cn } from '@/lib/utils';

const EXPRESS_LOGO = '/assets/express%20logo.png';

export default function SubscriptionCheckout({
  workspaceMode,
  currentPlan,
  onPaid,
}: {
  workspaceMode: WorkspaceMode;
  currentPlan?: PlanName | null;
  onPaid?: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [cycle, setCycle] = useState<BillingCycle>('monthly');
  const [phone, setPhone] = useState('');
  const [activePlan, setActivePlan] = useState<PlanName | null>(null);
  const [processing, setProcessing] = useState(false);

  const pricingQuery = useQuery({
    queryKey: ['subscription-pricing'],
    queryFn: getSubscriptionPricing,
    staleTime: 5 * 60_000,
  });

  const tiers = getPricingCatalog(workspaceMode);
  const pricing = pricingQuery.data;

  // Poupança anual média (a partir do plano em destaque, ou do primeiro)
  const savingsPct = (() => {
    if (!pricing) return 0;
    const ref = tiers.find((t) => t.highlight) || tiers[0];
    const p = ref ? pricing.plans?.[ref.internalPlan] : null;
    if (!p || !p.monthly || !p.annual) return 0;
    return Math.round((1 - p.annual / (p.monthly * 12)) * 100);
  })();

  async function payWithExpress(plan: PlanName) {
    const normalizedPhone = phone.replace(/\D/g, '');
    if (normalizedPhone.length < 9) {
      toast({ variant: 'error', title: 'Telemóvel inválido', description: 'Introduza um número Multicaixa Express válido.' });
      return;
    }
    setProcessing(true);
    try {
      const result = await createSubscriptionCharge({ plan, cycle, method: 'GPO', phoneNumber: normalizedPhone });
      if (result.status === 'paid') {
        toast({ variant: 'success', title: 'Pagamento confirmado', description: 'A sua subscrição foi ativada. Bom trabalho!' });
        setActivePlan(null);
        queryClient.invalidateQueries({ queryKey: ['currentUser'] });
        onPaid?.();
      } else {
        toast({ variant: 'error', title: 'Pagamento não concluído', description: result.message || 'Não foi possível confirmar o pagamento. Tente novamente.' });
      }
    } catch (error: any) {
      toast({ variant: 'error', title: 'Falha no pagamento', description: error?.response?.data?.message || error?.message || 'Tente novamente.' });
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Toggle mensal / anual */}
      <div className="flex justify-center">
        <div className="inline-flex items-center rounded-full border border-slate-200 bg-white p-1 shadow-sm">
          {(['monthly', 'annual'] as BillingCycle[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCycle(c)}
              className={cn(
                'flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold transition-all',
                cycle === c ? 'bg-[var(--workspace-primary)] text-[var(--workspace-on-primary)] shadow-sm' : 'text-slate-500 hover:text-slate-800'
              )}
            >
              {c === 'monthly' ? 'Mensal' : 'Anual'}
              {c === 'annual' && savingsPct > 0 && (
                <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', cycle === 'annual' ? 'bg-white/20 text-[var(--workspace-on-primary)]' : 'bg-emerald-100 text-emerald-700')}>
                  -{savingsPct}%
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Cards */}
      <div className="grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-3">
        {tiers.map((tier) => {
          const plan = tier.internalPlan;
          const prices = pricing?.plans?.[plan];
          const amount = prices ? prices[cycle] : 0;
          const monthlyEquivalent = cycle === 'annual' && amount ? Math.round(amount / 12) : null;
          const isCurrent = currentPlan === plan;
          const isActive = activePlan === plan;
          const highlight = !!tier.highlight;

          return (
            <Card
              key={plan}
              className={cn(
                'relative flex h-full flex-col overflow-hidden rounded-[28px] border bg-white p-7 text-[#0A2540] shadow-[0_20px_60px_-42px_rgba(15,23,42,0.35)] transition-all',
                highlight && 'border-[var(--workspace-primary)] shadow-[0_28px_70px_-42px_rgba(15,23,42,0.45)]',
                isCurrent && 'ring-2 ring-[var(--workspace-primary)]/25'
              )}
            >
              <div className={cn('absolute inset-x-0 top-0 h-1', highlight ? 'bg-[var(--workspace-primary)]' : 'bg-slate-200')} />

              {/* Cabeçalho */}
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-black tracking-tight">{tier.name}</h3>
                {tier.badge && (
                  <Badge className="border-transparent bg-[var(--workspace-primary)] text-[var(--workspace-on-primary)]">{tier.badge}</Badge>
                )}
                {isCurrent && (
                  <Badge variant="secondary" className="border-[var(--workspace-primary-border)] bg-[var(--workspace-primary-soft)] text-[var(--workspace-primary)]">Plano atual</Badge>
                )}
              </div>
              <p className="mt-2 text-sm leading-6 text-[#5f728e]">{tier.description}</p>

              {/* Preço */}
              <div className="mt-6">
                {pricingQuery.isLoading ? (
                  <div className="h-9 w-32 animate-pulse rounded-md bg-slate-100" />
                ) : (
                  <>
                    <div className="flex items-end gap-1.5">
                      <span className="text-3xl font-black tracking-tight">{formatKz(amount)}</span>
                      <span className="pb-1 text-sm font-medium text-[#6b7e9a]">{cycle === 'monthly' ? '/mês' : '/ano'}</span>
                    </div>
                    {monthlyEquivalent && (
                      <p className="mt-1 text-xs text-emerald-600">≈ {formatKz(monthlyEquivalent)}/mês — poupa {savingsPct}%</p>
                    )}
                  </>
                )}
              </div>

              {/* Features */}
              <ul className="mt-6 flex-1 space-y-3">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm text-[#425466]">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--workspace-primary)]" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {/* Ação de pagamento */}
              <div className="mt-7">
                {isActive ? (
                  <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                    <div className="flex items-center justify-center gap-2">
                      <img src={EXPRESS_LOGO} alt="Multicaixa Express" className="h-6 w-auto" />
                      <span className="text-sm font-semibold text-slate-700">Multicaixa Express</span>
                    </div>
                    <Input
                      type="tel"
                      inputMode="numeric"
                      placeholder="Telemóvel (9XX XXX XXX)"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      disabled={processing}
                      className="bg-white text-center"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button className="flex-1" onClick={() => payWithExpress(plan)} disabled={processing}>
                        {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : `Pagar ${formatKz(amount)}`}
                      </Button>
                      <Button variant="outline" onClick={() => setActivePlan(null)} disabled={processing}>Cancelar</Button>
                    </div>
                    <p className="text-center text-[11px] leading-4 text-slate-400">Vai receber um pedido no telemóvel para aprovar o pagamento.</p>
                  </div>
                ) : (
                  <Button
                    className="h-11 w-full gap-2.5"
                    variant={highlight ? 'default' : 'outline'}
                    onClick={() => { setActivePlan(plan); setPhone(''); }}
                    disabled={processing}
                  >
                    <img src={EXPRESS_LOGO} alt="" className="h-5 w-auto" />
                    <span className="font-semibold">Pagar com Multicaixa Express</span>
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <p className="text-center text-xs text-slate-400">
        Pagamento seguro via Multicaixa Express · ativação imediata após aprovação
      </p>
    </div>
  );
}
