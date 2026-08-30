'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ManagementLoading, ManagementPage } from '@/components/management/management-ui';
import { managementApi } from '@/lib/management-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast-provider';

export default function SettingsPage(){
  const {theme,setTheme}=useTheme();const qc=useQueryClient();const {toast}=useToast();const query=useQuery({queryKey:['management-bootstrap'],queryFn:managementApi.bootstrap});const [drafts,setDrafts]=useState<Record<string,string>>({});
  const update=useMutation({mutationFn:({id,probability}:{id:string;probability:number})=>managementApi.updateStage(id,{probability}),onSuccess:()=>{qc.invalidateQueries({queryKey:['management-bootstrap']});toast({title:'Probabilidade atualizada',variant:'success'});}});
  if(query.isLoading)return <ManagementLoading/>;const admin=query.data?.profile.role==='admin';return <ManagementPage title="Configurações" description="Preferências pessoais e parâmetros do workspace.">
    <Card className="dark:border-slate-800 dark:bg-slate-900"><CardHeader><CardTitle>Aparência</CardTitle></CardHeader><CardContent><p className="mb-3 text-sm text-slate-500">Escolha o tema utilizado nesta aplicação.</p><div className="flex gap-2"><Button variant={theme==='light'?'default':'secondary'} onClick={()=>setTheme('light')}>Modo claro</Button><Button variant={theme==='dark'?'default':'secondary'} onClick={()=>setTheme('dark')}>Modo escuro</Button><Button variant={theme==='system'?'default':'secondary'} onClick={()=>setTheme('system')}>Sistema</Button></div></CardContent></Card>
    {admin&&<Card className="dark:border-slate-800 dark:bg-slate-900"><CardHeader><CardTitle>Probabilidade padrão do pipeline</CardTitle></CardHeader><CardContent className="space-y-3">{query.data?.stages.map((stage)=><div key={stage.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700"><div className="flex-1"><p className="font-medium">{stage.label}</p><p className="text-xs text-slate-500">{stage.stage}</p></div><Input type="number" min="0" max="100" value={drafts[stage.id]??String(Number(stage.probability))} onChange={(event)=>setDrafts((current)=>({...current,[stage.id]:event.target.value}))} className="w-24 dark:bg-slate-950"/><span className="text-sm">%</span><Button size="sm" onClick={()=>update.mutate({id:stage.id,probability:Number(drafts[stage.id]??stage.probability)})}>Guardar</Button></div>)}</CardContent></Card>}
  </ManagementPage>;
}
