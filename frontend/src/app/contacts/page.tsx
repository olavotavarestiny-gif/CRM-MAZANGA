'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getContactsPage,
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
import ImportCSVModal from '@/components/contacts/import-csv-modal';
import ContactFieldsManager from '@/components/contacts/contact-fields-manager';
import ContactGroupsManager from '@/components/contacts/contact-groups-manager';
import Link from 'next/link';
import { Trash2, MessageCircle, Upload, Settings2, Phone, FolderTree } from 'lucide-react';
import { getContactFieldDefs } from '@/lib/api';
import type { Contact } from '@/lib/types';

function formatWA(phone: string): string | null {
  if (!phone) return null;
  let n = phone.replace(/[\s\-\(\)\+]/g, '');
  if (n.length <= 9 && !n.startsWith('244')) n = '244' + n;
  return n.length >= 9 ? n : null;
}

const ALL_GROUPS_VALUE = 'ALL';
const UNGROUPED_GROUP_VALUE = 'UNGROUPED';

export default function ContactsPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('ALL');
  const [revenueFilter, setRevenueFilter] = useState<string>('ALL');
  const [groupFilter, setGroupFilter] = useState<string>(ALL_GROUPS_VALUE);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState('50');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isFieldsOpen, setIsFieldsOpen] = useState(false);
  const [isGroupsOpen, setIsGroupsOpen] = useState(false);
  const [contactTypeTab, setContactTypeTab] = useState<'interessado' | 'cliente'>('interessado');

  const { data: currentUser, isLoading: currentUserLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
    staleTime: 30_000,
  });

  const workspaceResolved = !currentUserLoading;
  const isComercioWorkspace = workspaceResolved && currentUser?.workspaceMode === 'comercio';
  const effectiveContactType = isComercioWorkspace ? 'cliente' : contactTypeTab;
  const canShowPipelineUi = workspaceResolved && !isComercioWorkspace;

  const { data: fieldDefs = [] } = useQuery({
    queryKey: ['contactFieldDefs'],
    queryFn: getContactFieldDefs,
  });

  const { data: systemConfigs = [] } = useQuery({
    queryKey: ['contactFieldConfigs'],
    queryFn: getContactFieldConfigs,
    staleTime: 5 * 60_000,
  });

  const { data: contactGroups = [] } = useQuery({
    queryKey: ['contactGroups'],
    queryFn: getContactGroups,
    enabled: workspaceResolved,
  });

  // System columns to show (excluding fields already rendered in dedicated columns/UI)
  const visibleSystemCols = systemConfigs
    .filter(c => c.visible && !['name', 'phone'].includes(c.fieldKey))
    .sort((a, b) => a.order - b.order);

  const { data: pipelineStages = [] } = useQuery({
    queryKey: ['pipeline-stages'],
    queryFn: getPipelineStages,
    enabled: canShowPipelineUi,
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    if (isComercioWorkspace) {
      setContactTypeTab('cliente');
    }
  }, [isComercioWorkspace]);

  useEffect(() => {
    if (
      groupFilter !== ALL_GROUPS_VALUE &&
      groupFilter !== UNGROUPED_GROUP_VALUE &&
      !contactGroups.some((group) => group.id === groupFilter)
    ) {
      setGroupFilter(ALL_GROUPS_VALUE);
    }
  }, [contactGroups, groupFilter]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, stageFilter, revenueFilter, groupFilter, effectiveContactType, pageSize]);

  const contactsQuery = useQuery({
    queryKey: ['contacts', page, pageSize, debouncedSearch, canShowPipelineUi ? stageFilter : 'ALL', revenueFilter, groupFilter, effectiveContactType],
    queryFn: () =>
      getContactsPage({
        page,
        limit: Number(pageSize),
        search: debouncedSearch || undefined,
        stage: canShowPipelineUi && stageFilter !== 'ALL' ? stageFilter : undefined,
        revenue: revenueFilter === 'ALL' ? undefined : revenueFilter,
        groupId: groupFilter === ALL_GROUPS_VALUE ? undefined : groupFilter,
        contactType: effectiveContactType,
      }),
    placeholderData: (previousData) => previousData,
    retry: false,
    enabled: workspaceResolved,
  });
  const contacts: Contact[] = contactsQuery.data?.data ?? [];
  const contactsPagination = contactsQuery.data?.pagination;
  const isContactsLoading = !workspaceResolved || contactsQuery.isLoading;
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
    if (!contactsQuery.isFetching && contactsPagination && page > contactsPagination.totalPages) {
      setPage(contactsPagination.totalPages);
    }
  }, [contactsPagination, contactsQuery.isFetching, page]);

  const deleteMutation = useMutation({
    mutationFn: deleteContact,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['contact-stats'] });
      queryClient.invalidateQueries({ queryKey: ['contact-facets'] });
    },
  });

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
                queryClient.invalidateQueries({ queryKey: ['contact-stats'] });
                queryClient.invalidateQueries({ queryKey: ['contact-facets'] });
              }}
            />
          </Modal>
        </div>
      </div>

      <ImportCSVModal open={isImportOpen} onOpenChange={setIsImportOpen} />
      <ContactFieldsManager open={isFieldsOpen} onOpenChange={setIsFieldsOpen} />
      <ContactGroupsManager open={isGroupsOpen} onOpenChange={setIsGroupsOpen} />

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
          setPage(1);
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
            action={{ label: hasActiveFilters ? 'Limpar filtros' : 'Criar primeiro contacto', onClick: hasActiveFilters ? () => { setSearch(''); setDebouncedSearch(''); setStageFilter('ALL'); setRevenueFilter('ALL'); setPage(1); } : () => setIsFormOpen(true) }}
            secondaryAction={!hasActiveFilters ? { label: 'Importar CSV', onClick: () => setIsImportOpen(true) } : undefined}
          />
        ) : (
          <div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
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
                    <TableRow key={contact.id}>
                      <TableCell className="font-medium">{contact.name}</TableCell>
                      <TableCell className="hidden sm:table-cell">{contact.phone || '-'}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm">
                        {contact.contactGroup?.name || 'Sem grupo'}
                      </TableCell>
                      {visibleSystemCols.map(cfg => (
                        <TableCell key={cfg.fieldKey} className="hidden md:table-cell text-sm">
                          {cfg.fieldKey === 'tags'
                            ? ((contact.tags ?? []).join(', ') || '-')
                            : ((contact as any)[cfg.fieldKey] || '-')}
                        </TableCell>
                      ))}
                      {fieldDefs.map((f) => (
                        <TableCell key={f.id} className="hidden lg:table-cell text-sm">
                          {contact.customFields?.[f.key] || '-'}
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
                              onClick={() => updateContact(String(contact.id), { contactType: 'cliente' } as any).then(() => {
                                queryClient.invalidateQueries({ queryKey: ['contacts'] });
                                queryClient.invalidateQueries({ queryKey: ['contact-stats'] });
                                queryClient.invalidateQueries({ queryKey: ['contact-facets'] });
                              })}
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

            <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-[#6b7e9a]">
                {contactsPagination?.total ?? contacts.length} contacto{(contactsPagination?.total ?? contacts.length) === 1 ? '' : 's'} · página {contactsPagination?.page ?? page} de {contactsPagination?.totalPages ?? 1}
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[#6b7e9a]">Por página</span>
                  <Select value={pageSize} onValueChange={setPageSize}>
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={page <= 1 || contactsQuery.isFetching}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((current) => Math.min(contactsPagination?.totalPages ?? current, current + 1))}
                    disabled={page >= (contactsPagination?.totalPages ?? 1) || contactsQuery.isFetching}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
