export const dynamic = 'force-dynamic';

import { parseRpdHdData, type RpdHdCampaignGroupData, type RetailerData, type RetailerWeekData } from '@/lib/parseRpdHd';
import { wowPct, fmtDollar, fmtPct, fmtRoas } from '@/lib/parseExcel';
import UploadBar from '@/components/UploadBar';
import NotesSection from '@/components/NotesSection';
import RpdHdTrendTable from '@/components/RpdHdTrendTable';
import RetailerTrendTable from '@/components/RetailerTrendTable';

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

interface ScoreCardProps {
  label: string;
  value: string;
  prevLabel: string;
  wow: { symbol: string; label: string; cls: string };
  topColor?: string;
  source?: string;
}

function ScoreCard({ label, value, prevLabel, wow, topColor, source }: ScoreCardProps) {
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
      {source && <div className="text-[9px] uppercase tracking-wide text-gray-600 mt-1">{source}</div>}
    </div>
  );
}

// ─── Wins & Alerts ─────────────────────────────────────────────────────────

interface Alert { group: string; message: string }

function generateWinsAlerts(
  currGroups: RpdHdCampaignGroupData[],
  prevGroups: RpdHdCampaignGroupData[]
): { wins: Alert[]; alerts: Alert[] } {
  const wins: Alert[] = [];
  const alerts: Alert[] = [];
  const prevMap = new Map(prevGroups.map((g) => [g.group, g]));

  for (const curr of currGroups) {
    const prev = prevMap.get(curr.group);
    const prevAdSales = prev?.adSales ?? 0;
    const adSalesWow = wowPct(curr.adSales, prevAdSales);

    if (adSalesWow !== null && adSalesWow > 0.2 && curr.adSales > 0) {
      wins.push({ group: curr.group, message: `Ad sales up ${(adSalesWow * 100).toFixed(0)}% WoW (${fmtDollar(prevAdSales)} → ${fmtDollar(curr.adSales)})` });
    }
    if (curr.acos !== null && curr.acos > 0 && curr.acos < 0.25) {
      wins.push({ group: curr.group, message: `Efficient ACoS of ${(curr.acos * 100).toFixed(1)}% — ROAS ${fmtRoas(curr.roas)}` });
    }
    if (curr.acos !== null && curr.acos > 0.7) {
      alerts.push({ group: curr.group, message: `ACoS at ${(curr.acos * 100).toFixed(0)}% — review bids` });
    }
    if (adSalesWow !== null && adSalesWow < -0.3 && prevAdSales > 0) {
      alerts.push({ group: curr.group, message: `Ad sales down ${Math.abs(adSalesWow * 100).toFixed(0)}% WoW (${fmtDollar(prevAdSales)} → ${fmtDollar(curr.adSales)})` });
    }
    if (curr.adSpend > 0 && curr.adSales === 0) {
      alerts.push({ group: curr.group, message: `${fmtDollar(curr.adSpend)} ad spend with $0 ad sales — pause or review` });
    }
  }

  return { wins, alerts };
}

// ─── Retailer Direct Sales Section ───────────────────────────────────────────

