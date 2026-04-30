'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, FolderOpen, Clock, CheckCircle, AlertTriangle, XCircle, Pause } from 'lucide-react';
import { projectApi } from '@/lib/api';
import { format } from 'date-fns';

const TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID ?? 'demo-tenant';

const STATUS_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  PLANNING:  { label: 'Planning',  color: '#6366f1', icon: <Clock size={12} /> },
  ACTIVE:    { label: 'Active',    color: '#10b981', icon: <CheckCircle size={12} /> },
  ON_HOLD:   { label: 'On Hold',   color: '#f59e0b', icon: <Pause size={12} /> },
  CLOSED:    { label: 'Closed',    color: 'hsl(215 15% 55%)', icon: <CheckCircle size={12} /> },
  CANCELLED: { label: 'Cancelled', color: '#f43f5e', icon: <XCircle size={12} /> },
};

const FILTERS = ['ALL', 'PLANNING', 'ACTIVE', 'ON_HOLD', 'CLOSED', 'CANCELLED'];

// Demo data for when API is unavailable
const DEMO: any[] = [
  { id: 'demo-1', name: 'ERP Phase 3 Implementation', status: 'ACTIVE', startDate: '2026-01-01', endDate: '2026-06-30', budget: 500000, actualSpend: 180000, _count: { tasks: 48, milestones: 6 } },
  { id: 'demo-2', name: 'Cloud Migration',             status: 'PLANNING', startDate: '2026-03-01', endDate: '2026-09-30', budget: 250000, actualSpend: 12000,  _count: { tasks: 22, milestones: 4 } },
  { id: 'demo-3', name: 'SOC 2 Compliance',            status: 'ACTIVE',   startDate: '2026-02-01', endDate: '2026-07-31', budget: 120000, actualSpend: 65000,  _count: { tasks: 31, milestones: 3 } },
  { id: 'demo-4', name: 'Legacy System Sunset',        status: 'ON_HOLD',  startDate: '2025-10-01', endDate: '2026-04-30', budget: 80000,  actualSpend: 45000,  _count: { tasks: 14, milestones: 2 } },
];

export default function ProjectsPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    projectApi.list(TENANT_ID)
      .then(data => setProjects(Array.isArray(data) ? data : DEMO))
      .catch(() => setProjects(DEMO))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'ALL' ? projects : projects.filter(p => p.status === filter);

  return (
    <div style={{ padding: '1.5rem 2rem', maxWidth: 1200, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Projects</h1>
          <p style={{ color: 'hsl(215 15% 55%)', fontSize: '0.85rem', marginTop: 2 }}>
            {filtered.length} project{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)} style={{ gap: 6 }}>
          <Plus size={15} /> New Project
        </button>
      </div>

      {/* Status filters */}
      <div style={{ display: 'flex', gap: 6, marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="btn btn-ghost"
            style={{
              fontSize: '0.78rem', padding: '4px 12px',
              background: filter === f ? 'hsl(220 90% 56% / 0.15)' : 'transparent',
              color: filter === f ? 'hsl(220 90% 70%)' : 'hsl(215 15% 55%)',
              outline: filter === f ? '1px solid hsl(220 90% 56% / 0.4)' : 'none',
            }}
          >
            {f === 'ALL' ? `All (${projects.length})` : STATUS_META[f]?.label ?? f}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {(['PLANNING', 'ACTIVE', 'ON_HOLD', 'CLOSED'] as const).map(s => {
          const count = projects.filter(p => p.status === s).length;
          const meta = STATUS_META[s];
          return (
            <div key={s} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: `${meta.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: meta.color }}>
                {meta.icon}
              </div>
              <div>
                <p style={{ fontSize: '1.4rem', fontWeight: 700, lineHeight: 1 }}>{count}</p>
                <p style={{ fontSize: '0.72rem', color: 'hsl(215 15% 55%)', marginTop: 2 }}>{meta.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Project cards */}
      {loading ? (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 100 }} />)}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '0.875rem' }}>
          {filtered.map(project => {
            const meta = STATUS_META[project.status] ?? STATUS_META.PLANNING;
            const budgetPct = project.budget > 0 ? (Number(project.actualSpend) / Number(project.budget)) * 100 : 0;
            const overBudget = budgetPct > 100;

            return (
              <Link key={project.id} href={`/projects/${project.id}`} style={{ textDecoration: 'none' }}>
                <div className="card" style={{ cursor: 'pointer', transition: 'border-color 0.15s, transform 0.1s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'hsl(220 90% 56% / 0.4)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = ''; (e.currentTarget as HTMLElement).style.transform = ''; }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <FolderOpen size={16} color={meta.color} />
                        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'hsl(215 25% 92%)' }}>{project.name}</h3>
                        <span className="badge" style={{ background: `${meta.color}22`, color: meta.color, display: 'flex', alignItems: 'center', gap: 3 }}>
                          {meta.icon} {meta.label}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.78rem', color: 'hsl(215 15% 55%)', flexWrap: 'wrap' }}>
                        <span>📅 {format(new Date(project.startDate), 'MMM d, yyyy')} → {project.endDate ? format(new Date(project.endDate), 'MMM d, yyyy') : 'TBD'}</span>
                        <span>✓ {project._count?.tasks ?? 0} tasks</span>
                        <span>🏁 {project._count?.milestones ?? 0} milestones</span>
                      </div>
                    </div>

                    {/* Budget */}
                    {project.budget && (
                      <div style={{ minWidth: 180 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'hsl(215 15% 55%)', marginBottom: 4 }}>
                          <span>Budget</span>
                          <span style={{ color: overBudget ? '#f43f5e' : 'hsl(215 25% 75%)' }}>
                            ${Number(project.actualSpend).toLocaleString()} / ${Number(project.budget).toLocaleString()}
                          </span>
                        </div>
                        <div style={{ height: 6, background: 'hsl(222 12% 20%)', borderRadius: 999, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.min(budgetPct, 100)}%`, background: overBudget ? '#f43f5e' : budgetPct > 80 ? '#f59e0b' : '#10b981', borderRadius: 999 }} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'hsl(215 15% 45%)', fontSize: '0.85rem' }}>
              No projects found for this filter.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
