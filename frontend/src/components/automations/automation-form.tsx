'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createAutomation, getContacts } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Stage } from '@/lib/types';

const STAGES: Stage[] = ['Novo', 'Contactado', 'Qualificado', 'Proposta Enviada', 'Fechado', 'Perdido'];
const VALID_REVENUES = [
  '- 50 Milhões De Kwanzas',
  'Entre 50 - 100 Milhões',
  'Entre 100 Milhões - 500 Milhões',
  '+ 500 M',
];

export default function AutomationForm({ onSuccess }: { onSuccess?: () => void }) {
  const [formData, setFormData] = useState({
    trigger: 'new_contact',
    triggerValue: '',
    action: 'update_stage',
    targetStage: 'Novo' as Stage,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => getContacts(),
  });

  const allTags = Array.from(
    new Set(contacts.flatMap((c) => {
      try { return c.tags ? JSON.parse(JSON.stringify(c.tags)) : []; }
      catch { return []; }
    }))
  ).sort();

  const allSectors = Array.from(
    new Set(contacts.map((c) => c.sector).filter(Boolean))
  ).sort();

  const mutation = useMutation({
    mutationFn: () => {
      const payload: any = {
        trigger: formData.trigger,
        action: formData.action,
      };
      if (['contact_tag', 'contact_revenue', 'contact_sector'].includes(formData.trigger)) {
        payload.triggerValue = formData.triggerValue;
      }
      if (formData.action === 'update_stage') {
        payload.targetStage = formData.targetStage;
      }
      return createAutomation(payload);
    },
    onSuccess: () => {
      setFormData({ trigger: 'new_contact', triggerValue: '', action: 'update_stage', targetStage: 'Novo' });
      onSuccess?.();
    },
  });

  const isValidForm = () => {
    if (['contact_tag', 'contact_revenue', 'contact_sector'].includes(formData.trigger)) {
      if (!formData.triggerValue) return false;
    }
    return !!formData.targetStage;
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-4">
      <div>
        <Label htmlFor="trigger">Trigger (Evento)</Label>
        <Select
          value={formData.trigger}
          onValueChange={(value) =>
            setFormData((prev) => ({ ...prev, trigger: value, triggerValue: '' }))
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="new_contact">Novo Contacto</SelectItem>
            <SelectItem value="form_submission">Submissão de Formulário</SelectItem>
            <SelectItem value="contact_tag">Contacto com Tag</SelectItem>
            <SelectItem value="contact_revenue">Contacto por Faturação</SelectItem>
            <SelectItem value="contact_sector">Contacto por Setor</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {formData.trigger === 'contact_tag' && (
        <div>
          <Label>Selecionar Tag *</Label>
          <Input
            placeholder="Digite ou selecione uma tag"
            value={formData.triggerValue}
            onChange={(e) => setFormData((prev) => ({ ...prev, triggerValue: e.target.value }))}
            list="tags-list"
            required
          />
          <datalist id="tags-list">
            {allTags.map((tag) => <option key={tag} value={tag} />)}
          </datalist>
        </div>
      )}

      {formData.trigger === 'contact_revenue' && (
        <div>
          <Label>Selecionar Faturação *</Label>
          <Select value={formData.triggerValue} onValueChange={(value) => setFormData((prev) => ({ ...prev, triggerValue: value }))}>
            <SelectTrigger><SelectValue placeholder="Selecione um intervalo" /></SelectTrigger>
            <SelectContent>
              {VALID_REVENUES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {formData.trigger === 'contact_sector' && (
        <div>
          <Label>Selecionar Setor *</Label>
          {allSectors.length > 0 ? (
            <Select value={formData.triggerValue} onValueChange={(value) => setFormData((prev) => ({ ...prev, triggerValue: value }))}>
              <SelectTrigger><SelectValue placeholder="Selecione um setor" /></SelectTrigger>
              <SelectContent>
                {allSectors.map((sector) => <SelectItem key={sector} value={sector!}>{sector}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : (
            <Input
              placeholder="Digite o setor"
              value={formData.triggerValue}
              onChange={(e) => setFormData((prev) => ({ ...prev, triggerValue: e.target.value }))}
              required
            />
          )}
        </div>
      )}

      <div>
        <Label>Ação</Label>
        <Select
          value={formData.action}
          onValueChange={(value) => setFormData((prev) => ({ ...prev, action: value, targetStage: 'Novo' }))}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="update_stage">Mover para Etapa do Pipeline</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Mover para Etapa *</Label>
        <Select
          value={formData.targetStage}
          onValueChange={(value) => setFormData((prev) => ({ ...prev, targetStage: value as Stage }))}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {STAGES.map((stage) => <SelectItem key={stage} value={stage}>{stage}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Button type="submit" disabled={mutation.isPending || !isValidForm()} className="w-full">
        {mutation.isPending ? 'Guardando...' : 'Guardar'}
      </Button>

      {mutation.isError && <p className="text-red-600 text-sm">Erro ao criar automação</p>}
    </form>
  );
}
