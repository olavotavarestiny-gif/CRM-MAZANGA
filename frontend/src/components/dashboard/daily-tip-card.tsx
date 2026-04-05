'use client';

import { Lightbulb, ShieldCheck, Users } from 'lucide-react';
import type { DailyTipDeliveryResponse } from '@/lib/api';
import { cn } from '@/lib/utils';

function getAudienceLabel(bucket?: 'owner' | 'equipa') {
  return bucket === 'owner' ? 'Owner e Admin' : 'Equipa';
}

function getAccentClasses(workspaceMode?: 'servicos' | 'comercio') {
  return workspaceMode === 'comercio'
    ? 'from-[#7A2E0B] via-[#B84D0E] to-[#F06A1A]'
    : 'from-[#0A2540] via-[#114A84] to-[#1A6FD4]';
}

function getAudienceIcon(bucket?: 'owner' | 'equipa') {
  return bucket === 'owner' ? ShieldCheck : Users;
}

export default function DailyTipCard({
  dailyTip,
  className = '',
}: {
  dailyTip?: DailyTipDeliveryResponse | null;
  className?: string;
}) {
  if (!dailyTip?.tip) {
    return null;
  }

  const AudienceIcon = getAudienceIcon(dailyTip.audienceBucket);

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-3xl bg-gradient-to-br p-6 text-white shadow-lg',
        getAccentClasses(dailyTip.workspaceMode),
        className
      )}
    >
      <Lightbulb className="absolute -right-8 -bottom-8 h-32 w-32 opacity-10" />

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
