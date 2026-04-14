'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  CheckCircle2,
  AlertCircle,
  Bell,
  BellOff,
  Loader2,
  RefreshCw,
  Unlink,
  Link2,
} from 'lucide-react';
import {
  getCalendarStatus,
  connectCalendar,
  disconnectCalendar,
  syncCalendar,
  getCalendarWatchStatus,
  startCalendarWatch,
  stopCalendarWatch,
} from '@/lib/api';
import { useToast } from '@/components/ui/toast-provider';

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getOAuthErrorMessage(code: string | null): string {
  switch (code) {
    case 'access_denied':
      return 'A autorização Google foi cancelada.';
    case 'calendar_not_configured':
      return 'A integração Google Calendar ainda não está configurada no servidor.';
    case 'invalid_state':
      return 'A validação de segurança do OAuth falhou. Tenta novamente.';
    case 'oauth_failed':
      return 'Não foi possível concluir a autorização com a Google.';
    default:
      return 'Falha ao conectar o Google Calendar.';
  }
}

export default function CalendarSettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  // ── OAuth redirect handling ──────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('connected') === 'true';
    const errorCode = params.get('error');

    if (!connected && !errorCode) return;

    queryClient.invalidateQueries({ queryKey: ['calendarStatus'] });
    queryClient.invalidateQueries({ queryKey: ['calendarWatchStatus'] });

    if (connected) {
      toast({
        variant: 'success',
        title: 'Google Calendar conectado',
        description: 'Conta ligada com sucesso. Podes agora sincronizar os teus eventos.',
      });
    } else if (errorCode) {
      toast({
        variant: 'error',
        title: 'Falha na ligação Google Calendar',
        description: getOAuthErrorMessage(errorCode),
      });
    }

    // Clean URL params without triggering a full navigation
    router.replace('/settings/calendar');
  }, [queryClient, toast, router]);

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['calendarStatus'],
    queryFn: getCalendarStatus,
    retry: false,
  });

  const { data: watchStatus, isLoading: watchLoading } = useQuery({
    queryKey: ['calendarWatchStatus'],
    queryFn: getCalendarWatchStatus,
    enabled: !!status?.connected,
    retry: false,
  });

  // ── Mutations ────────────────────────────────────────────────────────────
  const connectMutation = useMutation({
    mutationFn: connectCalendar,
    onSuccess: ({ authUrl }) => {
      window.location.assign(authUrl);
    },
    onError: (error: any) => {
      toast({
        variant: 'error',
        title: 'Falha ao iniciar ligação Google',
        description: error?.response?.data?.error || error?.message || 'Tenta novamente.',
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: disconnectCalendar,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendarStatus'] });
      queryClient.invalidateQueries({ queryKey: ['calendarWatchStatus'] });
      toast({
        variant: 'success',
        title: 'Google Calendar desligado',
        description: 'A integração foi removida com sucesso.',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'error',
        title: 'Falha ao desligar',
        description: error?.response?.data?.error || error?.message || 'Tenta novamente.',
      });
    },
  });

  const syncMutation = useMutation({
    mutationFn: syncCalendar,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['calendarStatus'] });
      queryClient.invalidateQueries({ queryKey: ['calendarEvents'] });
      toast({
        variant: 'success',
        title: 'Sincronização concluída',
        description: `${data.syncedCount} eventos importados, ${data.removedCount} removidos.`,
      });
    },
    onError: (error: any) => {
      const isReauth = error?.response?.data?.reauthRequired;
      toast({
        variant: 'error',
        title: 'Falha na sincronização',
        description: isReauth
          ? 'A ligação Google expirou. Reconecta a conta.'
          : error?.response?.data?.error || error?.message || 'Tenta novamente.',
      });
    },
  });

  // ── Watch toggle ─────────────────────────────────────────────────────────
  async function handleNotificationsToggle() {
    if (notificationsLoading) return;
    setNotificationsLoading(true);
    try {
      if (watchStatus?.active) {
        await stopCalendarWatch();
        toast({ variant: 'success', title: 'Notificações desactivadas' });
      } else {
        await startCalendarWatch();
        toast({
          variant: 'success',
          title: 'Notificações activadas',
          description: 'Vais receber actualizações em tempo real quando eventos mudarem no Google Calendar.',
        });
      }
      queryClient.invalidateQueries({ queryKey: ['calendarWatchStatus'] });
    } catch (error: any) {
      toast({
        variant: 'error',
        title: 'Falha ao alterar notificações',
        description: error?.response?.data?.error || error?.message || 'Tenta novamente.',
      });
    } finally {
      setNotificationsLoading(false);
    }
  }

  // ── Derived state ────────────────────────────────────────────────────────
  const isConnected = !!status?.connected;
  const isLoading = statusLoading;
  const anyMutating =
    connectMutation.isPending ||
    disconnectMutation.isPending ||
    syncMutation.isPending ||
    notificationsLoading;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <CalendarDays className="h-7 w-7 text-purple-400" />
          <div>
            <h1 className="text-xl font-semibold text-white">Google Calendar</h1>
            <p className="text-sm text-zinc-400">
              Liga a tua conta Google para sincronizar eventos bidirecionalmente.
            </p>
          </div>
        </div>

        {/* Re-auth warning */}
        {status?.reauthRequired && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <AlertCircle className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-300">Nova autorização necessária</p>
              <p className="text-xs text-amber-400 mt-0.5">
                A ligação ao Google expirou. Desliga e volta a conectar para restabelecer o acesso.
              </p>
            </div>
          </div>
        )}

        {/* Connection card */}
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
              ) : isConnected ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              ) : (
                <div className="h-5 w-5 rounded-full border-2 border-zinc-600" />
              )}
              <div>
                <p className="text-sm font-medium text-white">
                  {isLoading ? 'A verificar…' : isConnected ? 'Conectado' : 'Não conectado'}
                </p>
                {isConnected && status?.email && (
                  <p className="text-xs text-zinc-400 mt-0.5">{status.email}</p>
                )}
              </div>
            </div>

            {!isLoading && (
              <div className="flex items-center gap-2">
                {isConnected ? (
                  <button
                    onClick={() => disconnectMutation.mutate()}
                    disabled={anyMutating}
                    className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                  >
                    {disconnectMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Unlink className="h-3.5 w-3.5" />
                    )}
                    Desconectar
                  </button>
                ) : (
                  <button
                    onClick={() => connectMutation.mutate()}
                    disabled={anyMutating}
                    className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-orange-500 to-red-500 px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {connectMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Link2 className="h-3.5 w-3.5" />
                    )}
                    Conectar Google Calendar
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Last sync */}
          {isConnected && (
            <div className="border-t border-white/10 pt-4 space-y-3">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Última sincronização</span>
                <span>{formatDate(status?.lastSyncAt) ?? 'Nunca'}</span>
              </div>

              {status?.lastSyncError && (
                <p className="text-xs text-red-400">
                  Erro: {status.lastSyncError}
                </p>
              )}

              <button
                onClick={() => syncMutation.mutate()}
                disabled={anyMutating}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                {syncMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Sincronizar agora
              </button>
            </div>
          )}
        </div>

        {/* Notifications card */}
        {isConnected && (
          <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {watchLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                ) : watchStatus?.active ? (
                  <Bell className="h-5 w-5 text-purple-400" />
                ) : (
                  <BellOff className="h-5 w-5 text-zinc-500" />
                )}
                <div>
                  <p className="text-sm font-medium text-white">
                    Notificações em tempo real
                  </p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {watchStatus?.active
                      ? `Activas até ${formatDate(watchStatus.watchExpiry) ?? '—'}`
                      : 'Recebe actualizações instantâneas quando eventos mudarem no Google Calendar.'}
                  </p>
                </div>
              </div>

              <button
                onClick={handleNotificationsToggle}
                disabled={anyMutating || watchLoading}
                aria-pressed={watchStatus?.active}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 transition-colors focus:outline-none disabled:opacity-50 ${
                  watchStatus?.active
                    ? 'border-purple-500 bg-purple-500'
                    : 'border-zinc-600 bg-zinc-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5 ${
                    watchStatus?.active ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          </div>
        )}

        {/* Info callout */}
        <div className="rounded-lg border border-white/5 bg-white/[0.03] px-4 py-3 space-y-1">
          <p className="text-xs font-medium text-zinc-300">Como funciona</p>
          <ul className="text-xs text-zinc-500 space-y-1 list-disc list-inside">
            <li>Eventos do Google Calendar aparecem automaticamente na vista de Calendário.</li>
            <li>Com notificações activas, as mudanças chegam em segundos sem necessidade de sync manual.</li>
            <li>Os tokens OAuth são armazenados de forma encriptada (AES-256-GCM).</li>
          </ul>
        </div>

      </div>
    </div>
  );
}
