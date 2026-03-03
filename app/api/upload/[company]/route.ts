import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

// Maps company slug → local data folder name
const COMPANY_DIRS: Record<string, string> = {
  'rpd-walmart': 'rpd',
  'elevate':     'elevate',
  'rpd-hd':      'rpd-hd',
};

const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// Sheets each report expects (for validation feedback)
const EXPECTED_SHEETS: Record<string, string[]> = {
  'rpd-walmart': ['WALMART_weekly_reporting_2026-B', 'SEM Campaigns Data 2026'],
  'elevate':     ['2026 - Amazon Performance Repor', '2026 - Walmart Performance Repo', '2026 SEM Campaigns Data - per d'],
  'rpd-hd':      ['ALL - 2026 - Orange Access'],
};

/** Quick-scan the Excel buffer for sheet validation and row/week counts */
function analyzeExcel(buffer: Buffer, company: string): {
  sheetsFound: string[];
  sheetsMissing: string[];
  totalDataRows: number;
  weeksFound: number;
  summary: string;
} {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const expected = EXPECTED_SHEETS[company] ?? [];
  const sheetsFound = expected.filter((s) => wb.SheetNames.includes(s));
  const sheetsMissing = expected.filter((s) => !wb.SheetNames.includes(s));

  let totalDataRows = 0;
  let weeksFound = 0;

  for (const sheetName of sheetsFound) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: true });
    // Data starts at row 11 (0-indexed)
    for (let i = 11; i < rows.length; i++) {
      const row = rows[i] as unknown[];
      if (!row || !Array.isArray(row)) continue;
      // Check col[0] or col[1] for week labels
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

export async function POST(
  request: NextRequest,
  { params }: { params: { company: string } }
) {
  const { company } = params;
  const dir = COMPANY_DIRS[company];
  if (!dir) {
    return NextResponse.json({ error: 'Invalid company' }, { status: 400 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Failed to parse form data' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
    return NextResponse.json({ error: 'Only Excel files (.xlsx, .xls) are accepted' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const today = new Date().toISOString().slice(0, 10);

  // Analyze the Excel file for validation feedback
  const analysis = analyzeExcel(buffer, company);

  // Blob keys: rpd-walmart/latest.xlsx, elevate/latest.xlsx, rpd-hd/latest.xlsx
  const blobLatest = `${company}/latest.xlsx`;
  const blobBackup = `${company}/${today}.xlsx`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
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

      return NextResponse.json({
        ok: true,
        report: company,
        saved: blobLatest,
        backup: blobBackup,
        url,
        storage: 'blob',
        ...analysis,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: `Blob upload failed: ${message}` }, { status: 500 });
    }
  }

  // In production without a Blob token, refuse clearly instead of crashing
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Blob storage not configured — add BLOB_READ_WRITE_TOKEN in Vercel environment variables.' },
      { status: 503 }
    );
  }

  // Local dev — write to disk
  const dataDir = path.join(process.cwd(), 'data', dir);
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  fs.writeFileSync(path.join(dataDir, 'latest.xlsx'), buffer);
  fs.writeFileSync(path.join(dataDir, `${today}.xlsx`), buffer);

  return NextResponse.json({
    ok: true,
    report: company,
    saved: `data/${dir}/latest.xlsx`,
    backup: `data/${dir}/${today}.xlsx`,
    storage: 'local',
    ...analysis,
  });
}
