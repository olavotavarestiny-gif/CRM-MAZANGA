'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Download,
  ExternalLink,
  Lightbulb,
  PlayCircle,
  Route,
  Search,
  UserRound,
} from 'lucide-react';
import { getCurrentUser, getFoodSettings } from '@/lib/api';
import { foodGuide, foodGuideRoleLabels } from '@/content/food-guide';
import type { FoodGuideRoleId, FoodGuideTopic } from '@/content/food-guide';
import { isClientDevAuthBypassEnabled } from '@/lib/dev-auth';
import { FoodPageHeader, getFoodBrandStyle } from '@/components/food/food-ui';
import { FoodTourButton } from '@/components/food/food-tour-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type RoleFilter = 'all' | FoodGuideRoleId;

function normalized(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function matchesSearch(topic: FoodGuideTopic, search: string) {
  if (!search.trim()) return true;
  const haystack = normalized([
    topic.title,
    topic.summary,
    topic.section,
    topic.outcome,
    ...topic.steps.flatMap((step) => [step.title, step.description]),
    ...topic.tips,
    ...topic.warnings,
  ].join(' '));
  return normalized(search).split(/\s+/).every((term) => haystack.includes(term));
}

export default function FoodHelpPage() {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<RoleFilter>('all');
  const [selectedId, setSelectedId] = useState('workspace');
  const settingsQuery = useQuery({ queryKey: ['food-settings'], queryFn: getFoodSettings });
  const userQuery = useQuery({ queryKey: ['currentUser'], queryFn: getCurrentUser, retry: false });
  const currentRoles = (userQuery.data?.foodAccess?.roles ?? []) as FoodGuideRoleId[];
  const canTrainAllRoles = currentRoles.includes('manager') || isClientDevAuthBypassEnabled();
  const visibleRoles = canTrainAllRoles
    ? foodGuide.roles
    : foodGuide.roles.filter((candidate) => currentRoles.includes(candidate.id));

  const filteredTopics = useMemo(() => foodGuide.topics.filter((topic) => {
    const roleMatches = role === 'all'
      ? canTrainAllRoles || topic.roles.some((candidate) => currentRoles.includes(candidate))
      : topic.roles.includes(role);
    return roleMatches && matchesSearch(topic, search);
  }), [canTrainAllRoles, currentRoles, role, search]);

  const sections = useMemo(() => Array.from(new Set(filteredTopics.map((topic) => topic.section))), [filteredTopics]);
  const selectedTopic = filteredTopics.find((topic) => topic.id === selectedId) ?? filteredTopics[0] ?? null;

  useEffect(() => {
    const requestedTopic = searchParams.get('topic');
    if (requestedTopic && foodGuide.topics.some((topic) => topic.id === requestedTopic)) {
      setSelectedId(requestedTopic);
    }
  }, [searchParams]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6" style={getFoodBrandStyle(settingsQuery.data)}>
      <div data-food-tour="help-header">
      <FoodPageHeader eyebrow="Central de Ajuda" title={foodGuide.title} description={foodGuide.description}>
        <Badge variant="secondary">Versão {foodGuide.version}</Badge>
        <FoodTourButton tourId="help" userId={userQuery.data?.id} />
        <Button asChild variant="outline"><a href="/food/ajuda/manual" target="_blank" rel="noreferrer"><Download className="mr-2 h-4 w-4" />Manual PDF</a></Button>
      </FoodPageHeader>
      </div>

      <section data-food-tour="help-flow" className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 md:px-5">
          <Route className="h-5 w-5 text-[var(--workspace-primary)]" />
          <div>
            <h2 className="font-black text-slate-950">Fluxo completo da operação</h2>
            <p className="text-xs text-slate-500">Siga esta ordem no primeiro teste.</p>
          </div>
        </div>
        <div className="overflow-x-auto px-4 py-4 md:px-5">
          <ol className="flex min-w-max items-center">
            {foodGuide.flow.map((item, index) => (
              <li key={item} className="flex items-center">
                <div className="flex w-36 items-center gap-2 sm:w-44">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--workspace-primary)] text-xs font-black text-[var(--workspace-on-primary)]">{index + 1}</span>
                  <span className="text-xs font-bold leading-4 text-slate-700">{item}</span>
                </div>
                {index < foodGuide.flow.length - 1 ? <ChevronRight className="mx-2 h-4 w-4 shrink-0 text-slate-300" /> : null}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section data-food-tour="help-filters" className="space-y-3" aria-label="Filtros do guia">
        <div className="relative max-w-2xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar: equipa, pedido, PIN, stock, fecho..." className="h-11 bg-white pl-10" />
        </div>
        <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
          {canTrainAllRoles ? (
            <button type="button" onClick={() => setRole('all')} className={cn('h-9 shrink-0 rounded-md border px-3 text-sm font-bold', role === 'all' ? 'border-[var(--workspace-primary)] bg-[var(--workspace-primary-soft)] text-[var(--workspace-primary)]' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}>Todas as funções</button>
          ) : null}
          {visibleRoles.map((candidate) => (
            <button key={candidate.id} type="button" onClick={() => setRole(candidate.id)} className={cn('h-9 shrink-0 rounded-md border px-3 text-sm font-bold', role === candidate.id ? 'border-[var(--workspace-primary)] bg-[var(--workspace-primary-soft)] text-[var(--workspace-primary)]' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}>
              {candidate.label}
            </button>
          ))}
        </div>
      </section>

      {selectedTopic ? (
        <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside data-food-tour="help-topics" className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto">
            <div className="border-b border-slate-100 px-4 py-3">
              <p className="text-xs font-bold uppercase text-slate-500">{filteredTopics.length} tópicos encontrados</p>
            </div>
            <nav className="p-2" aria-label="Tópicos do guia">
              {sections.map((section) => (
                <div key={section} className="mb-3 last:mb-0">
                  <p className="px-2 py-1.5 text-[11px] font-black uppercase text-slate-400">{section}</p>
                  {filteredTopics.filter((topic) => topic.section === section).map((topic) => (
                    <button key={topic.id} type="button" onClick={() => setSelectedId(topic.id)} className={cn('flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition', selectedTopic.id === topic.id ? 'bg-[var(--workspace-primary-soft)] font-bold text-[var(--workspace-primary)]' : 'font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-950')}>
                      <BookOpen className="h-4 w-4 shrink-0" />
                      <span className="min-w-0 flex-1">{topic.title}</span>
                      <ChevronRight className="h-4 w-4 shrink-0 opacity-50" />
                    </button>
                  ))}
                </div>
              ))}
            </nav>
          </aside>

          <article data-food-tour="help-article" className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <header className="border-b border-slate-100 px-5 py-5 md:px-7">
              <p className="text-xs font-black uppercase text-[var(--workspace-primary)]">{selectedTopic.section}</p>
              <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <h2 className="text-2xl font-black text-slate-950">{selectedTopic.title}</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{selectedTopic.summary}</p>
                </div>
                <Button asChild className="shrink-0"><Link href={selectedTopic.route}>Abrir esta área<ExternalLink className="ml-2 h-4 w-4" /></Link></Button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {selectedTopic.roles.map((item) => <Badge key={item} variant="secondary"><UserRound className="mr-1 h-3 w-3" />{foodGuideRoleLabels[item]}</Badge>)}
              </div>
            </header>

            <div className="px-5 py-6 md:px-7">
              <div className="flex items-start gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                <div><p className="text-xs font-black uppercase text-emerald-700">Resultado esperado</p><p className="mt-1 text-sm font-semibold text-emerald-950">{selectedTopic.outcome}</p></div>
              </div>

              <section className="mt-7">
                <h3 className="text-lg font-black text-slate-950">Passo a passo</h3>
                <ol className="mt-4 divide-y divide-slate-100 border-y border-slate-100">
                  {selectedTopic.steps.map((step, index) => (
                    <li key={`${selectedTopic.id}-${step.title}`} className="flex gap-4 py-4">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-950 text-sm font-black text-white">{index + 1}</span>
                      <div className="min-w-0"><p className="font-black text-slate-950">{step.title}</p><p className="mt-1 text-sm leading-6 text-slate-600">{step.description}</p></div>
                    </li>
                  ))}
                </ol>
              </section>

              {selectedTopic.tips.length ? (
                <section className="mt-6 flex gap-3 rounded-md bg-blue-50 px-4 py-3 text-blue-950">
                  <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
                  <div><p className="text-xs font-black uppercase text-blue-700">Dica</p>{selectedTopic.tips.map((tip) => <p key={tip} className="mt-1 text-sm font-semibold">{tip}</p>)}</div>
                </section>
              ) : null}

              {selectedTopic.warnings.length ? (
                <section className="mt-3 flex gap-3 rounded-md bg-amber-50 px-4 py-3 text-amber-950">
                  <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                  <div><p className="text-xs font-black uppercase text-amber-700">Atenção</p>{selectedTopic.warnings.map((warning) => <p key={warning} className="mt-1 text-sm font-semibold">{warning}</p>)}</div>
                </section>
              ) : null}

              <div className="mt-7 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 text-sm text-slate-500"><PlayCircle className="h-5 w-5" /><span>O vídeo deste tópico será ligado aqui depois da estabilização visual.</span></div>
                <Button asChild variant="outline"><Link href={selectedTopic.route}>Continuar na aplicação<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
              </div>
            </div>
          </article>
        </div>
      ) : (
        <Card className="border-dashed border-slate-200 bg-white p-8 text-center shadow-sm">
          <Search className="mx-auto h-9 w-9 text-slate-300" />
          <h2 className="mt-3 font-black text-slate-950">Nenhum tópico encontrado</h2>
          <p className="mt-1 text-sm text-slate-500">Altere a pesquisa ou escolha outra função.</p>
          <Button variant="outline" className="mt-4" onClick={() => { setSearch(''); setRole(canTrainAllRoles ? 'all' : currentRoles[0] || 'all'); }}>Limpar filtros</Button>
        </Card>
      )}
    </div>
  );
}
