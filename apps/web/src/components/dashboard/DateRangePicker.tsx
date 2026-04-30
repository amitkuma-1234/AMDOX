'use client';

import { useState } from 'react';
import { format, subDays, startOfMonth, startOfYear } from 'date-fns';
import { Calendar, ChevronDown } from 'lucide-react';

export interface DateRange {
  startDate: string;  // ISO yyyy-MM-dd
  endDate: string;
  label: string;
}

const PRESETS: DateRange[] = [
  { label: 'Last 7 days',  startDate: format(subDays(new Date(), 7), 'yyyy-MM-dd'),   endDate: format(new Date(), 'yyyy-MM-dd') },
  { label: 'Last 30 days', startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),  endDate: format(new Date(), 'yyyy-MM-dd') },
  { label: 'Last 90 days', startDate: format(subDays(new Date(), 90), 'yyyy-MM-dd'),  endDate: format(new Date(), 'yyyy-MM-dd') },
  { label: 'Month to date', startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'), endDate: format(new Date(), 'yyyy-MM-dd') },
  { label: 'Year to date',  startDate: format(startOfYear(new Date()), 'yyyy-MM-dd'),  endDate: format(new Date(), 'yyyy-MM-dd') },
];

interface Props {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

export default function DateRangePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <button
        className="btn btn-ghost"
        onClick={() => setOpen(o => !o)}
        style={{ gap: 8, minWidth: 180 }}
      >
        <Calendar size={14} />
        <span style={{ fontSize: '0.82rem' }}>{value.label}</span>
        <ChevronDown size={13} style={{ marginLeft: 'auto', opacity: 0.6 }} />
      </button>

      {open && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 40 }}
            onClick={() => setOpen(false)}
          />
          <div style={{
            position: 'absolute', top: '110%', left: 0, zIndex: 50,
            background: 'hsl(222 13% 14%)', border: '1px solid hsl(222 12% 24%)',
            borderRadius: 10, padding: '0.5rem', minWidth: 200,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}>
            {PRESETS.map(preset => (
              <button
                key={preset.label}
                onClick={() => { onChange(preset); setOpen(false); }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '0.5rem 0.75rem', borderRadius: 6, border: 'none',
                  background: value.label === preset.label ? 'hsl(220 90% 56% / 0.15)' : 'transparent',
                  color: value.label === preset.label ? 'hsl(220 90% 70%)' : 'hsl(215 25% 85%)',
                  fontSize: '0.82rem', cursor: 'pointer',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (value.label !== preset.label) (e.target as HTMLElement).style.background = 'hsl(222 12% 18%)'; }}
                onMouseLeave={e => { if (value.label !== preset.label) (e.target as HTMLElement).style.background = 'transparent'; }}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
