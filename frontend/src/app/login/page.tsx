'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getCurrentUserWithToken } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { BackgroundGradientAnimation } from '@/components/ui/background-gradient-animation';

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
    <BackgroundGradientAnimation containerClassName="min-h-screen">
      <div className="absolute inset-0 flex items-center justify-center p-4 z-10">
      <Card className="w-full max-w-md shadow-xl bg-white/90 backdrop-blur-sm">
        <div className="p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#0A2540] mb-4">
              <span className="text-white font-black text-lg" style={{ fontFamily: "'Montserrat', sans-serif" }}>K</span>
            </div>
            <h1 className="text-2xl font-bold text-[#0A2540]" style={{ fontFamily: "'Montserrat', sans-serif" }}>KukuGest</h1>
            <p className="text-[#6b7e9a] text-sm mt-1">Bem-vindo de volta</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label className="text-[#0A2540]">Email</Label>
              <Input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-[#0A2540]">Password</Label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>

            <div className="pt-2 text-center">
              <Link
                href="/forgot-password"
                className="text-sm text-[#0A2540] hover:text-[#0d3060] transition"
              >
                Esqueci a password
              </Link>
            </div>
          </form>
        </div>
      </Card>
      </div>
    </BackgroundGradientAnimation>
  );
}
