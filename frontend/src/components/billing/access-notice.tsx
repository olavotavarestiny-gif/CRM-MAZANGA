'use client';

import Link from 'next/link';
import { AlertTriangle, LockKeyhole } from 'lucide-react';
import type { SubscriptionAccess } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export function BillingAccessBanner({ subscription }: { subscription?: SubscriptionAccess | null }) {
  if (!subscription?.message || (!subscription.showExpiryWarning && subscription.accountStatus !== 'grace_period')) {
    return null;
  }

  return (
    <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
        <div className="flex-1">
          <p className="font-semibold">{subscription.accountStatus === 'grace_period' ? 'Pacote expirado' : 'Renovação próxima'}</p>
          <p className="mt-0.5 text-amber-800">{subscription.message}</p>
        </div>
        <Button asChild size="sm" variant="outline" className="border-amber-300 bg-white text-amber-900 hover:bg-amber-100">
          <Link href="/planos">Renovar</Link>
        </Button>
      </div>
    </div>
  );
}

export function BillingSuspendedModal({ subscription }: { subscription?: SubscriptionAccess | null }) {
  const suspended = subscription?.accountStatus === 'suspended';
  return (
    <Dialog open={suspended}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#2c2f31]">
            <LockKeyhole className="h-5 w-5 text-amber-600" />
            Acesso em modo leitura
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm leading-relaxed text-slate-600">
          {subscription?.message || 'Seu pacote expirou. Renove para continuar.'}
        </p>
        <div className="flex justify-end">
          <Button asChild>
            <Link href="/planos">Escolher pacote</Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
