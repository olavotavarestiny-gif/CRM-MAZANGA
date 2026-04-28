'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, CalendarDays, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { createLocalCalendarEvent, getChatUsers, getTasks, getCalendarStatus, getCalendarEvents, getLocalCalendarEvents, disconnectCalendar, connectCalendar, syncCalendar } from '@/lib/api';
import type { CalendarEvent } from '@/lib/types';
import CalendarGrid from '@/components/calendar/calendar-grid';
import DayEventsPanel from '@/components/calendar/day-events-panel';
import TaskFormModal from '@/components/tasks/task-form-modal';
import { ErrorState } from '@/components/ui/error-state';
import { useToast } from '@/components/ui/toast-provider';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function hasExplicitTaskTime(dueDate?: string | null): boolean {
  return !!dueDate && dueDate.includes('T') && !/T00:00(:00(?:\.000)?)?Z?$/.test(dueDate);
}

function formatTaskEventStart(dueDate: string): string {
  if (!hasExplicitTaskTime(dueDate)) return dueDate.slice(0, 10);

  const parsed = parseISO(dueDate);
  if (Number.isNaN(parsed.getTime())) return dueDate;

  return format(parsed, "yyyy-MM-dd'T'HH:mm:ss");
}

export default function CalendarioPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskModalDate, setTaskModalDate] = useState('');
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventNotes, setEventNotes] = useState('');
  const [eventStart, setEventStart] = useState('');
  const [eventEnd, setEventEnd] = useState('');
  const [eventContactId, setEventContactId] = useState('');
  const [eventAssigneeId, setEventAssigneeId] = useState('');
  const [eventSyncGoogle, setEventSyncGoogle] = useState(false);

  const getCalendarReturnTo = () => {
    if (typeof window === 'undefined') return undefined;
    return new URL('/calendario', window.location.origin).toString();
  };

  const formatLastSync = (value: string | null | undefined) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toLocaleString('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getCallbackErrorMessage = (code: string | null) => {
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
  };

  // Handle ?connected=true or ?error=... from OAuth redirect
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('connected') === 'true';
    const errorCode = params.get('error');

    if (connected || errorCode) {
      queryClient.invalidateQueries({ queryKey: ['calendarStatus'] });
      queryClient.invalidateQueries({ queryKey: ['calendarEvents'] });

      if (connected) {
        toast({
          variant: 'success',
          title: 'Google Calendar conectado',
          description: 'A conta foi ligada com sucesso. A sincronização inicial foi iniciada automaticamente.',
        });
      }

      if (errorCode) {
        toast({
          variant: 'error',
          title: 'Falha na ligação Google Calendar',
          description: getCallbackErrorMessage(errorCode),
        });
      }

      window.history.replaceState({}, '', '/calendario');
    }
  }, [queryClient, toast]);

  // Google Calendar status
  const {
    data: calendarStatus,
    isLoading: calendarStatusLoading,
    isError: calendarStatusError,
    refetch: refetchCalendarStatus,
  } = useQuery({
    queryKey: ['calendarStatus'],
    queryFn: getCalendarStatus,
    retry: false,
  });

  const { data: teamUsers = [] } = useQuery({
    queryKey: ['chat-users'],
    queryFn: getChatUsers,
  });

  // Date range for the visible month (+ padding for weeks)
  const rangeStart = new Date(year, month, 1).toISOString();
  const rangeEnd = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

  // Tasks (all, to extract CRM events)
  const {
    data: tasksData,
    isLoading: tasksLoading,
    isError: tasksError,
    refetch: refetchTasks,
  } = useQuery({
    queryKey: ['tasks', { all: true }],
    queryFn: () => getTasks({}),
  });

  const {
    data: localEvents = [],
    isLoading: localEventsLoading,
    isError: localEventsError,
    refetch: refetchLocalEvents,
  } = useQuery({
    queryKey: ['localCalendarEvents', year, month],
    queryFn: () => getLocalCalendarEvents(rangeStart, rangeEnd),
    retry: false,
  });

  // Google Calendar events
  const {
    data: googleEvents = [],
    isLoading: googleEventsLoading,
    isError: googleEventsError,
    refetch: refetchGoogleEvents,
  } = useQuery({
    queryKey: ['calendarEvents', year, month],
    queryFn: () => getCalendarEvents(rangeStart, rangeEnd),
    enabled: !!calendarStatus?.connected,
    retry: false,
  });

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: disconnectCalendar,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendarStatus'] });
      queryClient.invalidateQueries({ queryKey: ['calendarEvents'] });
      toast({
        variant: 'success',
        title: 'Google Agenda desligada',
        description: 'A integração foi removida com sucesso.',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'error',
        title: 'Falha ao desligar a agenda',
        description: error?.response?.data?.error || error?.message || 'Tenta novamente.',
      });
    },
  });

  const connectMutation = useMutation({
    mutationFn: () => connectCalendar(getCalendarReturnTo()),
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

  const syncMutation = useMutation({
    mutationFn: syncCalendar,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['calendarStatus'] });
      queryClient.invalidateQueries({ queryKey: ['calendarEvents'] });
      toast({
        variant: 'success',
        title: 'Google Calendar sincronizado',
        description: `${result.syncedCount} evento(s) sincronizado(s) e ${result.removedCount} removido(s).`,
      });
    },
    onError: (error: any) => {
      const reauthRequired = !!error?.response?.data?.reauthRequired;
      toast({
        variant: 'error',
        title: reauthRequired ? 'Reconexão necessária' : 'Falha na sincronização',
        description: error?.response?.data?.error || error?.message || 'Tenta novamente.',
      });
      queryClient.invalidateQueries({ queryKey: ['calendarStatus'] });
    },
  });

  const createEventMutation = useMutation({
    mutationFn: () => createLocalCalendarEvent({
      title: eventTitle,
      notes: eventNotes || undefined,
      startDate: eventStart,
      endDate: eventEnd,
      contactId: eventContactId ? Number(eventContactId) : null,
      assignedToUserId: eventAssigneeId ? Number(eventAssigneeId) : null,
      syncWithGoogle: eventSyncGoogle,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['localCalendarEvents'] });
      queryClient.invalidateQueries({ queryKey: ['calendarEvents'] });
      setEventModalOpen(false);
      setEventTitle('');
      setEventNotes('');
      setEventContactId('');
      toast({ variant: 'success', title: 'Evento criado', description: 'O evento foi adicionado ao calendário.' });
    },
    onError: (error: any) => {
      toast({ variant: 'error', title: 'Não foi possível criar evento', description: error?.message || 'Tenta novamente.' });
    },
  });

  // Build CRM events from tasks
  const crmEvents: CalendarEvent[] = (tasksData || [])
    .filter((t) => !!t.dueDate)
    .map((t) => ({
      id: `crm_${t.id}`,
      title: t.title,
      start: formatTaskEventStart(t.dueDate!),
      allDay: !hasExplicitTaskTime(t.dueDate),
      source: 'crm' as const,
      color: '#635BFF',
      taskId: t.id,
      contactName: t.contact?.name,
      priority: t.priority,
      externalUrl: t.googleCalendarHtmlLink || undefined,
      googleLinked: !!t.googleCalendarEventId,
      googleSyncError: t.googleCalendarSyncError || null,
    }));

  const localCalendarEvents: CalendarEvent[] = localEvents.map((event) => ({
    id: `local_${event.id}`,
    localEventId: event.id,
    title: event.title,
    start: event.startDate,
    end: event.endDate,
    allDay: false,
    source: 'crm',
    color: '#0EA5E9',
    contactName: event.contact?.name,
    externalUrl: event.googleCalendarHtmlLink || undefined,
    googleLinked: !!event.googleCalendarEventId,
    googleSyncError: event.googleCalendarSyncError || null,
  }));

  const allEvents: CalendarEvent[] = [...crmEvents, ...localCalendarEvents, ...googleEvents];
  const isCalendarLoading = calendarStatusLoading || tasksLoading || localEventsLoading || (calendarStatus?.connected ? googleEventsLoading : false);
  const hasCalendarError = calendarStatusError || tasksError || localEventsError || (calendarStatus?.connected ? googleEventsError : false);
  const hasEventsInView = allEvents.some((event) => {
    const eventDate = new Date(event.start);
    return eventDate.getFullYear() === year && eventDate.getMonth() === month;
  });

  // Events for the selected day
  const selectedDayEvents = selectedDay
    ? allEvents.filter((e) => e.start.slice(0, 10) === selectedDay)
    : [];

  const retryCalendarData = () => {
    refetchCalendarStatus();
    refetchTasks();
    refetchLocalEvents();
    if (calendarStatus?.connected) {
      refetchGoogleEvents();
    }
  };

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  }

  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  }

  function goToday() {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
    setSelectedDay(today.toISOString().slice(0, 10));
  }

  function openEventModal(date?: string) {
    const base = date || selectedDay || today.toISOString().slice(0, 10);
    setEventStart(`${base}T09:00`);
    setEventEnd(`${base}T10:00`);
    setEventAssigneeId(teamUsers[0]?.id ? String(teamUsers[0].id) : '');
    setEventModalOpen(true);
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#2c2f31]">Calendário</h1>
          <p className="mt-1 text-sm text-[#6b7e9a]">
            Tarefas do CRM e eventos Google numa vista mensal única. Cada utilizador pode ligar a sua própria Google Agenda.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-[#526277] shadow-sm">
          <CalendarDays className="h-3.5 w-3.5 text-[#635BFF]" />
          Planeamento mensal centralizado
        </div>
      </div>

      <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-[#E2E8F0] px-6 py-5">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">Vista Mensal</p>
                <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-[#0A2540]">
                  {MONTH_NAMES[month]} {year}
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-1 rounded-2xl bg-[#F8FAFC] p-1">
                  <button
                    onClick={prevMonth}
                    className="rounded-xl p-2 text-[#64748B] transition-colors hover:bg-white hover:text-[#0A2540]"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={goToday}
                    className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#0A2540] shadow-sm transition-colors hover:bg-slate-50"
                  >
                    Hoje
                  </button>
                  <button
                    onClick={nextMonth}
                    className="rounded-xl p-2 text-[#64748B] transition-colors hover:bg-white hover:text-[#0A2540]"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="hidden items-center gap-3 text-xs text-[#64748B] sm:flex">
                  <span className="flex items-center gap-1.5 rounded-full bg-[#F8FAFC] px-3 py-2">
                    <span className="w-2 h-2 rounded-full bg-[#635BFF]" />
                    Tarefas CRM
                  </span>
                  {calendarStatus?.connected && (
                    <span className={`flex items-center gap-1.5 rounded-full px-3 py-2 ${
                      calendarStatus.reauthRequired ? 'bg-amber-50 text-amber-700' : 'bg-[#ECFDF5] text-[#059669]'
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${
                        calendarStatus.reauthRequired ? 'bg-amber-500' : 'bg-[#10B981]'
                      }`} />
                      {calendarStatus.reauthRequired ? 'Google requer reconexão' : 'Google Agenda'}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-2 text-sky-700">
                    <span className="w-2 h-2 rounded-full bg-sky-500" />
                    Eventos CRM
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {calendarStatus?.connected ? (
                <div className="flex flex-wrap items-center gap-2">
                  <div className={`flex items-center gap-1.5 rounded-2xl px-4 py-2 ${
                    calendarStatus.reauthRequired ? 'bg-amber-50' : 'bg-[#10B981]/10'
                  }`}>
                    {calendarStatus.reauthRequired ? (
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                    ) : (
                      <CheckCircle className="w-3.5 h-3.5 text-[#10B981]" />
                    )}
                    <span className={`text-xs font-medium ${
                      calendarStatus.reauthRequired ? 'text-amber-700' : 'text-[#059669]'
                    }`}>
                      {calendarStatus.reauthRequired
                        ? `Reconectar ${calendarStatus.email || 'Google Agenda'}`
                        : (calendarStatus.email || 'Google Agenda')}
                    </span>
                  </div>
                  {!calendarStatus.reauthRequired && (
                    <button
                      onClick={() => syncMutation.mutate()}
                      disabled={syncMutation.isPending}
                      className="flex items-center gap-2 rounded-2xl bg-[#0A2540] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#0A2540]/92 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {syncMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CalendarDays className="w-3.5 h-3.5" />}
                      <span>Sincronizar agora</span>
                    </button>
                  )}
                  {calendarStatus.reauthRequired && (
                    <button
                      onClick={() => connectMutation.mutate()}
                      disabled={connectMutation.isPending}
                      className="flex items-center gap-2 rounded-2xl bg-amber-500 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {connectMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CalendarDays className="w-3.5 h-3.5" />}
                      <span>Reconectar</span>
                    </button>
                  )}
                  <button
                    onClick={() => disconnectMutation.mutate()}
                    disabled={disconnectMutation.isPending}
                    className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-medium text-[#64748B] transition-colors hover:bg-red-50 hover:text-[#EF4444]"
                  >
                    {disconnectMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Desligar'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => connectMutation.mutate()}
                  disabled={connectMutation.isPending}
                  className="flex items-center gap-2 rounded-2xl border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#0A2540] transition-colors hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {connectMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#635BFF]" />
                  ) : (
                    <CalendarDays className="w-4 h-4 text-[#635BFF]" />
                  )}
                  <span>Conectar Google Agenda</span>
                </button>
              )}
              <button
                onClick={() => openEventModal()}
                className="flex items-center gap-2 rounded-2xl bg-[var(--workspace-primary)] px-4 py-2 text-sm font-semibold text-[var(--workspace-on-primary)] transition-opacity hover:opacity-90"
              >
                Novo evento
              </button>
            </div>
          </div>
        </div>

        {calendarStatusLoading && (
          <div className="mx-6 mt-4 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>A carregar estado do Google Calendar...</span>
          </div>
        )}

        {calendarStatus?.connected && (
          <div className={`mx-6 mt-4 flex flex-col gap-1 rounded-2xl border p-3 text-sm ${
            calendarStatus.reauthRequired
              ? 'border-amber-200 bg-amber-50 text-amber-800'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}>
            <div className="flex items-center gap-2">
              {calendarStatus.reauthRequired ? (
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
              ) : (
                <CheckCircle className="h-4 w-4 flex-shrink-0" />
              )}
              <span className="font-medium">
                {calendarStatus.reauthRequired
                  ? 'A ligação Google precisa de nova autorização.'
                  : 'Google Calendar ligado ao teu utilizador.'}
              </span>
            </div>
            <span className="text-xs opacity-90">
              {calendarStatus.reauthRequired
                ? (calendarStatus.lastSyncError || 'Reconecta a conta para continuar a sincronizar.')
                : (calendarStatus.lastSyncAt
                  ? `Última sincronização: ${formatLastSync(calendarStatus.lastSyncAt)}`
                  : 'A sincronização inicial ainda está pendente. Podes forçar manualmente em "Sincronizar agora".')}
            </span>
          </div>
        )}

        {hasCalendarError && (
          <div className="mx-6 mt-4">
            <ErrorState
              compact
              title="Erro ao carregar o calendário"
              message="Não foi possível carregar todos os dados desta vista mensal."
              onRetry={retryCalendarData}
              secondaryAction={{ label: 'Ir para Painel', href: '/' }}
            />
          </div>
        )}

        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-auto p-4">
            {isCalendarLoading ? (
              <div className="space-y-4">
                <div className="grid grid-cols-7 gap-3">
                  {Array.from({ length: 7 }).map((_, index) => (
                    <div key={index} className="h-8 animate-pulse rounded-full bg-slate-100" />
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-3">
                  {Array.from({ length: 35 }).map((_, index) => (
                    <div key={index} className="h-28 animate-pulse rounded-3xl bg-slate-100" />
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {!hasEventsInView && !hasCalendarError && (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-[#FBFDFF] px-4 py-4 text-sm text-[#64748B]">
                    Não existem tarefas ou eventos neste mês. Seleciona um dia para planear novas actividades.
                  </div>
                )}
                <CalendarGrid
                  year={year}
                  month={month}
                  events={allEvents}
                  selectedDay={selectedDay}
                  onDayClick={(d) => setSelectedDay(selectedDay === d ? null : d)}
                />
              </div>
            )}
          </div>

          {selectedDay && (
            <DayEventsPanel
              dateStr={selectedDay}
              events={selectedDayEvents}
              onClose={() => setSelectedDay(null)}
              onNewTask={(date) => {
                setTaskModalDate(date);
                setTaskModalOpen(true);
              }}
            />
          )}
        </div>
      </div>

      <TaskFormModal
        open={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        defaultDate={taskModalDate}
      />

      <Dialog open={eventModalOpen} onOpenChange={setEventModalOpen}>
        <DialogContent className="max-w-lg bg-white">
          <DialogHeader>
            <DialogTitle>Novo evento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input value={eventTitle} onChange={(event) => setEventTitle(event.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label>Início *</Label>
                <Input type="datetime-local" value={eventStart} onChange={(event) => setEventStart(event.target.value)} />
              </div>
              <div>
                <Label>Fim *</Label>
                <Input type="datetime-local" value={eventEnd} onChange={(event) => setEventEnd(event.target.value)} />
              </div>
            </div>
            <div>
              <Label>Responsável</Label>
              <Select value={eventAssigneeId || '__self__'} onValueChange={(value) => setEventAssigneeId(value === '__self__' ? '' : value)}>
                <SelectTrigger><SelectValue placeholder="Selecionar responsável" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__self__">Eu</SelectItem>
                  {teamUsers.map((user) => (
                    <SelectItem key={user.id} value={String(user.id)}>{user.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Contacto</Label>
              <Input type="number" min="1" placeholder="ID do contacto" value={eventContactId} onChange={(event) => setEventContactId(event.target.value)} />
            </div>
            <div>
              <Label>Notas</Label>
              <Textarea rows={3} value={eventNotes} onChange={(event) => setEventNotes(event.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={eventSyncGoogle} onCheckedChange={setEventSyncGoogle} />
              <Label>Sincronizar com Google Calendar</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEventModalOpen(false)}>Cancelar</Button>
            <Button
              disabled={!eventTitle.trim() || !eventStart || !eventEnd || createEventMutation.isPending}
              onClick={() => createEventMutation.mutate()}
            >
              {createEventMutation.isPending ? 'A guardar...' : 'Guardar evento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
