'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  getMyAccounts,
  setActiveAccountId,
  getActiveAccountId,
  type AccessibleAccount,
} from '@/lib/api';

export default function SelectAccountPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<AccessibleAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selecting, setSelecting] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    getMyAccounts()
      .then(({ accounts }) => {
        if (!mounted) return;
        // Se só houver uma conta, não há nada para escolher.
        if (accounts.length <= 1) {
          setActiveAccountId(accounts[0]?.accountOwnerId ?? null);
          router.replace('/');
          return;
        }
        setAccounts(accounts);
      })
      .catch((e) => mounted && setError(e?.message || 'Erro ao carregar contas'));
    return () => {
      mounted = false;
    };
  }, [router]);

  function choose(account: AccessibleAccount) {
    setSelecting(account.accountOwnerId);
    setActiveAccountId(account.accountOwnerId);
    // Recarrega na raiz para que todos os dados sejam obtidos na nova conta.
    window.location.href = '/';
  }

  const currentActive = getActiveAccountId();

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-[#2c2f31] text-center">Escolha uma conta</h1>
        <p className="mt-2 text-sm text-[#6b7e9a] text-center">
          Tem acesso a várias contas. Seleccione em qual pretende trabalhar.
        </p>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!accounts && !error && (
          <p className="mt-8 text-center text-sm text-[#6b7e9a]">A carregar contas…</p>
        )}

        <div className="mt-6 space-y-3">
          {accounts?.map((account) => (
            <button
              key={account.accountOwnerId}
              onClick={() => choose(account)}
              disabled={selecting !== null}
              className="w-full flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left transition-colors hover:bg-slate-100 disabled:opacity-60"
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[var(--workspace-primary,#8B5CF6)] text-sm font-bold text-white">
                {account.accountName?.slice(0, 2).toUpperCase() || '??'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-semibold text-[#2c2f31]">{account.accountName}</p>
                <p className="text-xs text-[#6b7e9a]">
                  {account.isOwner ? 'Dono da conta' : `Membro (${account.role})`}
                  {account.accountOwnerId === currentActive ? ' · activa' : ''}
                </p>
              </div>
              {selecting === account.accountOwnerId && (
                <span className="text-xs text-[#6b7e9a]">A entrar…</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
