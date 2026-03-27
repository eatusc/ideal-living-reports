import { NextResponse } from 'next/server';
import { clearGoogleSession } from '@/lib/googleSheetsAuth';

export async function POST() {
  const response = NextResponse.json({ ok: true, connected: false });
  clearGoogleSession(response);
  return response;
}
