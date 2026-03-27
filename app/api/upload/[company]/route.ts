import { NextRequest, NextResponse } from 'next/server';
import { analyzeExcel, COMPANY_DIRS, persistExcelBuffer } from '@/lib/uploadExcel';

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
  const analysis = analyzeExcel(buffer, company);
  try {
    const persisted = await persistExcelBuffer(company, buffer);
    return NextResponse.json({
      ok: true,
      report: company,
      ...persisted,
      ...analysis,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes('Blob storage not configured') ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
