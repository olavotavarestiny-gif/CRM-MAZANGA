'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getCurrentUserWithToken } from '@/lib/api';
import Link from 'next/link';
import { Mail, Lock } from 'lucide-react';
import { BackgroundGradientAnimation } from '@/components/ui/background-gradient-animation';
import { KukuGestIcon } from '@/components/KukuGestLogo';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('impersonation_token');
      }

      const supabase = createClient();

      // 1. Authenticate with Supabase
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        setError(authError.message === 'Invalid login credentials'
          ? 'Email ou password incorretos'
          : authError.message);
        return;
      }

      const accessToken = data.session?.access_token;
      if (!accessToken) {
        setError('Sessão criada sem access token. Tente novamente.');
        return;
      }

      // 2. Load user from our backend using the fresh token returned by Supabase
      const user = await getCurrentUserWithToken(accessToken);
      if (user.mustChangePassword) {
        router.push('/change-password');
      } else {
        router.push('/');
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Erro ao ligar ao servidor. Tente novamente.');
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
              <div className="mx-auto mb-4 inline-flex h-24 w-24 items-center justify-center rounded-[1.6rem] border border-white/45 bg-white/92 shadow-[0_14px_30px_rgba(6,16,36,0.16),inset_0_1px_0_rgba(255,255,255,0.7)]">
                <KukuGestIcon size={88} />
              </div>
              <p className="mt-1.5 text-sm text-white/80 sm:text-base">Bem-vindo de volta</p>
            </div>

            {error && (
              <div className="relative mt-7 rounded-2xl border border-[#ffb3bc]/40 bg-[#811b27]/22 px-4 py-3 text-sm text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                {error}
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
