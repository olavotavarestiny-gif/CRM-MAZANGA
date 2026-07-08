'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquareText, RefreshCw, Search, Send } from 'lucide-react';
import {
  listMessagingMessages,
  sendMessagingSingleMessage,
  syncMessagingMessage,
  type MessagingMessage,
} from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingButton } from '@/components/ui/loading-button';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast-provider';

const PAGE_SIZE = 12;

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('pt-PT');
}

function getStatusVariant(status?: string | null) {
  const normalized = String(status || '').toLowerCase();
  if (['completed', 'delivered', 'sent'].includes(normalized)) return 'success' as const;
  if (['failed', 'rejected', 'undelivered', 'expired', 'cancelled'].includes(normalized)) return 'destructive' as const;
  if (['processing', 'sending', 'pending'].includes(normalized)) return 'default' as const;
  return 'secondary' as const;
}

function MessageStatus({ message }: { message: MessagingMessage }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge variant={getStatusVariant(message.status)}>{message.status}</Badge>
      {message.providerStatus ? <Badge variant="outline">{message.providerStatus}</Badge> : null}
      {message.isTest ? <Badge variant="secondary">Teste</Badge> : null}
    </div>
  );
}

export default function MessagingPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [lastMessage, setLastMessage] = useState<MessagingMessage | null>(null);
  const [form, setForm] = useState({
    phone: '',
    content: '',
    remitterId: '',
    isTest: true,
  });

  const messagesQuery = useQuery({
    queryKey: ['messaging-messages', page, search],
    queryFn: () =>
      listMessagingMessages({
        page,
        pageSize: PAGE_SIZE,
        search: search || undefined,
      }),
  });

  const contentLength = useMemo(() => form.content.trim().length, [form.content]);

  const sendMutation = useMutation({
    mutationFn: () =>
      sendMessagingSingleMessage({
        phone: form.phone,
        content: form.content,
        remitterId: form.remitterId || undefined,
        isTest: form.isTest,
      }),
    onSuccess: (message) => {
      setLastMessage(message);
      setForm((current) => ({ ...current, phone: '', content: '' }));
      queryClient.invalidateQueries({ queryKey: ['messaging-messages'] });
      toast({
        variant: 'success',
        title: 'Mensagem enviada',
        description: `Estado inicial: ${message.status}.`,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'error',
        title: 'Não foi possível enviar',
        description: error.message,
      });
    },
  });

  const syncMutation = useMutation({
    mutationFn: (messageId: string) => syncMessagingMessage(messageId),
    onSuccess: (message) => {
      setLastMessage((current) => (current?.id === message.id ? message : current));
      queryClient.invalidateQueries({ queryKey: ['messaging-messages'] });
      toast({
        variant: 'success',
        title: 'Mensagem sincronizada',
        description: `Estado atual: ${message.status}.`,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'error',
        title: 'Falha ao sincronizar',
        description: error.message,
      });
    },
  });

  const messages = messagesQuery.data?.data || [];
  const pagination = messagesQuery.data?.pagination;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#2c2f31]">SMS</h1>
          <p className="mt-1 text-sm text-[#6b7e9a]">
            Envio operacional por Ziett com tracking de estado por conta.
          </p>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-[#526277] shadow-sm">
          <MessageSquareText className="h-3.5 w-3.5 text-[var(--workspace-primary)]" />
          Canal SMS
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Nova mensagem</CardTitle>
            <CardDescription>Envio unitário para validação e uso controlado.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sms-phone">Número</Label>
              <Input
                id="sms-phone"
                value={form.phone}
                onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                placeholder="+2449XXXXXXXX"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sms-content">Mensagem</Label>
              <Textarea
                id="sms-content"
                value={form.content}
                onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
                placeholder="Escreve a mensagem SMS"
                className="min-h-[150px]"
              />
              <div className="flex justify-end text-xs text-[#6b7e9a]">{contentLength} caracteres</div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sms-remitter">Remitter ID Ziett</Label>
              <Input
                id="sms-remitter"
                value={form.remitterId}
                onChange={(event) => setForm((current) => ({ ...current, remitterId: event.target.value }))}
                placeholder="Usar remitter configurado"
              />
            </div>

            <div className="flex items-center justify-between gap-4 rounded-xl border border-[#dde3ec] bg-[#f8fafc] px-4 py-3">
              <div>
                <Label htmlFor="sms-test-mode" className="cursor-pointer text-sm font-semibold text-[#0A2540]">
                  Modo teste
                </Label>
                <p className="mt-1 text-xs text-[#6b7e9a]">Limita o envio à allowlist configurada.</p>
              </div>
              <Switch
                id="sms-test-mode"
                checked={form.isTest}
                onCheckedChange={(checked) => setForm((current) => ({ ...current, isTest: checked === true }))}
              />
            </div>

            <LoadingButton
              className="w-full"
              loading={sendMutation.isPending}
              loadingLabel="A enviar..."
              onClick={() => sendMutation.mutate()}
              disabled={!form.phone.trim() || !form.content.trim()}
            >
              <Send className="mr-2 h-4 w-4" />
              Enviar SMS
            </LoadingButton>

            {lastMessage ? (
              <div className="rounded-xl border border-[#dde3ec] bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#0A2540]">Último envio</p>
                    <p className="mt-1 font-mono text-xs text-[#6b7e9a]">{lastMessage.providerMessageId || lastMessage.id}</p>
                  </div>
                  <MessageStatus message={lastMessage} />
                </div>
                {lastMessage.providerErrorMessage ? (
                  <p className="mt-3 text-sm text-red-700">{lastMessage.providerErrorMessage}</p>
                ) : null}
                <LoadingButton
                  variant="outline"
                  className="mt-4 w-full"
                  loading={syncMutation.isPending && syncMutation.variables === lastMessage.id}
                  loadingLabel="A sincronizar..."
                  onClick={() => syncMutation.mutate(lastMessage.id)}
                  disabled={!lastMessage.providerMessageId}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Sincronizar estado
                </LoadingButton>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <CardTitle>Histórico</CardTitle>
              <CardDescription>Mensagens enviadas por utilizadores desta conta.</CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b7e9a]" />
                <Input
                  value={search}
                  onChange={(event) => {
                    setPage(1);
                    setSearch(event.target.value);
                  }}
                  placeholder="Pesquisar..."
                  className="w-full pl-9 sm:w-64"
                />
              </div>
              <Button variant="outline" size="icon" onClick={() => messagesQuery.refetch()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {messagesQuery.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="h-16 animate-pulse rounded-xl bg-slate-100" />
                ))}
              </div>
            ) : messagesQuery.isError ? (
              <ErrorState
                compact
                title="Não foi possível carregar o histórico"
                message="Tenta novamente dentro de instantes."
                onRetry={() => messagesQuery.refetch()}
              />
            ) : messages.length === 0 ? (
              <EmptyState
                compact
                icon={MessageSquareText}
                title="Sem mensagens"
                description="Os envios SMS desta conta aparecem aqui."
              />
            ) : (
              <div className="overflow-hidden rounded-xl border border-[#dde3ec]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Mensagem</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Custo</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {messages.map((message) => (
                      <TableRow key={message.id}>
                        <TableCell className="font-mono text-xs text-[#0A2540]">{message.phoneNormalized}</TableCell>
                        <TableCell className="max-w-[18rem] truncate text-sm text-[#526277]">{message.content}</TableCell>
                        <TableCell><MessageStatus message={message} /></TableCell>
                        <TableCell className="text-sm text-[#526277]">
                          {typeof message.cost === 'number' ? message.cost.toFixed(4) : '-'}
                        </TableCell>
                        <TableCell className="text-sm text-[#526277]">{formatDateTime(message.createdAt)}</TableCell>
                        <TableCell className="text-right">
                          <LoadingButton
                            variant="secondary"
                            size="sm"
                            loading={syncMutation.isPending && syncMutation.variables === message.id}
                            loadingLabel="Sync"
                            disabled={!message.providerMessageId}
                            onClick={() => syncMutation.mutate(message.id)}
                          >
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Sync
                          </LoadingButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {pagination ? (
              <div className="flex flex-col gap-3 border-t border-[#e5ebf3] pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-[#6b7e9a]">{pagination.total} mensagem(ns)</p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page <= 1}
                    onClick={() => setPage((current) => Math.max(current - 1, 1))}
                  >
                    Anterior
                  </Button>
                  <span className="text-sm text-[#6b7e9a]">
                    Página {pagination.page} de {pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => setPage((current) => current + 1)}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
