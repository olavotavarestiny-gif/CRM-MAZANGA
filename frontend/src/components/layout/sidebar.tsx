'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3, Users, MessageSquare, Zap, Kanban,
  CheckSquare, FileText, LogOut, X, DollarSign, CalendarDays,
  Package, Settings, HelpCircle, ShieldAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { User } from '@/lib/api';
import { getChatUnreadCount } from '@/lib/api';
import { canView } from '@/lib/permissions';
import type { ModuleKey } from '@/lib/permissions';
import { ONBOARDING_OPEN, ONBOARDING_DISMISSED } from '@/lib/onboarding-tasks';

const TOUR_ATTR: Record<string, string> = {
  '/':          'sidebar-painel',
  '/pipeline':  'sidebar-negociacoes',
  '/contacts':  'sidebar-contactos',
};

export default function Sidebar({
  open = false,
  onClose = () => {},
  currentUser = null,
  onStartTour,
}: {
  open?: boolean;
  onClose?: () => void;
  currentUser?: User | null;
  onStartTour?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/' || pathname.startsWith('/dashboard');
    return pathname === path || pathname.startsWith(path + '/');
  };

  const handleLogout = () => {
    // Server-side signout clears all Supabase SSR cookie chunks via Set-Cookie
    window.location.href = '/auth/signout';
  };

  const isAdmin = currentUser?.role === 'admin';
  const isOwner = currentUser && !currentUser.accountOwnerId;

  const { data: chatUnread = 0 } = useQuery({
    queryKey: ['chat-unread'],
    queryFn: getChatUnreadCount,
    refetchInterval: 15_000,
    enabled: !!currentUser,
  });

  const navItemClass = (active: boolean) => cn(
    'flex items-center gap-3 px-3 py-2 transition-all text-sm font-medium rounded-lg',
    active
      ? 'bg-[#0A2540]/8 text-[#0A2540] font-semibold'
      : 'text-[#6b7e9a] hover:text-[#0A2540] hover:bg-[#0A2540]/5'
  );

  // Map href to module key for permission checks
  const hrefToModule: Record<string, ModuleKey | null> = {
    '/':           null, // always visible
    '/pipeline':   'pipeline',
    '/contacts':   'contacts',
    '/tasks':      'tasks',
    '/calendario': 'calendario',
    '/chat':       'chat',
    '/automations':'automations',
    '/forms':      'forms',
    '/finances':   'finances',
    '/produtos':   'finances',
  };

  const isVisible = (href: string) => {
    if (!currentUser) return false;
    const module = hrefToModule[href];
    if (module === null) return true; // always visible (painel)
    if (!module) return true;
    return canView(currentUser, module);
  };

  const allMainLinks = [
    { href: '/', label: 'Painel', icon: BarChart3 },
    { href: '/pipeline', label: 'Negociações', icon: Kanban },
    { href: '/contacts', label: 'Contactos', icon: Users },
    { href: '/tasks', label: 'Tarefas', icon: CheckSquare },
    { href: '/calendario', label: 'Calendário', icon: CalendarDays },
    { href: '/chat', label: 'Conversas', icon: MessageSquare },
    { href: '/automations', label: 'Automações', icon: Zap },
    { href: '/forms', label: 'Formulários', icon: FileText },
  ];

  const allGestaoLinks = (isOwner || isAdmin) ? [
    { href: '/finances', label: 'Finanças', icon: DollarSign },
    { href: '/produtos', label: 'Produtos', icon: Package },
  ] : [];

  const mainLinks = allMainLinks.filter(l => isVisible(l.href));
  const gestaoLinks = allGestaoLinks.filter(l => isVisible(l.href));

  const adminLinks: { href: string; label: string; icon: React.ElementType }[] = currentUser?.isSuperAdmin
    ? [{ href: '/superadmin', label: 'SuperAdmin', icon: ShieldAlert }]
    : [];

  return (
    <div
      data-tour="sidebar"
      className={`w-56 min-h-screen flex flex-col fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 md:static border-r border-[#dde3ec] bg-white ${
        open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}
    >
      {/* Logo */}
      <div className="px-5 py-5 flex items-center justify-between flex-shrink-0 border-b border-[#dde3ec]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#0A2540] flex items-center justify-center flex-shrink-0">
            <span className="text-white font-black text-xs" style={{ fontFamily: "'Montserrat', sans-serif" }}>K</span>
          </div>
          <span className="text-[#0A2540] font-bold text-base leading-none" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            Kuku<span className="font-medium text-[#6b7e9a]">Gest</span>
          </span>
        </div>
        <button onClick={onClose} className="md:hidden p-1 hover:bg-[#f5f7fa] rounded transition-colors">
          <X className="w-4 h-4 text-[#6b7e9a]" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-0.5">
        {mainLinks.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            data-tour={TOUR_ATTR[href]}
            className={navItemClass(isActive(href))}
            onClick={onClose}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">{label}</span>
            {href === '/chat' && chatUnread > 0 && (
              <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none min-w-[18px] text-center">
                {chatUnread > 99 ? '99+' : chatUnread}
              </span>
            )}
          </Link>
        ))}

        {gestaoLinks.length > 0 && (
          <div className="pt-3 mt-2 border-t border-[#dde3ec]">
            <p className="px-3 pt-1 pb-2 text-[10px] font-semibold uppercase tracking-widest text-[#6b7e9a]/60">
              Gestão
            </p>
            {gestaoLinks.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className={navItemClass(isActive(href))} onClick={onClose}>
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{label}</span>
              </Link>
            ))}
          </div>
        )}

        {adminLinks.length > 0 && (
          <div className="pt-3 mt-2 border-t border-[#dde3ec]">
            <p className="px-3 pt-1 pb-2 text-[10px] font-semibold uppercase tracking-widest text-[#6b7e9a]/60">
              Admin
            </p>
            {adminLinks.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className={navItemClass(isActive(href))} onClick={onClose}>
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{label}</span>
              </Link>
            ))}
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-[#dde3ec] space-y-0.5">
        <Link href="/configuracoes" className={navItemClass(isActive('/configuracoes'))} onClick={onClose}>
          <Settings className="w-4 h-4 flex-shrink-0" />
          <span>Configurações</span>
        </Link>
        <button
          onClick={() => {
            localStorage.removeItem(ONBOARDING_DISMISSED);
            localStorage.setItem(ONBOARDING_OPEN, '1');
            window.dispatchEvent(new StorageEvent('storage', { key: ONBOARDING_OPEN }));
            onClose();
          }}
          className={navItemClass(false)}
        >
          <HelpCircle className="w-4 h-4 flex-shrink-0" />
          <span>Ajuda</span>
        </button>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 text-[#6b7e9a] hover:text-red-500 hover:bg-red-50 transition-all text-left text-sm font-medium rounded-lg"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          <span>Sair</span>
        </button>
      </div>
    </div>
  );
}
