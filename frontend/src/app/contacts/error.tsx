'use client';

export default function ContactsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-center">
        <h2 className="text-base font-semibold text-[#0A2540]">Não foi possível abrir Contactos</h2>
        <p className="mt-2 text-sm text-[#64748B]">
          A aba encontrou uma falha temporária no beta. Tenta recarregar a área de contactos.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-[var(--workspace-primary)] px-5 py-2 text-sm font-semibold text-[var(--workspace-on-primary)]"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="rounded-lg border border-[var(--workspace-primary)] bg-white px-5 py-2 text-sm font-semibold text-[var(--workspace-primary)]"
          >
            Voltar ao Painel
          </a>
        </div>
      </div>
    </div>
  );
}
