'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { BookOpen, CheckCircle2, CircleAlert, CircleHelp, Lightbulb, UserRound } from 'lucide-react';
import { foodGuideRoleLabels, resolveFoodGuideTopic } from '@/content/food-guide';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export function FoodContextGuide() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const topic = resolveFoodGuideTopic(pathname, searchParams);

  if (!topic) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="icon"
          className="fixed bottom-5 right-5 z-40 h-12 w-12 rounded-full shadow-lg md:bottom-6 md:right-6"
          aria-label="Ajuda desta área"
          title="Ajuda desta área"
        >
          <CircleHelp className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl gap-0 overflow-hidden p-0 sm:rounded-lg">
        <DialogHeader className="border-b border-slate-100 px-5 py-5 pr-12 text-left md:px-6">
          <p className="text-xs font-black uppercase text-[var(--workspace-primary)]">Guia desta área</p>
          <DialogTitle className="mt-1 text-xl font-black text-slate-950">{topic.title}</DialogTitle>
          <DialogDescription className="mt-2 leading-6 text-slate-600">{topic.summary}</DialogDescription>
          <div className="flex flex-wrap gap-2 pt-2">
            {topic.roles.map((role) => (
              <Badge key={role} variant="secondary">
                <UserRound className="mr-1 h-3 w-3" />
                {foodGuideRoleLabels[role]}
              </Badge>
            ))}
          </div>
        </DialogHeader>

        <div className="max-h-[calc(90vh-240px)] overflow-y-auto px-5 py-5 md:px-6">
          <div className="flex items-start gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
            <div>
              <p className="text-xs font-black uppercase text-emerald-700">Resultado esperado</p>
              <p className="mt-1 text-sm font-semibold leading-5 text-emerald-950">{topic.outcome}</p>
            </div>
          </div>

          <section className="mt-5">
            <h3 className="flex items-center gap-2 font-black text-slate-950">
              <BookOpen className="h-4 w-4 text-[var(--workspace-primary)]" />
              Passo a passo
            </h3>
            <ol className="mt-3 divide-y divide-slate-100 border-y border-slate-100">
              {topic.steps.map((step, index) => (
                <li key={`${topic.id}-${step.title}`} className="flex gap-3 py-3.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-950 text-xs font-black text-white">{index + 1}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-950">{step.title}</p>
                    <p className="mt-1 text-sm leading-5 text-slate-600">{step.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {topic.tips.map((tip) => (
            <div key={tip} className="mt-4 flex gap-3 rounded-md bg-blue-50 px-4 py-3 text-sm text-blue-950">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
              <p className="font-semibold leading-5">{tip}</p>
            </div>
          ))}
          {topic.warnings.map((warning) => (
            <div key={warning} className="mt-3 flex gap-3 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <p className="font-semibold leading-5">{warning}</p>
            </div>
          ))}
        </div>

        <DialogFooter className="border-t border-slate-100 px-5 py-4 md:px-6">
          <Button asChild variant="outline">
            <Link href={`/food/ajuda?topic=${encodeURIComponent(topic.id)}`}>Abrir guia completo</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
