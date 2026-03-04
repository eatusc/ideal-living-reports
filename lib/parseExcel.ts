import * as XLSX from 'xlsx';
import { getExcelBuffer } from '@/lib/blob';

// Re-export types and utilities from client-safe module
export type { BrandData, WeekData, DashboardData, SemCampaignData, SemWeekData, SemDashboardData } from '@/lib/formatUtils';
export { wowPct, fmtPct, fmtDollar, fmtRoas, acosClass } from '@/lib/formatUtils';

import type { BrandData, WeekData, DashboardData, SemCampaignData, SemWeekData, SemDashboardData } from '@/lib/formatUtils';

export function safeNum(val: unknown): number {
  if (typeof val === 'number') {
    if (isNaN(val) || !isFinite(val)) return 0;
    return val;
  }
  if (val === null || val === undefined) return 0;
  if (typeof val === 'string') {
    if (val.includes('#') || val.trim() === '' || val.toLowerCase() === 'to') return 0;
    const n = parseFloat(val);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

// Converts an Excel date serial number to a short date string e.g. "Feb 17"
export function excelSerialToDateStr(serial: number): string {
  const date = new Date((serial - 25569) * 86400000);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

// Returns null for error values (#DIV/0!, #REF!) — meaning "not applicable"
export function safeRate(val: unknown): number | null {
  if (typeof val === 'string' && val.includes('#')) return null;
  if (val === null || val === undefined) return null;
  const n = safeNum(val);
  return n;
}

export async function parseDashboardData(): Promise<DashboardData> {
  const buffer = await getExcelBuffer('rpd-walmart');
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets['WALMART_weekly_reporting_2026-B'];

  if (!ws) {
    throw new Error('Sheet "WALMART_weekly_reporting_2026-B" not found in Excel file');
  }

  // Parse as array of arrays; defval: null fills empty cells
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: null,
    raw: true,
  });

  // Main sheet has an extra col[4] ("Average Sales Price by Brand") that shifts
  // subsequent columns +1 vs the SEM sheets:
  //   col[3]  = SALES
  //   col[5]  = UNITS SOLD
  //   col[6]  = ORDERED ITEMS
  //   col[10] = SP AD SPEND
  //   col[12] = UNIT SALES
  //   col[13] = AD SALES
  //   col[14] = ACoS
  //   col[15] = ROAS
  //   col[18] = ORGANIC SALES

  const weeks: WeekData[] = [];
  let pendingBrands: BrandData[] = [];
  let pendingFirstSerial: number | undefined = undefined;
  let pendingLastSerial: number | undefined = undefined;

  // Data starts at row index 11 (0-based), which is after the header at row 10
  for (let i = 11; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    if (!row || !Array.isArray(row)) continue;

    const col1 = row[1]; // DATE / week label
    const col2 = row[2]; // BRAND

    // Detect week summary row: col1 is a string containing "Week"
    if (typeof col1 === 'string' && col1.toLowerCase().includes('week')) {
      weeks.push({
        label: col1.trim(),
        startDate: pendingFirstSerial !== undefined ? excelSerialToDateStr(pendingFirstSerial) : undefined,
        endDate: pendingLastSerial !== undefined ? excelSerialToDateStr(pendingLastSerial) : undefined,
        sales: safeNum(row[3]),
        units: safeNum(row[5]),
        orderedItems: safeNum(row[6]),
        adSpend: safeNum(row[10]),
        adSales: safeNum(row[13]),
        acos: safeRate(row[14]),
        roas: safeRate(row[15]),
        organicSales: safeNum(row[18]),
        brands: [...pendingBrands],
      });
      pendingBrands = [];
      pendingFirstSerial = undefined;
      pendingLastSerial = undefined;
      continue;
    }

    // Detect brand row: col2 is a non-empty string
    if (col2 && typeof col2 === 'string' && col2.trim() !== '') {
      // Track first and last date serials seen for this week group
      if (typeof col1 === 'number' && col1 > 40000) {
        if (pendingFirstSerial === undefined) pendingFirstSerial = col1;
        pendingLastSerial = col1;
      }
      const brand = col2.trim();
      pendingBrands.push({
        brand,
        sales: safeNum(row[3]),
        units: safeNum(row[5]),
        orderedItems: safeNum(row[6]),
        adSpend: safeNum(row[10]),
        adUnitSales: safeNum(row[12]),
        adSales: safeNum(row[13]),
        acos: safeRate(row[14]),
        roas: safeRate(row[15]),
        organicSales: safeNum(row[18]),
      });
    }
  }

  const currentWeek = weeks.find((w) => w.label === 'Current Week');
  const previousWeek = weeks.find((w) => w.label === 'Previous Week');

  if (!currentWeek) throw new Error('Could not find "Current Week" in Excel data');
  if (!previousWeek) throw new Error('Could not find "Previous Week" in Excel data');

  return { weeks, currentWeek, previousWeek };
}

export async function parseSemData(): Promise<SemDashboardData> {
  const buffer = await getExcelBuffer('rpd-walmart');
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets['SEM Campaigns Data 2026'];

  const empty: SemWeekData = {
    adSpend: 0, adSales: 0, acos: null, roas: null, impressions: 0, campaigns: [],
  };
  if (!ws) return { currentWeek: empty, previousWeek: empty };

  // SEM Campaigns Data sheet column layout (no extra col[4]):
  //   col[2]  = Campaign Name
  //   col[9]  = SP AD SPEND
  //   col[10] = IMPRESSIONS
  //   col[12] = AD SALES
  //   col[13] = ACoS
  //   col[14] = ROAS

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: null,
    raw: true,
  });

  let pendingCampaigns: SemCampaignData[] = [];
  let currentWeek: SemWeekData | null = null;
  let previousWeek: SemWeekData | null = null;

  for (let i = 11; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    if (!row || !Array.isArray(row)) continue;

    const col1 = row[1];
    const col2 = row[2];

    // Week summary row
    if (typeof col1 === 'string' && col1.toLowerCase().includes('week')) {
      const label = col1.trim();
      const week: SemWeekData = {
        adSpend: safeNum(row[9]),
        adSales: safeNum(row[12]),
        acos: safeRate(row[13]),
        roas: safeRate(row[14]),
        impressions: safeNum(row[10]),
        campaigns: [...pendingCampaigns],
      };
      if (label === 'Current Week') currentWeek = week;
      else if (label === 'Previous Week') previousWeek = week;
      pendingCampaigns = [];
      continue;
    }

    // Campaign row: col2 is campaign name
    if (col2 && typeof col2 === 'string' && col2.trim() !== '') {
      const campaign = col2.trim();
      // Strip "Dielon - " prefix for cleaner display
      const displayName = campaign.replace(/^Dielon\s*-\s*/i, '');
      pendingCampaigns.push({
        campaign,
        displayName,
        adSpend: safeNum(row[9]),
        adSales: safeNum(row[12]),
        acos: safeRate(row[13]),
        roas: safeRate(row[14]),
        impressions: safeNum(row[10]),
      });
    }
  }

  return {
    currentWeek: currentWeek ?? empty,
    previousWeek: previousWeek ?? empty,
  };
}

