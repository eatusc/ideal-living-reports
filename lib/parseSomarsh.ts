import * as XLSX from 'xlsx';
import { getExcelBuffer } from '@/lib/blob';
import { safeNum, excelSerialToDateStr } from '@/lib/parseExcel';

const SOMARSH_ACOS_TARGET = 0.10;
const SOMARSH_ACOS_GOOD = 0.08; // well below target
const SOMARSH_ACOS_BAD = 0.12; // well above target

export interface SoMarshTermData {
  term: string;
  impressions: number;
  clicks: number;
  spend: number;
  sales: number;
  orders: number;
  units: number;
  ctr: number | null;
  cpc: number | null;
  cvr: number | null;
  acos: number | null;
  roas: number | null;
}

export interface SoMarshDailyData {
  label: string;
  impressions: number;
  clicks: number;
  spend: number;
  sales: number;
  orders: number;
}

export interface SoMarshDashboardData {
  windowStart: string;
  windowEnd: string;
  totals: {
    impressions: number;
    clicks: number;
    spend: number;
    sales: number;
    orders: number;
    units: number;
    ctr: number | null;
    cpc: number | null;
    cvr: number | null;
    acos: number | null;
    roas: number | null;
  };
  daily: SoMarshDailyData[];
  peakInsights: Array<{
    label: string;
    noteDate: string;
    text: string;
  }>;
  campaigns: SoMarshCampaignData[];
  winningCampaigns: SoMarshCampaignData[];
  watchCampaigns: SoMarshCampaignData[];
  topTermsBySpend: SoMarshTermData[];
  topTermsBySales: SoMarshTermData[];
  wastedSpendTerms: SoMarshTermData[];
}

export interface SoMarshCampaignData {
  campaign: string;
  impressions: number;
  clicks: number;
  spend: number;
  sales: number;
  orders: number;
  units: number;
  ctr: number | null;
  cpc: number | null;
  cvr: number | null;
  acos: number | null;
  roas: number | null;
}

function rate(numerator: number, denominator: number): number | null {
  if (!denominator) return null;
  return numerator / denominator;
}

function toDateLabel(serial: number): string {
  return excelSerialToDateStr(serial);
}

