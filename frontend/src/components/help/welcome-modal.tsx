'use client';

import {
  BarChart3,
  CheckSquare,
  CreditCard,
  Kanban,
  MessageSquare,
  Package,
  ShoppingCart,
  Users,
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface FeatureItem {
  icon: React.ElementType;
  title: string;
  description: string;
}

const SERVICOS_FEATURES: FeatureItem[] = [
  {
    icon: Users,
    title: 'Contactos',
    description: 'Base de dados de leads e clientes com histórico completo de interacções.',
  },
  {
    icon: Kanban,
    title: 'Processos de Venda',
    description: 'Pipeline visual em Kanban — acompanhe negócios do início ao fecho.',
  },
  {
    icon: CheckSquare,
    title: 'Tarefas',
    description: 'Organize follow-ups, prioridades e datas de entrega da sua equipa.',
  },
  {
    icon: MessageSquare,
    title: 'Conversas',
    description: 'WhatsApp Business e email centralizados numa única caixa de entrada.',
  },
];

const COMERCIO_FEATURES: FeatureItem[] = [
  {
    icon: CreditCard,
    title: 'Caixa',
    description: 'Abra e feche caixa, registe movimentos e controle o saldo em tempo real.',
  },
  {
    icon: ShoppingCart,
    title: 'Venda Rápida',
    description: 'Cobranças ágeis no balcão com emissão de recibo imediata.',
  },
  {
    icon: Package,
    title: 'Produtos',
    description: 'Gerencie o catálogo de produtos, preços e níveis de stock.',
  },
  {
    icon: BarChart3,
    title: 'Relatórios',
    description: 'Desempenho de vendas diário, semanal e mensal num só painel.',
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onStartTour: () => void;
  comercio?: boolean;
}

export default function WelcomeModal({ open, onClose, onStartTour, comercio = false }: Props) {
  const features = comercio ? COMERCIO_FEATURES : SERVICOS_FEATURES;
  const tagline = comercio
    ? 'O seu sistema de ponto de venda e gestão de comércio.'
    : 'A sua plataforma de CRM e gestão comercial.';

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg p-0 gap-0 bg-white overflow-hidden">
        {/* Hero */}
        <div
          className="px-8 py-8 text-center"
          style={{ background: 'linear-gradient(135deg, var(--workspace-primary) 0%, var(--workspace-primary-hover) 100%)' }}
        >
          <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-black text-xl" style={{ fontFamily: "'Montserrat', sans-serif" }}>K</span>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Bem-vindo ao KukuGest</h2>
          <p className="text-sm text-white/75 leading-relaxed">{tagline}</p>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-4">O que pode fazer</p>

          <div className="grid grid-cols-2 gap-3 mb-6">
            {features.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="flex items-start gap-3 p-3 rounded-xl bg-white border border-slate-200"
              >
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--workspace-primary-soft)]">
                  <Icon className="h-4 w-4 text-[var(--workspace-primary)]" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#2c2f31]">{title}</p>
                  <p className="text-[11px] text-slate-500 leading-snug mt-0.5 line-clamp-2">{description}</p>
                </div>
              </div>
            ))}
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
