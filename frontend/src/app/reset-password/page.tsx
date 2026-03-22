'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { BackgroundGradientAnimation } from '@/components/ui/background-gradient-animation';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get('code');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    // Strategy 1: PKCE flow — URL has ?code=xxx
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error: exchError }) => {
        if (exchError) {
          setError('Link de reset expirado ou inválido. Solicite um novo.');
        } else {
          setSessionReady(true);
        }
        setInitializing(false);
      });
      return;
    }

    // Strategy 2: Implicit/hash flow — URL has #access_token=xxx&type=recovery
    // Supabase fires PASSWORD_RECOVERY on onAuthStateChange when the hash token is parsed
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true);
        setInitializing(false);
      }
    });

    // Also check if there's already a session (user was redirected with hash that was auto-consumed)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionReady(true);
        setInitializing(false);
      } else {
        // If no code and no session within 3s, show error
        setTimeout(() => {
          setInitializing(false);
        }, 3000);
      }
    });

    return () => subscription.unsubscribe();
  }, [code]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('As passwords não correspondem');
      return;
    }

    if (password.length < 6) {
      setError('Password deve ter pelo menos 6 caracteres');
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push('/login'), 2000);
    } catch {
      setError('Erro ao definir nova password');
    } finally {
      setLoading(false);
    }
  };

  const cardContent = () => {
    if (initializing) {
      return (
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0A2540] mx-auto mb-4" />
          <p className="text-[#6b7e9a] text-sm">A verificar link...</p>
        </div>
      );
    }

    if (!sessionReady && !initializing) {
      return (
        <div className="p-8 text-center">
          <h1 className="text-2xl font-bold text-[#0A2540] mb-4" style={{ fontFamily: "'Montserrat', sans-serif" }}>Link Inválido</h1>
          <p className="text-[#6b7e9a] mb-6">
            {error || 'Este link de reset é inválido ou expirou. Por favor, solicite um novo.'}
          </p>
          <Link href="/forgot-password">
            <Button className="w-full bg-[#0A2540] hover:bg-[#0d3060]">
              Solicitar Novo Reset
            </Button>
          </Link>
        </div>
      );
    }

    return (
      <div className="p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#0A2540] mb-4">
            <span className="text-white font-black text-lg" style={{ fontFamily: "'Montserrat', sans-serif" }}>U</span>
          </div>
          <h1 className="text-2xl font-bold text-[#0A2540]" style={{ fontFamily: "'Montserrat', sans-serif" }}>Nova Password</h1>
          <p className="text-[#6b7e9a] text-sm mt-1">Escolha uma password segura</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}

        {success ? (
          <div className="text-center space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-700 font-medium">Password definida com sucesso!</p>
              <p className="text-green-600 text-sm mt-2">A redirecionar para login...</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="text-[#0A2540]">Nova Password</Label>
              <Input
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-[#0A2540]">Confirmar Password</Label>
              <Input
                type="password"
                placeholder="Repita a password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="mt-1"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0A2540] hover:bg-[#0d3060]"
            >
              {loading ? 'A guardar...' : 'Definir Nova Password'}
            </Button>

            <div className="text-center">
              <Link href="/login" className="text-sm text-[#0A2540] hover:text-[#0d3060] transition">
                Voltar para Login
              </Link>
            </div>
          </form>
        )}
      </div>
    );
  };

  return (
    <BackgroundGradientAnimation containerClassName="min-h-screen">
      <div className="absolute inset-0 flex items-center justify-center p-4 z-10">
        <Card className="w-full max-w-md shadow-xl bg-white/90 backdrop-blur-sm">
          {cardContent()}
        </Card>
      </div>
    </BackgroundGradientAnimation>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0A2540]" />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
