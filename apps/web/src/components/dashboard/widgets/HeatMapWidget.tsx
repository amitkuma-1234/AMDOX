'use client';

import dynamic from 'next/dynamic';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

interface HeatMapData {
  xLabels: string[];   // e.g. days of week
  yLabels: string[];   // e.g. employee names
  values: [number, number, number][]; // [xIdx, yIdx, value]
}

interface Props {
  data: HeatMapData;
  title?: string;
  height?: number;
  valueLabel?: string;
}

export default function HeatMapWidget({ data, title, height = 300, valueLabel = 'Value' }: Props) {
  const max = Math.max(...data.values.map(v => v[2]), 1);

  const option = {
    backgroundColor: 'transparent',
    title: title ? {
      text: title,
      textStyle: { color: 'hsl(215, 25%, 92%)', fontSize: 13, fontWeight: 600 },
      padding: [0, 0, 8, 0],
    } : undefined,
    tooltip: {
      position: 'top',
      backgroundColor: 'hsl(222, 13%, 14%)',
      borderColor: 'hsl(222, 12%, 24%)',
      textStyle: { color: 'hsl(215, 25%, 92%)', fontSize: 11 },
      formatter: (params: any) =>
        `${data.yLabels[params.value[1]]} / ${data.xLabels[params.value[0]]}: <b>${params.value[2]}%</b>`,
    },
    grid: { top: title ? 40 : 10, bottom: 30, left: 80, right: 10 },
    xAxis: {
      type: 'category',
      data: data.xLabels,
      axisLabel: { color: 'hsl(215, 15%, 55%)', fontSize: 11 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'category',
      data: data.yLabels,
      axisLabel: { color: 'hsl(215, 15%, 55%)', fontSize: 11 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    visualMap: {
      min: 0,
      max,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      textStyle: { color: 'hsl(215, 15%, 55%)', fontSize: 10 },
      inRange: { color: ['hsl(222, 13%, 18%)', '#6366f1', '#f43f5e'] },
    },
    series: [{
      type: 'heatmap',
      data: data.values,
      label: { show: true, color: '#fff', fontSize: 10, formatter: (p: any) => `${p.value[2]}%` },
      itemStyle: { borderRadius: 3 },
      emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' } },
    }],
  };

  return (
    <div className="card" style={{ height: height + 60, padding: '1.25rem' }}>
      <ReactECharts option={option} style={{ height, width: '100%' }} theme="dark" />
    </div>
  );
}
