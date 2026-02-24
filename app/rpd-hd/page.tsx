export const dynamic = 'force-dynamic';

import { parseRpdHdData, type RpdHdCampaignGroupData } from '@/lib/parseRpdHd';
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
    const prevSales = prev?.sales ?? 0;
    const salesWow = wowPct(curr.sales, prevSales);

    if (salesWow !== null && salesWow > 0.2) {
      wins.push({ group: curr.group, message: `Sales up ${(salesWow * 100).toFixed(0)}% WoW (${fmtDollar(prevSales)} → ${fmtDollar(curr.sales)})` });
    }
    if (curr.acos !== null && curr.acos > 0 && curr.acos < 0.25) {
      wins.push({ group: curr.group, message: `Efficient ACoS of ${(curr.acos * 100).toFixed(1)}% — ROAS ${fmtRoas(curr.roas)}` });
    }
    if (curr.acos !== null && curr.acos > 0.7) {
      alerts.push({ group: curr.group, message: `ACoS at ${(curr.acos * 100).toFixed(0)}% — review bids` });
    }
    if (salesWow !== null && salesWow < -0.3) {
      alerts.push({ group: curr.group, message: `Sales down ${Math.abs(salesWow * 100).toFixed(0)}% WoW (${fmtDollar(prevSales)} → ${fmtDollar(curr.sales)})` });
    }
    if (curr.adSpend > 0 && curr.sales === 0) {
      alerts.push({ group: curr.group, message: `${fmtDollar(curr.adSpend)} ad spend with $0 sales — pause or review` });
    }
  }

  return { wins, alerts };
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

  const salesWow = wowArrow(wowPct(curr.sales, prev.sales));
  const unitsWow = wowArrow(wowPct(curr.units, prev.units));
  const adSpendWow = wowArrow(wowPct(curr.adSpend, prev.adSpend), true);
  const adSalesWow = wowArrow(wowPct(curr.adSales, prev.adSales));
  const acosWow = acosWowArrow(curr.acos, prev.acos);
  const roasWow = wowArrow(wowPct(curr.roas ?? 0, prev.roas ?? 0));
  const organicWow = wowArrow(wowPct(curr.organicSales, prev.organicSales));

  // Campaign group breakdown
  const currMap = new Map(curr.groups.map((g) => [g.group, g]));
  const prevMap = new Map(prev.groups.map((g) => [g.group, g]));
  const allGroups = [...new Set([...curr.groups.map((g) => g.group), ...prev.groups.map((g) => g.group)])];
  const groupRows = allGroups
    .map((name) => ({ curr: currMap.get(name) ?? null, prev: prevMap.get(name) ?? null, name }))
    .filter((r) => (r.curr?.sales ?? 0) > 0 || (r.prev?.sales ?? 0) > 0)
    .sort((a, b) => (b.curr?.sales ?? 0) - (a.curr?.sales ?? 0));

  const { wins, alerts } = generateWinsAlerts(curr.groups, prev.groups);
  const displayWeeks = weeks.slice(-8);

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
          <ScoreCard label="Total Sales" value={fmtDollar(curr.sales)} prevLabel={`Prev: ${fmtDollar(prev.sales)}`} wow={salesWow} topColor={curr.sales >= prev.sales ? '#22C55E' : '#EF4444'} />
          <ScoreCard label="Units Sold" value={formatNumber(curr.units)} prevLabel={`Prev: ${formatNumber(prev.units)}`} wow={unitsWow} topColor={curr.units >= prev.units ? '#22C55E' : '#EF4444'} />
          <ScoreCard label="Ad Spend" value={fmtDollar(curr.adSpend)} prevLabel={`Prev: ${fmtDollar(prev.adSpend)}`} wow={adSpendWow} topColor={curr.adSpend <= prev.adSpend ? '#22C55E' : '#EF4444'} />
          <ScoreCard label="Ad Sales" value={fmtDollar(curr.adSales)} prevLabel={`Prev: ${fmtDollar(prev.adSales)}`} wow={adSalesWow} topColor={curr.adSales >= prev.adSales ? '#22C55E' : '#EF4444'} />
          <ScoreCard label="ACoS" value={fmtPct(curr.acos)} prevLabel={`Prev: ${fmtPct(prev.acos)}`} wow={acosWow} topColor={curr.acos === null ? '#374151' : curr.acos < 0.35 ? '#22C55E' : curr.acos < 0.55 ? '#F59E0B' : '#EF4444'} />
          <ScoreCard label="ROAS" value={fmtRoas(curr.roas)} prevLabel={`Prev: ${fmtRoas(prev.roas)}`} wow={roasWow} topColor={(curr.roas ?? 0) >= (prev.roas ?? 0) ? '#22C55E' : '#EF4444'} />
          <ScoreCard label="Organic Sales" value={fmtDollar(curr.organicSales)} prevLabel={`Prev: ${fmtDollar(prev.organicSales)}`} wow={organicWow} topColor={curr.organicSales >= prev.organicSales ? '#22C55E' : '#EF4444'} />
        </div>

        {/* ── CAMPAIGN GROUP BREAKDOWN ───────────────────────── */}
        <SectionTitle>🏷️ Campaign Group Breakdown — Current vs. Previous Week</SectionTitle>
        <div className="bg-dash-card border border-white/[0.08] rounded-lg overflow-hidden">
          <div className="table-scroll">
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className="bg-dash-card2 border-b border-white/[0.08]">
                  {['Campaign Group', 'Curr Sales', 'Prev Sales', 'WoW Δ%', 'Units', 'Ad Spend', 'Ad Sales', 'ACoS', 'ROAS', 'Organic'].map((h) => (
                    <th key={h} className={`${h === 'Campaign Group' ? 'text-left' : 'text-right'} px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.8px] text-gray-400 whitespace-nowrap`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groupRows.map(({ name, curr: c, prev: p }) => {
                  const currSales = c?.sales ?? 0;
                  const prevSales = p?.sales ?? 0;
                  const salesWowVal = wowPct(currSales, prevSales);
                  const wow = wowArrow(salesWowVal);
                  const acos = c?.acos ?? null;
                  const flagAcos = acos !== null && acos > 0.7;
                  const flagZeroSalesSpend = (c?.adSpend ?? 0) > 0 && currSales === 0;
                  const flagged = flagAcos || flagZeroSalesSpend;
                  return (
                    <tr key={name} className="border-b border-white/[0.05] hover:bg-white/[0.02] transition-colors last:border-0">
                      <td className="px-3.5 py-2.5 font-sans font-medium text-[13px] text-white whitespace-nowrap">
                        {flagged && <span className="mr-1.5 text-amber-400">⚠️</span>}
                        {name}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono text-[#E8EDF5]">{fmtDollar(currSales)}</td>
                      <td className="px-3.5 py-2.5 text-right font-mono text-gray-400">{fmtDollar(prevSales)}</td>
                      <td className={`px-3.5 py-2.5 text-right font-mono font-semibold ${wow.cls}`}>{salesWowVal === null ? '—' : `${wow.symbol} ${Math.abs(salesWowVal * 100).toFixed(0)}%`}</td>
                      <td className="px-3.5 py-2.5 text-right font-mono text-[#E8EDF5]">{c?.units ?? 0}</td>
                      <td className="px-3.5 py-2.5 text-right font-mono text-[#E8EDF5]">{fmtDollar(c?.adSpend ?? 0)}</td>
                      <td className="px-3.5 py-2.5 text-right font-mono text-[#E8EDF5]">{c?.adSales ? fmtDollar(c.adSales) : '—'}</td>
                      <td className={`px-3.5 py-2.5 text-right font-mono font-semibold ${acosColor(acos)}`}>{acos !== null && acos > 0 ? fmtPct(acos) : '—'}</td>
                      <td className="px-3.5 py-2.5 text-right font-mono text-[#E8EDF5]">{fmtRoas(c?.roas ?? null)}</td>
                      <td className="px-3.5 py-2.5 text-right font-mono text-[#E8EDF5]">{fmtDollar(c?.organicSales ?? 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── WEEKLY TREND TABLE ─────────────────────────────── */}
        <SectionTitle>📈 Weekly Trend (Orange Access Combined)</SectionTitle>
        <div className="bg-dash-card border border-white/[0.08] rounded-lg overflow-hidden">
          <div className="table-scroll">
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className="bg-dash-card2 border-b border-white/[0.08]">
                  {['Week', 'Total Sales', 'Units', 'Ad Spend', 'Ad Sales', 'ACoS', 'ROAS', 'Organic Sales'].map((h) => (
                    <th key={h} className={`${h === 'Week' ? 'text-left' : 'text-right'} px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.8px] text-gray-400 whitespace-nowrap`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayWeeks.map((week) => {
                  const isCurrent = week.label === curr.label;
                  const rowCls = isCurrent ? 'bg-[#F96302]/10 border-b border-white/[0.08]' : 'border-b border-white/[0.05] hover:bg-white/[0.02] transition-colors';
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
