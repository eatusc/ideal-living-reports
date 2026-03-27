import { NextRequest, NextResponse } from 'next/server';
import {
  applyGoogleSessionToResponse,
  clearOAuthState,
  exchangeCodeForSession,
  readOAuthState,
} from '@/lib/googleSheetsAuth';

export async function GET(request: NextRequest) {
  const stateParam = request.nextUrl.searchParams.get('state');
  const code = request.nextUrl.searchParams.get('code');
  const error = request.nextUrl.searchParams.get('error');
  const storedState = readOAuthState(request);
  const fallbackReturnTo = '/';
  const returnTo = storedState?.returnTo && storedState.returnTo.startsWith('/') ? storedState.returnTo : fallbackReturnTo;

  if (error) {
    const redirect = NextResponse.redirect(new URL(`${returnTo}?google_error=${encodeURIComponent(error)}`, request.url));
    clearOAuthState(redirect);
    return redirect;
  }

  if (!storedState || !stateParam || storedState.nonce !== stateParam || !code) {
    const redirect = NextResponse.redirect(new URL(`${returnTo}?google_error=invalid_oauth_state`, request.url));
    clearOAuthState(redirect);
    return redirect;
  }

  try {
    const session = await exchangeCodeForSession(code, request.nextUrl.origin);
    const redirect = NextResponse.redirect(new URL(`${returnTo}?google_connected=1`, request.url));
    applyGoogleSessionToResponse(redirect, session);
    clearOAuthState(redirect);
    return redirect;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'oauth_callback_failed';
    const redirect = NextResponse.redirect(new URL(`${returnTo}?google_error=${encodeURIComponent(message)}`, request.url));
    clearOAuthState(redirect);
    return redirect;
  }
}
