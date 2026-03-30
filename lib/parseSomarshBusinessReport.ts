import { getBusinessReportCsvBuffer } from '@/lib/blob';

export interface SomarshAsinPerformanceRow {
  parentAsin: string;
  childAsin: string;
  title: string;
  sessions: number;
  unitsOrdered: number;
  totalOrderItems: number;
  orderedProductSales: number;
  unitSessionPct: number | null;
  buyBoxPct: number | null;
}

export interface SomarshAsinPerformanceSummary {
  sourcePath: string;
  sourceFileName: string;
  totalRows: number;
  filteredSellingRows: number;
  zeroRows: number;
  topSellers: SomarshAsinPerformanceRow[];
  topConverters: SomarshAsinPerformanceRow[];
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }

    current += ch;
  }

  cells.push(current);
  return cells;
}

function cleanNumber(raw: string): number {
  const normalized = raw
    .trim()
    .replace(/[$,%]/g, '')
    .replace(/,/g, '');

  if (!normalized) return 0;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function cleanPercent(raw: string): number | null {
  const normalized = raw.trim();
  if (!normalized) return null;
  const value = cleanNumber(normalized);
  return Number.isFinite(value) ? value / 100 : null;
}

function parseRowsFromBuffer(buffer: Buffer): {
  rows: SomarshAsinPerformanceRow[];
  totalRows: number;
  zeroRows: number;
} {
  const raw = buffer.toString('utf8');
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    return { rows: [], totalRows: 0, zeroRows: 0 };
  }

  const headers = parseCsvLine(lines[0]);
  const idx = (name: string) => headers.indexOf(name);

  const parentAsinIdx = idx('(Parent) ASIN');
  const childAsinIdx = idx('(Child) ASIN');
  const titleIdx = idx('Title');
  const sessionsIdx = idx('Sessions - Total');
  const unitsIdx = idx('Units Ordered');
  const orderItemsIdx = idx('Total Order Items');
  const salesIdx = idx('Ordered Product Sales');
  const unitSessionPctIdx = idx('Unit Session Percentage');
  const buyBoxPctIdx = idx('Featured Offer (Buy Box) Percentage');

  const required = [parentAsinIdx, childAsinIdx, titleIdx, sessionsIdx, unitsIdx, orderItemsIdx, salesIdx];
  if (required.some((i) => i < 0)) {
    throw new Error('Business report CSV is missing one or more required columns.');
  }

  const rows: SomarshAsinPerformanceRow[] = [];
  const totalRows = lines.length - 1;
  let zeroRows = 0;

  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < headers.length) continue;

    const row: SomarshAsinPerformanceRow = {
      parentAsin: cols[parentAsinIdx]?.trim() ?? '',
      childAsin: cols[childAsinIdx]?.trim() ?? '',
      title: cols[titleIdx]?.trim() ?? '',
      sessions: cleanNumber(cols[sessionsIdx] ?? ''),
      unitsOrdered: cleanNumber(cols[unitsIdx] ?? ''),
      totalOrderItems: cleanNumber(cols[orderItemsIdx] ?? ''),
      orderedProductSales: cleanNumber(cols[salesIdx] ?? ''),
      unitSessionPct: unitSessionPctIdx >= 0 ? cleanPercent(cols[unitSessionPctIdx] ?? '') : null,
      buyBoxPct: buyBoxPctIdx >= 0 ? cleanPercent(cols[buyBoxPctIdx] ?? '') : null,
    };

    if (!row.childAsin || !row.parentAsin) continue;
    if (row.orderedProductSales <= 0 && row.unitsOrdered <= 0) {
      zeroRows += 1;
      continue;
    }
    rows.push(row);
  }

  return { rows, totalRows, zeroRows };
}

export async function parseSomarshAsinPerformance(): Promise<SomarshAsinPerformanceSummary> {
  const company = 'somarsh';
  const sourcePath = `${company}/BusinessReport-latest.csv`;
  const sourceFileName = 'BusinessReport-latest.csv';
  const buffer = await getBusinessReportCsvBuffer(company);
  const { rows, totalRows, zeroRows } = parseRowsFromBuffer(buffer);

  const topSellers = [...rows]
    .sort((a, b) => {
      if (b.orderedProductSales !== a.orderedProductSales) {
        return b.orderedProductSales - a.orderedProductSales;
      }
      if (b.unitsOrdered !== a.unitsOrdered) return b.unitsOrdered - a.unitsOrdered;
      return b.sessions - a.sessions;
    })
    .slice(0, 30);

  const topConverters = [...rows]
    .filter((row) => row.sessions >= 30 && row.unitsOrdered >= 2 && row.unitSessionPct !== null)
    .sort((a, b) => {
      const aConv = a.unitSessionPct ?? 0;
      const bConv = b.unitSessionPct ?? 0;
      if (bConv !== aConv) return bConv - aConv;
      return b.orderedProductSales - a.orderedProductSales;
    })
    .slice(0, 8);

  return {
    sourcePath,
    sourceFileName,
    totalRows,
    filteredSellingRows: rows.length,
    zeroRows,
    topSellers,
    topConverters,
  };
}
