'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import KukuGestLogo from '@/components/KukuGestLogo';

export default function AppBootLoading() {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 7_000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-black px-4">
      <KukuGestLogo height={48} />
      <div className="flex flex-col items-center gap-2 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
        <p className="text-sm text-white">A ligar ao KukuGest...</p>
        <p className="text-xs text-zinc-400">Estamos a preparar a sua conta.</p>
        {slow && (
          <p className="mt-1 text-xs text-amber-400">
            Está a demorar mais do que o normal...
          </p>
        )}
      </div>
    </div>
  );
}
