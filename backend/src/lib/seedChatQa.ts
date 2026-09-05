import type { ChatPurpose } from '@/lib/chatTemplates';

type SeedItem = {
  purpose: ChatPurpose;
  questionText: string;
  sortOrder: number;
  answers: string[];
};

const DEFAULT_CHAT_QA: SeedItem[] = [
  {
    purpose: 'ORDER_STATUS',
    sortOrder: 1,
    questionText: 'What is the expected delivery/completion date?',
    answers: [
      'Expected delivery date is [to be confirmed in follow-up].',
      'There is a delay; revised date will follow.',
      'Order is ready for dispatch/pickup.',
    ],
  },
  {
    purpose: 'ORDER_STATUS',
    sortOrder: 2,
    questionText: 'What work is still pending on this order?',
    answers: [
      'Pending work: machining/finishing/QC in progress.',
      'We need clarification on drawings/spec before proceeding.',
      'There is a delay; revised date will follow.',
    ],
  },
  {
    purpose: 'ORDER_STATUS',
    sortOrder: 3,
    questionText: 'Please share a status update on this PO.',
    answers: [
      'Pending work: machining/finishing/QC in progress.',
      'Order is ready for dispatch/pickup.',
      'There is a delay; revised date will follow.',
    ],
  },
  {
    purpose: 'ORDER_STATUS',
    sortOrder: 4,
    questionText: 'When will the order be ready for dispatch?',
    answers: [
      'Order is ready for dispatch/pickup.',
      'Expected delivery date is [to be confirmed in follow-up].',
      'There is a delay; revised date will follow.',
    ],
  },
  {
    purpose: 'REPEAT_ORDER',
    sortOrder: 1,
    questionText: 'Can we place a repeat order for the same items?',
    answers: [
      'We can accept a repeat order on the same terms.',
      'We will share updated pricing for the repeat order.',
      'We need to review specs/drawings before confirming repeat order.',
    ],
  },
  {
    purpose: 'REPEAT_ORDER',
    sortOrder: 2,
    questionText: 'What is the lead time for the next batch?',
    answers: [
      'Lead time for the repeat order is [to be confirmed].',
      'We can start repeat production from [date to be confirmed].',
      'We will share updated pricing for the repeat order.',
    ],
  },
  {
    purpose: 'REPEAT_ORDER',
    sortOrder: 3,
    questionText: 'Can we repeat this order with the same quantity?',
    answers: [
      'We can accept a repeat order on the same terms.',
      'Lead time for the repeat order is [to be confirmed].',
      'We need to review specs/drawings before confirming repeat order.',
    ],
  },
  {
    purpose: 'REPEAT_ORDER',
    sortOrder: 4,
    questionText: 'Will pricing remain the same as this PO for a repeat order?',
    answers: [
      'We can accept a repeat order on the same terms.',
      'We will share updated pricing for the repeat order.',
      'We need to review specs/drawings before confirming repeat order.',
    ],
  },
  {
    purpose: 'REPEAT_ORDER',
    sortOrder: 5,
    questionText: 'When can you start production for a repeat order?',
    answers: [
      'We can start repeat production from [date to be confirmed].',
      'Lead time for the repeat order is [to be confirmed].',
      'We can accept a repeat order on the same terms.',
    ],
  },
];

export async function seedChatQaIfEmpty() {
  const { getChatQuestionModel } = await import('@/models/ChatQuestion');
  const ChatQuestion = getChatQuestionModel();
  const count = await ChatQuestion.countDocuments();
  if (count > 0) return;

  await ChatQuestion.insertMany(
    DEFAULT_CHAT_QA.map((item) => ({
      purpose: item.purpose,
      questionText: item.questionText,
      sortOrder: item.sortOrder,
      isActive: true,
      answers: item.answers.map((label, index) => ({
        label,
        sortOrder: index + 1,
        isActive: true,
      })),
    }))
  );

  console.log('[ChatQa] Seeded default buyer questions and seller answers');
}
