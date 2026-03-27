export const dynamic = 'force-dynamic';

import { parseElevateData } from '@/lib/parseElevate';
import { wowPct, fmtDollar, fmtPct, fmtRoas } from '@/lib/parseExcel';
import UploadBar from '@/components/UploadBar';
import NotesSection from '@/components/NotesSection';
import { ElevateAmazonTrendTable, ElevateWalmartTrendTable } from '@/components/ElevateTrendTables';
import TableChartToggle from '@/components/TableChartToggle';
import TrendChart, { type ChartMetric, type ChartDataPoint, type ChartNote } from '@/components/TrendChart';
import ImpactView from '@/components/ImpactView';
import SortableTable from '@/components/SortableTable';
import { readNotes, type Note } from '@/lib/notes';

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function acosColor(acos: number | null): string {
  if (acos === null) return 'text-gray-500';
  if (acos < 0.35) return 'text-green-400';
  if (acos <= 0.55) return 'text-amber-400';
  return 'text-red-400';
}

// ─── Wins & Alerts ───────────────────────────────────────────────────────────

interface ElevateAlert { platform: string; message: string; }

function generateElevateWinsAlerts(
  platforms: Array<{
    name: string;
    currSales: number; prevSales: number;
    currAcos: number | null; currRoas: number | null;
    currAdSpend: number; currAdSales: number;
  }>
): { wins: ElevateAlert[]; alerts: ElevateAlert[] } {
  const wins: ElevateAlert[] = [];
  const alerts: ElevateAlert[] = [];

  for (const p of platforms) {
    const salesWow = wowPct(p.currSales, p.prevSales);
    if (salesWow !== null && salesWow > 0.2)
      wins.push({ platform: p.name, message: `Sales up ${(salesWow * 100).toFixed(0)}% WoW (${fmtDollar(p.prevSales)} → ${fmtDollar(p.currSales)})` });
    if (p.currAcos !== null && p.currAcos > 0 && p.currAcos < 0.25)
      wins.push({ platform: p.name, message: `Efficient ACoS of ${(p.currAcos * 100).toFixed(1)}% — ROAS ${fmtRoas(p.currRoas)}` });
    if (p.currAcos !== null && p.currAcos > 0.7)
      alerts.push({ platform: p.name, message: `ACoS at ${(p.currAcos * 100).toFixed(0)}% — review bids` });
    if (salesWow !== null && salesWow < -0.3)
      alerts.push({ platform: p.name, message: `Sales down ${Math.abs(salesWow * 100).toFixed(0)}% WoW (${fmtDollar(p.prevSales)} → ${fmtDollar(p.currSales)})` });
    if (p.currAdSpend > 0 && p.currAdSales === 0)
      alerts.push({ platform: p.name, message: `${fmtDollar(p.currAdSpend)} ad spend with $0 ad sales — review campaigns` });
  }

  return { wins, alerts };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-bold uppercase tracking-[1.5px] text-[#FFC220] mb-4 mt-9 first:mt-0">
      {children}
    </div>
  );
}

