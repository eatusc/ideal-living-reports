import { NextRequest, NextResponse } from 'next/server';
import { buildGoogleOAuthUrl, setOAuthState } from '@/lib/googleSheetsAuth';

export async function GET(request: NextRequest) {
  try {
    const returnTo = request.nextUrl.searchParams.get('returnTo') || '/';
    const redirect = NextResponse.redirect('https://accounts.google.com');
    const nonce = setOAuthState(redirect, returnTo.startsWith('/') ? returnTo : '/');
    const authUrl = buildGoogleOAuthUrl(request.nextUrl.origin, nonce);
    redirect.headers.set('Location', authUrl);
    return redirect;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'OAuth start failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
