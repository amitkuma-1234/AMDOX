'use client';

import { useState } from 'react';
import { X, User, Calendar, Clock, Tag, Link } from 'lucide-react';
import { projectApi } from '@/lib/api';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  startDate?: string;
  endDate?: string;
  estimatedHours?: number;
  actualHours?: number;
  assignedTo?: string;
  priority: number;
  dependencies: string[];
  isCritical?: boolean;
  slack?: number;
}

interface Props {
  task: Task | null;
  projectId: string;
  onClose: () => void;
  onUpdated: (updated: Task) => void;
}

const STATUS_OPTIONS = ['OPEN', 'IN_PROGRESS', 'BLOCKED', 'REVIEW', 'CLOSED'];
const STATUS_COLORS: Record<string, string> = {
  OPEN: '#6366f1', IN_PROGRESS: '#22d3ee', BLOCKED: '#f43f5e',
  REVIEW: '#f59e0b', CLOSED: '#10b981',
};

export default function TaskPanel({ task, projectId, onClose, onUpdated }: Props) {
  const [status, setStatus] = useState(task?.status ?? 'OPEN');
  const [actualHours, setActualHours] = useState(String(task?.actualHours ?? 0));
  const [saving, setSaving] = useState(false);

  if (!task) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await projectApi.updateTask(projectId, task.id, {
        status,
        actualHours: Number(actualHours),
      });
      onUpdated(updated);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, value: React.ReactNode, icon?: React.ReactNode) => (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: '0.75rem' }}>
      {icon && <span style={{ color: 'hsl(215 15% 55%)', marginTop: 1, flexShrink: 0 }}>{icon}</span>}
      <div>
        <p style={{ fontSize: '0.7rem', color: 'hsl(215 15% 55%)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{label}</p>
        <div style={{ fontSize: '0.82rem', color: 'hsl(215 25% 85%)' }}>{value}</div>
      </div>
    </div>
  );

  return (
    <>
      {/* Backdrop */}
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200 }} onClick={onClose} />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 400, background: 'hsl(222 13% 12%)',
        borderLeft: '1px solid hsl(222 12% 24%)',
        zIndex: 201, display: 'flex', flexDirection: 'column',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.4)',
      }}>
        {/* Header */}
        <div style={{ padding: '1.25rem', borderBottom: '1px solid hsl(222 12% 24%)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, paddingRight: 12 }}>
            <p style={{ fontSize: '0.7rem', color: 'hsl(215 15% 55%)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Task</p>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, lineHeight: 1.3 }}>{task.title}</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(215 15% 55%)', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
          {/* Status */}
          <div style={{ marginBottom: '1rem' }}>
            <p style={{ fontSize: '0.7rem', color: 'hsl(215 15% 55%)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Status</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {STATUS_OPTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  style={{
                    padding: '3px 10px', borderRadius: 999, border: 'none', cursor: 'pointer',
                    fontSize: '0.72rem', fontWeight: 600,
                    background: status === s ? `${STATUS_COLORS[s]}22` : 'hsl(222 12% 18%)',
                    color: status === s ? STATUS_COLORS[s] : 'hsl(215 15% 55%)',
                    outline: status === s ? `1.5px solid ${STATUS_COLORS[s]}` : '1.5px solid transparent',
                    transition: 'all 0.15s',
                  }}
                >
                  {s.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {task.description && field('Description', task.description)}
          {field('Priority', `P${task.priority}`, <Tag size={14} />)}
          {field('Start Date', task.startDate ?? '—', <Calendar size={14} />)}
          {field('Due Date', task.endDate ?? '—', <Calendar size={14} />)}
          {field('Assigned To', task.assignedTo ?? 'Unassigned', <User size={14} />)}
          {field('Estimated Hours', `${task.estimatedHours ?? 0}h`, <Clock size={14} />)}

          {/* Actual hours input */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '0.7rem', color: 'hsl(215 15% 55%)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
              Actual Hours
            </label>
            <input
              type="number" min={0} value={actualHours}
              onChange={e => setActualHours(e.target.value)}
              style={{
                background: 'hsl(222 12% 18%)', border: '1px solid hsl(222 12% 28%)',
                borderRadius: 6, padding: '0.4rem 0.6rem', color: 'hsl(215 25% 85%)',
                fontSize: '0.82rem', width: '100%',
              }}
            />
          </div>

          {/* Critical path info */}
          {task.isCritical && (
            <div style={{ padding: '0.5rem 0.75rem', background: 'hsl(4 86% 58% / 0.1)', border: '1px solid hsl(4 86% 58% / 0.3)', borderRadius: 6, marginBottom: '1rem', fontSize: '0.78rem', color: '#f87171' }}>
              ⚠ This task is on the <strong>Critical Path</strong> — any delay will delay the project
            </div>
          )}
          {(task.slack ?? 0) > 0 && (
            <div style={{ padding: '0.5rem 0.75rem', background: 'hsl(142 71% 45% / 0.1)', border: '1px solid hsl(142 71% 45% / 0.3)', borderRadius: 6, marginBottom: '1rem', fontSize: '0.78rem', color: '#6ee7b7' }}>
              ✓ Slack: <strong>{task.slack} days</strong> — can slip without impacting project end date
            </div>
          )}

          {/* Dependencies */}
          {task.dependencies.length > 0 && (
            <div>
              <p style={{ fontSize: '0.7rem', color: 'hsl(215 15% 55%)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Dependencies</p>
              {task.dependencies.map(depId => (
                <div key={depId} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'hsl(215 25% 75%)', marginBottom: 4 }}>
                  <Link size={12} />
                  <span style={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>{depId.slice(0, 8)}…</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid hsl(222 12% 24%)', display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </>
  );
}
