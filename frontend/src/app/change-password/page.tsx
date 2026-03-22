'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { changePassword } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('As passwords não correspondem');
      return;
    }

    if (newPassword.length < 6) {
      setError('A password deve ter pelo menos 6 caracteres');
      return;
    }

    setLoading(true);

    try {
      await changePassword(newPassword);
      router.push('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao alterar password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold mb-2">Mudar Password</h1>
            <p className="text-gray-500 text-sm">
              Por favor, defina uma nova password para continuar
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="text-gray-700">Nova Password</Label>
              <Input
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-gray-700">Confirmar Password</Label>
              <Input
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="mt-1"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Alterando...' : 'Alterar Password'}
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
