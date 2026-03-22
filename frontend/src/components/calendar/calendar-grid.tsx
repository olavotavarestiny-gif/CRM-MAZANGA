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
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center text-xs font-semibold text-[#64748B] py-2">
            {d}
          </div>
        ))}
      </div>

      {/* Weeks */}
      <div className="border border-[#E2E8F0] rounded-xl overflow-hidden">
        {weeks.map((week, wi) => (
          <div
            key={wi}
            className={cn('grid grid-cols-7', wi < weeks.length - 1 && 'border-b border-[#E2E8F0]')}
          >
            {week.map((day, di) => {
              if (!day) {
                return (
                  <div
                    key={di}
                    className={cn('min-h-[80px] p-1.5 bg-[#F8FAFC]', di < 6 && 'border-r border-[#E2E8F0]')}
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
                    'min-h-[80px] p-1.5 cursor-pointer transition-colors',
                    di < 6 && 'border-r border-[#E2E8F0]',
                    isSelected && !isToday && 'bg-[#635BFF]/5',
                    !isSelected && !isToday && 'hover:bg-[#F8FAFC]'
                  )}
                >
                  {/* Day number */}
                  <div className="flex justify-end mb-1">
                    <span
                      className={cn(
                        'w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium',
                        isToday && 'bg-[#635BFF] text-white font-bold',
                        !isToday && isSelected && 'text-[#635BFF] font-semibold',
                        !isToday && !isSelected && 'text-[#0A2540]'
                      )}
                    >
                      {day.getDate()}
                    </span>
                  </div>

                  {/* Event dots / pills */}
                  <div className="space-y-0.5">
                    {visibleEvents.map((ev) => (
                      <div
                        key={ev.id}
                        className="flex items-center gap-1 px-1 py-0.5 rounded text-[10px] font-medium truncate"
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
                      <div className="text-[10px] text-[#64748B] px-1">+{extraCount} mais</div>
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
