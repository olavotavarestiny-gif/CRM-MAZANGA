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
    <div className="w-72 border-l border-[#E2E8F0] bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E2E8F0]">
        <div>
          <p className="text-xs text-[#64748B] capitalize">{formatDisplayDate(dateStr)}</p>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-[#F8FAFC] rounded transition-colors"
        >
          <X className="w-4 h-4 text-[#64748B]" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* CRM Tasks */}
        {crmEvents.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <CheckSquare className="w-3.5 h-3.5 text-[#635BFF]" />
              <span className="text-xs font-semibold text-[#0A2540]">Tarefas CRM</span>
            </div>
            <div className="space-y-1.5">
              {crmEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-start gap-2 p-2 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors"
                >
                  <span
                    className="w-2 h-2 rounded-full mt-1 flex-shrink-0"
                    style={{ background: PRIORITY_COLORS[ev.priority || ''] || '#635BFF' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#0A2540] truncate">{ev.title}</p>
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
            <div className="flex items-center gap-1.5 mb-2">
              <Calendar className="w-3.5 h-3.5 text-[#10B981]" />
              <span className="text-xs font-semibold text-[#0A2540]">Google Agenda</span>
            </div>
            <div className="space-y-1.5">
              {googleEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-start gap-2 p-2 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors"
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
          <div className="text-center py-8">
            <Calendar className="w-8 h-8 text-[#E2E8F0] mx-auto mb-2" />
            <p className="text-sm text-[#64748B]">Sem eventos neste dia</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[#E2E8F0]">
        <button
          onClick={() => onNewTask(dateStr)}
          className="w-full py-2 rounded-lg bg-[#635BFF] text-white text-sm font-semibold hover:bg-[#4F46E5] transition-colors"
        >
          + Nova Tarefa
        </button>
      </div>
    </div>
  );
}
