'use client';

import { useState, type ReactNode } from 'react';

interface CollapsibleSectionProps {
  /** Summary shown when collapsed (and always visible above expanded content) */
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}

export default function CollapsibleSection({ summary, children, defaultOpen = false }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-dash-card border border-white/[0.08] rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors cursor-pointer"
      >
        <div className="flex-1 min-w-0">{summary}</div>
        <svg
          className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="border-t border-white/[0.08]">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Expandable Table Row ────────────────────────────────────────────────────

interface ExpandableRowProps {
  rowClassName: string;
  cells: ReactNode;
  expandedContent: ReactNode;
  colSpan: number;
}

export function ExpandableRow({ rowClassName, cells, expandedContent, colSpan }: ExpandableRowProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <tr
        className={`${rowClassName} cursor-pointer select-none`}
        onClick={() => setOpen((v) => !v)}
      >
        {cells}
      </tr>
      {open && (
        <tr className="bg-white/[0.01]">
          <td colSpan={colSpan} className="px-0 py-0">
            <div className="border-t border-white/[0.04] px-4 py-3">
              {expandedContent}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
