import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const PUBLIC_API_PREFIXES = [
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/refresh',
  '/api/v1/auth/forgot-password',
  '/api/v1/auth/reset-password',
  '/api/v1/auth/verify-email',
  '/api/v1/auth/send-verify-email',
  '/api/v1/payments/cashfree/webhook',
];

const SHARED_AUTHENTICATED_PREFIXES = [
  '/api/v1/auth/change-password',
  '/api/v1/auth/refresh',
  '/api/v1/realtime/token',
  '/api/v1/notifications/subscribe',
  '/api/v1/company/me',
  '/api/v1/upload',
  '/api/v1/invoices',
  '/api/v1/payments',
];

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith('/api/v1')) {
    return NextResponse.next();
  }

  if (matchesPrefix(pathname, PUBLIC_API_PREFIXES)) {
    return NextResponse.next();
  }

  const authHeader = request.headers.get('Authorization');
  let token = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else {
    token = request.cookies.get('accessToken')?.value || '';
  }

  if (!token) {
    return NextResponse.next();
  }

  try {
    const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-development-use-only';
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);

    const role = payload.role as string;

    if (role === 'PLATFORM_ADMIN') return NextResponse.next();

    if (matchesPrefix(pathname, SHARED_AUTHENTICATED_PREFIXES)) {
      return NextResponse.next();
    }

    if (role === 'PROCUREMENT') {
      if (
        pathname.includes('/company/me/bank') ||
        pathname.includes('/company/invites') ||
        pathname.includes('/payments') ||
        pathname.includes('/invoices')
      ) {
        return NextResponse.json(
          { success: false, code: 'FORBIDDEN', message: 'PROCUREMENT role cannot access this' },
          { status: 403 }
        );
      }
    }

    if (role === 'FINANCE') {
      if (
        pathname.includes('/rfqs') ||
        pathname.includes('/bids') ||
        pathname.includes('/company/invites') ||
        pathname.includes('/marketplace')
      ) {
        return NextResponse.json(
          { success: false, code: 'FORBIDDEN', message: 'FINANCE role cannot access this' },
          { status: 403 }
        );
      }
    }

    if (role === 'TRANSPORTER') {
      if (!pathname.includes('/transporter/deliveries')) {
        return NextResponse.json(
          { success: false, code: 'FORBIDDEN', message: 'TRANSPORTER role cannot access this' },
          { status: 403 }
        );
      }
    }
  } catch {
    // Let route handlers return 401 if needed
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/v1/:path*'],
};
