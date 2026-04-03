'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createAutomation, getChatUsers, getContacts, getForms, getPipelineStages } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Automation, PipelineStage } from '@/lib/types';

const VALID_REVENUES = [
  '- 50 Milhões De Kwanzas',
  'Entre 50 - 100 Milhões',
  'Entre 100 Milhões - 500 Milhões',
  '+ 500 M',
];
const TASK_PRIORITIES = ['Baixa', 'Media', 'Alta'] as const;

export default function AutomationForm({ onSuccess }: { onSuccess?: () => void }) {
  const [formData, setFormData] = useState({
    trigger: 'new_contact',
    triggerValue: '',
    formId: '',
    action: 'update_stage',
    targetStage: '',
    taskTitle: '',
    taskNotes: '',
    taskPriority: 'Media' as (typeof TASK_PRIORITIES)[number],
    taskDueDays: '0',
    taskAssignedToUserId: '',
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => getContacts(),
  });

  const { data: stages = [] } = useQuery({
    queryKey: ['pipeline-stages'],
    queryFn: getPipelineStages,
  });

  const { data: forms = [] } = useQuery({
    queryKey: ['forms'],
    queryFn: getForms,
  });

  const { data: orgUsers = [] } = useQuery({
    queryKey: ['chat-users'],
    queryFn: getChatUsers,
  });

  useEffect(() => {
    if (!formData.targetStage && stages[0]?.name) {
      setFormData((prev) => ({ ...prev, targetStage: stages[0].name }));
    }
  }, [formData.targetStage, stages]);

  useEffect(() => {
    if (!formData.taskAssignedToUserId && orgUsers[0]?.id) {
      setFormData((prev) => ({ ...prev, taskAssignedToUserId: String(orgUsers[0].id) }));
    }
  }, [formData.taskAssignedToUserId, orgUsers]);

  const allTags = Array.from(
    new Set(contacts.flatMap((contact) => Array.isArray(contact.tags) ? contact.tags : []))
  ).sort();

  const allSectors = Array.from(
    new Set(contacts.map((contact) => contact.sector).filter(Boolean))
  ).sort();

  const mutation = useMutation({
    mutationFn: () => {
      const payload: Partial<Automation> = {
        trigger: formData.trigger,
        action: formData.action,
      };

      if (['contact_tag', 'contact_revenue', 'contact_sector'].includes(formData.trigger)) {
        payload.triggerValue = formData.triggerValue;
      }

      if (formData.trigger === 'form_submission' && formData.formId) {
        payload.formId = formData.formId;
      }

      if (formData.action === 'update_stage') {
        payload.targetStage = formData.targetStage;
      }

      if (formData.action === 'create_task') {
        payload.taskTitle = formData.taskTitle;
        payload.taskNotes = formData.taskNotes;
        payload.taskPriority = formData.taskPriority;
        payload.taskAssignedToUserId = parseInt(formData.taskAssignedToUserId, 10);
        payload.taskDueDays = formData.taskDueDays === '' ? null : parseInt(formData.taskDueDays, 10);
      }

      return createAutomation(payload);
    },
    onSuccess: () => {
      setFormData({
        trigger: 'new_contact',
        triggerValue: '',
        formId: '',
        action: 'update_stage',
        targetStage: stages[0]?.name || '',
        taskTitle: '',
        taskNotes: '',
        taskPriority: 'Media',
        taskDueDays: '0',
        taskAssignedToUserId: orgUsers[0]?.id ? String(orgUsers[0].id) : '',
      });
      onSuccess?.();
    },
  });

  const isValidForm = () => {
    if (['contact_tag', 'contact_revenue', 'contact_sector'].includes(formData.trigger) && !formData.triggerValue) {
      return false;
    }

    if (formData.trigger === 'form_submission' && formData.formId && !forms.some((form) => form.id === formData.formId)) {
      return false;
    }

    if (formData.action === 'update_stage') {
      return !!formData.targetStage;
    }

    if (formData.action === 'create_task') {
      if (!formData.taskTitle.trim() || !formData.taskAssignedToUserId) {
        return false;
      }

      if (formData.taskDueDays !== '' && Number.isNaN(Number(formData.taskDueDays))) {
        return false;
      }

      if (formData.taskDueDays !== '' && Number(formData.taskDueDays) < 0) {
        return false;
      }
    }

    return true;
  };

  const handleTriggerChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      trigger: value,
      triggerValue: '',
      formId: value === 'form_submission' ? prev.formId : '',
    }));
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-4">
      <div>
        <Label htmlFor="trigger">Trigger (Evento)</Label>
        <Select value={formData.trigger} onValueChange={handleTriggerChange}>
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

      {formData.trigger === 'form_submission' && (
        <div>
          <Label>Formulário</Label>
          <Select
            value={formData.formId || '__all__'}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, formId: value === '__all__' ? '' : value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos os formulários" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os formulários</SelectItem>
              {forms.map((form) => (
                <SelectItem key={form.id} value={form.id}>
                  {form.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

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
              {VALID_REVENUES.map((revenue) => <SelectItem key={revenue} value={revenue}>{revenue}</SelectItem>)}
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
        <Select value={formData.action} onValueChange={(value) => setFormData((prev) => ({ ...prev, action: value }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="update_stage">Mover para Etapa do Pipeline</SelectItem>
            <SelectItem value="create_task">Criar Tarefa</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {formData.action === 'update_stage' && (
        <div>
          <Label>Mover para Etapa *</Label>
          <Select
            value={formData.targetStage}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, targetStage: value }))}
            disabled={stages.length === 0}
          >
            <SelectTrigger><SelectValue placeholder="Selecione uma etapa" /></SelectTrigger>
            <SelectContent>
              {stages.map((stage: PipelineStage) => (
                <SelectItem key={stage.id} value={stage.name}>
                  {stage.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {formData.action === 'create_task' && (
        <>
          <div>
            <Label>Título da tarefa *</Label>
            <Input
              value={formData.taskTitle}
              onChange={(e) => setFormData((prev) => ({ ...prev, taskTitle: e.target.value }))}
              placeholder="Ex.: Ligar para novo lead {{nome}}"
            />
          </div>

          <div>
            <Label>Notas da tarefa</Label>
            <Textarea
              value={formData.taskNotes}
              onChange={(e) => setFormData((prev) => ({ ...prev, taskNotes: e.target.value }))}
              placeholder="Contexto adicional para a equipa"
            />
          </div>

          <div>
            <Label>Responsável *</Label>
            <Select
              value={formData.taskAssignedToUserId}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, taskAssignedToUserId: value }))}
            >
              <SelectTrigger><SelectValue placeholder="Selecione um responsável" /></SelectTrigger>
              <SelectContent>
                {orgUsers.map((user) => (
                  <SelectItem key={user.id} value={String(user.id)}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Prioridade</Label>
            <Select
              value={formData.taskPriority}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, taskPriority: value as (typeof TASK_PRIORITIES)[number] }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TASK_PRIORITIES.map((priority) => (
                  <SelectItem key={priority} value={priority}>
                    {priority}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Prazo em dias</Label>
            <Input
              type="number"
              min="0"
              value={formData.taskDueDays}
              onChange={(e) => setFormData((prev) => ({ ...prev, taskDueDays: e.target.value }))}
              placeholder="0 = hoje"
            />
          </div>
        </>
      )}

      <Button type="submit" disabled={mutation.isPending || !isValidForm()} className="w-full">
        {mutation.isPending ? 'Guardando...' : 'Guardar'}
      </Button>

      {mutation.isError && <p className="text-red-600 text-sm">Erro ao criar automação</p>}
    </form>
  );
}
