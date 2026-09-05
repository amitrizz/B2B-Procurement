import mongoose from 'mongoose';
import type { ChatPurpose } from '@/lib/chatTemplates';

export type ChatTemplateOption = {
  key: string;
  label: string;
  questionId?: string;
  answerId?: string;
  requiresDate?: boolean;
};

/** Matches [date], [date to be confirmed], etc. */
const DATE_PLACEHOLDER_REGEX = /\[date[^\]]*\]/gi;

export function answerRequiresDate(label: string): boolean {
  return /\[date[^\]]*\]/i.test(label);
}

export function formatChatDate(dateValue: string): string {
  const [y, m, d] = dateValue.split('-').map(Number);
  if (!y || !m || !d) return dateValue;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function replaceDatePlaceholder(label: string, dateValue: string): string {
  const formatted = formatChatDate(dateValue);
  return label.replace(DATE_PLACEHOLDER_REGEX, formatted);
}

export function isValidDateValue(dateValue: unknown): dateValue is string {
  if (typeof dateValue !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return false;
  }
  const [y, m, d] = dateValue.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

export type PendingQuestion = {
  id: string;
  text: string;
  messageId: string;
};

export function questionTemplateKey(questionId: string) {
  return `q:${questionId}`;
}

export function answerTemplateKey(answerId: string) {
  return `a:${answerId}`;
}

export function parseQuestionTemplateKey(key: string) {
  if (!key.startsWith('q:')) return null;
  const id = key.slice(2);
  return mongoose.Types.ObjectId.isValid(id) ? id : null;
}

export function parseAnswerTemplateKey(key: string) {
  if (!key.startsWith('a:')) return null;
  const id = key.slice(2);
  return mongoose.Types.ObjectId.isValid(id) ? id : null;
}

export async function getActiveQuestions(purpose: ChatPurpose) {
  const { getChatQuestionModel } = await import('@/models/ChatQuestion');
  const ChatQuestion = getChatQuestionModel();
  return ChatQuestion.find({ purpose, isActive: true }).sort({ sortOrder: 1, createdAt: 1 }).lean();
}

export async function findPendingBuyerQuestion(threadId: mongoose.Types.ObjectId) {
  const { getCompanyChatMessageModel } = await import('@/models/Chat');
  const CompanyChatMessage = getCompanyChatMessageModel();

  const messages = await CompanyChatMessage.find({ threadId })
    .sort({ createdAt: -1 })
    .select('messageType questionId templateKey label _id createdAt senderCompanyId')
    .lean();

  for (const msg of messages) {
    let questionId = msg.questionId?.toString?.() ?? null;

    if (!questionId && msg.templateKey?.startsWith('q:')) {
      questionId = parseQuestionTemplateKey(msg.templateKey);
    }

    const isQuestion =
      msg.messageType === 'QUESTION' ||
      (!!msg.templateKey?.startsWith('q:') && msg.messageType !== 'ANSWER');

    if (!isQuestion || !questionId) {
      continue;
    }

    const answered = messages.some((m) => {
      if (new Date(m.createdAt).getTime() <= new Date(msg.createdAt).getTime()) {
        return false;
      }
      const replyQuestionId =
        m.questionId?.toString?.() ??
        (m.templateKey?.startsWith('a:') ? null : null);
      return m.messageType === 'ANSWER' && replyQuestionId === questionId;
    });

    if (!answered) {
      return {
        id: questionId,
        text: msg.label,
        messageId: msg._id.toString(),
      } satisfies PendingQuestion;
    }
  }

  return null;
}

export async function getBuyerTemplates(purpose: ChatPurpose): Promise<ChatTemplateOption[]> {
  const questions = await getActiveQuestions(purpose);
  return questions.map((q: any) => ({
    key: questionTemplateKey(q._id.toString()),
    label: q.questionText,
    questionId: q._id.toString(),
  }));
}

export async function getSupplierTemplates(
  purpose: ChatPurpose,
  pendingQuestionId: string
): Promise<ChatTemplateOption[]> {
  const { getChatQuestionModel } = await import('@/models/ChatQuestion');
  const ChatQuestion = getChatQuestionModel();
  const question = await ChatQuestion.findOne({
    _id: pendingQuestionId,
    purpose,
    isActive: true,
  }).lean();

  if (!question) return [];

  return (question.answers || [])
    .filter((a: any) => a.isActive !== false && a.label?.trim())
    .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((a: any) => ({
      key: answerTemplateKey(a._id.toString()),
      label: a.label,
      questionId: question._id.toString(),
      answerId: a._id.toString(),
      requiresDate: answerRequiresDate(a.label),
    }));
}

export async function resolveMessageFromTemplateKey(
  templateKey: string,
  side: 'BUYER' | 'SUPPLIER',
  purpose: ChatPurpose,
  pendingQuestionId?: string | null,
  dateValue?: string | null
) {
  const questionId = parseQuestionTemplateKey(templateKey);
  if (side === 'BUYER' && questionId) {
    const { getChatQuestionModel } = await import('@/models/ChatQuestion');
    const question = await getChatQuestionModel()
      .findOne({ _id: questionId, purpose, isActive: true })
      .lean();
    if (!question) return null;
    return {
      messageType: 'QUESTION' as const,
      questionId: question._id,
      answerId: undefined,
      label: question.questionText,
      templateKey: questionTemplateKey(question._id.toString()),
    };
  }

  const answerId = parseAnswerTemplateKey(templateKey);
  if (side === 'SUPPLIER' && answerId && pendingQuestionId) {
    const { getChatQuestionModel } = await import('@/models/ChatQuestion');
    const question = await getChatQuestionModel()
      .findOne({ _id: pendingQuestionId, purpose, isActive: true })
      .lean();
    if (!question) return null;
    const answer = (question.answers || []).find(
      (a: any) => a._id.toString() === answerId && a.isActive !== false
    );
    if (!answer) return null;
    let label = answer.label as string;
    if (answerRequiresDate(label)) {
      if (!dateValue || !isValidDateValue(dateValue)) {
        return null;
      }
      label = replaceDatePlaceholder(label, dateValue);
    }
    return {
      messageType: 'ANSWER' as const,
      questionId: question._id,
      answerId: answer._id,
      label,
      templateKey: answerTemplateKey(answer._id.toString()),
    };
  }

  return null;
}
