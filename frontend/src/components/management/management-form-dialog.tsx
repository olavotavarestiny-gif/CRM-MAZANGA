'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export interface FormField {
  name: string;
  label: string;
  type?: 'text' | 'email' | 'number' | 'date' | 'datetime-local' | 'textarea' | 'select' | 'checkbox';
  required?: boolean;
  primary?: boolean;
  options?: Array<{ value: string; label: string }>;
  step?: string;
}

export default function ManagementFormDialog({ open, onOpenChange, title, fields, initialValues = {}, submitting, onSubmit, isEditing = false }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; fields: FormField[]; initialValues?: Record<string, unknown>; submitting?: boolean; onSubmit: (values: Record<string, unknown>) => Promise<unknown> | unknown; isEditing?: boolean }) {
  const [showDetails, setShowDetails] = useState(isEditing);
  const schema = useMemo(() => z.object(Object.fromEntries(fields.map((field) => {
    let validator: z.ZodTypeAny = field.type === 'number'
      ? z.preprocess((value) => value === '' || Number.isNaN(value) ? undefined : value, field.required ? z.coerce.number() : z.coerce.number().optional())
      : field.type === 'checkbox' ? z.boolean() : z.string();
    if (!field.required && field.type !== 'checkbox' && field.type !== 'number') validator = validator.optional().or(z.literal(''));
    if (field.required && field.type !== 'number' && field.type !== 'checkbox') validator = (validator as z.ZodString).min(1, 'Campo obrigatório.');
    return [field.name, validator];
  }))), [fields]);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<Record<string, unknown>>({ resolver: zodResolver(schema), defaultValues: initialValues });
  useEffect(() => { if (open) { reset(initialValues); setShowDetails(isEditing); } }, [initialValues, isEditing, open, reset]);
  const primaryFields = fields.filter((field) => field.required || field.primary);
  const detailFields = fields.filter((field) => !field.required && !field.primary);
  const renderField = (field: FormField) => <div key={field.name} className={field.type === 'textarea' ? 'sm:col-span-2' : ''}><Label htmlFor={field.name}>{field.label}{field.required ? ' *' : ''}</Label>
    {field.type === 'textarea' ? <Textarea id={field.name} {...register(field.name)} className="mt-1 dark:bg-slate-950" /> : field.type === 'select' ? <select id={field.name} {...register(field.name)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">{!field.required && <option value="">Não definido</option>}{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : field.type === 'checkbox' ? <Input id={field.name} type="checkbox" {...register(field.name)} className="mt-2 h-5 w-5" /> : <Input id={field.name} type={field.type || 'text'} step={field.step} {...register(field.name)} className="mt-1 dark:bg-slate-950" />}
    {errors[field.name] && <p className="mt-1 text-xs text-red-600">{String(errors[field.name]?.message || 'Valor inválido.')}</p>}
  </div>;

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto dark:border-slate-800 dark:bg-slate-900 dark:text-white"><DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader><form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
    <p className="sm:col-span-2 text-sm text-slate-500">Comece pelo essencial. Pode completar o registo com mais detalhe quando precisar.</p>
    {primaryFields.map(renderField)}
    {detailFields.length > 0 && !showDetails && <div className="sm:col-span-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950"><Button type="button" variant="ghost" onClick={() => setShowDetails(true)}>Adicionar detalhes opcionais ({detailFields.length})</Button></div>}
    {detailFields.length > 0 && showDetails && <><div className="sm:col-span-2 flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-800"><p className="text-sm font-semibold">Detalhes opcionais</p><Button type="button" variant="ghost" size="sm" onClick={() => setShowDetails(false)}>Ocultar detalhes</Button></div>{detailFields.map(renderField)}</>}
    <DialogFooter className="sm:col-span-2"><Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={submitting}>{submitting ? 'A guardar…' : 'Guardar'}</Button></DialogFooter>
  </form></DialogContent></Dialog>;
}
