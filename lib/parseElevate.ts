import * as XLSX from 'xlsx';
import { safeNum, safeRate, excelSerialToDateStr } from '@/lib/parseExcel';
import { getExcelBuffer } from '@/lib/blob';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ElevateWeekData {
  label: string;
  startDate?: string;
  endDate?: string;
  sales: number;
  units: number;
  orders: number;
  sessions: number;
  conversionRate: number | null;
  adSpend: number;
  adSales: number;
  adUnitSales: number;
  impressions: number;
  acos: number | null;
  roas: number | null;
}

export interface ElevateWalmartWeekData {
  label: string;
  startDate?: string;
  endDate?: string;
  sales: number;
  units: number;
  orderedItems: number;
  adSpend: number;
  adSales: number;
  adUnitSales: number;
  impressions: number;
  acos: number | null;
  roas: number | null;
  organicSales: number;
}

export interface ElevateSemCampaign {
  campaign: string;
  adSpend: number;
  adSales: number;
  impressions: number;
  acos: number | null;
  roas: number | null;
}

export interface ElevateSemWeek {
  label: string;
  adSpend: number;
  adSales: number;
  impressions: number;
  acos: number | null;
  roas: number | null;
  campaigns: ElevateSemCampaign[];
}

export interface ElevateDashboardData {
  amazon: {
    weeks: ElevateWeekData[];
    currentWeek: ElevateWeekData;
    previousWeek: ElevateWeekData;
  };
  walmart: {
    weeks: ElevateWalmartWeekData[];
    currentWeek: ElevateWalmartWeekData;
    previousWeek: ElevateWalmartWeekData;
  };
  sem: {
    currentWeek: ElevateSemWeek;
    previousWeek: ElevateSemWeek;
  };
}

// ─── Amazon parser ───────────────────────────────────────────────────────────

function parseAmazon(wb: XLSX.WorkBook): ElevateWeekData[] {
  const ws = wb.Sheets['2026 - Amazon Performance Repor'];
  if (!ws) return [];

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: true });
  const weeks: ElevateWeekData[] = [];
  let pendingFirstSerialA: number | undefined = undefined;
  let pendingLastSerialA: number | undefined = undefined;

  // Data starts at row index 11 (0-based).
  // Amazon sheet has week label in col[0] (not col[1] like the other sheets).
  for (let i = 11; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    if (!row || !Array.isArray(row)) continue;
    const col0 = row[0];
    if (typeof col0 === 'string' && col0.toLowerCase().includes('week')) {
      weeks.push({
        label: col0.trim(),
        startDate: pendingFirstSerialA !== undefined ? excelSerialToDateStr(pendingFirstSerialA) : undefined,
        endDate: pendingLastSerialA !== undefined ? excelSerialToDateStr(pendingLastSerialA) : undefined,
        sales: safeNum(row[3]),
        units: safeNum(row[4]),
        orders: safeNum(row[5]),
        sessions: safeNum(row[9]),
        conversionRate: safeRate(row[10]),
        adSpend: safeNum(row[11]),
        adSales: safeNum(row[12]),
        adUnitSales: safeNum(row[13]),
        impressions: safeNum(row[14]),
        acos: safeRate(row[15]),
        roas: safeRate(row[16]),
      });
      pendingFirstSerialA = undefined;
      pendingLastSerialA = undefined;
    } else {
      // Daily rows: col[0] = week group string (e.g. "12-2025"), col[1] = date serial
      const col1 = row[1];
      if (typeof col1 === 'number' && col1 > 40000) {
        if (pendingFirstSerialA === undefined) pendingFirstSerialA = col1;
        pendingLastSerialA = col1;
      }
    }
  }

  return weeks;
}

// ─── Walmart parser ──────────────────────────────────────────────────────────

