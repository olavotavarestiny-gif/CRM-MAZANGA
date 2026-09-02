'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BarChart3, Users, MessageSquare, Zap,
  CheckSquare, FileText, LogOut, X, DollarSign, CalendarDays,
  Package, Settings, HelpCircle, ShieldAlert, ShoppingBag, ShoppingCart,
  ChevronDown, CreditCard, Clock3, Handshake, Utensils, ChefHat,
  LayoutDashboard, Bike, Truck, Megaphone, ArrowLeftRight, CircleHelp,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { isComercio, isFood } from '@/lib/business-modes';
import KukuGestLogo, { KukuGestFoodLogo, KukuGestIcon } from '@/components/KukuGestLogo';
import TrialStatusBadge from '@/components/billing/trial-status-badge';
import AccountSwitcher from '@/components/layout/account-switcher';
import { RestaurantMark, getFoodBrand, getFoodBrandStyle } from '@/components/food/food-ui';
import { cn } from '@/lib/utils';
import type { User } from '@/lib/api';
import { getChatUnreadCount, getFoodSettings, getFoodTeam, getOnboarding, reopenOnboarding } from '@/lib/api';
import { canAccessCommerceRoute, canView, canViewReports, hasFoodPermission, hasFoodRole } from '@/lib/permissions';
import type { FoodRole, ModuleKey } from '@/lib/permissions';
import { buildWhatsAppSupportLink, getPlanBadgeClasses, getPricingTierLabel } from '@/lib/plan-utils';
import { isClientDevAuthBypassEnabled, setDevAuthPersonId } from '@/lib/dev-auth';
import { isFoodProduct, toPublicFoodPath } from '@/lib/product';

const TOUR_ATTR: Record<string, string> = {
  '/':            'sidebar-painel',
  '/pipeline':    'sidebar-negociacoes',
  '/negociacoes': 'sidebar-negociacoes',
  '/contacts':    'sidebar-contactos',
};

