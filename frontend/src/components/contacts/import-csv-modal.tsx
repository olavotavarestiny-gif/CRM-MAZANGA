'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { importContacts, ImportContactData } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { CheckCircle2, Upload } from 'lucide-react';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingButton } from '@/components/ui/loading-button';
import { useToast } from '@/components/ui/toast-provider';
import Papa from 'papaparse';

interface ImportCSVModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ImportCSVModal({ open, onOpenChange }: ImportCSVModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportContactData[]>([]);
  const [step, setStep] = useState<'upload' | 'preview' | 'success'>('upload');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: (contacts: ImportContactData[]) => importContacts(contacts),
    onSuccess: () => {
      setErrorMsg(null);
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast({
        variant: 'success',
        title: 'Importação concluída',
        description: 'Os contactos foram processados com sucesso.',
      });
      setStep('success');
      setTimeout(() => {
        onOpenChange(false);
        resetForm();
      }, 2000);
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error || error?.message || 'Erro desconhecido ao importar';
      setErrorMsg(message);
      toast({
        variant: 'error',
        title: 'Falha na importação',
        description: message,
      });
    },
  });

  const resetForm = () => {
    setFile(null);
    setPreview([]);
    setStep('upload');
    setErrorMsg(null);
  };

  const normalizeHeader = (value: string) => value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

  const isPhoneHeader = (value: string) => ['telefone', 'telemovel', 'numero', 'phone', 'number', 'mobile', 'celular', 'whatsapp']
    .some((keyword) => normalizeHeader(value).includes(keyword));

  const isNameHeader = (value: string) => ['nome', 'name', 'contacto', 'contato']
    .some((keyword) => normalizeHeader(value).includes(keyword));

  const looksLikePhone = (value: string) => {
    const compact = value.trim().replace(/[\s().-]/g, '');
    return /^\+?\d{7,15}$/.test(compact);
  };

  const parseCSV = async (file: File) => {
    try {
      const text = (await file.text()).replace(/^\uFEFF/, '');
      const parsed = Papa.parse<string[]>(text, { skipEmptyLines: 'greedy' });
      const rows = parsed.data.map((row) => row.map((cell) => String(cell ?? '').trim()));
      if (!rows.length) {
        setErrorMsg('O ficheiro está vazio.');
        return;
      }

      const header = rows[0];
      const hasHeader = header.some((cell) => isPhoneHeader(cell) || isNameHeader(cell));
      const phoneIdx = hasHeader ? header.findIndex(isPhoneHeader) : -1;
      const nameIdx = hasHeader ? header.findIndex(isNameHeader) : -1;
      const dataRows = hasHeader ? rows.slice(1) : rows;

      const data: ImportContactData[] = dataRows.flatMap((values) => {
        let resolvedPhoneIdx = phoneIdx;
        if (resolvedPhoneIdx < 0) {
          resolvedPhoneIdx = values.findIndex(looksLikePhone);
        }
        const phone = values[resolvedPhoneIdx]?.trim();
        if (!phone || !looksLikePhone(phone)) return [];

        const fallbackNameIdx = values.length > 1
          ? values.findIndex((value, index) => index !== resolvedPhoneIdx && value.trim())
          : -1;
        const resolvedName = (nameIdx >= 0 ? values[nameIdx] : values[fallbackNameIdx])?.trim() || '';
        return [{ name: resolvedName, phone }];
      });

      if (data.length === 0) {
        setErrorMsg('Nenhum número válido encontrado. Usa números com 7 a 15 dígitos.');
        return;
      }

      setErrorMsg(null);
      setPreview(data);
      setStep('preview');
    } catch (error) {
      console.error('Error parsing CSV:', error);
      setErrorMsg('Erro ao processar ficheiro CSV.');
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!/\.(csv|txt)$/i.test(selectedFile.name)) {
      setErrorMsg('Seleciona um ficheiro CSV ou TXT.');
      return;
    }

    setFile(selectedFile);
    await parseCSV(selectedFile);
  };

  const handleImport = () => {
    if (preview.length === 0) return;
    mutation.mutate(preview);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar Contactos</DialogTitle>
          <DialogDescription>
            Carrega uma lista simples com número, ou nome e número
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            {errorMsg && (
              <ErrorState
                compact
                title="Não foi possível preparar o CSV"
                message={errorMsg}
                onRetry={() => file && parseCSV(file)}
                secondaryAction={{ label: 'Escolher outro ficheiro', onClick: resetForm }}
              />
            )}
            <div className="border-2 border-dashed border-white/20 rounded-lg p-6 text-center">
              <Upload className="w-8 h-8 mx-auto mb-2 text-slate-500" />
              <Label className="cursor-pointer block">
                <span className="text-blue-600 hover:text-blue-500 hover:underline font-medium">
                  Clique para selecionar
                </span>
                  <span className="text-slate-500 ml-1">ou arraste um ficheiro CSV/TXT</span>
                <Input
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </Label>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <p className="text-sm font-medium mb-2 text-[#0A2540]">Formato simples:</p>
              <div className="space-y-1 text-sm text-slate-600">
                <p>• Apenas números, um por linha; ou</p>
                <p>• Duas colunas: <strong>Nome</strong> e <strong>Número</strong>.</p>
                <p className="text-xs text-slate-500">Aceita vírgula ou ponto e vírgula, com ou sem cabeçalho.</p>
              </div>
            </div>

            {file && (
              <p className="text-sm text-emerald-400">
                ✓ Ficheiro selecionado: {file.name}
              </p>
            )}
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            {errorMsg && (
              <ErrorState
                compact
                title="Não foi possível importar os contactos"
                message={errorMsg}
                onRetry={handleImport}
                secondaryAction={{ label: 'Voltar', onClick: () => setStep('upload') }}
              />
            )}
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <p className="text-sm font-medium text-emerald-300">
                {preview.length} contactos prontos para importar
              </p>
            </div>

            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50">
                  <tr>
                    <th className="text-left p-2 text-[#0A2540] font-semibold">Nome</th>
                    <th className="text-left p-2 text-[#0A2540] font-semibold">Telefone</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 5).map((contact, idx) => (
                    <tr key={idx} className="border-t border-slate-200 hover:bg-slate-50">
                      <td className="p-2 text-[#0A2540]">
                        {contact.name || 'Sem nome'}
                      </td>
                      <td className="p-2 text-[#0A2540]">{contact.phone}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.length > 5 && (
                <p className="text-xs text-slate-400 p-2">
                  ... e mais {preview.length - 5} contactos
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setStep('upload')}
                className="flex-1"
              >
                Voltar
              </Button>
              <LoadingButton
                onClick={handleImport}
                loading={mutation.isPending}
                loadingLabel="A importar..."
                className="flex-1"
              >
                Confirmar Importação
              </LoadingButton>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="space-y-4">
            <Card className="bg-emerald-500/10 border-emerald-500/30 p-6 text-center">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-emerald-400" />
              <h3 className="font-semibold text-emerald-300 mb-1">Sucesso!</h3>
              <p className="text-sm text-emerald-200">
                {mutation.data?.imported} contactos importados com sucesso
              </p>
              {mutation.data?.skipped && mutation.data.skipped > 0 && (
                <p className="text-xs text-emerald-300 mt-2">
                  {mutation.data?.skipped} contactos pulados (duplicados)
                </p>
              )}
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
