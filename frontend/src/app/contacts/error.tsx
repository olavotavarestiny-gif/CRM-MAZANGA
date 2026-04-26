'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/ui/error-state';

export default function ContactsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[contacts] render error', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <ErrorState
        title="Não foi possível abrir Contactos"
        message="A aba encontrou dados inesperados ou uma falha temporária no beta. O erro foi isolado para não derrubar a aplicação inteira."
        onRetry={reset}
        secondaryAction={{ label: 'Voltar ao Painel', href: '/' }}
      />
    </div>
  );
}
