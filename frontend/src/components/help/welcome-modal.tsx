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
        <div className="bg-[#0A2540] px-8 py-8 text-center">
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
                  <div className="w-8 h-8 rounded-lg bg-[#0A2540]/8 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-[#0A2540]" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#0A2540]">{section.title}</p>
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
              className="w-full py-2.5 rounded-lg bg-[#0A2540] text-white text-sm font-medium hover:bg-[#0A2540]/90 transition-colors"
            >
              Começar a usar →
            </button>
            <button
              onClick={onStartTour}
              className="w-full py-2.5 rounded-lg border border-gray-200 text-[#0A2540] text-sm font-medium hover:bg-[#f8fafc] transition-colors"
            >
              Abrir guia de início →
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