function PlatformDivider({ title, color }: { title: string; color: string }) {
  return (
    <div className="flex items-center gap-3 mt-10 mb-2">
      <div className="flex-1 h-px bg-white/[0.06]" />
      <span className="text-[11px] font-bold uppercase tracking-[2px] px-3 py-1 rounded-full border" style={{ color, borderColor: `${color}40` }}>
        {title}
      </span>
      <div className="flex-1 h-px bg-white/[0.06]" />
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ElevatePage() {
  let data;
  let parseError: string | null = null;

  try {
    data = await parseElevateData();
  } catch (err) {
    parseError = err instanceof Error ? err.message : 'Failed to load data';
  }

  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  let notes: Note[] = [];
  try { notes = await readNotes('elevate'); } catch { /* ignore */ }

  if (parseError || !data) {
    return (
      <main className="min-h-screen px-4 sm:px-6 py-10">
        <div className="max-w-[1100px] mx-auto">
          <UploadBar company="elevate" />
          <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-6 text-amber-300">
            <p className="font-semibold mb-1">No data file found</p>
            <p className="text-[13px] text-amber-400/80">{parseError ?? 'Upload an Excel file to generate the report.'}</p>
          </div>
          <NotesSection company="elevate" initialNotes={notes} />
        </div>
      </main>
    );
  }

  const { amazon, walmart, sem } = data;

  // ── Chart data prep ──
  // Helper to map notes to weeks
  function mapNotesToWeeks(weekData: Array<{ label: string; startDate?: string; endDate?: string }>): ChartNote[] {
    return notes.flatMap((n) => {
      const noteDate = new Date(n.date);
      if (isNaN(noteDate.getTime())) return [];
      for (const w of weekData) {
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
  }

  // Amazon chart
  const amazonMetrics: ChartMetric[] = [
    { key: 'sales', label: 'Total Sales', color: '#22C55E', yAxisId: 'dollar', formatType: 'dollar', defaultVisible: true },
    { key: 'adSpend', label: 'Ad Spend', color: '#EF4444', yAxisId: 'dollar', formatType: 'dollar', defaultVisible: true },
    { key: 'adSales', label: 'Ad Sales', color: '#3B82F6', yAxisId: 'dollar', formatType: 'dollar', defaultVisible: true },
    { key: 'units', label: 'Units', color: '#06B6D4', yAxisId: 'count', formatType: 'number', defaultVisible: false },
    { key: 'orders', label: 'Orders', color: '#EC4899', yAxisId: 'count', formatType: 'number', defaultVisible: false },
    { key: 'sessions', label: 'Sessions', color: '#A855F7', yAxisId: 'count', formatType: 'number', defaultVisible: false },
    { key: 'acos', label: 'ACoS', color: '#F59E0B', yAxisId: 'pct', formatType: 'pct', defaultVisible: true },
    { key: 'roas', label: 'ROAS', color: '#8B5CF6', yAxisId: 'pct', formatType: 'roas' },
  ];

  const amazonChartData: ChartDataPoint[] = amazon.weeks.map((w) => ({
    label: w.startDate ? `${w.startDate}` : w.label,
    sales: w.sales,
    adSpend: w.adSpend,
    adSales: w.adSales,
    units: w.units,
    orders: w.orders,
    sessions: w.sessions,
    acos: w.acos !== null ? w.acos * 100 : null,
    roas: w.roas,
  }));

  const amazonChartNotes = mapNotesToWeeks(amazon.weeks);

  // Walmart chart
  const walmartMetrics: ChartMetric[] = [
    { key: 'sales', label: 'Total Sales', color: '#22C55E', yAxisId: 'dollar', formatType: 'dollar', defaultVisible: true },
    { key: 'adSpend', label: 'Ad Spend', color: '#EF4444', yAxisId: 'dollar', formatType: 'dollar', defaultVisible: true },
    { key: 'adSales', label: 'Ad Sales', color: '#3B82F6', yAxisId: 'dollar', formatType: 'dollar', defaultVisible: true },
    { key: 'organicSales', label: 'Organic Sales', color: '#A855F7', yAxisId: 'dollar', formatType: 'dollar', defaultVisible: false },
    { key: 'units', label: 'Units', color: '#06B6D4', yAxisId: 'count', formatType: 'number', defaultVisible: false },
    { key: 'acos', label: 'ACoS', color: '#F59E0B', yAxisId: 'pct', formatType: 'pct', defaultVisible: true },
    { key: 'roas', label: 'ROAS', color: '#8B5CF6', yAxisId: 'pct', formatType: 'roas' },
  ];

  const walmartChartData: ChartDataPoint[] = walmart.weeks.map((w) => ({
    label: w.startDate ? `${w.startDate}` : w.label,
    sales: w.sales,
    adSpend: w.adSpend,
    adSales: w.adSales,
    organicSales: w.organicSales,
    units: w.units,
    acos: w.acos !== null ? w.acos * 100 : null,
    roas: w.roas,
  }));

  const walmartChartNotes = mapNotesToWeeks(walmart.weeks);

  // SEM chart
  const semMetrics: ChartMetric[] = [
    { key: 'adSpend', label: 'Ad Spend', color: '#EF4444', yAxisId: 'dollar', formatType: 'dollar', defaultVisible: true },
    { key: 'adSales', label: 'Ad Sales', color: '#3B82F6', yAxisId: 'dollar', formatType: 'dollar', defaultVisible: true },
    { key: 'acos', label: 'ACoS', color: '#F59E0B', yAxisId: 'pct', formatType: 'pct', defaultVisible: true },
    { key: 'roas', label: 'ROAS', color: '#8B5CF6', yAxisId: 'pct', formatType: 'roas' },
    { key: 'impressions', label: 'Impressions', color: '#06B6D4', yAxisId: 'count', formatType: 'number', defaultVisible: false },
  ];

  const amzCurr = amazon.currentWeek;
  const amzPrev = amazon.previousWeek;
  const walmCurr = walmart.currentWeek;
  const walmPrev = walmart.previousWeek;
  const semCurr = sem.currentWeek;
  const semPrev = sem.previousWeek;

  const semChartData: ChartDataPoint[] = [
    {
      label: 'Previous Week',
      adSpend: semPrev.adSpend,
      adSales: semPrev.adSales,
      acos: semPrev.acos !== null ? semPrev.acos * 100 : null,
      roas: semPrev.roas,
      impressions: semPrev.impressions,
    },
    {
      label: 'Current Week',
      adSpend: semCurr.adSpend,
      adSales: semCurr.adSales,
      acos: semCurr.acos !== null ? semCurr.acos * 100 : null,
      roas: semCurr.roas,
      impressions: semCurr.impressions,
    },
  ];

  // Amazon WoW
  const amzSalesWow = wowArrow(wowPct(amzCurr.sales, amzPrev.sales));
  const amzUnitsWow = wowArrow(wowPct(amzCurr.units, amzPrev.units));
  const amzOrdersWow = wowArrow(wowPct(amzCurr.orders, amzPrev.orders));
  const amzSessionsWow = wowArrow(wowPct(amzCurr.sessions, amzPrev.sessions));
  const amzAdSpendWow = wowArrow(wowPct(amzCurr.adSpend, amzPrev.adSpend), true);
  const amzAdSalesWow = wowArrow(wowPct(amzCurr.adSales, amzPrev.adSales));
  const amzAcosWow = acosWowArrow(amzCurr.acos, amzPrev.acos);
  const amzRoasWow = wowArrow(wowPct(amzCurr.roas ?? 0, amzPrev.roas ?? 0));

  // Walmart WoW
  const walmSalesWow = wowArrow(wowPct(walmCurr.sales, walmPrev.sales));
  const walmUnitsWow = wowArrow(wowPct(walmCurr.units, walmPrev.units));
  const walmAdSpendWow = wowArrow(wowPct(walmCurr.adSpend, walmPrev.adSpend), true);
  const walmAdSalesWow = wowArrow(wowPct(walmCurr.adSales, walmPrev.adSales));
  const walmAcosWow = acosWowArrow(walmCurr.acos, walmPrev.acos);
  const walmRoasWow = wowArrow(wowPct(walmCurr.roas ?? 0, walmPrev.roas ?? 0));
  const walmOrganicWow = wowArrow(wowPct(walmCurr.organicSales, walmPrev.organicSales));

  const { wins, alerts } = generateElevateWinsAlerts([
    { name: 'Amazon', currSales: amzCurr.sales, prevSales: amzPrev.sales, currAcos: amzCurr.acos, currRoas: amzCurr.roas, currAdSpend: amzCurr.adSpend, currAdSales: amzCurr.adSales },
    { name: 'Walmart', currSales: walmCurr.sales, prevSales: walmPrev.sales, currAcos: walmCurr.acos, currRoas: walmCurr.roas, currAdSpend: walmCurr.adSpend, currAdSales: walmCurr.adSales },
    { name: 'SEM', currSales: semCurr.adSales, prevSales: semPrev.adSales, currAcos: semCurr.acos, currRoas: semCurr.roas, currAdSpend: semCurr.adSpend, currAdSales: semCurr.adSales },
  ]);

  return (
    <main className="min-h-screen px-4 sm:px-6 py-10">
      <div className="max-w-[1100px] mx-auto">

        <UploadBar company="elevate" />

{/* ── HEADER ─────────────────────────────────────────── */}
        <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-10 pb-6 border-b border-white/[0.08]">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="w-8 h-8 rounded-full bg-[#FF9900] flex items-center justify-center text-white font-bold text-sm leading-none select-none">
                E
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Elevate Beverages
              </h1>
            </div>
            <p className="text-sm text-gray-400">
              Multi-Platform Advertising &amp; Sales — Weekly Performance Report
            </p>
            <div className="inline-flex items-center gap-1.5 mt-2 bg-[#FF9900]/10 border border-[#FF9900]/30 text-orange-400 px-2.5 py-1 rounded text-[11px] font-mono">
              ⚡ Amazon · Walmart · SEM
            </div>
          </div>
          <div className="text-right font-mono text-[12px] text-gray-400">
            <div className="text-[14px] font-semibold text-[#E8EDF5] mb-0.5">Current Week Report</div>
            <div>Generated: {today}</div>
            <div>{amzCurr.label}</div>
          </div>
        </header>

        {/* ══════════════════════════════════════════════════════ */}
        <PlatformDivider title="Amazon" color="#FF9900" />

        {/* ── AMAZON SCORECARD ───────────────────────────────── */}
        <SectionTitle>📊 Amazon Weekly Scorecard</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-2">
          <ScoreCard label="Total Sales" value={fmtDollar(amzCurr.sales)} prevLabel={`Prev: ${fmtDollar(amzPrev.sales)}`} wow={amzSalesWow} topColor={amzCurr.sales >= amzPrev.sales ? '#22C55E' : '#EF4444'} />
          <ScoreCard label="Units Sold" value={formatNumber(amzCurr.units)} prevLabel={`Prev: ${formatNumber(amzPrev.units)}`} wow={amzUnitsWow} topColor={amzCurr.units >= amzPrev.units ? '#22C55E' : '#EF4444'} />
          <ScoreCard label="Orders" value={formatNumber(amzCurr.orders)} prevLabel={`Prev: ${formatNumber(amzPrev.orders)}`} wow={amzOrdersWow} topColor={amzCurr.orders >= amzPrev.orders ? '#22C55E' : '#EF4444'} />
          <ScoreCard label="Sessions" value={formatNumber(amzCurr.sessions)} prevLabel={`Prev: ${formatNumber(amzPrev.sessions)}`} wow={amzSessionsWow} topColor={amzCurr.sessions >= amzPrev.sessions ? '#22C55E' : '#EF4444'} />
          <ScoreCard label="Ad Spend" value={fmtDollar(amzCurr.adSpend)} prevLabel={`Prev: ${fmtDollar(amzPrev.adSpend)}`} wow={amzAdSpendWow} topColor={amzCurr.adSpend <= amzPrev.adSpend ? '#22C55E' : '#EF4444'} />
          <ScoreCard label="Ad Sales" value={fmtDollar(amzCurr.adSales)} prevLabel={`Prev: ${fmtDollar(amzPrev.adSales)}`} wow={amzAdSalesWow} topColor={amzCurr.adSales >= amzPrev.adSales ? '#22C55E' : '#EF4444'} />
          <ScoreCard label="ACoS" value={fmtPct(amzCurr.acos)} prevLabel={`Prev: ${fmtPct(amzPrev.acos)}`} wow={amzAcosWow} topColor={amzCurr.acos === null ? '#374151' : amzCurr.acos < 0.35 ? '#22C55E' : amzCurr.acos < 0.55 ? '#F59E0B' : '#EF4444'} />
          <ScoreCard label="ROAS" value={fmtRoas(amzCurr.roas)} prevLabel={`Prev: ${fmtRoas(amzPrev.roas)}`} wow={amzRoasWow} topColor={(amzCurr.roas ?? 0) >= (amzPrev.roas ?? 0) ? '#22C55E' : '#EF4444'} />
        </div>

        {/* ── AMAZON TREND TABLE ─────────────────────────────── */}
        <SectionTitle>📈 Amazon Weekly Trend</SectionTitle>
        <TableChartToggle
          accentColor="#FF9900"
          tableContent={<ElevateAmazonTrendTable weeks={amazon.weeks} />}
          chartContent={<TrendChart data={amazonChartData} metrics={amazonMetrics} notes={amazonChartNotes} accentColor="#FF9900" />}
          impactContent={<ImpactView data={amazonChartData} metrics={amazonMetrics} notes={amazonChartNotes} accentColor="#FF9900" />}
        />

        {/* ══════════════════════════════════════════════════════ */}
        <PlatformDivider title="Walmart" color="#0071CE" />

        {/* ── WALMART SCORECARD ──────────────────────────────── */}
        <SectionTitle>📊 Walmart Weekly Scorecard</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-2">
          <ScoreCard label="Total Sales" value={fmtDollar(walmCurr.sales)} prevLabel={`Prev: ${fmtDollar(walmPrev.sales)}`} wow={walmSalesWow} topColor={walmCurr.sales >= walmPrev.sales ? '#22C55E' : '#EF4444'} />
          <ScoreCard label="Units Sold" value={formatNumber(walmCurr.units)} prevLabel={`Prev: ${formatNumber(walmPrev.units)}`} wow={walmUnitsWow} topColor={walmCurr.units >= walmPrev.units ? '#22C55E' : '#EF4444'} />
          <ScoreCard label="Ad Spend" value={fmtDollar(walmCurr.adSpend)} prevLabel={`Prev: ${fmtDollar(walmPrev.adSpend)}`} wow={walmAdSpendWow} topColor={walmCurr.adSpend <= walmPrev.adSpend ? '#22C55E' : '#EF4444'} />
          <ScoreCard label="Ad Sales" value={fmtDollar(walmCurr.adSales)} prevLabel={`Prev: ${fmtDollar(walmPrev.adSales)}`} wow={walmAdSalesWow} topColor={walmCurr.adSales >= walmPrev.adSales ? '#22C55E' : '#EF4444'} />
          <ScoreCard label="ACoS" value={fmtPct(walmCurr.acos)} prevLabel={`Prev: ${fmtPct(walmPrev.acos)}`} wow={walmAcosWow} topColor={walmCurr.acos === null ? '#374151' : walmCurr.acos < 0.35 ? '#22C55E' : walmCurr.acos < 0.55 ? '#F59E0B' : '#EF4444'} />
          <ScoreCard label="ROAS" value={fmtRoas(walmCurr.roas)} prevLabel={`Prev: ${fmtRoas(walmPrev.roas)}`} wow={walmRoasWow} topColor={(walmCurr.roas ?? 0) >= (walmPrev.roas ?? 0) ? '#22C55E' : '#EF4444'} />
          <ScoreCard label="Organic Sales" value={fmtDollar(walmCurr.organicSales)} prevLabel={`Prev: ${fmtDollar(walmPrev.organicSales)}`} wow={walmOrganicWow} topColor={walmCurr.organicSales >= walmPrev.organicSales ? '#22C55E' : '#EF4444'} />
        </div>

        {/* ── WALMART TREND TABLE ────────────────────────────── */}
        <SectionTitle>📈 Walmart Weekly Trend</SectionTitle>
        <TableChartToggle
          accentColor="#0071CE"
          tableContent={<ElevateWalmartTrendTable weeks={walmart.weeks} />}
          chartContent={<TrendChart data={walmartChartData} metrics={walmartMetrics} notes={walmartChartNotes} accentColor="#0071CE" />}
          impactContent={<ImpactView data={walmartChartData} metrics={walmartMetrics} notes={walmartChartNotes} accentColor="#0071CE" />}
        />

        {/* ══════════════════════════════════════════════════════ */}
        <PlatformDivider title="SEM Campaigns" color="#A855F7" />

        {/* ── SEM SCORECARDS ─────────────────────────────────── */}
        <SectionTitle>🔎 SEM Campaigns (Sponsored Search)</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <ScoreCard label="SEM Ad Spend" value={fmtDollar(semCurr.adSpend)} prevLabel={`Prev: ${fmtDollar(semPrev.adSpend)}`} wow={wowArrow(wowPct(semCurr.adSpend, semPrev.adSpend), true)} topColor={semCurr.adSpend <= semPrev.adSpend ? '#22C55E' : '#EF4444'} />
          <ScoreCard label="SEM Ad Sales" value={fmtDollar(semCurr.adSales)} prevLabel={`Prev: ${fmtDollar(semPrev.adSales)}`} wow={wowArrow(wowPct(semCurr.adSales, semPrev.adSales))} topColor={semCurr.adSales >= semPrev.adSales ? '#22C55E' : '#EF4444'} />
          <ScoreCard label="SEM ACoS" value={fmtPct(semCurr.acos)} prevLabel={`Prev: ${fmtPct(semPrev.acos)}`} wow={acosWowArrow(semCurr.acos, semPrev.acos)} topColor={semCurr.acos === null ? '#374151' : semCurr.acos < 0.35 ? '#22C55E' : semCurr.acos < 0.55 ? '#F59E0B' : '#EF4444'} />
          <ScoreCard label="SEM ROAS" value={fmtRoas(semCurr.roas)} prevLabel={`Prev: ${fmtRoas(semPrev.roas)}`} wow={wowArrow(wowPct(semCurr.roas ?? 0, semPrev.roas ?? 0))} topColor={(semCurr.roas ?? 0) >= (semPrev.roas ?? 0) ? '#22C55E' : '#EF4444'} />
        </div>

        {/* SEM Campaign Table */}
        <TableChartToggle
          accentColor="#A855F7"
          tableContent={
            semCurr.campaigns.filter((c) => c.adSpend > 0 || c.adSales > 0).length > 0 ? (() => {
              const prevMap = new Map(semPrev.campaigns.map((c) => [c.campaign, c]));
              const rows = semCurr.campaigns
                .filter((c) => c.adSpend > 0 || c.adSales > 0)
                .sort((a, b) => b.adSpend - a.adSpend)
                .map((c) => ({ curr: c, prev: prevMap.get(c.campaign) ?? null }));
              return (
                <div className="bg-dash-card border border-white/[0.08] rounded-lg overflow-hidden mb-2">
                  <SortableTable
                    columns={[
                      { key: 'campaign', label: 'Campaign' },
                      { key: 'adSpend', label: 'Ad Spend', align: 'right', type: 'currency' },
                      { key: 'prevSpend', label: 'Prev Spend', align: 'right', type: 'currency' },
                      { key: 'spendWow', label: 'WoW Δ%', align: 'right', type: 'percent' },
                      { key: 'adSales', label: 'Ad Sales', align: 'right', type: 'currency' },
                      { key: 'prevAdSales', label: 'Prev Ad Sales', align: 'right', type: 'currency' },
                      { key: 'acos', label: 'ACoS', align: 'right', type: 'percent' },
                      { key: 'roas', label: 'ROAS', align: 'right', type: 'roas' },
                      { key: 'impressions', label: 'Impressions', align: 'right', type: 'number' },
                    ]}
                    rows={rows.map(({ curr: c, prev: p }) => ({
                      rowId: c.campaign,
                      campaign: c.campaign,
                      adSpend: c.adSpend,
                      prevSpend: p?.adSpend ?? 0,
                      spendWow: wowPct(c.adSpend, p?.adSpend ?? 0),
                      adSales: c.adSales,
                      prevAdSales: p?.adSales ?? 0,
                      acos: c.acos,
                      roas: c.roas,
                      impressions: c.impressions,
                    }))}
                    rowKey="rowId"
                    defaultSortKey="adSpend"
                    defaultSortDir="desc"
                  />
                </div>
              );
            })() : null
          }
          chartContent={<TrendChart data={semChartData} metrics={semMetrics} accentColor="#A855F7" />}
          impactContent={<ImpactView data={semChartData} metrics={semMetrics} notes={[]} accentColor="#A855F7" />}
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
                    <div><strong className="text-white">{w.platform}</strong>{' — '}<span className="text-[#C8D5E8]">{w.message}</span></div>
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
                    <div><strong className="text-white">{a.platform}</strong>{' — '}<span className="text-[#C8D5E8]">{a.message}</span></div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* ── NOTES ──────────────────────────────────────────── */}
        <NotesSection company="elevate" initialNotes={notes} />

        {/* ── FOOTER ─────────────────────────────────────────── */}
        <footer className="mt-12 pt-5 border-t border-white/[0.08] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 font-mono text-[11px] text-gray-500">
          <span>Elevate Beverages · Multi-Platform Report · Generated {today}</span>
          <span>Sources: Amazon Seller Central · Walmart Seller Center · SEM Dashboard</span>
        </footer>

      </div>
    </main>
  );
}
