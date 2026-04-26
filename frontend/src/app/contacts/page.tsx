'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getContacts,
  bulkUpdateContacts,
  updateContact,
  deleteContact,
  getCurrentUser,
  getPipelineStages,
  getContactFieldConfigs,
  getContactGroups,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterBar } from '@/components/ui/filter-bar';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import ContactForm from '@/components/contacts/contact-form';
import ContactBulkActionsModal from '@/components/contacts/contact-bulk-actions-modal';
import ImportCSVModal from '@/components/contacts/import-csv-modal';
import ContactFieldsManager from '@/components/contacts/contact-fields-manager';
import ContactGroupsManager from '@/components/contacts/contact-groups-manager';
import Link from 'next/link';
import { Trash2, MessageCircle, Upload, Settings2, Phone, FolderTree, ListChecks, X } from 'lucide-react';
import { getContactFieldDefs } from '@/lib/api';
import { useToast } from '@/components/ui/toast-provider';
import type { Contact } from '@/lib/types';

function formatWA(phone: string): string | null {
  if (!phone) return null;
  let n = phone.replace(/[\s\-\(\)\+]/g, '');
  if (n.length <= 9 && !n.startsWith('244')) n = '244' + n;
  return n.length >= 9 ? n : null;
}

const ALL_GROUPS_VALUE = 'ALL';
const UNGROUPED_GROUP_VALUE = 'UNGROUPED';

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return normalizeStringArray(parsed);
    } catch {
      return value.trim() ? [value] : [];
    }
  }

  return [];
}

function normalizeCustomFields(value: unknown): Record<string, unknown> {
  if (isRecord(value)) return value;

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return isRecord(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  return {};
}

function formatCustomFieldValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  if (Array.isArray(value)) return value.join(', ') || '-';
  if (typeof value === 'object') return '-';
  return String(value);
}

