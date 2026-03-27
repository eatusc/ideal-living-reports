'use client';

import { Fragment, useState } from 'react';
import { wowPct, fmtDollar, fmtPct, fmtRoas } from '@/lib/formatUtils';
import type { ElevateWeekData, ElevateWalmartWeekData } from '@/lib/formatUtils';

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

// ─── Metric detail card (used in expanded row for Elevate) ──────────────────

function MetricCard({ label, curr, prev, fmt, invert }: {
  label: string;
  curr: number;
  prev: number;
  fmt: (n: number) => string;
  invert?: boolean;
}) {
  const wow = wowPct(curr, prev);
  const arrow = wowArrow(wow, invert);
  return (
    <div className="bg-white/[0.02] rounded px-3 py-2">
      <div className="text-[9px] uppercase tracking-wide text-gray-500 mb-1">{label}</div>
      <div className="font-mono text-[14px] font-bold text-white">{fmt(curr)}</div>
      <div className="flex items-center gap-2 mt-0.5">
        <span className="font-mono text-[10px] text-gray-500">Prev: {fmt(prev)}</span>
        <span className={`font-mono text-[10px] font-semibold ${arrow.cls}`}>
          {wow === null ? '—' : `${arrow.symbol} ${Math.abs(wow * 100).toFixed(0)}%`}
        </span>
      </div>
    </div>
  );
}

// ─── Amazon Trend Table ─────────────────────────────────────────────────────

