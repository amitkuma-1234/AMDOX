'use client';

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface Props {
  data: { name: string; value: number }[];
  height?: number;
  title?: string;
  innerRadius?: number;
}

const COLORS = ['#6366f1', '#22d3ee', '#f59e0b', '#10b981', '#f43f5e', '#a78bfa', '#fb923c'];

const renderCustomLabel = ({ name, percent }: any) =>
  `${name} ${(percent * 100).toFixed(0)}%`;

export default function PieChartWidget({ data, height = 240, title, innerRadius = 60 }: Props) {
  return (
    <div className="card" style={{ height: height + 60 }}>
      {title && (
        <p style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.75rem', color: 'hsl(215 25% 92%)' }}>
          {title}
        </p>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            outerRadius={height / 2 - 24}
            innerRadius={innerRadius}
            paddingAngle={3}
            dataKey="value"
            label={renderCustomLabel}
            labelLine={{ stroke: 'hsl(215 15% 55%)', strokeWidth: 1 }}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: 'hsl(222 13% 14%)', border: '1px solid hsl(222 12% 24%)', borderRadius: 8 }}
            itemStyle={{ color: 'hsl(215 15% 55%)', fontSize: 12 }}
          />
          <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
