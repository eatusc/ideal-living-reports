import { NextResponse } from 'next/server';

export function GET() {
  const response = NextResponse.redirect(new URL('/pin', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'));
  response.cookies.set('pin_auth', '', { maxAge: 0, path: '/' });
  return response;
}
