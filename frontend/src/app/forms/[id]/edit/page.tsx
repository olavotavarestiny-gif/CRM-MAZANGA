'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getForm,
  updateForm,
  addField,
  updateField,
  deleteField,
  reorderFields,
  getFormSubmissions,
  getCurrentUser,
} from '@/lib/api';
import { FormField, CRMForm } from '@/lib/types';
import type { User } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { X, Plus, GripVertical, Trash2, Check, Upload, Palette, Image as ImageIcon } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const CONTACT_FIELD_OPTIONS = [
  { value: 'name', label: 'Nome' },
  { value: 'phone', label: 'Telefone' },
  { value: 'email', label: 'Email' },
  { value: 'company', label: 'Empresa' },
  { value: 'sector', label: 'Setor' },
  { value: 'revenue', label: 'Faturamento' },
];

const PRESET_BRAND_COLORS = [
  '#635BFF', '#0A2540', '#10B981', '#F59E0B',
  '#EF4444', '#3B82F6', '#8B5CF6', '#EC4899',
  '#F97316', '#06B6D4',
];

const PRESET_BG_COLORS = [
  '#FFFFFF', '#F8FAFC', '#F0F4FF', '#FFF7ED',
  '#F0FDF4', '#FFF1F2', '#0A2540', '#1E293B',
  '#111827', '#000000',
];

function ColorSwatch({ colors, value, onChange, label }: {
  colors: string[];
  value: string;
  onChange: (c: string) => void;
  label: string;
}) {
  return (
    <div>
      <Label className="text-[#0A2540] block mb-2">{label}</Label>
      <div className="flex flex-wrap gap-2 mb-2">
        {colors.map((c) => (
          <button
            key={c}
            type="button"
            title={c}
            className="w-7 h-7 rounded-full border-2 transition-all"
            style={{
              background: c,
              borderColor: value?.toLowerCase() === c.toLowerCase() ? '#0A2540' : '#E2E8F0',
              transform: value?.toLowerCase() === c.toLowerCase() ? 'scale(1.2)' : 'scale(1)',
              boxShadow: c === '#FFFFFF' ? '0 0 0 1px #E2E8F0' : 'none',
            }}
            onClick={() => onChange(c)}
          />
        ))}
      </div>
      <div className="flex gap-2 items-center">
        <input
          type="color"
          value={value || '#635BFF'}
          onChange={(e) => onChange(e.target.value)}
          className="w-9 h-9 rounded cursor-pointer border border-[#E2E8F0] p-0.5"
        />
        <Input
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          className="w-28 font-mono text-sm"
          maxLength={7}
        />
      </div>
    </div>
  );
}

