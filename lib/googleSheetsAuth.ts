import { NextRequest, NextResponse } from 'next/server';

const GOOGLE_OAUTH_STATE_COOKIE = 'google_oauth_state';
const GOOGLE_SESSION_COOKIE = 'google_sheets_session';
const GOOGLE_SCOPE = [
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
].join(' ');

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
}

export interface GoogleSession {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scope?: string;
  tokenType?: string;
}

interface OAuthState {
  nonce: string;
  returnTo: string;
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function parseJsonSafe<T>(raw: string | null | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function getBasePath(): string {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  if (!basePath) return '';
  return basePath.startsWith('/') ? basePath : `/${basePath}`;
}

function getRedirectUri(origin: string): string {
  const fromEnv = process.env.GOOGLE_REDIRECT_URI;
  if (fromEnv) return fromEnv;
  return `${origin}${getBasePath()}/api/google/oauth/callback`;
}

function getClientId(): string {
  const val = process.env.GOOGLE_CLIENT_ID;
  if (!val) throw new Error('Missing GOOGLE_CLIENT_ID');
  return val;
}

function getClientSecret(): string {
  const val = process.env.GOOGLE_CLIENT_SECRET;
  if (!val) throw new Error('Missing GOOGLE_CLIENT_SECRET');
  return val;
}

export function parseSheetId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const directIdMatch = trimmed.match(/^[a-zA-Z0-9-_]{20,}$/);
  if (directIdMatch) return directIdMatch[0];

  try {
    const url = new URL(trimmed);
    const fromPath = url.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (fromPath) return fromPath[1];
    const fromQuery = url.searchParams.get('id');
    if (fromQuery && /^[a-zA-Z0-9-_]{20,}$/.test(fromQuery)) return fromQuery;
  } catch {
    return null;
  }

  return null;
}

export function readGoogleSession(request: NextRequest): GoogleSession | null {
  const raw = request.cookies.get(GOOGLE_SESSION_COOKIE)?.value;
  const decoded = raw ? base64UrlDecode(raw) : null;
  const session = parseJsonSafe<GoogleSession>(decoded);
  if (!session?.accessToken || !session.expiresAt) return null;
  return session;
}

export function clearGoogleSession(response: NextResponse): void {
  response.cookies.set(GOOGLE_SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}

export function clearOAuthState(response: NextResponse): void {
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}

function writeGoogleSession(response: NextResponse, session: GoogleSession): void {
  response.cookies.set(GOOGLE_SESSION_COOKIE, base64UrlEncode(JSON.stringify(session)), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function setOAuthState(response: NextResponse, returnTo: string): string {
  const nonce = crypto.randomUUID();
  const payload: OAuthState = { nonce, returnTo };
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, base64UrlEncode(JSON.stringify(payload)), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 10,
  });
  return nonce;
}

export function readOAuthState(request: NextRequest): OAuthState | null {
  const raw = request.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;
  const decoded = raw ? base64UrlDecode(raw) : null;
  const state = parseJsonSafe<OAuthState>(decoded);
  if (!state?.nonce || !state.returnTo) return null;
  return state;
}

export function buildGoogleOAuthUrl(origin: string, nonce: string): string {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', getClientId());
  url.searchParams.set('redirect_uri', getRedirectUri(origin));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', GOOGLE_SCOPE);
  url.searchParams.set('state', nonce);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  return url.toString();
}

export async function exchangeCodeForSession(code: string, origin: string): Promise<GoogleSession> {
  const params = new URLSearchParams();
  params.set('code', code);
  params.set('client_id', getClientId());
  params.set('client_secret', getClientSecret());
  params.set('redirect_uri', getRedirectUri(origin));
  params.set('grant_type', 'authorization_code');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token exchange failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const data = (await res.json()) as GoogleTokenResponse;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    scope: data.scope,
    tokenType: data.token_type,
  };
}

export async function ensureFreshGoogleSession(request: NextRequest): Promise<{
  session: GoogleSession | null;
  setCookieOnResponse: (response: NextResponse) => void;
}> {
  const current = readGoogleSession(request);
  if (!current) {
    return { session: null, setCookieOnResponse: () => undefined };
  }

  if (current.expiresAt > Date.now() + 60_000) {
    return { session: current, setCookieOnResponse: () => undefined };
  }

  if (!current.refreshToken) {
    return { session: null, setCookieOnResponse: () => undefined };
  }

  const params = new URLSearchParams();
  params.set('client_id', getClientId());
  params.set('client_secret', getClientSecret());
  params.set('refresh_token', current.refreshToken);
  params.set('grant_type', 'refresh_token');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
    cache: 'no-store',
  });

  if (!res.ok) {
    return { session: null, setCookieOnResponse: () => undefined };
  }

  const data = (await res.json()) as GoogleTokenResponse;
  const refreshed: GoogleSession = {
    accessToken: data.access_token,
    refreshToken: current.refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
    scope: data.scope ?? current.scope,
    tokenType: data.token_type ?? current.tokenType,
  };

  return {
    session: refreshed,
    setCookieOnResponse: (response: NextResponse) => {
      writeGoogleSession(response, refreshed);
    },
  };
}

export function applyGoogleSessionToResponse(response: NextResponse, session: GoogleSession): void {
  writeGoogleSession(response, session);
}
