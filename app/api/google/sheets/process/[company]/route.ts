import { NextRequest, NextResponse } from 'next/server';
import { ensureFreshGoogleSession, parseSheetId } from '@/lib/googleSheetsAuth';
import {
  analyzeExcel,
  COMPANY_DIRS,
  detectCriticalDataIssues,
  getExpectedSheets,
  persistExcelBuffer,
  resolveExpectedSheets,
} from '@/lib/uploadExcel';

interface SpreadsheetMetaResponse {
  properties?: { title?: string };
  sheets?: Array<{ properties?: { title?: string } }>;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { company: string } }
) {
  const company = params.company;
  if (!COMPANY_DIRS[company]) {
    return NextResponse.json({ error: 'Invalid company' }, { status: 400 });
  }

  let session: Awaited<ReturnType<typeof ensureFreshGoogleSession>>['session'] = null;
  let setCookieOnResponse: Awaited<ReturnType<typeof ensureFreshGoogleSession>>['setCookieOnResponse'] = () => undefined;
  try {
    const fresh = await ensureFreshGoogleSession(request);
    session = fresh.session;
    setCookieOnResponse = fresh.setCookieOnResponse;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to validate Google session';
    return NextResponse.json({ error: message }, { status: 500 });
  }
  if (!session) {
    return NextResponse.json({ error: 'Google not connected. Connect Google first.' }, { status: 401 });
  }

  let sheetUrl = '';
  let confirmAnomalies = false;
  try {
    const body = await request.json();
    sheetUrl = typeof body?.sheetUrl === 'string' ? body.sheetUrl : '';
    confirmAnomalies = body?.confirmAnomalies === true;
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
  const availableSheets = (meta.sheets ?? [])
    .map((s) => s.properties?.title)
    .filter((t): t is string => !!t);

  if (availableSheets.length === 0) {
    return NextResponse.json({ error: 'Spreadsheet has no tabs' }, { status: 400 });
  }

  const expectedSheets = getExpectedSheets(company);
  const resolved = resolveExpectedSheets(company, availableSheets);
  const missingSheets = resolved.sheetsMissing;
  const matchedActual = new Set(Object.values(resolved.resolved));
  const extraSheets = availableSheets.filter((s) => !matchedActual.has(s));

  const anomalies: string[] = [];
  if (missingSheets.length > 0) {
    anomalies.push(`Missing expected sheet(s): ${missingSheets.join(', ')}`);
  }
  if (expectedSheets.length > 0 && availableSheets.length < expectedSheets.length) {
    anomalies.push(`Only ${availableSheets.length} tab(s) found but ${expectedSheets.length} expected for ${company}.`);
  }

  if (anomalies.length > 0 && !confirmAnomalies) {
    const response = NextResponse.json(
      {
        ok: false,
        requiresConfirmation: true,
        spreadsheetTitle,
        company,
        expectedSheets,
        availableSheets,
        missingSheets,
        extraSheets,
        anomalies,
      },
      { status: 409 }
    );
    setCookieOnResponse(response);
    return response;
  }

  // Export Google Sheet as native XLSX to preserve numeric values/formats exactly
  // (equivalent to manually downloading and uploading the file).
  const exportRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${sheetId}/export?mimeType=${encodeURIComponent('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}`,
    { headers: authHeader, cache: 'no-store' }
  );

  if (!exportRes.ok) {
    const text = await exportRes.text();
    const maybeScope = exportRes.status === 403
      ? ' (If this started after scope changes, disconnect/reconnect Google to grant Drive readonly scope.)'
      : '';
    return NextResponse.json(
      { error: `Failed to export spreadsheet as XLSX (${exportRes.status}): ${text.slice(0, 300)}${maybeScope}` },
      { status: exportRes.status }
    );
  }

  const buffer = Buffer.from(await exportRes.arrayBuffer());
  const analysis = analyzeExcel(buffer, company);
  const criticalIssues = detectCriticalDataIssues(buffer, company);

  if (criticalIssues.length > 0) {
    const response = NextResponse.json(
      {
        ok: false,
        blocked: true,
        spreadsheetTitle,
        company,
        expectedSheets,
        availableSheets,
        missingSheets,
        extraSheets,
        anomalies: criticalIssues,
        ...analysis,
      },
      { status: 422 }
    );
    setCookieOnResponse(response);
    return response;
  }

  try {
    const persisted = await persistExcelBuffer(company, buffer);
    const response = NextResponse.json({
      ok: true,
      processed: true,
      company,
      sheetId,
      spreadsheetTitle,
      expectedSheets,
      availableSheets,
      missingSheets,
      extraSheets,
      anomalies,
      ...analysis,
      ...persisted,
    });
    setCookieOnResponse(response);
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes('Blob storage not configured') ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
