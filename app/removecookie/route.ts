import { NextResponse } from 'next/server';

export function GET() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  const response = NextResponse.redirect(
    new URL(`${basePath}/pin`, process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000')
  );
  response.cookies.set('pin_auth', '', { maxAge: 0, path: '/' });
  return response;
}
