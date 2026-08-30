'use client';

import { AlertTriangle, RefreshCw, LogOut } from 'lucide-react';

interface Props {
  onRetry: () => void;
  onSignOut?: () => void;
}

export default function ServerConnectionError({ onRetry, onSignOut }: Props) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-amber-500/10">
          <AlertTriangle className="h-5 w-5 text-amber-400" />
        </div>
        <h1 className="text-lg font-semibold text-white">
          Não conseguimos conectar ao servidor.
        </h1>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          A sua sessão pode estar ativa, mas não foi possível carregar os dados da conta. Vamos tentar novamente automaticamente.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-gradient-to-r from-[#FF6B35] to-[#FF3D00] px-4 text-sm font-semibold text-white transition hover:opacity-90"
          >
            <RefreshCw className="h-4 w-4" />
            Tentar novamente
          </button>
          <button
            type="button"
            onClick={onSignOut ?? (() => { window.location.href = '/auth/signout'; })}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 px-4 text-sm font-semibold text-zinc-300 transition hover:bg-white/5"
          >
            <LogOut className="h-4 w-4" />
            Voltar ao login
          </button>
        </div>
      </div>
    </div>
  );
}
