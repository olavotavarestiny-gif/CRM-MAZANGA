'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createAutomation, getWhatsAppTemplates, getContacts } from '@/lib/api';
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
import { Textarea } from '@/components/ui/textarea';
import type { Stage } from '@/lib/types';

const VARIABLES_HINT = 'Variáveis disponíveis: {{nome}}, {{empresa}}, {{telefone}}, {{email}}';
const STAGES: Stage[] = ['Novo', 'Contactado', 'Qualificado', 'Proposta Enviada', 'Fechado', 'Perdido'];
const VALID_REVENUES = [
  '- 50 Milhões De Kwanzas',
  'Entre 50 - 100 Milhões',
  'Entre 100 Milhões - 500 Milhões',
  '+ 500 M',
];

export default function AutomationForm({
  onSuccess,
}: {
  onSuccess?: () => void;
}) {
  const [formData, setFormData] = useState({
    trigger: 'new_contact',
    triggerValue: '',
    action: 'send_whatsapp_template',
    targetStage: 'Novo' as Stage,
    templateName: '',
    emailSubject: '',
    emailBody: '',
  });

  const { data: templates = [], isLoading: isLoadingTemplates } = useQuery({
    queryKey: ['whatsapp-templates'],
    queryFn: () => getWhatsAppTemplates(),
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => getContacts(),
  });

  // Extract unique tags and sectors from contacts
  const allTags = Array.from(
    new Set(
      contacts.flatMap((c) => {
        try {
          return c.tags ? JSON.parse(JSON.stringify(c.tags)) : [];
        } catch {
          return [];
        }
      })
    )
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

      if (formData.action === 'send_whatsapp_template' || formData.action === 'send_whatsapp_text') {
        payload.templateName = formData.templateName;
      }
      if (formData.action === 'send_email') {
        payload.emailSubject = formData.emailSubject;
        payload.emailBody = formData.emailBody;
      }
      if (formData.action === 'update_stage') {
        payload.targetStage = formData.targetStage;
      }

      return createAutomation(payload);
    },
    onSuccess: () => {
      setFormData({
        trigger: 'new_contact',
        triggerValue: '',
        action: 'send_whatsapp_template',
        targetStage: 'Novo',
        templateName: '',
        emailSubject: '',
        emailBody: '',
      });
      onSuccess?.();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  const isValidForm = () => {
    // Validate trigger value for conditional triggers
    if (['contact_tag', 'contact_revenue', 'contact_sector'].includes(formData.trigger)) {
      if (!formData.triggerValue) return false;
    }

    if (formData.action === 'update_stage') {
      return !!formData.targetStage;
    }
    if (formData.action === 'send_whatsapp_template' || formData.action === 'send_whatsapp_text') {
      return !!formData.templateName;
    }
    if (formData.action === 'send_email') {
      return !!formData.emailSubject && !!formData.emailBody;
    }
    return false;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="trigger">Trigger (Evento)</Label>
        <Select
          value={formData.trigger}
          onValueChange={(value) =>
            setFormData((prev) => ({
              ...prev,
              trigger: value,
              triggerValue: '',
              action: value === 'new_contact' ? 'send_whatsapp_template' : 'update_stage',
            }))
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

      {/* Trigger value selection for conditional triggers */}
      {formData.trigger === 'contact_tag' && (
        <div>
          <Label htmlFor="triggerValue">Selecionar Tag *</Label>
          <Input
            id="triggerValue"
            placeholder="Digite ou selecione uma tag"
            value={formData.triggerValue}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, triggerValue: e.target.value }))
            }
            list="tags-list"
            required
          />
          <datalist id="tags-list">
            {allTags.map((tag) => (
              <option key={tag} value={tag} />
            ))}
          </datalist>
        </div>
      )}

      {formData.trigger === 'contact_revenue' && (
        <div>
          <Label htmlFor="triggerValue">Selecionar Faturação *</Label>
          <Select value={formData.triggerValue} onValueChange={(value) => setFormData((prev) => ({ ...prev, triggerValue: value }))}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um intervalo" />
            </SelectTrigger>
            <SelectContent>
              {VALID_REVENUES.map((revenue) => (
                <SelectItem key={revenue} value={revenue}>
                  {revenue}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {formData.trigger === 'contact_sector' && (
        <div>
          <Label htmlFor="triggerValue">Selecionar Setor *</Label>
          {allSectors.length > 0 ? (
            <Select value={formData.triggerValue} onValueChange={(value) => setFormData((prev) => ({ ...prev, triggerValue: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um setor" />
              </SelectTrigger>
              <SelectContent>
                {allSectors.map((sector) => (
                  <SelectItem key={sector} value={sector!}>
                    {sector}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              id="triggerValue"
              placeholder="Digite o setor"
              value={formData.triggerValue}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, triggerValue: e.target.value }))
              }
              required
            />
          )}
        </div>
      )}

      <div>
        <Label htmlFor="action">Ação</Label>
        <Select
          value={formData.action}
          onValueChange={(value) =>
            setFormData((prev) => ({
              ...prev,
              action: value,
              templateName: '',
              emailSubject: '',
              emailBody: '',
              targetStage: 'Novo',
            }))
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="update_stage">
              Mover para Etapa do Pipeline
            </SelectItem>
            <SelectItem value="send_whatsapp_template">
              Template WhatsApp
            </SelectItem>
            <SelectItem value="send_whatsapp_text">
              Mensagem WhatsApp (Texto Livre)
            </SelectItem>
            <SelectItem value="send_email">
              Enviar Email
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {formData.action === 'update_stage' && (
        <div>
          <Label htmlFor="targetStage">Mover para Etapa *</Label>
          <Select
            value={formData.targetStage}
            onValueChange={(value) =>
              setFormData((prev) => ({ ...prev, targetStage: value as Stage }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STAGES.map((stage) => (
                <SelectItem key={stage} value={stage}>
                  {stage}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {(formData.action === 'send_whatsapp_template' || formData.action === 'send_whatsapp_text') && (
        <div>
          <Label htmlFor="templateName">
            {formData.action === 'send_whatsapp_template' ? 'Template WhatsApp *' : 'Mensagem WhatsApp *'}
          </Label>
          {formData.action === 'send_whatsapp_template' ? (
            <>
              {isLoadingTemplates ? (
                <p className="text-sm text-gray-500">Carregando templates...</p>
              ) : templates.length > 0 ? (
                <Select
                  value={formData.templateName}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, templateName: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.name} value={template.name}>
                        {template.name} ({template.language}) - {template.status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <>
                  <p className="text-sm text-red-500 mb-2">
                    Nenhum template encontrado. Insira o nome manualmente.
                  </p>
                  <Input
                    id="templateName"
                    value={formData.templateName}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, templateName: e.target.value }))
                    }
                    placeholder="Ex: welcome_message"
                    required
                  />
                </>
              )}
            </>
          ) : (
            <>
              <Textarea
                id="templateName"
                value={formData.templateName}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, templateName: e.target.value }))
                }
                placeholder="Digite a mensagem. Use variáveis como {{nome}}, {{empresa}}, etc."
                required
                className="min-h-24"
              />
              <p className="text-xs text-slate-400 mt-1">{VARIABLES_HINT}</p>
            </>
          )}
        </div>
      )}

      {formData.action === 'send_email' && (
        <>
          <div>
            <Label htmlFor="emailSubject">Assunto do Email *</Label>
            <Input
              id="emailSubject"
              value={formData.emailSubject}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, emailSubject: e.target.value }))
              }
              placeholder="Ex: Bem-vindo {{nome}}"
              required
            />
            <p className="text-xs text-slate-400 mt-1">{VARIABLES_HINT}</p>
          </div>

          <div>
            <Label htmlFor="emailBody">Corpo do Email (HTML) *</Label>
            <Textarea
              id="emailBody"
              value={formData.emailBody}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, emailBody: e.target.value }))
              }
              placeholder="Ex: <p>Olá {{nome}}, bem-vindo!</p>"
              required
              className="min-h-32 font-mono text-sm"
            />
            <p className="text-xs text-slate-400 mt-1">{VARIABLES_HINT}</p>
          </div>
        </>
      )}

      <Button
        type="submit"
        disabled={mutation.isPending || !isValidForm()}
        className="w-full"
      >
        {mutation.isPending ? 'Guardando...' : 'Guardar'}
      </Button>

      {mutation.isError && (
        <p className="text-red-600 text-sm">Erro ao criar automação</p>
      )}
    </form>
  );
}
