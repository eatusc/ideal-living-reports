export const dynamic = 'force-dynamic';

import Link from 'next/link';
import UploadBar from '@/components/UploadBar';
import NotesSection from '@/components/NotesSection';
import TableChartToggle from '@/components/TableChartToggle';
import TrendChart, { type ChartMetric, type ChartDataPoint, type ChartNote } from '@/components/TrendChart';
import ImpactView from '@/components/ImpactView';
import SortableTable from '@/components/SortableTable';
import { readNotes, type Note } from '@/lib/notes';
import { parseLustrowareData } from '@/lib/parseLustroware';
import { wowPct, fmtDollar, fmtPct, fmtRoas } from '@/lib/parseExcel';

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

function acosWowArrow(current: number | null, prev: number | null) {
  if (current === null || prev === null) return { symbol: '—', label: '—', cls: 'text-gray-500' };
  const delta = current - prev;
  const pctChange = prev !== 0 ? delta / prev : null;
  const label = pctChange !== null ? `${delta >= 0 ? '+' : ''}${(pctChange * 100).toFixed(1)}%` : '—';
  return { symbol: delta >= 0 ? '↑' : '↓', label, cls: delta <= 0 ? 'text-green-400' : 'text-amber-400' };
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-bold uppercase tracking-[1.5px] text-[#FFC220] mb-4 mt-9 first:mt-0">
      {children}
    </div>
  );
}

interface ScoreCardProps {
  label: string;
  value: string;
  prevLabel: string;
  wow: { symbol: string; label: string; cls: string };
  topColor?: string;
}

function ScoreCard({ label, value, prevLabel, wow, topColor }: ScoreCardProps) {
  return (
    <div
      className="relative bg-dash-card border border-white/[0.08] rounded-lg p-4 overflow-hidden"
      style={{ borderTop: `2px solid ${topColor ?? '#374151'}` }}
    >
      <div className="text-[10px] font-medium uppercase tracking-[0.8px] text-gray-400 mb-2">{label}</div>
      <div className="font-mono text-[22px] font-bold text-white tracking-tight leading-none">{value}</div>
      <div className={`font-mono text-[11px] mt-1.5 flex items-center gap-1 ${wow.cls}`}>
        <span>{wow.symbol}</span><span>{wow.label} WoW</span>
      </div>
      <div className="font-mono text-[10px] mt-0.5 text-gray-500">{prevLabel}</div>
    </div>
  );
}

