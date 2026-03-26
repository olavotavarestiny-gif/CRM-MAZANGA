'use client';

import { useQuery } from '@tanstack/react-query';
import { Check, Infinity as InfinityIcon, Mail } from 'lucide-react';
import { getPlanUsage, getCurrentUser } from '@/lib/api';
import { UsageBar } from '@/components/common/usage-bar';

const PLAN_FEATURES = [
  { key: 'teamMembers',            label: 'Membros da equipa',       essencial: '5',         profissional: '25' },
  { key: 'channels',               label: 'Canais de chat',           essencial: '20',        profissional: '50' },
  { key: 'messagesPerDay',         label: 'Mensagens por dia',        essencial: '1.000',     profissional: '5.000' },
  { key: 'contacts',               label: 'Contactos CRM',            essencial: '1.000',     profissional: '10.000' },
  { key: 'invoicesPerMonth',       label: 'Faturas por mês',          essencial: '200',       profissional: 'Ilimitado' },
  { key: 'products',               label: 'Produtos',                  essencial: '100',       profissional: '1.000' },
  { key: 'activeForms',            label: 'Formulários activos',      essencial: '5',         profissional: '20' },
  { key: 'formSubmissionsPerMonth',label: 'Submissões/mês',           essencial: '500',       profissional: '5.000' },
  { key: 'customFields',           label: 'Campos personalizados',    essencial: '20',        profissional: '50' },
  { key: 'storageGb',              label: 'Storage',                  essencial: '5 GB',      profissional: '50 GB' },
  { key: 'maxFileSizeMb',          label: 'Tamanho máx. ficheiro',    essencial: '10 MB',     profissional: '25 MB' },
  { key: 'csvImportRows',          label: 'Importação CSV (linhas)',  essencial: '500',       profissional: '5.000' },
];

const USAGE_LABELS: Record<string, string> = {
  teamMembers: 'Membros',
  channels: 'Canais',
  messagesPerDay: 'Mensagens hoje',
  contacts: 'Contactos',
  invoicesPerMonth: 'Faturas este mês',
  products: 'Produtos',
  activeForms: 'Formulários',
  formSubmissionsPerMonth: 'Submissões este mês',
  customFields: 'Campos personalizados',
};

function normalizePlan(plan?: string | null) {
  if (plan === 'profissional' || plan === 'enterprise') return 'profissional';
  return 'essencial';
}

export default function PlanosPage() {
  const { data: usageData } = useQuery({
    queryKey: ['plan-usage'],
    queryFn: getPlanUsage,
  });

  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: getCurrentUser,
  });

  const currentPlan = normalizePlan(usageData?.plan || currentUser?.plan);
  const isEssencial = currentPlan === 'essencial';

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#0A2540]">Planos e Limites</h1>
        <p className="text-[#6b7e9a] mt-1">
          Plano actual:{' '}
          <span className={`font-semibold px-2 py-0.5 rounded-full text-sm ${
            isEssencial
              ? 'bg-blue-50 text-blue-700'
              : 'bg-violet-50 text-violet-700'
          }`}>
            {isEssencial ? 'ESSENCIAL' : 'PROFISSIONAL'}
          </span>
        </p>
      </div>

      {/* Comparison table */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden mb-8">
        <div className="grid grid-cols-3">
          {/* Header */}
          <div className="px-4 py-3 border-b border-[#E2E8F0] bg-[#F8FAFC]">
            <p className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider">Funcionalidade</p>
          </div>
          <div className={`px-4 py-3 border-b border-[#E2E8F0] text-center ${isEssencial ? 'bg-blue-50' : 'bg-[#F8FAFC]'}`}>
            <p className="font-semibold text-[#0A2540] text-sm">ESSENCIAL</p>
            <p className="text-xs text-[#6b7e9a]">30.000 Kz/mês</p>
            {isEssencial && <span className="text-[10px] font-bold bg-blue-600 text-white px-2 py-0.5 rounded-full">ACTUAL</span>}
          </div>
          <div className={`px-4 py-3 border-b border-[#E2E8F0] text-center ${!isEssencial ? 'bg-violet-50' : 'bg-[#F8FAFC]'}`}>
            <p className="font-semibold text-violet-700 text-sm">PROFISSIONAL</p>
            <p className="text-xs text-[#6b7e9a]">50.000 Kz/mês</p>
            {!isEssencial && <span className="text-[10px] font-bold bg-violet-600 text-white px-2 py-0.5 rounded-full">ACTUAL</span>}
          </div>

          {/* Rows */}
          {PLAN_FEATURES.map(({ key, label, essencial, profissional }, i) => (
            <>
              <div
                key={`label-${key}`}
                className={`px-4 py-3 flex items-center text-sm text-[#374151] border-b border-[#F1F5F9] ${i % 2 === 0 ? '' : 'bg-[#FAFBFC]'}`}
              >
                {label}
              </div>
              <div
                key={`essencial-${key}`}
                className={`px-4 py-3 text-center text-sm font-medium border-b border-[#F1F5F9] ${i % 2 === 0 ? '' : 'bg-[#FAFBFC]'} ${isEssencial ? 'text-blue-700' : 'text-[#6b7e9a]'}`}
              >
                {essencial}
              </div>
              <div
                key={`prof-${key}`}
                className={`px-4 py-3 text-center text-sm font-medium border-b border-[#F1F5F9] ${i % 2 === 0 ? '' : 'bg-[#FAFBFC]'} ${!isEssencial ? 'text-violet-700' : 'text-[#6b7e9a]'}`}
              >
                {profissional === 'Ilimitado' ? (
                  <span className="flex items-center justify-center gap-1">
                    <InfinityIcon className="w-4 h-4" />
                    Ilimitado
                  </span>
                ) : profissional}
              </div>
            </>
          ))}
        </div>
      </div>

      {/* Current usage bars */}
      {usageData && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 mb-8">
          <h2 className="font-semibold text-[#0A2540] mb-4">Uso Actual</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(usageData.usage)
              .filter(([key]) => key in USAGE_LABELS)
              .map(([key, { current, limit }]) => (
                <UsageBar
                  key={key}
                  label={USAGE_LABELS[key] || key}
                  current={current}
                  limit={limit}
                />
              ))}
          </div>
        </div>
      )}

      {/* CTA */}
      {isEssencial && (
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-violet-900">Precisas de mais capacidade?</h3>
            <p className="text-sm text-violet-700 mt-1">
              Faz upgrade para o plano Profissional e desbloqueia limites maiores em todas as áreas.
            </p>
          </div>
          <a
            href="mailto:suporte@mazanga.digital?subject=Upgrade Plano Profissional"
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
          >
            <Mail className="w-4 h-4" />
            Contactar para Upgrade
          </a>
        </div>
      )}
    </div>
  );
}
