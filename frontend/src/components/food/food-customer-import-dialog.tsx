'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Papa from 'papaparse';
import { AlertTriangle, ArrowLeft, CheckCircle2, FileSpreadsheet, Upload } from 'lucide-react';
import { commitFoodCustomerImport, previewFoodCustomerImport } from '@/lib/api';
import type { FoodCustomerImportPreview, FoodCustomerImportRowInput } from '@/lib/types';
import { getApiErrorMessage } from '@/lib/api-error-message';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Step = 'upload' | 'mapping' | 'preview' | 'result';
type FieldKey = keyof FoodCustomerImportRowInput;

const fields: Array<{ key: FieldKey; label: string; required?: boolean; aliases: string[] }> = [
  { key: 'name', label: 'Nome', required: true, aliases: ['nome', 'name', 'cliente', 'contacto', 'contato'] },
  { key: 'phone', label: 'Telefone', required: true, aliases: ['telefone', 'telemovel', 'phone', 'mobile', 'celular', 'whatsapp', 'numero'] },
  { key: 'email', label: 'Email', aliases: ['email', 'e-mail'] },
  { key: 'company', label: 'Empresa', aliases: ['empresa', 'company', 'organizacao'] },
  { key: 'location', label: 'Zona/localização', aliases: ['zona', 'localizacao', 'location', 'bairro', 'morada'] },
  { key: 'birthDate', label: 'Nascimento', aliases: ['nascimento', 'aniversario', 'birthdate', 'data nascimento'] },
  { key: 'tags', label: 'Etiquetas', aliases: ['etiquetas', 'tags', 'segmento'] },
  { key: 'notes', label: 'Notas', aliases: ['notas', 'notes', 'observacoes'] },
  { key: 'marketingConsent', label: 'Consentimento marketing', aliases: ['consentimento', 'marketing', 'autoriza marketing'] },
];

const statusLabels: Record<FoodCustomerImportPreview['rows'][number]['status'], string> = {
  valid: 'Novo',
  invalid: 'Inválido',
  duplicate_file: 'Repetido no ficheiro',
  existing: 'Já existe',
  existing_inactive: 'Existe arquivado',
};

