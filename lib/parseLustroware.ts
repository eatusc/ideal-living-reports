import * as XLSX from 'xlsx';
import { getExcelBuffer } from '@/lib/blob';
import { safeNum, safeRate, excelSerialToDateStr } from '@/lib/parseExcel';

export interface LustrowareWeekData {
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
  adRevenueShare: number | null;
}

export interface LustrowareSkuData {
  sku: string;
  product: string;
  sales: number;
  units: number;
  orders: number;
  adSpend: number;
  adSales: number;
  acos: number | null;
  roas: number | null;
}

export interface LustrowareDashboardData {
  weeks: LustrowareWeekData[];
  currentWeek: LustrowareWeekData;
  previousWeek: LustrowareWeekData;
  currentWeekSkus: LustrowareSkuData[];
}

function is2026WeeklyLabel(label: string): boolean {
  const v = label.trim().toLowerCase();
  return v.startsWith('2026 - week ') || v === 'current week' || v === 'previous week';
}

function parseWeeklySummary(wb: XLSX.WorkBook): LustrowareWeekData[] {
  const ws = wb.Sheets['2026 - Performance Report'];
  if (!ws) return [];

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: true });
  const weeks: LustrowareWeekData[] = [];
  let pendingFirstSerial: number | undefined = undefined;
  let pendingLastSerial: number | undefined = undefined;

  for (let i = 11; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    if (!row || !Array.isArray(row)) continue;

    const col0 = row[0];
    const col1 = row[1];

    if (typeof col0 === 'string' && col0.toLowerCase().includes('week')) {
      const label = col0.trim();
      if (is2026WeeklyLabel(label)) {
        weeks.push({
          label,
          startDate: pendingFirstSerial !== undefined ? excelSerialToDateStr(pendingFirstSerial) : undefined,
          endDate: pendingLastSerial !== undefined ? excelSerialToDateStr(pendingLastSerial) : undefined,
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
          adRevenueShare: safeRate(row[17]),
        });
      }
      pendingFirstSerial = undefined;
      pendingLastSerial = undefined;
      continue;
    }

    if (typeof col1 === 'number' && col1 > 40000) {
      if (pendingFirstSerial === undefined) pendingFirstSerial = col1;
      pendingLastSerial = col1;
    }
  }

  return weeks;
}

function parseCurrentWeekSkus(wb: XLSX.WorkBook): LustrowareSkuData[] {
  const ws = wb.Sheets['2026 - As inidividual SKUs'];
  if (!ws) return [];

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: true });
  let currentWeekIndex = -1;

  for (let i = 11; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    if (!row || !Array.isArray(row)) continue;
    if (String(row[0] ?? '').trim().toLowerCase() === 'current week') {
      currentWeekIndex = i;
    }
  }

  if (currentWeekIndex < 0) return [];

  const skus: LustrowareSkuData[] = [];
  for (let i = currentWeekIndex - 1; i >= 11; i--) {
    const row = rows[i] as unknown[];
    if (!row || !Array.isArray(row)) continue;
    const label = String(row[0] ?? '').toLowerCase();
    if (label.includes('week')) break;

    const sku = String(row[2] ?? '').trim();
    const product = String(row[3] ?? '').trim();
    if (!sku || !product) continue;

    skus.push({
      sku,
      product,
      sales: safeNum(row[5]),
      units: safeNum(row[6]),
      orders: safeNum(row[7]),
      adSpend: safeNum(row[13]),
      adSales: safeNum(row[14]),
      acos: safeRate(row[17]),
      roas: safeRate(row[18]),
    });
  }

  return skus.sort((a, b) => b.sales - a.sales);
}

export async function parseLustrowareData(): Promise<LustrowareDashboardData> {
  const buffer = await getExcelBuffer('lustroware');
  const wb = XLSX.read(buffer, { type: 'buffer' });

  const weeks = parseWeeklySummary(wb);
  if (weeks.length < 1) throw new Error('No 2026 weekly summary rows found in Lustroware file');

  const currentWeek =
    weeks.find((w) => w.label === 'Current Week') ?? weeks[weeks.length - 1];
  const previousWeek =
    weeks.find((w) => w.label === 'Previous Week') ??
    (weeks.length > 1 ? weeks[weeks.length - 2] : currentWeek);

  return {
    weeks,
    currentWeek,
    previousWeek,
    currentWeekSkus: parseCurrentWeekSkus(wb),
  };
}
