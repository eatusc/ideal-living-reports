import { fmtDollar, fmtPct, wowPct, parseDashboardData, parseSemData } from '@/lib/parseExcel';
import { parseElevateData } from '@/lib/parseElevate';
import { parseRpdHdData } from '@/lib/parseRpdHd';
import { parseLustrowareData } from '@/lib/parseLustroware';
import { parseSomarshData } from '@/lib/parseSomarsh';
import { getAcosGoalMap, readAcosGoals, type AcosGoal } from '@/lib/acosGoals';
import {
  BRAND_LABELS,
  BRAND_ROUTES,
  CHANNEL_LABELS,
  type BrandKey,
  type ChannelKey,
} from '@/lib/brandOpsConfig';

export type SignalSeverity = 'high' | 'medium' | 'low';

export interface BrandSignal {
  id: string;
  brandKey: BrandKey;
  brandLabel: string;
  channelKey: ChannelKey;
  channelLabel: string;
  sourcePage: string;
  issue: string;
  metric: string;
  currentValue: string;
  previousValue: string;
  delta: string;
  severity: SignalSeverity;
  suggestedAction: string;
  whyItMatters: string;
  adSpend: number;
  adRevenue: number;
  totalRevenue: number;
  impactHighlights: string[];
}

export interface BrandOpsData {
  goals: AcosGoal[];
  signals: BrandSignal[];
  awareness: string[];
}

interface ChannelSnapshot {
  brandKey: BrandKey;
  channelKey: ChannelKey;
  salesCurrent: number;
  salesPrevious: number;
  adSpendCurrent: number;
  adSalesCurrent: number;
  adSalesPrevious: number;
  acosCurrent: number | null;
  acosPrevious: number | null;
  impactHighlights: string[];
}

function severityRank(severity: SignalSeverity): number {
  if (severity === 'high') return 3;
  if (severity === 'medium') return 2;
  return 1;
}

function pctLabel(value: number | null): string {
  if (value === null || Number.isNaN(value)) return 'n/a';
  return `${(value * 100).toFixed(1)}%`;
}