function parseWalmart(wb: XLSX.WorkBook): ElevateWalmartWeekData[] {
  const ws = wb.Sheets['2026 - Walmart Performance Repo'];
  if (!ws) return [];

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: true });
  const weeks: ElevateWalmartWeekData[] = [];
  let pendingFirstSerialW: number | undefined = undefined;
  let pendingLastSerialW: number | undefined = undefined;

  for (let i = 11; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    if (!row || !Array.isArray(row)) continue;
    const col1 = row[1];
    if (typeof col1 === 'string' && col1.toLowerCase().includes('week')) {
      weeks.push({
        label: col1.trim(),
        startDate: pendingFirstSerialW !== undefined ? excelSerialToDateStr(pendingFirstSerialW) : undefined,
        endDate: pendingLastSerialW !== undefined ? excelSerialToDateStr(pendingLastSerialW) : undefined,
        sales: safeNum(row[3]),
        units: safeNum(row[4]),
        orderedItems: safeNum(row[5]),
        adSpend: safeNum(row[9]),
        adSales: safeNum(row[12]),
        adUnitSales: safeNum(row[11]),
        impressions: safeNum(row[10]),
        acos: safeRate(row[13]),
        roas: safeRate(row[14]),
        organicSales: safeNum(row[17]),
      });
      pendingFirstSerialW = undefined;
      pendingLastSerialW = undefined;
    } else if (typeof col1 === 'number' && col1 > 40000) {
      if (pendingFirstSerialW === undefined) pendingFirstSerialW = col1;
      pendingLastSerialW = col1;
    }
  }

  return weeks;
}

// ─── SEM parser ──────────────────────────────────────────────────────────────

function parseSem(wb: XLSX.WorkBook): { currentWeek: ElevateSemWeek; previousWeek: ElevateSemWeek } {
  const empty: ElevateSemWeek = { label: '', adSpend: 0, adSales: 0, impressions: 0, acos: null, roas: null, campaigns: [] };
  const ws = wb.Sheets['2026 SEM Campaigns Data - per d'];
  if (!ws) return { currentWeek: empty, previousWeek: empty };

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: true });
  const semWeeks: ElevateSemWeek[] = [];
  let pendingCampaigns: ElevateSemCampaign[] = [];

  for (let i = 11; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    if (!row || !Array.isArray(row)) continue;
    const col1 = row[1];
    const col2 = row[2];

    if (typeof col1 === 'string' && col1.toLowerCase().includes('week')) {
      semWeeks.push({
        label: col1.trim(),
        adSpend: safeNum(row[9]),
        adSales: safeNum(row[12]),
        impressions: safeNum(row[10]),
        acos: safeRate(row[13]),
        roas: safeRate(row[14]),
        campaigns: [...pendingCampaigns],
      });
      pendingCampaigns = [];
      continue;
    }

    if (col2 && typeof col2 === 'string' && col2.trim() !== '') {
      pendingCampaigns.push({
        campaign: col2.trim(),
        adSpend: safeNum(row[9]),
        adSales: safeNum(row[12]),
        impressions: safeNum(row[10]),
        acos: safeRate(row[13]),
        roas: safeRate(row[14]),
      });
    }
  }

  if (semWeeks.length === 0) return { currentWeek: empty, previousWeek: empty };
  const currentWeek =
    semWeeks.find((w) => w.label === 'Current Week') ?? semWeeks[semWeeks.length - 1];
  const previousWeek =
    semWeeks.find((w) => w.label === 'Previous Week') ??
    (semWeeks.length > 1 ? semWeeks[semWeeks.length - 2] : empty);
  return { currentWeek, previousWeek };
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function parseElevateData(): Promise<ElevateDashboardData> {
  const buffer = await getExcelBuffer('elevate');
  const wb = XLSX.read(buffer, { type: 'buffer' });

  const amazonWeeks = parseAmazon(wb);
  const walmartWeeks = parseWalmart(wb);
  const sem = parseSem(wb);

  if (amazonWeeks.length < 1) throw new Error('No weekly Amazon data found in Elevate file');
  if (walmartWeeks.length < 1) throw new Error('No weekly Walmart data found in Elevate file');

  const amazonCurrent =
    amazonWeeks.find((w) => w.label === 'Current Week') ?? amazonWeeks[amazonWeeks.length - 1];
  const amazonPrevious =
    amazonWeeks.find((w) => w.label === 'Previous Week') ??
    (amazonWeeks.length > 1 ? amazonWeeks[amazonWeeks.length - 2] : amazonCurrent);

  const walmartCurrent =
    walmartWeeks.find((w) => w.label === 'Current Week') ?? walmartWeeks[walmartWeeks.length - 1];
  const walmartPrevious =
    walmartWeeks.find((w) => w.label === 'Previous Week') ??
    (walmartWeeks.length > 1 ? walmartWeeks[walmartWeeks.length - 2] : walmartCurrent);

  return {
    amazon: { weeks: amazonWeeks, currentWeek: amazonCurrent, previousWeek: amazonPrevious },
    walmart: { weeks: walmartWeeks, currentWeek: walmartCurrent, previousWeek: walmartPrevious },
    sem,
  };
}
