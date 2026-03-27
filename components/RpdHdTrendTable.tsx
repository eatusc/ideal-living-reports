'use client';

import { Fragment, useState } from 'react';
import { wowPct, fmtDollar, fmtPct, fmtRoas } from '@/lib/formatUtils';
import type { RpdHdWeekData } from '@/lib/formatUtils';
import SortableTable from '@/components/SortableTable';

function formatNumber(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

function wowArrow(pct: number | null, invertGood = false) {
  if (pct === null) return { symbol: '—', label: 'N/A', cls: 'text-gray-500' };
  const up = pct >= 0;
  const good = invertGood ? !up : up;
  return {
    symbol: up ? '↑' : '↓',
    label: `${up ? '+' : ''}${(pct * 100).toFixed(1)}%`,
    cls: good ? 'text-green-400' : 'text-red-400',
  };
}

function acosColor(acos: number | null): string {
  if (acos === null) return 'text-gray-500';
  if (acos < 0.35) return 'text-green-400';
  if (acos <= 0.55) return 'text-amber-400';
  return 'text-red-400';
}

interface DscoEntry { sales: number; units: number }

export default function RpdHdTrendTable({
  displayWeeks,
  currentLabel,
  dscoByDate,
  dscoByLabel,
}: {
  displayWeeks: RpdHdWeekData[];
  currentLabel: string;
  dscoByDate: Record<string, DscoEntry>;
  dscoByLabel?: Record<string, DscoEntry>;
}) {
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<string>('order');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Lookup DSCO data by startDate first, then fall back to label
  const lookupDsco = (week: RpdHdWeekData): DscoEntry | undefined => {
    if (week.startDate && dscoByDate[week.startDate]) return dscoByDate[week.startDate];
    if (dscoByLabel && dscoByLabel[week.label]) return dscoByLabel[week.label];
    return undefined;
  };

  const trendWeeks = displayWeeks.map((week, i) => {
    const prevWeek = i > 0 ? displayWeeks[i - 1] : null;
    const dsco = lookupDsco(week);
    const prevDsco = prevWeek ? lookupDsco(prevWeek) : undefined;
    const rowSales = dsco?.sales ?? null;
    const rowUnits = dsco?.units ?? null;
    const rowOrganic = dsco != null ? Math.max(0, dsco.sales - week.adSales) : null;
    const prevOrganic = prevDsco != null && prevWeek ? Math.max(0, prevDsco.sales - prevWeek.adSales) : null;
    return {
      ...week,
      order: i,
      rowSales,
      rowUnits,
      rowOrganic,
      salesWow: rowSales !== null && prevDsco ? wowPct(rowSales, prevDsco.sales) : null,
      adSpendWow: prevWeek ? wowPct(week.adSpend, prevWeek.adSpend) : null,
      organicWow: rowOrganic !== null && prevOrganic !== null ? wowPct(rowOrganic, prevOrganic) : null,
    };
  });

  const sortedWeeks = [...trendWeeks].sort((a, b) => {
    const av = a[sortKey as keyof typeof a] as string | number | null | undefined;
    const bv = b[sortKey as keyof typeof b] as string | number | null | undefined;
    if (av === bv) return 0;
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
    const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' });
    return sortDir === 'asc' ? cmp : -cmp;
  });

  function onSort(nextKey: string) {
    if (sortKey === nextKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(nextKey);
    setSortDir(nextKey === 'order' ? 'asc' : 'desc');
  }

  const headers: Array<{ key: string; label: string; sublabel?: string; align?: 'left' | 'right' }> = [
    { key: 'label', label: 'Week', align: 'left' },
    { key: 'rowSales', label: 'Total Sales', sublabel: 'HD US + HD Canada (DSCO)' },
    { key: 'salesWow', label: 'Sales WoW' },
    { key: 'rowUnits', label: 'Units', sublabel: 'HD US + HD Canada (DSCO)' },
    { key: 'adSpend', label: 'Ad Spend', sublabel: 'Orange Access' },
    { key: 'adSpendWow', label: 'Spend WoW' },
    { key: 'adSales', label: 'Ad Sales', sublabel: 'Orange Access' },
    { key: 'acos', label: 'ACoS', sublabel: 'Orange Access' },
    { key: 'roas', label: 'ROAS', sublabel: 'Orange Access' },
    { key: 'rowOrganic', label: 'Organic Sales', sublabel: 'DSCO − OA Ad Sales' },
    { key: 'organicWow', label: 'Organic WoW' },
  ];

  const colCount = 11;

  return (
    <div className="bg-dash-card border border-white/[0.08] rounded-lg overflow-hidden">
      <div className="table-scroll">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="bg-dash-card2 border-b border-white/[0.08]">
              {headers.map((h) => (
                <th key={h.key} className={`${h.align === 'left' ? 'text-left' : 'text-right'} px-3.5 py-2.5 whitespace-nowrap`}>
                  <button type="button" onClick={() => onSort(h.key)} className="inline-flex items-center gap-1 hover:text-gray-200 transition-colors">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.8px] text-gray-400">{h.label}</span>
                    <span className="text-[10px] text-gray-400">{sortKey === h.key ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
                  </button>
                  {h.sublabel && <div className="text-[9px] text-gray-600 normal-case tracking-normal font-normal">{h.sublabel}</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedWeeks.map((week) => {
              const isCurrent = week.label === currentLabel;
              const isExpanded = expandedWeek === week.label;
              const hasGroups = week.groups.length > 0;
              const rowCls = isCurrent ? 'bg-[#F96302]/10 border-b border-white/[0.08]' : 'border-b border-white/[0.05] hover:bg-white/[0.02] transition-colors';
              const cellCls = isCurrent ? 'text-orange-200 font-semibold' : 'text-[#E8EDF5]';
              const sWow = wowArrow(week.salesWow);
              const spWow = wowArrow(week.adSpendWow, true);
              const oWow = wowArrow(week.organicWow);

              return (
                <Fragment key={week.label}>
                  <tr
                    className={`${rowCls} ${hasGroups ? 'cursor-pointer select-none' : ''}`}
                    onClick={() => hasGroups && setExpandedWeek(isExpanded ? null : week.label)}
                  >
                    <td className={`px-3.5 py-2.5 font-sans font-medium text-[13px] whitespace-nowrap ${isCurrent ? 'text-orange-400 font-semibold' : 'text-white'}`}>
                      <span className="inline-flex items-center gap-1.5">
                        {hasGroups && (
                          <span className={`text-[10px] text-gray-500 transition-transform duration-150 inline-block ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                        )}
                        {isCurrent ? (
                          <span>
                            {week.label}
                            {week.startDate && <span className="block text-[10px] text-gray-500 font-mono font-normal">{week.startDate}{week.endDate && week.endDate !== week.startDate ? ` – ${week.endDate}` : ''}</span>}
                          </span>
                        ) : week.label}
                      </span>
                    </td>
                    <td className={`px-3.5 py-2.5 text-right font-mono ${cellCls}`}>{week.rowSales !== null ? fmtDollar(week.rowSales) : '—'}</td>
                    <td className={`px-3.5 py-2.5 text-right font-mono font-semibold ${sWow.cls}`}>
                      {week.salesWow === null ? '—' : `${sWow.symbol} ${Math.abs(week.salesWow * 100).toFixed(0)}%`}
                    </td>
                    <td className={`px-3.5 py-2.5 text-right font-mono ${cellCls}`}>{week.rowUnits !== null ? formatNumber(week.rowUnits) : '—'}</td>
                    <td className={`px-3.5 py-2.5 text-right font-mono ${cellCls}`}>{fmtDollar(week.adSpend)}</td>
                    <td className={`px-3.5 py-2.5 text-right font-mono font-semibold ${spWow.cls}`}>
                      {week.adSpendWow === null ? '—' : `${spWow.symbol} ${Math.abs(week.adSpendWow * 100).toFixed(0)}%`}
                    </td>
                    <td className={`px-3.5 py-2.5 text-right font-mono ${cellCls}`}>{fmtDollar(week.adSales)}</td>
                    <td className={`px-3.5 py-2.5 text-right font-mono font-semibold ${acosColor(week.acos)}`}>{fmtPct(week.acos)}</td>
                    <td className={`px-3.5 py-2.5 text-right font-mono ${cellCls}`}>{fmtRoas(week.roas)}</td>
                    <td className={`px-3.5 py-2.5 text-right font-mono ${cellCls}`}>{week.rowOrganic !== null ? fmtDollar(week.rowOrganic) : '—'}</td>
                    <td className={`px-3.5 py-2.5 text-right font-mono font-semibold ${oWow.cls}`}>
                      {week.organicWow === null ? '—' : `${oWow.symbol} ${Math.abs(week.organicWow * 100).toFixed(0)}%`}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="bg-[#0D1220]">
                      <td colSpan={colCount} className="px-0 py-0">
                        <div className="px-6 py-3 border-t border-white/[0.04]">
                          <div className="text-[10px] font-semibold uppercase tracking-[1px] text-gray-500 mb-2">
                            Campaign Group Breakdown — {week.label}
                          </div>
                          <SortableTable
                            columns={[
                              { key: 'group', label: 'Campaign Group' },
                              { key: 'adSpend', label: 'Ad Spend', align: 'right', type: 'currency' },
                              { key: 'adSales', label: 'Ad Sales', align: 'right', type: 'currency' },
                              { key: 'acos', label: 'ACoS', align: 'right', type: 'percent' },
                              { key: 'roas', label: 'ROAS', align: 'right', type: 'roas' },
                              { key: 'impressions', label: 'Impressions', align: 'right', type: 'number' },
                            ]}
                            rows={week.groups
                              .filter((g) => g.adSpend > 0 || g.adSales > 0)
                              .map((g) => ({
                                rowId: g.group,
                                group: g.group,
                                adSpend: g.adSpend,
                                adSales: g.adSales,
                                acos: g.acos,
                                roas: g.roas,
                                impressions: g.impressions,
                              }))}
                            rowKey="rowId"
                            defaultSortKey="adSpend"
                            defaultSortDir="desc"
                          />
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
