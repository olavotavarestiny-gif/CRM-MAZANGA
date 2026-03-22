'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getContactFieldConfigs,
  updateContactFieldConfig,
  getContactFieldDefs,
  createContactFieldDef,
  updateContactFieldDef,
  deleteContactFieldDef,
} from '@/lib/api';
import type { ContactFieldConfig, ContactFieldDef, ContactFieldType, SystemFieldKey } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Trash2, Plus, Pencil, X, Check, EyeOff, Eye } from 'lucide-react';

const TYPE_LABELS: Record<ContactFieldType, string> = {
  text:   'Texto',
  number: 'Número',
  date:   'Data',
  select: 'Lista de opções',
  url:    'URL / Link',
};

// ── Options editor ─────────────────────────────────────────────────────────────
function OptionsEditor({ options, onChange }: { options: string[]; onChange: (v: string[]) => void }) {
  const [input, setInput] = useState('');
  const add = () => {
    const v = input.trim();
    if (v && !options.includes(v)) { onChange([...options, v]); setInput(''); }
  };
  return (
    <div>
      <Label className="text-xs text-[#6b7e9a]">Opções da lista</Label>
      <div className="flex gap-2 mt-1">
        <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Adicionar opção..." className="h-8 text-sm"
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        <Button type="button" variant="outline" size="sm" className="h-8 px-2" onClick={add}><Plus className="w-3.5 h-3.5" /></Button>
      </div>
      {options.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {options.map((opt) => (
            <span key={opt} className="inline-flex items-center gap-1 bg-[#f5f7fa] border border-[#dde3ec] rounded-full px-2.5 py-0.5 text-xs text-[#0A2540]">
              {opt}
              <button type="button" onClick={() => onChange(options.filter(o => o !== opt))}><X className="w-3 h-3 hover:text-red-500" /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── System field row (built-in: email, phone, company, etc.) ───────────────────
function SystemFieldRow({ config }: { config: ContactFieldConfig }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(config.label);
  const [required, setRequired] = useState(config.required);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['contactFieldConfigs'] });

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof updateContactFieldConfig>[1]) =>
      updateContactFieldConfig(config.fieldKey as SystemFieldKey, data),
    onSuccess: () => { invalidate(); setEditing(false); },
  });

  const toggleVisibility = () =>
    updateContactFieldConfig(config.fieldKey as SystemFieldKey, { visible: !config.visible })
      .then(invalidate);

  return (
    <div className={`rounded-lg border transition-colors ${!config.visible ? 'opacity-50 border-dashed border-[#dde3ec] bg-white' : editing ? 'border-[#0A2540]/20 bg-[#f5f7fa]' : 'border-[#dde3ec] bg-white'}`}>
      <div className="flex items-center gap-3 px-3 py-2.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-medium ${config.visible ? 'text-[#0A2540]' : 'text-[#6b7e9a] line-through'}`}>{config.label}</span>
            {config.required && <span className="text-[10px] font-semibold text-red-500 bg-red-50 border border-red-100 rounded px-1 py-0.5">Obrigatório</span>}
          </div>
          <span className="text-xs text-[#6b7e9a]">Campo predefinido</span>
        </div>
        {!editing && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button variant="ghost" size="sm" className="h-8 px-2.5 text-[#6b7e9a] hover:text-[#0A2540] hover:bg-[#0A2540]/5"
              onClick={() => { setLabel(config.label); setRequired(config.required); setEditing(true); }}>
              <Pencil className="w-3.5 h-3.5 mr-1" /><span className="text-xs">Editar</span>
            </Button>
            <Button variant="ghost" size="sm"
              className={`h-8 px-2.5 ${config.visible ? 'text-[#6b7e9a] hover:text-red-600 hover:bg-red-50' : 'text-[#6b7e9a] hover:text-[#0A2540] hover:bg-[#0A2540]/5'}`}
              onClick={toggleVisibility}>
              {config.visible
                ? <><EyeOff className="w-3.5 h-3.5 mr-1" /><span className="text-xs">Ocultar</span></>
                : <><Eye className="w-3.5 h-3.5 mr-1" /><span className="text-xs">Mostrar</span></>
              }
            </Button>
          </div>
        )}
        {editing && (
          <Button variant="ghost" size="sm" className="h-8 px-2 text-[#6b7e9a]" onClick={() => setEditing(false)}>
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {editing && (
        <div className="px-3 pb-3 border-t border-[#dde3ec] pt-3 space-y-3">
          <div>
            <Label className="text-xs text-[#6b7e9a]">Nome do campo</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} className="mt-1 h-9 text-sm" />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none text-[#0A2540]">
            <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} className="rounded" />
            Campo obrigatório
          </label>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => updateMutation.mutate({ label, required })} disabled={!label.trim() || updateMutation.isPending}>
              <Check className="w-3.5 h-3.5 mr-1.5" />{updateMutation.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Custom field row ────────────────────────────────────────────────────────────
function CustomFieldRow({ field }: { field: ContactFieldDef }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [label, setLabel] = useState(field.label);
  const [required, setRequired] = useState(field.required);
  const [options, setOptions] = useState<string[]>(field.options ?? []);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['contactFieldDefs'] });

  const updateMutation = useMutation({
    mutationFn: () => updateContactFieldDef(field.id, {
      label, required,
      options: field.type === 'select' ? options : undefined,
    }),
    onSuccess: () => { invalidate(); setEditing(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteContactFieldDef(field.id),
    onSuccess: () => { invalidate(); setConfirmDelete(false); },
  });

  return (
    <div className={`rounded-lg border transition-colors ${editing ? 'border-[#0A2540]/20 bg-[#f5f7fa]' : 'border-[#dde3ec] bg-white'}`}>
      <div className="flex items-center gap-3 px-3 py-2.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-[#0A2540]">{field.label}</span>
            {field.required && <span className="text-[10px] font-semibold text-red-500 bg-red-50 border border-red-100 rounded px-1 py-0.5">Obrigatório</span>}
          </div>
          <span className="text-xs text-[#6b7e9a]">{TYPE_LABELS[field.type]}{field.type === 'select' && field.options?.length ? ` · ${field.options.join(', ')}` : ''}</span>
        </div>
        {!editing && !confirmDelete && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button variant="ghost" size="sm" className="h-8 px-2.5 text-[#6b7e9a] hover:text-[#0A2540] hover:bg-[#0A2540]/5"
              onClick={() => { setLabel(field.label); setRequired(field.required); setOptions(field.options ?? []); setEditing(true); }}>
              <Pencil className="w-3.5 h-3.5 mr-1" /><span className="text-xs">Editar</span>
            </Button>
            <Button variant="ghost" size="sm" className="h-8 px-2.5 text-[#6b7e9a] hover:text-red-600 hover:bg-red-50"
              onClick={() => setConfirmDelete(true)}>
              <Trash2 className="w-3.5 h-3.5 mr-1" /><span className="text-xs">Remover</span>
            </Button>
          </div>
        )}
        {editing && (
          <Button variant="ghost" size="sm" className="h-8 px-2 text-[#6b7e9a]" onClick={() => setEditing(false)}>
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {confirmDelete && (
        <div className="px-3 pb-3 border-t border-[#dde3ec] pt-2.5 flex items-center gap-3">
          <span className="text-sm text-[#0A2540] flex-1">Remover <strong>{field.label}</strong>?</span>
          <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
            {deleteMutation.isPending ? '...' : 'Remover'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Cancelar</Button>
        </div>
      )}

      {editing && (
        <div className="px-3 pb-3 border-t border-[#dde3ec] pt-3 space-y-3">
          <div>
            <Label className="text-xs text-[#6b7e9a]">Nome do campo</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} className="mt-1 h-9 text-sm" />
          </div>
          {field.type === 'select' && <OptionsEditor options={options} onChange={setOptions} />}
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none text-[#0A2540]">
            <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} className="rounded" />
            Campo obrigatório
          </label>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => updateMutation.mutate()} disabled={!label.trim() || updateMutation.isPending}>
              <Check className="w-3.5 h-3.5 mr-1.5" />{updateMutation.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Add custom field form ───────────────────────────────────────────────────────
function AddFieldForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const [label, setLabel] = useState('');
  const [type, setType] = useState<ContactFieldType>('text');
  const [required, setRequired] = useState(false);
  const [options, setOptions] = useState<string[]>([]);

  const mutation = useMutation({
    mutationFn: () => createContactFieldDef({ label, type, options: type === 'select' ? options : undefined, required }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['contactFieldDefs'] }); onDone(); },
  });

  return (
    <div className="space-y-4 rounded-lg border border-[#0A2540]/20 bg-[#f5f7fa] p-4">
      <p className="text-sm font-semibold text-[#0A2540]">Novo campo personalizado</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label className="text-xs text-[#6b7e9a]">Nome do campo *</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex: LinkedIn, NIF, Origem..." className="mt-1" autoFocus />
        </div>
        <div>
          <Label className="text-xs text-[#6b7e9a]">Tipo</Label>
          <Select value={type} onValueChange={(v) => setType(v as ContactFieldType)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(TYPE_LABELS) as ContactFieldType[]).map(t => (
                <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end pb-0.5">
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none text-[#0A2540]">
            <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} className="rounded" />
            Obrigatório
          </label>
        </div>
      </div>
      {type === 'select' && <OptionsEditor options={options} onChange={setOptions} />}
      <div className="flex gap-2">
        <Button onClick={() => mutation.mutate()} disabled={!label.trim() || mutation.isPending} size="sm">
          {mutation.isPending ? 'Criando...' : 'Criar campo'}
        </Button>
        <Button variant="ghost" size="sm" onClick={onDone}>Cancelar</Button>
      </div>
    </div>
  );
}

// ── Main modal ──────────────────────────────────────────────────────────────────
export default function ContactFieldsManager({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [adding, setAdding] = useState(false);

  const { data: systemConfigs = [], isLoading: loadingSystem } = useQuery({
    queryKey: ['contactFieldConfigs'],
    queryFn: getContactFieldConfigs,
    enabled: open,
  });

  const { data: customFields = [], isLoading: loadingCustom } = useQuery({
    queryKey: ['contactFieldDefs'],
    queryFn: getContactFieldDefs,
    enabled: open,
  });

  const isLoading = loadingSystem || loadingCustom;

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setAdding(false); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Personalizar campos de contacto</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-[#6b7e9a] -mt-2">
          Edita o nome, visibilidade e obrigatoriedade de qualquer campo.
        </p>

        {isLoading ? (
          <p className="text-sm text-[#6b7e9a] text-center py-6">A carregar...</p>
        ) : (
          <div className="space-y-5">

            {/* System / built-in fields */}
            <div>
              <p className="text-xs font-semibold text-[#6b7e9a] uppercase tracking-wide mb-2">Campos existentes</p>
              <div className="space-y-2">
                {systemConfigs.map(cfg => <SystemFieldRow key={cfg.fieldKey} config={cfg} />)}
              </div>
            </div>

            {/* Custom fields */}
            {customFields.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-[#6b7e9a] uppercase tracking-wide mb-2">Campos personalizados</p>
                <div className="space-y-2">
                  {customFields.map(f => <CustomFieldRow key={f.id} field={f} />)}
                </div>
              </div>
            )}

          </div>
        )}

        {adding ? (
          <AddFieldForm onDone={() => setAdding(false)} />
        ) : (
          <Button variant="outline" className="w-full mt-3" onClick={() => setAdding(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Adicionar campo personalizado
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
