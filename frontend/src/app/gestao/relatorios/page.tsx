'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ManagementEmpty, ManagementLoading, ManagementPage, tdClass, thClass, tableClass } from '@/components/management/management-ui';
import { managementApi } from '@/lib/management-api';
import { downloadCsv } from '@/lib/management-format';

function rowsFromReport(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) return value.map((item) => typeof item === 'object' && item ? item as Record<string, unknown> : { valor: item });
  if (value && typeof value === 'object') {
    const object=value as Record<string,unknown>; const cards=(object.summary as {cards?:Record<string,unknown>}|undefined)?.cards;
    if(cards)return Object.entries(cards).map(([kpi,realizado])=>({kpi,realizado}));
    return Object.entries(object).map(([campo,valor])=>({campo,valor:typeof valor==='object'?JSON.stringify(valor):valor}));
  }
  return [];
}
export default function ReportsPage(){
  const [module,setModule]=useState('geral');const [dateFrom,setDateFrom]=useState('');const [dateTo,setDateTo]=useState('');const query=useQuery({queryKey:['management-report',module,dateFrom,dateTo],queryFn:()=>managementApi.report(module,{dateFrom:dateFrom||undefined,dateTo:dateTo||undefined})});const rows=rowsFromReport(query.data);const headers=rows.length?Object.keys(rows[0]).filter((key)=>!['organizationId','createdBy'].includes(key)).slice(0,10):[];
  return <ManagementPage title="Relatórios" description="Análise filtrada por período, exportação CSV e impressão." action={<div className="flex gap-2" data-no-print><Button variant="secondary" onClick={()=>downloadCsv(`relatorio-${module}.csv`,rows)} disabled={!rows.length}><Download className="mr-2 h-4 w-4"/>CSV</Button><Button onClick={()=>window.print()}><Printer className="mr-2 h-4 w-4"/>Imprimir</Button></div>}>
    <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-3" data-no-print><div><label className="text-xs font-bold uppercase text-slate-500">Relatório</label><select value={module} onChange={(event)=>setModule(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-950">{['geral','marketing','comercial','operacional','financeiro','clientes'].map((value)=><option key={value} value={value}>{value}</option>)}</select></div><div><label className="text-xs font-bold uppercase text-slate-500">Data inicial</label><Input type="date" value={dateFrom} onChange={(event)=>setDateFrom(event.target.value)} className="mt-1 dark:bg-slate-950"/></div><div><label className="text-xs font-bold uppercase text-slate-500">Data final</label><Input type="date" value={dateTo} onChange={(event)=>setDateTo(event.target.value)} className="mt-1 dark:bg-slate-950"/></div></div>
    {query.isLoading?<ManagementLoading/>:!rows.length?<ManagementEmpty title="Sem resultados" description="Altere o período ou escolha outro relatório."/>:<div className="print-card overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"><table className={tableClass}><thead><tr>{headers.map((header)=><th className={thClass} key={header}>{header.replaceAll('_',' ')}</th>)}</tr></thead><tbody>{rows.map((row,index)=><tr key={index}>{headers.map((header)=><td className={tdClass} key={header}>{typeof row[header]==='object'?JSON.stringify(row[header]):String(row[header]??'—')}</td>)}</tr>)}</tbody></table></div>}
  </ManagementPage>;
}
