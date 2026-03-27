import { put } from '@vercel/blob';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

export const COMPANY_DIRS: Record<string, string> = {
  'rpd-walmart': 'rpd',
  'elevate': 'elevate',
  'rpd-hd': 'rpd-hd',
  'lustroware': 'lustroware',
  'somarsh': 'somarsh',
};

export const EXPECTED_SHEETS: Record<string, string[]> = {
  'rpd-walmart': ['WALMART_weekly_reporting_2026-B', 'SEM Campaigns Data 2026'],
  elevate: ['2026 - Amazon Performance Repor', '2026 - Walmart Performance Repo', '2026 SEM Campaigns Data - per d'],
  'rpd-hd': ['ALL - 2026 - Orange Access'],
  lustroware: ['2026 - Performance Report', '2026 - As inidividual SKUs'],
  somarsh: ['ai-last30-Sponsored_Products_Se'],
};

const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function normalizeSheetName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function resolveSheetName(expected: string, availableNames: string[]): string | null {
  if (availableNames.includes(expected)) return expected;

  const exactCaseInsensitive = availableNames.find((n) => n.toLowerCase() === expected.toLowerCase());
  if (exactCaseInsensitive) return exactCaseInsensitive;

  const expectedNorm = normalizeSheetName(expected);
  const normalizedMatch = availableNames.find((n) => normalizeSheetName(n) === expectedNorm);
  if (normalizedMatch) return normalizedMatch;

  const fuzzy = availableNames.find((n) => {
    const an = normalizeSheetName(n);
    return an.includes(expectedNorm) || expectedNorm.includes(an);
  });
  if (fuzzy) return fuzzy;

  return null;
}

export function resolveExpectedSheets(company: string, availableNames: string[]): {
  resolved: Record<string, string>;
  sheetsFound: string[];
  sheetsMissing: string[];
} {
  const expected = EXPECTED_SHEETS[company] ?? [];
  const resolved: Record<string, string> = {};
  const sheetsFound: string[] = [];
  const sheetsMissing: string[] = [];

  for (const exp of expected) {
    const actual = resolveSheetName(exp, availableNames);
    if (actual) {
      resolved[exp] = actual;
      sheetsFound.push(exp);
    } else {
      sheetsMissing.push(exp);
    }
  }

  return { resolved, sheetsFound, sheetsMissing };
}

export function analyzeExcel(buffer: Buffer, company: string): {
  sheetsFound: string[];
  sheetsMissing: string[];
  totalDataRows: number;
  weeksFound: number;
  summary: string;
} {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const { resolved, sheetsFound, sheetsMissing } = resolveExpectedSheets(company, wb.SheetNames);

  let totalDataRows = 0;
  let weeksFound = 0;

  for (const expectedName of sheetsFound) {
    const actualName = resolved[expectedName];
    const ws = actualName ? wb.Sheets[actualName] : undefined;
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: true });
    for (let i = 11; i < rows.length; i++) {
      const row = rows[i] as unknown[];
      if (!row || !Array.isArray(row)) continue;
      const col0 = row[0];
      const col1 = row[1];
      const isWeekRow =
        (typeof col0 === 'string' && col0.toLowerCase().includes('week')) ||
        (typeof col1 === 'string' && col1.toLowerCase().includes('week'));
      if (isWeekRow) weeksFound++;
      else totalDataRows++;
    }
  }

  let summary: string;
  if (sheetsMissing.length > 0) {
    summary = `Warning: missing sheets: ${sheetsMissing.join(', ')}`;
  } else if (weeksFound === 0) {
    summary = `${sheetsFound.length} sheet(s) found but 0 weeks detected — check data format`;
  } else {
    summary = `${sheetsFound.length} sheet(s) · ${weeksFound} weeks · ${totalDataRows} data rows processed`;
  }

  return { sheetsFound, sheetsMissing, totalDataRows, weeksFound, summary };
}

export async function persistExcelBuffer(company: string, buffer: Buffer) {
  const dir = COMPANY_DIRS[company];
  if (!dir) throw new Error('Invalid company');

  const today = new Date().toISOString().slice(0, 10);
  const blobLatest = `${company}/latest.xlsx`;
  const blobBackup = `${company}/${today}.xlsx`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { url } = await put(blobLatest, buffer, {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: XLSX_CONTENT_TYPE,
    });

    await put(blobBackup, buffer, {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: XLSX_CONTENT_TYPE,
    });

    return {
      storage: 'blob' as const,
      url,
      saved: blobLatest,
      backup: blobBackup,
    };
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('Blob storage not configured — add BLOB_READ_WRITE_TOKEN in environment variables.');
  }

  const dataDir = path.join(process.cwd(), 'data', dir);
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  fs.writeFileSync(path.join(dataDir, 'latest.xlsx'), buffer);
  fs.writeFileSync(path.join(dataDir, `${today}.xlsx`), buffer);

  return {
    storage: 'local' as const,
    saved: `data/${dir}/latest.xlsx`,
    backup: `data/${dir}/${today}.xlsx`,
  };
}

export function getExpectedSheets(company: string): string[] {
  return EXPECTED_SHEETS[company] ?? [];
}

function parseNumberLike(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw) return null;
  const normalized = raw
    .replace(/[$,%\s]/g, '')
    .replace(/,/g, '')
    .replace(/\(([^)]+)\)/, '-$1');
  if (!normalized || /^[-#A-Za-z/]+$/.test(normalized)) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export function detectCriticalDataIssues(buffer: Buffer, company: string): string[] {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const { resolved, sheetsFound } = resolveExpectedSheets(company, wb.SheetNames);
  if (sheetsFound.length === 0) {
    return ['No expected report tabs were found in the spreadsheet.'];
  }

  let positiveSignal = 0;
  for (const expectedName of sheetsFound) {
    const actualName = resolved[expectedName];
    const ws = actualName ? wb.Sheets[actualName] : undefined;
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: true });
    const headerWindow = Math.min(rows.length, 80);
    for (let r = 0; r < headerWindow; r++) {
      const row = rows[r];
      if (!Array.isArray(row)) continue;
      const targetCols: number[] = [];
      row.forEach((cell, idx) => {
        const text = cell === null || cell === undefined ? '' : String(cell).toLowerCase();
        if (!text) return;
        if (text.includes('sales') || text.includes('ad sales') || text.includes('spend') || text.includes('revenue')) {
          targetCols.push(idx);
        }
      });
      if (targetCols.length === 0) continue;

      let localPositive = 0;
      for (let rr = r + 1; rr < rows.length; rr++) {
        const dataRow = rows[rr];
        if (!Array.isArray(dataRow)) continue;
        for (const c of targetCols) {
          const n = parseNumberLike(dataRow[c]);
          if (n !== null && n > 0) localPositive += n;
        }
      }
      if (localPositive > 0) {
        positiveSignal += localPositive;
        break;
      }
    }
  }

  if (positiveSignal <= 0) {
    return ['Critical metrics appear zero/empty (sales, ad sales, spend). Processing was blocked to prevent bad dashboard data.'];
  }

  return [];
}
