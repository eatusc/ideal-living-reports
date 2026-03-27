import { NextRequest, NextResponse } from 'next/server';
import { ensureFreshGoogleSession, parseSheetId } from '@/lib/googleSheetsAuth';

interface SpreadsheetMetaResponse {
  properties?: { title?: string };
  sheets?: Array<{ properties?: { title?: string } }>;
}

interface ValueRange {
  range?: string;
  values?: string[][];
}

interface BatchValuesResponse {
  valueRanges?: ValueRange[];
}

function toA1Range(sheetTitle: string): string {
  const escaped = sheetTitle.replace(/'/g, "''");
  return `'${escaped}'!A1:Z30`;
}

export async function POST(request: NextRequest) {
  const { session, setCookieOnResponse } = await ensureFreshGoogleSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Google not connected. Connect Google first.' }, { status: 401 });
  }

  let sheetUrl = '';
  try {
    const body = await request.json();
    sheetUrl = typeof body?.sheetUrl === 'string' ? body.sheetUrl : '';
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const sheetId = parseSheetId(sheetUrl);
  if (!sheetId) {
    return NextResponse.json({ error: 'Invalid Google Sheet URL or ID' }, { status: 400 });
  }

  const authHeader = { Authorization: `Bearer ${session.accessToken}` };

  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=properties.title,sheets.properties.title`,
    { headers: authHeader, cache: 'no-store' }
  );

  if (!metaRes.ok) {
    const text = await metaRes.text();
    return NextResponse.json(
      { error: `Failed to read spreadsheet metadata (${metaRes.status}): ${text.slice(0, 300)}` },
      { status: metaRes.status }
    );
  }

  const meta = (await metaRes.json()) as SpreadsheetMetaResponse;
  const spreadsheetTitle = meta.properties?.title ?? '(untitled)';
  const tabTitles = (meta.sheets ?? [])
    .map((s) => s.properties?.title)
    .filter((t): t is string => !!t);

  if (tabTitles.length === 0) {
    return NextResponse.json({ error: 'Spreadsheet has no tabs' }, { status: 400 });
  }

  const params = new URLSearchParams();
  params.set('majorDimension', 'ROWS');
  for (const title of tabTitles) {
    params.append('ranges', toA1Range(title));
  }

  const valuesRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchGet?${params.toString()}`, {
    headers: authHeader,
    cache: 'no-store',
  });

  if (!valuesRes.ok) {
    const text = await valuesRes.text();
    return NextResponse.json(
      { error: `Failed to read sheet values (${valuesRes.status}): ${text.slice(0, 300)}` },
      { status: valuesRes.status }
    );
  }

  const values = (await valuesRes.json()) as BatchValuesResponse;
  const valueRanges = values.valueRanges ?? [];

  const sheets = tabTitles.map((title, i) => {
    const rows = valueRanges[i]?.values ?? [];
    return {
      title,
      rowCount: rows.length,
      headers: rows[0] ?? [],
      sampleRows: rows.slice(1, 11),
    };
  });

  const response = NextResponse.json({
    ok: true,
    spreadsheetTitle,
    sheetId,
    firstTab: tabTitles[0],
    sheetCount: sheets.length,
    sheets,
  });

  setCookieOnResponse(response);
  return response;
}
