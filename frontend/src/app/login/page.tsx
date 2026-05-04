'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Activity, Copy, Lock, Mail, RefreshCw } from 'lucide-react';
import { BackgroundGradientAnimation } from '@/components/ui/background-gradient-animation';
import { KukuGestLoginLogo } from '@/components/KukuGestLogo';
import {
  getLoginUserMessage,
  isRetryableLoginCode,
  type LoginTechnicalError,
} from '@/lib/auth-error-codes';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [retryingProfile, setRetryingProfile] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);
  const [error, setError] = useState<LoginTechnicalError | null>(null);
  const [diagnostics, setDiagnostics] = useState<Record<string, unknown> | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const supportCode = error
    ? JSON.stringify({
      code: error.code,
      requestId: error.requestId,
      details: error.details,
    })
    : '';

  const copySupportCode = async () => {
    if (!supportCode || typeof navigator === 'undefined') return;
    await navigator.clipboard?.writeText(supportCode).catch(() => {});
  };

  const runDiagnostics = async () => {
    setDiagnosing(true);
    try {
      const response = await fetch('/api/auth/diagnostics', { cache: 'no-store' });
      const payload = await response.json().catch(() => null);
      setDiagnostics(payload || { ok: false, code: 'LOGIN_DIAGNOSTICS_FAILED' });
    } catch {
      setDiagnostics({ ok: false, code: 'LOGIN_NETWORK_ERROR' });
    } finally {
      setDiagnosing(false);
    }
  };

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
    setDiagnostics(null);
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

  return (
    <BackgroundGradientAnimation
      containerClassName="min-h-screen"
      interactive={false}
      size="110%"
      blendingValue="soft-light"
    >
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_top_left,rgba(140,169,255,0.28),transparent_28%),radial-gradient(circle_at_top_right,rgba(114,141,229,0.22),transparent_24%),linear-gradient(180deg,rgba(6,16,36,0.08),rgba(6,16,36,0.38))]" />

      <div className="absolute inset-0 z-10 flex items-center justify-center px-4 py-10 sm:px-6">
        <div className="relative w-full max-w-[28.5rem]">
          <div className="absolute inset-x-10 -top-10 h-20 rounded-full bg-white/15 blur-3xl" />

          <div className="relative overflow-hidden rounded-[2rem] border border-white/35 bg-[linear-gradient(180deg,rgba(181,191,205,0.42),rgba(111,124,141,0.52))] p-6 shadow-[0_30px_80px_rgba(6,16,36,0.38),inset_0_1px_0_rgba(255,255,255,0.3)] backdrop-blur-[22px] sm:p-8">
            <div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-[linear-gradient(135deg,rgba(255,255,255,0.22),transparent_32%,transparent_68%,rgba(255,255,255,0.08))]" />

            <div className="relative text-center">
              <KukuGestLoginLogo showTagline className="mx-auto mb-5" />
              <p className="mt-1 text-sm text-white/75 sm:text-base">Bem-vindo de volta</p>
            </div>

            {error && (
              <div className="relative mt-7 space-y-3 rounded-2xl border border-[#ffb3bc]/40 bg-[#811b27]/22 px-4 py-3 text-sm text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                <div>{error.message}</div>

                <div className="rounded-xl border border-white/15 bg-black/15 p-3 text-xs text-white/80">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="font-semibold text-white/90">Código para suporte</span>
                    <button
                      type="button"
                      onClick={copySupportCode}
                      className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-white/20 px-2 text-[11px] text-white/85 transition hover:bg-white/10"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copiar
                    </button>
                  </div>
                  <code className="block break-words font-mono text-[11px] leading-relaxed text-white/75">
                    {supportCode}
                  </code>
                </div>

                <div className="flex flex-wrap gap-2">
                  {isRetryableLoginCode(error.code) && (
                    <button
                      type="button"
                      onClick={retryProfileLoad}
                      disabled={retryingProfile}
                      className="inline-flex h-9 items-center gap-2 rounded-lg bg-white/15 px-3 text-xs font-semibold text-white transition hover:bg-white/22 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${retryingProfile ? 'animate-spin' : ''}`} />
                      {retryingProfile ? 'A tentar...' : 'Tentar novamente'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={runDiagnostics}
                    disabled={diagnosing}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/20 px-3 text-xs font-semibold text-white/85 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Activity className={`h-3.5 w-3.5 ${diagnosing ? 'animate-pulse' : ''}`} />
                    {diagnosing ? 'A diagnosticar...' : 'Diagnóstico'}
                  </button>
                </div>
              </div>
            )}

            {diagnostics && (
              <div className="relative mt-3 rounded-2xl border border-white/18 bg-black/18 px-4 py-3 text-xs text-white/78">
                <div className="mb-2 font-semibold text-white/90">Diagnóstico técnico</div>
                <pre className="max-h-44 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed">
                  {JSON.stringify(diagnostics, null, 2)}
                </pre>
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
            </form>
          </div>
        </div>
      </div>
    </BackgroundGradientAnimation>
  );
}
