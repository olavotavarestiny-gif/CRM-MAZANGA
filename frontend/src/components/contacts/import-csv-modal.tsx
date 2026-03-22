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
import { AlertCircle, CheckCircle2, Upload } from 'lucide-react';

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

  const mutation = useMutation({
    mutationFn: (contacts: ImportContactData[]) => importContacts(contacts),
    onSuccess: () => {
      setErrorMsg(null);
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setStep('success');
      setTimeout(() => {
        onOpenChange(false);
        resetForm();
      }, 2000);
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error || error?.message || 'Erro desconhecido ao importar';
      setErrorMsg(message);
    },
  });

  const resetForm = () => {
    setFile(null);
    setPreview([]);
    setStep('upload');
    setErrorMsg(null);
  };

  // Função para encontrar coluna por substring
  const findHeaderIndex = (headers: string[], ...keywords: string[]): number => {
    return headers.findIndex((h) =>
      keywords.some((kw) => h.toLowerCase().includes(kw.toLowerCase()))
    );
  };

  const parseCSV = async (file: File) => {
    try {
      let text = await file.text();

      // 1. Remover BOM se presente
      text = text.replace(/^\uFEFF/, '');

      // 2. Normalizar line endings (Windows \r\n → \n)
      const normalizedText = text
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n');
      const lines = normalizedText
        .split('\n')
        .filter((line) => line.trim());

      if (lines.length < 2) {
        alert('CSV deve ter pelo menos uma linha de dados');
        return;
      }

      // 3. Auto-detectar delimitador: contar ';' vs ','
      const firstLine = lines[0];
      const semicolonCount = (firstLine.match(/;/g) || []).length;
      const commaCount = (firstLine.match(/,/g) || []).length;
      const delimiter = semicolonCount > commaCount ? ';' : ',';

      // 4. Parse headers com delimitador detectado
      const rawHeaders = firstLine
        .split(delimiter)
        .map((h) => h.trim().replace(/^"(.*)"$/, '$1'));

      console.log('Delimiter:', delimiter, 'Headers:', rawHeaders);

      // 5. Calcular índices UMA VEZ, fora do loop
      const firstIdx = findHeaderIndex(
        rawHeaders,
        'First Name',
        'first name',
        'primeiro nome'
      );
      const lastIdx = findHeaderIndex(
        rawHeaders,
        'Last Name',
        'last name',
        'sobrenome'
      );
      const companyIdx = findHeaderIndex(
        rawHeaders,
        'Company Name',
        'company',
        'empresa'
      );
      const phoneIdx = findHeaderIndex(rawHeaders, 'Phone', 'telefone');
      const emailIdx = findHeaderIndex(rawHeaders, 'Email', 'e-mail');
      const revenueIdx = findHeaderIndex(
        rawHeaders,
        'Faturamento',
        'faturação',
        'revenue'
      );
      const sectorIdx = findHeaderIndex(rawHeaders, 'Setor', 'sector');

      const data: ImportContactData[] = [];

      // 6. Parse rows
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Split por delimitador detectado
        const values = line
          .split(delimiter)
          .map((v) => v.trim().replace(/^"(.*)"$/, '$1').trim());

        const phone =
          phoneIdx >= 0 ? values[phoneIdx]?.trim() : undefined;

        // Apenas processar se tiver telefone
        if (phone) {
          const contact: ImportContactData = {
            firstName:
              firstIdx >= 0 ? values[firstIdx]?.trim() || '' : '',
            lastName:
              lastIdx >= 0 ? values[lastIdx]?.trim() || '' : '',
            companyName:
              companyIdx >= 0 ? values[companyIdx]?.trim() || '' : '',
            phone,
            email: emailIdx >= 0 ? values[emailIdx]?.trim() || '' : '',
            revenue:
              revenueIdx >= 0 ? values[revenueIdx]?.trim() || '' : '',
            sector:
              sectorIdx >= 0 ? values[sectorIdx]?.trim() || '' : '',
          };

          data.push(contact);
        }
      }

      if (data.length === 0) {
        alert('Nenhum contacto válido encontrado no CSV');
        return;
      }

      setPreview(data);
      setStep('preview');
    } catch (error) {
      console.error('Error parsing CSV:', error);
      alert('Erro ao processar ficheiro CSV');
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      alert('Por favor, selecione um ficheiro CSV');
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
            Faça upload de um ficheiro CSV com os seus contactos
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-white/20 rounded-lg p-6 text-center">
              <Upload className="w-8 h-8 mx-auto mb-2 text-slate-500" />
              <Label className="cursor-pointer block">
                <span className="text-blue-600 hover:text-blue-500 hover:underline font-medium">
                  Clique para selecionar
                </span>
                <span className="text-slate-500 ml-1">ou arraste um ficheiro CSV</span>
                <Input
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </Label>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <p className="text-sm font-medium mb-2 text-[#0A2540]">Colunas esperadas:</p>
              <div className="grid grid-cols-2 gap-2 text-sm text-slate-600">
                <span>• First Name (Primeiro Nome)</span>
                <span>• Last Name (Apelido)</span>
                <span>• Company Name (Empresa)</span>
                <span>• Phone (Telefone)</span>
                <span>• Email</span>
                <span>• Faturamento Anual</span>
                <span>• Setor</span>
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
                    <th className="text-left p-2 text-[#0A2540] font-semibold">Empresa</th>
                    <th className="text-left p-2 text-[#0A2540] font-semibold">Setor</th>
                    <th className="text-left p-2 text-[#0A2540] font-semibold">Faturação</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 5).map((contact, idx) => (
                    <tr key={idx} className="border-t border-slate-200 hover:bg-slate-50">
                      <td className="p-2 text-[#0A2540]">
                        {contact.firstName} {contact.lastName}
                      </td>
                      <td className="p-2 text-[#0A2540]">{contact.phone}</td>
                      <td className="p-2 text-slate-500">{contact.companyName}</td>
                      <td className="p-2 text-slate-500">{contact.sector}</td>
                      <td className="p-2 text-slate-500 text-xs">
                        {contact.revenue}
                      </td>
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
              <Button
                onClick={handleImport}
                disabled={mutation.isPending}
                className="flex-1"
              >
                {mutation.isPending ? 'Importando...' : 'Confirmar Importação'}
              </Button>
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

        {(mutation.isError || errorMsg) && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-300">{errorMsg || 'Erro ao importar contactos'}</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
