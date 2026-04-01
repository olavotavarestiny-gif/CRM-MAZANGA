'use client';

import { memo, useEffect, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { FormField } from '@/lib/types';

const CONTACT_FIELD_OPTIONS = [
  { value: 'name', label: 'Nome' },
  { value: 'phone', label: 'Telefone' },
  { value: 'email', label: 'Email' },
  { value: 'company', label: 'Empresa' },
  { value: 'sector', label: 'Setor' },
  { value: 'revenue', label: 'Faturamento' },
];

function createDraft(field: FormField) {
  return {
    label: field.label,
    type: field.type,
    required: field.required,
    options: field.options || [],
    contactField: field.contactField,
  };
}

interface FormFieldEditorProps {
  field?: FormField;
  canDelete: boolean;
  isDeletingField: boolean;
  onDeleteField: (fieldId: string) => void;
  onFieldChange: (fieldId: string, updates: Partial<FormField>) => void;
  onFieldFlush: (fieldId: string) => void;
}

export const FormFieldEditor = memo(function FormFieldEditor({
  field,
  canDelete,
  isDeletingField,
  onDeleteField,
  onFieldChange,
  onFieldFlush,
}: FormFieldEditorProps) {
  const [draft, setDraft] = useState(() => (field ? createDraft(field) : null));
  const [newOptionValue, setNewOptionValue] = useState('');

  useEffect(() => {
    setDraft(field ? createDraft(field) : null);
    setNewOptionValue('');
  }, [field?.id]);

  const updateDraft = (updates: Partial<FormField>, flush = false) => {
    if (!field) {
      return;
    }

    setDraft((current) => (current ? { ...current, ...updates } : current));
    onFieldChange(field.id, updates);

    if (flush) {
      onFieldFlush(field.id);
    }
  };

  const handleAddOption = () => {
    if (!field || !draft || !newOptionValue.trim()) {
      return;
    }

    updateDraft({ options: [...draft.options, newOptionValue.trim()] }, true);
    setNewOptionValue('');
  };

  const handleRemoveOption = (index: number) => {
    if (!field || !draft) {
      return;
    }

    updateDraft({ options: draft.options.filter((_, optionIndex) => optionIndex !== index) }, true);
  };

  return (
    <Card className="col-span-2 border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">
          {field ? `Editar: ${draft?.label || field.label}` : 'Selecione um campo'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!field || !draft ? (
          <p className="text-center text-[#6b7e9a] py-8">Clique num campo para editar</p>
        ) : (
          <>
            <div>
              <Label className="text-[#0A2540]">Rótulo</Label>
              <Input
                className="mt-1"
                value={draft.label}
                onChange={(e) => updateDraft({ label: e.target.value })}
                onBlur={() => onFieldFlush(field.id)}
              />
            </div>

            <div>
              <Label className="text-[#0A2540]">Tipo</Label>
              <Select value={draft.type} onValueChange={(value) => updateDraft({ type: value as FormField['type'] }, true)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Texto</SelectItem>
                  <SelectItem value="multiple_choice">Múltipla Escolha</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={draft.required} onCheckedChange={(checked) => updateDraft({ required: checked }, true)} />
              <Label className="text-[#0A2540] cursor-pointer">Obrigatório</Label>
            </div>

            <div>
              <Label className="text-[#0A2540]">Mapear para Contacto</Label>
              <div className="flex gap-2 mt-1">
                <Select
                  value={draft.contactField || 'none'}
                  onValueChange={(value) => updateDraft({ contactField: value === 'none' ? undefined : value }, true)}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Nenhum —</SelectItem>
                    {CONTACT_FIELD_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {draft.contactField && (
                  <Button variant="ghost" size="sm" onClick={() => updateDraft({ contactField: undefined }, true)}>
                    Limpar
                  </Button>
                )}
              </div>
            </div>

            {draft.type === 'multiple_choice' && (
              <div className="space-y-3 border-t border-[#E2E8F0] pt-4">
                <Label className="text-[#0A2540]">Opções</Label>
                <div className="space-y-2">
                  {draft.options.map((option, index) => (
                    <div key={`${field.id}-option-${index}`} className="flex items-center gap-2">
                      <Input value={option} readOnly className="text-sm" />
                      <Button variant="ghost" size="sm" onClick={() => handleRemoveOption(index)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Nova opção..."
                    value={newOptionValue}
                    onChange={(e) => setNewOptionValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddOption();
                      }
                    }}
                  />
                  <Button onClick={handleAddOption} size="sm">
                    Adicionar
                  </Button>
                </div>
              </div>
            )}

            {canDelete && (
              <div className="border-t border-[#E2E8F0] pt-4">
                <Button
                  variant="destructive"
                  onClick={() => onDeleteField(field.id)}
                  className="w-full"
                  disabled={isDeletingField}
                >
                  <Trash2 className="w-4 h-4 mr-2" /> Eliminar Campo
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
});