export async function parseSomarshData(): Promise<SoMarshDashboardData> {
  const buffer = await getExcelBuffer('somarsh');
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error('No sheet found in SoMarsh report');

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: true });
  if (rows.length < 2) throw new Error('SoMarsh report has no data rows');

  let minStartSerial = Number.POSITIVE_INFINITY;
  let maxEndSerial = Number.NEGATIVE_INFINITY;

  const totals = {
    impressions: 0,
    clicks: 0,
    spend: 0,
    sales: 0,
    orders: 0,
    units: 0,
  };

  const termMap = new Map<string, SoMarshTermData>();
  const campaignMap = new Map<string, SoMarshCampaignData>();
  const dailyMap = new Map<string, SoMarshDailyData>();
  const dailyTermSales = new Map<string, Map<string, number>>();
  const dailyCampaignSales = new Map<string, Map<string, number>>();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    if (!row || !Array.isArray(row)) continue;

    const startSerial = typeof row[0] === 'number' ? row[0] : NaN;
    const endSerial = typeof row[1] === 'number' ? row[1] : NaN;
    if (!Number.isFinite(startSerial) || !Number.isFinite(endSerial)) continue;

    if (startSerial < minStartSerial) minStartSerial = startSerial;
    if (endSerial > maxEndSerial) maxEndSerial = endSerial;

    const termRaw = String(row[10] ?? '').trim();
    const term = termRaw || '(blank)';
    const campaign = String(row[4] ?? '').trim() || '(unknown campaign)';
    const impressions = safeNum(row[11]);
    const clicks = safeNum(row[12]);
    const spend = safeNum(row[15]);
    const sales = safeNum(row[16]);
    const orders = safeNum(row[19]);
    const units = safeNum(row[20]);

    totals.impressions += impressions;
    totals.clicks += clicks;
    totals.spend += spend;
    totals.sales += sales;
    totals.orders += orders;
    totals.units += units;

    const existing = termMap.get(term) ?? {
      term,
      impressions: 0,
      clicks: 0,
      spend: 0,
      sales: 0,
      orders: 0,
      units: 0,
      ctr: null,
      cpc: null,
      cvr: null,
      acos: null,
      roas: null,
    };
    existing.impressions += impressions;
    existing.clicks += clicks;
    existing.spend += spend;
    existing.sales += sales;
    existing.orders += orders;
    existing.units += units;
    termMap.set(term, existing);

    const existingCampaign = campaignMap.get(campaign) ?? {
      campaign,
      impressions: 0,
      clicks: 0,
      spend: 0,
      sales: 0,
      orders: 0,
      units: 0,
      ctr: null,
      cpc: null,
      cvr: null,
      acos: null,
      roas: null,
    };
    existingCampaign.impressions += impressions;
    existingCampaign.clicks += clicks;
    existingCampaign.spend += spend;
    existingCampaign.sales += sales;
    existingCampaign.orders += orders;
    existingCampaign.units += units;
    campaignMap.set(campaign, existingCampaign);

    const label = toDateLabel(endSerial);
    const day = dailyMap.get(label) ?? { label, impressions: 0, clicks: 0, spend: 0, sales: 0, orders: 0 };
    day.impressions += impressions;
    day.clicks += clicks;
    day.spend += spend;
    day.sales += sales;
    day.orders += orders;
    dailyMap.set(label, day);

    const termSalesMap = dailyTermSales.get(label) ?? new Map<string, number>();
    termSalesMap.set(term, (termSalesMap.get(term) ?? 0) + sales);
    dailyTermSales.set(label, termSalesMap);

    const campaignSalesMap = dailyCampaignSales.get(label) ?? new Map<string, number>();
    campaignSalesMap.set(campaign, (campaignSalesMap.get(campaign) ?? 0) + sales);
    dailyCampaignSales.set(label, campaignSalesMap);
  }

  if (!Number.isFinite(minStartSerial) || !Number.isFinite(maxEndSerial)) {
    throw new Error('Could not determine date range for SoMarsh report');
  }

  const terms = [...termMap.values()].map((t) => ({
    ...t,
    ctr: rate(t.clicks, t.impressions),
    cpc: rate(t.spend, t.clicks),
    cvr: rate(t.orders, t.clicks),
    acos: rate(t.spend, t.sales),
    roas: rate(t.sales, t.spend),
  }));

  const campaigns = [...campaignMap.values()]
    .map((c) => ({
      ...c,
      ctr: rate(c.clicks, c.impressions),
      cpc: rate(c.spend, c.clicks),
      cvr: rate(c.orders, c.clicks),
      acos: rate(c.spend, c.sales),
      roas: rate(c.sales, c.spend),
    }))
    .sort((a, b) => b.spend - a.spend);

  const winningCampaigns = campaigns
    .filter((c) => c.spend >= 40 && c.sales >= 150 && c.roas !== null && c.roas >= 4 && c.acos !== null && c.acos <= SOMARSH_ACOS_GOOD)
    .slice(0, 12);

  const watchCampaigns = campaigns
    .filter((c) =>
      c.spend >= 40 &&
      (
        c.sales === 0 ||
        (c.roas !== null && c.roas < 1.6) ||
        (c.acos !== null && c.acos >= SOMARSH_ACOS_BAD)
      )
    )
    .slice(0, 12);

  const daily = [...dailyMap.values()].sort((a, b) => {
    const da = new Date(a.label).getTime();
    const db = new Date(b.label).getTime();
    return da - db;
  });

  const avgSales = daily.length > 0 ? daily.reduce((s, d) => s + d.sales, 0) / daily.length : 0;
  const peakIdx = new Set<number>();
  for (let i = 0; i < daily.length; i++) {
    const d = daily[i];
    const prev = i > 0 ? daily[i - 1].sales : 0;
    const next = i < daily.length - 1 ? daily[i + 1].sales : 0;
    const localPeak = d.sales > prev && d.sales > next;
    const highSales = d.sales >= avgSales * 1.25;
    if (localPeak && highSales) peakIdx.add(i);
  }
  const topSalesIdx = daily
    .map((d, idx) => ({ idx, sales: d.sales }))
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 6)
    .map((x) => x.idx);
  topSalesIdx.forEach((idx) => peakIdx.add(idx));

  // Always include user-observed standout dates when present
  const forcedLabels = new Set(['Mar 1', 'Mar 3', 'Mar 11', 'Mar 25']);
  daily.forEach((d, idx) => {
    if (forcedLabels.has(d.label)) peakIdx.add(idx);
  });

  const peakInsights = [...peakIdx]
    .sort((a, b) => a - b)
    .map((idx) => {
      const d = daily[idx];
      const termMapForDay = dailyTermSales.get(d.label) ?? new Map<string, number>();
      const campaignMapForDay = dailyCampaignSales.get(d.label) ?? new Map<string, number>();
      const topTerm = [...termMapForDay.entries()].sort((a, b) => b[1] - a[1])[0];
      const topCampaign = [...campaignMapForDay.entries()].sort((a, b) => b[1] - a[1])[0];
      const dayAcos = d.sales > 0 ? d.spend / d.sales : null;
      const reasonParts = [
        topTerm?.[0] ? `Top converting term: "${topTerm[0]}" (${fmtMoney(topTerm[1])} sales)` : null,
        topCampaign?.[0] ? `Lead campaign: "${topCampaign[0]}" (${fmtMoney(topCampaign[1])} sales)` : null,
        `Day efficiency: ${fmtPct(dayAcos)} ACoS on ${fmtMoney(d.spend)} spend`,
      ].filter(Boolean);
      return {
        label: d.label,
        noteDate: `Peak ${d.label}`,
        text: reasonParts.join(' · '),
      };
    });

  return {
    windowStart: toDateLabel(minStartSerial),
    windowEnd: toDateLabel(maxEndSerial),
    totals: {
      ...totals,
      ctr: rate(totals.clicks, totals.impressions),
      cpc: rate(totals.spend, totals.clicks),
      cvr: rate(totals.orders, totals.clicks),
      acos: rate(totals.spend, totals.sales),
      roas: rate(totals.sales, totals.spend),
    },
    daily,
    peakInsights,
    campaigns,
    winningCampaigns,
    watchCampaigns,
    topTermsBySpend: terms.filter((t) => t.term !== '*').sort((a, b) => b.spend - a.spend).slice(0, 25),
    topTermsBySales: terms.filter((t) => t.term !== '*').sort((a, b) => b.sales - a.sales).slice(0, 25),
    wastedSpendTerms: terms.filter((t) => t.term !== '*' && t.spend > 0 && t.sales === 0).sort((a, b) => b.spend - a.spend).slice(0, 25),
  };
}

function fmtMoney(n: number): string {
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function fmtPct(v: number | null): string {
  if (v === null || !isFinite(v)) return '—';
  return `${(v * 100).toFixed(1)}%`;
}