export default async function LustrowarePage() {
  let data;
  let parseError: string | null = null;

  try {
    data = await parseLustrowareData();
  } catch (err) {
    parseError = err instanceof Error ? err.message : 'Failed to load data';
  }

  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  let notes: Note[] = [];
  try { notes = await readNotes('lustroware'); } catch { /* ignore */ }

  if (parseError || !data) {
    return (
      <main className="min-h-screen px-4 sm:px-6 py-10">
        <div className="max-w-[1100px] mx-auto">
          <UploadBar company="lustroware" />
          <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-6 text-amber-300">
            <p className="font-semibold mb-1">No data file found</p>
            <p className="text-[13px] text-amber-400/80">{parseError ?? 'Upload an Excel file to generate the report.'}</p>
          </div>
          <NotesSection company="lustroware" initialNotes={notes} />
        </div>
      </main>
    );
  }

  const { weeks, currentWeek: curr, previousWeek: prev, currentWeekSkus } = data;

  const chartMetrics: ChartMetric[] = [
    { key: 'sales', label: 'Total Sales', color: '#22C55E', yAxisId: 'dollar', formatType: 'dollar', defaultVisible: true },
    { key: 'adSpend', label: 'Ad Spend', color: '#EF4444', yAxisId: 'dollar', formatType: 'dollar', defaultVisible: true },
    { key: 'adSales', label: 'Ad Sales', color: '#3B82F6', yAxisId: 'dollar', formatType: 'dollar', defaultVisible: true },
    { key: 'units', label: 'Units', color: '#06B6D4', yAxisId: 'count', formatType: 'number', defaultVisible: false },
    { key: 'orders', label: 'Orders', color: '#EC4899', yAxisId: 'count', formatType: 'number', defaultVisible: false },
    { key: 'acos', label: 'ACoS', color: '#F59E0B', yAxisId: 'pct', formatType: 'pct', defaultVisible: true },
    { key: 'roas', label: 'ROAS', color: '#8B5CF6', yAxisId: 'pct', formatType: 'roas', defaultVisible: true },
  ];

  const chartData: ChartDataPoint[] = weeks
    .filter((w) => w.label.startsWith('2026 - Week') || w.label === 'Previous Week' || w.label === 'Current Week')
    .map((w) => ({
      label: w.startDate ? `${w.startDate}` : w.label,
      sales: w.sales,
      adSpend: w.adSpend,
      adSales: w.adSales,
      units: w.units,
      orders: w.orders,
      acos: w.acos !== null ? w.acos * 100 : null,
      roas: w.roas,
    }));

  const chartNotes: ChartNote[] = notes.flatMap((n) => {
    const noteDate = new Date(n.date);
    if (isNaN(noteDate.getTime())) return [];
    for (const w of weeks) {
      if (!w.startDate || !w.endDate) continue;
      const year = new Date().getFullYear();
      const start = new Date(`${w.startDate}, ${year}`);
      const end = new Date(`${w.endDate}, ${year}`);
      end.setHours(23, 59, 59);
      if (noteDate >= start && noteDate <= end) {
        return [{ date: n.date, text: n.action, weekLabel: w.startDate }];
      }
    }
    return [];
  });

  return (
    <main className="min-h-screen px-4 sm:px-6 py-10">
      <div className="max-w-[1100px] mx-auto">
        <UploadBar company="lustroware" />

        <div className="flex gap-3 mb-4 text-[11px] font-mono">
          <span className="text-gray-600">Reports:</span>
          <Link href="/aceteam" className="text-blue-300 hover:text-blue-200 transition-colors">/aceteam</Link>
          <Link href="/elevate" className="text-blue-300 hover:text-blue-200 transition-colors">/elevate</Link>
          <span className="text-[#FFC220] font-semibold">/lustroware</span>
          <Link href="/somarsh" className="text-blue-300 hover:text-blue-200 transition-colors">/somarsh</Link>
        </div>

        <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-10 pb-6 border-b border-white/[0.08]">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="w-8 h-8 rounded-full bg-[#FFC220] flex items-center justify-center text-[#0A0F1C] font-bold text-lg leading-none select-none">★</div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Lustroware</h1>
            </div>
            <p className="text-sm text-gray-400">Weekly Performance Report (2026)</p>
            <div className="inline-flex items-center gap-1.5 mt-2 bg-[#0071CE]/10 border border-[#0071CE]/30 text-blue-400 px-2.5 py-1 rounded text-[11px] font-mono">
              ⚡ Source: Weekly Sales and Ad Sales Tracker
            </div>
          </div>
          <div className="text-right font-mono text-[12px] text-gray-400">
            <div className="text-[14px] font-semibold text-[#E8EDF5] mb-0.5">Current Week Report</div>
            <div>Generated: {today}</div>
            <div>Sales + Ads</div>
          </div>
        </header>

        <SectionTitle>📊 Weekly Scorecard — Current vs. Previous Week</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-2">
          <ScoreCard label="Total Sales" value={fmtDollar(curr.sales)} prevLabel={`Prev: ${fmtDollar(prev.sales)}`} wow={wowArrow(wowPct(curr.sales, prev.sales))} topColor="#22C55E" />
          <ScoreCard label="Units Sold" value={formatNumber(curr.units)} prevLabel={`Prev: ${formatNumber(prev.units)}`} wow={wowArrow(wowPct(curr.units, prev.units))} topColor="#06B6D4" />
          <ScoreCard label="Orders" value={formatNumber(curr.orders)} prevLabel={`Prev: ${formatNumber(prev.orders)}`} wow={wowArrow(wowPct(curr.orders, prev.orders))} topColor="#EC4899" />
          <ScoreCard label="Ad Spend" value={fmtDollar(curr.adSpend)} prevLabel={`Prev: ${fmtDollar(prev.adSpend)}`} wow={wowArrow(wowPct(curr.adSpend, prev.adSpend), true)} topColor="#EF4444" />
          <ScoreCard label="Ad Sales" value={fmtDollar(curr.adSales)} prevLabel={`Prev: ${fmtDollar(prev.adSales)}`} wow={wowArrow(wowPct(curr.adSales, prev.adSales))} topColor="#3B82F6" />
          <ScoreCard label="ACoS" value={fmtPct(curr.acos)} prevLabel={`Prev: ${fmtPct(prev.acos)}`} wow={acosWowArrow(curr.acos, prev.acos)} topColor="#F59E0B" />
          <ScoreCard label="ROAS" value={fmtRoas(curr.roas)} prevLabel={`Prev: ${fmtRoas(prev.roas)}`} wow={wowArrow(wowPct(curr.roas ?? 0, prev.roas ?? 0))} topColor="#8B5CF6" />
          <ScoreCard label="Conversion Rate" value={fmtPct(curr.conversionRate)} prevLabel={`Prev: ${fmtPct(prev.conversionRate)}`} wow={wowArrow(wowPct(curr.conversionRate ?? 0, prev.conversionRate ?? 0))} topColor="#0EA5E9" />
        </div>

        <SectionTitle>📈 Weekly Trend (2026)</SectionTitle>
        <TableChartToggle
          tableContent={
            <div className="bg-dash-card border border-white/[0.08] rounded-lg overflow-hidden">
              <SortableTable
                columns={[
                  { key: 'week', label: 'Week' },
                  { key: 'sales', label: 'Sales', align: 'right', type: 'currency' },
                  { key: 'units', label: 'Units', align: 'right', type: 'number' },
                  { key: 'orders', label: 'Orders', align: 'right', type: 'number' },
                  { key: 'adSpend', label: 'Ad Spend', align: 'right', type: 'currency' },
                  { key: 'adSales', label: 'Ad Sales', align: 'right', type: 'currency' },
                  { key: 'acos', label: 'ACoS', align: 'right', type: 'percent' },
                  { key: 'roas', label: 'ROAS', align: 'right', type: 'roas' },
                ]}
                rows={weeks.map((w) => ({
                  week: w.label === 'Current Week' && w.startDate && w.endDate ? `${w.label} (${w.startDate} - ${w.endDate})` : w.label,
                  sales: w.sales,
                  units: w.units,
                  orders: w.orders,
                  adSpend: w.adSpend,
                  adSales: w.adSales,
                  acos: w.acos,
                  roas: w.roas,
                }))}
                rowKey="week"
                defaultSortKey="week"
                defaultSortDir="asc"
              />
            </div>
          }
          chartContent={<TrendChart data={chartData} metrics={chartMetrics} notes={chartNotes} accentColor="#FFC220" />}
          impactContent={<ImpactView data={chartData} metrics={chartMetrics} notes={chartNotes} accentColor="#FFC220" />}
        />

        <SectionTitle>📦 Current Week SKU Performance</SectionTitle>
        <div className="bg-dash-card border border-white/[0.08] rounded-lg overflow-hidden">
          <SortableTable
            columns={[
              { key: 'sku', label: 'SKU' },
              { key: 'product', label: 'Product' },
              { key: 'sales', label: 'Sales', align: 'right', type: 'currency' },
              { key: 'units', label: 'Units', align: 'right', type: 'number' },
              { key: 'orders', label: 'Orders', align: 'right', type: 'number' },
              { key: 'adSpend', label: 'Ad Spend', align: 'right', type: 'currency' },
              { key: 'adSales', label: 'Ad Sales', align: 'right', type: 'currency' },
              { key: 'acos', label: 'ACoS', align: 'right', type: 'percent' },
              { key: 'roas', label: 'ROAS', align: 'right', type: 'roas' },
            ]}
            rows={currentWeekSkus.map((s) => ({
              rowId: `${s.sku}-${s.product}`,
              sku: s.sku,
              product: s.product,
              sales: s.sales,
              units: s.units,
              orders: s.orders,
              adSpend: s.adSpend,
              adSales: s.adSales,
              acos: s.acos,
              roas: s.roas,
            }))}
            rowKey="rowId"
            defaultSortKey="sales"
            defaultSortDir="desc"
          />
          {currentWeekSkus.length === 0 && (
            <div className="px-3.5 py-3 text-gray-500 text-[12px]">No SKU rows found for current week in 2026 sheet.</div>
          )}
        </div>

        <NotesSection company="lustroware" initialNotes={notes} />

        <footer className="mt-12 pt-5 border-t border-white/[0.08] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 font-mono text-[11px] text-gray-500">
          <span>Lustroware · Weekly Report · Generated {today}</span>
          <span>Source: Weekly Sales and Ad Sales Tracker (2026)</span>
        </footer>
      </div>
    </main>
  );
}
