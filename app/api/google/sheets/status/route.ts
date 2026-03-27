import { NextRequest, NextResponse } from 'next/server';
import { ensureFreshGoogleSession } from '@/lib/googleSheetsAuth';

export async function GET(request: NextRequest) {
  try {
    const { session, setCookieOnResponse } = await ensureFreshGoogleSession(request);
    const response = NextResponse.json({ connected: !!session });
    setCookieOnResponse(response);
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to validate Google session';
    return NextResponse.json({ connected: false, error: message }, { status: 500 });
  }
}
