'use client';

import { Fragment, useState } from 'react';
import { fmtDollar } from '@/lib/formatUtils';
import SortableTable from '@/components/SortableTable';

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
  const [sortKey, setSortKey] = useState<string>('order');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const colCount = 2 + retailers.length; // Week + retailers + Combined
  const weekRows = allLabels.map((label, index) => {
    const weeksByRetailer = retailers.map((r) => r.weeks.find((w) => w.label === label));
    const combined = weeksByRetailer.reduce((sum, w) => sum + (w?.sales ?? 0), 0);
    const perRetailer = retailers.reduce<Record<string, number>>((acc, r, i) => {
      acc[r.key] = weeksByRetailer[i]?.sales ?? 0;
      return acc;
    }, {});
    return { label, order: index, weeksByRetailer, combined, perRetailer };
  });

  const sortedRows = [...weekRows].sort((a, b) => {
    const av =
      sortKey === 'label' ? a.label :
      sortKey === 'combined' ? a.combined :
      sortKey === 'order' ? a.order :
      a.perRetailer[sortKey] ?? 0;
    const bv =
      sortKey === 'label' ? b.label :
      sortKey === 'combined' ? b.combined :
      sortKey === 'order' ? b.order :
      b.perRetailer[sortKey] ?? 0;
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
    setSortDir(nextKey === 'order' || nextKey === 'label' ? 'asc' : 'desc');
  }

  return (
    <div className="bg-dash-card border border-white/[0.08] rounded-lg overflow-hidden mb-6">
      <div className="px-4 py-2.5 border-b border-white/[0.08] text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
        Weekly Sales Trend — All Retailers
      </div>
      <div className="table-scroll">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="bg-dash-card2 border-b border-white/[0.08]">
              <th className="text-left px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.8px] text-gray-400 whitespace-nowrap">
                <button type="button" onClick={() => onSort('label')} className="inline-flex items-center gap-1 hover:text-gray-200 transition-colors">
                  Week
                  <span className="text-[10px]">{sortKey === 'label' ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
                </button>
              </th>
              {retailers.map((r) => (
                <th key={r.key} className="text-right px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.8px] whitespace-nowrap" style={{ color: r.color }}>
                  <button type="button" onClick={() => onSort(r.key)} className="inline-flex items-center gap-1 hover:opacity-80 transition-opacity">
                    {r.label}
                    <span className="text-[10px]">{sortKey === r.key ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
                  </button>
                </th>
              ))}
              <th className="text-right px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.8px] text-gray-300 whitespace-nowrap">
                <button type="button" onClick={() => onSort('combined')} className="inline-flex items-center gap-1 hover:text-gray-200 transition-colors">
                  Combined
                  <span className="text-[10px]">{sortKey === 'combined' ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map(({ label, weeksByRetailer, combined }) => {
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
                                    <SortableTable
                                      columns={[
                                        { key: 'brand', label: 'Brand' },
                                        { key: 'sales', label: 'Sales', align: 'right', type: 'currency' },
                                        { key: 'units', label: 'Units', align: 'right', type: 'number' },
                                      ]}
                                      rows={brands.map((b) => ({
                                        rowId: b.brand,
                                        brand: b.brand,
                                        sales: b.sales,
                                        units: b.units,
                                      }))}
                                      rowKey="rowId"
                                      defaultSortKey="sales"
                                      defaultSortDir="desc"
                                    />
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
