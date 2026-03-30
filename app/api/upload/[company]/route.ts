import { NextRequest, NextResponse } from 'next/server';
import {
  analyzeBusinessReportCsv,
  analyzeExcel,
  COMPANY_DIRS,
  persistBusinessReportCsvBuffer,
  persistExcelBuffer,
} from '@/lib/uploadExcel';

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

  const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
  const isCsv = file.name.toLowerCase().endsWith('.csv');

  if (!isExcel && !isCsv) {
    return NextResponse.json({ error: 'Only Excel files (.xlsx, .xls) and CSV files are accepted' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  if (company === 'somarsh' && isCsv) {
    const isBusinessReport = /businessreport/i.test(file.name);
    if (!isBusinessReport) {
      return NextResponse.json(
        { error: 'For SoMarsh CSV uploads, filename must include "BusinessReport" (example: BusinessReport-3-30-26.csv).' },
        { status: 400 }
      );
    }

    const analysis = analyzeBusinessReportCsv(buffer);
    try {
      const persisted = await persistBusinessReportCsvBuffer(company, buffer);
      return NextResponse.json({
        ok: true,
        report: company,
        sourceType: 'BusinessReport',
        ...persisted,
        ...analysis,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status = message.includes('Blob storage not configured') ? 503 : 500;
      return NextResponse.json({ error: message }, { status });
    }
  }

  if (isCsv) {
    return NextResponse.json(
      { error: 'CSV upload is currently supported only for SoMarsh BusinessReport files.' },
      { status: 400 }
    );
  }

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
