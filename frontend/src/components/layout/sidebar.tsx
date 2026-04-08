'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3, Users, MessageSquare, Zap, Kanban,
  CheckSquare, FileText, LogOut, X, DollarSign, CalendarDays,
  Package, Settings, HelpCircle, ShieldAlert, ShoppingBag, ShoppingCart,
  ChevronDown, CreditCard, Clock3,
} from 'lucide-react';
import { isComercio } from '@/lib/business-modes';
import KukuGestLogo from '@/components/KukuGestLogo';
import { cn } from '@/lib/utils';
import type { User } from '@/lib/api';
import { getChatUnreadCount, getOnboarding } from '@/lib/api';
import { canAccessCommerceRoute, canView, canViewReports } from '@/lib/permissions';
import type { ModuleKey } from '@/lib/permissions';
import { buildWhatsAppSupportLink, getPlanBadgeClasses, getPricingTierLabel } from '@/lib/plan-utils';

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
  const [gestaoInternaOpen, setGestaoInternaOpen] = useState(true);

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/' || pathname.startsWith('/dashboard');
    return pathname === path || pathname.startsWith(path + '/');
  };

  const handleLogout = () => {
    // Server-side signout clears all Supabase SSR cookie chunks via Set-Cookie
    window.location.href = '/auth/signout';
  };

  const hasPlatformAdminAccess = !!currentUser?.isSuperAdmin;
  const helpHref = buildWhatsAppSupportLink({
    name: currentUser?.name || null,
    company: currentUser?.accountOwnerName || null,
  });

  const { data: chatUnread = 0 } = useQuery({
    queryKey: ['chat-unread'],
    queryFn: getChatUnreadCount,
    refetchInterval: 15_000,
    enabled: !!currentUser && canView(currentUser, 'chat'),
  });

  const isOnboardingEligible = !!(
    currentUser && (currentUser.isSuperAdmin || currentUser.role === 'admin' || !currentUser.accountOwnerId)
  );
  const { data: onboarding } = useQuery({
    queryKey: ['onboarding', currentUser?.workspaceMode],
    queryFn: getOnboarding,
    staleTime: 60_000,
    refetchInterval: 60_000,
    enabled: isOnboardingEligible,
  });
  const showOnboardingBadge =
    isOnboardingEligible &&
    onboarding &&
    !onboarding.dismissed &&
    !onboarding.allDone &&
    onboarding.totalCount > 0;

  const navItemClass = (active: boolean) => cn(
    'flex items-center gap-3 px-3 py-2 transition-all text-sm font-medium rounded-xl',
    active
      ? 'bg-[var(--workspace-primary-soft)] text-[var(--workspace-primary)] font-semibold'
      : 'text-[#6b7e9a] hover:bg-[var(--workspace-primary-soft)] hover:text-[var(--workspace-primary)]'
  );

  const comercio = isComercio(currentUser?.workspaceMode);
  const reportsHref = comercio ? '/relatorios/comercio' : '/relatorios/servicos';

  // Map href to module key for permission checks
  const hrefToModule: Record<string, ModuleKey | null> = {
    '/':                null, // always visible
    '/contacts':        'contacts',
    '/pipeline':        'pipeline',
    '/tasks':           'tasks',
    '/calendario':      'calendario',
    '/chat':            'chat',
    '/automations':     'automations',
    '/forms':           'forms',
    '/finances':        'finances',
  };

  const isVisible = (href: string) => {
    if (!currentUser) return false;
    if (href === '/activity') return canSeeActivity;
    if (href === reportsHref) return canViewReports(currentUser);
    if (comercio) return canAccessCommerceRoute(currentUser, href);
    const module = hrefToModule[href];
    if (module === null) return true; // always visible (painel)
    if (!module) return true;
    return canView(currentUser, module);
  };
  const canSeeActivity = !!(
    currentUser &&
    (currentUser.isSuperAdmin || currentUser.role === 'admin' || !currentUser.accountOwnerId)
  );

  // SERVICOS: standard CRM nav
  const allMainLinks = [
    { href: '/', label: 'Painel', icon: BarChart3 },
    { href: '/contacts', label: 'Clientes', icon: Users, module: 'contacts' as const },
    { href: '/pipeline', label: 'Processos de Venda', icon: Kanban, module: 'pipeline' as const },
    { href: '/tasks', label: 'Tarefas', icon: CheckSquare, module: 'tasks' as const },
    { href: '/vendas', label: 'Vendas', icon: ShoppingBag, module: 'vendas' as const },
    { href: '/chat', label: 'Conversas', icon: MessageSquare, module: 'chat' as const },
    { href: '/calendario', label: 'Calendário', icon: CalendarDays, module: 'calendario' as const },
    { href: '/automations', label: 'Automações', icon: Zap, module: 'automations' as const },
    { href: '/forms', label: 'Formulários', icon: FileText, module: 'forms' as const },
  ];

  // COMERCIO: grupo "Uso diário" — itens prioritários de operação diária
  const comercioUsoDiarioLinks = comercio ? [
    { href: '/', label: 'Painel', icon: BarChart3 },
    { href: '/caixa', label: 'Caixa', icon: CreditCard, module: 'vendas' as const },
    { href: '/vendas-rapidas', label: 'Venda Rápida', icon: ShoppingCart, module: 'vendas' as const },
    { href: '/contacts', label: 'Clientes', icon: Users, module: 'contacts' as const },
    { href: '/tasks', label: 'Tarefas', icon: CheckSquare, module: 'tasks' as const },
    { href: '/produtos', label: 'Produtos', icon: Package, module: 'vendas' as const },
  ].filter(l => isVisible(l.href)) : [];

  // COMERCIO: grupo "Gestão interna" — ferramentas de gestão e back-office
  const comercioGestaoInternaLinks = comercio ? [
    { href: '/vendas', label: 'Faturação', icon: ShoppingBag, module: 'vendas' as const },
    { href: '/finances', label: 'Finanças', icon: DollarSign, module: 'finances' as const },
    { href: reportsHref, label: 'Relatórios', icon: BarChart3 },
    ...(canSeeActivity ? [{ href: '/activity', label: 'Atividade', icon: Clock3 }] : []),
    { href: '/configuracoes', label: 'Configurações', icon: Settings },
  ].filter(l => isVisible(l.href)) : [];

  const allGestaoLinks = [
    { href: '/finances', label: 'Finanças', icon: DollarSign },
    { href: reportsHref, label: 'Relatórios', icon: BarChart3 },
    ...(canSeeActivity ? [{ href: '/activity', label: 'Atividade', icon: Clock3 }] : []),
  ];

  const mainLinks = allMainLinks.filter((link) => isVisible(link.href));
  const gestaoLinks = allGestaoLinks.filter(l => isVisible(l.href));

  const adminLinks: { href: string; label: string; icon: React.ElementType }[] = hasPlatformAdminAccess
    ? [{ href: '/superadmin?section=users', label: 'Administração', icon: ShieldAlert }]
    : [];

  return (
    <div
      data-tour="sidebar"
      className={`w-64 min-h-screen flex flex-col fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 md:static border-r border-slate-100 bg-white ${
        open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}
    >
      {/* Logo */}
      <div className="px-4 py-4 flex items-center justify-between flex-shrink-0 border-b border-slate-100">
        <KukuGestLogo height={52} className="max-w-[calc(100%-2rem)]" />
        <button onClick={onClose} className="md:hidden p-1 hover:bg-slate-100 rounded transition-colors">
          <X className="w-4 h-4 text-[#6b7e9a]" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-0.5">
        {comercio ? (
          <>
            {/* COMERCIO: Grupo "Uso diário" */}
            <div>
              <p className="px-3 pt-1 pb-2 text-[10px] font-semibold uppercase tracking-widest text-[#6b7e9a]/60">
                Uso diário
              </p>
              {comercioUsoDiarioLinks.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  data-tour={TOUR_ATTR[href]}
                  className={navItemClass(isActive(href))}
                  onClick={onClose}
                >
                  <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                  <span className="flex-1">{label}</span>
                  {href === '/chat' && chatUnread > 0 && (
                    <span className="ml-auto bg-[#b31b25] text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none min-w-[18px] text-center">
                      {chatUnread > 99 ? '99+' : chatUnread}
                    </span>
                  )}
                </Link>
              ))}
            </div>

            {/* COMERCIO: Grupo "Gestão interna" (colapsável) */}
            {comercioGestaoInternaLinks.length > 0 && (
              <div className="pt-3 mt-2 border-t border-slate-100">
                <button
                  onClick={() => setGestaoInternaOpen(o => !o)}
                  className="w-full flex items-center justify-between px-3 pt-1 pb-2"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6b7e9a]/60">
                    Gestão
                  </p>
                  <ChevronDown className={cn(
                    'w-3.5 h-3.5 text-[#6b7e9a]/60 transition-transform duration-200',
                    gestaoInternaOpen ? 'rotate-0' : '-rotate-90'
                  )} />
                </button>
                {gestaoInternaOpen && comercioGestaoInternaLinks.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className={navItemClass(isActive(href))}
                    onClick={onClose}
                  >
                    <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                    <span className="flex-1">{label}</span>
                    {href === '/chat' && chatUnread > 0 && (
                      <span className="ml-auto bg-[#b31b25] text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none min-w-[18px] text-center">
                        {chatUnread > 99 ? '99+' : chatUnread}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            )}

            {/* Admin section */}
            {adminLinks.length > 0 && (
              <div className="pt-3 mt-2 border-t border-slate-100">
                <p className="px-3 pt-1 pb-2 text-[10px] font-semibold uppercase tracking-widest text-[#6b7e9a]/60">
                  Admin
                </p>
                {adminLinks.map(({ href, label, icon: Icon }) => (
                  <Link key={href} href={href} className={navItemClass(isActive(href))} onClick={onClose}>
                    <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                    <span>{label}</span>
                  </Link>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {/* SERVICOS: nav padrão inalterado */}
            {mainLinks.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                data-tour={TOUR_ATTR[href]}
                className={navItemClass(isActive(href))}
                onClick={onClose}
              >
                <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                <span className="flex-1">{label}</span>
                {href === '/chat' && chatUnread > 0 && (
                  <span className="ml-auto bg-[#b31b25] text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none min-w-[18px] text-center">
                    {chatUnread > 99 ? '99+' : chatUnread}
                  </span>
                )}
              </Link>
            ))}

            {gestaoLinks.length > 0 && (
              <div className="pt-3 mt-2 border-t border-slate-100">
                <p className="px-3 pt-1 pb-2 text-[10px] font-semibold uppercase tracking-widest text-[#6b7e9a]/60">
                  Gestão
                </p>
                {gestaoLinks.map(({ href, label, icon: Icon }) => (
                  <Link key={href} href={href} className={navItemClass(isActive(href))} onClick={onClose}>
                    <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                    <span>{label}</span>
                  </Link>
                ))}
              </div>
            )}

            {adminLinks.length > 0 && (
              <div className="pt-3 mt-2 border-t border-slate-100">
                <p className="px-3 pt-1 pb-2 text-[10px] font-semibold uppercase tracking-widest text-[#6b7e9a]/60">
                  Admin
                </p>
                {adminLinks.map(({ href, label, icon: Icon }) => (
                  <Link key={href} href={href} className={navItemClass(isActive(href))} onClick={onClose}>
                    <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                    <span>{label}</span>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-slate-100 space-y-0.5">
        {currentUser?.plan && (
          <div className="mb-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6b7e9a]/70">
              Plano atual
            </p>
            <div className={`mt-2 inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${getPlanBadgeClasses(currentUser.plan)}`}>
              {getPricingTierLabel(currentUser.plan)}
            </div>
          </div>
        )}
        {showOnboardingBadge && (
          <Link
            href="/"
            onClick={onClose}
            className="mb-1 flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 hover:bg-slate-100 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[#2c2f31]">Configuração inicial</p>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-[var(--workspace-primary)] transition-all"
                  style={{
                    width: `${Math.round(((onboarding?.completedCount ?? 0) / (onboarding?.totalCount ?? 1)) * 100)}%`,
                  }}
                />
              </div>
            </div>
            <span className="flex-shrink-0 text-xs font-bold text-[var(--workspace-primary)]">
              {onboarding?.completedCount}/{onboarding?.totalCount}
            </span>
          </Link>
        )}
        {!comercio && (
          <Link href="/configuracoes" className={navItemClass(isActive('/configuracoes'))} onClick={onClose}>
            <Settings className="w-[18px] h-[18px] flex-shrink-0" />
            <span>Configurações</span>
          </Link>
        )}
        <a
          href={helpHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onClose}
          className={navItemClass(false)}
        >
          <HelpCircle className="w-[18px] h-[18px] flex-shrink-0" />
          <span>Ajuda</span>
        </a>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 text-[#6b7e9a] hover:text-[#b31b25] hover:bg-[#b31b25]/5 transition-all text-left text-sm font-medium rounded-xl"
        >
          <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
          <span>Sair</span>
        </button>
      </div>
    </div>
  );
}
