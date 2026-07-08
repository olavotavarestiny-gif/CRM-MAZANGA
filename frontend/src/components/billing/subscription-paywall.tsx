'use client';

import { LockKeyhole, LogOut } from 'lucide-react';
import type { User } from '@/lib/api';
import type { PlanName } from '@/lib/api';
import type { WorkspaceMode } from '@/lib/business-modes';
import { Button } from '@/components/ui/button';
import KukuGestLogo from '@/components/KukuGestLogo';
import SubscriptionCheckout from './subscription-checkout';

/**
 * Paywall total (não dismissível): mostrado quando a conta está suspensa.
 * O cliente só avança depois de pagar.
 */
export default function SubscriptionPaywall({ user }: { user: User }) {
  const workspaceMode = (user.workspaceMode as WorkspaceMode) || 'servicos';
  const currentPlan = (user.plan as PlanName) || 'essencial';
  const message =
    user.subscription?.message ||
    (user.subscription?.billingType === 'trial'
      ? 'O seu período de teste terminou. Escolha um pacote para continuar.'
      : 'O seu pacote expirou. Renove para continuar.');

  return (
    <div className="min-h-screen overflow-y-auto bg-[#f5f7f9]">
      <div className="mx-auto max-w-5xl px-4 py-8 md:py-12">
        <div className="mb-8 flex items-center justify-between">
          <KukuGestLogo height={28} />
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => { window.location.href = '/auth/signout'; }}
          >
            <LogOut className="h-4 w-4" />
            Terminar sessão
          </Button>
        </div>

        <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-full bg-white p-2 text-amber-600">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-bold text-[#0A2540]">Acesso bloqueado</p>
              <p className="mt-1 text-sm text-amber-900">{message}</p>
            </div>
          </div>
        </div>

        <div className="mb-6 text-center">
          <h1 className="text-2xl font-black tracking-tight text-[#0A2540] md:text-3xl">
            Escolha o seu pacote para continuar
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Pague com Multicaixa Express e a sua conta é ativada de imediato.
          </p>
        </div>

        <SubscriptionCheckout
          workspaceMode={workspaceMode}
          currentPlan={currentPlan}
          onPaid={() => window.location.reload()}
        />
      </div>
    </div>
  );
}
