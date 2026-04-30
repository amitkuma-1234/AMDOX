'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';

interface Props {
  data: { name: string; [k: string]: any }[];
  lines?: { key: string; color?: string; dashed?: boolean; label?: string }[];
  xKey?: string;
  height?: number;
  title?: string;
  referenceY?: number;
}

const COLORS = ['#6366f1', '#22d3ee', '#f59e0b', '#10b981'];

export default function LineChartWidget({ data, lines, xKey = 'name', height = 240, title, referenceY }: Props) {
  const keys = lines ?? (data.length > 0
    ? Object.keys(data[0]).filter(k => k !== xKey).map((key, i) => ({
        key, color: COLORS[i % COLORS.length], dashed: false, label: key,
      }))
    : []);

  return (
    <div className="card" style={{ height: height + 60 }}>
      {title && (
        <p style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.75rem', color: 'hsl(215 25% 92%)' }}>
          {title}
        </p>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 12% 24%)" vertical={false} />
          <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: 'hsl(215 15% 55%)' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: 'hsl(215 15% 55%)' }} axisLine={false} tickLine={false} width={48} />
          <Tooltip
            contentStyle={{ background: 'hsl(222 13% 14%)', border: '1px solid hsl(222 12% 24%)', borderRadius: 8 }}
            labelStyle={{ color: 'hsl(215 25% 92%)', fontSize: 12 }}
            itemStyle={{ color: 'hsl(215 15% 55%)', fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
          {referenceY !== undefined && (
            <ReferenceLine y={referenceY} stroke="hsl(4 86% 58%)" strokeDasharray="4 4" />
          )}
          {keys.map(({ key, color, dashed, label }) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              name={label ?? key}
              stroke={color}
              strokeWidth={2}
              strokeDasharray={dashed ? '5 5' : undefined}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
