export const dynamic = 'force-dynamic';

import { parseElevateData, type ElevateWeekData, type ElevateWalmartWeekData } from '@/lib/parseElevate';
import { wowPct, fmtDollar, fmtPct, fmtRoas } from '@/lib/parseExcel';
import UploadBar from '@/components/UploadBar';
import NotesSection from '@/components/NotesSection';

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

// ─── Amazon trend table ───────────────────────────────────────────────────────

function AmazonTrendTable({ weeks }: { weeks: ElevateWeekData[] }) {
  const display = weeks.slice(-8);
  const current = display[display.length - 1];

  return (
    <div className="bg-dash-card border border-white/[0.08] rounded-lg overflow-hidden">
      <div className="table-scroll">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="bg-dash-card2 border-b border-white/[0.08]">
              {['Week', 'Sales', 'Units', 'Orders', 'Sessions', 'Conv. Rate', 'Ad Spend', 'Ad Sales', 'ACoS', 'ROAS'].map((h) => (
                <th key={h} className={`${h === 'Week' ? 'text-left' : 'text-right'} px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.8px] text-gray-400 whitespace-nowrap`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {display.map((week) => {
              const isCurrent = week.label === current.label;
              const rowCls = isCurrent ? 'bg-[#FF9900]/10 border-b border-white/[0.08]' : 'border-b border-white/[0.05] hover:bg-white/[0.02] transition-colors';
              const cellCls = isCurrent ? 'text-orange-200 font-semibold' : 'text-[#E8EDF5]';
              return (
                <tr key={week.label} className={rowCls}>
                  <td className={`px-3.5 py-2.5 font-sans font-medium text-[13px] whitespace-nowrap ${isCurrent ? 'text-orange-400 font-semibold' : 'text-white'}`}>
                    {isCurrent ? (
                      <>
                        ▶ {week.label}
                        {week.startDate && <span className="block text-[10px] text-gray-500 font-mono font-normal">{week.startDate}{week.endDate && week.endDate !== week.startDate ? ` – ${week.endDate}` : ''}</span>}
                      </>
                    ) : week.label}
                  </td>
                  <td className={`px-3.5 py-2.5 text-right font-mono ${cellCls}`}>{fmtDollar(week.sales)}</td>
                  <td className={`px-3.5 py-2.5 text-right font-mono ${cellCls}`}>{formatNumber(week.units)}</td>
                  <td className={`px-3.5 py-2.5 text-right font-mono ${cellCls}`}>{formatNumber(week.orders)}</td>
                  <td className={`px-3.5 py-2.5 text-right font-mono ${cellCls}`}>{formatNumber(week.sessions)}</td>
                  <td className={`px-3.5 py-2.5 text-right font-mono ${cellCls}`}>{week.conversionRate !== null ? fmtPct(week.conversionRate) : '—'}</td>
                  <td className={`px-3.5 py-2.5 text-right font-mono ${cellCls}`}>{fmtDollar(week.adSpend)}</td>
                  <td className={`px-3.5 py-2.5 text-right font-mono ${cellCls}`}>{fmtDollar(week.adSales)}</td>
                  <td className={`px-3.5 py-2.5 text-right font-mono font-semibold ${acosColor(week.acos)}`}>{fmtPct(week.acos)}</td>
                  <td className={`px-3.5 py-2.5 text-right font-mono ${cellCls}`}>{fmtRoas(week.roas)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Walmart trend table ──────────────────────────────────────────────────────

function WalmartTrendTable({ weeks }: { weeks: ElevateWalmartWeekData[] }) {
  const display = weeks.slice(-8);
  const current = display[display.length - 1];

  return (
    <div className="bg-dash-card border border-white/[0.08] rounded-lg overflow-hidden">
      <div className="table-scroll">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="bg-dash-card2 border-b border-white/[0.08]">
              {['Week', 'Sales', 'Units', 'Ad Spend', 'Ad Sales', 'ACoS', 'ROAS', 'Organic'].map((h) => (
                <th key={h} className={`${h === 'Week' ? 'text-left' : 'text-right'} px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.8px] text-gray-400 whitespace-nowrap`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {display.map((week) => {
              const isCurrent = week.label === current.label;
              const rowCls = isCurrent ? 'bg-[#0071CE]/10 border-b border-white/[0.08]' : 'border-b border-white/[0.05] hover:bg-white/[0.02] transition-colors';
              const cellCls = isCurrent ? 'text-blue-200 font-semibold' : 'text-[#E8EDF5]';
              return (
                <tr key={week.label} className={rowCls}>
                  <td className={`px-3.5 py-2.5 font-sans font-medium text-[13px] whitespace-nowrap ${isCurrent ? 'text-blue-400 font-semibold' : 'text-white'}`}>
                    {isCurrent ? (
                      <>
                        ▶ {week.label}
                        {week.startDate && <span className="block text-[10px] text-gray-500 font-mono font-normal">{week.startDate}{week.endDate && week.endDate !== week.startDate ? ` – ${week.endDate}` : ''}</span>}
                      </>
                    ) : week.label}
                  </td>
                  <td className={`px-3.5 py-2.5 text-right font-mono ${cellCls}`}>{fmtDollar(week.sales)}</td>
                  <td className={`px-3.5 py-2.5 text-right font-mono ${cellCls}`}>{formatNumber(week.units)}</td>
                  <td className={`px-3.5 py-2.5 text-right font-mono ${cellCls}`}>{fmtDollar(week.adSpend)}</td>
                  <td className={`px-3.5 py-2.5 text-right font-mono ${cellCls}`}>{fmtDollar(week.adSales)}</td>
                  <td className={`px-3.5 py-2.5 text-right font-mono font-semibold ${acosColor(week.acos)}`}>{fmtPct(week.acos)}</td>
                  <td className={`px-3.5 py-2.5 text-right font-mono ${cellCls}`}>{fmtRoas(week.roas)}</td>
                  <td className={`px-3.5 py-2.5 text-right font-mono ${cellCls}`}>{fmtDollar(week.organicSales)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ElevatePage() {
  let data;
  let parseError: string | null = null;

  try {
    data = parseElevateData();
  } catch (err) {
    parseError = err instanceof Error ? err.message : 'Failed to load data';
  }

  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  if (parseError || !data) {
    return (
      <main className="min-h-screen px-4 sm:px-6 py-10">
        <div className="max-w-[1100px] mx-auto">
          <UploadBar company="elevate" />
          <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-6 text-amber-300">
            <p className="font-semibold mb-1">No data file found</p>
            <p className="text-[13px] text-amber-400/80">{parseError ?? 'Upload an Excel file to generate the report.'}</p>
          </div>
        </div>
      </main>
    );
  }

  const { amazon, walmart, sem } = data;
  const amzCurr = amazon.currentWeek;
  const amzPrev = amazon.previousWeek;
  const walmCurr = walmart.currentWeek;
  const walmPrev = walmart.previousWeek;
  const semCurr = sem.currentWeek;
  const semPrev = sem.previousWeek;

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
        <AmazonTrendTable weeks={amazon.weeks} />

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
        <WalmartTrendTable weeks={walmart.weeks} />

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
        {semCurr.campaigns.filter((c) => c.adSpend > 0 || c.adSales > 0).length > 0 && (() => {
          const prevMap = new Map(semPrev.campaigns.map((c) => [c.campaign, c]));
          const rows = semCurr.campaigns
            .filter((c) => c.adSpend > 0 || c.adSales > 0)
            .sort((a, b) => b.adSpend - a.adSpend)
            .map((c) => ({ curr: c, prev: prevMap.get(c.campaign) ?? null }));
          return (
            <div className="bg-dash-card border border-white/[0.08] rounded-lg overflow-hidden mb-2">
              <div className="table-scroll">
                <table className="w-full border-collapse text-[12px]">
                  <thead>
                    <tr className="bg-dash-card2 border-b border-white/[0.08]">
                      {['Campaign', 'Ad Spend', 'Prev Spend', 'WoW Δ%', 'Ad Sales', 'ACoS', 'ROAS', 'Impressions'].map((h) => (
                        <th key={h} className={`${h === 'Campaign' ? 'text-left' : 'text-right'} px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.8px] text-gray-400 whitespace-nowrap`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ curr: c, prev: p }) => {
                      const spendWowVal = wowPct(c.adSpend, p?.adSpend ?? 0);
                      const spendWow = wowArrow(spendWowVal, true);
                      return (
                        <tr key={c.campaign} className="border-b border-white/[0.05] hover:bg-white/[0.02] transition-colors last:border-0">
                          <td className="px-3.5 py-2.5 font-sans font-medium text-[13px] text-white">{c.campaign}</td>
                          <td className="px-3.5 py-2.5 text-right font-mono text-[#E8EDF5]">{fmtDollar(c.adSpend)}</td>
                          <td className="px-3.5 py-2.5 text-right font-mono text-gray-400">{p ? fmtDollar(p.adSpend) : '—'}</td>
                          <td className={`px-3.5 py-2.5 text-right font-mono font-semibold ${spendWow.cls}`}>{spendWowVal === null ? '—' : `${spendWow.symbol} ${Math.abs(spendWowVal * 100).toFixed(0)}%`}</td>
                          <td className="px-3.5 py-2.5 text-right font-mono text-[#E8EDF5]">{c.adSales > 0 ? fmtDollar(c.adSales) : '—'}</td>
                          <td className={`px-3.5 py-2.5 text-right font-mono font-semibold ${acosColor(c.acos)}`}>{c.acos !== null && c.acos > 0 ? fmtPct(c.acos) : '—'}</td>
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

        {/* ── NOTES ──────────────────────────────────────────── */}
        <NotesSection company="elevate" />

        {/* ── FOOTER ─────────────────────────────────────────── */}
        <footer className="mt-12 pt-5 border-t border-white/[0.08] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 font-mono text-[11px] text-gray-500">
          <span>Elevate Beverages · Multi-Platform Report · Generated {today}</span>
          <span>Sources: Amazon Seller Central · Walmart Seller Center · SEM Dashboard</span>
        </footer>

      </div>
    </main>
  );
}
