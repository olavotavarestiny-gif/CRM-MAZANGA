'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createDeal, getCompanies } from '@/lib/api';
import { Company } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getApiErrorMessage } from '@/lib/api-error-message';

const NEW_COMPANY_SENTINEL = '__new__';

export default function NewDealDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [companyId, setCompanyId] = useState('');
  const [newCompanyName, setNewCompanyName] = useState('');
  const [title, setTitle] = useState('');
  const [valueKz, setValueKz] = useState('');

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ['companies'],
    queryFn: getCompanies,
    enabled: open,
  });

  const isCreatingNewCompany = companyId === NEW_COMPANY_SENTINEL;

  const resetForm = () => {
    setCompanyId('');
    setNewCompanyName('');
    setTitle('');
    setValueKz('');
  };

  const hasCompany = isCreatingNewCompany
    ? newCompanyName.trim().length > 0
    : companyId.length > 0;
  const isValid = title.trim().length > 0 && hasCompany;

  const createMutation = useMutation({
    mutationFn: () => {
      const parsedValue = valueKz.trim() === '' ? null : Number(valueKz);
      return createDeal({
        title: title.trim(),
        valueKz: Number.isNaN(parsedValue as number) ? null : parsedValue,
        ...(isCreatingNewCompany
          ? { newCompanyName: newCompanyName.trim() }
          : { companyId }),
      });
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      onClose();
      resetForm();
      router.push('/negociacoes/' + created.id);
    },
  });

  const handleSubmit = () => {
    if (!isValid) return;
    createMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md bg-white text-[#0A2540]">
        <DialogHeader>
          <DialogTitle className="text-[#0A2540]">Nova Negociação</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium text-[#0A2540] block mb-1.5">
              Empresa <span className="text-red-500">*</span>
            </Label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleciona uma empresa" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
                <SelectItem value={NEW_COMPANY_SENTINEL}>
                  + Criar nova empresa
                </SelectItem>
              </SelectContent>
            </Select>
            {isCreatingNewCompany && (
              <Input
                className="mt-2"
                placeholder="Nome da nova empresa"
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                autoFocus
              />
            )}
          </div>

          <div>
            <Label className="text-sm font-medium text-[#0A2540] block mb-1.5">
              Título <span className="text-red-500">*</span>
            </Label>
            <Input
              placeholder="Ex.: Fornecimento de equipamento"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div>
            <Label className="text-sm font-medium text-[#0A2540] block mb-1.5">
              Valor (Kz)
            </Label>
            <Input
              type="number"
              inputMode="numeric"
              placeholder="0"
              value={valueKz}
              onChange={(e) => setValueKz(e.target.value)}
            />
          </div>

          {!isValid && (
            <p className="text-xs text-[#6b7e9a]">
              Indica o título e seleciona (ou cria) uma empresa para continuar.
            </p>
          )}

          {createMutation.isError && (
            <p className="text-sm text-red-500">
              {getApiErrorMessage(
                createMutation.error,
                'Não foi possível criar a negociação.'
              )}
            </p>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={createMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!isValid || createMutation.isPending}
            >
              {createMutation.isPending ? 'A criar...' : 'Criar Negociação'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
