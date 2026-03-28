'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, FileCode2, RefreshCw } from 'lucide-react';
import { getSaftPeriodos, generateSaft, getSaftDownloadUrl } from '@/lib/api';

const MONTHS = ['01','02','03','04','05','06','07','08','09','10','11','12'];
const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

export function TabSaft() {
  const qc = useQueryClient();
  const currentYear = new Date().getFullYear();
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
  const [year, setYear] = useState(String(currentYear));
  const [month, setMonth] = useState(currentMonth);
  const [err, setErr] = useState('');

  const { data: periodos = [], isLoading } = useQuery({
    queryKey: ['saft-periodos'],
    queryFn: getSaftPeriodos,
  });

  const generateMutation = useMutation({
    mutationFn: () => generateSaft(`${year}-${month}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['saft-periodos'] }); setErr(''); },
    onError: (e: Error) => setErr(e.message),
  });

  const years = Array.from({ length: 5 }, (_, i) => String(currentYear - i));

  return (
    <div className="space-y-6">
      <h2 className="text-base font-semibold text-[#0A2540]">SAF-T — Ficheiro de Auditoria Fiscal</h2>

      {/* Generator */}
      <div className="p-5 rounded-xl bg-gray-50 border border-gray-200 space-y-4">
        <p className="text-sm text-gray-600">
          Gera o ficheiro XML no formato SAF-T AO 1.01_01 exigido pela AGT, com todas as facturas válidas do período seleccionado.
        </p>
        {err && <p className="text-red-500 text-sm">{err}</p>}
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <p className="text-xs text-gray-500 mb-1">Mês</p>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => <SelectItem key={m} value={m}>{MONTH_NAMES[i]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Ano</p>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="text-white"
          >
            {generateMutation.isPending ? (
              <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> A gerar...</>
            ) : (
              <><FileCode2 className="w-4 h-4 mr-2" /> Gerar SAF-T</>
            )}
          </Button>
        </div>
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
