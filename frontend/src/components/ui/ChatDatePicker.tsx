'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatChatDate } from '@/lib/chatPlaceholders';

type ChatDatePickerProps = {
  value: string;
  onChange: (isoDate: string) => void;
  disabled?: boolean;
  className?: string;
};

function toIsoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseIsoDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function ChatDatePicker({ value, onChange, disabled, className = '' }: ChatDatePickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const [viewDate, setViewDate] = useState(() => (value ? parseIsoDate(value) : new Date()));

  useEffect(() => {
    if (value) {
      setViewDate(parseIsoDate(value));
    }
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const calendarCells = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);
    return cells;
  }, [viewDate]);

  const monthLabel = viewDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  const selectDay = (day: number) => {
    const picked = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    onChange(toIsoDate(picked));
    setOpen(false);
  };

  const shiftMonth = (delta: number) => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className="w-full h-[42px] bg-slate-950 border border-white/10 rounded-xl px-3 text-xs text-white focus:outline-none focus:border-blue-500 disabled:opacity-50 flex items-center gap-2 cursor-pointer hover:border-white/20 transition-colors"
      >
        <Calendar className="w-4 h-4 text-blue-400 shrink-0" />
        <span className={`truncate ${value ? 'text-white' : 'text-slate-500'}`}>
          {value ? formatChatDate(value) : 'Select date'}
        </span>
      </button>

      {open && (
        <div className="absolute bottom-[calc(100%+8px)] right-0 z-50 w-[280px] rounded-2xl border border-white/10 bg-slate-900 shadow-2xl shadow-black/50 p-3">
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 cursor-pointer"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <p className="text-xs font-bold text-white">{monthLabel}</p>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 cursor-pointer"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map((day) => (
              <div key={day} className="text-[10px] font-semibold text-slate-500 text-center py-1">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map((day, index) => {
              if (!day) {
                return <div key={`empty-${index}`} className="h-8" />;
              }

              const iso = toIsoDate(new Date(viewDate.getFullYear(), viewDate.getMonth(), day));
              const isSelected = value === iso;
              const isToday = iso === toIsoDate(new Date());

              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={`h-8 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-blue-600 text-white'
                      : isToday
                        ? 'bg-blue-500/15 text-blue-300 hover:bg-blue-500/25'
                        : 'text-slate-200 hover:bg-white/10'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <div className="flex justify-between items-center mt-3 pt-2 border-t border-white/5">
            <button
              type="button"
              onClick={() => {
                const today = toIsoDate(new Date());
                onChange(today);
                setViewDate(new Date());
                setOpen(false);
              }}
              className="text-[10px] font-semibold text-blue-400 hover:text-blue-300 cursor-pointer"
            >
              Today
            </button>
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
                className="text-[10px] font-semibold text-slate-500 hover:text-slate-300 cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
