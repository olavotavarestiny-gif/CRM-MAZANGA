'use client';

import { cn } from '@/lib/utils';
import type { CalendarEvent } from '@/lib/types';

interface CalendarGridProps {
  year: number;
  month: number; // 0-based
  events: CalendarEvent[];
  selectedDay: string | null; // ISO date "YYYY-MM-DD"
  onDayClick: (dateStr: string) => void;
}

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getMonthGrid(year: number, month: number): (Date | null)[][] {
  const firstDay = new Date(year, month, 1);
  // JS: 0=Sun → convert to Mon-based
  const startDow = (firstDay.getDay() + 6) % 7; // 0=Mon
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export default function CalendarGrid({ year, month, events, selectedDay, onDayClick }: CalendarGridProps) {
  const todayStr = toDateStr(new Date());
  const weeks = getMonthGrid(year, month);

  const eventsByDay = events.reduce<Record<string, CalendarEvent[]>>((acc, ev) => {
    const key = ev.start.slice(0, 10);
    if (!acc[key]) acc[key] = [];
    acc[key].push(ev);
    return acc;
  }, {});

  return (
    <div className="w-full">
      {/* Weekday headers */}
      <div className="mb-3 grid grid-cols-7 gap-2">
        {WEEKDAYS.map((d) => (
          <div key={d} className="rounded-full bg-[#F8FAFC] py-2 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748B]">
            {d}
          </div>
        ))}
      </div>

      {/* Weeks */}
      <div className="grid gap-3">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-3">
            {week.map((day, di) => {
              if (!day) {
                return (
                  <div
                    key={di}
                    className="min-h-[118px] rounded-[22px] bg-[#F8FAFC]"
                  />
                );
              }

              const dateStr = toDateStr(day);
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedDay;
              const dayEvents = eventsByDay[dateStr] || [];
              const visibleEvents = dayEvents.slice(0, 3);
              const extraCount = dayEvents.length - 3;

              return (
                <div
                  key={di}
                  onClick={() => onDayClick(dateStr)}
                  className={cn(
                    'min-h-[118px] cursor-pointer rounded-[22px] border p-3 transition-all',
                    isToday && 'border-[#635BFF]/20 bg-[#EEF2FF]',
                    isSelected && !isToday && 'border-[#D6E4FF] bg-[#EEF4FF]',
                    !isSelected && !isToday && 'border-slate-200 bg-white hover:bg-[#F8FAFC]'
                  )}
                >
                  {/* Day number */}
                  <div className="mb-3 flex justify-between">
                    <span
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium',
                        isToday && 'bg-[#635BFF] text-white font-bold',
                        !isToday && isSelected && 'text-[#635BFF] font-semibold',
                        !isToday && !isSelected && 'text-[#0A2540]'
                      )}
                    >
                      {day.getDate()}
                    </span>
                    {dayEvents.length > 0 && (
                      <span className="rounded-full bg-[#F8FAFC] px-2 py-1 text-[10px] font-semibold text-[#64748B]">
                        {dayEvents.length}
                      </span>
                    )}
                  </div>

                  {/* Event dots / pills */}
                  <div className="space-y-1.5">
                    {visibleEvents.map((ev) => (
                      <div
                        key={ev.id}
                        className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[10px] font-semibold truncate"
                        style={{
                          background: ev.source === 'google' ? '#10B98120' : '#635BFF20',
                          color: ev.source === 'google' ? '#059669' : '#4F46E5',
                        }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ background: ev.source === 'google' ? '#10B981' : '#635BFF' }}
                        />
                        <span className="truncate">{ev.title}</span>
                      </div>
                    ))}
                    {extraCount > 0 && (
                      <div className="px-1 text-[10px] font-medium text-[#64748B]">+{extraCount} mais</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
