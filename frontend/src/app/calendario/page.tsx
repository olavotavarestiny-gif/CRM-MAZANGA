'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, CalendarDays, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { getTasks, getCalendarStatus, getCalendarEvents, disconnectCalendar, getCalendarAuthUrl } from '@/lib/api';
import type { CalendarEvent } from '@/lib/types';
import CalendarGrid from '@/components/calendar/calendar-grid';
import DayEventsPanel from '@/components/calendar/day-events-panel';
import TaskFormModal from '@/components/tasks/task-form-modal';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export default function CalendarioPage() {
  const queryClient = useQueryClient();
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
  const { data: calendarStatus } = useQuery({
    queryKey: ['calendarStatus'],
    queryFn: getCalendarStatus,
    retry: false,
  });

  // Date range for the visible month (+ padding for weeks)
  const rangeStart = new Date(year, month, 1).toISOString();
  const rangeEnd = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

  // Tasks (all, to extract CRM events)
  const { data: tasksData } = useQuery({
    queryKey: ['tasks', { all: true }],
    queryFn: () => getTasks({}),
  });

  // Google Calendar events
  const { data: googleEvents = [] } = useQuery({
    queryKey: ['calendarEvents', year, month],
    queryFn: () => getCalendarEvents(rangeStart, rangeEnd),
    enabled: !!calendarStatus?.connected,
    retry: false,
  });

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: disconnectCalendar,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendarStatus'] }),
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

  // Events for the selected day
  const selectedDayEvents = selectedDay
    ? allEvents.filter((e) => e.start.slice(0, 10) === selectedDay)
    : [];

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
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <button
              onClick={prevMonth}
              className="p-1.5 hover:bg-[#F8FAFC] rounded-lg transition-colors text-[#64748B] hover:text-[#0A2540]"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h1 className="text-lg font-bold text-[#0A2540] w-44 text-center">
              {MONTH_NAMES[month]} {year}
            </h1>
            <button
              onClick={nextMonth}
              className="p-1.5 hover:bg-[#F8FAFC] rounded-lg transition-colors text-[#64748B] hover:text-[#0A2540]"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={goToday}
            className="px-3 py-1.5 text-sm font-medium border border-[#E2E8F0] rounded-lg hover:bg-[#F8FAFC] text-[#0A2540] transition-colors"
          >
            Hoje
          </button>
        </div>

        {/* Google Calendar status */}
        <div className="flex items-center gap-3">
          {/* Legend */}
          <div className="hidden sm:flex items-center gap-3 text-xs text-[#64748B]">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#635BFF]" />
              Tarefas CRM
            </span>
            {calendarStatus?.connected && (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                Google Agenda
              </span>
            )}
          </div>

          {calendarStatus?.connected ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#10B981]/10 rounded-lg">
                <CheckCircle className="w-3.5 h-3.5 text-[#10B981]" />
                <span className="text-xs font-medium text-[#059669] hidden sm:inline">
                  {calendarStatus.email || 'Google Agenda'}
                </span>
              </div>
              <button
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
                className="text-xs text-[#64748B] hover:text-[#EF4444] transition-colors px-2 py-1.5 hover:bg-red-50 rounded-lg"
              >
                {disconnectMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Desligar'}
              </button>
            </div>
          ) : (
            <a
              href={getCalendarAuthUrl()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2E8F0] text-sm font-medium text-[#0A2540] hover:bg-[#F8FAFC] transition-colors"
            >
              <CalendarDays className="w-4 h-4 text-[#635BFF]" />
              <span className="hidden sm:inline">Conectar Google Agenda</span>
              <span className="sm:hidden">Conectar</span>
            </a>
          )}
        </div>
      </div>

      {/* Google not configured warning */}
      {calendarStatus === undefined && (
        <div className="mx-6 mt-3 flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>A carregar estado do Google Calendar...</span>
        </div>
      )}

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Calendar */}
        <div className="flex-1 overflow-auto p-4">
          <CalendarGrid
            year={year}
            month={month}
            events={allEvents}
            selectedDay={selectedDay}
            onDayClick={(d) => setSelectedDay(selectedDay === d ? null : d)}
          />
        </div>

        {/* Day panel */}
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

      {/* Task creation modal */}
      <TaskFormModal
        open={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        defaultDate={taskModalDate}
      />
    </div>
  );
}
