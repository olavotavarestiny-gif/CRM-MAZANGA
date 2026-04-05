'use client';

import { useRouter } from 'next/navigation';
import type { DailySuggestion } from '@/lib/api';

interface SuggestionCardProps {
  suggestion: DailySuggestion['suggestion'];
  className?: string;
}

export default function SuggestionCard({ suggestion, className = '' }: SuggestionCardProps) {
  const router = useRouter();

  if (!suggestion) return null;

  return (
    <div className={`bg-white/5 border border-white/10 rounded-xl p-4 ${className}`}>
      <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-2">
        Sugestão para hoje
      </p>
      <p className="text-sm font-semibold text-white mb-1">{suggestion.title}</p>
      <p className="text-sm text-zinc-400 leading-snug">{suggestion.message}</p>
      {suggestion.ctaLabel && suggestion.ctaAction && (
        <button
          onClick={() => router.push(suggestion.ctaAction!)}
          className="mt-3 text-xs font-medium text-purple-400 hover:text-purple-300 border border-purple-400/30 hover:border-purple-300/50 rounded-lg px-3 py-1.5 transition-colors"
        >
          {suggestion.ctaLabel}
        </button>
      )}
    </div>
  );
}
