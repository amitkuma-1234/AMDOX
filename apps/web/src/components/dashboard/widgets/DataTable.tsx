'use client';

import { useState } from 'react';

interface Column<T> {
  key: keyof T;
  label: string;
  render?: (value: any, row: T) => React.ReactNode;
  sortable?: boolean;
}

interface Props<T> {
  data: T[];
  columns: Column<T>[];
  title?: string;
  pageSize?: number;
  onRowClick?: (row: T) => void;
}

export default function DataTable<T extends { id?: string }>({
  data, columns, title, pageSize = 10, onRowClick,
}: Props<T>) {
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<keyof T | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const sorted = sortKey
    ? [...data].sort((a, b) => {
        const av = a[sortKey]; const bv = b[sortKey];
        if (av < bv) return sortDir === 'asc' ? -1 : 1;
        if (av > bv) return sortDir === 'asc' ? 1 : -1;
        return 0;
      })
    : data;

  const sliced = sorted.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(data.length / pageSize);

  const handleSort = (key: keyof T) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
    setPage(0);
  };

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {title && (
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid hsl(222 12% 24%)' }}>
          <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>{title}</p>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <thead>
            <tr>
              {columns.map(col => (
                <th
                  key={String(col.key)}
                  onClick={col.sortable !== false ? () => handleSort(col.key) : undefined}
                  style={{
                    padding: '0.6rem 1rem',
                    textAlign: 'left',
                    color: 'hsl(215 15% 55%)',
                    fontWeight: 600,
                    fontSize: '0.72rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    borderBottom: '1px solid hsl(222 12% 24%)',
                    cursor: col.sortable !== false ? 'pointer' : 'default',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {col.label}
                  {sortKey === col.key && (sortDir === 'asc' ? ' ↑' : ' ↓')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sliced.map((row, i) => (
              <tr
                key={row.id ?? i}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                style={{
                  borderBottom: '1px solid hsl(222 12% 20%)',
                  cursor: onRowClick ? 'pointer' : 'default',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'hsl(222 12% 16%)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {columns.map(col => (
                  <td key={String(col.key)} style={{ padding: '0.6rem 1rem', color: 'hsl(215 25% 85%)' }}>
                    {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
            {sliced.length === 0 && (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', padding: '2rem', color: 'hsl(215 15% 45%)' }}>
                  No data
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1.25rem', borderTop: '1px solid hsl(222 12% 24%)', fontSize: '0.78rem', color: 'hsl(215 15% 55%)' }}>
          <span>Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, data.length)} of {data.length}</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-ghost" style={{ padding: '2px 10px', fontSize: '0.78rem' }} onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>← Prev</button>
            <button className="btn btn-ghost" style={{ padding: '2px 10px', fontSize: '0.78rem' }} onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}>Next →</button>
          </div>
        </div>
      )}
    </div>
  );
}
