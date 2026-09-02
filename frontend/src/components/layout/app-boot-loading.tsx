'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import KukuGestLogo, { KukuGestFoodLogo } from '@/components/KukuGestLogo';
import { isFoodProduct } from '@/lib/product';

// Mensagens encadeadas para tranquilizar o utilizador: o arranque é normal,
// e se demorar mais é porque o servidor está a acordar — não porque está partido.
const STAGES = [
  { at: 0, text: 'Estamos a preparar a sua conta.', hint: null as string | null },
  {
    at: 7_000,
    text: 'A estabelecer ligação segura ao servidor…',
    hint: 'Isto é normal nos primeiros segundos.',
  },
  {
    at: 16_000,
    text: 'Quase lá — a sincronizar os seus dados…',
    hint: 'Obrigado pela paciência, falta pouco.',
  },
] as const;

export default function AppBootLoading() {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const timers = STAGES.slice(1).map((s, i) =>
      setTimeout(() => setStage(i + 1), s.at)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  const current = STAGES[stage];
  const foodProduct = isFoodProduct();

  return (
    <div className={`flex min-h-screen flex-col items-center justify-center gap-6 px-4 ${foodProduct ? 'workspace-food bg-[#17181a]' : 'bg-black'}`}>
      {foodProduct ? <KukuGestFoodLogo light showBetaBadge /> : <KukuGestLogo height={48} />}
      <div className="flex w-full max-w-xs flex-col items-center gap-3 text-center">
        <Loader2 className={`h-6 w-6 animate-spin ${foodProduct ? 'text-[#ef5965]' : 'text-purple-500'}`} />
        <p className="text-sm text-white">A ligar ao {foodProduct ? 'KukuGest Food' : 'KukuGest'}…</p>
        <p className="text-xs text-zinc-400">{current.text}</p>

        {/* Barra de progresso indeterminada (apenas visual, indica atividade) */}
        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div className={`h-full w-1/3 animate-boot-progress rounded-full ${foodProduct ? 'bg-[#b4232d]' : 'bg-gradient-to-r from-purple-500 to-purple-400'}`} />
        </div>

        {current.hint && (
          <p className="mt-1 text-xs text-amber-400">{current.hint}</p>
        )}
      </div>

      <style jsx>{`
        @keyframes boot-progress {
          0% {
            transform: translateX(-120%);
          }
          100% {
            transform: translateX(420%);
          }
        }
        .animate-boot-progress {
          animation: boot-progress 1.4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
