'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { BackgroundGradientAnimation } from '@/components/ui/background-gradient-animation';

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

      // redirectTo points to our server-side callback route
      // which exchanges the code and redirects to /reset-password
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
    <BackgroundGradientAnimation containerClassName="min-h-screen">
      <div className="absolute inset-0 flex items-center justify-center p-4 z-10">
        <Card className="w-full max-w-md shadow-xl bg-white/90 backdrop-blur-sm">
          <div className="p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#0A2540] mb-4">
                <span className="text-white font-black text-lg" style={{ fontFamily: "'Montserrat', sans-serif" }}>U</span>
              </div>
              <h1 className="text-2xl font-bold text-[#0A2540]" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                Recuperar Password
              </h1>
              <p className="text-[#6b7e9a] text-sm mt-1">Enviaremos um link para o seu email</p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {error}
              </div>
            )}

            {success ? (
              <div className="space-y-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
                  <p className="text-green-700 font-semibold">Email enviado!</p>
                  <p className="text-green-600 text-sm mt-2">
                    Verifique a sua caixa de entrada (e o spam) e clique no link.
                  </p>
                </div>
                <Link href="/login">
                  <Button variant="outline" className="w-full border-[#0A2540] text-[#0A2540]">
                    Voltar para Login
                  </Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
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
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#0A2540] hover:bg-[#0d3060]"
                >
                  {loading ? 'A enviar...' : 'Enviar Link de Reset'}
                </Button>
                <div className="text-center">
                  <Link href="/login" className="text-sm text-[#0A2540] hover:text-[#0d3060] transition">
                    Voltar para Login
                  </Link>
                </div>
              </form>
            )}
          </div>
        </Card>
      </div>
    </BackgroundGradientAnimation>
  );
}
