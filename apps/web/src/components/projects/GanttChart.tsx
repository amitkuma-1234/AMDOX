'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface GanttTask {
  id: string;
  title: string;
  startDate: string | null;
  endDate: string | null;
  status: string;
  assignedTo: string | null;
  parentTaskId: string | null;
  isCritical: boolean;
  slack: number;
  dependencies: string[];
}

interface Milestone {
  id: string;
  name: string;
  dueDate: string;
  status: string;
}

interface Props {
  tasks: GanttTask[];
  milestones?: Milestone[];
  projectStart: string;
  projectEnd?: string;
  onTaskClick?: (task: GanttTask) => void;
}

const STATUS_COLORS: Record<string, string> = {
  OPEN: '#6366f1',
  IN_PROGRESS: '#22d3ee',
  BLOCKED: '#f43f5e',
  REVIEW: '#f59e0b',
  CLOSED: '#10b981',
};

const ROW_H = 36;
const LABEL_W = 220;
const HEADER_H = 48;
const PADDING = 12;

export default function GanttChart({ tasks, milestones = [], projectStart, projectEnd, onTaskClick }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; task: GanttTask } | null>(null);

  useEffect(() => {
    if (!svgRef.current || tasks.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // ── Time domain ────────────────────────────────────────
    const allDates = [
      projectStart,
      projectEnd,
      ...tasks.map(t => t.startDate).filter(Boolean),
      ...tasks.map(t => t.endDate).filter(Boolean),
      ...milestones.map(m => m.dueDate),
    ].filter(Boolean).map(d => new Date(d!));

    const domainStart = d3.min(allDates) ?? new Date(projectStart);
    const domainEnd = d3.max(allDates) ?? new Date();

    const width = svgRef.current.clientWidth || 900;
    const chartW = width - LABEL_W - PADDING * 2;
    const height = HEADER_H + tasks.length * ROW_H + PADDING * 2;
    svgRef.current.setAttribute('height', String(height));

    const xScale = d3.scaleTime()
      .domain([domainStart, domainEnd])
      .range([0, chartW]);

    // ── Header (time axis) ─────────────────────────────────
    const headerG = svg.append('g').attr('transform', `translate(${LABEL_W + PADDING}, 0)`);
    headerG.append('rect').attr('width', chartW).attr('height', HEADER_H).attr('fill', 'hsl(222, 13%, 14%)');

    const axis = d3.axisTop(xScale)
      .ticks(d3.timeWeek.every(2))
      .tickFormat(d3.timeFormat('%b %d') as any);

    headerG.append('g')
      .attr('transform', `translate(0, ${HEADER_H})`)
      .call(axis)
      .call(g => {
        g.select('.domain').remove();
        g.selectAll('text').attr('fill', 'hsl(215, 15%, 55%)').attr('font-size', 10);
        g.selectAll('.tick line').attr('stroke', 'hsl(222, 12%, 24%)');
      });

    // ── Grid lines ─────────────────────────────────────────
    const gridG = svg.append('g').attr('transform', `translate(${LABEL_W + PADDING}, ${HEADER_H})`);
    xScale.ticks(d3.timeWeek.every(2)).forEach(tick => {
      gridG.append('line')
        .attr('x1', xScale(tick)).attr('x2', xScale(tick))
        .attr('y1', 0).attr('y2', tasks.length * ROW_H)
        .attr('stroke', 'hsl(222, 12%, 20%)').attr('stroke-dasharray', '3,3');
    });

    // ── Task rows ──────────────────────────────────────────
    tasks.forEach((task, i) => {
      const y = HEADER_H + i * ROW_H;
      const rowG = svg.append('g');

      // Row background (alternating)
      rowG.append('rect')
        .attr('x', 0).attr('y', y)
        .attr('width', width).attr('height', ROW_H)
        .attr('fill', i % 2 === 0 ? 'hsl(222, 13%, 12%)' : 'hsl(222, 13%, 10%)')
        .attr('opacity', 0.6);

      // Task label
      const indent = task.parentTaskId ? 20 : 0;
      rowG.append('text')
        .attr('x', PADDING + indent)
        .attr('y', y + ROW_H / 2 + 4)
        .attr('font-size', 11)
        .attr('fill', task.isCritical ? '#f43f5e' : 'hsl(215, 25%, 85%)')
        .attr('font-weight', task.parentTaskId ? 400 : 600)
        .text(task.title.length > 22 ? task.title.slice(0, 21) + '…' : task.title);

      if (!task.startDate || !task.endDate) return;

      const barX = xScale(new Date(task.startDate));
      const barW = Math.max(6, xScale(new Date(task.endDate)) - barX);
      const barY = y + 6;
      const barH = ROW_H - 12;
      const color = task.isCritical ? '#f43f5e' : (STATUS_COLORS[task.status] ?? '#6366f1');

      // Bar
      const barG = rowG.append('g')
        .attr('transform', `translate(${LABEL_W + PADDING}, 0)`)
        .style('cursor', 'pointer')
        .on('click', () => onTaskClick?.(task))
        .on('mouseenter', (event) => {
          setTooltip({ x: event.clientX, y: event.clientY, task });
          d3.select(event.currentTarget).select('rect').attr('opacity', 0.75);
        })
        .on('mouseleave', () => {
          setTooltip(null);
          d3.select(event.currentTarget as any).select('rect').attr('opacity', 1);
        });

      barG.append('rect')
        .attr('x', barX).attr('y', barY)
        .attr('width', barW).attr('height', barH)
        .attr('rx', 4).attr('fill', color).attr('opacity', 1);

      // Progress fill (based on status)
      if (task.status === 'CLOSED') {
        barG.append('rect')
          .attr('x', barX).attr('y', barY)
          .attr('width', barW).attr('height', barH)
          .attr('rx', 4).attr('fill', '#10b981').attr('opacity', 0.3);
      }

      // Label inside bar
      if (barW > 50) {
        barG.append('text')
          .attr('x', barX + 6).attr('y', barY + barH / 2 + 4)
          .attr('font-size', 9).attr('fill', '#fff').attr('pointer-events', 'none')
          .text(task.title.length > 18 ? task.title.slice(0, 17) + '…' : task.title);
      }
    });

    // ── Milestones ─────────────────────────────────────────
    milestones.forEach(m => {
      const mx = xScale(new Date(m.dueDate)) + LABEL_W + PADDING;
      const my = HEADER_H;
      const diamond = svg.append('g').attr('transform', `translate(${mx}, ${my})`);
      diamond.append('polygon')
        .attr('points', '0,-8 8,0 0,8 -8,0')
        .attr('fill', '#f59e0b').attr('opacity', 0.9);
      diamond.append('text')
        .attr('y', 20).attr('font-size', 9)
        .attr('fill', '#f59e0b').attr('text-anchor', 'middle')
        .text(m.name.slice(0, 14));
    });

  }, [tasks, milestones, projectStart, projectEnd]);

  return (
    <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
      <svg ref={svgRef} width="100%" style={{ display: 'block', minWidth: 600 }} />

      {/* Tooltip */}
      {tooltip && (
        <div style={{
          position: 'fixed',
          top: tooltip.y + 12,
          left: tooltip.x + 12,
          zIndex: 100,
          background: 'hsl(222 13% 14%)',
          border: '1px solid hsl(222 12% 24%)',
          borderRadius: 8,
          padding: '0.6rem 0.9rem',
          fontSize: '0.78rem',
          pointerEvents: 'none',
          maxWidth: 240,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        }}>
          <p style={{ fontWeight: 600, marginBottom: 4, color: 'hsl(215 25% 92%)' }}>{tooltip.task.title}</p>
          <p style={{ color: 'hsl(215 15% 55%)' }}>Status: <span style={{ color: 'hsl(215 25% 85%)' }}>{tooltip.task.status}</span></p>
          <p style={{ color: 'hsl(215 15% 55%)' }}>Start: <span style={{ color: 'hsl(215 25% 85%)' }}>{tooltip.task.startDate}</span></p>
          <p style={{ color: 'hsl(215 15% 55%)' }}>End: <span style={{ color: 'hsl(215 25% 85%)' }}>{tooltip.task.endDate}</span></p>
          {tooltip.task.isCritical && (
            <p style={{ color: '#f43f5e', fontWeight: 600, marginTop: 4 }}>⚠ Critical Path</p>
          )}
          {tooltip.task.slack > 0 && (
            <p style={{ color: 'hsl(215 15% 55%)' }}>Slack: <span style={{ color: 'hsl(215 25% 85%)' }}>{tooltip.task.slack}d</span></p>
          )}
        </div>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, padding: '0.5rem 0', flexWrap: 'wrap', fontSize: '0.75rem', color: 'hsl(215 15% 55%)' }}>
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <span key={status} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: 'inline-block' }} />
            {status.replace('_', ' ')}
          </span>
        ))}
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#f43f5e', display: 'inline-block' }} />
          CRITICAL PATH
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, background: '#f59e0b', clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)', display: 'inline-block' }} />
          MILESTONE
        </span>
      </div>
    </div>
  );
}
