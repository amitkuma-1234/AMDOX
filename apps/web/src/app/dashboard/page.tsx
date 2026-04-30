'use client';

import { useState, useEffect } from 'react';
import { format, subDays, startOfYear } from 'date-fns';
import { RefreshCw, Download, Plus, Wifi, WifiOff } from 'lucide-react';
import { useDashboardMetrics } from '@/hooks/useDashboard';
import { useSSEMetrics } from '@/hooks/useSSEMetrics';
import DateRangePicker, { type DateRange } from '@/components/dashboard/DateRangePicker';
import KPICard from '@/components/dashboard/widgets/KPICard';
import BarChartWidget from '@/components/dashboard/widgets/BarChartWidget';
import LineChartWidget from '@/components/dashboard/widgets/LineChartWidget';
import PieChartWidget from '@/components/dashboard/widgets/PieChartWidget';

// ── Demo data (used until real API is available) ──────────────
const DEMO_CASH_FLOW = Array.from({ length: 12 }, (_, i) => ({
  name: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i],
  inflow: Math.round(80000 + Math.random() * 40000),
  outflow: Math.round(60000 + Math.random() * 30000),
}));

const DEMO_ACCOUNT_TYPES = [
  { name: 'Assets',      value: 520000 },
  { name: 'Liabilities', value: 280000 },
  { name: 'Revenue',     value: 340000 },
  { name: 'Expenses',    value: 195000 },
];

const TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID ?? 'demo-tenant';

export default function DashboardPage() {
  const [dateRange, setDateRange] = useState<DateRange>({
    label: 'Year to date',
    startDate: format(startOfYear(new Date()), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
  });

  const { financial, hr, scm, loading, error, refresh } = useDashboardMetrics(TENANT_ID);
  const { connected, lastUpdate } = useSSEMetrics(TENANT_ID);

  // Initial load
  useEffect(() => { refresh(dateRange.startDate, dateRange.endDate); }, []);

  // Refresh when SSE pushes an update
  useEffect(() => {
    if (lastUpdate) refresh(dateRange.startDate, dateRange.endDate);
  }, [lastUpdate]);

  const handleDateChange = (range: DateRange) => {
    setDateRange(range);
    refresh(range.startDate, range.endDate);
  };

  // Compute KPIs
  const netIncome = financial?.pl_summary?.net_income ?? 0;
  const totalAssets = financial?.gl_balances?.total_assets ?? 0;
  const headcount = hr?.headcount?.total ?? 0;
  const inventoryValue = scm?.inventory?.total_value ?? 0;
  const lowStock = scm?.inventory?.low_stock ?? 0;

  // Account breakdown for bar chart
  const accountBreakdown = financial?.account_breakdown?.slice(0, 8) ?? [];

  return (
    <div style={{ padding: '1.5rem 2rem', maxWidth: 1440, margin: '0 auto' }}>

      {/* ── Header ──────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Business Intelligence Dashboard</h1>
          <p style={{ color: 'hsl(215 15% 55%)', fontSize: '0.85rem', marginTop: 2 }}>
            Real-time metrics across Finance, HR & Supply Chain
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* SSE connection badge */}
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', color: connected ? '#10b981' : 'hsl(215 15% 55%)' }}>
            {connected ? <Wifi size={13} /> : <WifiOff size={13} />}
            {connected ? 'Live' : 'Polling'}
          </span>

          <DateRangePicker value={dateRange} onChange={handleDateChange} />

          <button
            className="btn btn-ghost"
            onClick={() => refresh(dateRange.startDate, dateRange.endDate)}
            style={{ gap: 6 }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            {loading ? 'Loading…' : 'Refresh'}
          </button>

          <button className="btn btn-primary" style={{ gap: 6 }}>
            <Download size={14} />
            Export
          </button>
        </div>
      </div>

      {/* ── Error banner ─────────────────────────────────── */}
      {error && (
        <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', borderRadius: 8, background: 'hsl(4 86% 58% / 0.1)', border: '1px solid hsl(4 86% 58% / 0.3)', color: '#f87171', fontSize: '0.82rem' }}>
          ⚠ {error} — showing demo data
        </div>
      )}

      {/* ── KPI Cards ────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <KPICard
          title="Net Income"
          value={netIncome}
          prefix="$"
          change={12.4}
          sparkline={[40, 55, 48, 62, 71, 58, 80, 72, 85, 91, 78, 95]}
          color="#10b981"
        />
        <KPICard
          title="Total Assets"
          value={totalAssets}
          prefix="$"
          change={8.1}
          sparkline={[120, 135, 148, 152, 160, 155, 170, 178, 185, 190]}
          color="#6366f1"
        />
        <KPICard
          title="Headcount"
          value={headcount}
          change={2.3}
          subtitle={`${hr?.headcount?.active ?? 0} active`}
          color="#22d3ee"
        />
        <KPICard
          title="Inventory Value"
          value={inventoryValue}
          prefix="$"
          change={-3.8}
          subtitle={`${lowStock} low stock`}
          color="#f59e0b"
        />
      </div>

      {/* ── Charts Row 1 ─────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <LineChartWidget
          title="Cash Flow — Inflow vs Outflow"
          data={DEMO_CASH_FLOW}
          xKey="name"
          lines={[
            { key: 'inflow', color: '#10b981', label: 'Inflow' },
            { key: 'outflow', color: '#f43f5e', label: 'Outflow' },
          ]}
          height={220}
        />
        <PieChartWidget
          title="GL Balance by Account Type"
          data={accountBreakdown.length ? accountBreakdown.map((a: any) => ({ name: a.name, value: Number(a.balance) })) : DEMO_ACCOUNT_TYPES}
          height={220}
          innerRadius={55}
        />
      </div>

      {/* ── Charts Row 2 ─────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <BarChartWidget
          title="Department Headcount & Payroll"
          data={(hr?.department_breakdown ?? [
            { department: 'Engineering', headcount: 12, payroll: 180000 },
            { department: 'Finance', headcount: 6, payroll: 90000 },
            { department: 'Operations', headcount: 8, payroll: 95000 },
            { department: 'HR', headcount: 4, payroll: 55000 },
          ]).map((d: any) => ({ name: d.department, Headcount: d.headcount }))}
          xKey="name"
          height={200}
        />
        <BarChartWidget
          title="Purchase Orders by Status"
          data={[
            { name: 'Pending', count: scm?.purchase_orders?.pending ?? 14 },
            { name: 'Approved', count: scm?.purchase_orders?.approved ?? 28 },
            { name: 'Received', count: 9 },
            { name: 'Cancelled', count: 3 },
          ]}
          bars={[{ key: 'count', color: '#6366f1', label: 'POs' }]}
          xKey="name"
          height={200}
        />
      </div>

    </div>
  );
}
