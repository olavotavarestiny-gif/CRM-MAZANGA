'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast-provider';
import ManagementFormDialog, { type FormField } from './management-form-dialog';
import { ManagementEmpty, ManagementLoading, ManagementPage, tdClass, thClass, tableClass } from './management-ui';

export interface ResourceColumn<T> { label: string; render: (row: T) => React.ReactNode; searchValue?: (row: T) => string }

export default function ManagementResourcePage<T extends { id: string }>({ title, description, queryKey, load, create, update, remove, archive, fields, columns, toInitialValues, createLabel = 'Novo registo', summary }: { title: string; description?: string; queryKey: string; load: () => Promise<T[]>; create: (data: Record<string, unknown>) => Promise<T>; update?: (id: string, data: Record<string, unknown>) => Promise<T>; remove?: (id: string) => Promise<void>; archive?: (id: string) => Promise<T>; fields: FormField[]; columns: ResourceColumn<T>[]; toInitialValues?: (row: T) => Record<string, unknown>; createLabel?: string; summary?: React.ReactNode }) {
  const qc = useQueryClient(); const { toast } = useToast(); const [search, setSearch] = useState(''); const [dialogOpen, setDialogOpen] = useState(false); const [editing, setEditing] = useState<T | null>(null);
  const query = useQuery({ queryKey: [queryKey], queryFn: load });
  const save = useMutation({ mutationFn: (values: Record<string, unknown>) => editing && update ? update(editing.id, values) : create(values), onSuccess: () => { qc.invalidateQueries({ queryKey: [queryKey] }); setDialogOpen(false); setEditing(null); toast({ title: 'Registo guardado', variant: 'success' }); }, onError: (error: Error) => toast({ title: 'Não foi possível guardar', description: error.message, variant: 'error' }) });
  const filtered = useMemo(() => (query.data || []).filter((row) => !search || columns.some((column) => (column.searchValue?.(row) || '').toLowerCase().includes(search.toLowerCase()))), [columns, query.data, search]);
  const handleRemove = async (row: T, mode: 'remove' | 'archive') => { if (!window.confirm(mode === 'remove' ? 'Eliminar definitivamente este registo?' : 'Arquivar este registo?')) return; try { if (mode === 'remove') await remove?.(row.id); else await archive?.(row.id); await qc.invalidateQueries({ queryKey: [queryKey] }); toast({ title: mode === 'remove' ? 'Registo eliminado' : 'Registo arquivado', variant: 'success' }); } catch (error) { toast({ title: 'Operação não concluída', description: error instanceof Error ? error.message : 'Tente novamente.', variant: 'error' }); } };
  return <ManagementPage title={title} description={description} action={<Button onClick={() => { setEditing(null); setDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" />{createLabel}</Button>}>
    {summary}
    <div className="relative max-w-md"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar…" className="pl-9 dark:bg-slate-900" /></div>
    {query.isLoading ? <ManagementLoading /> : filtered.length === 0 ? <ManagementEmpty /> : <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"><table className={tableClass}><thead><tr>{columns.map((column) => <th key={column.label} className={thClass}>{column.label}</th>)}{(update || remove || archive) && <th className={thClass}>Ações</th>}</tr></thead><tbody>{filtered.map((row) => <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">{columns.map((column) => <td key={column.label} className={tdClass}>{column.render(row)}</td>)}{(update || remove || archive) && <td className={tdClass}><div className="flex gap-1">{update && <Button size="icon" variant="ghost" onClick={() => { setEditing(row); setDialogOpen(true); }} aria-label="Editar"><Pencil className="h-4 w-4" /></Button>}{archive && <Button size="icon" variant="ghost" onClick={() => handleRemove(row, 'archive')} aria-label="Arquivar"><Archive className="h-4 w-4" /></Button>}{remove && <Button size="icon" variant="ghost" onClick={() => handleRemove(row, 'remove')} aria-label="Eliminar"><Trash2 className="h-4 w-4 text-red-600" /></Button>}</div></td>}</tr>)}</tbody></table></div>}
    <ManagementFormDialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditing(null); }} title={editing ? `Editar — ${title}` : createLabel} fields={fields} initialValues={editing && toInitialValues ? toInitialValues(editing) : {}} isEditing={Boolean(editing)} submitting={save.isPending} onSubmit={(values) => save.mutateAsync(values)} />
  </ManagementPage>;
}
