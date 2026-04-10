'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { acknowledgePasswordChange } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { BackgroundGradientAnimation } from '@/components/ui/background-gradient-animation';
import { Suspense } from 'react';
import { PasswordRequirements } from '@/components/password-requirements';
import { KukuGestIcon } from '@/components/KukuGestLogo';
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
      setSuccess(true);
      setTimeout(() => router.push('/'), 2000);
    } catch {
      setError('Erro ao definir nova password');
    } finally {
      setLoading(false);
    }
  };

  const content = () => {
    // Show spinner while checking session
    if (checking) {
      return (
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0A2540] mx-auto mb-3" />
          <p className="text-[#6b7e9a] text-sm">A verificar...</p>
        </div>
      );
    }

    // Link expired or missing session
    if (linkError === 'link_expired' || (!hasSession && !checking)) {
      return (
        <div className="p-8 text-center">
          <div className="text-center mb-6">
            <KukuGestIcon size={28} />
          </div>
          <h1 className="text-xl font-bold text-[#0A2540] mb-3" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            Link expirado
          </h1>
          <p className="text-[#6b7e9a] text-sm mb-6">
            Este link de reset expirou ou já foi usado. Solicita um novo.
          </p>
          <Link href="/forgot-password">
            <Button className="w-full bg-[#0A2540] hover:bg-[#0d3060]">
              Pedir novo link
            </Button>
          </Link>
          <div className="mt-3 text-center">
            <Link href="/login" className="text-sm text-[#0A2540] hover:text-[#0d3060]">
              Voltar para Login
            </Link>
          </div>
        </div>
      );
    }

    // Password form
    return (
      <div className="p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#0A2540] mb-4">
            <span className="text-white font-black text-lg" style={{ fontFamily: "'Montserrat', sans-serif" }}>U</span>
          </div>
          <h1 className="text-2xl font-bold text-[#0A2540]" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            Nova Password
          </h1>
          <p className="text-[#6b7e9a] text-sm mt-1">
            Escolhe uma password segura com maiúsculas, minúsculas, número e símbolo.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}

        {success ? (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
            <p className="text-green-700 font-semibold">Password definida!</p>
            <p className="text-green-600 text-sm mt-1">A redirecionar...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="text-[#0A2540]">Nova Password</Label>
              <Input
                type="password"
                placeholder="Ex: MinhaSenha@2026"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="mt-1"
                autoFocus
              />
              <PasswordRequirements password={password} className="mt-2" />
            </div>
            <div>
              <Label className="text-[#0A2540]">Confirmar Password</Label>
              <Input
                type="password"
                placeholder="Repete a password"
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
              <Link href="/login" className="text-sm text-[#0A2540] hover:text-[#0d3060]">
                Cancelar
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
          {content()}
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
