'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import Link from 'next/link';

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

  useEffect(() => {
    if (!code) {
      setError('Link de reset inválido. Por favor, use o link enviado por email.');
      return;
    }

    // Exchange the code for a session
    const supabase = createClient();
    supabase.auth.exchangeCodeForSession(code).then(({ error: exchError }) => {
      if (exchError) {
        setError('Link de reset expirado ou inválido. Solicite um novo.');
      } else {
        setSessionReady(true);
      }
    });
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
    } catch (err: any) {
      setError('Erro ao resetar password');
    } finally {
      setLoading(false);
    }
  };

  if (!code || (error && !sessionReady)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <div className="p-8 text-center">
            <h1 className="text-2xl font-bold mb-4">Link Inválido</h1>
            <p className="text-gray-500 mb-6">
              {error || 'Este link de reset é inválido ou expirou. Por favor, solicite um novo.'}
            </p>
            <Link href="/forgot-password">
              <Button className="w-full">
                Solicitar Novo Reset
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <div className="p-8">
          <h1 className="text-2xl font-bold mb-2">Nova Password</h1>
          <p className="text-gray-500 text-sm mb-6">Digite sua nova password</p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          {success ? (
            <div className="text-center space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-700 font-medium">Password alterada com sucesso!</p>
                <p className="text-green-600 text-sm mt-2">Redirecionando para login...</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label className="text-gray-700">Nova Password</Label>
                <Input
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="mt-1"
                  disabled={!sessionReady}
                />
              </div>
              <div>
                <Label className="text-gray-700">Confirmar Password</Label>
                <Input
                  type="password"
                  placeholder="Repita a password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="mt-1"
                  disabled={!sessionReady}
                />
              </div>
              <Button
                type="submit"
                disabled={loading || !sessionReady}
                className="w-full"
              >
                {loading ? 'Guardando...' : sessionReady ? 'Definir Nova Password' : 'A verificar link...'}
              </Button>

              <div className="text-center">
                <Link
                  href="/login"
                  className="text-sm text-[#0A2540] hover:text-[#0d3060] transition"
                >
                  Voltar para Login
                </Link>
              </div>
            </form>
          )}
        </div>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
