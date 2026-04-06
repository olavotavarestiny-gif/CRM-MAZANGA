'use client';

import {
  Dialog, DialogContent,
} from '@/components/ui/dialog';
import { GUIDE_SECTIONS } from './user-guide';

interface Props {
  open: boolean;
  onClose: () => void;
  onStartTour: () => void;
}

export default function WelcomeModal({ open, onClose, onStartTour }: Props) {
  const highlights = GUIDE_SECTIONS.filter(s => s.highlight);

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md p-0 gap-0 bg-white overflow-hidden">
        {/* Hero */}
        <div className="bg-[var(--workspace-primary)] px-8 py-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-black text-xl" style={{ fontFamily: "'Montserrat', sans-serif" }}>K</span>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Bem-vindo ao KukuGest</h2>
          <p className="text-sm text-white/70 leading-relaxed">
            A sua plataforma de CRM e gestão de negócio.<br />
            Aqui está um resumo do que pode fazer.
          </p>
        </div>

        {/* Highlights grid */}
        <div className="p-6">
          <div className="grid grid-cols-2 gap-3 mb-6">
            {highlights.map(section => {
              const Icon = section.icon;
              return (
                <div
                  key={section.id}
                  className="flex items-start gap-3 p-3 rounded-xl bg-[#f8fafc] border border-gray-100"
                >
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--workspace-primary-soft)]">
                    <Icon className="h-4 w-4 text-[var(--workspace-primary)]" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[var(--workspace-primary)]">{section.title}</p>
                    <p className="text-[11px] text-[#6b7e9a] leading-snug mt-0.5 line-clamp-2">
                      {section.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-2">
            <button
              onClick={onClose}
              className="w-full rounded-lg bg-[var(--workspace-primary)] py-2.5 text-sm font-medium text-[var(--workspace-on-primary)] transition-colors hover:bg-[var(--workspace-primary-hover)]"
            >
              Começar a usar →
            </button>
            <button
              onClick={onStartTour}
              className="w-full rounded-lg border border-[var(--workspace-primary-border)] py-2.5 text-sm font-medium text-[var(--workspace-primary)] transition-colors hover:bg-[var(--workspace-primary-soft)]"
            >
              Abrir guia de início →
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
