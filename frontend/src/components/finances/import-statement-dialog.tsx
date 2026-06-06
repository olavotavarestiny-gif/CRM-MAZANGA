'use client';

import { useCallback, useRef, useState } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { importStatement } from '@/lib/api';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, ChevronRight, ChevronLeft, Loader2 } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface RawRow {
  [key: string]: string;
}

interface ParsedRow {
  index: number;
  date: string;
  description: string;
  amount: number;
  selected: boolean;
  category: string;
}

interface ColumnMap {
  date: string;
  description: string;
  amount: string;
  // optional separate debit column
  debit?: string;
}

type Step = 'upload' | 'map' | 'review';

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

const CATEGORY_OPTIONS = [
  'Importado',
  'Fornecedores',
  'Salários',
  'Renda',
  'Serviços',
  'Impostos',
  'Marketing',
  'Equipamento',
  'Transportes',
  'Alimentação',
  'Telecomunicações',
  'Outros',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseAmount(raw: string): number | null {
  if (!raw || raw.trim() === '') return null;
  // Remove spaces, currency symbols, and normalise decimal
  const cleaned = raw.replace(/[^\d,.\-]/g, '').replace(/,(?=\d{3})/g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function parseDate(raw: string): string | null {
  if (!raw || raw.trim() === '') return null;

  // ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = raw.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;

  // Excel serial number
  const serial = parseFloat(raw);
  if (!isNaN(serial) && serial > 40000 && serial < 50000) {
    const d = XLSX.SSF.parse_date_code(serial);
    if (d) {
      return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
    }
  }

  return null;
}

function guessColumns(headers: string[]): Partial<ColumnMap> {
  const lower = headers.map((h) => h.toLowerCase().trim());
  const find = (terms: string[]) =>
    headers[lower.findIndex((h) => terms.some((t) => h.includes(t)))] || '';

  return {
    date: find(['data', 'date', 'dt', 'dia']),
    description: find(['descri', 'memo', 'detalhe', 'hist', 'narrat', 'movement']),
    amount: find(['valor', 'amount', 'montante', 'quantia', 'saldo']),
    debit: find(['debito', 'débito', 'saida', 'saída', 'debit', 'out']),
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ImportStatementDialog({ open, onClose, onImported }: Props) {
  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<RawRow[]>([]);
  const [columnMap, setColumnMap] = useState<ColumnMap>({ date: '', description: '', amount: '' });
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [defaultCategory, setDefaultCategory] = useState('Importado');
  const [parseError, setParseError] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ created: number; errors: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ─── File parsing ─────────────────────────────────────────────────────────

  const handleFile = useCallback((file: File) => {
    setParseError('');
    setFileName(file.name);

    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'csv' || ext === 'txt') {
      Papa.parse<RawRow>(file, {
        header: true,
        skipEmptyLines: true,
        encoding: 'UTF-8',
        complete: (result) => {
          const headers = result.meta.fields || [];
          setRawHeaders(headers);
          setRawRows(result.data);
          setColumnMap({ ...guessColumns(headers) as ColumnMap });
          setStep('map');
        },
        error: (err) => setParseError(err.message),
      });
    } else if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target!.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const json: RawRow[] = XLSX.utils.sheet_to_json(sheet, { raw: false, defval: '' });
          const headers = Object.keys(json[0] || {});
          setRawHeaders(headers);
          setRawRows(json);
          setColumnMap({ ...guessColumns(headers) as ColumnMap });
          setStep('map');
        } catch (err: unknown) {
          setParseError(err instanceof Error ? err.message : 'Erro ao ler ficheiro Excel.');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      setParseError('Formato não suportado. Use CSV ou Excel (.xlsx).');
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  // ─── Column mapping → parsed rows ─────────────────────────────────────────

  const applyMapping = () => {
    const { date: datCol, description: descCol, amount: amtCol, debit: debitCol } = columnMap;

    if (!datCol || !amtCol) {
      setParseError('Seleciona pelo menos a coluna de Data e Valor.');
      return;
    }

    const rows: ParsedRow[] = [];

    rawRows.forEach((row, idx) => {
      // Determine amount: prefer dedicated debit column, fallback to amount column
      let rawAmt = debitCol && row[debitCol]?.trim() ? row[debitCol] : row[amtCol];
      const amt = parseAmount(rawAmt ?? '');
      if (amt === null || amt === 0) return;

      // Only show outgoing (negative values or positive values from a debit column)
      const finalAmt = debitCol && row[debitCol]?.trim() ? Math.abs(amt) : Math.abs(amt);
      const isOutgoing = debitCol && row[debitCol]?.trim() ? true : amt < 0;
      if (!isOutgoing) return;

      const dateStr = parseDate(row[datCol] ?? '');
      if (!dateStr) return;

      rows.push({
        index: idx,
        date: dateStr,
        description: descCol ? (row[descCol] ?? '').trim() : '',
        amount: finalAmt,
        selected: true,
        category: defaultCategory,
      });
    });

    if (rows.length === 0) {
      setParseError('Nenhuma saída encontrada. Confirma que os valores negativos representam saídas.');
      return;
    }

    setParseError('');
    setParsed(rows);
    setStep('review');
  };

  // ─── Import ───────────────────────────────────────────────────────────────

  const handleImport = async () => {
    const selected = parsed.filter((r) => r.selected);
    if (selected.length === 0) return;

    setImporting(true);
    try {
      const res = await importStatement(
        selected.map((r) => ({
          date: r.date,
          description: r.description,
          amountKz: r.amount,
          category: r.category,
        })),
      );
      setResult({ created: res.created, errors: res.errors?.length ?? 0 });
      onImported();
    } catch {
      setParseError('Erro ao importar. Tenta novamente.');
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setStep('upload');
    setFileName('');
    setRawHeaders([]);
    setRawRows([]);
    setParsed([]);
    setColumnMap({ date: '', description: '', amount: '' });
    setParseError('');
    setResult(null);
    onClose();
  };

  const toggleAll = (val: boolean) => setParsed((prev) => prev.map((r) => ({ ...r, selected: val })));
  const toggleRow = (idx: number) =>
    setParsed((prev) => prev.map((r) => (r.index === idx ? { ...r, selected: !r.selected } : r)));
  const updateCategory = (idx: number, cat: string) =>
    setParsed((prev) => prev.map((r) => (r.index === idx ? { ...r, category: cat } : r)));

  const selectedCount = parsed.filter((r) => r.selected).length;
  const totalAmount = parsed.filter((r) => r.selected).reduce((s, r) => s + r.amount, 0);

  const fmt = (n: number) => new Intl.NumberFormat('pt-PT').format(Math.round(n)) + ' Kz';

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <FileSpreadsheet className="h-5 w-5 text-violet-600" />
            Importar Extrato Bancário
          </DialogTitle>
        </DialogHeader>

        {/* Steps indicator */}
        <div className="flex items-center gap-2 text-xs text-slate-500 pt-1 pb-3 border-b border-slate-100">
          {(['upload', 'map', 'review'] as Step[]).map((s, i) => {
            const labels: Record<Step, string> = { upload: '1. Ficheiro', map: '2. Colunas', review: '3. Revisão' };
            const active = step === s;
            const done = (step === 'map' && i === 0) || (step === 'review' && i < 2);
            return (
              <span key={s} className={`px-2 py-0.5 rounded-full font-medium ${active ? 'bg-violet-100 text-violet-700' : done ? 'text-emerald-600' : 'text-slate-400'}`}>
                {labels[s]}
              </span>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {/* ── STEP 1: Upload ── */}
          {step === 'upload' && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div
                className="w-full border-2 border-dashed border-slate-200 rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer hover:border-violet-400 hover:bg-violet-50 transition-colors"
                onDrop={onDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => inputRef.current?.click()}
              >
                <Upload className="h-10 w-10 text-slate-400" />
                <p className="text-sm font-medium text-slate-700">Arrasta o ficheiro ou clica para selecionar</p>
                <p className="text-xs text-slate-400">CSV (.csv) ou Excel (.xlsx) — máx. 500 linhas</p>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,.txt"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
              </div>
              {parseError && (
                <p className="flex items-center gap-1.5 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4" /> {parseError}
                </p>
              )}
              <p className="text-xs text-slate-400 text-center max-w-sm">
                O ficheiro é processado localmente no teu browser. Nenhum dado é enviado até confirmares a importação.
              </p>
            </div>
          )}

          {/* ── STEP 2: Column mapping ── */}
          {step === 'map' && (
            <div className="space-y-5 px-1">
              <p className="text-sm text-slate-600">
                Ficheiro carregado: <span className="font-medium text-slate-800">{fileName}</span> ({rawRows.length} linhas)
              </p>
              <p className="text-xs text-slate-500">Associa as colunas do teu extrato aos campos do sistema:</p>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {([
                  { key: 'date', label: 'Data *', required: true },
                  { key: 'description', label: 'Descrição', required: false },
                  { key: 'amount', label: 'Valor (negativo = saída) *', required: true },
                  { key: 'debit', label: 'Coluna Débito (opcional)', required: false },
                ] as { key: keyof ColumnMap; label: string; required: boolean }[]).map(({ key, label }) => (
                  <div key={key} className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700">{label}</label>
                    <Select
                      value={columnMap[key] ?? ''}
                      onValueChange={(v) => setColumnMap((prev) => ({ ...prev, [key]: v === '__none__' ? '' : v }))}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="— não usar —" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— não usar —</SelectItem>
                        {rawHeaders.map((h) => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">Categoria padrão</label>
                <Select value={defaultCategory} onValueChange={setDefaultCategory}>
                  <SelectTrigger className="h-9 text-sm w-full sm:w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Preview first 3 rows */}
              {rawRows.length > 0 && (
                <div className="rounded-lg border border-slate-200 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        {rawHeaders.slice(0, 6).map((h) => (
                          <th key={h} className="px-3 py-2 text-left font-medium text-slate-600 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rawRows.slice(0, 3).map((row, i) => (
                        <tr key={i} className="border-t border-slate-100">
                          {rawHeaders.slice(0, 6).map((h) => (
                            <td key={h} className="px-3 py-1.5 text-slate-700 whitespace-nowrap max-w-[140px] truncate">{row[h]}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="px-3 py-1.5 text-xs text-slate-400 border-t border-slate-100">Pré-visualização das primeiras 3 linhas</p>
                </div>
              )}

              {parseError && (
                <p className="flex items-center gap-1.5 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4" /> {parseError}
                </p>
              )}
            </div>
          )}

          {/* ── STEP 3: Review & select ── */}
          {step === 'review' && !result && (
            <div className="space-y-4 px-1">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-sm text-slate-600">
                  <span className="font-semibold text-slate-800">{parsed.length}</span> saídas encontradas
                  {selectedCount !== parsed.length && (
                    <span className="ml-1 text-violet-600">({selectedCount} selecionadas)</span>
                  )}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => toggleAll(true)}>Selecionar todas</Button>
                  <Button variant="outline" size="sm" onClick={() => toggleAll(false)}>Desmarcar todas</Button>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto max-h-72">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 w-8"></th>
                        <th className="px-3 py-2 text-left font-medium text-slate-600">Data</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-600">Descrição</th>
                        <th className="px-3 py-2 text-right font-medium text-slate-600">Valor</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-600 min-w-[140px]">Categoria</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.map((row) => (
                        <tr
                          key={row.index}
                          className={`border-t border-slate-100 cursor-pointer ${row.selected ? '' : 'opacity-40'}`}
                          onClick={() => toggleRow(row.index)}
                        >
                          <td className="px-3 py-1.5 text-center">
                            <input
                              type="checkbox"
                              checked={row.selected}
                              onChange={() => toggleRow(row.index)}
                              onClick={(e) => e.stopPropagation()}
                              className="rounded border-slate-300"
                            />
                          </td>
                          <td className="px-3 py-1.5 text-slate-700 whitespace-nowrap">{row.date}</td>
                          <td className="px-3 py-1.5 text-slate-600 max-w-[220px] truncate">{row.description || '—'}</td>
                          <td className="px-3 py-1.5 text-right font-medium text-red-600 whitespace-nowrap">{fmt(row.amount)}</td>
                          <td className="px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
                            <Select
                              value={row.category}
                              onValueChange={(v) => updateCategory(row.index, v)}
                            >
                              <SelectTrigger className="h-7 text-xs w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {CATEGORY_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedCount > 0 && (
                <div className="flex items-center justify-between rounded-lg bg-red-50 border border-red-200 px-4 py-3">
                  <span className="text-sm text-red-700">
                    <span className="font-semibold">{selectedCount}</span> despesas · Total: <span className="font-semibold">{fmt(totalAmount)}</span>
                  </span>
                </div>
              )}

              {parseError && (
                <p className="flex items-center gap-1.5 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4" /> {parseError}
                </p>
              )}
            </div>
          )}

          {/* ── Result ── */}
          {result && (
            <div className="flex flex-col items-center gap-4 py-8">
              <CheckCircle2 className="h-14 w-14 text-emerald-500" />
              <div className="text-center space-y-1">
                <p className="text-lg font-semibold text-slate-800">{result.created} transações importadas</p>
                {result.errors > 0 && (
                  <p className="text-sm text-amber-600">{result.errors} linhas ignoradas por dados inválidos.</p>
                )}
                <p className="text-sm text-slate-500">As despesas foram adicionadas ao registo financeiro.</p>
              </div>
              <Button onClick={handleClose}>Fechar</Button>
            </div>
          )}
        </div>

        {/* Footer buttons */}
        {!result && (
          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (step === 'map') setStep('upload');
                else if (step === 'review') setStep('map');
                else handleClose();
              }}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              {step === 'upload' ? 'Cancelar' : 'Anterior'}
            </Button>

            {step === 'map' && (
              <Button size="sm" onClick={applyMapping} className="bg-violet-600 hover:bg-violet-700 text-white">
                Ver saídas
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}

            {step === 'review' && (
              <Button
                size="sm"
                disabled={selectedCount === 0 || importing}
                onClick={handleImport}
                className="bg-violet-600 hover:bg-violet-700 text-white"
              >
                {importing ? (
                  <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> A importar...</>
                ) : (
                  `Importar ${selectedCount} despesa${selectedCount !== 1 ? 's' : ''}`
                )}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
