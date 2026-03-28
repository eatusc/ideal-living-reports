import { NextRequest, NextResponse } from 'next/server';

const PROTECTED_PREFIXES = ['/rpd-walmart', '/elevate', '/rpd-hd', '/aceteam', '/lustroware', '/somarsh', '/brand-ops'];

export function middleware(request: NextRequest) {
  const { pathname, basePath } = request.nextUrl;
  const normalizedPath = basePath && pathname.startsWith(basePath)
    ? pathname.slice(basePath.length) || '/'
    : pathname;

  const isProtected =
    normalizedPath === '/' ||
    PROTECTED_PREFIXES.some(
      (prefix) => normalizedPath === prefix || normalizedPath.startsWith(prefix + '/')
    );

  if (!isProtected) return NextResponse.next();

  const pinCookie = request.cookies.get('pin_auth');
  if (pinCookie?.value === '1') return NextResponse.next();

  const loginUrl = new URL(`${basePath || ''}/pin`, request.url);
  loginUrl.searchParams.set('next', normalizedPath);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/', '/rpd-walmart/:path*', '/elevate/:path*', '/rpd-hd/:path*', '/aceteam/:path*', '/lustroware/:path*', '/somarsh/:path*', '/brand-ops/:path*'],
};
