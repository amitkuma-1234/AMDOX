'use client';

import dynamic from 'next/dynamic';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

interface AllocationEntry {
  employeeId: string;
  allocations: { start: string; end: string; allocation: number }[];
  totalAllocation: number;
  isOverAllocated: boolean;
}

interface Props {
  employees: AllocationEntry[];
  employeeNames?: Record<string, string>;
  title?: string;
}

function buildHeatmapData(employees: AllocationEntry[]) {
  // Get all unique week labels across all allocations
  const weeks: string[] = [];
  const today = new Date();
  for (let i = -4; i < 12; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i * 7);
    weeks.push(d.toISOString().slice(0, 10));
  }

  const data: [number, number, number][] = [];
  employees.forEach((emp, yi) => {
    weeks.forEach((week, xi) => {
      const weekDate = new Date(week);
      let pct = 0;
      emp.allocations.forEach(a => {
        if (new Date(a.start) <= weekDate && weekDate <= new Date(a.end)) pct += a.allocation;
      });
      data.push([xi, yi, Math.min(pct, 150)]);
    });
  });

  return { weeks, data };
}

export default function ResourceHeatmap({ employees, employeeNames = {}, title = 'Resource Utilisation' }: Props) {
  const { weeks, data } = buildHeatmapData(employees);
  const yLabels = employees.map(e => employeeNames[e.employeeId] ?? e.employeeId.slice(0, 8));
  const height = Math.max(200, yLabels.length * 30 + 80);

  const option = {
    backgroundColor: 'transparent',
    title: { text: title, textStyle: { color: 'hsl(215, 25%, 92%)', fontSize: 13, fontWeight: 600 } },
    tooltip: {
      formatter: (p: any) => {
        const emp = employees[p.value[1]];
        const pct = p.value[2];
        return `<b>${yLabels[p.value[1]]}</b><br/>${weeks[p.value[0]]}<br/>Allocation: <b style="color:${pct > 100 ? '#f43f5e' : '#10b981'}">${pct}%</b>`;
      },
      backgroundColor: 'hsl(222, 13%, 14%)',
      borderColor: 'hsl(222, 12%, 24%)',
      textStyle: { color: 'hsl(215, 25%, 92%)', fontSize: 11 },
    },
    grid: { top: 50, bottom: 40, left: 90, right: 20 },
    xAxis: {
      type: 'category',
      data: weeks.map(w => w.slice(5)),
      axisLabel: { color: 'hsl(215, 15%, 55%)', fontSize: 9, rotate: 30 },
      axisLine: { show: false }, axisTick: { show: false },
    },
    yAxis: {
      type: 'category',
      data: yLabels,
      axisLabel: { color: 'hsl(215, 15%, 55%)', fontSize: 10 },
      axisLine: { show: false }, axisTick: { show: false },
    },
    visualMap: {
      min: 0, max: 150,
      calculable: true,
      orient: 'horizontal', bottom: 0, left: 'center',
      textStyle: { color: 'hsl(215, 15%, 55%)', fontSize: 10 },
      inRange: { color: ['hsl(222,13%,18%)', '#6366f1', '#f59e0b', '#f43f5e'] },
    },
    series: [{
      type: 'heatmap', data,
      label: { show: true, color: '#fff', fontSize: 9, formatter: (p: any) => p.value[2] > 0 ? `${p.value[2]}%` : '' },
      itemStyle: { borderRadius: 3, borderWidth: 2, borderColor: 'hsl(222, 13%, 10%)' },
      emphasis: { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.4)' } },
    }],
  };

  return (
    <div className="card">
      {employees.length === 0 ? (
        <p style={{ textAlign: 'center', padding: '2rem', color: 'hsl(215 15% 55%)', fontSize: '0.85rem' }}>
          No resource allocations found.
        </p>
      ) : (
        <>
          <ReactECharts option={option} style={{ height, width: '100%' }} />
          {/* Over-allocation warnings */}
          {employees.filter(e => e.isOverAllocated).length > 0 && (
            <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: 'hsl(4 86% 58% / 0.1)', border: '1px solid hsl(4 86% 58% / 0.3)', borderRadius: 6, fontSize: '0.78rem', color: '#f87171' }}>
              ⚠ {employees.filter(e => e.isOverAllocated).length} employee(s) are over-allocated (&gt;100%)
            </div>
          )}
        </>
      )}
    </div>
  );
}