export default function Sidebar({
  open = false,
  onClose = () => {},
  currentUser = null,
  collapsed = false,
  onToggleCollapsed = () => {},
}: {
  open?: boolean;
  onClose?: () => void;
  currentUser?: User | null;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const pathname = usePathname();
  const queryClient = useQueryClient();
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
  const reopenOnboardingMutation = useMutation({
    mutationFn: reopenOnboarding,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding'] });
      onClose();
    },
  });
  const showOnboardingBadge =
    isOnboardingEligible &&
    onboarding &&
    onboarding.show &&
    onboarding.totalCount > 0;

  const navItemClass = (active: boolean) => cn(
    'flex items-center gap-3 px-3 py-2 transition-all text-sm font-medium rounded-xl',
    collapsed && 'justify-center px-2',
    active
      ? 'bg-[var(--workspace-primary-soft)] text-[var(--workspace-primary)] font-semibold'
      : 'text-[#6b7e9a] hover:bg-[var(--workspace-primary-soft)] hover:text-[var(--workspace-primary)]'
  );

  const standaloneFood = isFoodProduct();
  const food = standaloneFood || pathname === '/food' || pathname.startsWith('/food/');
  const foodNavItemClass = (active: boolean) => cn(
    'flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
    collapsed && 'justify-center px-2',
    active
      ? 'bg-[var(--workspace-primary-soft)] font-semibold text-[var(--workspace-primary)]'
      : 'font-medium text-slate-500 hover:bg-white hover:text-slate-800'
  );
  const comercio = !food && isComercio(currentUser?.workspaceMode);
  const hasFoodWorkspace = currentUser?.availableWorkspaces?.includes('food') === true || isFood(currentUser?.workspaceMode);
  const reportsHref = comercio ? '/relatorios/comercio' : '/relatorios/servicos';
  const { data: foodSettings } = useQuery({
    queryKey: ['food-settings'],
    queryFn: getFoodSettings,
    enabled: food,
    retry: 2,
  });
  const foodBrand = getFoodBrand(foodSettings);
  const localFoodPreview = food && isClientDevAuthBypassEnabled() && currentUser?.foodAccess?.roles.includes('manager') === true;
  const { data: foodTeam } = useQuery({
    queryKey: ['food-team'],
    queryFn: getFoodTeam,
    enabled: localFoodPreview,
  });
  const previewCourier = foodTeam?.assignments.find((assignment) => assignment.active && assignment.role === 'courier' && assignment.person.active);

  // Map href to module key for permission checks
  const hrefToModule: Record<string, ModuleKey | null> = {
    '/':                null, // always visible
    '/contacts':        'contacts',
    '/pipeline':        'pipeline',
    '/negociacoes':     'pipeline',
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
    { href: '/contacts', label: 'Contactos', icon: Users, module: 'contacts' as const },
    { href: '/negociacoes', label: 'Negociações', icon: Handshake, module: 'pipeline' as const },
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
    { href: '/contacts', label: 'Contactos', icon: Users, module: 'contacts' as const },
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

  const allFoodLinks: Array<{ href: string; label: string; icon: React.ElementType; permission: string; group: 'start' | 'operation' | 'growth' | 'configuration'; role?: FoodRole }> = [
    { href: '/food', label: 'Ambientes', icon: Utensils, permission: 'context.view', group: 'start' },
    { href: '/food/gestao', label: 'Gestão', icon: LayoutDashboard, permission: 'overview.view', group: 'operation' },
    { href: '/food/caixa', label: 'Caixa', icon: ShoppingCart, permission: 'orders.create', group: 'operation' },
    { href: '/food/cozinha', label: 'KukuGest Cozinha', icon: ChefHat, permission: 'kitchen.view', group: 'operation' },
    { href: '/food/delivery', label: 'Delivery', icon: Truck, permission: 'delivery.view', group: 'operation' },
    { href: '/food/entregador', label: 'Entregador', icon: Bike, permission: 'delivery.view_own', group: 'operation', role: 'courier' },
    { href: '/food/crm', label: 'CRM & Marketing', icon: Megaphone, permission: 'crm.view', group: 'growth' },
    { href: '/food/gestao/relatorios', label: 'Relatórios', icon: BarChart3, permission: 'reports.view', group: 'growth' },
    { href: '/food/produtos', label: 'Menu', icon: Package, permission: 'catalog.view', group: 'configuration' },
    { href: '/food/configuracoes', label: 'Configurações', icon: Settings, permission: 'settings.edit', group: 'configuration' },
    { href: '/food/ajuda', label: 'Ajuda', icon: CircleHelp, permission: 'context.view', group: 'configuration' },
  ].map((link) => ({ ...link, href: toPublicFoodPath(link.href) })) as Array<{ href: string; label: string; icon: React.ElementType; permission: string; group: 'start' | 'operation' | 'growth' | 'configuration'; role?: FoodRole }>;
  const foodLinks = food ? allFoodLinks.filter((link) => (
    !!currentUser
    && hasFoodPermission(currentUser, link.permission)
    && (!link.role || hasFoodRole(currentUser, link.role) || (localFoodPreview && link.role === 'courier' && Boolean(previewCourier)))
  )) : [];
  const foodGroups = [
    { id: 'start', label: '', links: foodLinks.filter((link) => link.group === 'start') },
    { id: 'operation', label: 'Operação', links: foodLinks.filter((link) => link.group === 'operation') },
    { id: 'growth', label: 'Crescimento', links: foodLinks.filter((link) => link.group === 'growth') },
    { id: 'configuration', label: 'Configuração', links: foodLinks.filter((link) => link.group === 'configuration') },
  ].filter((group) => group.links.length > 0);

  const allGestaoLinks = [
    { href: '/finances', label: 'Finanças', icon: DollarSign },
    { href: reportsHref, label: 'Relatórios', icon: BarChart3 },
    ...(canSeeActivity ? [{ href: '/activity', label: 'Atividade', icon: Clock3 }] : []),
  ];

  const mainLinks = allMainLinks.filter((link) => isVisible(link.href));
  const gestaoLinks = allGestaoLinks.filter(l => isVisible(l.href));

  const adminLinks: { href: string; label: string; icon: React.ElementType }[] = hasPlatformAdminAccess
    ? [{ href: standaloneFood ? (process.env.NEXT_PUBLIC_ADMIN_URL || 'https://beta.admin.kukugest.ao') : '/superadmin?section=users', label: 'Administração', icon: ShieldAlert }]
    : [];

  return (
    <div
      data-tour="sidebar"
      className={cn(`min-h-screen flex flex-col fixed inset-y-0 left-0 z-50 transform transition-[width,transform] duration-300 md:relative border-r ${food ? 'border-slate-200 bg-slate-50 md:bg-slate-50/60' : 'border-slate-100 bg-white'} ${
        open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`, collapsed ? 'w-20' : 'w-64')}
      style={food ? getFoodBrandStyle(foodSettings) : undefined}
    >
      {/* Logo */}
      <div className={cn('flex flex-shrink-0 items-center justify-between border-b border-slate-100 px-4 py-4', food && 'bg-white py-4 md:bg-white/70', collapsed && 'flex-col gap-2 px-2 py-3')}>
        {food ? (
          <div className="flex min-w-0 items-center gap-3">
            {standaloneFood ? <KukuGestFoodLogo compact={collapsed} showBetaBadge={!collapsed} /> : <RestaurantMark settings={foodSettings} size="md" />}
            <div className={cn('min-w-0', collapsed && 'hidden')}>
              <p className="truncate text-xs font-semibold text-slate-500">{foodBrand.name}</p>
              <div className="mt-1 flex items-center gap-1.5">
                <span className={cn('h-2 w-2 rounded-full', foodSettings?.isEnabled ? 'bg-emerald-500' : 'bg-amber-400')} />
                <span className="text-[11px] font-medium text-slate-500">{foodSettings?.isEnabled ? 'Operação activa' : 'Operação inactiva'}</span>
              </div>
            </div>
          </div>
        ) : (
          collapsed ? <KukuGestIcon size={38} /> : <KukuGestLogo height={44} className="max-w-[calc(100%-2rem)]" />
        )}
        <button onClick={onClose} className="md:hidden p-1 hover:bg-slate-100 rounded transition-colors">
          <X className="w-4 h-4 text-[#6b7e9a]" />
        </button>
      </div>

      {/* Nav */}
      <nav className={cn('flex-1 space-y-0.5 overflow-y-auto px-3 py-4', collapsed && 'px-2 [&_p]:hidden [&_span]:hidden')}>
        {food ? (
          <>
            <div data-food-tour="food-nav" className="space-y-5">
              {foodGroups.map((group) => (
                <div key={group.id}>
                  {group.label ? <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-normal text-slate-400">{group.label}</p> : null}
                  <div className="space-y-0.5">
                    {group.links.map(({ href, label, icon: Icon, role }) => (
                      <Link
                        key={href}
                        href={href}
                        title={collapsed ? label : undefined}
                        className={foodNavItemClass((href === '/food' || href === '/') ? (pathname === '/food' || pathname === '/') : isActive(href))}
                        onClick={(event) => {
                          if (role === 'courier' && localFoodPreview && previewCourier) {
                            event.preventDefault();
                            setDevAuthPersonId(previewCourier.personId);
                            window.location.href = href;
                            return;
                          }
                          onClose();
                        }}
                      >
                        <Icon className="h-4 w-4 flex-shrink-0" />
                        <span className="flex-1">{label}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {adminLinks.length > 0 && (
              <div className="pt-3 mt-2 border-t border-slate-100">
                <p className="px-3 pt-1 pb-2 text-[10px] font-semibold uppercase tracking-widest text-[#6b7e9a]/60">
                  Admin
                </p>
                {adminLinks.map(({ href, label, icon: Icon }) => (
                  <Link key={href} href={href} className={navItemClass(isActive(href))} onClick={onClose} title={collapsed ? label : undefined}>
                    <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                    <span>{label}</span>
                  </Link>
                ))}
              </div>
            )}
          </>
        ) : comercio ? (
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
                  title={collapsed ? label : undefined}
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
                    title={collapsed ? label : undefined}
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
                  <Link key={href} href={href} className={navItemClass(isActive(href))} onClick={onClose} title={collapsed ? label : undefined}>
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
                title={collapsed ? label : undefined}
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
                  <Link key={href} href={href} className={navItemClass(isActive(href))} onClick={onClose} title={collapsed ? label : undefined}>
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
                  <Link key={href} href={href} className={navItemClass(isActive(href))} onClick={onClose} title={collapsed ? label : undefined}>
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
      <footer className={cn('space-y-0.5 border-t border-slate-100 px-3 py-4', collapsed && 'px-2 [&_p]:hidden [&_span]:hidden')}>
        {hasFoodWorkspace && (
          <Link
            href={food ? (standaloneFood ? (process.env.NEXT_PUBLIC_CRM_URL || 'https://beta.app.kukugest.ao') : (currentUser?.defaultWorkspace === 'gestao_kpi' ? '/gestao' : '/')) : '/food'}
            className={navItemClass(false)}
            onClick={onClose}
            title={collapsed ? (food ? 'Voltar ao CRM' : 'Abrir KukuGest Food') : undefined}
          >
            <ArrowLeftRight className="w-[18px] h-[18px] flex-shrink-0" />
            <span>{food ? 'Voltar ao CRM' : 'Abrir KukuGest Food'}</span>
          </Link>
        )}
        {!collapsed ? <AccountSwitcher /> : null}
        {currentUser?.plan && !food && !collapsed && (
          <div className="mb-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6b7e9a]/70">
              Plano atual
            </p>
            <div className={`mt-2 inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${getPlanBadgeClasses(currentUser.plan)}`}>
              {getPricingTierLabel(currentUser.plan)}
            </div>
            <TrialStatusBadge subscription={currentUser.subscription} className="mt-2" />
          </div>
        )}
        {showOnboardingBadge && !food && !collapsed && (
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
        {!comercio && !food && (
          <Link href="/configuracoes" className={navItemClass(isActive('/configuracoes'))} onClick={onClose} title={collapsed ? 'Configurações' : undefined}>
            <Settings className="w-[18px] h-[18px] flex-shrink-0" />
            <span>Configurações</span>
          </Link>
        )}
        {!food ? <a
          href={helpHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onClose}
          className={navItemClass(false)}
          title={collapsed ? 'Ajuda' : undefined}
        >
          <HelpCircle className="w-[18px] h-[18px] flex-shrink-0" />
          <span>Ajuda</span>
        </a> : null}
        {isOnboardingEligible && !food && !collapsed && (
          <Link
            href="/"
            onClick={() => {
              reopenOnboardingMutation.mutate();
              onClose();
            }}
            className={navItemClass(false)}
          >
            <CheckSquare className="w-[18px] h-[18px] flex-shrink-0" />
            <span>Guia inicial</span>
          </Link>
        )}
        <button
          onClick={handleLogout}
          className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-[#6b7e9a] transition-all hover:bg-[#b31b25]/5 hover:text-[#b31b25]', collapsed && 'justify-center px-2')}
          title={collapsed ? 'Sair' : undefined}
        >
          <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
          <span>Sair</span>
        </button>
        {food ? (
          <p className="px-3 pt-4 text-[11px] font-semibold text-slate-400">
            Powered by <span className="text-slate-500">KukuGest</span>
          </p>
        ) : null}
      </footer>
      <button
        type="button"
        onClick={onToggleCollapsed}
        className="absolute -right-2 top-1/2 z-10 hidden h-8 w-4 -translate-y-1/2 items-center justify-center rounded-r border border-l-0 border-slate-200 bg-white/80 text-slate-300 opacity-70 transition hover:bg-white hover:text-slate-700 hover:opacity-100 md:flex"
        title={collapsed ? 'Expandir menu' : 'Minimizar menu'}
        aria-label={collapsed ? 'Expandir menu' : 'Minimizar menu'}
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>
    </div>
  );
}
