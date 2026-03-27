'use client';

import { Fragment, useState } from 'react';
import { wowPct, fmtDollar, fmtPct, fmtRoas, type BrandData, type WeekData } from '@/lib/formatUtils';
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

function acosColorInline(acos: number | null): string {
  if (acos === null) return 'text-gray-500';
  if (acos < 0.35) return 'text-green-400';
  if (acos <= 0.55) return 'text-amber-400';
  return 'text-red-400';
}

const TH = 'text-right px-3.5 py-2 text-[10px] font-semibold uppercase tracking-[0.8px] text-gray-500 whitespace-nowrap';

export default function RpdWalmartTrendTable({ weeks }: { weeks: WeekData[] }) {
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<string>('order');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const trendWeeks = weeks.map((week, i) => {
    const prevWeek = i > 0 ? weeks[i - 1] : null;
    return {
      ...week,
      order: i,
      salesWow: wowPct(week.sales, prevWeek?.sales ?? 0),
      adSpendWow: wowPct(week.adSpend, prevWeek?.adSpend ?? 0),
      adSalesWow: wowPct(week.adSales, prevWeek?.adSales ?? 0),
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
    { key: 'sales', label: 'Total Sales' },
    { key: 'salesWow', label: 'Sales WoW' },
    { key: 'units', label: 'Units' },
    { key: 'adSpend', label: 'Ad Spend' },
    { key: 'adSpendWow', label: 'Spend WoW' },
    { key: 'adSales', label: 'Ad Sales' },
    { key: 'acos', label: 'ACoS' },
    { key: 'roas', label: 'ROAS' },
    { key: 'organicSales', label: 'Organic Sales' },
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
              const isCurrent = week.label === 'Current Week';
              const isPrev = week.label === 'Previous Week';
              const isExpanded = expandedWeek === week.label;
              const hasBrands = week.brands.length > 0;
              const rowCls = isCurrent
                ? 'bg-[#0071CE]/10 border-b border-white/[0.08]'
                : isPrev
                ? 'bg-white/[0.02] border-b border-white/[0.08]'
                : 'border-b border-white/[0.05] hover:bg-white/[0.02] transition-colors';
              const cellCls = isCurrent ? 'text-blue-200 font-semibold' : 'text-[#E8EDF5]';
              const sWow = wowArrow(week.salesWow);
              const spWow = wowArrow(week.adSpendWow, true);
              const oWow = wowArrow(week.organicWow);

              return (
                <Fragment key={week.label}>
                  <tr
                    className={`${rowCls} ${hasBrands ? 'cursor-pointer select-none' : ''}`}
                    onClick={() => hasBrands && setExpandedWeek(isExpanded ? null : week.label)}
                  >
                    <td className={`px-3.5 py-2.5 font-sans font-medium text-[13px] whitespace-nowrap ${isCurrent ? 'text-blue-400 font-semibold' : 'text-white'}`}>
                      <span className="inline-flex items-center gap-1.5">
                        {hasBrands && (
                          <span className={`text-[10px] text-gray-500 transition-transform duration-150 inline-block ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                        )}
                        {isCurrent ? (
                          <span>
                            Current Week
                            {week.startDate && <span className="block text-[10px] text-gray-500 font-mono font-normal">{week.startDate}{week.endDate && week.endDate !== week.startDate ? ` – ${week.endDate}` : ''}</span>}
                          </span>
                        ) : isPrev ? 'Previous Week' : week.label}
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
                    <td className={`px-3.5 py-2.5 text-right font-mono font-semibold ${acosColorInline(week.acos)}`}>{fmtPct(week.acos)}</td>
                    <td className={`px-3.5 py-2.5 text-right font-mono ${cellCls}`}>{fmtRoas(week.roas)}</td>
                    <td className={`px-3.5 py-2.5 text-right font-mono ${cellCls}`}>{fmtDollar(week.organicSales)}</td>
                    <td className={`px-3.5 py-2.5 text-right font-mono font-semibold ${oWow.cls}`}>
                      {week.organicWow === null ? '—' : `${oWow.symbol} ${Math.abs(week.organicWow * 100).toFixed(0)}%`}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="bg-[#0D1220]">
                      <td colSpan={colCount} className="px-0 py-0">
                        <div className="px-6 py-3 border-t border-white/[0.04]">
                          <div className="text-[10px] font-semibold uppercase tracking-[1px] text-gray-500 mb-2">
                            Brand Breakdown — {isCurrent ? 'Current Week' : isPrev ? 'Previous Week' : week.label}
                          </div>
                          <SortableTable
                            columns={[
                              { key: 'brand', label: 'Brand' },
                              { key: 'sales', label: 'Sales', align: 'right', type: 'currency' },
                              { key: 'units', label: 'Units', align: 'right', type: 'number' },
                              { key: 'adSpend', label: 'Ad Spend', align: 'right', type: 'currency' },
                              { key: 'adSales', label: 'Ad Sales', align: 'right', type: 'currency' },
                              { key: 'acos', label: 'ACoS', align: 'right', type: 'percent' },
                              { key: 'roas', label: 'ROAS', align: 'right', type: 'roas' },
                              { key: 'organicSales', label: 'Organic', align: 'right', type: 'currency' },
                            ]}
                            rows={week.brands
                              .filter((b) => b.sales > 0 || b.adSpend > 0)
                              .map((b) => ({
                                rowId: b.brand,
                                brand: b.brand,
                                sales: b.sales,
                                units: b.units,
                                adSpend: b.adSpend,
                                adSales: b.adSales,
                                acos: b.acos,
                                roas: b.roas,
                                organicSales: b.organicSales,
                              }))}
                            rowKey="rowId"
                            defaultSortKey="sales"
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
