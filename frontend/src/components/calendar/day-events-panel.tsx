'use client';

import { X, CheckSquare, Calendar, ExternalLink } from 'lucide-react';
import type { CalendarEvent } from '@/lib/types';
import Link from 'next/link';

interface DayEventsPanelProps {
  dateStr: string; // "YYYY-MM-DD"
  events: CalendarEvent[];
  onClose: () => void;
  onNewTask: (date: string) => void;
}

function formatTime(isoStr: string): string {
  if (!isoStr.includes('T')) return ''; // all-day
  if (/T00:00(:00(?:\.000)?)?Z?$/.test(isoStr)) return '';
  try {
    return new Date(isoStr).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function formatDisplayDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
}

const PRIORITY_COLORS: Record<string, string> = {
  Alta: '#EF4444',
  Media: '#F59E0B',
  Baixa: '#10B981',
};

export default function DayEventsPanel({ dateStr, events, onClose, onNewTask }: DayEventsPanelProps) {
  const crmEvents = events.filter((e) => e.source === 'crm');
  const googleEvents = events.filter((e) => e.source === 'google');

  return (
    <div className="flex w-80 flex-col border-l border-[#E2E8F0] bg-[#FBFDFF]">
      {/* Header */}
      <div className="border-b border-[#E2E8F0] px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">Dia Selecionado</p>
          <p className="mt-2 text-sm font-semibold capitalize text-[#0A2540]">{formatDisplayDate(dateStr)}</p>
        </div>
        <div className="mt-3 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl p-2 transition-colors hover:bg-white"
          >
            <X className="w-4 h-4 text-[#64748B]" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
        {/* CRM Tasks */}
        {crmEvents.length > 0 && (
          <div>
            <div className="mb-3 flex items-center gap-1.5">
              <CheckSquare className="w-3.5 h-3.5 text-[#635BFF]" />
              <span className="text-xs font-semibold text-[#0A2540]">Tarefas CRM</span>
            </div>
            <div className="space-y-2">
              {crmEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-start gap-2 rounded-2xl border border-[#E2E8F0] bg-white p-3 shadow-sm transition-colors hover:bg-[#F8FAFC]"
                >
                  <span
                    className="w-2 h-2 rounded-full mt-1 flex-shrink-0"
                    style={{ background: PRIORITY_COLORS[ev.priority || ''] || '#635BFF' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#0A2540] truncate">{ev.title}</p>
                    {!ev.allDay && ev.start && (
                      <p className="text-xs text-[#64748B]">
                        {formatTime(ev.start)}
                      </p>
                    )}
                    {ev.contactName && (
                      <p className="text-xs text-[#64748B] truncate">{ev.contactName}</p>
                    )}
                  </div>
                  {ev.taskId && (
                    <Link href="/tasks" className="flex-shrink-0">
                      <ExternalLink className="w-3.5 h-3.5 text-[#64748B] hover:text-[#635BFF]" />
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Google Events */}
        {googleEvents.length > 0 && (
          <div>
            <div className="mb-3 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#10B981]" />
              <span className="text-xs font-semibold text-[#0A2540]">Google Agenda</span>
            </div>
            <div className="space-y-2">
              {googleEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-start gap-2 rounded-2xl border border-[#E2E8F0] bg-white p-3 shadow-sm transition-colors hover:bg-[#F8FAFC]"
                >
                  <span className="w-2 h-2 rounded-full mt-1 flex-shrink-0 bg-[#10B981]" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#0A2540] truncate">{ev.title}</p>
                    {!ev.allDay && ev.start && (
                      <p className="text-xs text-[#64748B]">
                        {formatTime(ev.start)}{ev.end ? ` — ${formatTime(ev.end)}` : ''}
                      </p>
                    )}
                    {ev.allDay && <p className="text-xs text-[#64748B]">Dia inteiro</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {events.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center shadow-sm">
            <Calendar className="mx-auto mb-2 h-8 w-8 text-[#E2E8F0]" />
            <p className="text-sm font-medium text-[#64748B]">Sem eventos neste dia</p>
            <p className="mt-1 text-xs text-[#94a3b8]">Podes criar uma tarefa para começar o planeamento.</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-[#E2E8F0] px-5 py-4">
        <button
          onClick={() => onNewTask(dateStr)}
          className="w-full rounded-2xl bg-[#0A2540] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0A2540]/92"
        >
          + Nova Tarefa
        </button>
      </div>
    </div>
  );
}
