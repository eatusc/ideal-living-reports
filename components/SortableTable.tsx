'use client';

import { useMemo, useState } from 'react';

type CellType = 'text' | 'number' | 'currency' | 'percent' | 'roas' | 'peak_reason';

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
}: SortableTableProps) {
  const [sortKey, setSortKey] = useState<string>(defaultSortKey ?? columns[0]?.key ?? '');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(defaultSortDir);

  const sortedRows = useMemo(() => {
    const next = [...rows].sort((a, b) => compareValues(a[sortKey], b[sortKey]));
    if (sortDir === 'desc') next.reverse();
    return typeof maxRows === 'number' ? next.slice(0, maxRows) : next;
  }, [rows, sortKey, sortDir, maxRows]);

  function onSort(colKey: string) {
    if (sortKey === colKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(colKey);
    setSortDir('desc');
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
          {sortedRows.map((r) => (
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
    </div>
  );
}
