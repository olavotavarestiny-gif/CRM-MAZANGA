'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { getContacts, getPipelineStages } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function PipelineWidget() {
  const { data: contacts = [] } = useQuery({ queryKey: ['contacts'], queryFn: () => getContacts() });
  const { data: stages = [] } = useQuery({ queryKey: ['pipeline-stages'], queryFn: () => import('@/lib/api').then(m => m.getPipelineStages()) });

  const pipelineContacts = contacts.filter((c) => c.inPipeline);
  const total = pipelineContacts.length;

  return (
    <Card className="col-span-2 rounded-xl">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base font-bold">Resumo do Pipeline</CardTitle>
        <Link href="/pipeline" className="text-xs text-[#0049e6] font-semibold hover:text-[#0049e6]/80 transition-colors">Ver pipeline</Link>
      </CardHeader>
      <CardContent>
        {stages.length === 0 ? (
          <p className="text-sm text-[#595c5e] py-4 text-center">Sem etapas configuradas</p>
        ) : (
          <div className="space-y-2.5">
            {stages.map((stage) => {
              const count = pipelineContacts.filter((c) => c.stage === stage.name).length;
              const pct = total > 0 ? (count / total) * 100 : 0;
              return (
                <div key={stage.id}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: stage.color }} />
                      <span className="text-xs font-medium text-[#2c2f31]">{stage.name}</span>
                    </div>
                    <span className="text-xs text-[#595c5e]">{count}</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500 hover:brightness-110" style={{ width: `${pct}%`, background: stage.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
