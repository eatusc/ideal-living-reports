import * as XLSX from 'xlsx';
import { getExcelBuffer } from '@/lib/blob';
import { safeNum, safeRate, excelSerialToDateStr } from '@/lib/parseExcel';

export interface SoMarshWeekData {
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
  organicSales: number;
}

export interface SoMarshDashboardData {
  weeks: SoMarshWeekData[];
  currentWeek: SoMarshWeekData;
  previousWeek: SoMarshWeekData;
}

function is2026WeeklyLabel(label: string): boolean {
  const v = label.trim().toLowerCase();
  return v.startsWith('2026 - week ') || v === 'current week' || v === 'previous week';
}

function parseWeeklySummary(wb: XLSX.WorkBook): SoMarshWeekData[] {
  const ws = wb.Sheets['2026 - Performance Report'];
  if (!ws) return [];

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: true });
  const weeks: SoMarshWeekData[] = [];
  let pendingFirstSerial: number | undefined;
  let pendingLastSerial: number | undefined;

  for (let i = 11; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    if (!row || !Array.isArray(row)) continue;

    const col0 = row[0];
    const col1 = row[1];

    if (typeof col0 === 'string' && col0.toLowerCase().includes('week')) {
      const label = col0.trim();
      if (is2026WeeklyLabel(label)) {
        const sales = safeNum(row[3]);
        const adSales = safeNum(row[12]);
        weeks.push({
          label,
          startDate: pendingFirstSerial !== undefined ? excelSerialToDateStr(pendingFirstSerial) : undefined,
          endDate: pendingLastSerial !== undefined ? excelSerialToDateStr(pendingLastSerial) : undefined,
          sales,
          units: safeNum(row[4]),
          orders: safeNum(row[5]),
          sessions: safeNum(row[9]),
          conversionRate: safeRate(row[10]),
          adSpend: safeNum(row[11]),
          adSales,
          adUnitSales: safeNum(row[13]),
          impressions: safeNum(row[14]),
          acos: safeRate(row[15]),
          roas: safeRate(row[16]),
          adRevenueShare: safeRate(row[17]),
          organicSales: Math.max(0, sales - adSales),
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

export async function parseSomarshData(): Promise<SoMarshDashboardData> {
  const buffer = await getExcelBuffer('somarsh');
  const wb = XLSX.read(buffer, { type: 'buffer' });

  const weeks = parseWeeklySummary(wb);
  if (weeks.length < 1) {
    throw new Error('No 2026 weekly summary rows found in SoMarsh file');
  }

  const currentWeek = weeks.find((w) => w.label === 'Current Week') ?? weeks[weeks.length - 1];
  const previousWeek =
    weeks.find((w) => w.label === 'Previous Week') ??
    (weeks.length > 1 ? weeks[weeks.length - 2] : currentWeek);

  return { weeks, currentWeek, previousWeek };
}