export default function ContactsPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('ALL');
  const [revenueFilter, setRevenueFilter] = useState<string>('ALL');
  const [groupFilter, setGroupFilter] = useState<string>(ALL_GROUPS_VALUE);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isFieldsOpen, setIsFieldsOpen] = useState(false);
  const [isGroupsOpen, setIsGroupsOpen] = useState(false);
  const [isBulkActionsOpen, setIsBulkActionsOpen] = useState(false);
  const [selectedContactIds, setSelectedContactIds] = useState<number[]>([]);
  const [contactTypeTab, setContactTypeTab] = useState<'interessado' | 'cliente'>('interessado');
  const { toast } = useToast();

  const {
    data: currentUser,
    isLoading: currentUserLoading,
    isError: currentUserError,
    refetch: refetchCurrentUser,
  } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
    staleTime: 30_000,
  });

  const canLoadContactData = !!currentUser;
  const workspaceResolved = !currentUserLoading && canLoadContactData;
  const isComercioWorkspace = workspaceResolved && currentUser?.workspaceMode === 'comercio';
  const effectiveContactType = isComercioWorkspace ? 'cliente' : contactTypeTab;
  const canShowPipelineUi = workspaceResolved && !isComercioWorkspace;

  const { data: fieldDefsData } = useQuery({
    queryKey: ['contactFieldDefs'],
    queryFn: getContactFieldDefs,
    enabled: canLoadContactData,
  });
  const fieldDefs = Array.isArray(fieldDefsData)
    ? fieldDefsData.filter((field) => field && typeof field.id === 'string' && typeof field.key === 'string')
    : [];

  const { data: systemConfigsData } = useQuery({
    queryKey: ['contactFieldConfigs'],
    queryFn: getContactFieldConfigs,
    staleTime: 5 * 60_000,
    enabled: canLoadContactData,
  });
  const systemConfigs = Array.isArray(systemConfigsData)
    ? systemConfigsData.filter((config) => config && typeof config.fieldKey === 'string')
    : [];

  const { data: contactGroupsData } = useQuery({
    queryKey: ['contactGroups'],
    queryFn: getContactGroups,
    enabled: canLoadContactData,
  });
  const contactGroups = Array.isArray(contactGroupsData)
    ? contactGroupsData.filter((group) => group && typeof group.id === 'string' && group.id.trim().length > 0)
    : [];

  // System columns to show (excluding fields already rendered in dedicated columns/UI)
  const visibleSystemCols = systemConfigs
    .filter(c => c.visible && !['name', 'phone'].includes(c.fieldKey))
    .sort((a, b) => a.order - b.order);

  const { data: pipelineStagesData } = useQuery({
    queryKey: ['pipeline-stages'],
    queryFn: getPipelineStages,
    enabled: canLoadContactData && canShowPipelineUi,
  });
  const pipelineStages = Array.isArray(pipelineStagesData)
    ? pipelineStagesData.filter((stage) => stage && typeof stage.id === 'string' && typeof stage.name === 'string' && stage.name.trim().length > 0)
    : [];

  const queryClient = useQueryClient();

  useEffect(() => {
    if (isComercioWorkspace) {
      setContactTypeTab('cliente');
    }
  }, [isComercioWorkspace]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    if (
      groupFilter !== ALL_GROUPS_VALUE &&
      groupFilter !== UNGROUPED_GROUP_VALUE &&
      !contactGroups.some((group) => group.id === groupFilter)
    ) {
      setGroupFilter(ALL_GROUPS_VALUE);
    }
  }, [contactGroups, groupFilter]);

  const contactsQuery = useQuery({
    queryKey: ['contacts', debouncedSearch, canShowPipelineUi ? stageFilter : 'ALL', revenueFilter, groupFilter, effectiveContactType],
    queryFn: () =>
      getContacts({
        search: debouncedSearch || undefined,
        stage: canShowPipelineUi && stageFilter !== 'ALL' ? stageFilter : undefined,
        revenue: revenueFilter === 'ALL' ? undefined : revenueFilter,
        groupId: groupFilter === ALL_GROUPS_VALUE ? undefined : groupFilter,
        contactType: effectiveContactType,
    }),
    placeholderData: (previousData) => previousData,
    retry: false,
    enabled: canLoadContactData,
  });
  const contacts: Contact[] = Array.isArray(contactsQuery.data)
    ? contactsQuery.data.filter((contact): contact is Contact => (
      isRecord(contact) &&
      typeof contact.id === 'number' &&
      typeof contact.name === 'string'
    ))
    : [];
  const visibleContactIds = useMemo(() => contacts.map((contact) => contact.id), [contacts]);
  const selectedVisibleCount = useMemo(
    () => visibleContactIds.filter((id) => selectedContactIds.includes(id)).length,
    [selectedContactIds, visibleContactIds]
  );
  const allVisibleSelected = contacts.length > 0 && selectedVisibleCount === contacts.length;
  const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected;
  const isContactsLoading = currentUserLoading || (canLoadContactData && contactsQuery.isLoading);
  const pageDescription = useMemo(() => {
    if (!workspaceResolved) {
      return 'Contactos, históricos e campos personalizados num espaço único.';
    }
    return isComercioWorkspace
      ? 'Contactos e campos personalizados num fluxo alinhado com o comércio.'
      : 'Interessados, clientes e campos personalizados num fluxo único.';
  }, [isComercioWorkspace, workspaceResolved]);
  const hasActiveFilters =
    debouncedSearch.length > 0 ||
    revenueFilter !== 'ALL' ||
    groupFilter !== ALL_GROUPS_VALUE ||
    (canShowPipelineUi && stageFilter !== 'ALL');
  const isSearching = workspaceResolved && contactsQuery.isFetching && !contactsQuery.isLoading;

  useEffect(() => {
    setSelectedContactIds((currentIds) => currentIds.filter((id) => visibleContactIds.includes(id)));
  }, [visibleContactIds]);

  const deleteMutation = useMutation({
    mutationFn: deleteContact,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: bulkUpdateContacts,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['contact'] });
      setSelectedContactIds([]);
      setIsBulkActionsOpen(false);
      toast({
        variant: 'success',
        title: 'Ações em massa aplicadas',
        description:
          result.matchedCount === result.requestedCount
            ? `${result.updatedCount} contacto(s) atualizados com sucesso.`
            : `${result.updatedCount} contacto(s) atualizados. ${result.requestedCount - result.matchedCount} ficaram fora da seleção atual.`,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'error',
        title: 'Falha ao aplicar ações em massa',
        description: error.message || 'Tenta novamente.',
      });
    },
  });

  const toggleContactSelection = (contactId: number) => {
    setSelectedContactIds((currentIds) => (
      currentIds.includes(contactId)
        ? currentIds.filter((id) => id !== contactId)
        : [...currentIds, contactId]
    ));
  };

  const toggleAllVisibleContacts = () => {
    if (allVisibleSelected) {
      setSelectedContactIds((currentIds) => currentIds.filter((id) => !visibleContactIds.includes(id)));
      return;
    }

    setSelectedContactIds((currentIds) => Array.from(new Set([...currentIds, ...visibleContactIds])));
  };

  if (currentUserError) {
    return (
      <div className="mx-auto max-w-6xl p-4 md:p-6">
        <ErrorState
          title="Não foi possível abrir Contactos"
          message="A sessão ou a configuração da API não respondeu como esperado. Tenta novamente ou volta ao login."
          onRetry={() => refetchCurrentUser()}
          secondaryAction={{ label: 'Ir para Login', href: '/login' }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#2c2f31]">Contactos</h1>
          <p className="mt-1 text-sm text-[#6b7e9a]">{pageDescription}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={() => setIsGroupsOpen(true)}
            className="w-full sm:w-auto"
          >
            <FolderTree className="w-4 h-4 mr-2" />
            Grupos
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsFieldsOpen(true)}
            className="w-full sm:w-auto"
          >
            <Settings2 className="w-4 h-4 mr-2" />
            Personalizar campos
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsImportOpen(true)}
            className="w-full sm:w-auto"
          >
            <Upload className="w-4 h-4 mr-2" />
            Import CSV
          </Button>
          <Button data-tour="contacts-new" className="w-full sm:w-auto" onClick={() => setIsFormOpen(true)}>
            Novo Contacto
          </Button>
          <Modal open={isFormOpen} onClose={() => setIsFormOpen(false)} title="Novo Contacto">
            <ContactForm
              onManageGroups={() => setIsGroupsOpen(true)}
              onSuccess={() => {
                setIsFormOpen(false);
                queryClient.invalidateQueries({ queryKey: ['contacts'] });
              }}
            />
          </Modal>
        </div>
      </div>

      <ImportCSVModal open={isImportOpen} onOpenChange={setIsImportOpen} />
      <ContactFieldsManager open={isFieldsOpen} onOpenChange={setIsFieldsOpen} />
      <ContactGroupsManager open={isGroupsOpen} onOpenChange={setIsGroupsOpen} />
      <ContactBulkActionsModal
        open={isBulkActionsOpen}
        onOpenChange={setIsBulkActionsOpen}
        selectedCount={selectedContactIds.length}
        contactGroups={contactGroups}
        pipelineStages={pipelineStages}
        canEditStage={canShowPipelineUi}
        canEditContactType={!isComercioWorkspace}
        loading={bulkUpdateMutation.isPending}
        onSubmit={async (changes) => {
          await bulkUpdateMutation.mutateAsync({
            contactIds: selectedContactIds,
            changes,
          });
        }}
      />

      {canShowPipelineUi && (
        <div className="inline-flex flex-wrap gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
          {(['interessado', 'cliente'] as const).map(type => (
            <button
              key={type}
              onClick={() => setContactTypeTab(type)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                contactTypeTab === type
                  ? 'bg-[var(--workspace-primary)] text-[var(--workspace-on-primary)] shadow-sm'
                  : 'text-[#6b7e9a] hover:bg-[var(--workspace-primary-soft)] hover:text-[var(--workspace-primary)]'
              }`}
            >
              {type === 'interessado' ? 'Interessados' : 'Clientes'}
            </button>
          ))}
        </div>
      )}

      <FilterBar
        data-tour="contacts-filters"
        search={search}
        onSearchChange={setSearch}
        placeholder="Pesquisar por nome, telefone, empresa ou NIF..."
        isLoading={isSearching}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={() => {
          setSearch('');
          setDebouncedSearch('');
          setStageFilter('ALL');
          setRevenueFilter('ALL');
          setGroupFilter(ALL_GROUPS_VALUE);
        }}
      >
        {canShowPipelineUi ? (
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Estado do Lead" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              {pipelineStages.map((s) => (
                <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <Select value={revenueFilter} onValueChange={setRevenueFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Faturamento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos</SelectItem>
            <SelectItem value="- 50 Milhões De Kwanzas">- 50M = 50 Milhões</SelectItem>
            <SelectItem value="Entre 50 - 100 Milhões">50M - 100M Milhões</SelectItem>
            <SelectItem value="Entre 100 Milhões - 500 Milhões">100M - 500M Milhões</SelectItem>
            <SelectItem value="+ 500 M">+500M Milhões</SelectItem>
          </SelectContent>
        </Select>
        <Select value={groupFilter} onValueChange={setGroupFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Grupo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_GROUPS_VALUE}>Todos os grupos</SelectItem>
            <SelectItem value={UNGROUPED_GROUP_VALUE}>Sem grupo</SelectItem>
            {contactGroups.map((group) => (
              <SelectItem key={group.id} value={group.id}>
                {group.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>

      <Card data-tour="contacts-table" className="border-slate-200 shadow-sm">
        {selectedContactIds.length > 0 ? (
          <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#0A2540]">
                {selectedContactIds.length} contacto(s) selecionado(s)
              </p>
              <p className="text-xs text-[#6b7e9a]">
                A seleção vale para os resultados visíveis com os filtros atuais.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsBulkActionsOpen(true)}>
                <ListChecks className="mr-1.5 h-4 w-4" />
                Ações em massa
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedContactIds([])}>
                <X className="mr-1.5 h-4 w-4" />
                Limpar seleção
              </Button>
            </div>
          </div>
        ) : null}
        {isContactsLoading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-12 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        ) : contactsQuery.isError ? (
          <div className="p-6">
            <ErrorState
              title="Não foi possível carregar os contactos"
              message="A lista de contactos não respondeu como esperado com os filtros atuais."
              onRetry={() => contactsQuery.refetch()}
              secondaryAction={{ label: 'Voltar ao Painel', href: '/' }}
            />
          </div>
        ) : contacts.length === 0 ? (
          <EmptyState
            variant={hasActiveFilters ? 'no-results' : 'empty'}
            title={hasActiveFilters ? 'Nenhum resultado para esta pesquisa' : 'Ainda não tens contactos'}
            description={
              hasActiveFilters
                ? 'Experimenta outro termo ou remove os filtros activos.'
                : 'Começa por criar o primeiro contacto ou importa a tua base via CSV.'
            }
            action={{ label: hasActiveFilters ? 'Limpar filtros' : 'Criar primeiro contacto', onClick: hasActiveFilters ? () => { setSearch(''); setDebouncedSearch(''); setStageFilter('ALL'); setRevenueFilter('ALL'); setGroupFilter(ALL_GROUPS_VALUE); } : () => setIsFormOpen(true) }}
            secondaryAction={!hasActiveFilters ? { label: 'Importar CSV', onClick: () => setIsImportOpen(true) } : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={allVisibleSelected ? true : (someVisibleSelected ? 'indeterminate' : false)}
                        onCheckedChange={toggleAllVisibleContacts}
                        aria-label="Selecionar todos os contactos visíveis"
                      />
                    </TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead className="hidden sm:table-cell">Telefone</TableHead>
                    <TableHead className="hidden md:table-cell">Grupo</TableHead>
                    {visibleSystemCols.map(cfg => (
                      <TableHead key={cfg.fieldKey} className="hidden md:table-cell">{cfg.label}</TableHead>
                    ))}
                  {fieldDefs.map((f) => (
                    <TableHead key={f.id} className="hidden lg:table-cell">{f.label}</TableHead>
                  ))}
                  {canShowPipelineUi ? <TableHead>Etapa</TableHead> : null}
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                  {contacts.map((contact) => (
                    <TableRow key={contact.id} data-state={selectedContactIds.includes(contact.id) ? 'selected' : undefined}>
                      <TableCell>
                        <Checkbox
                          checked={selectedContactIds.includes(contact.id)}
                          onCheckedChange={() => toggleContactSelection(contact.id)}
                          aria-label={`Selecionar ${contact.name}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{contact.name}</TableCell>
                      <TableCell className="hidden sm:table-cell">{contact.phone || '-'}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm">
                        {contact.contactGroup?.name || 'Sem grupo'}
                      </TableCell>
                      {visibleSystemCols.map(cfg => (
                        <TableCell key={cfg.fieldKey} className="hidden md:table-cell text-sm">
                          {cfg.fieldKey === 'tags'
                          ? (normalizeStringArray(contact.tags).join(', ') || '-')
                          : ((contact as any)[cfg.fieldKey] || '-')}
                      </TableCell>
                    ))}
                    {fieldDefs.map((f) => (
                      <TableCell key={f.id} className="hidden lg:table-cell text-sm">
                        {formatCustomFieldValue(normalizeCustomFields(contact.customFields)[f.key])}
                      </TableCell>
                    ))}
                    {canShowPipelineUi ? (
                      <TableCell>
                        <Badge
                          style={{
                            background: (pipelineStages.find((s) => s.name === contact.stage)?.color ?? '#6B7280') + '22',
                            color: pipelineStages.find((s) => s.name === contact.stage)?.color ?? '#6B7280',
                            border: 'none',
                          }}
                        >
                          {contact.stage}
                        </Badge>
                      </TableCell>
                    ) : null}
                    <TableCell>
                      <div className="flex gap-2">
                        <Link href={`/contacts/${contact.id}`}>
                          <Button variant="outline" size="sm">
                            <MessageCircle className="w-4 h-4" />
                          </Button>
                        </Link>
                        {(() => {
                          const waNum = formatWA(contact.phone ?? '');
                          return waNum ? (
                            <a href={`https://wa.me/${waNum}`} target="_blank" rel="noopener noreferrer">
                              <Button variant="outline" size="sm" className="text-green-600 border-green-200 hover:bg-green-50" title="WhatsApp">
                                <Phone className="w-4 h-4" />
                              </Button>
                            </a>
                          ) : (
                            <Button variant="outline" size="sm" disabled className="opacity-40" title="Sem telefone">
                              <Phone className="w-4 h-4" />
                            </Button>
                          );
                        })()}
                        {!isComercioWorkspace && contactTypeTab === 'interessado' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-[var(--workspace-primary-border)] text-xs text-[var(--workspace-primary)] hover:bg-[var(--workspace-primary-soft)]"
                            title="Converter para Cliente"
                            onClick={() => updateContact(String(contact.id), { contactType: 'cliente' } as any).then(() => queryClient.invalidateQueries({ queryKey: ['contacts'] }))}
                          >
                            → Cliente
                          </Button>
                        )}
                        {currentUser && !currentUser.accountOwnerId && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteMutation.mutate(contact.id.toString())}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