function wowLabel(value: number | null): string {
  if (value === null) return 'n/a';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${(value * 100).toFixed(1)}%`;
}

function getGoal(goalMap: Record<string, number>, brandKey: BrandKey, channelKey: ChannelKey): number {
  return goalMap[`${brandKey}|${channelKey}`] ?? 0.3;
}

interface DriverRow {
  name: string;
  adSpend: number;
  adSales: number;
  acos: number | null;
}

function deriveImpactHighlights(rows: DriverRow[], label: string): string[] {
  const sorted = [...rows].sort((a, b) => b.adSpend - a.adSpend);
  const highlights: string[] = [];

  for (const row of sorted) {
    if (row.adSpend > 0 && row.adSales === 0) {
      highlights.push(`${label} "${row.name}" spent ${fmtDollar(row.adSpend)} with $0 ad sales.`);
      if (highlights.length >= 3) return highlights;
    }
  }

  for (const row of sorted) {
    if (row.acos !== null && row.acos > 0.55 && row.adSpend > 0) {
      highlights.push(`${label} "${row.name}" has high ACoS (${pctLabel(row.acos)}) on ${fmtDollar(row.adSpend)} spend.`);
      if (highlights.length >= 3) return highlights;
    }
  }

  if (highlights.length === 0 && sorted[0]) {
    const row = sorted[0];
    highlights.push(`${label} "${row.name}" is the top spend driver at ${fmtDollar(row.adSpend)}.`);
  }

  return highlights.slice(0, 3);
}

function buildSignalsForSnapshot(snapshot: ChannelSnapshot, goalMap: Record<string, number>): BrandSignal[] {
  const signals: BrandSignal[] = [];
  const targetAcos = getGoal(goalMap, snapshot.brandKey, snapshot.channelKey);

  const base = {
    brandKey: snapshot.brandKey,
    brandLabel: BRAND_LABELS[snapshot.brandKey],
    channelKey: snapshot.channelKey,
    channelLabel: CHANNEL_LABELS[snapshot.channelKey],
    sourcePage: BRAND_ROUTES[snapshot.brandKey],
  };

  if (snapshot.acosCurrent !== null) {
    const gap = snapshot.acosCurrent - targetAcos;
    if (gap > 0) {
      const severity: SignalSeverity = gap >= 0.1 ? 'high' : 'medium';
      signals.push({
        id: `${snapshot.brandKey}-${snapshot.channelKey}-acos-above-goal`,
        ...base,
        issue: 'ACoS above goal',
        metric: 'ACoS',
        currentValue: pctLabel(snapshot.acosCurrent),
        previousValue: pctLabel(snapshot.acosPrevious),
        delta: `Goal ${pctLabel(targetAcos)} (${gap >= 0 ? '+' : ''}${(gap * 100).toFixed(1)} pts)`,
        severity,
        suggestedAction: 'Lower bids on highest-spend non-converting campaigns and trim weak terms.',
        whyItMatters: 'Higher ACoS reduces margin and can hide inefficient ad allocation.',
        adSpend: snapshot.adSpendCurrent,
        adRevenue: snapshot.adSalesCurrent,
        totalRevenue: snapshot.salesCurrent,
        impactHighlights: snapshot.impactHighlights,
      });
    }
  } else {
    signals.push({
      id: `${snapshot.brandKey}-${snapshot.channelKey}-acos-missing`,
      ...base,
      issue: 'ACoS missing',
      metric: 'ACoS',
      currentValue: 'n/a',
      previousValue: pctLabel(snapshot.acosPrevious),
      delta: 'Cannot compare to goal',
      severity: 'low',
      suggestedAction: 'Check report mapping and confirm the source tab includes ACoS values.',
      whyItMatters: 'Missing ACoS blocks spend-efficiency decisions.',
      adSpend: snapshot.adSpendCurrent,
      adRevenue: snapshot.adSalesCurrent,
      totalRevenue: snapshot.salesCurrent,
      impactHighlights: snapshot.impactHighlights,
    });
  }

  if (snapshot.adSpendCurrent > 0 && snapshot.adSalesCurrent === 0) {
    signals.push({
      id: `${snapshot.brandKey}-${snapshot.channelKey}-spend-no-sales`,
      ...base,
      issue: 'Ad spend with no ad sales',
      metric: 'Ad Spend vs Ad Sales',
      currentValue: `${fmtDollar(snapshot.adSpendCurrent)} spend / ${fmtDollar(snapshot.adSalesCurrent)} ad sales`,
      previousValue: fmtDollar(snapshot.adSalesPrevious),
      delta: 'Immediate waste risk',
      severity: 'high',
      suggestedAction: 'Pause non-performing campaigns and audit search terms before re-enabling spend.',
      whyItMatters: 'Budget is being spent without attributed return.',
      adSpend: snapshot.adSpendCurrent,
      adRevenue: snapshot.adSalesCurrent,
      totalRevenue: snapshot.salesCurrent,
      impactHighlights: snapshot.impactHighlights,
    });
  }

  const salesWow = wowPct(snapshot.salesCurrent, snapshot.salesPrevious);
  if (salesWow !== null && salesWow < -0.15) {
    signals.push({
      id: `${snapshot.brandKey}-${snapshot.channelKey}-sales-down`,
      ...base,
      issue: 'Sales declined week-over-week',
      metric: 'Total Sales',
      currentValue: fmtDollar(snapshot.salesCurrent),
      previousValue: fmtDollar(snapshot.salesPrevious),
      delta: wowLabel(salesWow),
      severity: salesWow <= -0.3 ? 'high' : 'medium',
      suggestedAction: 'Check inventory coverage, bid competitiveness, and top SKU/campaign rank movement.',
      whyItMatters: 'Sustained sales decline can compound into lost share and weaker forecast pacing.',
      adSpend: snapshot.adSpendCurrent,
      adRevenue: snapshot.adSalesCurrent,
      totalRevenue: snapshot.salesCurrent,
      impactHighlights: snapshot.impactHighlights,
    });
  }

  const adSalesWow = wowPct(snapshot.adSalesCurrent, snapshot.adSalesPrevious);
  if (adSalesWow !== null && adSalesWow < -0.2 && snapshot.adSalesPrevious > 0) {
    signals.push({
      id: `${snapshot.brandKey}-${snapshot.channelKey}-ad-sales-down`,
      ...base,
      issue: 'Ad sales dropped materially',
      metric: 'Ad Sales',
      currentValue: fmtDollar(snapshot.adSalesCurrent),
      previousValue: fmtDollar(snapshot.adSalesPrevious),
      delta: wowLabel(adSalesWow),
      severity: adSalesWow <= -0.35 ? 'high' : 'medium',
      suggestedAction: 'Rebalance budget toward campaigns with stable ROAS and restore top-converting terms.',
      whyItMatters: 'Ad sales decline often indicates reduced traffic quality or lost ad coverage.',
      adSpend: snapshot.adSpendCurrent,
      adRevenue: snapshot.adSalesCurrent,
      totalRevenue: snapshot.salesCurrent,
      impactHighlights: snapshot.impactHighlights,
    });
  }

  if (signals.length === 0) {
    signals.push({
      id: `${snapshot.brandKey}-${snapshot.channelKey}-monitor`,
      ...base,
      issue: 'No acute issue detected',
      metric: 'Channel health',
      currentValue: snapshot.acosCurrent === null ? 'ACoS n/a' : `ACoS ${pctLabel(snapshot.acosCurrent)}`,
      previousValue: snapshot.acosPrevious === null ? 'ACoS n/a' : `ACoS ${pctLabel(snapshot.acosPrevious)}`,
      delta: snapshot.acosCurrent === null ? 'Monitor data mapping' : `Goal ${pctLabel(targetAcos)}`,
      severity: 'low',
      suggestedAction: 'Maintain current setup and monitor trend movement week-over-week.',
      whyItMatters: 'Keeps full channel coverage visible even when no threshold-based alert is firing.',
      adSpend: snapshot.adSpendCurrent,
      adRevenue: snapshot.adSalesCurrent,
      totalRevenue: snapshot.salesCurrent,
      impactHighlights: snapshot.impactHighlights,
    });
  }

  return signals;
}

export async function getBrandOpsData(): Promise<BrandOpsData> {
  const awareness: string[] = [];
  const snapshots: ChannelSnapshot[] = [];

  try {
    const [wm, wmSem] = await Promise.all([parseDashboardData(), parseSemData()]);
    snapshots.push({
      brandKey: 'rpd-walmart',
      channelKey: 'walmart-ads',
      salesCurrent: wm.currentWeek.sales,
      salesPrevious: wm.previousWeek.sales,
      adSpendCurrent: wm.currentWeek.adSpend,
      adSalesCurrent: wm.currentWeek.adSales,
      adSalesPrevious: wm.previousWeek.adSales,
      acosCurrent: wm.currentWeek.acos,
      acosPrevious: wm.previousWeek.acos,
      impactHighlights: deriveImpactHighlights(
        wm.currentWeek.brands.map((b) => ({
          name: b.brand,
          adSpend: b.adSpend,
          adSales: b.adSales,
          acos: b.acos,
        })),
        'Brand'
      ),
    });
    snapshots.push({
      brandKey: 'rpd-walmart',
      channelKey: 'sem',
      salesCurrent: wmSem.currentWeek.adSales,
      salesPrevious: wmSem.previousWeek.adSales,
      adSpendCurrent: wmSem.currentWeek.adSpend,
      adSalesCurrent: wmSem.currentWeek.adSales,
      adSalesPrevious: wmSem.previousWeek.adSales,
      acosCurrent: wmSem.currentWeek.acos,
      acosPrevious: wmSem.previousWeek.acos,
      impactHighlights: deriveImpactHighlights(
        wmSem.currentWeek.campaigns.map((c) => ({
          name: c.displayName || c.campaign,
          adSpend: c.adSpend,
          adSales: c.adSales,
          acos: c.acos,
        })),
        'Campaign'
      ),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown parser error';
    awareness.push(`RPD Walmart data unavailable: ${msg}`);
  }

  try {
    const elevate = await parseElevateData();
    snapshots.push({
      brandKey: 'elevate',
      channelKey: 'amazon',
      salesCurrent: elevate.amazon.currentWeek.sales,
      salesPrevious: elevate.amazon.previousWeek.sales,
      adSpendCurrent: elevate.amazon.currentWeek.adSpend,
      adSalesCurrent: elevate.amazon.currentWeek.adSales,
      adSalesPrevious: elevate.amazon.previousWeek.adSales,
      acosCurrent: elevate.amazon.currentWeek.acos,
      acosPrevious: elevate.amazon.previousWeek.acos,
      impactHighlights: [],
    });
    snapshots.push({
      brandKey: 'elevate',
      channelKey: 'walmart',
      salesCurrent: elevate.walmart.currentWeek.sales,
      salesPrevious: elevate.walmart.previousWeek.sales,
      adSpendCurrent: elevate.walmart.currentWeek.adSpend,
      adSalesCurrent: elevate.walmart.currentWeek.adSales,
      adSalesPrevious: elevate.walmart.previousWeek.adSales,
      acosCurrent: elevate.walmart.currentWeek.acos,
      acosPrevious: elevate.walmart.previousWeek.acos,
      impactHighlights: [],
    });
    snapshots.push({
      brandKey: 'elevate',
      channelKey: 'sem',
      salesCurrent: elevate.sem.currentWeek.adSales,
      salesPrevious: elevate.sem.previousWeek.adSales,
      adSpendCurrent: elevate.sem.currentWeek.adSpend,
      adSalesCurrent: elevate.sem.currentWeek.adSales,
      adSalesPrevious: elevate.sem.previousWeek.adSales,
      acosCurrent: elevate.sem.currentWeek.acos,
      acosPrevious: elevate.sem.previousWeek.acos,
      impactHighlights: deriveImpactHighlights(
        elevate.sem.currentWeek.campaigns.map((c) => ({
          name: c.campaign,
          adSpend: c.adSpend,
          adSales: c.adSales,
          acos: c.acos,
        })),
        'Campaign'
      ),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown parser error';
    awareness.push(`Elevate data unavailable: ${msg}`);
  }

  try {
    const rpdHd = await parseRpdHdData();
    snapshots.push({
      brandKey: 'rpd-hd',
      channelKey: 'orange-access',
      salesCurrent: rpdHd.currentWeek.sales,
      salesPrevious: rpdHd.previousWeek.sales,
      adSpendCurrent: rpdHd.currentWeek.adSpend,
      adSalesCurrent: rpdHd.currentWeek.adSales,
      adSalesPrevious: rpdHd.previousWeek.adSales,
      acosCurrent: rpdHd.currentWeek.acos,
      acosPrevious: rpdHd.previousWeek.acos,
      impactHighlights: deriveImpactHighlights(
        rpdHd.currentWeek.groups.map((g) => ({
          name: g.group,
          adSpend: g.adSpend,
          adSales: g.adSales,
          acos: g.acos,
        })),
        'Group'
      ),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown parser error';
    awareness.push(`RPD Home Depot data unavailable: ${msg}`);
  }

  try {
    const lustroware = await parseLustrowareData();
    snapshots.push({
      brandKey: 'lustroware',
      channelKey: 'walmart',
      salesCurrent: lustroware.currentWeek.sales,
      salesPrevious: lustroware.previousWeek.sales,
      adSpendCurrent: lustroware.currentWeek.adSpend,
      adSalesCurrent: lustroware.currentWeek.adSales,
      adSalesPrevious: lustroware.previousWeek.adSales,
      acosCurrent: lustroware.currentWeek.acos,
      acosPrevious: lustroware.previousWeek.acos,
      impactHighlights: deriveImpactHighlights(
        lustroware.currentWeekSkus.map((s) => ({
          name: `${s.product} (${s.sku})`,
          adSpend: s.adSpend,
          adSales: s.adSales,
          acos: s.acos,
        })),
        'SKU'
      ),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown parser error';
    awareness.push(`Lustroware data unavailable: ${msg}`);
  }

  try {
    const somarsh = await parseSomarshData();
    snapshots.push({
      brandKey: 'somarsh',
      channelKey: 'walmart',
      salesCurrent: somarsh.currentWeek.sales,
      salesPrevious: somarsh.previousWeek.sales,
      adSpendCurrent: somarsh.currentWeek.adSpend,
      adSalesCurrent: somarsh.currentWeek.adSales,
      adSalesPrevious: somarsh.previousWeek.adSales,
      acosCurrent: somarsh.currentWeek.acos,
      acosPrevious: somarsh.previousWeek.acos,
      impactHighlights: [],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown parser error';
    awareness.push(`Southern Marsh data unavailable: ${msg}`);
  }

  const [goalMap, goals] = await Promise.all([getAcosGoalMap(), readAcosGoals()]);
  const signals = snapshots
    .flatMap((snapshot) => buildSignalsForSnapshot(snapshot, goalMap))
    .sort((a, b) => {
      const sev = severityRank(b.severity) - severityRank(a.severity);
      if (sev !== 0) return sev;
      return a.brandLabel.localeCompare(b.brandLabel);
    });

  if (signals.length === 0 && awareness.length === 0) {
    awareness.push('No data was parsed for any brand. Upload data files to each report route first.');
  }

  return { goals, signals, awareness };
}

export function goalSummaryLabel(targetAcos: number): string {
  return `Goal ${fmtPct(targetAcos)}`;
}