function RetailerSalesSection({
  homeDepotUS,
  homeDepotCanada,
  lowes,
}: {
  homeDepotUS: RetailerData;
  homeDepotCanada: RetailerData;
  lowes: RetailerData;
}) {
  const retailers = [
    { key: 'hd-us',     label: 'Home Depot US',     color: '#F96302', data: homeDepotUS },
    { key: 'hd-ca',     label: 'Home Depot Canada',  color: '#E8341C', data: homeDepotCanada },
    { key: 'lowes',     label: "Lowe's",              color: '#004990', data: lowes },
  ];

  // Collect all week labels in order (from the retailer with the most weeks)
  const allLabels = Array.from(
    new Set(
      retailers
        .flatMap((r) => r.data.weeks.map((w) => w.label))
    )
  );

  return (
    <>
      <SectionTitle>🏪 Retailer Direct Sales (Rithum / DSCO)</SectionTitle>

      {/* Scorecard row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {retailers.map(({ key, label, color, data }) => {
          const curr = data.currentWeek;
          const prev = data.previousWeek;
          const salesWow = wowArrow(wowPct(curr.sales, prev.sales));
          const unitsWow = wowArrow(wowPct(curr.units, prev.units));
          return (
            <div
              key={key}
              className="bg-dash-card border border-white/[0.08] rounded-lg p-4 overflow-hidden"
              style={{ borderTop: `2px solid ${color}` }}
            >
              <div className="text-[11px] font-bold uppercase tracking-[0.8px] mb-3" style={{ color }}>
                {label}
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Sales</div>
                  <div className="font-mono text-[20px] font-bold text-white leading-none">{fmtDollar(curr.sales)}</div>
                  <div className={`font-mono text-[11px] mt-1 flex items-center gap-1 ${salesWow.cls}`}>
                    <span>{salesWow.symbol}</span><span>{salesWow.label} WoW</span>
                  </div>
                  <div className="font-mono text-[10px] text-gray-500 mt-0.5">Prev: {fmtDollar(prev.sales)}</div>
                </div>
                <div className="flex-1">
                  <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Units</div>
                  <div className="font-mono text-[20px] font-bold text-white leading-none">{formatNumber(curr.units)}</div>
                  <div className={`font-mono text-[11px] mt-1 flex items-center gap-1 ${unitsWow.cls}`}>
                    <span>{unitsWow.symbol}</span><span>{unitsWow.label} WoW</span>
                  </div>
                  <div className="font-mono text-[10px] text-gray-500 mt-0.5">Prev: {formatNumber(prev.units)}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Combined weekly trend table — expandable with brand breakdown */}
      <RetailerTrendTable
        retailers={retailers.map((r) => ({
          key: r.key,
          label: r.label,
          color: r.color,
          weeks: r.data.weeks,
        }))}
        allLabels={allLabels}
      />

      {/* Brand breakdown per retailer — current week */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {retailers.map(({ key, label, color, data }) => (
          <div key={key} className="bg-dash-card border border-white/[0.08] rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 border-b border-white/[0.08] text-[11px] font-semibold uppercase tracking-wide" style={{ color }}>
              {label} — Current Week
            </div>
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className="bg-dash-card2 border-b border-white/[0.08]">
                  <th className="text-left px-3.5 py-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Brand</th>
                  <th className="text-right px-3.5 py-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Sales</th>
                  <th className="text-right px-3.5 py-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Units</th>
                </tr>
              </thead>
              <tbody>
                {data.currentWeek.brands.filter((b) => b.sales > 0 || b.units > 0).map((b) => (
                  <tr key={b.brand} className="border-b border-white/[0.05] last:border-0 hover:bg-white/[0.02] transition-colors">
                    <td className="px-3.5 py-2 text-white font-medium text-[13px]">{b.brand}</td>
                    <td className="px-3.5 py-2 text-right font-mono text-[#E8EDF5]">{fmtDollar(b.sales)}</td>
                    <td className="px-3.5 py-2 text-right font-mono text-[#E8EDF5]">{b.units}</td>
                  </tr>
                ))}
                {data.currentWeek.brands.filter((b) => b.sales > 0 || b.units > 0).length === 0 && (
                  <tr><td colSpan={3} className="px-3.5 py-3 text-gray-500 text-[12px]">No sales this week</td></tr>
                )}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function RpdHdPage() {
  let data;
  let parseError: string | null = null;

  try {
    data = await parseRpdHdData();
  } catch (err) {
    parseError = err instanceof Error ? err.message : 'Failed to load data';
  }

  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  if (parseError || !data) {
    return (
      <main className="min-h-screen px-4 sm:px-6 py-10">
        <div className="max-w-[1100px] mx-auto">
          <UploadBar company="rpd-hd" />
          <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-6 text-amber-300">
            <p className="font-semibold mb-1">No data file found</p>
            <p className="text-[13px] text-amber-400/80">{parseError ?? 'Upload an Excel file to generate the report.'}</p>
          </div>
        </div>
      </main>
    );
  }

  const { weeks, currentWeek: curr, previousWeek: prev } = data;

  // DSCO combined totals (HD US + HD Canada only — Lowes is separate)
  const dscoCurrSales = data.homeDepotUS.currentWeek.sales + data.homeDepotCanada.currentWeek.sales;
  const dscoPrevSales = data.homeDepotUS.previousWeek.sales + data.homeDepotCanada.previousWeek.sales;
  const dscoCurrUnits = data.homeDepotUS.currentWeek.units + data.homeDepotCanada.currentWeek.units;
  const dscoPrevUnits = data.homeDepotUS.previousWeek.units + data.homeDepotCanada.previousWeek.units;
  // Organic = DSCO total sales − Orange Access ad sales
  const dscoCurrOrganic = Math.max(0, dscoCurrSales - curr.adSales);
  const dscoPrevOrganic = Math.max(0, dscoPrevSales - prev.adSales);

  const salesWow = wowArrow(wowPct(dscoCurrSales, dscoPrevSales));
  const unitsWow = wowArrow(wowPct(dscoCurrUnits, dscoPrevUnits));
  const adSpendWow = wowArrow(wowPct(curr.adSpend, prev.adSpend), true);
  const adSalesWow = wowArrow(wowPct(curr.adSales, prev.adSales));
  const acosWow = acosWowArrow(curr.acos, prev.acos);
  const roasWow = wowArrow(wowPct(curr.roas ?? 0, prev.roas ?? 0));
  const organicWow = wowArrow(wowPct(dscoCurrOrganic, dscoPrevOrganic));

  // Campaign group breakdown
  const currMap = new Map(curr.groups.map((g) => [g.group, g]));
  const prevMap = new Map(prev.groups.map((g) => [g.group, g]));
  const allGroups = [...new Set([...curr.groups.map((g) => g.group), ...prev.groups.map((g) => g.group)])];
  const groupRows = allGroups
    .map((name) => ({ curr: currMap.get(name) ?? null, prev: prevMap.get(name) ?? null, name }))
    .filter((r) => (r.curr?.adSpend ?? 0) > 0 || (r.curr?.adSales ?? 0) > 0 || (r.prev?.adSpend ?? 0) > 0 || (r.prev?.adSales ?? 0) > 0)
    .sort((a, b) => (b.curr?.adSpend ?? 0) - (a.curr?.adSpend ?? 0));

  const { wins, alerts } = generateWinsAlerts(curr.groups, prev.groups);
  const displayWeeks = weeks.slice(-8);

  // DSCO sales lookup — used to fill Total Sales in the OA trend table
  // (OA "total sales" column is $0; real totals come from Home Depot - 2026 + Home Depot Canada - 2026)
  // Keyed by BOTH startDate AND label for robust matching
  const dscoByDate = new Map<string, { sales: number; units: number }>();
  const dscoByLabel = new Map<string, { sales: number; units: number }>();
  for (const retailer of [data.homeDepotUS, data.homeDepotCanada]) {
    for (const w of retailer.weeks) {
      // Key by startDate
      if (w.startDate) {
        const existing = dscoByDate.get(w.startDate) ?? { sales: 0, units: 0 };
        existing.sales += w.sales;
        existing.units += w.units;
        dscoByDate.set(w.startDate, existing);
      }
      // Key by label as fallback
      const existingByLabel = dscoByLabel.get(w.label) ?? { sales: 0, units: 0 };
      existingByLabel.sales += w.sales;
      existingByLabel.units += w.units;
      dscoByLabel.set(w.label, existingByLabel);
    }
  }

  return (
    <main className="min-h-screen px-4 sm:px-6 py-10">
      <div className="max-w-[1100px] mx-auto">

        <UploadBar company="rpd-hd" />

        {/* ── HEADER ─────────────────────────────────────────── */}
        <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-10 pb-6 border-b border-white/[0.08]">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="w-8 h-8 rounded-full bg-[#F96302] flex items-center justify-center text-white font-bold text-sm leading-none select-none">
                HD
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                RPD — Home Depot
              </h1>
            </div>
            <p className="text-sm text-gray-400">
              Orange Access Advertising — Weekly Performance Report
            </p>
            <div className="inline-flex items-center gap-1.5 mt-2 bg-[#F96302]/10 border border-[#F96302]/30 text-orange-400 px-2.5 py-1 rounded text-[11px] font-mono">
              ⚡ Orange Access · {curr.label}
            </div>
          </div>
          <div className="text-right font-mono text-[12px] text-gray-400">
            <div className="text-[14px] font-semibold text-[#E8EDF5] mb-0.5">Current Week Report</div>
            <div>Generated: {today}</div>
          </div>
        </header>

        {/* ── SCORECARD ──────────────────────────────────────── */}
        <SectionTitle>📊 Weekly Scorecard — Current vs. Previous Week</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-2">
          <ScoreCard label="Total Sales" value={fmtDollar(dscoCurrSales)} prevLabel={`Prev: ${fmtDollar(dscoPrevSales)}`} wow={salesWow} topColor={dscoCurrSales >= dscoPrevSales ? '#22C55E' : '#EF4444'} source="DSCO · HD US + HD Canada" />
          <ScoreCard label="Units Sold" value={formatNumber(dscoCurrUnits)} prevLabel={`Prev: ${formatNumber(dscoPrevUnits)}`} wow={unitsWow} topColor={dscoCurrUnits >= dscoPrevUnits ? '#22C55E' : '#EF4444'} source="DSCO · HD US + HD Canada" />
          <ScoreCard label="Ad Spend" value={fmtDollar(curr.adSpend)} prevLabel={`Prev: ${fmtDollar(prev.adSpend)}`} wow={adSpendWow} topColor={curr.adSpend <= prev.adSpend ? '#22C55E' : '#EF4444'} source="Orange Access" />
          <ScoreCard label="Ad Sales" value={fmtDollar(curr.adSales)} prevLabel={`Prev: ${fmtDollar(prev.adSales)}`} wow={adSalesWow} topColor={curr.adSales >= prev.adSales ? '#22C55E' : '#EF4444'} source="Orange Access" />
          <ScoreCard label="ACoS" value={fmtPct(curr.acos)} prevLabel={`Prev: ${fmtPct(prev.acos)}`} wow={acosWow} topColor={curr.acos === null ? '#374151' : curr.acos < 0.35 ? '#22C55E' : curr.acos < 0.55 ? '#F59E0B' : '#EF4444'} source="Orange Access" />
          <ScoreCard label="ROAS" value={fmtRoas(curr.roas)} prevLabel={`Prev: ${fmtRoas(prev.roas)}`} wow={roasWow} topColor={(curr.roas ?? 0) >= (prev.roas ?? 0) ? '#22C55E' : '#EF4444'} source="Orange Access" />
          <ScoreCard label="Organic Sales" value={fmtDollar(dscoCurrOrganic)} prevLabel={`Prev: ${fmtDollar(dscoPrevOrganic)}`} wow={organicWow} topColor={dscoCurrOrganic >= dscoPrevOrganic ? '#22C55E' : '#EF4444'} source="DSCO − OA Ad Sales" />
        </div>

        {/* ── CAMPAIGN GROUP BREAKDOWN ───────────────────────── */}
        <SectionTitle>🏷️ Campaign Group Breakdown — Current vs. Previous Week <span className="text-gray-600 normal-case font-normal tracking-normal text-[9px] ml-1">Source: Orange Access</span></SectionTitle>
        <div className="bg-dash-card border border-white/[0.08] rounded-lg overflow-hidden">
          <div className="table-scroll">
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className="bg-dash-card2 border-b border-white/[0.08]">
                  {['Campaign Group', 'Curr Ad Spend', 'Prev Ad Spend', 'Spend WoW Δ%', 'Ad Sales', 'Prev Ad Sales', 'ACoS', 'ROAS', 'Impressions'].map((h) => (
                    <th key={h} className={`${h === 'Campaign Group' ? 'text-left' : 'text-right'} px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.8px] text-gray-400 whitespace-nowrap`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groupRows.map(({ name, curr: c, prev: p }) => {
                  const currSpend = c?.adSpend ?? 0;
                  const prevSpend = p?.adSpend ?? 0;
                  const spendWowVal = wowPct(currSpend, prevSpend);
                  const wow = wowArrow(spendWowVal, true);
                  const acos = c?.acos ?? null;
                  const flagAcos = acos !== null && acos > 0.7;
                  const flagZeroSalesSpend = currSpend > 0 && (c?.adSales ?? 0) === 0;
                  const flagged = flagAcos || flagZeroSalesSpend;
                  return (
                    <tr key={name} className="border-b border-white/[0.05] hover:bg-white/[0.02] transition-colors last:border-0">
                      <td className="px-3.5 py-2.5 font-sans font-medium text-[13px] text-white whitespace-nowrap">
                        {flagged && <span className="mr-1.5 text-amber-400">⚠️</span>}
                        {name}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono text-[#E8EDF5]">{fmtDollar(currSpend)}</td>
                      <td className="px-3.5 py-2.5 text-right font-mono text-gray-400">{fmtDollar(prevSpend)}</td>
                      <td className={`px-3.5 py-2.5 text-right font-mono font-semibold ${wow.cls}`}>{spendWowVal === null ? '—' : `${wow.symbol} ${Math.abs(spendWowVal * 100).toFixed(0)}%`}</td>
                      <td className="px-3.5 py-2.5 text-right font-mono text-[#E8EDF5]">{c?.adSales ? fmtDollar(c.adSales) : '—'}</td>
                      <td className="px-3.5 py-2.5 text-right font-mono text-gray-400">{p?.adSales ? fmtDollar(p.adSales) : '—'}</td>
                      <td className={`px-3.5 py-2.5 text-right font-mono font-semibold ${acosColor(acos)}`}>{acos !== null && acos > 0 ? fmtPct(acos) : '—'}</td>
                      <td className="px-3.5 py-2.5 text-right font-mono text-[#E8EDF5]">{fmtRoas(c?.roas ?? null)}</td>
                      <td className="px-3.5 py-2.5 text-right font-mono text-gray-400">{c?.impressions ? c.impressions.toLocaleString('en-US') : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── WEEKLY TREND TABLE ─────────────────────────────── */}
        <SectionTitle>📈 Weekly Trend — Orange Access + Home Depot - 2026 + Home Depot Canada - 2026</SectionTitle>
        <RpdHdTrendTable
          displayWeeks={displayWeeks}
          currentLabel={curr.label}
          dscoByDate={Object.fromEntries(dscoByDate)}
          dscoByLabel={Object.fromEntries(dscoByLabel)}
        />

        {/* ── RETAILER DIRECT SALES ─────────────────────────── */}
        <RetailerSalesSection
          homeDepotUS={data.homeDepotUS}
          homeDepotCanada={data.homeDepotCanada}
          lowes={data.lowes}
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
                    <div><strong className="text-white">{w.group}</strong>{' — '}<span className="text-[#C8D5E8]">{w.message}</span></div>
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
                    <div><strong className="text-white">{a.group}</strong>{' — '}<span className="text-[#C8D5E8]">{a.message}</span></div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* ── NOTES ──────────────────────────────────────────── */}
        <NotesSection company="rpd-hd" />

        {/* ── FOOTER ─────────────────────────────────────────── */}
        <footer className="mt-12 pt-5 border-t border-white/[0.08] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 font-mono text-[11px] text-gray-500">
          <span>RPD Home Depot · Orange Access Report · Generated {today}</span>
          <span>Sources: Home Depot Orange Access · Rithum/DSCO</span>
        </footer>

      </div>
    </main>
  );
}
