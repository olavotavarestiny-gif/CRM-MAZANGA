'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileText, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { downloadActivityCsv, getActivityFeed, getCurrentUser } from '@/lib/api';
import { formatActivityDetail, formatActivityMessage, formatRelativeTime } from '@/lib/activity-log';
import { FilterBar } from '@/components/ui/filter-bar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const ACTIVITY_TYPE_OPTIONS = [
  { value: 'contact', label: 'Contactos' },
  { value: 'task', label: 'Tarefas' },
  { value: 'invoice', label: 'Faturas' },
  { value: 'cash_session', label: 'Caixa' },
  { value: 'billing_customer', label: 'Clientes de faturação' },
  { value: 'product', label: 'Produtos' },
  { value: 'product_category', label: 'Categorias' },
  { value: 'serie', label: 'Séries' },
  { value: 'store', label: 'Pontos de venda' },
  { value: 'billing_config', label: 'Configuração fiscal' },
];

const ENTITY_TYPE_LABELS: Record<string, string> = {
  contact: 'Contacto',
  task: 'Tarefa',
  invoice: 'Fatura',
  cash_session: 'Caixa',
  billing_customer: 'Cliente de faturação',
  product: 'Produto',
  product_category: 'Categoria',
  serie: 'Série',
  store: 'Ponto de venda',
  billing_config: 'Configuração fiscal',
};

function isPrivilegedUser(user: Awaited<ReturnType<typeof getCurrentUser>> | null) {
  return !!(user?.isSuperAdmin || user?.role === 'admin' || !user?.accountOwnerId);
}

function FeedSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="h-20 animate-pulse rounded-2xl bg-slate-100" />
      ))}
    </div>
  );
}

export default function ActivityPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [userId, setUserId] = useState('all');
  const [entityType, setEntityType] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const currentUserQuery = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
    staleTime: 30_000,
    retry: false,
  });

  const currentUser = currentUserQuery.data || null;
  const privilegedUser = isPrivilegedUser(currentUser);

  useEffect(() => {
    if (currentUser && !privilegedUser) {
      router.replace('/');
    }
  }, [currentUser, privilegedUser, router]);

  const feedParams = useMemo(
    () => ({
      page,
      pageSize: 20,
      userId: userId !== 'all' ? Number(userId) : undefined,
      entityType: entityType !== 'all' ? entityType : undefined,
      search: search || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    [dateFrom, dateTo, entityType, page, search, userId]
  );

  const feedQuery = useQuery({
    queryKey: ['activity-feed', feedParams],
    queryFn: () => getActivityFeed(feedParams),
    enabled: privilegedUser,
    retry: false,
  });

  useEffect(() => {
    setPage(1);
  }, [search, userId, entityType, dateFrom, dateTo]);

  if (currentUserQuery.isLoading) {
    return <div className="min-h-[40vh] p-6" />;
  }

  if (!privilegedUser) {
    return null;
  }

  const totalPages = feedQuery.data?.pagination.totalPages || 1;
  const hasActiveFilters = userId !== 'all' || entityType !== 'all' || Boolean(dateFrom) || Boolean(dateTo);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <CardTitle>Atividade</CardTitle>
            <CardDescription>
              Histórico consolidado das principais mudanças da organização.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => downloadActivityCsv({
              userId: userId !== 'all' ? Number(userId) : undefined,
              entityType: entityType !== 'all' ? entityType : undefined,
              search: search || undefined,
              dateFrom: dateFrom || undefined,
              dateTo: dateTo || undefined,
            })}
          >
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
        </CardHeader>
        <CardContent className="space-y-5">
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            placeholder="Pesquisar entidade, utilizador ou valores..."
            hasActiveFilters={hasActiveFilters || Boolean(search)}
            onClearFilters={() => {
              setSearch('');
              setUserId('all');
              setEntityType('all');
              setDateFrom('');
              setDateTo('');
              setPage(1);
            }}
            className="items-end"
          >
            <div className="min-w-[220px]">
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.12em] text-[#6b7e9a]">
                Utilizador
              </label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os utilizadores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os utilizadores</SelectItem>
                  {(feedQuery.data?.users || []).map((user) => (
                    <SelectItem key={user.id} value={String(user.id)}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-[180px]">
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.12em] text-[#6b7e9a]">
                Tipo
              </label>
                <Select value={entityType} onValueChange={setEntityType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os tipos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os tipos</SelectItem>
                    {ACTIVITY_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

            <div className="min-w-[160px]">
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.12em] text-[#6b7e9a]">
                De
              </label>
              <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            </div>

            <div className="min-w-[160px]">
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.12em] text-[#6b7e9a]">
                Até
              </label>
              <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
            </div>
          </FilterBar>

          {feedQuery.isLoading ? (
            <FeedSkeleton />
          ) : feedQuery.isError ? (
            <ErrorState
              title="Não foi possível carregar a atividade"
              message="Tenta novamente dentro de instantes."
              onRetry={() => feedQuery.refetch()}
            />
          ) : (feedQuery.data?.data.length || 0) === 0 ? (
            <EmptyState
              icon={FileText}
              title="Sem atividade para mostrar"
              description="Quando houver mudanças em contactos, tarefas e faturas, elas vão aparecer aqui."
            />
          ) : (
            <div className="space-y-3">
              {feedQuery.data?.data.map((entry) => (
                <Card key={entry.id} className="border-[#e5ebf3] shadow-sm">
                  <CardContent className="flex flex-col gap-2 p-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#0A2540]">{formatActivityMessage(entry)}</p>
                      <p className="mt-1 text-sm text-[#6b7e9a]">{formatActivityDetail(entry)}</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.12em] text-[#94a3b8]">
                        {ENTITY_TYPE_LABELS[entry.entity_type] || entry.entity_type}
                      </p>
                    </div>
                    <div className="text-xs text-[#8a94a6] md:text-right">
                      <div>{formatRelativeTime(entry.created_at)}</div>
                      <div className="mt-1">{entry.user_name}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              <div className="flex flex-col gap-3 border-t border-[#e5ebf3] pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-[#6b7e9a]">
                  {feedQuery.data?.pagination.total || 0} registo{(feedQuery.data?.pagination.total || 0) !== 1 ? 's' : ''}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || feedQuery.isFetching}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                  >
                    Anterior
                  </Button>
                  <span className="text-sm text-[#6b7e9a]">
                    Página {page} de {totalPages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages || feedQuery.isFetching}
                    onClick={() => setPage((current) => current + 1)}
                  >
                    {feedQuery.isFetching ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                    Seguinte
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
