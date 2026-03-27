import { NextRequest, NextResponse } from 'next/server';
import { ensureFreshGoogleSession } from '@/lib/googleSheetsAuth';

export async function GET(request: NextRequest) {
  const { session, setCookieOnResponse } = await ensureFreshGoogleSession(request);
  const response = NextResponse.json({ connected: !!session });
  setCookieOnResponse(response);
  return response;
}
