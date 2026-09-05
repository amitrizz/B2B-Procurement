import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';
import { parseChatPurpose } from '@/lib/chatTemplates';

function serializeQuestion(doc: any) {
  return {
    id: doc._id.toString(),
    purpose: doc.purpose,
    questionText: doc.questionText,
    sortOrder: doc.sortOrder ?? 0,
    isActive: doc.isActive !== false,
    answers: (doc.answers || []).map((a: any) => ({
      id: a._id.toString(),
      label: a.label,
      sortOrder: a.sortOrder ?? 0,
      isActive: a.isActive !== false,
    })),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user || user.role !== 'PLATFORM_ADMIN') return authErrorResponse();

    await db();
    const { getChatQuestionModel } = await import('@/models/ChatQuestion');
    const ChatQuestion = getChatQuestionModel();

    const purposeParam = req.nextUrl.searchParams.get('purpose');
    const purpose = purposeParam ? parseChatPurpose(purposeParam) : null;
    const filter: Record<string, unknown> = {};
    if (purpose) filter.purpose = purpose;

    const questions = await ChatQuestion.find(filter)
      .sort({ purpose: 1, sortOrder: 1, createdAt: 1 })
      .lean();

    return NextResponse.json({
      success: true,
      data: questions.map(serializeQuestion),
    });
  } catch (error: any) {
    console.error('List chat Q&A error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user || user.role !== 'PLATFORM_ADMIN') return authErrorResponse();

    const body = await req.json();
    const purpose = parseChatPurpose(body?.purpose);
    const questionText = typeof body?.questionText === 'string' ? body.questionText.trim() : '';
    const sortOrder = Number.isFinite(Number(body?.sortOrder)) ? Number(body.sortOrder) : 0;
    const isActive = body?.isActive !== false;
    const answersRaw = Array.isArray(body?.answers) ? body.answers : [];

    if (!purpose) {
      return NextResponse.json(
        { success: false, code: 'INVALID_FIELD', message: 'purpose must be ORDER_STATUS or REPEAT_ORDER' },
        { status: 400 }
      );
    }

    if (!questionText) {
      return NextResponse.json(
        { success: false, code: 'MISSING_FIELD', message: 'questionText is required' },
        { status: 400 }
      );
    }

    const answers = answersRaw
      .map((a: any, index: number) => ({
        label: typeof a?.label === 'string' ? a.label.trim() : '',
        sortOrder: Number.isFinite(Number(a?.sortOrder)) ? Number(a.sortOrder) : index + 1,
        isActive: a?.isActive !== false,
      }))
      .filter((a: { label: string }) => a.label);

    await db();
    const { getChatQuestionModel } = await import('@/models/ChatQuestion');
    const ChatQuestion = getChatQuestionModel();

    const created = await ChatQuestion.create({
      purpose,
      questionText,
      sortOrder,
      isActive,
      answers,
    });

    return NextResponse.json({ success: true, data: serializeQuestion(created.toObject()) });
  } catch (error: any) {
    console.error('Create chat Q&A error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
