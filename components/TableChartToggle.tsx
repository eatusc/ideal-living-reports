'use client';

import { useState, type ReactNode } from 'react';

interface TableChartToggleProps {
  tableContent: ReactNode;
  chartContent: ReactNode;
  impactContent?: ReactNode;
  accentColor?: string;
}

type ViewMode = 'table' | 'chart' | 'impact';

export default function TableChartToggle({
  tableContent,
  chartContent,
  impactContent,
  accentColor = '#FFC220',
}: TableChartToggleProps) {
  const [view, setView] = useState<ViewMode>('table');

  const tabs: { key: ViewMode; label: string; content: ReactNode }[] = [
    { key: 'table', label: 'Table', content: tableContent },
    { key: 'chart', label: 'Chart', content: chartContent },
  ];

  if (impactContent) {
    tabs.push({ key: 'impact', label: 'Impact', content: impactContent });
  }

  return (
    <div>
      <div className="flex gap-1 mb-3">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setView(tab.key)}
            className={`px-3 py-1.5 rounded text-[11px] font-semibold uppercase tracking-[0.8px] transition-colors ${
              view === tab.key
                ? 'text-white'
                : 'bg-transparent text-gray-500 hover:text-gray-300'
            }`}
            style={view === tab.key ? { backgroundColor: `${accentColor}20`, color: accentColor } : undefined}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.find((t) => t.key === view)?.content ?? tableContent}
    </div>
  );
}
