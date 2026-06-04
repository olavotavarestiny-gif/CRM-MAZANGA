'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { acknowledgePasswordChange } from '@/lib/api';
import { BackgroundGradientAnimation } from '@/components/ui/background-gradient-animation';
import { KukuGestLoginLogo } from '@/components/KukuGestLogo';
import { PasswordRequirements } from '@/components/password-requirements';
import {
  formatPasswordProviderError,
  getPasswordValidationError,
} from '@/lib/password-policy';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const linkError = searchParams.get('error');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [checking, setChecking] = useState(true);

  // Track recovery-session state across the component lifetime so we can
  // tear it down if the user leaves without completing the reset.
  const hasSessionRef = useRef(false);
  const completedRef = useRef(false);

  useEffect(() => {
    hasSessionRef.current = hasSession;
  }, [hasSession]);

  // If the user abandons the page with an active recovery session (clicks
  // away, closes the tab, navigates manually) without setting a new password,
  // sign them out so the recovery link does not grant lasting access.
  useEffect(() => {
    return () => {
      if (hasSessionRef.current && !completedRef.current) {
        createClient().auth.signOut().catch(() => { /* best-effort */ });
      }
    };
  }, []);

  useEffect(() => {
    const supabase = createClient();

    const resolveRecoverySession = async () => {
      const hash = typeof window !== 'undefined' ? window.location.hash.replace(/^#/, '') : '';
      const hashParams = new URLSearchParams(hash);
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const type = hashParams.get('type');

      if (type === 'recovery' && accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (!error) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      setHasSession(!!session);
      setChecking(false);
    };

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || !!session) {
        setHasSession(true);
        setChecking(false);
      }
    });

    resolveRecoverySession().catch(() => {
      setHasSession(false);
      setChecking(false);
    });

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('As passwords não correspondem');
      return;
    }
    const passwordError = getPasswordValidationError(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(formatPasswordProviderError(updateError.message));
        return;
      }
      // Clear mustChangePassword flag in our DB (avoids forced redirect after reset)
      try { await acknowledgePasswordChange(); } catch { /* non-critical */ }
      completedRef.current = true;
      setSuccess(true);
      setTimeout(() => router.push('/'), 2000);
    } catch {
      setError('Erro ao definir nova password');
    } finally {
      setLoading(false);
    }
  };

  // Cancelling must destroy the recovery session — otherwise returning to
  // /login would log the user straight into the account without resetting.
  const handleCancel = async () => {
    completedRef.current = true; // prevent the unmount cleanup from double signing-out
    try { await createClient().auth.signOut(); } catch { /* best-effort */ }
    router.push('/login');
  };

  const content = () => {
    // Show spinner while checking session
    if (checking) {
      return (
        <div className="relative py-10 text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-b-2 border-white" />
          <p className="text-sm text-white/75">A verificar...</p>
        </div>
      );
    }

    // Link expired or missing session
    if (linkError === 'link_expired' || (!hasSession && !checking)) {
      return (
        <div className="relative text-center">
          <KukuGestLoginLogo className="mx-auto mb-5" />
          <h1 className="text-xl font-semibold text-white sm:text-2xl">Link expirado</h1>
          <p className="mt-2 text-sm text-white/75">
            Este link de reset expirou ou já foi usado. Solicita um novo.
          </p>
          <Link
            href="/forgot-password"
            className="mt-7 flex h-12 w-full items-center justify-center rounded-[0.95rem] bg-[linear-gradient(180deg,#12356b,#071a36)] text-sm font-semibold text-white shadow-[0_12px_30px_rgba(4,16,38,0.35),inset_0_1px_0_rgba(255,255,255,0.12)] transition hover:brightness-110"
          >
            Pedir novo link
          </Link>
          <div className="pt-3 text-center">
            <Link href="/login" className="text-sm text-white/78 transition hover:text-white">
              Voltar para Login
            </Link>
          </div>
        </div>
      );
    }

    // Password form
    return (
      <>
        <div className="relative text-center">
          <KukuGestLoginLogo className="mx-auto mb-5" />
          <h1 className="text-xl font-semibold text-white sm:text-2xl">Nova password</h1>
          <p className="mt-1 text-sm text-white/75">
            Escolhe uma password segura com maiúsculas, minúsculas, número e símbolo.
          </p>
        </div>

        {error && (
          <div className="relative mt-7 rounded-2xl border border-[#ffb3bc]/40 bg-[#811b27]/22 px-4 py-3 text-sm text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            {error}
          </div>
        )}

        {success ? (
          <div className="relative mt-7 rounded-2xl border border-[#6ee7b7]/40 bg-[#064e3b]/25 px-4 py-4 text-center text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <p className="font-semibold text-white">Password definida!</p>
            <p className="mt-1 text-sm text-white/80">A redirecionar...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="relative mt-7 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-white/88">Nova Password</label>
              <div className="group relative">
                <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/55 transition-colors group-focus-within:text-white/80" />
                <input
                  type="password"
                  placeholder="Ex: MinhaSenha@2026"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoFocus
                  className="h-14 w-full rounded-[0.95rem] border border-white/55 bg-white/[0.06] pl-11 pr-4 text-[0.95rem] text-white placeholder:text-white/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] outline-none transition focus:border-white/80 focus:bg-white/[0.09] focus:ring-2 focus:ring-white/20"
                />
              </div>
              <PasswordRequirements password={password} className="mt-2 text-white/70" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-white/88">Confirmar Password</label>
              <div className="group relative">
                <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/55 transition-colors group-focus-within:text-white/80" />
                <input
                  type="password"
                  placeholder="Repete a password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
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
              {loading ? 'A guardar...' : 'Definir Nova Password'}
            </button>
            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={handleCancel}
                className="text-sm text-white/78 transition hover:text-white"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </>
    );
  };

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
            {content()}
          </div>
        </div>
      </div>
    </BackgroundGradientAnimation>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#06101f]">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-white" />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
