'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';

interface Props {
  data: { name: string; value: number; [k: string]: any }[];
  bars?: { key: string; color?: string; label?: string }[];
  xKey?: string;
  height?: number;
  title?: string;
}

const COLORS = ['#6366f1', '#22d3ee', '#f59e0b', '#10b981', '#f43f5e'];

export default function BarChartWidget({ data, bars, xKey = 'name', height = 240, title }: Props) {
  const keys = bars ?? data.length > 0
    ? Object.keys(data[0] ?? {}).filter(k => k !== xKey).map((key, i) => ({
        key, color: COLORS[i % COLORS.length], label: key,
      }))
    : [];

  return (
    <div className="card" style={{ height: height + 60 }}>
      {title && (
        <p style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.75rem', color: 'hsl(215 25% 92%)' }}>
          {title}
        </p>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 12% 24%)" vertical={false} />
          <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: 'hsl(215 15% 55%)' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: 'hsl(215 15% 55%)' }} axisLine={false} tickLine={false} width={48} />
          <Tooltip
            contentStyle={{ background: 'hsl(222 13% 14%)', border: '1px solid hsl(222 12% 24%)', borderRadius: 8 }}
            labelStyle={{ color: 'hsl(215 25% 92%)', fontSize: 12 }}
            itemStyle={{ color: 'hsl(215 15% 55%)', fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
          {keys.map(({ key, color, label }) => (
            <Bar key={key} dataKey={key} name={label ?? key} fill={color} radius={[3, 3, 0, 0]} maxBarSize={48} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
