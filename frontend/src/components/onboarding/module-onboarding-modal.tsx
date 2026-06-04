'use client';

import { Check } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import type { ModuleIntroContent } from '@/lib/module-onboarding';

interface Props {
  content: ModuleIntroContent | null;
  open: boolean;
  onClose: () => void;
}

export default function ModuleOnboardingModal({ content, open, onClose }: Props) {
  if (!content) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md p-0 gap-0 bg-white overflow-hidden">
        {/* Hero */}
        <div
          className="px-8 py-7 text-center"
          style={{ background: 'linear-gradient(135deg, var(--workspace-primary) 0%, var(--workspace-primary-hover) 100%)' }}
        >
          <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center mx-auto mb-3">
            <span className="text-white font-black text-lg" style={{ fontFamily: "'Montserrat', sans-serif" }}>K</span>
          </div>
          <h2 className="text-lg font-bold text-white mb-1">{content.title}</h2>
          <p className="text-sm text-white/75 leading-relaxed">{content.intro}</p>
        </div>

        {/* Bullets */}
        <div className="p-6">
          <ul className="space-y-3 mb-6">
            {content.bullets.map((b) => (
              <li key={b} className="flex items-start gap-3">
                <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[var(--workspace-primary-soft)]">
                  <Check className="h-3.5 w-3.5 text-[var(--workspace-primary)]" strokeWidth={2.5} />
                </div>
                <p className="text-[13px] text-slate-600 leading-snug pt-0.5">{b}</p>
              </li>
            ))}
          </ul>

          <button
            onClick={onClose}
            className="w-full rounded-lg bg-[var(--workspace-primary)] py-2.5 text-sm font-medium text-[var(--workspace-on-primary)] transition-colors hover:bg-[var(--workspace-primary-hover)]"
          >
            Percebi 👍
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
