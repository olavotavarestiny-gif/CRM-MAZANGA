'use client';

import { X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { UsageBar } from '@/components/common/usage-bar';

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
  const planLabel = plan === 'enterprise' ? 'Enterprise' : plan === 'profissional' ? 'Profissional' : 'Essencial';

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
          {plan === 'essencial' && ' Faz upgrade para o Profissional para aumentares os teus limites.'}
        </p>

        <div className="mb-6">
          <UsageBar label={featureLabel} current={current} limit={limit} />
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Fechar
          </Button>
          {plan === 'essencial' && (
            <Button
              className="flex-1 bg-[#0A2540] hover:bg-[#0A2540]/90 text-white"
              onClick={() => { onClose(); router.push('/planos'); }}
            >
              Ver Planos →
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
