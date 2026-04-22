'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Users, Kanban, CheckSquare, ShoppingBag, DollarSign, Settings, HelpCircle, LogOut } from 'lucide-react';
import { buildWhatsAppSupportLink } from '@/lib/plan-utils';
import { cn } from '@/lib/utils';
import type { User } from '@/lib/api';

const PREVIEW_LINKS = [
  { href: '/preview', label: 'Painel', icon: BarChart3 },
  { href: '/preview/contacts', label: 'Contactos', icon: Users },
  { href: '/preview/pipeline', label: 'Processos', icon: Kanban },
  { href: '/preview/tasks', label: 'Tarefas', icon: CheckSquare },
  { href: '/preview/vendas', label: 'Vendas', icon: ShoppingBag },
];

const ADMIN_LINKS = [
  { href: '/preview/finances', label: 'Finanças', icon: DollarSign },
];

export default function PreviewSidebar({ currentUser }: { currentUser: User }) {
  const pathname = usePathname();
  const helpHref = buildWhatsAppSupportLink({
    name: currentUser?.name || null,
    company: currentUser?.accountOwnerName || null,
  });

  const isActive = (path: string) => {
    if (path === '/preview') return pathname === '/preview' || pathname === '/preview/';
    return pathname === path || pathname.startsWith(path + '/');
  };

  const navItemClass = (active: boolean) => cn(
    'flex items-center gap-3 px-3 py-2 transition-all text-sm font-medium rounded-xl',
    active
      ? 'bg-blue-50 text-[#0049e6] font-semibold'
      : 'text-[#6b7e9a] hover:text-[#0049e6] hover:bg-blue-50/60'
  );

  return (
    <div className="w-64 min-h-screen flex flex-col bg-white border-r border-slate-100 overflow-y-auto">
      {/* Logo */}
      <div className="px-5 py-5 flex items-center justify-between flex-shrink-0 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0049e6] to-[#829bff] flex items-center justify-center flex-shrink-0">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div className="flex items-start gap-2">
            <span className="text-[#2c2f31] font-bold text-base leading-none">
              Kuku<span className="font-medium text-[#595c5e]">Gest</span>
            </span>
            <span className="rounded-full border border-[#fac775] bg-[#fdf2ea] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#b84d0e]">
              Beta
            </span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {PREVIEW_LINKS.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={navItemClass(isActive(href))}>
            <Icon className="w-[18px] h-[18px] flex-shrink-0" />
            <span className="flex-1">{label}</span>
          </Link>
        ))}

        {ADMIN_LINKS.length > 0 && (
          <div className="pt-3 mt-2 border-t border-slate-100">
            <p className="px-3 pt-1 pb-2 text-[10px] font-semibold uppercase tracking-widest text-[#6b7e9a]/60">
              Gestão
            </p>
            {ADMIN_LINKS.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className={navItemClass(isActive(href))}>
                <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                <span>{label}</span>
              </Link>
            ))}
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-slate-100 space-y-0.5">
        <a href="#" className={navItemClass(false)}>
          <Settings className="w-[18px] h-[18px] flex-shrink-0" />
          <span>Configurações</span>
        </a>
        <a href={helpHref} target="_blank" rel="noopener noreferrer" className={navItemClass(false)}>
          <HelpCircle className="w-[18px] h-[18px] flex-shrink-0" />
          <span>Ajuda</span>
        </a>
        <a href="/login" className="w-full flex items-center gap-3 px-3 py-2 text-[#6b7e9a] hover:text-[#b31b25] hover:bg-[#b31b25]/5 transition-all text-left text-sm font-medium rounded-xl">
          <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
          <span>Sair</span>
        </a>
      </div>
    </div>
  );
}
