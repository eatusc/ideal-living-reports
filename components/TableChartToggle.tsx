'use client';

import { useState, type ReactNode } from 'react';

interface TableChartToggleProps {
  tableContent: ReactNode;
  chartContent: ReactNode;
  accentColor?: string;
}

export default function TableChartToggle({
  tableContent,
  chartContent,
  accentColor = '#FFC220',
}: TableChartToggleProps) {
  const [view, setView] = useState<'table' | 'chart'>('table');

  return (
    <div>
      <div className="flex gap-1 mb-3">
        <button
          onClick={() => setView('table')}
          className={`px-3 py-1.5 rounded text-[11px] font-semibold uppercase tracking-[0.8px] transition-colors ${
            view === 'table'
              ? 'text-white'
              : 'bg-transparent text-gray-500 hover:text-gray-300'
          }`}
          style={view === 'table' ? { backgroundColor: `${accentColor}20`, color: accentColor } : undefined}
        >
          Table
        </button>
        <button
          onClick={() => setView('chart')}
          className={`px-3 py-1.5 rounded text-[11px] font-semibold uppercase tracking-[0.8px] transition-colors ${
            view === 'chart'
              ? 'text-white'
              : 'bg-transparent text-gray-500 hover:text-gray-300'
          }`}
          style={view === 'chart' ? { backgroundColor: `${accentColor}20`, color: accentColor } : undefined}
        >
          Chart
        </button>
      </div>
      {view === 'table' ? tableContent : chartContent}
    </div>
  );
}
