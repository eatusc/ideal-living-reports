'use client';

import { useMemo, useState } from 'react';

type CellType = 'text' | 'number' | 'currency' | 'percent' | 'roas' | 'peak_reason' | 'asin_link';

interface ColumnDef {
  key: string;
  label: string;
  align?: 'left' | 'right';
  type?: CellType;
}

interface SortableTableProps {
  columns: ColumnDef[];
  rows: Array<Record<string, string | number | null | undefined>>;
  rowKey: string;
  maxRows?: number;
  defaultSortKey?: string;
  defaultSortDir?: 'asc' | 'desc';
  pageSize?: number;
}

function fmtMoney(v: number): string {
  return `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function fmtPct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

function fmtRoas(v: number): string {
  return `${v.toFixed(2)}x`;
}

function fmtNum(v: number): string {
  return Math.round(v).toLocaleString('en-US');
}

function renderCell(type: CellType, val: string | number | null | undefined) {
  if (val === null || val === undefined || val === '') return '—';
  if (typeof val === 'string') return val;
  if (type === 'currency') return fmtMoney(val);
  if (type === 'percent') return fmtPct(val);
  if (type === 'roas') return fmtRoas(val);
  if (type === 'number') return fmtNum(val);
  return String(val);
}

function compareValues(a: string | number | null | undefined, b: string | number | null | undefined) {
  const av = a ?? '';
  const bv = b ?? '';
  if (typeof av === 'number' && typeof bv === 'number') return av - bv;
  return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' });
}

export default function SortableTable({
  columns,
  rows,
  rowKey,
  maxRows,
  defaultSortKey,
  defaultSortDir = 'desc',
  pageSize,
}: SortableTableProps) {
  const [sortKey, setSortKey] = useState<string>(defaultSortKey ?? columns[0]?.key ?? '');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(defaultSortDir);
  const [page, setPage] = useState(1);

  const sortedRows = useMemo(() => {
    const next = [...rows].sort((a, b) => compareValues(a[sortKey], b[sortKey]));
    if (sortDir === 'desc') next.reverse();
    return typeof maxRows === 'number' ? next.slice(0, maxRows) : next;
  }, [rows, sortKey, sortDir, maxRows]);

  const totalRows = sortedRows.length;
  const safePageSize = typeof pageSize === 'number' && pageSize > 0 ? Math.floor(pageSize) : null;
  const totalPages = safePageSize ? Math.max(1, Math.ceil(totalRows / safePageSize)) : 1;
  const currentPage = Math.min(page, totalPages);
  const visibleRows = useMemo(() => {
    if (!safePageSize) return sortedRows;
    const start = (currentPage - 1) * safePageSize;
    return sortedRows.slice(start, start + safePageSize);
  }, [sortedRows, safePageSize, currentPage]);

  function onSort(colKey: string) {
    if (sortKey === colKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      setPage(1);
      return;
    }
    setSortKey(colKey);
    setSortDir('desc');
    setPage(1);
  }

  return (
    <div className="table-scroll">
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="bg-dash-card2 border-b border-white/[0.08]">
            {columns.map((c) => (
              <th
                key={c.key}
                className={`${c.align === 'right' ? 'text-right' : 'text-left'} px-3.5 py-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400`}
              >
                <button
                  type="button"
                  onClick={() => onSort(c.key)}
                  className="inline-flex items-center gap-1 hover:text-gray-200 transition-colors"
                >
                  {c.label}
                  <span className="text-[10px]">
                    {sortKey === c.key ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                  </span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((r) => (
            <tr key={String(r[rowKey] ?? Math.random())} className="border-b border-white/[0.05] last:border-0 hover:bg-white/[0.02] transition-colors">
              {columns.map((c) => {
                const val = r[c.key];
                if (c.type === 'peak_reason') {
                  const text = typeof val === 'string' ? val : '';
                  return (
                    <td key={c.key} className="px-3.5 py-2 text-[11px] text-[#C8D5E8]">
                      {text ? (
                        <div className="relative group inline-block">
                          <span
                            tabIndex={0}
                            className="inline-flex items-center rounded border border-amber-400/40 bg-amber-400/10 px-2.5 py-1 text-[12px] font-semibold text-amber-300 cursor-help focus:outline-none focus:ring-1 focus:ring-amber-300/60"
                          >
                            View Cause
                          </span>
                          <div className="hidden group-hover:block group-focus-within:block absolute right-0 top-[115%] z-50 w-[min(90vw,420px)] rounded-md border border-amber-300/40 bg-[#101828] px-4 py-3 text-[13px] leading-relaxed text-amber-100 shadow-xl whitespace-normal">
                            {text}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                  );
                }
                if (c.type === 'asin_link') {
                  const asin = typeof val === 'string' ? val.trim() : '';
                  const looksLikeAsin = /^[A-Z0-9]{10}$/i.test(asin);
                  if (!looksLikeAsin) {
                    return (
                      <td key={c.key} className={`${c.align === 'right' ? 'text-right' : 'text-left'} px-3.5 py-2 font-mono text-[#E8EDF5]`}>
                        {asin || '—'}
                      </td>
                    );
                  }

                  const href = `https://www.amazon.com/dp/${asin.toUpperCase()}`;
                  return (
                    <td key={c.key} className={`${c.align === 'right' ? 'text-right' : 'text-left'} px-3.5 py-2 font-mono text-[#E8EDF5]`}>
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-300 hover:text-blue-200 underline underline-offset-2"
                      >
                        {asin.toUpperCase()}
                      </a>
                    </td>
                  );
                }
                return (
                  <td key={c.key} className={`${c.align === 'right' ? 'text-right' : 'text-left'} px-3.5 py-2 font-mono text-[#E8EDF5]`}>
                    {renderCell(c.type ?? 'text', val)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {safePageSize && totalPages > 1 && (
        <div className="flex items-center justify-between gap-2 px-3.5 py-2 border-t border-white/[0.08] text-[11px] font-mono text-gray-400">
          <span>
            Page {currentPage} / {totalPages} · {totalRows.toLocaleString('en-US')} rows
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="px-2 py-1 rounded border border-white/[0.12] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/[0.04]"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="px-2 py-1 rounded border border-white/[0.12] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/[0.04]"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
