export const dynamic = 'force-dynamic';

import Link from 'next/link';
import UploadBar from '@/components/UploadBar';
import NotesSection from '@/components/NotesSection';
import TableChartToggle from '@/components/TableChartToggle';
import TrendChart, { type ChartMetric, type ChartDataPoint, type ChartNote } from '@/components/TrendChart';
import ImpactView from '@/components/ImpactView';
import SortableTable from '@/components/SortableTable';
import { parseSomarshData } from '@/lib/parseSomarsh';
import { readNotes, type Note } from '@/lib/notes';
import { fmtDollar, fmtPct, fmtRoas } from '@/lib/parseExcel';

const SOMARSH_ACOS_TARGET = 0.10;
const SOMARSH_ACOS_GOOD = 0.08; // well below target
const SOMARSH_ACOS_BAD = 0.12; // well above target

function formatNumber(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

function fmtMoney2(n: number | null): string {
  if (n === null || !isFinite(n)) return '—';
  return `$${n.toFixed(2)}`;
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
  sub?: string;
  topColor?: string;
}

function ScoreCard({ label, value, sub, topColor }: ScoreCardProps) {
  return (
    <div
      className="relative bg-dash-card border border-white/[0.08] rounded-lg p-4 overflow-hidden"
      style={{ borderTop: `2px solid ${topColor ?? '#374151'}` }}
    >
      <div className="text-[10px] font-medium uppercase tracking-[0.8px] text-gray-400 mb-2">{label}</div>
      <div className="font-mono text-[22px] font-bold text-white tracking-tight leading-none">{value}</div>
      {sub && <div className="font-mono text-[10px] mt-1.5 text-gray-500">{sub}</div>}
    </div>
  );
}

function sumBy<T>(items: T[], pick: (item: T) => number): number {
  return items.reduce((acc, item) => acc + pick(item), 0);
}

function generate3DayWinsWatch(daily: Array<{ spend: number; sales: number; orders: number; clicks: number; impressions: number }>) {
  const wins: string[] = [];
  const watch: string[] = [];

  if (daily.length < 3) return { wins, watch };

  const last3 = daily.slice(-3);
  const prev3 = daily.slice(Math.max(0, daily.length - 6), daily.length - 3);

  const last = {
    spend: sumBy(last3, (d) => d.spend),
    sales: sumBy(last3, (d) => d.sales),
    orders: sumBy(last3, (d) => d.orders),
    clicks: sumBy(last3, (d) => d.clicks),
    impressions: sumBy(last3, (d) => d.impressions),
  };
  const prev = {
    spend: sumBy(prev3, (d) => d.spend),
    sales: sumBy(prev3, (d) => d.sales),
    orders: sumBy(prev3, (d) => d.orders),
    clicks: sumBy(prev3, (d) => d.clicks),
    impressions: sumBy(prev3, (d) => d.impressions),
  };

  const salesDelta = prev.sales > 0 ? (last.sales - prev.sales) / prev.sales : 0;
  const spendDelta = prev.spend > 0 ? (last.spend - prev.spend) / prev.spend : 0;
  const lastAcos = last.sales > 0 ? last.spend / last.sales : null;
  const prevAcos = prev.sales > 0 ? prev.spend / prev.sales : null;
  const ctrLast = last.impressions > 0 ? last.clicks / last.impressions : null;
  const ctrPrev = prev.impressions > 0 ? prev.clicks / prev.impressions : null;

  if (salesDelta > 0.15) wins.push(`3-day sales are up ${fmtPct(salesDelta)} vs prior 3 days (${fmtDollar(prev.sales)} → ${fmtDollar(last.sales)}).`);
  if (lastAcos !== null && lastAcos <= SOMARSH_ACOS_GOOD) wins.push(`ACoS is well below target at ${fmtPct(lastAcos)} (target: ${fmtPct(SOMARSH_ACOS_TARGET)}).`);
  if (lastAcos !== null && prevAcos !== null && lastAcos < prevAcos) wins.push(`Efficiency improved: ACoS moved from ${fmtPct(prevAcos)} to ${fmtPct(lastAcos)} over the latest 3 days.`);
  if (ctrLast !== null && ctrPrev !== null && ctrLast > ctrPrev) wins.push(`CTR improved from ${fmtPct(ctrPrev)} to ${fmtPct(ctrLast)} over the latest 3 days.`);

  if (salesDelta < -0.12) watch.push(`3-day sales are down ${fmtPct(Math.abs(salesDelta))} vs prior 3 days (${fmtDollar(prev.sales)} → ${fmtDollar(last.sales)}).`);
  if (lastAcos !== null && lastAcos >= SOMARSH_ACOS_BAD) watch.push(`ACoS is above target at ${fmtPct(lastAcos)} (target: ${fmtPct(SOMARSH_ACOS_TARGET)}); tighten term/campaign spend.`);
  if (lastAcos !== null && prevAcos !== null && lastAcos > prevAcos * 1.1) watch.push(`ACoS worsened from ${fmtPct(prevAcos)} to ${fmtPct(lastAcos)}; review recent high-spend terms.`);
  if (spendDelta > 0.15 && salesDelta < 0.05) watch.push(`Spend increased ${fmtPct(spendDelta)} with weak sales lift; trim low-conversion search terms.`);

  if (wins.length === 0) wins.push('No strong positive shift in the latest 3-day window; performance is relatively flat.');
  if (watch.length === 0) watch.push('No major 3-day risk spike detected. Continue monitoring wasted-spend terms.');

  return { wins: wins.slice(0, 4), watch: watch.slice(0, 4) };
}

export default async function SoMarshPage() {
  let data;
  let parseError: string | null = null;

  try {
    data = await parseSomarshData();
  } catch (err) {
    parseError = err instanceof Error ? err.message : 'Failed to load data';
  }

  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  let notes: Note[] = [];
  try { notes = await readNotes('somarsh'); } catch { /* ignore */ }

  if (parseError || !data) {
    return (
      <main className="min-h-screen px-4 sm:px-6 py-10">
        <div className="max-w-[1200px] mx-auto">
          <UploadBar company="somarsh" />
          <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-6 text-amber-300">
            <p className="font-semibold mb-1">No data file found</p>
            <p className="text-[13px] text-amber-400/80">{parseError ?? 'Upload an Excel file to generate the report.'}</p>
          </div>
          <NotesSection company="somarsh" initialNotes={notes} />
        </div>
      </main>
    );
  }

  const trendMetrics: ChartMetric[] = [
    { key: 'spend', label: 'Spend', color: '#EF4444', yAxisId: 'dollar', formatType: 'dollar', defaultVisible: true },
    { key: 'sales', label: 'Sales', color: '#22C55E', yAxisId: 'dollar', formatType: 'dollar', defaultVisible: true },
    { key: 'orders', label: 'Orders', color: '#3B82F6', yAxisId: 'count', formatType: 'number', defaultVisible: false },
    { key: 'clicks', label: 'Clicks', color: '#06B6D4', yAxisId: 'count', formatType: 'number', defaultVisible: false },
    { key: 'acos', label: 'ACoS', color: '#F59E0B', yAxisId: 'pct', formatType: 'pct', defaultVisible: true },
  ];

  const trendData: ChartDataPoint[] = data.daily.map((d) => ({
    label: d.label,
    spend: d.spend,
    sales: d.sales,
    orders: d.orders,
    clicks: d.clicks,
    acos: d.sales > 0 ? (d.spend / d.sales) * 100 : null,
  }));

  const chartNotes: ChartNote[] = notes.flatMap((n) => {
    const noteDate = new Date(n.date);
    if (isNaN(noteDate.getTime())) return [];
    const label = noteDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return [{ date: n.date, text: n.action, weekLabel: label }];
  });
  const peakNotes: ChartNote[] = data.peakInsights.map((p) => ({
    date: p.noteDate,
    text: p.text,
    weekLabel: p.label,
  }));
  const peakInsightByLabel = new Map(data.peakInsights.map((p) => [p.label, p.text]));
  const combinedNotes: ChartNote[] = [...peakNotes, ...chartNotes];
  const { wins, watch } = generate3DayWinsWatch(data.daily);
  const dailyRows = data.daily.map((d) => ({
    row_key: d.label,
    date: d.label,
    spend: d.spend,
    sales: d.sales,
    orders: d.orders,
    clicks: d.clicks,
    acos: d.sales > 0 ? d.spend / d.sales : null,
    peak_reason: peakInsightByLabel.get(d.label) ?? '',
  }));
  const topSpendRows = data.topTermsBySpend.map((t, i) => ({
    row_key: `${t.term}-${i}`,
    term: t.term,
    spend: t.spend,
    sales: t.sales,
    clicks: t.clicks,
    orders: t.orders,
    acos: t.acos,
  }));
  const campaignRows = data.campaigns.map((c, i) => ({
    row_key: `${c.campaign}-${i}`,
    campaign: c.campaign,
    spend: c.spend,
    sales: c.sales,
    orders: c.orders,
    clicks: c.clicks,
    ctr: c.ctr,
    cpc: c.cpc,
    acos: c.acos,
    roas: c.roas,
  }));
  const wastedRows = data.wastedSpendTerms.map((t, i) => ({
    row_key: `${t.term}-${i}`,
    term: t.term,
    spend: t.spend,
    clicks: t.clicks,
    impressions: t.impressions,
    cpc: t.cpc,
  }));

  return (
    <main className="min-h-screen px-4 sm:px-6 py-10">
      <div className="max-w-[1200px] mx-auto">
        <UploadBar company="somarsh" />

        <div className="flex gap-3 mb-4 text-[11px] font-mono">
          <span className="text-gray-600">Reports:</span>
          <Link href="/aceteam" className="text-blue-300 hover:text-blue-200 transition-colors">/aceteam</Link>
          <span className="text-[#FFC220] font-semibold">SoMarsh</span>
        </div>

        <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-10 pb-6 border-b border-white/[0.08]">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="w-8 h-8 rounded-full bg-[#FFC220] flex items-center justify-center text-[#0A0F1C] font-bold text-lg leading-none select-none">★</div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">SoMarsh</h1>
            </div>
            <p className="text-sm text-gray-400">Sponsored Products Search Term Report</p>
            <div className="inline-flex items-center gap-1.5 mt-2 bg-[#0071CE]/10 border border-[#0071CE]/30 text-blue-400 px-2.5 py-1 rounded text-[11px] font-mono">
              30 Day Data · {data.windowStart} - {data.windowEnd}
            </div>
            <div className="inline-flex items-center gap-1.5 mt-2 ml-2 bg-amber-500/10 border border-amber-400/30 text-amber-300 px-2.5 py-1 rounded text-[11px] font-mono">
              ACoS Target: 10% (SoMarsh)
            </div>
          </div>
          <div className="text-right font-mono text-[12px] text-gray-400">
            <div className="text-[14px] font-semibold text-[#E8EDF5] mb-0.5">30-Day Snapshot</div>
            <div>Generated: {today}</div>
            <div>Amazon US · Search Terms</div>
          </div>
        </header>

        <SectionTitle>📊 30-Day Performance Summary</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-2">
          <ScoreCard label="Spend" value={fmtDollar(data.totals.spend)} topColor="#EF4444" />
          <ScoreCard label="Sales" value={fmtDollar(data.totals.sales)} topColor="#22C55E" />
          <ScoreCard label="Orders" value={formatNumber(data.totals.orders)} topColor="#3B82F6" />
          <ScoreCard label="Units" value={formatNumber(data.totals.units)} topColor="#06B6D4" />
          <ScoreCard label="Impressions" value={formatNumber(data.totals.impressions)} topColor="#A855F7" />
          <ScoreCard label="Clicks" value={formatNumber(data.totals.clicks)} topColor="#0EA5E9" />
          <ScoreCard label="CTR" value={fmtPct(data.totals.ctr)} topColor="#22C55E" />
          <ScoreCard label="CPC" value={fmtMoney2(data.totals.cpc)} topColor="#F97316" />
          <ScoreCard label="CVR" value={fmtPct(data.totals.cvr)} topColor="#14B8A6" />
          <ScoreCard label="ACoS" value={fmtPct(data.totals.acos)} topColor="#F59E0B" />
          <ScoreCard label="ROAS" value={fmtRoas(data.totals.roas)} topColor="#8B5CF6" />
        </div>

        <SectionTitle>📈 Daily Trend (30 Days)</SectionTitle>
        <TableChartToggle
          tableContent={
            <div className="bg-dash-card border border-white/[0.08] rounded-lg overflow-visible">
              <SortableTable
                rowKey="row_key"
                rows={dailyRows}
                columns={[
                  { key: 'date', label: 'Date', align: 'left', type: 'text' },
                  { key: 'spend', label: 'Spend', align: 'right', type: 'currency' },
                  { key: 'sales', label: 'Sales', align: 'right', type: 'currency' },
                  { key: 'orders', label: 'Orders', align: 'right', type: 'number' },
                  { key: 'clicks', label: 'Clicks', align: 'right', type: 'number' },
                  { key: 'acos', label: 'ACoS', align: 'right', type: 'percent' },
                  { key: 'peak_reason', label: 'Peak Reason', align: 'left', type: 'peak_reason' },
                ]}
              />
            </div>
          }
          chartContent={<TrendChart data={trendData} metrics={trendMetrics} notes={combinedNotes} accentColor="#FFC220" />}
          impactContent={<ImpactView data={trendData} metrics={trendMetrics} notes={combinedNotes} accentColor="#FFC220" />}
        />

        <SectionTitle>🟢 Wins / 🔴 Watch (Latest 3 Days)</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="bg-dash-card border border-white/[0.08] border-l-[3px] border-l-green-400 rounded-lg p-5">
            <div className="text-[11px] font-bold uppercase tracking-[0.8px] text-green-400 mb-4">🟢 Wins</div>
            <ul className="space-y-3">
              {wins.map((w, i) => (
                <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed">
                  <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                  <span className="text-[#C8D5E8]">{w}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-dash-card border border-white/[0.08] border-l-[3px] border-l-red-500 rounded-lg p-5">
            <div className="text-[11px] font-bold uppercase tracking-[0.8px] text-red-400 mb-4">🔴 Watch</div>
            <ul className="space-y-3">
              {watch.map((w, i) => (
                <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed">
                  <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                  <span className="text-[#C8D5E8]">{w}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <SectionTitle>🔎 Top Search Terms By Spend</SectionTitle>
        <div className="bg-dash-card border border-white/[0.08] rounded-lg overflow-hidden mb-6">
          <SortableTable
            rowKey="row_key"
            rows={topSpendRows}
            columns={[
              { key: 'term', label: 'Search Term', align: 'left', type: 'text' },
              { key: 'spend', label: 'Spend', align: 'right', type: 'currency' },
              { key: 'sales', label: 'Sales', align: 'right', type: 'currency' },
              { key: 'clicks', label: 'Clicks', align: 'right', type: 'number' },
              { key: 'orders', label: 'Orders', align: 'right', type: 'number' },
              { key: 'acos', label: 'ACoS', align: 'right', type: 'percent' },
            ]}
            maxRows={25}
          />
        </div>

        <SectionTitle>🎯 Campaign Performance (30 Days)</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="bg-dash-card border border-white/[0.08] border-l-[3px] border-l-green-400 rounded-lg p-5">
            <div className="text-[11px] font-bold uppercase tracking-[0.8px] text-green-400 mb-4">🟢 Strong Campaigns</div>
            {data.winningCampaigns.length === 0 ? (
              <p className="text-[13px] text-gray-500">No campaign currently meets the strong-performance threshold.</p>
            ) : (
              <ul className="space-y-3">
                {data.winningCampaigns.slice(0, 6).map((c) => (
                  <li key={`win-${c.campaign}`} className="flex gap-2.5 text-[13px] leading-relaxed">
                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                    <span className="text-[#C8D5E8]">
                      <strong className="text-white">{c.campaign}</strong> · ROAS {fmtRoas(c.roas)} · ACoS {fmtPct(c.acos)} · Sales {fmtDollar(c.sales)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="bg-dash-card border border-white/[0.08] border-l-[3px] border-l-red-500 rounded-lg p-5">
            <div className="text-[11px] font-bold uppercase tracking-[0.8px] text-red-400 mb-4">🔴 Review Campaigns</div>
            {data.watchCampaigns.length === 0 ? (
              <p className="text-[13px] text-gray-500">No high-risk campaign currently exceeds the review threshold.</p>
            ) : (
              <ul className="space-y-3">
                {data.watchCampaigns.slice(0, 6).map((c) => (
                  <li key={`watch-${c.campaign}`} className="flex gap-2.5 text-[13px] leading-relaxed">
                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                    <span className="text-[#C8D5E8]">
                      <strong className="text-white">{c.campaign}</strong> · ROAS {fmtRoas(c.roas)} · ACoS {fmtPct(c.acos)} · Spend {fmtDollar(c.spend)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="bg-dash-card border border-white/[0.08] rounded-lg overflow-hidden mb-6">
          <SortableTable
            rowKey="row_key"
            rows={campaignRows}
            columns={[
              { key: 'campaign', label: 'Campaign', align: 'left', type: 'text' },
              { key: 'spend', label: 'Spend', align: 'right', type: 'currency' },
              { key: 'sales', label: 'Sales', align: 'right', type: 'currency' },
              { key: 'orders', label: 'Orders', align: 'right', type: 'number' },
              { key: 'clicks', label: 'Clicks', align: 'right', type: 'number' },
              { key: 'ctr', label: 'CTR', align: 'right', type: 'percent' },
              { key: 'cpc', label: 'CPC', align: 'right', type: 'currency' },
              { key: 'acos', label: 'ACoS', align: 'right', type: 'percent' },
              { key: 'roas', label: 'ROAS', align: 'right', type: 'roas' },
            ]}
            maxRows={35}
          />
        </div>

        <SectionTitle>💰 Wasted Spend Terms (No Sales)</SectionTitle>
        <div className="bg-dash-card border border-white/[0.08] rounded-lg overflow-hidden mb-6">
          <SortableTable
            rowKey="row_key"
            rows={wastedRows}
            columns={[
              { key: 'term', label: 'Search Term', align: 'left', type: 'text' },
              { key: 'spend', label: 'Spend', align: 'right', type: 'currency' },
              { key: 'clicks', label: 'Clicks', align: 'right', type: 'number' },
              { key: 'impressions', label: 'Impressions', align: 'right', type: 'number' },
              { key: 'cpc', label: 'CPC', align: 'right', type: 'currency' },
            ]}
            maxRows={25}
          />
        </div>

        <NotesSection company="somarsh" initialNotes={notes} />

        <footer className="mt-12 pt-5 border-t border-white/[0.08] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 font-mono text-[11px] text-gray-500">
          <span>SoMarsh · Search Term Dashboard · 30 Day Data</span>
          <span>Source: Sponsored Products Search Term Report</span>
        </footer>
      </div>
    </main>
  );
}
