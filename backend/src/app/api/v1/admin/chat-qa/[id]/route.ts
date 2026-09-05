import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, authErrorResponse } from '@/lib/auth';
import { parseChatPurpose } from '@/lib/chatTemplates';
import mongoose from 'mongoose';

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

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(req);
    if (!user || user.role !== 'PLATFORM_ADMIN') return authErrorResponse();

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, code: 'INVALID_ID', message: 'Invalid question id' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const update: Record<string, unknown> = {};

    if (body?.purpose !== undefined) {
      const purpose = parseChatPurpose(body.purpose);
      if (!purpose) {
        return NextResponse.json(
          { success: false, code: 'INVALID_FIELD', message: 'Invalid purpose' },
          { status: 400 }
        );
      }
      update.purpose = purpose;
    }

    if (body?.questionText !== undefined) {
      const questionText = typeof body.questionText === 'string' ? body.questionText.trim() : '';
      if (!questionText) {
        return NextResponse.json(
          { success: false, code: 'MISSING_FIELD', message: 'questionText cannot be empty' },
          { status: 400 }
        );
      }
      update.questionText = questionText;
    }

    if (body?.sortOrder !== undefined) {
      update.sortOrder = Number(body.sortOrder) || 0;
    }

    if (body?.isActive !== undefined) {
      update.isActive = !!body.isActive;
    }

    if (Array.isArray(body?.answers)) {
      update.answers = body.answers
        .map((a: any, index: number) => ({
          _id: a?.id && mongoose.Types.ObjectId.isValid(a.id) ? a.id : undefined,
          label: typeof a?.label === 'string' ? a.label.trim() : '',
          sortOrder: Number.isFinite(Number(a?.sortOrder)) ? Number(a.sortOrder) : index + 1,
          isActive: a?.isActive !== false,
        }))
        .filter((a: { label: string }) => a.label);
    }

    await db();
    const { getChatQuestionModel } = await import('@/models/ChatQuestion');
    const ChatQuestion = getChatQuestionModel();

    const updated = await ChatQuestion.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    }).lean();

    if (!updated) {
      return NextResponse.json(
        { success: false, code: 'NOT_FOUND', message: 'Question not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: serializeQuestion(updated) });
  } catch (error: any) {
    console.error('Update chat Q&A error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(req);
    if (!user || user.role !== 'PLATFORM_ADMIN') return authErrorResponse();

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, code: 'INVALID_ID', message: 'Invalid question id' },
        { status: 400 }
      );
    }

    await db();
    const { getChatQuestionModel } = await import('@/models/ChatQuestion');
    const ChatQuestion = getChatQuestionModel();

    const updated = await ChatQuestion.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    ).lean();

    if (!updated) {
      return NextResponse.json(
        { success: false, code: 'NOT_FOUND', message: 'Question not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: serializeQuestion(updated) });
  } catch (error: any) {
    console.error('Delete chat Q&A error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
