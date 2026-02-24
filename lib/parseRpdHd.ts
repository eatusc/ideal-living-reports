import * as XLSX from 'xlsx';
import { safeNum, safeRate, excelSerialToDateStr } from '@/lib/parseExcel';
import { getExcelBuffer } from '@/lib/blob';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RpdHdCampaignGroupData {
  group: string;
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

export interface RpdHdWeekData {
  label: string;
  startDate?: string;
  endDate?: string;
  sales: number;
  units: number;
  orderedItems: number;
  adSpend: number;
  adSales: number;
  acos: number | null;
  roas: number | null;
  organicSales: number;
  groups: RpdHdCampaignGroupData[];
}

// ─── Retailer direct sales types (HD US / HD Canada / Lowes) ─────────────────

export interface RetailerBrandData {
  brand: string;
  sales: number;
  units: number;
  orderedItems: number;
}

export interface RetailerWeekData {
  label: string;
  startDate?: string;
  endDate?: string;
  sales: number;
  units: number;
  orderedItems: number;
  brands: RetailerBrandData[];
}

export interface RetailerData {
  weeks: RetailerWeekData[];
  currentWeek: RetailerWeekData;
  previousWeek: RetailerWeekData;
}

export interface RpdHdDashboardData {
  // Orange Access advertising data
  weeks: RpdHdWeekData[];
  currentWeek: RpdHdWeekData;
  previousWeek: RpdHdWeekData;
  // Retailer direct sales (Rithum/DSCO)
  homeDepotUS: RetailerData;
  homeDepotCanada: RetailerData;
  lowes: RetailerData;
}

// ─── Orange Access parser ────────────────────────────────────────────────────

function parseOrangeAccess(wb: XLSX.WorkBook): { weeks: RpdHdWeekData[]; currentWeek: RpdHdWeekData; previousWeek: RpdHdWeekData } {
  const ws = wb.Sheets['ALL - 2026 - Orange Access'];
  if (!ws) throw new Error('Sheet "ALL - 2026 - Orange Access" not found in RPD-HD file');

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: true });

  //   col[1] = DATE / week label
  //   col[2] = Campaign Group per Brand
  //   col[3] = SALES         col[4] = UNITS SOLD    col[5] = ORDERED ITEMS
  //   col[9] = SP AD SPEND   col[10] = IMPRESSIONS
  //   col[11] = UNIT SALES (ad)  col[12] = AD SALES
  //   col[13] = ACoS         col[14] = ROAS         col[17] = ORGANIC SALES

  const weeks: RpdHdWeekData[] = [];
  let pendingGroups: RpdHdCampaignGroupData[] = [];
  let pendingFirstSerial: number | undefined = undefined;
  let pendingLastSerial: number | undefined = undefined;

  for (let i = 11; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    if (!row || !Array.isArray(row)) continue;
    const col1 = row[1];
    const col2 = row[2];

    if (typeof col1 === 'string' && col1.toLowerCase().includes('week')) {
      weeks.push({
        label: col1.trim(),
        startDate: pendingFirstSerial !== undefined ? excelSerialToDateStr(pendingFirstSerial) : undefined,
        endDate: pendingLastSerial !== undefined ? excelSerialToDateStr(pendingLastSerial) : undefined,
        sales: safeNum(row[3]),
        units: safeNum(row[4]),
        orderedItems: safeNum(row[5]),
        adSpend: safeNum(row[9]),
        adSales: safeNum(row[12]),
        acos: safeRate(row[13]),
        roas: safeRate(row[14]),
        organicSales: safeNum(row[17]),
        groups: [...pendingGroups],
      });
      pendingGroups = [];
      pendingFirstSerial = undefined;
      pendingLastSerial = undefined;
      continue;
    }

    if (col2 && typeof col2 === 'string' && col2.trim() !== '') {
      if (typeof col1 === 'number' && col1 > 40000) {
        if (pendingFirstSerial === undefined) pendingFirstSerial = col1;
        pendingLastSerial = col1;
      }
      pendingGroups.push({
        group: col2.trim(),
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
    }
  }

  if (weeks.length === 0) throw new Error('No weekly data found in RPD-HD Orange Access sheet');

  const currentWeek = weeks[weeks.length - 1];
  const previousWeek = weeks.length > 1 ? weeks[weeks.length - 2] : currentWeek;
  return { weeks, currentWeek, previousWeek };
}

// ─── Retailer sheet parser (HD US / HD Canada / Lowes) ───────────────────────
//
// Column layout (header at row 10, data from row 12):
//   col[1] = week label string OR date serial
//   col[2] = BRAND
//   col[3] = GWV (sales)
//   col[4] = UNITS SOLD
//   col[5] = ORDERED ITEMS
//
// Week summary row: col[1] is a string containing "week"
// Brand row: col[2] is a non-empty string
// Note: Lowes has two "Previous Week" rows — the last one before "Current Week" wins.

function parseRetailerSheet(wb: XLSX.WorkBook, sheetName: string): RetailerData {
  const emptyWeek = (label: string): RetailerWeekData => ({
    label, sales: 0, units: 0, orderedItems: 0, brands: [],
  });
  const empty: RetailerData = {
    weeks: [],
    currentWeek: emptyWeek('Current Week'),
    previousWeek: emptyWeek('Previous Week'),
  };

  const ws = wb.Sheets[sheetName];
  if (!ws) return empty;

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: true });

  const weeks: RetailerWeekData[] = [];
  let pendingBrands: RetailerBrandData[] = [];
  let pendingFirstSerial: number | undefined = undefined;
  let pendingLastSerial: number | undefined = undefined;
  let currentWeek: RetailerWeekData | null = null;
  let previousWeek: RetailerWeekData | null = null;

  for (let i = 12; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    if (!row || !Array.isArray(row)) continue;
    const col1 = row[1];
    const col2 = row[2];

    if (typeof col1 === 'string' && col1.toLowerCase().includes('week')) {
      const label = col1.trim();
      const week: RetailerWeekData = {
        label,
        startDate: pendingFirstSerial !== undefined ? excelSerialToDateStr(pendingFirstSerial) : undefined,
        endDate: pendingLastSerial !== undefined ? excelSerialToDateStr(pendingLastSerial) : undefined,
        sales: safeNum(row[3]),
        units: safeNum(row[4]),
        orderedItems: safeNum(row[5]),
        brands: [...pendingBrands],
      };
      weeks.push(week);
      if (label === 'Current Week') currentWeek = week;
      else if (label === 'Previous Week') previousWeek = week; // last one wins (Lowes quirk)
      pendingBrands = [];
      pendingFirstSerial = undefined;
      pendingLastSerial = undefined;
      continue;
    }

    if (col2 && typeof col2 === 'string' && col2.trim() !== '') {
      if (typeof col1 === 'number' && col1 > 40000) {
        if (pendingFirstSerial === undefined) pendingFirstSerial = col1;
        pendingLastSerial = col1;
      }
      pendingBrands.push({
        brand: col2.trim(),
        sales: safeNum(row[3]),
        units: safeNum(row[4]),
        orderedItems: safeNum(row[5]),
      });
    }
  }

  if (weeks.length === 0) return empty;

  return {
    weeks,
    currentWeek: currentWeek ?? weeks[weeks.length - 1],
    previousWeek: previousWeek ?? (weeks.length > 1 ? weeks[weeks.length - 2] : weeks[0]),
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function parseRpdHdData(): Promise<RpdHdDashboardData> {
  const buffer = await getExcelBuffer('rpd-hd');
  const wb = XLSX.read(buffer, { type: 'buffer' });

  const orangeAccess = parseOrangeAccess(wb);
  const homeDepotUS = parseRetailerSheet(wb, 'Home Depot - 2026');
  const homeDepotCanada = parseRetailerSheet(wb, 'Home Depot Canada - 2026');
  const lowes = parseRetailerSheet(wb, 'Lowes - 2026');

  return {
    ...orangeAccess,
    homeDepotUS,
    homeDepotCanada,
    lowes,
  };
}
