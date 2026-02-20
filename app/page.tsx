import {
  parseDashboardData,
  wowPct,
  fmtDollar,
  fmtPct,
  fmtRoas,
  acosClass,
  type BrandData,
  type WeekData,
} from '@/lib/parseExcel';

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
  // For ACoS: up is bad
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

// ─── Wins & Alerts generation ─────────────────────────────────────────────

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

    // Wins: sales up >20% WoW
    if (salesWow !== null && salesWow > 0.2) {
      wins.push({
        brand: curr.brand,
        message: `Sales up ${(salesWow * 100).toFixed(0)}% WoW (${fmtDollar(prevSales)} → ${fmtDollar(curr.sales)})`,
      });
    }

    // Wins: ACoS <25%
    if (curr.acos !== null && curr.acos > 0 && curr.acos < 0.25) {
      wins.push({
        brand: curr.brand,
        message: `Efficient ACoS of ${(curr.acos * 100).toFixed(1)}% — ROAS ${fmtRoas(curr.roas)}`,
      });
    }

    // Alerts: ACoS >70%
    if (curr.acos !== null && curr.acos > 0.7) {
      alerts.push({
        brand: curr.brand,
        message: `ACoS at ${(curr.acos * 100).toFixed(0)}% — review bids in Intentwise`,
      });
    }

    // Alerts: sales down >30% WoW
    if (salesWow !== null && salesWow < -0.3) {
      alerts.push({
        brand: curr.brand,
        message: `Sales down ${Math.abs(salesWow * 100).toFixed(0)}% WoW (${fmtDollar(prevSales)} → ${fmtDollar(curr.sales)}) — investigate`,
      });
    }

    // Alerts: spend running with $0 sales
    if (curr.adSpend > 0 && curr.sales === 0) {
      alerts.push({
        brand: curr.brand,
        message: `${fmtDollar(curr.adSpend)} ad spend with $0 sales — pause or review campaigns`,
      });
    }
  }

  return { wins, alerts };
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const data = parseDashboardData();
  const { weeks, currentWeek, previousWeek } = data;

  const curr = currentWeek;
  const prev = previousWeek;

  // Scorecard WoW arrows
  const salesWow = wowArrow(wowPct(curr.sales, prev.sales));
  const ordersWow = wowArrow(wowPct(curr.orderedItems, prev.orderedItems));
  const unitsWow = wowArrow(wowPct(curr.units, prev.units));
  const adSalesWow = wowArrow(wowPct(curr.adSales, prev.adSales));
  const adSpendWow = wowArrow(wowPct(curr.adSpend, prev.adSpend), true); // lower spend = green
  const acosWow = acosWowArrow(curr.acos, prev.acos);
  const roasWow = wowArrow(wowPct(curr.roas ?? 0, prev.roas ?? 0));
  const organicWow = wowArrow(wowPct(curr.organicSales, prev.organicSales));

  // Brand breakdown: sort by current sales desc
  const currBrandMap = new Map(curr.brands.map((b) => [b.brand, b]));
  const prevBrandMap = new Map(prev.brands.map((b) => [b.brand, b]));
  const allBrands = [...new Set([...curr.brands.map((b) => b.brand), ...prev.brands.map((b) => b.brand)])];
  const brandRows = allBrands
    .map((name) => ({
      curr: currBrandMap.get(name) ?? null,
      prev: prevBrandMap.get(name) ?? null,
      name,
    }))
    .filter((r) => r.curr !== null || r.prev !== null)
    .sort((a, b) => (b.curr?.sales ?? 0) - (a.curr?.sales ?? 0));

  // Wins & alerts
  const { wins, alerts } = generateWinsAlerts(curr.brands, prev.brands);

  // Generate today date string
  const today = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <main className="min-h-screen px-4 sm:px-6 py-10">
      <div className="max-w-[1100px] mx-auto">

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
            <div className="text-[14px] font-semibold text-[#E8EDF5] mb-0.5">
              Current Week Report
            </div>
            <div>Generated: {today}</div>
            <div>PPC + SEM Combined</div>
          </div>
        </header>

        {/* ── SCORECARD ──────────────────────────────────────── */}
        <SectionTitle>📊 Weekly Scorecard — Current vs. Previous Week</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-2">
          <ScoreCard
            label="Total Sales"
            value={fmtDollar(curr.sales)}
            prevLabel={`Prev: ${fmtDollar(prev.sales)}`}
            wow={salesWow}
            topColor={curr.sales >= prev.sales ? '#22C55E' : '#EF4444'}
          />
          <ScoreCard
            label="Total Orders"
            value={formatNumber(curr.orderedItems)}
            prevLabel={`Prev: ${formatNumber(prev.orderedItems)}`}
            wow={ordersWow}
            topColor={curr.orderedItems >= prev.orderedItems ? '#22C55E' : '#EF4444'}
          />
          <ScoreCard
            label="Units Sold"
            value={formatNumber(curr.units)}
            prevLabel={`Prev: ${formatNumber(prev.units)}`}
            wow={unitsWow}
            topColor={curr.units >= prev.units ? '#22C55E' : '#EF4444'}
          />
          <ScoreCard
            label="Ad Sales"
            value={fmtDollar(curr.adSales)}
            prevLabel={`Prev: ${fmtDollar(prev.adSales)}`}
            wow={adSalesWow}
            topColor={curr.adSales >= prev.adSales ? '#22C55E' : '#EF4444'}
          />
          <ScoreCard
            label="Ad Spend"
            value={fmtDollar(curr.adSpend)}
            prevLabel={`Prev: ${fmtDollar(prev.adSpend)}`}
            wow={adSpendWow}
            topColor={curr.adSpend <= prev.adSpend ? '#22C55E' : '#EF4444'}
          />
          <ScoreCard
            label="ACoS"
            value={fmtPct(curr.acos)}
            prevLabel={`Prev: ${fmtPct(prev.acos)}`}
            wow={acosWow}
            topColor={
              curr.acos === null
                ? '#374151'
                : curr.acos < 0.35
                ? '#22C55E'
                : curr.acos < 0.55
                ? '#F59E0B'
                : '#EF4444'
            }
          />
          <ScoreCard
            label="ROAS"
            value={fmtRoas(curr.roas)}
            prevLabel={`Prev: ${fmtRoas(prev.roas)}`}
            wow={roasWow}
            topColor={(curr.roas ?? 0) >= (prev.roas ?? 0) ? '#22C55E' : '#EF4444'}
          />
          <ScoreCard
            label="Organic Sales"
            value={fmtDollar(curr.organicSales)}
            prevLabel={`Prev: ${fmtDollar(prev.organicSales)}`}
            wow={organicWow}
            topColor={curr.organicSales >= prev.organicSales ? '#22C55E' : '#EF4444'}
          />
        </div>

        {/* ── 8-WEEK TREND TABLE ─────────────────────────────── */}
        <SectionTitle>📈 Weekly Sales Trend (All Brands Combined)</SectionTitle>
        <div className="bg-dash-card border border-white/[0.08] rounded-lg overflow-hidden">
          <div className="table-scroll">
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className="bg-dash-card2 border-b border-white/[0.08]">
                  <th className="text-left px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.8px] text-gray-400 whitespace-nowrap">Week</th>
                  <th className="text-right px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.8px] text-gray-400 whitespace-nowrap">Total Sales</th>
                  <th className="text-right px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.8px] text-gray-400 whitespace-nowrap">Units</th>
                  <th className="text-right px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.8px] text-gray-400 whitespace-nowrap">Ad Spend</th>
                  <th className="text-right px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.8px] text-gray-400 whitespace-nowrap">Ad Sales</th>
                  <th className="text-right px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.8px] text-gray-400 whitespace-nowrap">ACoS</th>
                  <th className="text-right px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.8px] text-gray-400 whitespace-nowrap">ROAS</th>
                  <th className="text-right px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.8px] text-gray-400 whitespace-nowrap">Organic Sales</th>
                </tr>
              </thead>
              <tbody>
                {weeks.map((week) => {
                  const isCurrent = week.label === 'Current Week';
                  const isPrev = week.label === 'Previous Week';
                  const rowCls = isCurrent
                    ? 'bg-[#0071CE]/10 border-b border-white/[0.08]'
                    : isPrev
                    ? 'bg-white/[0.02] border-b border-white/[0.08]'
                    : 'border-b border-white/[0.05] hover:bg-white/[0.02] transition-colors';

                  return (
                    <tr key={week.label} className={rowCls}>
                      <td
                        className={`px-3.5 py-2.5 font-sans font-medium text-[13px] whitespace-nowrap ${
                          isCurrent ? 'text-blue-400 font-semibold' : 'text-white'
                        }`}
                      >
                        {isCurrent ? '▶ Current Week' : isPrev ? 'Previous Week' : week.label}
                      </td>
                      <td className={`px-3.5 py-2.5 text-right font-mono ${isCurrent ? 'text-blue-200 font-semibold' : 'text-[#E8EDF5]'}`}>
                        {fmtDollar(week.sales)}
                      </td>
                      <td className={`px-3.5 py-2.5 text-right font-mono ${isCurrent ? 'text-blue-200 font-semibold' : 'text-[#E8EDF5]'}`}>
                        {formatNumber(week.units)}
                      </td>
                      <td className={`px-3.5 py-2.5 text-right font-mono ${isCurrent ? 'text-blue-200 font-semibold' : 'text-[#E8EDF5]'}`}>
                        {fmtDollar(week.adSpend)}
                      </td>
                      <td className={`px-3.5 py-2.5 text-right font-mono ${isCurrent ? 'text-blue-200 font-semibold' : 'text-[#E8EDF5]'}`}>
                        {fmtDollar(week.adSales)}
                      </td>
                      <td className={`px-3.5 py-2.5 text-right font-mono font-semibold ${acosColorInline(week.acos)}`}>
                        {fmtPct(week.acos)}
                      </td>
                      <td className={`px-3.5 py-2.5 text-right font-mono ${isCurrent ? 'text-blue-200 font-semibold' : 'text-[#E8EDF5]'}`}>
                        {fmtRoas(week.roas)}
                      </td>
                      <td className={`px-3.5 py-2.5 text-right font-mono ${isCurrent ? 'text-blue-200 font-semibold' : 'text-[#E8EDF5]'}`}>
                        {fmtDollar(week.organicSales)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── BRAND BREAKDOWN TABLE ──────────────────────────── */}
        <SectionTitle>🏷️ Brand Breakdown — Current Week vs. Previous Week</SectionTitle>
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

                  return (
                    <tr
                      key={name}
                      className="border-b border-white/[0.05] hover:bg-white/[0.02] transition-colors last:border-0"
                    >
                      <td className="px-3.5 py-2.5 font-sans font-medium text-[13px] text-white whitespace-nowrap">
                        {flagged && (
                          <span className="mr-1.5 text-amber-400" title="Needs attention">⚠️</span>
                        )}
                        {name}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono text-[#E8EDF5]">
                        {fmtDollar(currSales)}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono text-gray-400">
                        {fmtDollar(prevSales)}
                      </td>
                      <td className={`px-3.5 py-2.5 text-right font-mono font-semibold ${wow.cls}`}>
                        {salesWowVal === null ? '—' : `${wow.symbol} ${Math.abs(salesWowVal * 100).toFixed(0)}%`}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono text-[#E8EDF5]">
                        {c?.units ?? 0}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono text-[#E8EDF5]">
                        {fmtDollar(c?.adSpend ?? 0)}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono text-[#E8EDF5]">
                        {c?.adSales ? fmtDollar(c.adSales) : '—'}
                      </td>
                      <td className={`px-3.5 py-2.5 text-right font-mono font-semibold ${acosColorInline(acos)}`}>
                        {acos !== null && acos > 0 ? fmtPct(acos) : '—'}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono text-[#E8EDF5]">
                        {fmtRoas(c?.roas ?? null)}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono text-[#E8EDF5]">
                        {fmtDollar(c?.organicSales ?? 0)}
                      </td>
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

          {/* Wins */}
          <div className="bg-dash-card border border-white/[0.08] border-l-[3px] border-l-green-400 rounded-lg p-5">
            <div className="text-[11px] font-bold uppercase tracking-[0.8px] text-green-400 mb-4">
              🟢 Wins This Week
            </div>
            {wins.length === 0 ? (
              <p className="text-[13px] text-gray-500">No wins detected this week.</p>
            ) : (
              <ul className="space-y-3">
                {wins.map((w, i) => (
                  <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed">
                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                    <div>
                      <strong className="text-white">{w.brand}</strong>
                      {' — '}
                      <span className="text-[#C8D5E8]">{w.message}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Alerts */}
          <div className="bg-dash-card border border-white/[0.08] border-l-[3px] border-l-red-500 rounded-lg p-5">
            <div className="text-[11px] font-bold uppercase tracking-[0.8px] text-red-400 mb-4">
              🔴 Watch / Action Required
            </div>
            {alerts.length === 0 ? (
              <p className="text-[13px] text-gray-500">No alerts detected this week.</p>
            ) : (
              <ul className="space-y-3">
                {alerts.map((a, i) => (
                  <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed">
                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                    <div>
                      <strong className="text-white">{a.brand}</strong>
                      {' — '}
                      <span className="text-[#C8D5E8]">{a.message}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

        </div>

        {/* ── CAMPAIGN NOTES ─────────────────────────────────── */}
        <SectionTitle>⚙️ Campaign Activity This Week (via Intentwise)</SectionTitle>
        <div className="bg-dash-card border border-white/[0.08] border-l-[3px] border-l-blue-400 rounded-lg p-5">
          <div className="text-[11px] font-bold uppercase tracking-[0.8px] text-blue-400 mb-4">
            Actions Taken
          </div>
          <ul className="space-y-3">
            {[
              'Monitored all active PPC campaigns across brands in Intentwise — automated bid rules reviewed and confirmed running.',
              'Identified high-ACoS brands as priorities — bid reductions recommended this cycle based on current week performance.',
              'Top-performing brands (low ACoS, strong ROAS) being evaluated for budget increases to capture momentum.',
              'SEM campaigns reviewed — Walmart SEM data tracked separately. Flagged underperforming campaigns for bid adjustments.',
              'Ongoing: weekly Intentwise Reporting Tool pull to validate bid change impact vs prior week. Next pull scheduled for following Monday.',
            ].map((note, i) => (
              <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed">
                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                <span className="text-[#C8D5E8]">{note}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[11px] text-gray-500 italic">
            ✏️ To update these notes: edit the campaign notes array in <code className="font-mono">app/page.tsx</code> and redeploy.
          </p>
        </div>

        {/* ── FOOTER ─────────────────────────────────────────── */}
        <footer className="mt-12 pt-5 border-t border-white/[0.08] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 font-mono text-[11px] text-gray-500">
          <span>Ideal Living · Walmart Ads Report · Generated {today}</span>
          <span>Sources: Walmart Seller Center · Intentwise · SEM Dashboard</span>
        </footer>

      </div>
    </main>
  );
}
