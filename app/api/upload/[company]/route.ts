import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const COMPANY_DIRS: Record<string, string> = {
  'rpd-walmart': 'rpd',
  'elevate': 'elevate',
  'rpd-hd': 'rpd-hd',
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

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    // Vercel Blob — overwrite latest + save dated backup
    const { put } = await import('@vercel/blob');
    await put(`${dir}/latest.xlsx`, buffer, {
      access: 'public',
      addRandomSuffix: false,
      contentType: XLSX_CONTENT_TYPE,
    });
    await put(`${dir}/${today}.xlsx`, buffer, {
      access: 'public',
      addRandomSuffix: false,
      contentType: XLSX_CONTENT_TYPE,
    });
    return NextResponse.json({ ok: true, saved: `${dir}/latest.xlsx`, backup: `${dir}/${today}.xlsx`, storage: 'blob' });
  }

  // Local dev — write to disk
  const dataDir = path.join(process.cwd(), 'data', dir);
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  fs.writeFileSync(path.join(dataDir, 'latest.xlsx'), buffer);
  fs.writeFileSync(path.join(dataDir, `${today}.xlsx`), buffer);

  return NextResponse.json({ ok: true, saved: 'latest.xlsx', backup: `${today}.xlsx`, storage: 'local' });
}
