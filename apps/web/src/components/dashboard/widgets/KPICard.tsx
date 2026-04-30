'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface Props {
  title: string;
  value: string | number;
  subtitle?: string;
  change?: number;       // percentage change, e.g. +12.5 or -3.2
  sparkline?: number[];  // last N data points for sparkline
  prefix?: string;
  suffix?: string;
  color?: string;
}

export default function KPICard({
  title, value, subtitle, change, sparkline, prefix = '', suffix = '', color = '#6366f1',
}: Props) {
  const sparkData = (sparkline ?? []).map((v, i) => ({ v, i }));
  const positive = (change ?? 0) >= 0;

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', minHeight: 140 }}>
      <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'hsl(215 15% 55%)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {title}
      </p>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: '2rem', fontWeight: 700, lineHeight: 1, color: 'hsl(215 25% 92%)' }}>
            {prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}
          </p>
          {subtitle && (
            <p style={{ fontSize: '0.75rem', color: 'hsl(215 15% 55%)', marginTop: 4 }}>{subtitle}</p>
          )}
        </div>

        {/* Sparkline */}
        {sparkData.length > 0 && (
          <div style={{ width: 80, height: 40 }}>
            <ResponsiveContainer>
              <LineChart data={sparkData}>
                <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Change indicator */}
      {change !== undefined && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem' }}>
          {change === 0
            ? <Minus size={13} color="hsl(215 15% 55%)" />
            : positive
              ? <TrendingUp size={13} color="#10b981" />
              : <TrendingDown size={13} color="#f43f5e" />}
          <span style={{ color: change === 0 ? 'hsl(215 15% 55%)' : positive ? '#10b981' : '#f43f5e', fontWeight: 600 }}>
            {positive ? '+' : ''}{change.toFixed(1)}%
          </span>
          <span style={{ color: 'hsl(215 15% 55%)' }}>vs last period</span>
        </div>
      )}
    </div>
  );
}
