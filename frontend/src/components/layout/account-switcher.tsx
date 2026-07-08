'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronsUpDown, Check } from 'lucide-react';
import { getMyAccounts, setActiveAccountId } from '@/lib/api';

// Seletor de conta activa (multi-conta). Só aparece quando a pessoa tem
// acesso a mais do que uma conta.
export default function AccountSwitcher() {
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ['my-accounts'],
    queryFn: getMyAccounts,
    staleTime: 60_000,
  });

  const accounts = data?.accounts ?? [];
  if (accounts.length <= 1) return null;

  const activeId = data?.activeAccountId;
  const active = accounts.find((a) => a.accountOwnerId === activeId) ?? accounts[0];

  function switchTo(accountOwnerId: number) {
    if (accountOwnerId === activeId) {
      setOpen(false);
      return;
    }
    setActiveAccountId(accountOwnerId);
    // Recarrega na raiz para obter todos os dados na nova conta.
    window.location.href = '/';
  }

  return (
    <div className="relative mb-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left transition-colors hover:bg-slate-100"
      >
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--workspace-primary,#8B5CF6)] text-xs font-bold text-white">
          {active?.accountName?.slice(0, 2).toUpperCase() || '??'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6b7e9a]/70">
            Conta activa
          </p>
          <p className="truncate text-xs font-semibold text-[#2c2f31]">{active?.accountName}</p>
        </div>
        <ChevronsUpDown className="h-4 w-4 flex-shrink-0 text-[#6b7e9a]" />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 right-0 z-20 mb-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
          {accounts.map((account) => (
            <button
              key={account.accountOwnerId}
              type="button"
              onClick={() => switchTo(account.accountOwnerId)}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-slate-100"
            >
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-[#2c2f31]">
                {account.accountName?.slice(0, 2).toUpperCase() || '??'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-xs font-semibold text-[#2c2f31]">{account.accountName}</p>
                <p className="text-[10px] text-[#6b7e9a]">
                  {account.isOwner ? 'Dono da conta' : `Membro (${account.role})`}
                </p>
              </div>
              {account.accountOwnerId === activeId && (
                <Check className="h-4 w-4 flex-shrink-0 text-[var(--workspace-primary,#8B5CF6)]" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
