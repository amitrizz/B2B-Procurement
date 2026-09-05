import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { generateCentrifugoToken } from '@/lib/centrifugo';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const token = generateCentrifugoToken(user.id);
  if (!token) {
    return NextResponse.json({ success: false, message: 'Centrifugo misconfigured' }, { status: 500 });
  }

  return NextResponse.json({ success: true, token });
}