function BrandingPreview({ brandColor, bgColor, logoUrl, title }: {
  brandColor: string;
  bgColor: string;
  logoUrl?: string;
  title: string;
}) {
  const isDark = (() => {
    const hex = bgColor.replace('#', '');
    if (hex.length < 6) return false;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 < 128;
  })();
  const textColor = isDark ? '#FFFFFF' : '#0A2540';
  const subColor = isDark ? 'rgba(255,255,255,0.6)' : '#6b7e9a';

  return (
    <div className="rounded-xl overflow-hidden border border-[#E2E8F0] shadow-sm">
      <div className="text-xs text-[#6b7e9a] bg-[#F8FAFC] px-3 py-1.5 border-b border-[#E2E8F0] flex items-center gap-1.5">
        <Palette className="w-3 h-3" /> Pré-visualização
      </div>
      <div className="p-5" style={{ background: bgColor }}>
        {logoUrl && (
          <img src={logoUrl} alt="Logo" className="h-10 object-contain mb-4" />
        )}
        <p className="font-bold text-sm mb-1" style={{ color: textColor }}>{title || 'Título do formulário'}</p>
        <p className="text-xs mb-4" style={{ color: subColor }}>Descrição do formulário...</p>
        <div className="space-y-3">
          <div>
            <div className="text-xs mb-1 font-medium" style={{ color: textColor }}>Campo de exemplo</div>
            <div className="rounded-lg border px-3 py-2 text-xs" style={{
              borderColor: isDark ? 'rgba(255,255,255,0.2)' : '#E2E8F0',
              background: isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF',
              color: subColor,
            }}>Escrever resposta...</div>
          </div>
          <div className="w-full rounded-lg py-2 text-center text-xs font-semibold text-white" style={{ background: brandColor }}>
            Enviar →
          </div>
          <div className="w-full rounded-full h-1.5 overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.15)' : '#E2E8F0' }}>
            <div className="h-full rounded-full w-2/3" style={{ background: brandColor }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FormEditPage({ params }: { params: { id: string } }) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'builder' | 'branding' | 'submissions'>('builder');
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [formSettings, setFormSettings] = useState<{
    title: string; description: string; mode: 'step' | 'single'; thankYouUrl: string;
  }>({ title: '', description: '', mode: 'step', thankYouUrl: '' });
  const [branding, setBranding] = useState<{ brandColor: string; bgColor: string; logoUrl: string }>({
    brandColor: '#635BFF', bgColor: '#FFFFFF', logoUrl: '',
  });
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [brandingSaved, setBrandingSaved] = useState(false);
  const [newOptionValue, setNewOptionValue] = useState('');
  const logoInputRef = useRef<HTMLInputElement>(null);

  const { data: form } = useQuery({
    queryKey: ['form', params.id],
    queryFn: () => getForm(params.id),
  });

  const { data: submissions = [] } = useQuery({
    queryKey: ['formSubmissions', params.id],
    queryFn: () => getFormSubmissions(params.id),
    enabled: activeTab === 'submissions',
  });

  useEffect(() => {
    if (form) {
      setFormSettings({
        title: form.title,
        description: form.description || '',
        mode: form.mode as 'step' | 'single',
        thankYouUrl: form.thankYouUrl || '',
      });
      setBranding({
        brandColor: form.brandColor || '#635BFF',
        bgColor: form.bgColor || '#FFFFFF',
        logoUrl: form.logoUrl || '',
      });
      if (form.fields && form.fields.length > 0 && !selectedFieldId) {
        setSelectedFieldId(form.fields[0].id);
      }
    }
  }, [form, selectedFieldId]);

  useEffect(() => {
    getCurrentUser().then(setCurrentUser).catch(() => {});
  }, []);

  const updateFormMutation = useMutation({
    mutationFn: (data: Partial<CRMForm>) => updateForm(params.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form', params.id] });
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2000);
    },
  });

  const updateBrandingMutation = useMutation({
    mutationFn: (data: Partial<CRMForm>) => updateForm(params.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form', params.id] });
      setBrandingSaved(true);
      setTimeout(() => setBrandingSaved(false), 2000);
    },
  });

  const addFieldMutation = useMutation({
    mutationFn: (data: any) => addField(params.id, data),
    onSuccess: (newField) => {
      queryClient.invalidateQueries({ queryKey: ['form', params.id] });
      setSelectedFieldId(newField.id);
    },
  });

  const updateFieldMutation = useMutation({
    mutationFn: (data: any) => updateField(params.id, data.fieldId, data.updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['form', params.id] }),
  });

  const deleteFieldMutation = useMutation({
    mutationFn: (fieldId: string) => deleteField(params.id, fieldId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form', params.id] });
      setSelectedFieldId(null);
    },
  });

  const reorderFieldsMutation = useMutation({
    mutationFn: (fields: any[]) => reorderFields(params.id, fields),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['form', params.id] }),
  });

  const handleDragEnd = (result: DropResult) => {
    const { source, destination } = result;
    if (!destination || !form) return;
    const fields = Array.from(form.fields);
    const [movedField] = fields.splice(source.index, 1);
    fields.splice(destination.index, 0, movedField);
    reorderFieldsMutation.mutate(fields.map((f, idx) => ({ id: f.id, order: idx })));
  };

  const addNewField = () => {
    const order = (form?.fields?.length || 0) + 1;
    addFieldMutation.mutate({ type: 'text', label: 'Novo Campo', required: false, order });
  };

  const selectedField = form?.fields?.find((f) => f.id === selectedFieldId);

  const handleSaveSettings = () => {
    updateFormMutation.mutate({
      title: formSettings.title,
      description: formSettings.description || undefined,
      mode: formSettings.mode,
      thankYouUrl: formSettings.thankYouUrl || undefined,
    });
  };

  const handleSaveBranding = () => {
    updateBrandingMutation.mutate({
      brandColor: branding.brandColor,
      bgColor: branding.bgColor,
      logoUrl: branding.logoUrl || undefined,
    });
  };

  const handleFieldChange = (updates: Partial<FormField>) => {
    if (!selectedField) return;
    updateFieldMutation.mutate({ fieldId: selectedField.id, updates });
  };

  const handleAddOption = () => {
    if (!selectedField || !newOptionValue.trim()) return;
    const options = selectedField.options || [];
    handleFieldChange({ options: [...options, newOptionValue] });
    setNewOptionValue('');
  };

  const handleRemoveOption = (index: number) => {
    if (!selectedField) return;
    const options = (selectedField.options || []).filter((_, i) => i !== index);
    handleFieldChange({ options });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Resize & convert to base64
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_H = 120;
        const scale = img.height > MAX_H ? MAX_H / img.height : 1;
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png', 0.9);
        setBranding((b) => ({ ...b, logoUrl: dataUrl }));
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
    // reset input so same file can be re-selected
    e.target.value = '';
  };

  const TABS = [
    { key: 'builder', label: 'Construtor' },
    { key: 'branding', label: 'Identidade Visual' },
    { key: 'submissions', label: 'Submissões', badge: form?._count?.submissions },
  ] as const;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Tabs */}
      <div className="flex gap-4 border-b border-[#E2E8F0]">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`pb-3 px-2 font-medium transition-colors flex items-center gap-2 ${
              activeTab === tab.key
                ? 'text-[#0A2540] border-b-2 border-[#0A2540]'
                : 'text-[#6b7e9a] hover:text-[#0A2540]'
            }`}
          >
            {tab.label}
            {'badge' in tab && tab.badge ? (
              <Badge className="bg-green-500/20 text-green-600">{tab.badge}</Badge>
            ) : null}
          </button>
        ))}
      </div>

      {/* ── BUILDER TAB ── */}
      {activeTab === 'builder' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Configurações do Formulário</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-[#0A2540]">Título</Label>
                <Input value={formSettings.title} onChange={(e) => setFormSettings({ ...formSettings, title: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label className="text-[#0A2540]">Descrição</Label>
                <Textarea value={formSettings.description} onChange={(e) => setFormSettings({ ...formSettings, description: e.target.value })} rows={3} className="mt-1" />
              </div>
              <div>
                <Label className="text-[#0A2540]">Modo de Preenchimento</Label>
                <Select value={formSettings.mode} onValueChange={(v) => setFormSettings({ ...formSettings, mode: v as 'step' | 'single' })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="step">Passo a Passo</SelectItem>
                    <SelectItem value="single">Corrido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[#0A2540]">URL de Agradecimento <span className="text-[#6b7e9a] font-normal">(opcional)</span></Label>
                <Input placeholder="https://..." value={formSettings.thankYouUrl} onChange={(e) => setFormSettings({ ...formSettings, thankYouUrl: e.target.value })} className="mt-1" />
              </div>
              <div className="flex items-center gap-3 pt-1">
                <Button onClick={handleSaveSettings} disabled={updateFormMutation.isPending}>
                  Guardar Configurações
                </Button>
                {settingsSaved && (
                  <span className="flex items-center gap-1.5 text-green-600 text-sm">
                    <Check className="w-4 h-4" /> Guardado!
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Fields list */}
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle className="text-base">Campos ({form?.fields?.length || 0})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="fields">
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`space-y-2 min-h-48 ${snapshot.isDraggingOver ? 'bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-2' : ''}`}
                      >
                        {form?.fields?.map((field, index) => (
                          <Draggable key={field.id} draggableId={field.id} index={index}>
                            {(provided) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                                  selectedFieldId === field.id
                                    ? 'border-[#0A2540] bg-[#F8FAFC]'
                                    : 'border-[#E2E8F0] bg-white hover:bg-[#F8FAFC]'
                                }`}
                                onClick={() => setSelectedFieldId(field.id)}
                              >
                                <div className="flex items-center gap-2">
                                  <div {...provided.dragHandleProps} className="text-[#6b7e9a]">
                                    <GripVertical className="w-4 h-4" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm text-[#0A2540] truncate font-medium">{field.label}</p>
                                    <p className="text-xs text-[#6b7e9a]">{field.type === 'text' ? 'Texto' : 'Múltipla Escolha'}</p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
                <Button onClick={addNewField} className="w-full" variant="outline">
                  <Plus className="w-4 h-4 mr-2" /> Adicionar Campo
                </Button>
              </CardContent>
            </Card>

            {/* Field editor */}
            <Card className="col-span-2">
              <CardHeader>
                <CardTitle className="text-base">
                  {selectedField ? `Editar: ${selectedField.label}` : 'Selecione um campo'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedField ? (
                  <>
                    <div>
                      <Label className="text-[#0A2540]">Rótulo</Label>
                      <Input className="mt-1" value={selectedField.label} onChange={(e) => handleFieldChange({ label: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-[#0A2540]">Tipo</Label>
                      <Select value={selectedField.type} onValueChange={(v) => handleFieldChange({ type: v as any })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Texto</SelectItem>
                          <SelectItem value="multiple_choice">Múltipla Escolha</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={selectedField.required} onCheckedChange={(v) => handleFieldChange({ required: v })} />
                      <Label className="text-[#0A2540] cursor-pointer">Obrigatório</Label>
                    </div>
                    <div>
                      <Label className="text-[#0A2540]">Mapear para Contacto</Label>
                      <div className="flex gap-2 mt-1">
                        <Select value={selectedField.contactField || 'none'} onValueChange={(v) => { if (v !== 'none') handleFieldChange({ contactField: v }); }}>
                          <SelectTrigger className="flex-1"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">— Nenhum —</SelectItem>
                            {CONTACT_FIELD_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {selectedField.contactField && (
                          <Button variant="ghost" size="sm" onClick={() => handleFieldChange({ contactField: undefined })}>Limpar</Button>
                        )}
                      </div>
                    </div>
                    {selectedField.type === 'multiple_choice' && (
                      <div className="space-y-3 border-t border-[#E2E8F0] pt-4">
                        <Label className="text-[#0A2540]">Opções</Label>
                        <div className="space-y-2">
                          {selectedField.options?.map((opt, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <Input value={opt} readOnly className="text-sm" />
                              <Button variant="ghost" size="sm" onClick={() => handleRemoveOption(idx)}><X className="w-4 h-4" /></Button>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <Input placeholder="Nova opção..." value={newOptionValue} onChange={(e) => setNewOptionValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleAddOption(); }} />
                          <Button onClick={handleAddOption} size="sm">Adicionar</Button>
                        </div>
                      </div>
                    )}
                    {!currentUser?.accountOwnerId && (
                      <div className="border-t border-[#E2E8F0] pt-4">
                        <Button variant="destructive" onClick={() => deleteFieldMutation.mutate(selectedField.id)} className="w-full">
                          <Trash2 className="w-4 h-4 mr-2" /> Eliminar Campo
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-center text-[#6b7e9a] py-8">Clique num campo para editar</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* ── BRANDING TAB ── */}
      {activeTab === 'branding' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Controls */}
          <div className="space-y-6">
            {/* Logo */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" /> Logotipo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {branding.logoUrl ? (
                  <div className="space-y-3">
                    <div className="border border-[#E2E8F0] rounded-lg p-4 bg-[#F8FAFC] flex items-center justify-center min-h-20">
                      <img src={branding.logoUrl} alt="Logo" className="max-h-16 object-contain" />
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => logoInputRef.current?.click()} className="flex-1">
                        <Upload className="w-4 h-4 mr-2" /> Substituir
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setBranding((b) => ({ ...b, logoUrl: '' }))} className="text-red-500 hover:text-red-600">
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-[#E2E8F0] rounded-xl p-8 flex flex-col items-center gap-2 hover:border-[#0A2540] hover:bg-[#F8FAFC] transition-colors"
                  >
                    <Upload className="w-6 h-6 text-[#6b7e9a]" />
                    <p className="text-sm font-medium text-[#0A2540]">Carregar logotipo</p>
                    <p className="text-xs text-[#6b7e9a]">PNG, JPG, SVG · Máx. 5MB</p>
                  </button>
                )}
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
              </CardContent>
            </Card>

            {/* Colors */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Palette className="w-4 h-4" /> Cores
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <ColorSwatch
                  colors={PRESET_BRAND_COLORS}
                  value={branding.brandColor}
                  onChange={(c) => setBranding((b) => ({ ...b, brandColor: c }))}
                  label="Cor principal (botões, barra de progresso)"
                />
                <ColorSwatch
                  colors={PRESET_BG_COLORS}
                  value={branding.bgColor}
                  onChange={(c) => setBranding((b) => ({ ...b, bgColor: c }))}
                  label="Cor de fundo"
                />
              </CardContent>
            </Card>

            <div className="flex items-center gap-3">
              <Button onClick={handleSaveBranding} disabled={updateBrandingMutation.isPending}>
                Guardar Identidade Visual
              </Button>
              {brandingSaved && (
                <span className="flex items-center gap-1.5 text-green-600 text-sm">
                  <Check className="w-4 h-4" /> Guardado!
                </span>
              )}
            </div>
          </div>

          {/* Live preview */}
          <div className="space-y-3">
            <BrandingPreview
              brandColor={branding.brandColor}
              bgColor={branding.bgColor}
              logoUrl={branding.logoUrl}
              title={formSettings.title}
            />
            <p className="text-xs text-[#6b7e9a] text-center">As alterações são aplicadas em tempo real na pré-visualização</p>
          </div>
        </div>
      )}

      {/* ── SUBMISSIONS TAB ── */}
      {activeTab === 'submissions' && (
        <Card>
          <CardHeader>
            <CardTitle>Submissões ({submissions.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {submissions.length === 0 ? (
              <p className="text-center text-[#6b7e9a] py-8">Nenhuma submissão ainda</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                      <th className="px-4 py-2 text-left text-[#0A2540] font-semibold">Data</th>
                      {form?.fields?.map((field) => (
                        <th key={field.id} className="px-4 py-2 text-left text-[#0A2540] font-semibold">{field.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.map((submission: any) => (
                      <tr key={submission.id} className="border-b border-[#E2E8F0] hover:bg-[#F8FAFC]">
                        <td className="px-4 py-3 text-[#6b7e9a]">
                          {formatDistanceToNow(new Date(submission.submittedAt), { locale: ptBR, addSuffix: true })}
                        </td>
                        {form?.fields?.map((field) => {
                          const answer = submission.answers?.find((a: any) => a.fieldId === field.id);
                          return (
                            <td key={field.id} className="px-4 py-3 text-[#0A2540]">{answer?.value || '—'}</td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
