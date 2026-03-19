export const dynamic = 'force-dynamic';

import {
  parseDashboardData,
  parseSemData,
  wowPct,
  fmtDollar,
  fmtPct,
  fmtRoas,
  type BrandData,
  type WeekData,
} from '@/lib/parseExcel';
import UploadBar from '@/components/UploadBar';
import NotesSection from '@/components/NotesSection';
import RpdWalmartTrendTable from '@/components/RpdWalmartTrendTable';
import TableChartToggle from '@/components/TableChartToggle';
import TrendChart, { type ChartMetric, type ChartDataPoint, type ChartNote, type FormatType } from '@/components/TrendChart';
import ImpactView from '@/components/ImpactView';
import { readNotes, type Note } from '@/lib/notes';
import Link from 'next/link';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

function wowArrow(pct: number | null, invertGood = false): {
  symbol: string;
  label: string;
  cls: string;
} {
  if (pct === null) return { symbol: '—', label: 'N/A', cls: 'text-gray-500' };
  const up = pct >= 0;
  const good = invertGood ? !up : up;
  return {
    symbol: up ? '↑' : '↓',
    label: `${up ? '+' : ''}${(pct * 100).toFixed(1)}%`,
    cls: good ? 'text-green-400' : 'text-red-400',
  };
}

function acosWowArrow(current: number | null, prev: number | null): {
  symbol: string;
  label: string;
  cls: string;
} {
  if (current === null || prev === null) return { symbol: '—', label: '—', cls: 'text-gray-500' };
  const delta = current - prev;
  const pctChange = prev !== 0 ? delta / prev : null;
  const label = pctChange !== null ? `${delta >= 0 ? '+' : ''}${(pctChange * 100).toFixed(1)}%` : '—';
  const cls = delta <= 0 ? 'text-green-400' : 'text-amber-400';
  const symbol = delta >= 0 ? '↑' : '↓';
  return { symbol, label, cls };
}

function acosColorInline(acos: number | null): string {
  if (acos === null) return 'text-gray-500';
  if (acos < 0.35) return 'text-green-400';
  if (acos <= 0.55) return 'text-amber-400';
  return 'text-red-400';
}

// ─── Sub-components ──────────────────────────────────────────────────────────

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
      <div className="text-[10px] font-medium uppercase tracking-[0.8px] text-gray-400 mb-2">
        {label}
      </div>
      <div className="font-mono text-[22px] font-bold text-white tracking-tight leading-none">
        {value}
      </div>
      <div className={`font-mono text-[11px] mt-1.5 flex items-center gap-1 ${wow.cls}`}>
        <span>{wow.symbol}</span>
        <span>{wow.label} WoW</span>
      </div>
      <div className="font-mono text-[10px] mt-0.5 text-gray-500">{prevLabel}</div>
    </div>
  );
}

// ─── Wins & Alerts ─────────────────────────────────────────────────────────

interface Alert {
  brand: string;
  message: string;
}

