import * as XLSX from 'xlsx';
import { safeNum, safeRate, excelSerialToDateStr } from '@/lib/parseExcel';
import { getExcelBuffer } from '@/lib/blob';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RpdHdCampaignGroupData {
  group: string;        // "Campaign Group per Brand" — e.g. "AIRDOCTOR - US"
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

export interface RpdHdDashboardData {
  weeks: RpdHdWeekData[];
  currentWeek: RpdHdWeekData;
  previousWeek: RpdHdWeekData;
}

// ─── Parser ───────────────────────────────────────────────────────────────────

export async function parseRpdHdData(): Promise<RpdHdDashboardData> {
  const buffer = await getExcelBuffer('rpd-hd');
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets['ALL - 2026 - Orange Access'];

  if (!ws) {
    throw new Error('Sheet "ALL - 2026 - Orange Access" not found in RPD-HD file');
  }

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: true });

  // Structure mirrors RPD Walmart:
  //   col[1] = DATE / week label
  //   col[2] = Campaign Group per Brand
  //   col[3] = SALES
  //   col[4] = UNITS SOLD
  //   col[5] = ORDERED ITEMS
  //   col[9] = SP AD SPEND
  //   col[10] = IMPRESSIONS
  //   col[11] = UNIT SALES (ad)
  //   col[12] = AD SALES
  //   col[13] = ACoS
  //   col[14] = ROAS
  //   col[17] = ORGANIC SALES

  const weeks: RpdHdWeekData[] = [];
  let pendingGroups: RpdHdCampaignGroupData[] = [];
  let pendingFirstSerial: number | undefined = undefined;
  let pendingLastSerial: number | undefined = undefined;

  for (let i = 11; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    if (!row || !Array.isArray(row)) continue;

    const col1 = row[1];
    const col2 = row[2];

    // Week summary row: col1 contains "Week" or "week"
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

    // Campaign group row: col2 is a non-empty string
    if (col2 && typeof col2 === 'string' && col2.trim() !== '') {
      // Track first and last date serials for this week group (skip non-numeric col1 like "to")
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
