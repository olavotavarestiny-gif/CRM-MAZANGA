'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Building2, ChevronRight, FileText, Flag, LayoutDashboard, Lightbulb, LogOut, Menu, Megaphone, TrendingUp } from 'lucide-react';
import { ReactNode, Suspense, useState } from 'react';
import { growthApi } from '@/lib/growth-api';
import { GrowthBrand } from './growth-brand';

const clientLinks = [
  ['overview','Visão geral',LayoutDashboard], ['origins','Origem dos contactos',TrendingUp], ['funnel','Funil simples',BarChart3],
  ['campaigns','Campanhas e ações',Megaphone], ['reading','Leitura estratégica',Lightbulb], ['decisions','Próximas decisões',Flag], ['report','Relatório',FileText],
] as const;

function Inner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const [open, setOpen] = useState(false);
  const publicPage = ['/login','/forgot-password','/reset-password','/change-password'].includes(pathname);
  const bootstrap = useQuery({ queryKey: ['growth-bootstrap'], queryFn: growthApi.bootstrap, enabled: !publicPage, retry: 1 });
  if (publicPage) return <>{children}</>;
  if (bootstrap.isLoading) return <div className="growth-brand-bg grid min-h-screen place-items-center text-white"><div className="text-center"><div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-2 border-[#FF5D00] border-t-transparent"/><p className="text-sm text-white/55">A preparar a tua sala de crescimento…</p></div></div>;
  if (bootstrap.isError) return <div className="growth-brand-bg grid min-h-screen place-items-center px-6 text-white"><div className="growth-surface max-w-md rounded-3xl p-8 text-center"><GrowthBrand className="justify-center"/><h1 className="mt-8 text-2xl font-bold text-white">Acesso indisponível</h1><p className="mt-3 text-sm leading-6 text-white/55">Não foi possível abrir a Growth Room com esta conta.</p><a className="growth-brand-button mt-6 inline-flex rounded-lg px-5 py-3 text-sm font-bold text-white" href="/api/auth/signout">Terminar sessão</a></div></div>;
  const role = bootstrap.data?.role;
  const admin = role === 'mazanga_admin';
  const section = search.get('secao') || 'overview';
  const previewing = admin && pathname.startsWith('/sala');
  const links = admin && !previewing ? [] : clientLinks;
  const previewQuery = previewing ? `&clientId=${encodeURIComponent(search.get('clientId')||'')}&periodId=${encodeURIComponent(search.get('periodId')||'')}` : '';
  const sidebar = <aside className="flex h-full w-[282px] flex-col border-r border-white/[.08] bg-[#080808]/95 p-5 backdrop-blur-xl"><GrowthBrand priority/><div className="mt-10 flex-1"><p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.2em] text-white/30">{previewing ? 'Pré-visualização' : admin ? 'Gestão Mazanga' : 'Sala de crescimento'}</p>{admin&&<Link onClick={()=>setOpen(false)} href="/clientes" className={`mb-2 flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold ${pathname.startsWith('/clientes') ? 'growth-nav-active text-white' : 'text-white/55 hover:bg-white/5 hover:text-white'}`}><Building2 className="h-4 w-4"/>{previewing?'Voltar aos clientes':'Clientes'}</Link>}{links.length>0&&<nav className="space-y-1">{links.map(([key,label,Icon])=><Link onClick={()=>setOpen(false)} key={key} href={`/sala?secao=${key}${previewQuery}`} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${section===key ? 'growth-nav-active font-bold text-white' : 'text-white/55 hover:bg-white/5 hover:text-white'}`}><Icon className="h-4 w-4"/><span className="flex-1">{label}</span>{section===key && <ChevronRight className="h-3.5 w-3.5"/>}</Link>)}</nav>}</div><a href="/api/auth/signout" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-white/45 hover:bg-white/5 hover:text-white"><LogOut className="h-4 w-4"/>Terminar sessão</a><p className="mt-4 border-t border-white/[.06] px-3 pt-4 text-[10px] leading-4 text-white/20">Estratégia, decisão e<br/>crescimento mensurável.</p></aside>;
  return <div className="workspace-growth-room growth-brand-bg flex h-screen overflow-hidden text-[#f1f5f9]">
    <div className="hidden md:block">{sidebar}</div>
    {open && <><button aria-label="Fechar menu" className="fixed inset-0 z-40 bg-black/70 md:hidden" onClick={()=>setOpen(false)}/><div className="fixed inset-y-0 left-0 z-50 md:hidden">{sidebar}</div></>}
    <div className="flex min-w-0 flex-1 flex-col"><header className="flex h-16 shrink-0 items-center justify-between border-b border-white/[.07] bg-black/75 px-4 backdrop-blur-xl md:px-8"><button className="rounded-xl border border-white/10 p-2 text-white md:hidden" onClick={()=>setOpen(true)}><Menu className="h-5 w-5"/></button><div className="md:hidden"><GrowthBrand/></div><div className="hidden md:block"><p className="growth-gradient-text text-xs font-semibold uppercase tracking-[.18em]">{admin ? 'Admin Mazanga' : 'Espaço do cliente'}</p></div><span className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/55 sm:inline-flex">Dados atualizados pela Mazanga</span></header><main className="min-h-0 flex-1 overflow-y-auto">{children}</main></div>
  </div>;
}

export default function GrowthLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={null}><Inner>{children}</Inner></Suspense>;
}
