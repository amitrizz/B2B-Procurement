import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import {
  chatAuthError,
  createRepeatRfqFromChat,
  getRepeatRfqDraft,
  RepeatRfqError,
} from '@/lib/repeatRfqFromChat';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(req);
    const authErr = chatAuthError(user);
    if (authErr) return authErr;

    const { id } = await params;
    await db();

    const data = await getRepeatRfqDraft(id, user!.companyId);
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    if (error instanceof RepeatRfqError) {
      return NextResponse.json(
        { success: false, code: error.code, message: error.message },
        { status: error.status }
      );
    }
    console.error('Repeat RFQ draft error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(req);
    const authErr = chatAuthError(user);
    if (authErr) return authErr;

    if (user!.company?.status !== 'VERIFIED') {
      return NextResponse.json(
        { success: false, code: 'UNVERIFIED_COMPANY', message: 'Only verified companies can publish RFQs' },
        { status: 403 }
      );
    }

    if (user!.company?.isActive === false) {
      return NextResponse.json(
        { success: false, code: 'INACTIVE_COMPANY', message: 'Your company account is inactive' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json();
    await db();

    const data = await createRepeatRfqFromChat(id, user, body);
    return NextResponse.json({
      success: true,
      message: 'Repeat order RFQ published and assigned to supplier',
      data,
    });
  } catch (error: any) {
    if (error instanceof RepeatRfqError) {
      return NextResponse.json(
        { success: false, code: error.code, message: error.message },
        { status: error.status }
      );
    }
    console.error('Create repeat RFQ error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
