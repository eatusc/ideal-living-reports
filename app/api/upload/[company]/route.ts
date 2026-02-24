import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Maps company slug → local data folder name
const COMPANY_DIRS: Record<string, string> = {
  'rpd-walmart': 'rpd',
  'elevate':     'elevate',
  'rpd-hd':      'rpd-hd',
};

const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

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
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // Blob paths use the company slug so it's clear in the Vercel dashboard:
  //   rpd-walmart/latest.xlsx
  //   rpd-walmart/2026-02-24.xlsx
  //   elevate/latest.xlsx
  //   rpd-hd/latest.xlsx
  const blobLatest = `${company}/latest.xlsx`;
  const blobBackup = `${company}/${today}.xlsx`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import('@vercel/blob');

    const { url } = await put(blobLatest, buffer, {
      access: 'public',
      addRandomSuffix: false,
      contentType: XLSX_CONTENT_TYPE,
    });

    await put(blobBackup, buffer, {
      access: 'public',
      addRandomSuffix: false,
      contentType: XLSX_CONTENT_TYPE,
    });

    return NextResponse.json({
      ok: true,
      report: company,
      saved: blobLatest,
      backup: blobBackup,
      url,
      storage: 'blob',
    });
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
  });
}
