'use client';

import { Fragment, useState } from 'react';
import { wowPct, fmtDollar, fmtPct, fmtRoas, type BrandData, type WeekData } from '@/lib/formatUtils';

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

  const trendWeeks = weeks.map((week, i) => {
    const prevWeek = i > 0 ? weeks[i - 1] : null;
    return {
      ...week,
      salesWow: wowPct(week.sales, prevWeek?.sales ?? 0),
      adSpendWow: wowPct(week.adSpend, prevWeek?.adSpend ?? 0),
      adSalesWow: wowPct(week.adSales, prevWeek?.adSales ?? 0),
      organicWow: wowPct(week.organicSales, prevWeek?.organicSales ?? 0),
    };
  });

  const colCount = 11;

  return (
    <div className="bg-dash-card border border-white/[0.08] rounded-lg overflow-hidden">
      <div className="table-scroll">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="bg-dash-card2 border-b border-white/[0.08]">
              <th className="text-left px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.8px] text-gray-400 whitespace-nowrap">Week</th>
              <th className="text-right px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.8px] text-gray-400 whitespace-nowrap">Total Sales</th>
              <th className="text-right px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.8px] text-gray-400 whitespace-nowrap">Sales WoW</th>
              <th className="text-right px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.8px] text-gray-400 whitespace-nowrap">Units</th>
              <th className="text-right px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.8px] text-gray-400 whitespace-nowrap">Ad Spend</th>
              <th className="text-right px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.8px] text-gray-400 whitespace-nowrap">Spend WoW</th>
              <th className="text-right px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.8px] text-gray-400 whitespace-nowrap">Ad Sales</th>
              <th className="text-right px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.8px] text-gray-400 whitespace-nowrap">ACoS</th>
              <th className="text-right px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.8px] text-gray-400 whitespace-nowrap">ROAS</th>
              <th className="text-right px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.8px] text-gray-400 whitespace-nowrap">Organic Sales</th>
              <th className="text-right px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.8px] text-gray-400 whitespace-nowrap">Organic WoW</th>
            </tr>
          </thead>
          <tbody>
            {trendWeeks.map((week) => {
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
                          <table className="w-full border-collapse text-[11px]">
                            <thead>
                              <tr>
                                <th className="text-left px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.8px] text-gray-500">Brand</th>
                                <th className={TH}>Sales</th>
                                <th className={TH}>Units</th>
                                <th className={TH}>Ad Spend</th>
                                <th className={TH}>Ad Sales</th>
                                <th className={TH}>ACoS</th>
                                <th className={TH}>ROAS</th>
                                <th className={TH}>Organic</th>
                              </tr>
                            </thead>
                            <tbody>
                              {week.brands
                                .filter((b) => b.sales > 0 || b.adSpend > 0)
                                .sort((a, b) => b.sales - a.sales)
                                .map((b) => (
                                  <tr key={b.brand} className="border-t border-white/[0.03] hover:bg-white/[0.02]">
                                    <td className="px-3 py-1.5 text-white font-medium text-[12px]">{b.brand}</td>
                                    <td className="px-3 py-1.5 text-right font-mono text-[#E8EDF5]">{fmtDollar(b.sales)}</td>
                                    <td className="px-3 py-1.5 text-right font-mono text-[#E8EDF5]">{formatNumber(b.units)}</td>
                                    <td className="px-3 py-1.5 text-right font-mono text-[#E8EDF5]">{fmtDollar(b.adSpend)}</td>
                                    <td className="px-3 py-1.5 text-right font-mono text-[#E8EDF5]">{b.adSales > 0 ? fmtDollar(b.adSales) : '—'}</td>
                                    <td className={`px-3 py-1.5 text-right font-mono font-semibold ${acosColorInline(b.acos)}`}>{b.acos !== null && b.acos > 0 ? fmtPct(b.acos) : '—'}</td>
                                    <td className="px-3 py-1.5 text-right font-mono text-[#E8EDF5]">{fmtRoas(b.roas)}</td>
                                    <td className="px-3 py-1.5 text-right font-mono text-[#E8EDF5]">{fmtDollar(b.organicSales)}</td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
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