function normalizeHeader(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function automaticMapping(headers: string[]) {
  return Object.fromEntries(fields.map((field) => {
    const index = headers.findIndex((header) => field.aliases.some((alias) => normalizeHeader(header).includes(alias)));
    return [field.key, index >= 0 ? String(index) : ''];
  })) as Record<FieldKey, string>;
}

export function FoodCustomerImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [sourceRows, setSourceRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<FieldKey, string>>({} as Record<FieldKey, string>);
  const [mappedRows, setMappedRows] = useState<FoodCustomerImportRowInput[]>([]);
  const [preview, setPreview] = useState<FoodCustomerImportPreview | null>(null);
  const [strategy, setStrategy] = useState<'skip' | 'update'>('skip');
  const [localError, setLocalError] = useState<string | null>(null);

  const reset = () => {
    setStep('upload'); setFileName(''); setHeaders([]); setSourceRows([]); setMapping({} as Record<FieldKey, string>); setMappedRows([]); setPreview(null); setStrategy('skip'); setLocalError(null);
  };
  const changeOpen = (value: boolean) => { if (!value) reset(); onOpenChange(value); };

  const previewMutation = useMutation({
    mutationFn: previewFoodCustomerImport,
    onSuccess: (data) => { setPreview(data); setStep('preview'); setLocalError(null); },
  });
  const commitMutation = useMutation({
    mutationFn: () => commitFoodCustomerImport(mappedRows, strategy),
    onSuccess: async () => {
      setStep('result');
      await queryClient.invalidateQueries({ queryKey: ['food-v1-customers'] });
      await queryClient.invalidateQueries({ queryKey: ['food-customer-duplicates'] });
      await queryClient.invalidateQueries({ queryKey: ['food-marketing-overview'] });
    },
  });

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/\.(csv|txt)$/i.test(file.name)) { setLocalError('Seleccione um ficheiro CSV ou TXT.'); return; }
    if (file.size > 2 * 1024 * 1024) { setLocalError('O ficheiro não pode exceder 2 MB.'); return; }
    const parsed = Papa.parse<string[]>((await file.text()).replace(/^\uFEFF/, ''), { skipEmptyLines: 'greedy' });
    if (parsed.errors.length || parsed.data.length < 2) { setLocalError('O CSV deve conter cabeçalho e pelo menos uma linha de dados.'); return; }
    if (parsed.data.length - 1 > 5000) { setLocalError('O ficheiro não pode exceder 5.000 linhas por importação.'); return; }
    const cleaned = parsed.data.map((row) => row.map((cell) => String(cell ?? '').trim()));
    const parsedHeaders = cleaned[0].map((header, index) => header || `Coluna ${index + 1}`);
    setFileName(file.name);
    setHeaders(parsedHeaders);
    setSourceRows(cleaned.slice(1));
    setMapping(automaticMapping(parsedHeaders));
    setLocalError(null);
    setStep('mapping');
  };

  const preparePreview = () => {
    if (mapping.name === '' || mapping.phone === '') { setLocalError('Mapeie as colunas Nome e Telefone.'); return; }
    const rows = sourceRows.map((source) => Object.fromEntries(fields.flatMap((field) => {
      const index = Number(mapping[field.key]);
      return mapping[field.key] === '' ? [] : [[field.key, source[index] || '']];
    })) as FoodCustomerImportRowInput);
    setMappedRows(rows);
    previewMutation.mutate(rows);
  };

  const requestError = previewMutation.error || commitMutation.error;
  const result = commitMutation.data;
  const canImport = preview ? preview.summary.valid > 0 || (strategy === 'update' && preview.summary.existing > 0) : false;

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto rounded-lg">
        <DialogHeader><DialogTitle>Importar clientes CSV</DialogTitle></DialogHeader>
        <div className="grid grid-cols-4 gap-2 text-xs font-bold text-slate-500">{(['upload', 'mapping', 'preview', 'result'] as Step[]).map((item, index) => <div key={item} className={`border-b-2 pb-2 ${step === item ? 'border-[var(--workspace-primary)] text-slate-950' : 'border-slate-200'}`}>{index + 1}. {['Ficheiro', 'Mapeamento', 'Validação', 'Resultado'][index]}</div>)}</div>

        {step === 'upload' ? <div className="space-y-4"><label className="flex cursor-pointer flex-col items-center rounded-lg border-2 border-dashed border-slate-300 px-6 py-12 text-center hover:border-[var(--workspace-primary)]"><Upload className="h-8 w-8 text-slate-500" /><span className="mt-3 font-bold text-slate-950">Seleccionar CSV</span><span className="mt-1 text-sm text-slate-500">Cabeçalho obrigatório, até 5.000 linhas e 2 MB.</span><Input type="file" accept=".csv,.txt,text/csv,text/plain" className="hidden" onChange={handleFile} /></label><div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600"><p className="font-bold text-slate-950">Colunas suportadas</p><p className="mt-1">Nome, telefone, email, empresa, zona, nascimento, etiquetas, notas e consentimento.</p></div></div> : null}

        {step === 'mapping' ? <div className="space-y-4"><div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3"><FileSpreadsheet className="h-5 w-5 text-emerald-600" /><div><p className="font-bold text-slate-950">{fileName}</p><p className="text-xs text-slate-500">{sourceRows.length} linhas detectadas</p></div></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{fields.map((field) => <div key={field.key}><Label>{field.label}{field.required ? ' *' : ''}</Label><select className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={mapping[field.key] ?? ''} onChange={(event) => setMapping({ ...mapping, [field.key]: event.target.value })}><option value="">Não importar</option>{headers.map((header, index) => <option key={`${header}-${index}`} value={index}>{header}</option>)}</select></div>)}</div><div className="flex justify-between"><Button variant="outline" onClick={() => setStep('upload')}><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Button><Button disabled={previewMutation.isPending} onClick={preparePreview}>{previewMutation.isPending ? 'A validar...' : 'Validar dados'}</Button></div></div> : null}

        {step === 'preview' && preview ? <div className="space-y-4"><div className="grid grid-cols-2 gap-3 sm:grid-cols-5"><div className="rounded-lg bg-emerald-50 p-3"><p className="text-xs font-bold text-emerald-700">Novos</p><p className="mt-1 text-2xl font-black text-emerald-800">{preview.summary.valid}</p></div><div className="rounded-lg bg-blue-50 p-3"><p className="text-xs font-bold text-blue-700">Existentes</p><p className="mt-1 text-2xl font-black text-blue-800">{preview.summary.existing}</p></div><div className="rounded-lg bg-red-50 p-3"><p className="text-xs font-bold text-red-700">Inválidos</p><p className="mt-1 text-2xl font-black text-red-800">{preview.summary.invalid}</p></div><div className="rounded-lg bg-amber-50 p-3"><p className="text-xs font-bold text-amber-700">Repetidos</p><p className="mt-1 text-2xl font-black text-amber-800">{preview.summary.duplicate_file}</p></div><div className="rounded-lg bg-slate-100 p-3"><p className="text-xs font-bold text-slate-600">Arquivados</p><p className="mt-1 text-2xl font-black text-slate-800">{preview.summary.existing_inactive}</p></div></div><div><Label>Conflitos com clientes existentes</Label><div className="mt-2 grid gap-2 sm:grid-cols-2"><button type="button" onClick={() => setStrategy('skip')} className={`rounded-lg border p-3 text-left ${strategy === 'skip' ? 'border-[var(--workspace-primary)] bg-slate-50' : 'border-slate-200'}`}><span className="block font-bold text-slate-950">Ignorar existentes</span><span className="text-xs text-slate-500">Importa apenas novos telefones.</span></button><button type="button" onClick={() => setStrategy('update')} className={`rounded-lg border p-3 text-left ${strategy === 'update' ? 'border-[var(--workspace-primary)] bg-slate-50' : 'border-slate-200'}`}><span className="block font-bold text-slate-950">Actualizar existentes</span><span className="text-xs text-slate-500">Preenche dados e consentimento do CSV.</span></button></div></div><div className="max-h-64 overflow-auto rounded-lg border border-slate-200"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Linha</th><th className="px-3 py-2">Cliente</th><th className="px-3 py-2">Telefone</th><th className="px-3 py-2">Estado</th></tr></thead><tbody className="divide-y divide-slate-100">{preview.rows.slice(0, 200).map((row) => <tr key={row.rowNumber}><td className="px-3 py-2">{row.rowNumber}</td><td className="px-3 py-2 font-semibold text-slate-950">{row.data.name || 'Sem nome'}{row.errors.length ? <p className="text-xs font-normal text-red-600">{row.errors.join(' ')}</p> : null}</td><td className="px-3 py-2">{row.data.phone}</td><td className="px-3 py-2"><span className={`rounded px-2 py-1 text-xs font-bold ${row.status === 'valid' ? 'bg-emerald-50 text-emerald-700' : row.status === 'existing' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-800'}`}>{statusLabels[row.status]}</span></td></tr>)}</tbody></table></div><div className="flex justify-between"><Button variant="outline" onClick={() => setStep('mapping')}><ArrowLeft className="mr-2 h-4 w-4" />Rever mapeamento</Button><Button disabled={!canImport || commitMutation.isPending} onClick={() => commitMutation.mutate()}>{commitMutation.isPending ? 'A importar...' : 'Confirmar importação'}</Button></div></div> : null}

        {step === 'result' && result ? <div className="space-y-5"><div className="rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-8 text-center"><CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" /><h3 className="mt-3 text-lg font-black text-emerald-900">Importação concluída</h3><p className="mt-1 text-sm text-emerald-800">{result.imported} criados, {result.updated} actualizados, {result.skipped} ignorados e {result.invalid} inválidos.</p></div>{result.errors.length ? <div className="rounded-lg border border-amber-200 bg-amber-50 p-4"><div className="flex gap-2"><AlertTriangle className="h-5 w-5 text-amber-700" /><div><p className="font-bold text-amber-900">Linhas não processadas</p><p className="text-sm text-amber-800">{result.errors.slice(0, 20).map((row) => `Linha ${row.rowNumber}: ${row.errors.join(' ') || statusLabels[row.status]}`).join(' · ')}</p></div></div></div> : null}<div className="flex justify-end"><Button onClick={() => changeOpen(false)}>Fechar</Button></div></div> : null}

        {localError || requestError ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{localError || getApiErrorMessage(requestError)}</p> : null}
      </DialogContent>
    </Dialog>
  );
}