function generateWinsAlerts(
  currBrands: BrandData[],
  prevBrands: BrandData[]
): { wins: Alert[]; alerts: Alert[] } {
  const wins: Alert[] = [];
  const alerts: Alert[] = [];
  const prevMap = new Map(prevBrands.map((b) => [b.brand, b]));

  for (const curr of currBrands) {
    const prev = prevMap.get(curr.brand);
    const prevSales = prev?.sales ?? 0;
    const salesWow = wowPct(curr.sales, prevSales);

    if (salesWow !== null && salesWow > 0.2) {
      wins.push({ brand: curr.brand, message: `Sales up ${(salesWow * 100).toFixed(0)}% WoW (${fmtDollar(prevSales)} → ${fmtDollar(curr.sales)})` });
    }
    if (curr.acos !== null && curr.acos > 0 && curr.acos < 0.25) {
      wins.push({ brand: curr.brand, message: `Efficient ACoS of ${(curr.acos * 100).toFixed(1)}% — ROAS ${fmtRoas(curr.roas)}` });
    }
    if (curr.acos !== null && curr.acos > 0.7) {
      alerts.push({ brand: curr.brand, message: `ACoS at ${(curr.acos * 100).toFixed(0)}% — review bids` });
    }
    if (salesWow !== null && salesWow < -0.3) {
      alerts.push({ brand: curr.brand, message: `Sales down ${Math.abs(salesWow * 100).toFixed(0)}% WoW (${fmtDollar(prevSales)} → ${fmtDollar(curr.sales)})` });
    }
    if (curr.adSpend > 0 && curr.sales === 0) {
      alerts.push({ brand: curr.brand, message: `${fmtDollar(curr.adSpend)} ad spend with $0 sales — pause or review campaigns` });
    }
  }

  return { wins, alerts };
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function RpdWalmartPage() {
  let data;
  let semData;
  let parseError: string | null = null;

  try {
    [data, semData] = await Promise.all([parseDashboardData(), parseSemData()]);
  } catch (err) {
    parseError = err instanceof Error ? err.message : 'Failed to load data';
  }

  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  if (parseError || !data || !semData) {
    return (
      <main className="min-h-screen px-4 sm:px-6 py-10">
        <div className="max-w-[1100px] mx-auto">
          <UploadBar company="rpd-walmart" />
          <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-6 text-amber-300">
            <p className="font-semibold mb-1">No data file found</p>
            <p className="text-[13px] text-amber-400/80">{parseError ?? 'Upload an Excel file to generate the report.'}</p>
          </div>
        </div>
      </main>
    );
  }

  const { weeks, currentWeek: curr, previousWeek: prev } = data;

  // ── Chart data prep ──
  let notes: Note[] = [];
  try { notes = await readNotes('rpd-walmart'); } catch { /* ignore */ }

  const trendMetrics: ChartMetric[] = [
    { key: 'sales', label: 'Total Sales', color: '#22C55E', yAxisId: 'dollar', formatType: 'dollar', defaultVisible: true },
    { key: 'adSpend', label: 'Ad Spend', color: '#EF4444', yAxisId: 'dollar', formatType: 'dollar', defaultVisible: true },
    { key: 'adSales', label: 'Ad Sales', color: '#3B82F6', yAxisId: 'dollar', formatType: 'dollar', defaultVisible: true },
    { key: 'organicSales', label: 'Organic Sales', color: '#A855F7', yAxisId: 'dollar', formatType: 'dollar', defaultVisible: false },
    { key: 'units', label: 'Units', color: '#06B6D4', yAxisId: 'count', formatType: 'number', defaultVisible: false },
    { key: 'orderedItems', label: 'Orders', color: '#EC4899', yAxisId: 'count', formatType: 'number', defaultVisible: false },
    { key: 'acos', label: 'ACoS', color: '#F59E0B', yAxisId: 'pct', formatType: 'pct', defaultVisible: true },
    { key: 'roas', label: 'ROAS', color: '#8B5CF6', yAxisId: 'pct', formatType: 'roas' },
  ];

  const trendChartData: ChartDataPoint[] = weeks.map((w) => ({
    label: w.startDate ? `${w.startDate}` : w.label,
    sales: w.sales,
    adSpend: w.adSpend,
    adSales: w.adSales,
    organicSales: w.organicSales,
    units: w.units,
    orderedItems: w.orderedItems,
    acos: w.acos !== null ? w.acos * 100 : null,
    roas: w.roas !== null ? w.roas : null,
  }));

  // Map notes to nearest week for chart annotations
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

  // Brand chart data: one line per brand, showing sales over weeks
  const allBrandNames = [...new Set(weeks.flatMap((w) => w.brands.map((b) => b.brand)))];
  const brandColors = ['#22C55E', '#3B82F6', '#EF4444', '#F59E0B', '#A855F7', '#EC4899', '#06B6D4', '#10B981', '#F97316', '#6366F1'];
  const brandMetrics: ChartMetric[] = allBrandNames
    .filter((name) => {
      const lastWeek = weeks[weeks.length - 1];
      return lastWeek?.brands.some((b) => b.brand === name && b.sales > 0);
    })
    .slice(0, 10)
    .map((name, i) => ({
      key: name,
      label: name,
      color: brandColors[i % brandColors.length],
      yAxisId: 'dollar' as const,
      formatType: 'dollar' as FormatType,
      defaultVisible: true,
    }));

  const brandChartData: ChartDataPoint[] = weeks.map((w) => {
    const point: ChartDataPoint = { label: w.startDate ? `${w.startDate}` : w.label };
    for (const bm of brandMetrics) {
      const brand = w.brands.find((b) => b.brand === bm.key);
      point[bm.key] = brand?.sales ?? 0;
    }
    return point;
  });

  // SEM chart data
  const semMetrics: ChartMetric[] = [
    { key: 'adSpend', label: 'Ad Spend', color: '#EF4444', yAxisId: 'dollar', formatType: 'dollar', defaultVisible: true },
    { key: 'adSales', label: 'Ad Sales', color: '#3B82F6', yAxisId: 'dollar', formatType: 'dollar', defaultVisible: true },
    { key: 'acos', label: 'ACoS', color: '#F59E0B', yAxisId: 'pct', formatType: 'pct', defaultVisible: true },
    { key: 'roas', label: 'ROAS', color: '#8B5CF6', yAxisId: 'pct', formatType: 'roas' },
    { key: 'impressions', label: 'Impressions', color: '#06B6D4', yAxisId: 'count', formatType: 'number', defaultVisible: false },
  ];

  // SEM only has current/previous week, build 2-point chart
  const semChartData: ChartDataPoint[] = [
    {
      label: 'Previous Week',
      adSpend: semData.previousWeek.adSpend,
      adSales: semData.previousWeek.adSales,
      acos: semData.previousWeek.acos !== null ? semData.previousWeek.acos * 100 : null,
      roas: semData.previousWeek.roas,
      impressions: semData.previousWeek.impressions,
    },
    {
      label: 'Current Week',
      adSpend: semData.currentWeek.adSpend,
      adSales: semData.currentWeek.adSales,
      acos: semData.currentWeek.acos !== null ? semData.currentWeek.acos * 100 : null,
      roas: semData.currentWeek.roas,
      impressions: semData.currentWeek.impressions,
    },
  ];

  const salesWow = wowArrow(wowPct(curr.sales, prev.sales));
  const ordersWow = wowArrow(wowPct(curr.orderedItems, prev.orderedItems));
  const unitsWow = wowArrow(wowPct(curr.units, prev.units));
  const adSalesWow = wowArrow(wowPct(curr.adSales, prev.adSales));
  const adSpendWow = wowArrow(wowPct(curr.adSpend, prev.adSpend), true);
  const acosWow = acosWowArrow(curr.acos, prev.acos);
  const roasWow = wowArrow(wowPct(curr.roas ?? 0, prev.roas ?? 0));
  const organicWow = wowArrow(wowPct(curr.organicSales, prev.organicSales));

  const currBrandMap = new Map(curr.brands.map((b) => [b.brand, b]));
  const prevBrandMap = new Map(prev.brands.map((b) => [b.brand, b]));
  const allBrands = [...new Set([...curr.brands.map((b) => b.brand), ...prev.brands.map((b) => b.brand)])];
  const brandRows = allBrands
    .map((name) => ({ curr: currBrandMap.get(name) ?? null, prev: prevBrandMap.get(name) ?? null, name }))
    .filter((r) => (r.curr?.sales ?? 0) > 0 || (r.prev?.sales ?? 0) > 0)
    .sort((a, b) => (b.curr?.sales ?? 0) - (a.curr?.sales ?? 0));

  const { wins, alerts } = generateWinsAlerts(curr.brands, prev.brands);

  return (
    <main className="min-h-screen px-4 sm:px-6 py-10">
      <div className="max-w-[1100px] mx-auto">

        <UploadBar company="rpd-walmart" />

        {/* ── NAV LINKS ────────────────────────────────────────── */}
        <div className="flex gap-3 mb-4 text-[11px] font-mono">
          <span className="text-gray-600">Reports:</span>
          <span className="text-[#FFC220] font-semibold">Walmart</span>
          <Link href="/rpd-hd" className="text-[#F96302] hover:text-[#FF7B2E] transition-colors">Home Depot</Link>
        </div>

        {/* ── HEADER ─────────────────────────────────────────── */}
        <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-10 pb-6 border-b border-white/[0.08]">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="w-8 h-8 rounded-full bg-[#FFC220] flex items-center justify-center text-[#0A0F1C] font-bold text-lg leading-none select-none">
                ★
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Ideal Living
              </h1>
            </div>
            <p className="text-sm text-gray-400">
              Walmart Advertising &amp; Sales — Weekly Performance Report
            </p>
            <div className="inline-flex items-center gap-1.5 mt-2 bg-[#0071CE]/10 border border-[#0071CE]/30 text-blue-400 px-2.5 py-1 rounded text-[11px] font-mono">
              ⚡ Data via Intentwise · Walmart Seller Center
            </div>
          </div>
          <div className="text-right font-mono text-[12px] text-gray-400">
            <div className="text-[14px] font-semibold text-[#E8EDF5] mb-0.5">Current Week Report</div>
            <div>Generated: {today}</div>
            <div>PPC + SEM Combined</div>
          </div>
        </header>

        {/* ── SCORECARD ──────────────────────────────────────── */}
        <SectionTitle>📊 Weekly Scorecard — Current vs. Previous Week</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-2">
          <ScoreCard label="Total Sales" value={fmtDollar(curr.sales)} prevLabel={`Prev: ${fmtDollar(prev.sales)}`} wow={salesWow} topColor={curr.sales >= prev.sales ? '#22C55E' : '#EF4444'} />
          <ScoreCard label="Total Orders" value={formatNumber(curr.orderedItems)} prevLabel={`Prev: ${formatNumber(prev.orderedItems)}`} wow={ordersWow} topColor={curr.orderedItems >= prev.orderedItems ? '#22C55E' : '#EF4444'} />
          <ScoreCard label="Units Sold" value={formatNumber(curr.units)} prevLabel={`Prev: ${formatNumber(prev.units)}`} wow={unitsWow} topColor={curr.units >= prev.units ? '#22C55E' : '#EF4444'} />
          <ScoreCard label="Ad Sales" value={fmtDollar(curr.adSales)} prevLabel={`Prev: ${fmtDollar(prev.adSales)}`} wow={adSalesWow} topColor={curr.adSales >= prev.adSales ? '#22C55E' : '#EF4444'} />
          <ScoreCard label="Ad Spend" value={fmtDollar(curr.adSpend)} prevLabel={`Prev: ${fmtDollar(prev.adSpend)}`} wow={adSpendWow} topColor={curr.adSpend <= prev.adSpend ? '#22C55E' : '#EF4444'} />
          <ScoreCard
            label="ACoS"
            value={fmtPct(curr.acos)}
            prevLabel={`Prev: ${fmtPct(prev.acos)}`}
            wow={acosWow}
            topColor={curr.acos === null ? '#374151' : curr.acos < 0.35 ? '#22C55E' : curr.acos < 0.55 ? '#F59E0B' : '#EF4444'}
          />
          <ScoreCard label="ROAS" value={fmtRoas(curr.roas)} prevLabel={`Prev: ${fmtRoas(prev.roas)}`} wow={roasWow} topColor={(curr.roas ?? 0) >= (prev.roas ?? 0) ? '#22C55E' : '#EF4444'} />
          <ScoreCard label="Organic Sales" value={fmtDollar(curr.organicSales)} prevLabel={`Prev: ${fmtDollar(prev.organicSales)}`} wow={organicWow} topColor={curr.organicSales >= prev.organicSales ? '#22C55E' : '#EF4444'} />
        </div>

        {/* ── 8-WEEK TREND TABLE ─────────────────────────────── */}
        <SectionTitle>📈 Weekly Sales Trend (All Brands Combined)</SectionTitle>
        <TableChartToggle
          accentColor="#FFC220"
          tableContent={<RpdWalmartTrendTable weeks={weeks} />}
          chartContent={<TrendChart data={trendChartData} metrics={trendMetrics} notes={chartNotes} accentColor="#FFC220" />}
          impactContent={<ImpactView data={trendChartData} metrics={trendMetrics} notes={chartNotes} accentColor="#FFC220" />}
        />

        {/* ── BRAND BREAKDOWN TABLE ──────────────────────────── */}
        <SectionTitle>🏷️ Brand Breakdown — Current Week vs. Previous Week</SectionTitle>
        <TableChartToggle
          accentColor="#FFC220"
          tableContent={
            <div className="bg-dash-card border border-white/[0.08] rounded-lg overflow-hidden">
              <div className="table-scroll">
                <table className="w-full border-collapse text-[12px]">
                  <thead>
                    <tr className="bg-dash-card2 border-b border-white/[0.08]">
                      <th className="text-left px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.8px] text-gray-400 whitespace-nowrap">Brand</th>
                      <th className="text-right px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.8px] text-gray-400 whitespace-nowrap">Curr Sales</th>
                      <th className="text-right px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.8px] text-gray-400 whitespace-nowrap">Prev Sales</th>
                      <th className="text-right px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.8px] text-gray-400 whitespace-nowrap">WoW Δ%</th>
                      <th className="text-right px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.8px] text-gray-400 whitespace-nowrap">Units</th>
                      <th className="text-right px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.8px] text-gray-400 whitespace-nowrap">Ad Spend</th>
                      <th className="text-right px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.8px] text-gray-400 whitespace-nowrap">Ad Sales</th>
                      <th className="text-right px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.8px] text-gray-400 whitespace-nowrap">ACoS</th>
                      <th className="text-right px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.8px] text-gray-400 whitespace-nowrap">ROAS</th>
                      <th className="text-right px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.8px] text-gray-400 whitespace-nowrap">Organic</th>
                    </tr>
                  </thead>
                  <tbody>
                    {brandRows.map(({ name, curr: c, prev: p }) => {
                      const currSales = c?.sales ?? 0;
                      const prevSales = p?.sales ?? 0;
                      const salesWowVal = wowPct(currSales, prevSales);
                      const wow = wowArrow(salesWowVal);
                      const acos = c?.acos ?? null;
                      const flagAcos = acos !== null && acos > 0.7;
                      const flagZeroSalesSpend = (c?.adSpend ?? 0) > 0 && currSales === 0;
                      const flagged = flagAcos || flagZeroSalesSpend;
                      const flagReasons = [
                        flagAcos && acos !== null ? `ACoS at ${(acos * 100).toFixed(0)}% — above 70% threshold` : null,
                        flagZeroSalesSpend ? `${fmtDollar(c?.adSpend ?? 0)} ad spend with $0 sales` : null,
                      ].filter(Boolean).join(' · ');

                      return (
                        <tr key={name} className="border-b border-white/[0.05] hover:bg-white/[0.02] transition-colors last:border-0">
                          <td className="px-3.5 py-2.5 font-sans font-medium text-[13px] text-white whitespace-nowrap">
                            {flagged && <span className="mr-1.5 text-amber-400 cursor-help" title={flagReasons}>⚠️</span>}
                            {name}
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-mono text-[#E8EDF5]">{fmtDollar(currSales)}</td>
                          <td className="px-3.5 py-2.5 text-right font-mono text-gray-400">{fmtDollar(prevSales)}</td>
                          <td className={`px-3.5 py-2.5 text-right font-mono font-semibold ${wow.cls}`}>
                            {salesWowVal === null ? '—' : `${wow.symbol} ${Math.abs(salesWowVal * 100).toFixed(0)}%`}
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-mono text-[#E8EDF5]">{c?.units ?? 0}</td>
                          <td className="px-3.5 py-2.5 text-right font-mono text-[#E8EDF5]">{fmtDollar(c?.adSpend ?? 0)}</td>
                          <td className="px-3.5 py-2.5 text-right font-mono text-[#E8EDF5]">{c?.adSales ? fmtDollar(c.adSales) : '—'}</td>
                          <td className={`px-3.5 py-2.5 text-right font-mono font-semibold ${acosColorInline(acos)}`}>{acos !== null && acos > 0 ? fmtPct(acos) : '—'}</td>
                          <td className="px-3.5 py-2.5 text-right font-mono text-[#E8EDF5]">{fmtRoas(c?.roas ?? null)}</td>
                          <td className="px-3.5 py-2.5 text-right font-mono text-[#E8EDF5]">{fmtDollar(c?.organicSales ?? 0)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          }
          chartContent={
            brandMetrics.length > 0
              ? <TrendChart data={brandChartData} metrics={brandMetrics} notes={chartNotes} accentColor="#FFC220" />
              : <div className="text-gray-500 text-sm p-4">No brand data available for chart.</div>
          }
          impactContent={<ImpactView data={brandChartData} metrics={brandMetrics} notes={chartNotes} accentColor="#FFC220" />}
        />

        {/* ── SEM CAMPAIGNS ──────────────────────────────────── */}
        <SectionTitle>🔎 SEM Campaigns (Sponsored Search)</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <ScoreCard label="SEM Ad Spend" value={fmtDollar(semData.currentWeek.adSpend)} prevLabel={`Prev: ${fmtDollar(semData.previousWeek.adSpend)}`} wow={wowArrow(wowPct(semData.currentWeek.adSpend, semData.previousWeek.adSpend), true)} topColor={semData.currentWeek.adSpend <= semData.previousWeek.adSpend ? '#22C55E' : '#EF4444'} />
          <ScoreCard label="SEM Ad Sales" value={fmtDollar(semData.currentWeek.adSales)} prevLabel={`Prev: ${fmtDollar(semData.previousWeek.adSales)}`} wow={wowArrow(wowPct(semData.currentWeek.adSales, semData.previousWeek.adSales))} topColor={semData.currentWeek.adSales >= semData.previousWeek.adSales ? '#22C55E' : '#EF4444'} />
          <ScoreCard label="SEM ACoS" value={fmtPct(semData.currentWeek.acos)} prevLabel={`Prev: ${fmtPct(semData.previousWeek.acos)}`} wow={acosWowArrow(semData.currentWeek.acos, semData.previousWeek.acos)} topColor={semData.currentWeek.acos === null ? '#374151' : semData.currentWeek.acos < 0.35 ? '#22C55E' : semData.currentWeek.acos < 0.55 ? '#F59E0B' : '#EF4444'} />
          <ScoreCard label="SEM ROAS" value={fmtRoas(semData.currentWeek.roas)} prevLabel={`Prev: ${fmtRoas(semData.previousWeek.roas)}`} wow={wowArrow(wowPct(semData.currentWeek.roas ?? 0, semData.previousWeek.roas ?? 0))} topColor={(semData.currentWeek.roas ?? 0) >= (semData.previousWeek.roas ?? 0) ? '#22C55E' : '#EF4444'} />
        </div>

        <TableChartToggle
          accentColor="#FFC220"
          tableContent={(() => {
            const prevSemMap = new Map(semData.previousWeek.campaigns.map((c) => [c.campaign, c]));
            const semRows = semData.currentWeek.campaigns
              .filter((c) => c.adSpend > 0 || c.adSales > 0)
              .sort((a, b) => b.adSpend - a.adSpend)
              .map((c) => ({ curr: c, prev: prevSemMap.get(c.campaign) ?? null }));

            return (
              <div className="bg-dash-card border border-white/[0.08] rounded-lg overflow-hidden mb-2">
                <div className="table-scroll">
                  <table className="w-full border-collapse text-[12px]">
                    <thead>
                      <tr className="bg-dash-card2 border-b border-white/[0.08]">
                        <th className="text-left px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.8px] text-gray-400 whitespace-nowrap">Campaign</th>
                        <th className="text-right px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.8px] text-gray-400 whitespace-nowrap">Ad Spend</th>
                        <th className="text-right px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.8px] text-gray-400 whitespace-nowrap">Prev Spend</th>
                        <th className="text-right px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.8px] text-gray-400 whitespace-nowrap">WoW Δ%</th>
                        <th className="text-right px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.8px] text-gray-400 whitespace-nowrap">Ad Sales</th>
                        <th className="text-right px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.8px] text-gray-400 whitespace-nowrap">Prev Ad Sales</th>
                        <th className="text-right px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.8px] text-gray-400 whitespace-nowrap">ACoS</th>
                        <th className="text-right px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.8px] text-gray-400 whitespace-nowrap">ROAS</th>
                        <th className="text-right px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.8px] text-gray-400 whitespace-nowrap">Impressions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {semRows.map(({ curr: c, prev: p }) => {
                        const spendWowVal = wowPct(c.adSpend, p?.adSpend ?? 0);
                        const spendWow = wowArrow(spendWowVal, true);
                        return (
                          <tr key={c.campaign} className="border-b border-white/[0.05] hover:bg-white/[0.02] transition-colors last:border-0">
                            <td className="px-3.5 py-2.5 font-sans font-medium text-[13px] text-white">{c.displayName}</td>
                            <td className="px-3.5 py-2.5 text-right font-mono text-[#E8EDF5]">{fmtDollar(c.adSpend)}</td>
                            <td className="px-3.5 py-2.5 text-right font-mono text-gray-400">{p ? fmtDollar(p.adSpend) : '—'}</td>
                            <td className={`px-3.5 py-2.5 text-right font-mono font-semibold ${spendWow.cls}`}>
                              {spendWowVal === null ? '—' : `${spendWow.symbol} ${Math.abs(spendWowVal * 100).toFixed(0)}%`}
                            </td>
                            <td className="px-3.5 py-2.5 text-right font-mono text-[#E8EDF5]">{c.adSales > 0 ? fmtDollar(c.adSales) : '—'}</td>
                            <td className="px-3.5 py-2.5 text-right font-mono text-gray-400">{p && p.adSales > 0 ? fmtDollar(p.adSales) : '—'}</td>
                            <td className={`px-3.5 py-2.5 text-right font-mono font-semibold ${acosColorInline(c.acos)}`}>{c.acos !== null && c.acos > 0 ? fmtPct(c.acos) : '—'}</td>
                            <td className="px-3.5 py-2.5 text-right font-mono text-[#E8EDF5]">{fmtRoas(c.roas)}</td>
                            <td className="px-3.5 py-2.5 text-right font-mono text-gray-400">{c.impressions > 0 ? c.impressions.toLocaleString('en-US') : '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
          chartContent={<TrendChart data={semChartData} metrics={semMetrics} notes={chartNotes} accentColor="#FFC220" />}
          impactContent={<ImpactView data={semChartData} metrics={semMetrics} notes={chartNotes} accentColor="#FFC220" />}
        />

        {/* ── WINS & ALERTS ──────────────────────────────────── */}
        <SectionTitle>🔍 Wins &amp; Alerts</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-dash-card border border-white/[0.08] border-l-[3px] border-l-green-400 rounded-lg p-5">
            <div className="text-[11px] font-bold uppercase tracking-[0.8px] text-green-400 mb-4">🟢 Wins This Week</div>
            {wins.length === 0 ? (
              <p className="text-[13px] text-gray-500">No wins detected this week.</p>
            ) : (
              <ul className="space-y-3">
                {wins.map((w, i) => (
                  <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed">
                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                    <div><strong className="text-white">{w.brand}</strong>{' — '}<span className="text-[#C8D5E8]">{w.message}</span></div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="bg-dash-card border border-white/[0.08] border-l-[3px] border-l-red-500 rounded-lg p-5">
            <div className="text-[11px] font-bold uppercase tracking-[0.8px] text-red-400 mb-4">🔴 Watch / Action Required</div>
            {alerts.length === 0 ? (
              <p className="text-[13px] text-gray-500">No alerts detected this week.</p>
            ) : (
              <ul className="space-y-3">
                {alerts.map((a, i) => (
                  <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed">
                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                    <div><strong className="text-white">{a.brand}</strong>{' — '}<span className="text-[#C8D5E8]">{a.message}</span></div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* ── NOTES ──────────────────────────────────────────── */}
        <NotesSection company="rpd-walmart" />

        {/* ── FOOTER ─────────────────────────────────────────── */}
        <footer className="mt-12 pt-5 border-t border-white/[0.08] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 font-mono text-[11px] text-gray-500">
          <span>Ideal Living · Walmart Ads Report · Generated {today}</span>
          <span>Sources: Walmart Seller Center · Intentwise · SEM Dashboard</span>
        </footer>

      </div>
    </main>
  );
}
