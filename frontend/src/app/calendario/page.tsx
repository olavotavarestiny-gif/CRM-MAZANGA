'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, CalendarDays, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { getTasks, getCalendarStatus, getCalendarEvents, disconnectCalendar, getCalendarAuthUrl } from '@/lib/api';
import type { CalendarEvent } from '@/lib/types';
import CalendarGrid from '@/components/calendar/calendar-grid';
import DayEventsPanel from '@/components/calendar/day-events-panel';
import TaskFormModal from '@/components/tasks/task-form-modal';
import { ErrorState } from '@/components/ui/error-state';
import { useToast } from '@/components/ui/toast-provider';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export default function CalendarioPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskModalDate, setTaskModalDate] = useState('');

  // Handle ?connected=true or ?error=... from OAuth redirect
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === 'true' || params.get('error')) {
      queryClient.invalidateQueries({ queryKey: ['calendarStatus'] });
      window.history.replaceState({}, '', '/calendario');
    }
  }, [queryClient]);

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

  // Build CRM events from tasks
  const crmEvents: CalendarEvent[] = (tasksData || [])
    .filter((t) => !!t.dueDate)
    .map((t) => ({
      id: `crm_${t.id}`,
      title: t.title,
      start: t.dueDate!.slice(0, 10),
      allDay: true,
      source: 'crm' as const,
      color: '#635BFF',
      taskId: t.id,
      contactName: t.contact?.name,
      priority: t.priority,
    }));

  const allEvents: CalendarEvent[] = [...crmEvents, ...googleEvents];
  const isCalendarLoading = calendarStatusLoading || tasksLoading || (calendarStatus?.connected ? googleEventsLoading : false);
  const hasCalendarError = calendarStatusError || tasksError || (calendarStatus?.connected ? googleEventsError : false);
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

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#2c2f31]">Calendário</h1>
          <p className="mt-1 text-sm text-[#6b7e9a]">
            Tarefas do CRM e eventos Google numa vista mensal única.
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
                    <span className="flex items-center gap-1.5 rounded-full bg-[#ECFDF5] px-3 py-2 text-[#059669]">
                      <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                      Google Agenda
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {calendarStatus?.connected ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 rounded-2xl bg-[#10B981]/10 px-4 py-2">
                    <CheckCircle className="w-3.5 h-3.5 text-[#10B981]" />
                    <span className="text-xs font-medium text-[#059669]">
                      {calendarStatus.email || 'Google Agenda'}
                    </span>
                  </div>
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
                  onClick={async () => { window.location.href = await getCalendarAuthUrl(); }}
                  className="flex items-center gap-2 rounded-2xl border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#0A2540] transition-colors hover:bg-[#F8FAFC]"
                >
                  <CalendarDays className="w-4 h-4 text-[#635BFF]" />
                  <span>Conectar Google Agenda</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {calendarStatusLoading && (
          <div className="mx-6 mt-4 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>A carregar estado do Google Calendar...</span>
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
    </div>
  );
}
