'use client';

import { useMemo, useState } from 'react';
import { fmtDollar, fmtPct } from '@/lib/formatUtils';

interface AsinRow {
  childAsin: string;
  orderedProductSales: number;
  unitsOrdered: number;
  sessions: number;
  unitSessionPct: number | null;
}

interface ExpandableAsinListProps {
  title: string;
  titleClassName: string;
  rows: AsinRow[];
  mode: 'revenue' | 'conversion';
  initialCount?: number;
}

export default function ExpandableAsinList({
  title,
  titleClassName,
  rows,
  mode,
  initialCount = 5,
}: ExpandableAsinListProps) {
  const [expanded, setExpanded] = useState(false);

  const visibleRows = useMemo(() => {
    if (expanded) return rows;
    return rows.slice(0, initialCount);
  }, [expanded, rows, initialCount]);

  const remaining = Math.max(0, rows.length - initialCount);

  return (
    <div className="bg-dash-card border border-white/[0.08] rounded-lg p-4">
      <div className={`text-[11px] font-bold uppercase tracking-[0.8px] mb-3 ${titleClassName}`}>
        {title}
      </div>

      {rows.length > 0 ? (
        <ul className="space-y-2">
          {visibleRows.map((row) => (
            <li key={`${mode}-${row.childAsin}`} className="text-[13px] text-[#C8D5E8] leading-relaxed">
              <a
                href={`https://www.amazon.com/dp/${row.childAsin}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-blue-300 hover:text-blue-200 underline underline-offset-2"
              >
                {row.childAsin}
              </a>
              <span className="text-gray-400"> · </span>
              {mode === 'revenue' ? (
                <>
                  <span>{fmtDollar(row.orderedProductSales)}</span>
                  <span className="text-gray-400"> · </span>
                  <span>{Math.round(row.unitsOrdered).toLocaleString('en-US')} units</span>
                </>
              ) : (
                <>
                  <span>{fmtPct(row.unitSessionPct)}</span>
                  <span className="text-gray-400"> CVR · </span>
                  <span>{Math.round(row.sessions).toLocaleString('en-US')} sessions</span>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-gray-400">No ASIN rows available.</p>
      )}

      {rows.length > initialCount && (
        <div className="mt-4 pt-3 border-t border-white/[0.08]">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-[11px] font-mono px-2.5 py-1.5 rounded border border-white/[0.15] text-gray-300 hover:text-white hover:border-white/[0.35] transition-colors"
          >
            {expanded ? 'Show less' : `Show more (${remaining})`}
          </button>
        </div>
      )}
    </div>
  );
}
