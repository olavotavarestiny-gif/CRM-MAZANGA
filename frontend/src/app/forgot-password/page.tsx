'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { BackgroundGradientAnimation } from '@/components/ui/background-gradient-animation';
import { KukuGestLoginLogo } from '@/components/KukuGestLogo';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const supabase = createClient();

      // Route recovery through /auth/callback so the PKCE code is exchanged
      // server-side and the session is set in cookies before landing on /reset-password.
      const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password`;

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setSuccess(true);
    } catch {
      setError('Erro ao enviar email. Tente novamente.');
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
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_top_left,rgba(140,169,255,0.28),transparent_28%),radial-gradient(circle_at_top_right,rgba(114,141,229,0.22),transparent_24%),linear-gradient(180deg,rgba(6,16,36,0.08),rgba(6,16,36,0.38))]" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
        <div className="relative w-full max-w-[28.5rem]">
          <div className="absolute inset-x-10 -top-10 h-20 rounded-full bg-white/15 blur-3xl" />

          <div className="relative overflow-hidden rounded-[2rem] border border-white/35 bg-[linear-gradient(180deg,rgba(181,191,205,0.42),rgba(111,124,141,0.52))] p-6 shadow-[0_30px_80px_rgba(6,16,36,0.38),inset_0_1px_0_rgba(255,255,255,0.3)] backdrop-blur-[22px] sm:p-8">
            <div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-[linear-gradient(135deg,rgba(255,255,255,0.22),transparent_32%,transparent_68%,rgba(255,255,255,0.08))]" />

            <div className="relative text-center">
              <KukuGestLoginLogo className="mx-auto mb-5" />
              <h1 className="text-xl font-semibold text-white sm:text-2xl">Recuperar password</h1>
              <p className="mt-1 text-sm text-white/75">Enviaremos um link para o seu email</p>
            </div>

            {error && (
              <div className="relative mt-7 rounded-2xl border border-[#ffb3bc]/40 bg-[#811b27]/22 px-4 py-3 text-sm text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                {error}
              </div>
            )}

            {success ? (
              <div className="relative mt-7 space-y-5">
                <div className="rounded-2xl border border-[#6ee7b7]/40 bg-[#064e3b]/25 px-4 py-4 text-center text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                  <p className="font-semibold text-white">Email enviado!</p>
                  <p className="mt-2 text-sm text-white/80">
                    Verifique a sua caixa de entrada (e o spam) e clique no link.
                  </p>
                </div>
                <Link
                  href="/login"
                  className="flex h-12 w-full items-center justify-center rounded-[0.95rem] border border-white/55 bg-white/[0.06] text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] transition hover:bg-white/[0.12]"
                >
                  Voltar para Login
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="relative mt-7 space-y-5">
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

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-1 h-12 w-full rounded-[0.95rem] bg-[linear-gradient(180deg,#12356b,#071a36)] text-sm font-semibold text-white shadow-[0_12px_30px_rgba(4,16,38,0.35),inset_0_1px_0_rgba(255,255,255,0.12)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? 'A enviar...' : 'Enviar Link de Reset'}
                </button>

                <div className="pt-1 text-center">
                  <Link href="/login" className="text-sm text-white/78 transition hover:text-white">
                    Voltar para Login
                  </Link>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </BackgroundGradientAnimation>
  );
}
