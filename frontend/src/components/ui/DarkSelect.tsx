'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export type DarkSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type DarkSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: DarkSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
};

export function DarkSelect({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  disabled = false,
  className = '',
  'aria-label': ariaLabel,
}: DarkSelectProps) {
  const [open, setOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selected = options.find((o) => o.value === value);
  const displayLabel = selected?.label || placeholder;

  useEffect(() => {
    if (!open || !rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    setOpenUpward(spaceBelow < 260);
  }, [open]);

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

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={`relative w-full ${className}`}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        className={`w-full min-h-[42px] bg-slate-950 border rounded-xl px-3 py-2.5 text-xs text-left flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          open ? 'border-blue-500 ring-1 ring-blue-500/30' : 'border-white/10 hover:border-white/20'
        }`}
      >
        <span
          className={`flex-1 min-w-0 line-clamp-2 leading-snug ${selected ? 'text-white' : 'text-slate-500'}`}
        >
          {displayLabel}
        </span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && options.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className={`absolute left-0 right-0 z-[80] max-h-[min(240px,50vh)] overflow-y-auto rounded-xl border border-white/10 bg-slate-950 shadow-2xl shadow-black/60 py-1 ${
            openUpward ? 'bottom-[calc(100%+6px)]' : 'top-[calc(100%+6px)]'
          }`}
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <li key={option.value} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  disabled={option.disabled}
                  onClick={() => !option.disabled && pick(option.value)}
                  className={`w-full text-left px-3 py-2.5 text-xs leading-snug transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-start gap-2 ${
                    isSelected
                      ? 'bg-blue-600/20 text-blue-100'
                      : 'text-slate-200 hover:bg-white/5 active:bg-white/10'
                  }`}
                >
                  {isSelected && <Check className="w-3.5 h-3.5 shrink-0 mt-0.5 text-blue-400" />}
                  <span className={isSelected ? '' : 'pl-5'}>{option.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
