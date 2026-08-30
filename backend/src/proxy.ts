import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose'; // Need edge compatible jwt

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // We only care about /api/v1/ routes
  if (!pathname.startsWith('/api/v1')) {
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
    // Let the individual routes handle 401 if they require it. Some routes might be public.
    return NextResponse.next();
  }

  try {
    const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-development-use-only';
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    
    const role = payload.role as string;
    
    // PLATFORM_ADMIN can access everything
    if (role === 'PLATFORM_ADMIN') return NextResponse.next();

    // Route checks based on role
    // OWNER: KYC, bank, invites
    // PROCUREMENT: RFQ, bids, orders, grn, milestones
    // FINANCE: invoices, payments
    // TRANSPORTER: transporter deliveries

    if (role === 'PROCUREMENT') {
      if (pathname.includes('/company/me/bank') || pathname.includes('/company/invites') || pathname.includes('/payments') || pathname.includes('/invoices')) {
        return NextResponse.json({ success: false, code: 'FORBIDDEN', message: 'PROCUREMENT role cannot access this' }, { status: 403 });
      }
    }

    if (role === 'FINANCE') {
      if (pathname.includes('/rfqs') || pathname.includes('/bids') || pathname.includes('/orders') || pathname.includes('/company/invites')) {
        return NextResponse.json({ success: false, code: 'FORBIDDEN', message: 'FINANCE role cannot access this' }, { status: 403 });
      }
    }

    if (role === 'TRANSPORTER') {
      if (!pathname.includes('/transporter/deliveries') && !pathname.includes('/upload')) {
        return NextResponse.json({ success: false, code: 'FORBIDDEN', message: 'TRANSPORTER role cannot access this' }, { status: 403 });
      }
    }

  } catch (err) {
    // Token verify failed, ignore here and let the route handle 401
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/v1/:path*'],
};
