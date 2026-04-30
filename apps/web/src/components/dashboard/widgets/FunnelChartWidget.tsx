'use client';

import { FunnelChart, Funnel, LabelList, Tooltip, ResponsiveContainer } from 'recharts';

interface Props {
  data: { name: string; value: number; fill?: string }[];
  height?: number;
  title?: string;
}

const DEFAULTS = ['#6366f1', '#22d3ee', '#f59e0b', '#10b981', '#f43f5e'];

export default function FunnelChartWidget({ data, height = 240, title }: Props) {
  const enriched = data.map((d, i) => ({ ...d, fill: d.fill ?? DEFAULTS[i % DEFAULTS.length] }));

  return (
    <div className="card" style={{ height: height + 60 }}>
      {title && (
        <p style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.75rem', color: 'hsl(215 25% 92%)' }}>
          {title}
        </p>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <FunnelChart>
          <Tooltip
            contentStyle={{ background: 'hsl(222 13% 14%)', border: '1px solid hsl(222 12% 24%)', borderRadius: 8 }}
            itemStyle={{ color: 'hsl(215 15% 55%)', fontSize: 12 }}
          />
          <Funnel dataKey="value" data={enriched} isAnimationActive>
            <LabelList position="right" fill="hsl(215 25% 92%)" stroke="none" dataKey="name" style={{ fontSize: 11 }} />
          </Funnel>
        </FunnelChart>
      </ResponsiveContainer>
    </div>
  );
}
