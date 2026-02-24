import { NextRequest, NextResponse } from 'next/server';

const PIN = '1157';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { pin, next } = body as { pin?: string; next?: string };

  if (pin !== PIN) {
    return NextResponse.json({ error: 'Incorrect PIN' }, { status: 401 });
  }

  const redirectTo = next && next.startsWith('/') ? next : '/';
  const response = NextResponse.json({ ok: true, redirect: redirectTo });

  response.cookies.set('pin_auth', '1', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return response;
}
