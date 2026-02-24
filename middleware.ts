import { NextRequest, NextResponse } from 'next/server';

const PROTECTED_PREFIXES = ['/rpd-walmart', '/elevate', '/rpd-hd'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + '/')
  );

  if (!isProtected) return NextResponse.next();

  const pinCookie = request.cookies.get('pin_auth');
  if (pinCookie?.value === '1') return NextResponse.next();

  const loginUrl = new URL('/pin', request.url);
  loginUrl.searchParams.set('next', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/rpd-walmart/:path*', '/elevate/:path*', '/rpd-hd/:path*'],
};
