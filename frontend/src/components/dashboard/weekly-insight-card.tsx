'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react';

const INSIGHTS = [
  {
    title: 'Pipeline',
    message: 'Os seus negócios em "Proposta" precisam de seguimento. Contacte os clientes esta semana.',
  },
  {
    title: 'Tarefas',
    message: 'Complete as tarefas atrasadas primeiro. A consistência é a chave para fechar negócios.',
  },
  {
    title: 'Clientes',
    message: 'Adicione pelo menos 5 novos contactos esta semana para manter o pipeline saudável.',
  },
  {
    title: 'Reuniões',
    message: 'Agende um check-in com os seus 3 principais clientes este mês.',
  },
  {
    title: 'Conversão',
    message: 'A taxa de conversão média é 24%. Analise os negócios perdidos para identificar padrões.',
  },
  {
    title: 'Seguimento',
    message: 'Negócios em "Negociação" há mais de 14 dias precisam de atenção urgente.',
  },
  {
    title: 'Crescimento',
    message: 'Partilhe conteúdo de valor com a sua lista esta semana. Nutrindo leads = mais conversões.',
  },
];

export default function WeeklyInsightCard({
  pendingTasks,
  pipelineCount,
  className = '',
}: {
  pendingTasks?: number;
  pipelineCount?: number;
  className?: string;
}) {
  const [current, setCurrent] = useState(0);

  // Start with today's day to cycle predictably
  useEffect(() => {
    setCurrent(new Date().getDay() % INSIGHTS.length);
  }, []);

  // Auto-rotate every 6 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % INSIGHTS.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const insight = INSIGHTS[current];

  const handlePrev = () => setCurrent((prev) => (prev - 1 + INSIGHTS.length) % INSIGHTS.length);
  const handleNext = () => setCurrent((prev) => (prev + 1) % INSIGHTS.length);

  return (
    <div className={`bg-gradient-to-br from-[#0049e6] to-[#0040cb] rounded-xl p-6 text-white shadow-lg overflow-hidden relative ${className}`}>
      {/* Background decorative icon */}
      <TrendingUp className="absolute -right-8 -bottom-8 w-32 h-32 opacity-10" />

      {/* Content */}
      <div className="relative z-10">
        <p className="text-xs font-bold uppercase tracking-widest mb-2 opacity-90">Dica da Semana</p>
        <h3 className="text-lg font-bold mb-2">{insight.title}</h3>
        <p className="text-white/90 text-sm leading-relaxed">{insight.message}</p>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={handlePrev}
            className="p-1 hover:bg-white/20 rounded transition-colors"
            aria-label="Previous insight"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* Progress dots */}
          <div className="flex gap-1">
            {INSIGHTS.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`h-2 rounded-full transition-all ${
                  i === current ? 'bg-white w-6' : 'bg-white/40 w-2'
                }`}
                aria-label={`Go to insight ${i + 1}`}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            className="p-1 hover:bg-white/20 rounded transition-colors"
            aria-label="Next insight"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
