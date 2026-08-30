'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { BarChart3, BriefcaseBusiness, Building2, ChevronLeft, ChevronRight, Target, DollarSign, FileBarChart, LogOut, Megaphone, Moon, Settings, Sun, Users, X } from 'lucide-react';
import KukuGestLogo, { KukuGestIcon } from '@/components/KukuGestLogo';
import type { User } from '@/lib/api';
import type { ManagementRole } from '@/lib/management-api';
import { cn } from '@/lib/utils';

const links = [
  { href: '/gestao', label: 'Dashboard', icon: BarChart3, roles: ['admin','marketing','commercial','designer','editor'] },
  { href: '/gestao/clientes', label: 'Clientes', icon: Building2, roles: ['admin','commercial'] },
  { href: '/gestao/marketing', label: 'Marketing', icon: Megaphone, roles: ['admin','marketing'] },
  { href: '/gestao/comercial', label: 'Comercial', icon: BriefcaseBusiness, roles: ['admin','commercial'] },
  { href: '/gestao/operacional', label: 'Operacional', icon: Users, roles: ['admin','designer','editor'] },
  { href: '/gestao/financas', label: 'Finanças', icon: DollarSign, roles: ['admin'] },
  { href: '/gestao/metas', label: 'Metas', icon: Target, roles: ['admin'] },
  { href: '/gestao/relatorios', label: 'Relatórios', icon: FileBarChart, roles: ['admin'] },
  { href: '/gestao/utilizadores', label: 'Utilizadores', icon: Users, roles: ['admin'] },
  { href: '/gestao/configuracoes', label: 'Configurações', icon: Settings, roles: ['admin','marketing','commercial','designer','editor'] },
] as const;

function resolveRole(user?: User | null): ManagementRole {
  if (!user?.accountOwnerId || user.role === 'admin') return 'admin';
  return (['marketing','commercial','designer','editor'].includes(user.role) ? user.role : 'commercial') as ManagementRole;
}

export default function ManagementSidebar({ open = false, onClose = () => {}, currentUser = null, collapsed = false, onToggleCollapsed = () => {} }: { open?: boolean; onClose?: () => void; currentUser?: User | null; collapsed?: boolean; onToggleCollapsed?: () => void }) {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const role = resolveRole(currentUser);
  const visible = links.filter((link) => (link.roles as readonly string[]).includes(role));
  const active = (href: string) => href === '/gestao' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside className={cn('fixed inset-y-0 left-0 z-50 flex min-h-screen flex-col border-r border-slate-200 bg-white transition-[width,transform] dark:border-slate-800 dark:bg-slate-950 md:relative', collapsed ? 'w-20' : 'w-64', open ? 'translate-x-0' : '-translate-x-full md:translate-x-0')}>
      <div className={cn('flex min-h-16 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-800', collapsed && 'flex-col gap-2 px-2 py-3')}>
        {collapsed ? <KukuGestIcon size={38} /> : <KukuGestLogo height={38} />}
        <button onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-900 md:hidden"><X className="h-4 w-4" /></button>
      </div>
      {!collapsed ? <div className="px-4 pb-2 pt-4"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Gestão e KPI</p><p className="mt-1 truncate text-sm font-semibold text-slate-700 dark:text-slate-200">{currentUser?.name}</p></div> : null}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {visible.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} onClick={onClose} title={collapsed ? label : undefined} className={cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition', collapsed && 'justify-center px-2', active(href) ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white')}>
            <Icon className="h-[18px] w-[18px]" />{!collapsed ? <span>{label}</span> : null}
          </Link>
        ))}
      </nav>
      <div className="space-y-1 border-t border-slate-200 p-3 dark:border-slate-800">
        <button onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')} title={collapsed ? (resolvedTheme === 'dark' ? 'Modo claro' : 'Modo escuro') : undefined} className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900', collapsed && 'justify-center px-2')}>
          {resolvedTheme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}{!collapsed ? (resolvedTheme === 'dark' ? 'Modo claro' : 'Modo escuro') : null}
        </button>
        <button onClick={() => { window.location.href = '/auth/signout'; }} title={collapsed ? 'Terminar sessão' : undefined} className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30', collapsed && 'justify-center px-2')}><LogOut className="h-[18px] w-[18px]" />{!collapsed ? 'Terminar sessão' : null}</button>
      </div>
      <button type="button" onClick={onToggleCollapsed} className="absolute -right-2 top-1/2 z-10 hidden h-8 w-4 -translate-y-1/2 items-center justify-center rounded-r border border-l-0 border-slate-200 bg-white/80 text-slate-300 opacity-70 transition hover:bg-white hover:text-slate-700 hover:opacity-100 dark:border-slate-700 dark:bg-slate-950/80 dark:hover:bg-slate-950 md:flex" title={collapsed ? 'Expandir menu' : 'Minimizar menu'} aria-label={collapsed ? 'Expandir menu' : 'Minimizar menu'}>{collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}</button>
    </aside>
  );
}
