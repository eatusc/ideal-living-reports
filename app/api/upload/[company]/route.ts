import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const COMPANY_DIRS: Record<string, string> = {
  'rpd-walmart': 'rpd',
  'elevate': 'elevate',
  'rpd-hd': 'rpd-hd',
};

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

  const dataDir = path.join(process.cwd(), 'data', dir);
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  // Save as latest.xlsx (overwrite)
  const latestPath = path.join(dataDir, 'latest.xlsx');
  fs.writeFileSync(latestPath, buffer);

  // Save dated backup
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const backupName = `${today}.xlsx`;
  const backupPath = path.join(dataDir, backupName);
  fs.writeFileSync(backupPath, buffer);

  return NextResponse.json({ ok: true, saved: 'latest.xlsx', backup: backupName });
}
