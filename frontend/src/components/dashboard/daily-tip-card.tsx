'use client';

import { Lightbulb, ShieldCheck, Users, X } from 'lucide-react';
import type { DailyTipDeliveryResponse } from '@/lib/api';
import { cn } from '@/lib/utils';

function getAudienceLabel(bucket?: 'owner' | 'equipa') {
  return bucket === 'owner' ? 'Owner e Admin' : 'Equipa';
}

function getAudienceIcon(bucket?: 'owner' | 'equipa') {
  return bucket === 'owner' ? ShieldCheck : Users;
}

export default function DailyTipCard({
  dailyTip,
  onDismiss,
  dismissing = false,
  className = '',
}: {
  dailyTip?: DailyTipDeliveryResponse | null;
  onDismiss?: () => void;
  dismissing?: boolean;
  className?: string;
}) {
  if (!dailyTip?.tip || dailyTip.visibleInDashboard === false) {
    return null;
  }

  const AudienceIcon = getAudienceIcon(dailyTip.audienceBucket);
  const isServicosWorkspace = dailyTip.workspaceMode === 'servicos';

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-3xl border p-5 text-white shadow-lg md:p-6',
        className
      )}
      style={{
        background: isServicosWorkspace
          ? 'linear-gradient(135deg, #0f4fc3 0%, #1b70d8 100%)'
          : 'linear-gradient(135deg, var(--workspace-primary) 0%, var(--workspace-primary-hover) 100%)',
        borderColor: isServicosWorkspace ? '#8fb7f2' : 'var(--workspace-primary-border)',
      }}
    >
      <Lightbulb className="absolute -right-8 -bottom-8 h-32 w-32 opacity-10" />
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          disabled={dismissing}
          className="absolute right-4 top-4 z-20 rounded-full border border-white/15 bg-black/10 p-2 text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Esconder dica do dia"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}

      <div className="relative z-10 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em]">
            {dailyTip.tip.title}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/10 px-3 py-1 text-[11px] font-medium">
            <AudienceIcon className="h-3.5 w-3.5" />
            {getAudienceLabel(dailyTip.audienceBucket)}
          </span>
        </div>

        <div>
          <h3 className="text-lg font-bold">{dailyTip.tip.heading}</h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/90">
            {dailyTip.tip.personalizedMessage}
          </p>
        </div>
      </div>
    </div>
  );
}
