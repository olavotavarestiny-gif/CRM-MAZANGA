'use client';

import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  BarChart3, Kanban, Users, CheckSquare, CalendarDays,
  MessageSquare, Zap, FileText, DollarSign, Settings, Search,
} from 'lucide-react';

export interface GuideSection {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  highlight?: boolean;
  category?: 'main' | 'gestao' | 'config';
}

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: 'painel',
    icon: BarChart3,
    title: 'Painel',
    description: 'Visão geral do negócio: métricas de vendas, receitas do mês, tarefas pendentes e actividade recente numa só página.',
    highlight: true,
    category: 'main',
  },
  {
    id: 'negociacoes',
    icon: Kanban,
    title: 'Negociações',
    description: 'Kanban do funil de vendas. Arraste os negócios entre as fases (Proposta, Reunião, Fecho…) e acompanhe o valor total em pipeline.',
    highlight: true,
    category: 'main',
  },
  {
    id: 'contactos',
    icon: Users,
    title: 'Contactos',
    description: 'Base de dados de clientes e leads. Filtre por sector, etiqueta ou fase. Veja o histórico completo de interacções de cada contacto.',
    highlight: true,
    category: 'main',
  },
  {
    id: 'tarefas',
    icon: CheckSquare,
    title: 'Tarefas',
    description: 'Gestão de to-dos com prioridades (Alta, Média, Baixa), datas de entrega e atribuição de responsável. Filtre por estado e urgência.',
    category: 'main',
  },
  {
    id: 'calendario',
    icon: CalendarDays,
    title: 'Calendário',
    description: 'Agenda de eventos, reuniões e follow-ups. Integração com Google Calendar para sincronizar automaticamente os seus compromissos.',
    category: 'main',
  },
  {
    id: 'conversas',
    icon: MessageSquare,
    title: 'Conversas',
    description: 'Caixa de entrada unificada para WhatsApp Business e email. Responda a clientes sem sair da plataforma e mantenha todo o histórico centralizado.',
    highlight: true,
    category: 'main',
  },
  {
    id: 'automacoes',
    icon: Zap,
    title: 'Automações',
    description: 'Fluxos automáticos disparados por eventos: nova etiqueta, nova receita, mudança de sector, novo contacto ou submissão de formulário.',
    category: 'main',
  },
  {
    id: 'formularios',
    icon: FileText,
    title: 'Formulários',
    description: 'Crie formulários de captura de leads com link público partilhável. Os contactos criados ficam automaticamente na sua base de dados.',
    category: 'main',
  },
  {
    id: 'financas',
    icon: DollarSign,
    title: 'Finanças',
    description: 'Registo de receitas e despesas, análise de rentabilidade por cliente e emissão de facturas (disponível para proprietários de conta).',
    category: 'gestao',
  },
  {
    id: 'configuracoes',
    icon: Settings,
    title: 'Configurações',
    description: 'Gerir o perfil, alterar password, configurar integrações (WhatsApp, Email), gerir membros da equipa e ajustar preferências da conta.',
    category: 'config',
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function UserGuide({ open, onClose }: Props) {
  const [search, setSearch] = useState('');

  const filtered = search.trim().length < 2
    ? GUIDE_SECTIONS
    : GUIDE_SECTIONS.filter(s =>
        s.title.toLowerCase().includes(search.toLowerCase()) ||
        s.description.toLowerCase().includes(search.toLowerCase())
      );

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 bg-white">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-100 flex-shrink-0">
          <DialogTitle className="text-xl font-bold text-[#0A2540]">Guia de Utilização</DialogTitle>
          <p className="text-sm text-[#6b7e9a] mt-1">Explore todas as funcionalidades da plataforma</p>
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Pesquisar secção..."
              className="pl-9 text-[#0A2540] placeholder:text-gray-400 border-gray-200"
            />
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {filtered.length === 0 && (
            <p className="text-sm text-[#6b7e9a] text-center py-8">Nenhuma secção encontrada</p>
          )}
          {filtered.map(section => {
            const Icon = section.icon;
            return (
              <div
                key={section.id}
                className="flex items-start gap-4 p-4 rounded-xl border border-gray-100 hover:border-[#0A2540]/20 hover:bg-[#f8fafc] transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-[#0A2540]/8 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-[#0A2540]" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#0A2540] mb-1">{section.title}</h3>
                  <p className="text-sm text-[#6b7e9a] leading-relaxed">{section.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-lg bg-[#0A2540] text-white text-sm font-medium hover:bg-[#0A2540]/90 transition-colors"
          >
            Fechar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
