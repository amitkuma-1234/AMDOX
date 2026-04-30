'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

interface Props {
  budget: number;
  actualSpend: number;
  burndownData?: { date: string; budgetLeft: number; actualLeft: number }[];
  title?: string;
}

export default function BudgetChart({ budget, actualSpend, burndownData = [], title = 'Budget vs Actual' }: Props) {
  const remaining = Math.max(0, budget - actualSpend);
  const overrun = Math.max(0, actualSpend - budget);
  const pct = budget > 0 ? (actualSpend / budget) * 100 : 0;
  const isOverBudget = actualSpend > budget;

  const compData = [
    { name: 'Budget', value: budget },
    { name: 'Actual', value: actualSpend },
    { name: 'Remaining', value: remaining },
  ];

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {title && <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>{title}</p>}

      {/* Progress bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.78rem', color: 'hsl(215 15% 55%)' }}>
          <span>Spent: <strong style={{ color: isOverBudget ? '#f43f5e' : '#10b981' }}>${actualSpend.toLocaleString()}</strong></span>
          <span>Budget: <strong style={{ color: 'hsl(215 25% 85%)' }}>${budget.toLocaleString()}</strong></span>
        </div>
        <div style={{ height: 10, background: 'hsl(222 12% 20%)', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${Math.min(pct, 100)}%`,
            background: pct > 100 ? '#f43f5e' : pct > 80 ? '#f59e0b' : '#10b981',
            borderRadius: 999, transition: 'width 0.4s ease',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: '0.72rem', color: 'hsl(215 15% 55%)' }}>
          <span>{pct.toFixed(1)}% consumed</span>
          {isOverBudget
            ? <span style={{ color: '#f43f5e', fontWeight: 600 }}>OVER BUDGET by ${overrun.toLocaleString()}</span>
            : <span>${remaining.toLocaleString()} remaining</span>}
        </div>
      </div>

      {/* Bar chart comparison */}
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={compData} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 12% 24%)" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(215 15% 55%)' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: 'hsl(215 15% 55%)' }} axisLine={false} tickLine={false} width={52} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
          <Tooltip
            contentStyle={{ background: 'hsl(222 13% 14%)', border: '1px solid hsl(222 12% 24%)', borderRadius: 8 }}
            formatter={(v: number) => [`$${v.toLocaleString()}`, '']}
          />
          <ReferenceLine y={budget} stroke="hsl(215 15% 55%)" strokeDasharray="4 4" label={{ value: 'Budget', fill: 'hsl(215 15% 55%)', fontSize: 10 }} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={48}
            fill="#6366f1"
          />
        </BarChart>
      </ResponsiveContainer>

      {/* Burndown chart */}
      {burndownData.length > 0 && (
        <div>
          <p style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: 8, color: 'hsl(215 15% 55%)' }}>Budget Burndown</p>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={burndownData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 12% 24%)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'hsl(215 15% 55%)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: 'hsl(215 15% 55%)' }} axisLine={false} tickLine={false} width={40} />
              <Tooltip contentStyle={{ background: 'hsl(222 13% 14%)', border: '1px solid hsl(222 12% 24%)', borderRadius: 8 }} />
              <Bar dataKey="budgetLeft" name="Budget Remaining" fill="#6366f1" radius={[2, 2, 0, 0]} />
              <Bar dataKey="actualLeft" name="Actual Remaining" fill="#10b981" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
