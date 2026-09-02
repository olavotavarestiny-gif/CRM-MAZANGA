'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Lock, Mail, RefreshCw } from 'lucide-react';
import { BackgroundGradientAnimation } from '@/components/ui/background-gradient-animation';
import { KukuGestFoodLogo, KukuGestLoginLogo } from '@/components/KukuGestLogo';
import { getLoginUserMessage, isRetryableLoginCode, type LoginTechnicalError } from '@/lib/auth-error-codes';
import { isFoodProduct, isGrowthRoomProduct } from '@/lib/product';
import { GrowthBrand } from '@/components/growth/growth-brand';

export default function LoginPage() {
  const foodProduct = isFoodProduct();
  const growthProduct = isGrowthRoomProduct();
  const [loading, setLoading] = useState(false);
  const [retryingProfile, setRetryingProfile] = useState(false);
  const [error, setError] = useState<LoginTechnicalError | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [registered, setRegistered] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('registered') === '1') {
        setRegistered(true);
        window.history.replaceState({}, '', '/login');
      }
    }
  }, []);

  const retryProfileLoad = async () => {
    setRetryingProfile(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/me', { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError({
          code: payload?.code || 'LOGIN_PROFILE_LOAD_FAILED',
          message: getLoginUserMessage(payload?.code || 'LOGIN_PROFILE_LOAD_FAILED'),
          requestId: payload?.requestId,
          details: payload?.details,
        });
        return;
      }

      window.location.assign(payload?.mustChangePassword ? '/change-password' : '/');
    } catch {
      setError({
        code: 'LOGIN_NETWORK_ERROR',
        message: getLoginUserMessage('LOGIN_NETWORK_ERROR'),
      });
    } finally {
      setRetryingProfile(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('impersonation_token');
      }

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        const code = result?.code || 'LOGIN_UNKNOWN_ERROR';
        setError({
          code,
          message: getLoginUserMessage(code),
          requestId: result?.requestId,
          details: result?.details,
        });
        return;
      }

      if (typeof window !== 'undefined') {
        window.location.assign(result?.mustChangePassword ? '/change-password' : '/');
      }
    } catch {
      setError({
        code: 'LOGIN_NETWORK_ERROR',
        message: getLoginUserMessage('LOGIN_NETWORK_ERROR'),
      });
    } finally {
      setLoading(false);
    }
  };

  if (growthProduct) {
    return (
      <main className="growth-brand-bg relative grid min-h-screen overflow-hidden px-5 py-10 text-white lg:grid-cols-[1.05fr_.95fr]">
        <div className="pointer-events-none absolute -right-40 -top-48 h-[620px] w-[620px] rounded-full bg-[#8C0DC2]/20 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-48 -left-40 h-[560px] w-[560px] rounded-full bg-[#FF5D00]/15 blur-[120px]" />
        <section className="relative hidden flex-col justify-between p-10 lg:flex xl:p-16">
          <GrowthBrand priority />
          <div className="max-w-xl"><p className="growth-gradient-text mb-6 text-xs font-bold uppercase tracking-[.22em]">Clareza para crescer</p><h2 className="font-growth-display text-5xl font-extrabold leading-[1.08] text-white xl:text-6xl">Marketing ligado a <span className="growth-gradient-text">resultados comerciais.</span></h2><p className="mt-7 max-w-lg text-base leading-7 text-white/50">Toda ação deve ajudar a explicar o que aconteceu, o que aprendemos e qual é a próxima decisão.</p></div>
          <p className="text-xs text-white/25">Mazanga Marketing · Sistemas que geram receita previsível</p>
        </section>
        <section className="relative flex items-center justify-center"><div className="growth-surface w-full max-w-md rounded-[2rem] p-7 backdrop-blur-xl sm:p-10"><div className="mb-9 lg:hidden"><GrowthBrand priority /></div><p className="growth-gradient-text text-xs font-bold uppercase tracking-[.2em]">Mazanga Growth Room</p><h1 className="font-growth-display mt-4 text-3xl font-extrabold text-white">Entra na tua sala de crescimento.</h1><p className="mt-3 text-sm leading-6 text-white/45">Acompanha os resultados, decisões e próximos passos do teu projeto com a Mazanga.</p>
          {error && <div className="mt-6 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error.message}</div>}
          <form onSubmit={handleLogin} className="mt-8 space-y-5"><label className="block text-sm font-semibold text-white/65">Email<div className="relative mt-2"><Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30"/><input type="email" autoComplete="email" required value={email} onChange={(event)=>setEmail(event.target.value)} placeholder="nome@empresa.ao" className="h-14 w-full rounded-lg border border-white/10 bg-black/35 pl-11 pr-4 text-white outline-none transition placeholder:text-white/20 focus:border-[#8C0DC2]/70 focus:ring-2 focus:ring-[#8C0DC2]/15"/></div></label><label className="block text-sm font-semibold text-white/65">Palavra-passe<div className="relative mt-2"><Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30"/><input type="password" autoComplete="current-password" required value={password} onChange={(event)=>setPassword(event.target.value)} placeholder="••••••••" className="h-14 w-full rounded-lg border border-white/10 bg-black/35 pl-11 pr-4 text-white outline-none transition placeholder:text-white/20 focus:border-[#8C0DC2]/70 focus:ring-2 focus:ring-[#8C0DC2]/15"/></div></label><button type="submit" disabled={loading} className="growth-brand-button h-14 w-full rounded-lg text-sm font-extrabold text-white transition hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-50">{loading ? 'A entrar…' : 'Entrar na Growth Room'}</button></form><div className="mt-6 text-center"><Link href="/forgot-password" className="text-sm text-white/45 hover:text-white">Recuperar palavra-passe</Link></div></div></section>
      </main>
    );
  }

  if (foodProduct) {
    return (
      <main className="workspace-food min-h-screen bg-[#f7f8fa] px-4 py-8 sm:px-6">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center">
          <section className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_18px_60px_rgba(36,24,25,0.10)]">
            <div className="border-b border-rose-100 bg-[#fff7f7] px-6 py-7 sm:px-8">
              <KukuGestFoodLogo showBetaBadge />
              <h1 className="mt-7 text-2xl font-bold text-slate-950">Entrar no restaurante</h1>
              <p className="mt-2 text-sm leading-5 text-slate-500">Caixa, cozinha, delivery e gestão num só lugar.</p>
            </div>

            <div className="px-6 py-7 sm:px-8">
              {error && (
                <div className="mb-5 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                  <p>{error.message}</p>
                  {isRetryableLoginCode(error.code) && (
                    <button type="button" onClick={retryProfileLoad} disabled={retryingProfile} className="mt-2 inline-flex items-center gap-1.5 font-semibold text-[#9f1f29] disabled:opacity-60">
                      <RefreshCw className={`h-3.5 w-3.5 ${retryingProfile ? 'animate-spin' : ''}`} />
                      {retryingProfile ? 'A tentar...' : 'Tentar novamente'}
                    </button>
                  )}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input type="email" autoComplete="email" placeholder="nome@restaurante.ao" value={email} onChange={(event) => setEmail(event.target.value)} required className="h-12 w-full rounded-md border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-950 outline-none transition focus:border-[#b4232d] focus:ring-2 focus:ring-rose-100" />
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input type="password" autoComplete="current-password" placeholder="A sua password" value={password} onChange={(event) => setPassword(event.target.value)} required className="h-12 w-full rounded-md border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-950 outline-none transition focus:border-[#b4232d] focus:ring-2 focus:ring-rose-100" />
                  </div>
                </div>
                <button type="submit" disabled={loading} className="h-12 w-full rounded-md bg-[#b4232d] text-sm font-bold text-white transition hover:bg-[#8f1c24] disabled:cursor-not-allowed disabled:opacity-60">
                  {loading ? 'A entrar...' : 'Entrar no KukuGest Food'}
                </button>
              </form>

              <div className="mt-5 flex items-center justify-between gap-4 text-xs">
                <Link href="/forgot-password" className="font-semibold text-[#9f1f29] hover:text-[#7f1820]">Recuperar password</Link>
                <span className="text-right text-slate-400">Acesso apenas por convite</span>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <BackgroundGradientAnimation
      containerClassName="min-h-screen"
      interactive={false}
      size="110%"
      blendingValue="soft-light"
    >
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_top_left,rgba(140,169,255,0.28),transparent_28%),radial-gradient(circle_at_top_right,rgba(114,141,229,0.22),transparent_24%),linear-gradient(180deg,rgba(6,16,36,0.08),rgba(6,16,36,0.38))]" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
        <div className="relative w-full max-w-[28.5rem]">
          <div className="absolute inset-x-10 -top-10 h-20 rounded-full bg-white/15 blur-3xl" />

          <div className="relative overflow-hidden rounded-[2rem] border border-white/35 bg-[linear-gradient(180deg,rgba(181,191,205,0.42),rgba(111,124,141,0.52))] p-6 shadow-[0_30px_80px_rgba(6,16,36,0.38),inset_0_1px_0_rgba(255,255,255,0.3)] backdrop-blur-[22px] sm:p-8">
            <div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-[linear-gradient(135deg,rgba(255,255,255,0.22),transparent_32%,transparent_68%,rgba(255,255,255,0.08))]" />

            <div className="relative text-center">
              <KukuGestLoginLogo showTagline className="mx-auto mb-5" />
              <p className="mt-1 text-sm text-white/75 sm:text-base">Bem-vindo de volta</p>
            </div>

            {registered && (
              <div className="relative mt-7 rounded-2xl border border-[#6ee7b7]/40 bg-[#064e3b]/25 px-4 py-3 text-sm text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                Conta criada com sucesso! Faça login para entrar.
              </div>
            )}

            {error && (
              <div className="relative mt-7 rounded-2xl border border-[#ffb3bc]/40 bg-[#811b27]/22 px-4 py-3 text-sm text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                <p>{error.message}</p>
                {isRetryableLoginCode(error.code) && (
                  <button
                    type="button"
                    onClick={retryProfileLoad}
                    disabled={retryingProfile}
                    className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-lg bg-white/15 px-3 text-xs font-semibold text-white transition hover:bg-white/22 disabled:opacity-60"
                  >
                    <RefreshCw className={`h-3 w-3 ${retryingProfile ? 'animate-spin' : ''}`} />
                    {retryingProfile ? 'A tentar...' : 'Tentar novamente'}
                  </button>
                )}
              </div>
            )}

            <form onSubmit={handleLogin} className="relative mt-7 space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-white/88">Email</label>
                <div className="group relative">
                  <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/55 transition-colors group-focus-within:text-white/80" />
                  <input
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-14 w-full rounded-[0.95rem] border border-white/55 bg-white/[0.06] pl-11 pr-4 text-[0.95rem] text-white placeholder:text-white/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] outline-none transition focus:border-white/80 focus:bg-white/[0.09] focus:ring-2 focus:ring-white/20"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-white/88">Password</label>
                <div className="group relative">
                  <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/55 transition-colors group-focus-within:text-white/80" />
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-14 w-full rounded-[0.95rem] border border-white/55 bg-white/[0.06] pl-11 pr-4 text-[0.95rem] text-white placeholder:text-white/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] outline-none transition focus:border-white/80 focus:bg-white/[0.09] focus:ring-2 focus:ring-white/20"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-1 h-12 w-full rounded-[0.95rem] bg-[linear-gradient(180deg,#12356b,#071a36)] text-sm font-semibold text-white shadow-[0_12px_30px_rgba(4,16,38,0.35),inset_0_1px_0_rgba(255,255,255,0.12)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Entrando...' : 'Entrar'}
              </button>

              <div className="pt-1 text-center">
                <Link href="/forgot-password" className="text-sm text-white/78 transition hover:text-white">
                  Esqueci a password
                </Link>
              </div>

              <div className="pt-2 text-center">
                <Link href="/register" className="text-sm text-white/78 transition hover:text-white">
                  Não tem conta?{' '}
                  <span className="font-semibold text-white">Criar conta grátis</span>
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </BackgroundGradientAnimation>
  );
}
