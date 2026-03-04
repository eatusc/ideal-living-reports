'use client';

import { Fragment, useState } from 'react';
import { fmtDollar } from '@/lib/formatUtils';

function formatNumber(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

interface BrandData {
  brand: string;
  sales: number;
  units: number;
  orderedItems: number;
}

interface RetailerWeek {
  label: string;
  startDate?: string;
  endDate?: string;
  sales: number;
  units: number;
  orderedItems: number;
  brands: BrandData[];
}

interface RetailerInfo {
  key: string;
  label: string;
  color: string;
  weeks: RetailerWeek[];
}

export default function RetailerTrendTable({
  retailers,
  allLabels,
}: {
  retailers: RetailerInfo[];
  allLabels: string[];
}) {
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);

  const colCount = 2 + retailers.length; // Week + retailers + Combined

  return (
    <div className="bg-dash-card border border-white/[0.08] rounded-lg overflow-hidden mb-6">
      <div className="px-4 py-2.5 border-b border-white/[0.08] text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
        Weekly Sales Trend — All Retailers
      </div>
      <div className="table-scroll">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="bg-dash-card2 border-b border-white/[0.08]">
              <th className="text-left px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.8px] text-gray-400 whitespace-nowrap">Week</th>
              {retailers.map((r) => (
                <th key={r.key} className="text-right px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.8px] whitespace-nowrap" style={{ color: r.color }}>
                  {r.label}
                </th>
              ))}
              <th className="text-right px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.8px] text-gray-300 whitespace-nowrap">Combined</th>
            </tr>
          </thead>
          <tbody>
            {allLabels.map((label) => {
              const weeksByRetailer = retailers.map((r) => r.weeks.find((w) => w.label === label));
              const combined = weeksByRetailer.reduce((sum, w) => sum + (w?.sales ?? 0), 0);
              const isCurrent = label === 'Current Week';
              const isPrev = label === 'Previous Week';
              const isExpanded = expandedWeek === label;

              // Check if any retailer has brand data for this week
              const hasBrands = weeksByRetailer.some((w) => w && w.brands.length > 0);

              const rowCls = isCurrent
                ? 'bg-[#F96302]/10 border-b border-white/[0.08]'
                : isPrev
                ? 'bg-white/[0.02] border-b border-white/[0.08]'
                : 'border-b border-white/[0.05] hover:bg-white/[0.02] transition-colors';
              const cellCls = isCurrent ? 'text-orange-200 font-semibold' : 'text-[#E8EDF5]';

              // Get date range from any retailer that has it
              const anyWeek = weeksByRetailer.find((w) => w?.startDate);

              return (
                <Fragment key={label}>
                  <tr
                    className={`${rowCls} ${hasBrands ? 'cursor-pointer select-none' : ''}`}
                    onClick={() => hasBrands && setExpandedWeek(isExpanded ? null : label)}
                  >
                    <td className={`px-3.5 py-2.5 font-sans font-medium text-[13px] whitespace-nowrap ${isCurrent ? 'text-orange-400 font-semibold' : 'text-white'}`}>
                      <span className="inline-flex items-center gap-1.5">
                        {hasBrands && (
                          <span className={`text-[10px] text-gray-500 transition-transform duration-150 inline-block ${isExpanded ? 'rotate-90' : ''}`}>&#9654;</span>
                        )}
                        <span>
                          {isCurrent ? `${label}` : label}
                          {(isCurrent || isPrev) && anyWeek?.startDate && (
                            <span className="block text-[10px] text-gray-500 font-mono font-normal">
                              {anyWeek.startDate}{anyWeek.endDate && anyWeek.endDate !== anyWeek.startDate ? ` \u2013 ${anyWeek.endDate}` : ''}
                            </span>
                          )}
                        </span>
                      </span>
                    </td>
                    {weeksByRetailer.map((w, i) => (
                      <td key={retailers[i].key} className={`px-3.5 py-2.5 text-right font-mono ${cellCls}`}>
                        {w ? fmtDollar(w.sales) : '\u2014'}
                      </td>
                    ))}
                    <td className={`px-3.5 py-2.5 text-right font-mono font-semibold ${cellCls}`}>{fmtDollar(combined)}</td>
                  </tr>

                  {isExpanded && (
                    <tr className="bg-[#0D1220]">
                      <td colSpan={colCount} className="px-0 py-0">
                        <div className="px-6 py-3 border-t border-white/[0.04]">
                          <div className="text-[10px] font-semibold uppercase tracking-[1px] text-gray-500 mb-3">
                            Brand Breakdown — {label}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {retailers.map((r, ri) => {
                              const w = weeksByRetailer[ri];
                              const brands = w?.brands.filter((b) => b.sales > 0 || b.units > 0) ?? [];
                              return (
                                <div key={r.key}>
                                  <div className="text-[10px] font-bold uppercase tracking-[0.8px] mb-1.5" style={{ color: r.color }}>
                                    {r.label}
                                  </div>
                                  {brands.length === 0 ? (
                                    <div className="text-[11px] text-gray-600">No brand data</div>
                                  ) : (
                                    <table className="w-full border-collapse text-[11px]">
                                      <thead>
                                        <tr>
                                          <th className="text-left px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.8px] text-gray-500">Brand</th>
                                          <th className="text-right px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.8px] text-gray-500">Sales</th>
                                          <th className="text-right px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.8px] text-gray-500">Units</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {brands.sort((a, b) => b.sales - a.sales).map((b) => (
                                          <tr key={b.brand} className="border-t border-white/[0.03] hover:bg-white/[0.02]">
                                            <td className="px-2 py-1 text-white font-medium text-[11px]">{b.brand}</td>
                                            <td className="px-2 py-1 text-right font-mono text-[#E8EDF5]">{fmtDollar(b.sales)}</td>
                                            <td className="px-2 py-1 text-right font-mono text-[#E8EDF5]">{formatNumber(b.units)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
                                </div>
                              );
                            })}
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
