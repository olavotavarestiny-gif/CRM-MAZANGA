'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, FileCode2, RefreshCw, ShieldCheck, ShieldAlert, AlertCircle, CheckCircle2, ChevronRight } from 'lucide-react';
import { getSaftPeriodos, generateSaft, validateSaft, getSaftDownloadUrl } from '@/lib/api';

const MONTHS = ['01','02','03','04','05','06','07','08','09','10','11','12'];
const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

type ValidationState = { valid: boolean; errors: string[] } | null;

export function TabSaft() {
  const qc = useQueryClient();
  const currentYear = new Date().getFullYear();
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
  const [year, setYear] = useState(String(currentYear));
  const [month, setMonth] = useState(currentMonth);
  const [validation, setValidation] = useState<ValidationState>(null);
  const [err, setErr] = useState('');

  const { data: periodos = [], isLoading } = useQuery({
    queryKey: ['saft-periodos'],
    queryFn: getSaftPeriodos,
  });

  const validateMutation = useMutation({
    mutationFn: () => validateSaft(`${year}-${month}`),
    onSuccess: (data) => { setValidation(data); setErr(''); },
    onError: (e: Error) => setErr(e.message),
  });

  const generateMutation = useMutation({
    mutationFn: () => generateSaft(`${year}-${month}`),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['saft-periodos'] });
      setErr('');
      setValidation(null);
      // Show warnings if any
      if (data.warnings?.length > 0) {
        setValidation({ valid: true, errors: data.warnings.map((w: string) => `⚠ ${w}`) });
      }
    },
    onError: (e: Error) => setErr(e.message),
  });

  const years = Array.from({ length: 5 }, (_, i) => String(currentYear - i));
  const periodo = `${year}-${month}`;

  const handlePeriodChange = () => {
    setValidation(null);
    setErr('');
  };

  return (
    <div className="space-y-6">
      <h2 className="text-base font-semibold text-[#0A2540]">SAF-T — Ficheiro de Auditoria Fiscal</h2>

      {/* Generator */}
      <div className="p-5 rounded-xl bg-gray-50 border border-gray-200 space-y-4">
        <p className="text-sm text-gray-600">
          Gera o ficheiro XML no formato SAF-T AO 1.01_01 exigido pela AGT, com todas as facturas válidas do período seleccionado.
        </p>
        {err && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
            <p className="text-red-700 text-sm">{err}</p>
          </div>
        )}

        {/* Period selectors */}
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <p className="text-xs text-gray-500 mb-1">Mês</p>
            <Select value={month} onValueChange={(v) => { setMonth(v); handlePeriodChange(); }}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => <SelectItem key={m} value={m}>{MONTH_NAMES[i]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Ano</p>
            <Select value={year} onValueChange={(v) => { setYear(v); handlePeriodChange(); }}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {/* Step 1: validate */}
          <Button
            variant="outline"
            onClick={() => validateMutation.mutate()}
            disabled={validateMutation.isPending || generateMutation.isPending}
            className="border-[#0049e6] text-[#0049e6] hover:bg-blue-50"
          >
            {validateMutation.isPending ? (
              <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> A verificar...</>
            ) : (
              <><ShieldCheck className="w-4 h-4 mr-2" /> Verificar período</>
            )}
          </Button>
          {/* Step 2: generate — only fully active when validation passed */}
          <Button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending || validateMutation.isPending}
            className={`text-white transition-colors ${validation?.valid === false ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={validation?.valid === false ? 'Corrija os erros antes de gerar o SAF-T' : undefined}
          >
            {generateMutation.isPending ? (
              <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> A gerar...</>
            ) : (
              <><FileCode2 className="w-4 h-4 mr-2" /> Gerar SAF-T</>
            )}
          </Button>
        </div>

        {/* Validation result */}
        {validation && (
          <div className={`rounded-xl border p-4 space-y-2 ${validation.valid && validation.errors.length === 0 ? 'border-green-200 bg-green-50' : validation.valid ? 'border-amber-200 bg-amber-50' : 'border-red-200 bg-red-50'}`}>
            <div className="flex items-center gap-2">
              {validation.valid && validation.errors.length === 0 ? (
                <><CheckCircle2 className="w-4 h-4 text-green-600" /><span className="text-sm font-semibold text-green-700">Período {periodo} pronto para exportar</span></>
              ) : validation.valid ? (
                <><ShieldAlert className="w-4 h-4 text-amber-600" /><span className="text-sm font-semibold text-amber-700">SAF-T gerado com avisos</span></>
              ) : (
                <><ShieldAlert className="w-4 h-4 text-red-600" /><span className="text-sm font-semibold text-red-700">Erros encontrados — corrija antes de gerar</span></>
              )}
            </div>
            {validation.errors.length > 0 && (
              <ul className="space-y-1 mt-2">
                {validation.errors.map((e, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <ChevronRight className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${validation.valid ? 'text-amber-500' : 'text-red-500'}`} />
                    <span className={validation.valid ? 'text-amber-800' : 'text-red-800'}>{e}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Generated files */}
      <div>
        <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3">Ficheiros Gerados</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
          <div className="grid grid-cols-12 text-xs text-gray-500 font-medium uppercase tracking-wide px-4 py-2 border-b border-gray-200">
            <span className="col-span-3">Período</span>
            <span className="col-span-2">Facturas</span>
            <span className="col-span-2">Estado</span>
            <span className="col-span-3">Gerado em</span>
            <span className="col-span-2 text-right">Descarregar</span>
          </div>
          {isLoading && <div className="py-8 text-center text-gray-400">A carregar...</div>}
          {!isLoading && periodos.length === 0 && (
            <div className="py-12 text-center text-gray-400">
              <FileCode2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Nenhum SAF-T gerado ainda</p>
            </div>
          )}
          {periodos.map(p => (
            <div key={p.id} className="grid grid-cols-12 px-4 py-3 border-b border-gray-100 items-center">
              <span className="col-span-3 text-[#0A2540] font-mono">{p.periodo}</span>
              <span className="col-span-2 text-gray-600">{p.totalFacturas} factura{p.totalFacturas !== 1 ? 's' : ''}</span>
              <span className="col-span-2">
                <span className={`px-1.5 py-0.5 rounded text-xs border ${p.status === 'GENERATED' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>
                  {p.status === 'GENERATED' ? 'Gerado' : 'Submetido'}
                </span>
              </span>
              <span className="col-span-3 text-gray-500 text-sm">
                {new Date(p.generatedAt).toLocaleString('pt-PT')}
              </span>
              <div className="col-span-2 flex justify-end">
                <Button
                  variant="outline" size="sm"
                  className="border-gray-200 text-gray-600 hover:bg-gray-100"
                  onClick={async () => { window.location.href = await getSaftDownloadUrl(p.id); }}
                >
                  <Download className="w-3.5 h-3.5 mr-1" /> XML
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
