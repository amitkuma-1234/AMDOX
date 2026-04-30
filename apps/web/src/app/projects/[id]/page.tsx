'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, Users, BarChart2 } from 'lucide-react';
import { projectApi } from '@/lib/api';
import dynamic from 'next/dynamic';
import BudgetChart from '@/components/projects/BudgetChart';
import TaskPanel from '@/components/projects/TaskPanel';
import ResourceHeatmap from '@/components/projects/ResourceHeatmap';

const GanttChart = dynamic(() => import('@/components/projects/GanttChart'), { ssr: false });

const STATUS_META: Record<string, { label: string; color: string }> = {
  PLANNING: { label: 'Planning', color: '#6366f1' },
  ACTIVE:   { label: 'Active',   color: '#10b981' },
  ON_HOLD:  { label: 'On Hold',  color: '#f59e0b' },
  CLOSED:   { label: 'Closed',   color: 'hsl(215 15% 55%)' },
  CANCELLED:{ label: 'Cancelled',color: '#f43f5e' },
};

const TABS = ['Gantt', 'Resources', 'Budget'] as const;
type Tab = typeof TABS[number];

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<any>(null);
  const [gantt, setGantt] = useState<any>(null);
  const [utilisation, setUtilisation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<Tab>('Gantt');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [proj, ganttData] = await Promise.all([
        projectApi.get(id),
        projectApi.getGantt(id),
      ]);
      setProject(proj);
      setGantt(ganttData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchUtilisation = async () => {
    try { setUtilisation(await projectApi.getUtilisation(id)); } catch { /* ignore */ }
  };

  useEffect(() => { fetchAll(); fetchUtilisation(); }, [id]);

  if (loading) {
    return (
      <div style={{ padding: '2rem', maxWidth: 1200, margin: '0 auto' }}>
        {[120, 300, 200].map((h, i) => <div key={i} className="skeleton" style={{ height: h, marginBottom: '1rem' }} />)}
      </div>
    );
  }

  if (!project) return (
    <div style={{ padding: '2rem', textAlign: 'center', color: 'hsl(215 15% 55%)' }}>
      Project not found.
    </div>
  );

  const meta = STATUS_META[project.status] ?? STATUS_META.PLANNING;
  const criticalCount = gantt?.criticalPath?.length ?? 0;
  const taskCount = gantt?.tasks?.length ?? 0;

  return (
    <div style={{ padding: '1.5rem 2rem', maxWidth: 1400, margin: '0 auto' }}>

      {/* Breadcrumb & header */}
      <div style={{ marginBottom: '1.25rem' }}>
        <Link href="/projects" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'hsl(215 15% 55%)', fontSize: '0.82rem', textDecoration: 'none', marginBottom: 12 }}>
          <ArrowLeft size={14} /> Back to Projects
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{project.name}</h1>
              <span className="badge" style={{ background: `${meta.color}22`, color: meta.color }}>
                {meta.label}
              </span>
              {criticalCount > 0 && (
                <span className="badge badge-danger">{criticalCount} critical tasks</span>
              )}
            </div>
            {project.description && (
              <p style={{ color: 'hsl(215 15% 55%)', fontSize: '0.85rem' }}>{project.description}</p>
            )}
          </div>
          <button className="btn btn-ghost" onClick={fetchAll} style={{ gap: 6 }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Summary strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Total Tasks', value: taskCount, color: '#6366f1' },
          { label: 'Critical Path', value: criticalCount, color: '#f43f5e' },
          { label: 'Milestones', value: gantt?.milestones?.length ?? 0, color: '#f59e0b' },
          { label: 'Duration (days)', value: gantt?.totalDuration ?? '—', color: '#22d3ee' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card" style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '1.6rem', fontWeight: 700, color }}>{value}</p>
            <p style={{ fontSize: '0.72rem', color: 'hsl(215 15% 55%)', marginTop: 2 }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: '1rem', borderBottom: '1px solid hsl(222 12% 24%)', paddingBottom: '0' }}>
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '0.5rem 1rem', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: '0.85rem', fontWeight: 500,
              color: activeTab === tab ? 'hsl(220 90% 70%)' : 'hsl(215 15% 55%)',
              borderBottom: `2px solid ${activeTab === tab ? 'hsl(220 90% 56%)' : 'transparent'}`,
              marginBottom: -1, transition: 'color 0.15s',
            }}
          >
            {tab === 'Gantt' && '📊'} {tab === 'Resources' && <Users size={13} style={{ display: 'inline', marginRight: 4 }} />} {tab === 'Budget' && <BarChart2 size={13} style={{ display: 'inline', marginRight: 4 }} />}
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'Gantt' && (
        <div className="card" style={{ padding: '1rem', overflowX: 'auto' }}>
          {gantt?.tasks?.length > 0 ? (
            <GanttChart
              tasks={gantt.tasks}
              milestones={gantt.milestones}
              projectStart={project.startDate?.slice(0, 10) ?? gantt.startDate}
              projectEnd={project.endDate?.slice(0, 10) ?? gantt.endDate}
              onTaskClick={setSelectedTask}
            />
          ) : (
            <p style={{ textAlign: 'center', padding: '2rem', color: 'hsl(215 15% 45%)' }}>
              No tasks yet. Add tasks to see the Gantt chart.
            </p>
          )}
        </div>
      )}

      {activeTab === 'Resources' && (
        <ResourceHeatmap
          employees={utilisation?.employees ?? []}
          title="Team Resource Utilisation (weekly)"
        />
      )}

      {activeTab === 'Budget' && (
        <BudgetChart
          budget={Number(project.budget ?? 0)}
          actualSpend={Number(project.actualSpend ?? 0)}
          title="Budget vs Actual Spend"
        />
      )}

      {/* Task panel slide-over */}
      {selectedTask && (
        <TaskPanel
          task={selectedTask}
          projectId={id}
          onClose={() => setSelectedTask(null)}
          onUpdated={() => { setSelectedTask(null); fetchAll(); }}
        />
      )}
    </div>
  );
}