export function ElevateAmazonTrendTable({ weeks }: { weeks: ElevateWeekData[] }) {
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<string>('order');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const display = weeks.slice(-8);
  const current = display[display.length - 1];

  const trendWeeks = display.map((week, i) => {
    const prevWeek = i > 0 ? display[i - 1] : (weeks.length > display.length ? weeks[weeks.length - display.length - 1] : null);
    return {
      ...week,
      order: i,
      prevWeek,
      salesWow: wowPct(week.sales, prevWeek?.sales ?? 0),
      adSpendWow: wowPct(week.adSpend, prevWeek?.adSpend ?? 0),
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

  const headers: Array<{ key: string; label: string; align?: 'left' | 'right' }> = [
    { key: 'label', label: 'Week', align: 'left' },
    { key: 'sales', label: 'Sales' },
    { key: 'salesWow', label: 'Sales WoW' },
    { key: 'units', label: 'Units' },
    { key: 'orders', label: 'Orders' },
    { key: 'sessions', label: 'Sessions' },
    { key: 'conversionRate', label: 'Conv. Rate' },
    { key: 'adSpend', label: 'Ad Spend' },
    { key: 'adSpendWow', label: 'Spend WoW' },
    { key: 'adSales', label: 'Ad Sales' },
    { key: 'acos', label: 'ACoS' },
    { key: 'roas', label: 'ROAS' },
  ];

  const colCount = 12;

  return (
    <div className="bg-dash-card border border-white/[0.08] rounded-lg overflow-hidden">
      <div className="table-scroll">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="bg-dash-card2 border-b border-white/[0.08]">
              {headers.map((h) => (
                <th key={h.key} className={`${h.align === 'left' ? 'text-left' : 'text-right'} px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.8px] text-gray-400 whitespace-nowrap`}>
                  <button type="button" onClick={() => onSort(h.key)} className="inline-flex items-center gap-1 hover:text-gray-200 transition-colors">
                    {h.label}
                    <span className="text-[10px]">{sortKey === h.key ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedWeeks.map((week) => {
              const isCurrent = week.label === current.label;
              const isExpanded = expandedWeek === week.label;
              const hasPrev = week.prevWeek != null;
              const rowCls = isCurrent ? 'bg-[#FF9900]/10 border-b border-white/[0.08]' : 'border-b border-white/[0.05] hover:bg-white/[0.02] transition-colors';
              const cellCls = isCurrent ? 'text-orange-200 font-semibold' : 'text-[#E8EDF5]';
              const sWow = wowArrow(week.salesWow);
              const spWow = wowArrow(week.adSpendWow, true);

              return (
                <Fragment key={week.label}>
                  <tr
                    className={`${rowCls} ${hasPrev ? 'cursor-pointer select-none' : ''}`}
                    onClick={() => hasPrev && setExpandedWeek(isExpanded ? null : week.label)}
                  >
                    <td className={`px-3.5 py-2.5 font-sans font-medium text-[13px] whitespace-nowrap ${isCurrent ? 'text-orange-400 font-semibold' : 'text-white'}`}>
                      <span className="inline-flex items-center gap-1.5">
                        {hasPrev && (
                          <span className={`text-[10px] text-gray-500 transition-transform duration-150 inline-block ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                        )}
                        {isCurrent ? (
                          <span>
                            ▶ {week.label}
                            {week.startDate && <span className="block text-[10px] text-gray-500 font-mono font-normal">{week.startDate}{week.endDate && week.endDate !== week.startDate ? ` – ${week.endDate}` : ''}</span>}
                          </span>
                        ) : <span>{week.label}</span>}
                      </span>
                    </td>
                    <td className={`px-3.5 py-2.5 text-right font-mono ${cellCls}`}>{fmtDollar(week.sales)}</td>
                    <td className={`px-3.5 py-2.5 text-right font-mono font-semibold ${sWow.cls}`}>
                      {week.salesWow === null ? '—' : `${sWow.symbol} ${Math.abs(week.salesWow * 100).toFixed(0)}%`}
                    </td>
                    <td className={`px-3.5 py-2.5 text-right font-mono ${cellCls}`}>{formatNumber(week.units)}</td>
                    <td className={`px-3.5 py-2.5 text-right font-mono ${cellCls}`}>{formatNumber(week.orders)}</td>
                    <td className={`px-3.5 py-2.5 text-right font-mono ${cellCls}`}>{formatNumber(week.sessions)}</td>
                    <td className={`px-3.5 py-2.5 text-right font-mono ${cellCls}`}>{week.conversionRate !== null ? fmtPct(week.conversionRate) : '—'}</td>
                    <td className={`px-3.5 py-2.5 text-right font-mono ${cellCls}`}>{fmtDollar(week.adSpend)}</td>
                    <td className={`px-3.5 py-2.5 text-right font-mono font-semibold ${spWow.cls}`}>
                      {week.adSpendWow === null ? '—' : `${spWow.symbol} ${Math.abs(week.adSpendWow * 100).toFixed(0)}%`}
                    </td>
                    <td className={`px-3.5 py-2.5 text-right font-mono ${cellCls}`}>{fmtDollar(week.adSales)}</td>
                    <td className={`px-3.5 py-2.5 text-right font-mono font-semibold ${acosColor(week.acos)}`}>{fmtPct(week.acos)}</td>
                    <td className={`px-3.5 py-2.5 text-right font-mono ${cellCls}`}>{fmtRoas(week.roas)}</td>
                  </tr>
                  {isExpanded && week.prevWeek && (
                    <tr className="bg-[#0D1220]">
                      <td colSpan={colCount} className="px-0 py-0">
                        <div className="px-6 py-3 border-t border-white/[0.04]">
                          <div className="text-[10px] font-semibold uppercase tracking-[1px] text-gray-500 mb-2">
                            Week-over-Week Detail — {week.label} vs. Previous
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2">
                            <MetricCard label="Sales" curr={week.sales} prev={week.prevWeek.sales} fmt={fmtDollar} />
                            <MetricCard label="Units" curr={week.units} prev={week.prevWeek.units} fmt={formatNumber} />
                            <MetricCard label="Orders" curr={week.orders} prev={week.prevWeek.orders} fmt={formatNumber} />
                            <MetricCard label="Sessions" curr={week.sessions} prev={week.prevWeek.sessions} fmt={formatNumber} />
                            <MetricCard label="Conv. Rate" curr={week.conversionRate ?? 0} prev={week.prevWeek.conversionRate ?? 0} fmt={(n) => fmtPct(n)} />
                            <MetricCard label="Ad Spend" curr={week.adSpend} prev={week.prevWeek.adSpend} fmt={fmtDollar} invert />
                            <MetricCard label="Ad Sales" curr={week.adSales} prev={week.prevWeek.adSales} fmt={fmtDollar} />
                            <MetricCard label="ACoS" curr={week.acos ?? 0} prev={week.prevWeek.acos ?? 0} fmt={(n) => fmtPct(n)} invert />
                            <MetricCard label="ROAS" curr={week.roas ?? 0} prev={week.prevWeek.roas ?? 0} fmt={(n) => fmtRoas(n)} />
                            <MetricCard label="Impressions" curr={week.impressions} prev={week.prevWeek.impressions} fmt={formatNumber} />
                          </div>
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

// ─── Walmart Trend Table ────────────────────────────────────────────────────

export function ElevateWalmartTrendTable({ weeks }: { weeks: ElevateWalmartWeekData[] }) {
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<string>('order');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const display = weeks.slice(-8);
  const current = display[display.length - 1];

  const trendWeeks = display.map((week, i) => {
    const prevWeek = i > 0 ? display[i - 1] : (weeks.length > display.length ? weeks[weeks.length - display.length - 1] : null);
    return {
      ...week,
      order: i,
      prevWeek,
      salesWow: wowPct(week.sales, prevWeek?.sales ?? 0),
      adSpendWow: wowPct(week.adSpend, prevWeek?.adSpend ?? 0),
      organicWow: wowPct(week.organicSales, prevWeek?.organicSales ?? 0),
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

  const headers: Array<{ key: string; label: string; align?: 'left' | 'right' }> = [
    { key: 'label', label: 'Week', align: 'left' },
    { key: 'sales', label: 'Sales' },
    { key: 'salesWow', label: 'Sales WoW' },
    { key: 'units', label: 'Units' },
    { key: 'adSpend', label: 'Ad Spend' },
    { key: 'adSpendWow', label: 'Spend WoW' },
    { key: 'adSales', label: 'Ad Sales' },
    { key: 'acos', label: 'ACoS' },
    { key: 'roas', label: 'ROAS' },
    { key: 'organicSales', label: 'Organic' },
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
                <th key={h.key} className={`${h.align === 'left' ? 'text-left' : 'text-right'} px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.8px] text-gray-400 whitespace-nowrap`}>
                  <button type="button" onClick={() => onSort(h.key)} className="inline-flex items-center gap-1 hover:text-gray-200 transition-colors">
                    {h.label}
                    <span className="text-[10px]">{sortKey === h.key ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedWeeks.map((week) => {
              const isCurrent = week.label === current.label;
              const isExpanded = expandedWeek === week.label;
              const hasPrev = week.prevWeek != null;
              const rowCls = isCurrent ? 'bg-[#0071CE]/10 border-b border-white/[0.08]' : 'border-b border-white/[0.05] hover:bg-white/[0.02] transition-colors';
              const cellCls = isCurrent ? 'text-blue-200 font-semibold' : 'text-[#E8EDF5]';
              const sWow = wowArrow(week.salesWow);
              const spWow = wowArrow(week.adSpendWow, true);
              const oWow = wowArrow(week.organicWow);

              return (
                <Fragment key={week.label}>
                  <tr
                    className={`${rowCls} ${hasPrev ? 'cursor-pointer select-none' : ''}`}
                    onClick={() => hasPrev && setExpandedWeek(isExpanded ? null : week.label)}
                  >
                    <td className={`px-3.5 py-2.5 font-sans font-medium text-[13px] whitespace-nowrap ${isCurrent ? 'text-blue-400 font-semibold' : 'text-white'}`}>
                      <span className="inline-flex items-center gap-1.5">
                        {hasPrev && (
                          <span className={`text-[10px] text-gray-500 transition-transform duration-150 inline-block ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                        )}
                        {isCurrent ? (
                          <span>
                            ▶ {week.label}
                            {week.startDate && <span className="block text-[10px] text-gray-500 font-mono font-normal">{week.startDate}{week.endDate && week.endDate !== week.startDate ? ` – ${week.endDate}` : ''}</span>}
                          </span>
                        ) : <span>{week.label}</span>}
                      </span>
                    </td>
                    <td className={`px-3.5 py-2.5 text-right font-mono ${cellCls}`}>{fmtDollar(week.sales)}</td>
                    <td className={`px-3.5 py-2.5 text-right font-mono font-semibold ${sWow.cls}`}>
                      {week.salesWow === null ? '—' : `${sWow.symbol} ${Math.abs(week.salesWow * 100).toFixed(0)}%`}
                    </td>
                    <td className={`px-3.5 py-2.5 text-right font-mono ${cellCls}`}>{formatNumber(week.units)}</td>
                    <td className={`px-3.5 py-2.5 text-right font-mono ${cellCls}`}>{fmtDollar(week.adSpend)}</td>
                    <td className={`px-3.5 py-2.5 text-right font-mono font-semibold ${spWow.cls}`}>
                      {week.adSpendWow === null ? '—' : `${spWow.symbol} ${Math.abs(week.adSpendWow * 100).toFixed(0)}%`}
                    </td>
                    <td className={`px-3.5 py-2.5 text-right font-mono ${cellCls}`}>{fmtDollar(week.adSales)}</td>
                    <td className={`px-3.5 py-2.5 text-right font-mono font-semibold ${acosColor(week.acos)}`}>{fmtPct(week.acos)}</td>
                    <td className={`px-3.5 py-2.5 text-right font-mono ${cellCls}`}>{fmtRoas(week.roas)}</td>
                    <td className={`px-3.5 py-2.5 text-right font-mono ${cellCls}`}>{fmtDollar(week.organicSales)}</td>
                    <td className={`px-3.5 py-2.5 text-right font-mono font-semibold ${oWow.cls}`}>
                      {week.organicWow === null ? '—' : `${oWow.symbol} ${Math.abs(week.organicWow * 100).toFixed(0)}%`}
                    </td>
                  </tr>
                  {isExpanded && week.prevWeek && (
                    <tr className="bg-[#0D1220]">
                      <td colSpan={colCount} className="px-0 py-0">
                        <div className="px-6 py-3 border-t border-white/[0.04]">
                          <div className="text-[10px] font-semibold uppercase tracking-[1px] text-gray-500 mb-2">
                            Week-over-Week Detail — {week.label} vs. Previous
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2">
                            <MetricCard label="Sales" curr={week.sales} prev={week.prevWeek.sales} fmt={fmtDollar} />
                            <MetricCard label="Units" curr={week.units} prev={week.prevWeek.units} fmt={formatNumber} />
                            <MetricCard label="Ad Spend" curr={week.adSpend} prev={week.prevWeek.adSpend} fmt={fmtDollar} invert />
                            <MetricCard label="Ad Sales" curr={week.adSales} prev={week.prevWeek.adSales} fmt={fmtDollar} />
                            <MetricCard label="ACoS" curr={week.acos ?? 0} prev={week.prevWeek.acos ?? 0} fmt={(n) => fmtPct(n)} invert />
                            <MetricCard label="ROAS" curr={week.roas ?? 0} prev={week.prevWeek.roas ?? 0} fmt={(n) => fmtRoas(n)} />
                            <MetricCard label="Organic Sales" curr={week.organicSales} prev={week.prevWeek.organicSales} fmt={fmtDollar} />
                          </div>
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
