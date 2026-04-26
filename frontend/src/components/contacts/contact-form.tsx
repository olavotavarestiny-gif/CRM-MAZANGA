'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createContact, updateContact, getContactFieldDefs, getContactFieldConfigs, getPipelineStages, getCurrentUser, getContactGroups } from '@/lib/api';
import type { Contact, ContactFieldType } from '@/lib/types';
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
import { X } from 'lucide-react';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingButton } from '@/components/ui/loading-button';
import { useToast } from '@/components/ui/toast-provider';

const NO_GROUP_VALUE = '__NONE__';

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-[#6b7e9a]">{title}</p>
      {children}
    </section>
  );
}

// Renders a single field based on its type
function FieldInput({
  fieldKey,
  type,
  options,
  value,
  onChange,
  required,
  placeholder,
}: {
  fieldKey: string;
  type: ContactFieldType | 'tags';
  options?: string[];
  value: string | string[];
  onChange: (v: string | string[]) => void;
  required?: boolean;
  placeholder?: string;
}) {
  const [tagInput, setTagInput] = useState('');

  if (type === 'tags') {
    const tags = Array.isArray(value) ? value : [];
    const addTag = () => {
      const v = tagInput.trim();
      if (v && !tags.includes(v)) {
        onChange([...tags, v]);
        setTagInput('');
      }
    };
    return (
      <div>
        <div className="flex gap-2">
          <Input
            placeholder="Escrever tag e pressionar Enter..."
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
          />
          <Button type="button" variant="outline" size="sm" onClick={addTag} className="flex-shrink-0">
            Adicionar
          </Button>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 bg-[#0A2540]/8 border border-[#dde3ec] rounded-full px-2.5 py-0.5 text-xs text-[#0A2540]"
              >
                {tag}
                <button type="button" onClick={() => onChange(tags.filter((t) => t !== tag))}>
                  <X className="w-3 h-3 hover:text-red-500" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (type === 'select') {
    return (
      <Select value={value as string} onValueChange={(v) => onChange(v)}>
        <SelectTrigger>
          <SelectValue placeholder="Selecionar..." />
        </SelectTrigger>
        <SelectContent>
          {(options ?? []).map((opt) => (
            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <Input
      type={
        type === 'number' ? 'number'
        : type === 'date' ? 'date'
        : type === 'url' ? 'url'
        : fieldKey === 'email' ? 'email'
        : 'text'
      }
      value={value as string}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      placeholder={placeholder}
    />
  );
}

export default function ContactForm({
  contact,
  contactId,
  onSuccess,
  onManageGroups,
}: {
  contact?: Contact;
  contactId?: number;
  onSuccess?: () => void;
  onManageGroups?: () => void;
}) {
  const isEditMode = !!contactId;
  const { toast } = useToast();

  // Core values (always present)
  const [name, setName] = useState(contact?.name ?? '');
  const [stage, setStage] = useState(contact?.stage ?? 'Novo');
  const [dealValueKz, setDealValueKz] = useState(
    contact?.dealValueKz !== null && contact?.dealValueKz !== undefined ? String(contact.dealValueKz) : ''
  );
  const [tipoCliente, setTipoCliente] = useState<'empresa' | 'particular'>(
    contact?.clienteType || 'particular'
  );
  const [contactGroupId, setContactGroupId] = useState<string | null>(contact?.contactGroupId ?? null);

  // Dynamic values keyed by field.key
  const [values, setValues] = useState<Record<string, string | string[]>>(() => {
    const base: Record<string, string | string[]> = {
      email: contact?.email ?? '',
      phone: contact?.phone ?? '',
      nif: contact?.nif ?? '',
      company: contact?.company ?? '',
      revenue: contact?.revenue ?? '',
      sector: contact?.sector ?? '',
      tags: contact?.tags ?? [],
      ...(contact?.customFields ?? {}),
    };
    return base;
  });

  useEffect(() => {
    if (contact) {
      setName(contact.name);
      setStage(contact.stage);
      setDealValueKz(
        contact.dealValueKz !== null && contact.dealValueKz !== undefined ? String(contact.dealValueKz) : ''
      );
      setTipoCliente(contact.clienteType || 'particular');
      setContactGroupId(contact.contactGroupId ?? null);
      setValues({
        email: contact.email ?? '',
        phone: contact.phone ?? '',
        nif: contact.nif ?? '',
        company: contact.company ?? '',
        revenue: contact.revenue ?? '',
        sector: contact.sector ?? '',
        tags: contact.tags ?? [],
        ...(contact.customFields ?? {}),
      });
    }
  }, [contact]);

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
    staleTime: 30_000,
  });

  const hasCurrentUser = !!currentUser;

  const { data: fieldDefsData } = useQuery({
    queryKey: ['contactFieldDefs'],
    queryFn: getContactFieldDefs,
    enabled: hasCurrentUser,
  });
  const fieldDefs = Array.isArray(fieldDefsData)
    ? fieldDefsData.filter((field) => field && typeof field.id === 'string' && typeof field.key === 'string')
    : [];

  const { data: systemConfigsData } = useQuery({
    queryKey: ['contactFieldConfigs'],
    queryFn: getContactFieldConfigs,
    staleTime: 0,
    enabled: hasCurrentUser,
  });
  const systemConfigs = Array.isArray(systemConfigsData)
    ? systemConfigsData.filter((config) => config && typeof config.fieldKey === 'string')
    : [];

  const isComercioWorkspace = currentUser?.workspaceMode === 'comercio';
  const showStageField = isEditMode || !isComercioWorkspace;

  const { data: pipelineStagesData } = useQuery({
    queryKey: ['pipeline-stages'],
    queryFn: getPipelineStages,
    enabled: hasCurrentUser && showStageField,
  });
  const pipelineStages = Array.isArray(pipelineStagesData)
    ? pipelineStagesData.filter((stage) => stage && typeof stage.id === 'string' && typeof stage.name === 'string' && stage.name.trim().length > 0)
    : [];

  const { data: contactGroupsData } = useQuery({
    queryKey: ['contactGroups'],
    queryFn: getContactGroups,
    enabled: hasCurrentUser,
  });
  const contactGroups = Array.isArray(contactGroupsData)
    ? contactGroupsData.filter((group) => group && typeof group.id === 'string' && group.id.trim().length > 0)
    : [];

  useEffect(() => {
    if (contactGroupId && !contactGroups.some((group) => group.id === contactGroupId)) {
      setContactGroupId(null);
    }
  }, [contactGroupId, contactGroups]);

  const nameConfig = systemConfigs.find(c => c.fieldKey === 'name');
  const phoneConfig = systemConfigs.find(c => c.fieldKey === 'phone');
  const nifConfig = systemConfigs.find(c => c.fieldKey === 'nif');
  const companyConfig = systemConfigs.find(c => c.fieldKey === 'company');
  const sectorConfig = systemConfigs.find(c => c.fieldKey === 'sector');
  const clienteTypeConfig = systemConfigs.find(c => c.fieldKey === 'clienteType');

  // Core fields are rendered with dedicated UI, so they should not repeat below.
  const ALWAYS_SHOWN = new Set(['name', 'phone', 'nif', 'company', 'sector', 'clienteType']);
  const allSystemFieldsSorted = systemConfigs.sort((a, b) => a.order - b.order);
  const visibleSystemFields = allSystemFieldsSorted.filter(c => {
    if (ALWAYS_SHOWN.has(c.fieldKey)) return false; // rendered separately
    if (!c.visible) return false;
    return true;
  });

  const setValue = (key: string, val: string | string[]) =>
    setValues((prev) => ({ ...prev, [key]: val }));

  const mutation = useMutation({
    mutationFn: () => {
      // Separate system field values from custom field values
      const systemKeys = new Set(['email', 'phone', 'nif', 'company', 'revenue', 'sector', 'tags']);
      const customFields: Record<string, string> = {};
      for (const [k, v] of Object.entries(values)) {
        if (!systemKeys.has(k)) customFields[k] = v as string;
      }

      const payload = {
        name,
        clienteType: tipoCliente,
        contactGroupId,
        email: (values.email as string) || '',
        phone: (values.phone as string) || '',
        nif: (values.nif as string) || '',
        company: tipoCliente === 'empresa' ? (values.company as string) || '' : '',
        dealValueKz: dealValueKz.trim() ? Number(dealValueKz) : null,
        revenue: (values.revenue as string) || null,
        sector: tipoCliente === 'empresa' ? (values.sector as string) || null : null,
        tags: Array.isArray(values.tags) ? values.tags : [],
        customFields,
      };

      if (showStageField) {
        (payload as any).stage = stage;
      }

      return isEditMode
        ? updateContact(String(contactId), payload as any)
        : createContact(payload as any);
    },
    onSuccess: () => {
      if (!isEditMode) {
        setName('');
        setStage('Novo');
        setDealValueKz('');
        setContactGroupId(null);
        setValues({ email: '', phone: '', nif: '', company: '', revenue: '', sector: '', tags: [] });
      }
      toast({
        variant: 'success',
        title: isEditMode ? 'Contacto actualizado' : 'Contacto criado',
        description: isEditMode ? 'As alterações foram guardadas.' : 'O novo contacto já está disponível na lista.',
      });
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        variant: 'error',
        title: 'Falha ao guardar contacto',
        description: error?.response?.data?.error || error?.message || 'Tenta novamente.',
      });
    },
  });

  const customFieldDefs = fieldDefs;

  return (
    <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-5 pb-2">
      <FormSection title="Dados principais">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>{clienteTypeConfig?.label || 'Tipo de Cliente'}{clienteTypeConfig?.required && <span className="text-red-500 ml-0.5">*</span>}</Label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTipoCliente('particular')}
                className={`rounded-lg border py-2 text-sm font-medium transition ${
                  tipoCliente === 'particular'
                    ? 'bg-[#0A2540] text-white border-[#0A2540]'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
              >
                Particular
              </button>
              <button
                type="button"
                onClick={() => setTipoCliente('empresa')}
                className={`rounded-lg border py-2 text-sm font-medium transition ${
                  tipoCliente === 'empresa'
                    ? 'bg-[#0A2540] text-white border-[#0A2540]'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
              >
                Empresa
              </button>
            </div>
          </div>

          <div>
            <Label>{nameConfig?.label || 'Nome'}{(nameConfig?.required ?? true) && <span className="text-red-500 ml-0.5">*</span>}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required={nameConfig?.required ?? true}
              className="mt-1"
            />
          </div>

          <div>
            <Label>{phoneConfig?.label || 'Número'}{phoneConfig?.required && <span className="text-red-500 ml-0.5">*</span>}</Label>
            <Input
              value={values['phone'] as string}
              onChange={(e) => setValue('phone', e.target.value)}
              placeholder="+244 9xx xxx xxx"
              required={phoneConfig?.required}
              className="mt-1"
            />
          </div>

          <div>
            <Label>{nifConfig?.label || 'NIF'}{tipoCliente === 'empresa' && <span className="text-red-500 ml-0.5">*</span>}</Label>
            <Input
              value={values['nif'] as string}
              onChange={(e) => setValue('nif', e.target.value)}
              placeholder={tipoCliente === 'empresa' ? 'NIF obrigatório para empresas' : 'Opcional para particulares'}
              required={tipoCliente === 'empresa'}
              className="mt-1"
            />
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <Label>Grupo</Label>
              {onManageGroups ? (
                <button
                  type="button"
                  onClick={onManageGroups}
                  className="text-xs font-medium text-[#0A2540] hover:underline"
                >
                  Gerir grupos
                </button>
              ) : null}
            </div>
            <Select
              value={contactGroupId ?? NO_GROUP_VALUE}
              onValueChange={(value) => setContactGroupId(value === NO_GROUP_VALUE ? null : value)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Sem grupo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_GROUP_VALUE}>Sem grupo</SelectItem>
                {contactGroups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </FormSection>

      {tipoCliente === 'empresa' && (
        <FormSection title="Empresa">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {companyConfig && companyConfig.visible !== false && (
              <div>
                <Label>{companyConfig.label}{companyConfig.required && <span className="text-red-500 ml-0.5">*</span>}</Label>
                <div className="mt-1">
                  <FieldInput
                    fieldKey="company"
                    type="text"
                    value={values['company'] ?? ''}
                    onChange={(v) => setValue('company', v)}
                    required={companyConfig.required}
                  />
                </div>
              </div>
            )}
            {sectorConfig && sectorConfig.visible !== false && (
              <div>
                <Label>{sectorConfig.label}{sectorConfig.required && <span className="text-red-500 ml-0.5">*</span>}</Label>
                <div className="mt-1">
                  <FieldInput
                    fieldKey="sector"
                    type="text"
                    value={values['sector'] ?? ''}
                    onChange={(v) => setValue('sector', v)}
                    required={sectorConfig.required}
                  />
                </div>
              </div>
            )}
          </div>
        </FormSection>
      )}

      <FormSection title="Processo">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {showStageField ? (
            <div>
              <Label>Etapa *</Label>
              <Select value={stage} onValueChange={(v) => setStage(v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pipelineStages.map((s) => (
                    <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 md:col-span-2">
              No modo Comércio, cada contacto é criado automaticamente como cliente e fica fora de Processos. Usa Processos apenas quando a compra precisar de acompanhamento e negociação.
            </div>
          )}

          <div>
            <Label>Valor da Negociação (Kz)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={dealValueKz}
              onChange={(e) => setDealValueKz(e.target.value)}
              placeholder="Opcional. Se vazio, o analytics usa ticket médio."
              className="mt-1"
            />
            <p className="mt-1 text-xs text-[#6b7e9a]">
              Usado em Processos e no forecast.
            </p>
          </div>
        </div>
      </FormSection>

      {visibleSystemFields.length > 0 && (
        <FormSection title="Informação adicional">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {visibleSystemFields.map((cfg) => (
              <div key={cfg.fieldKey}>
                <Label>
                  {cfg.label}
                  {cfg.required && <span className="text-red-500 ml-0.5">*</span>}
                </Label>
                <div className="mt-1">
                  <FieldInput
                    fieldKey={cfg.fieldKey}
                    type="text"
                    value={values[cfg.fieldKey] ?? ''}
                    onChange={(v) => setValue(cfg.fieldKey, v)}
                    required={cfg.required}
                  />
                </div>
              </div>
            ))}
          </div>
        </FormSection>
      )}

      {customFieldDefs.length > 0 && (
        <FormSection title="Campos personalizados">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {customFieldDefs.map((field) => (
              <div key={field.key}>
                <Label>
                  {field.label}
                  {field.required && <span className="text-red-500 ml-0.5">*</span>}
                </Label>
                <div className="mt-1">
                  <FieldInput
                    fieldKey={field.key}
                    type={field.type}
                    options={field.options}
                    value={values[field.key] ?? ''}
                    onChange={(v) => setValue(field.key, v)}
                    required={field.required}
                  />
                </div>
              </div>
            ))}
          </div>
        </FormSection>
      )}

      {mutation.isError && (
        <ErrorState
          compact
          title="Não foi possível guardar o contacto"
          message={(mutation.error as any)?.response?.data?.error || (mutation.error as Error)?.message || 'Verifica os dados e tenta novamente.'}
          onRetry={() => mutation.mutate()}
        />
      )}

      <LoadingButton
        type="submit"
        loading={mutation.isPending}
        loadingLabel={isEditMode ? 'A guardar...' : 'A criar...'}
        className="w-full"
      >
        {isEditMode ? 'Guardar Alterações' : 'Criar Contacto'}
      </LoadingButton>
    </form>
  );
}
