'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageSquare, Plus, X, Loader2, Building2, ShoppingCart, FilePlus2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { RefreshButton } from '@/components/ui/RefreshButton';
import { ChatDatePicker } from '@/components/ui/ChatDatePicker';
import { DarkSelect } from '@/components/ui/DarkSelect';
import { answerRequiresDate, previewAnswerWithDate } from '@/lib/chatPlaceholders';
import RepeatPoModal from './RepeatPoModal';

type ChatPurpose = 'ORDER_STATUS' | 'REPEAT_ORDER';

const PURPOSE_OPTIONS: { value: ChatPurpose; label: string; description: string }[] = [
  {
    value: 'ORDER_STATUS',
    label: 'Order Status',
    description: 'Track delivery, pending work, and PO progress',
  },
  {
    value: 'REPEAT_ORDER',
    label: 'Repeat Order',
    description: 'Discuss reordering the same items or terms',
  },
];

type Thread = {
  id: string;
  purchaseOrderId: string;
  purpose: ChatPurpose;
  purposeLabel: string;
  poNumber: string | null;
  poStatus: string | null;
  buyerCompany: { id: string; name: string | null };
  supplierCompany: { id: string; name: string | null };
  counterpartyCompany: { id: string; name: string | null };
  lastMessageAt: string;
  lastMessagePreview: string;
};

type ChatMessage = {
  id: string;
  label: string;
  isMine: boolean;
  senderCompanyName: string | null;
  createdAt: string;
};

type CompanyOption = { id: string; name: string; gstin?: string };
type PoOption = { id: string; poNumber: string; status: string };
type TemplateOption = { key: string; label: string; requiresDate?: boolean };
type PendingQuestion = { id: string; text: string; messageId?: string };

type ChatRealtimeEvent = {
  threadId?: string;
  chatMessage?: {
    id: string;
    label: string;
    senderCompanyId: string;
    senderCompanyName: string;
    createdAt: string;
  };
  _at?: number;
};

interface CompanyChatTabProps {
  user: any;
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void;
  realtimeEvent?: ChatRealtimeEvent | null;
}

export default function CompanyChatTab({ user, showToast, realtimeEvent = null }: CompanyChatTabProps) {
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  const authHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('token')}`,
    'Content-Type': 'application/json',
  });

  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [chatRole, setChatRole] = useState<'buyer' | 'supplier' | null>(null);
  const [pendingQuestion, setPendingQuestion] = useState<PendingQuestion | null>(null);
  const [templateHint, setTemplateHint] = useState('');
  const [answerDate, setAnswerDate] = useState('');
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);

  const [showNewChat, setShowNewChat] = useState(false);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [pos, setPos] = useState<PoOption[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [selectedPoId, setSelectedPoId] = useState('');
  const [chatPurpose, setChatPurpose] = useState<ChatPurpose>('ORDER_STATUS');
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [loadingPos, setLoadingPos] = useState(false);
  const [startingChat, setStartingChat] = useState(false);
  const [showRepeatPoModal, setShowRepeatPoModal] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeThreadIdRef = useRef<string | null>(null);
  const loadedMessagesThreadRef = useRef<string | null>(null);
  const lastRealtimeAtRef = useRef(0);
  const myCompanyId = user?.companyId;

  const activeThread = threads.find((t) => t.id === activeThreadId) ?? null;

  const existingPurposesForPo = (poId: string) =>
    new Set(threads.filter((t) => t.purchaseOrderId === poId).map((t) => t.purpose));

  const selectedPoExistingPurposes = selectedPoId ? existingPurposesForPo(selectedPoId) : new Set<ChatPurpose>();
  const openingExistingChat = selectedPoExistingPurposes.has(chatPurpose);

  const selectedTemplateOption =
    templates.find((t) => t.key === selectedTemplate) ??
    (selectedTemplate ? { key: selectedTemplate, label: '', requiresDate: false } : null);
  const requiresAnswerDate =
    chatRole === 'supplier' &&
    !!selectedTemplateOption &&
    (selectedTemplateOption.requiresDate || answerRequiresDate(selectedTemplateOption.label));
  const answerPreview =
    requiresAnswerDate && answerDate && selectedTemplateOption
      ? previewAnswerWithDate(selectedTemplateOption.label, answerDate)
      : null;

  const isBuyerOnThread =
    !!activeThread && !!myCompanyId && activeThread.buyerCompany?.id === myCompanyId;
  const hasSupplierReply = messages.some((m) => !m.isMine);
  const canCreateRepeatPo =
    isBuyerOnThread && activeThread?.purpose === 'REPEAT_ORDER' && hasSupplierReply;

  useEffect(() => {
    activeThreadIdRef.current = activeThreadId;
  }, [activeThreadId]);

  const bumpThread = useCallback((threadId: string, preview: string, lastMessageAt: string) => {
    setThreads((prev) => {
      if (!prev.some((t) => t.id === threadId)) {
        return prev;
      }
      const next = prev.map((t) =>
        t.id === threadId ? { ...t, lastMessagePreview: preview, lastMessageAt } : t
      );
      return [...next].sort(
        (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
      );
    });
  }, []);

  const appendMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
  }, []);

  const loadThreads = useCallback(async (silent = false): Promise<Thread[]> => {
    if (!silent) setLoadingThreads(true);
    try {
      const res = await fetch('/api/v1/chat/threads', { headers: authHeaders() });
      const data = await res.json();
      if (data.success) {
        const list: Thread[] = data.data || [];
        setThreads(list);
        return list;
      }
      if (!silent) {
        showToastRef.current(data.message || 'Failed to load chats', 'error');
      }
    } catch {
      if (!silent) showToastRef.current('Failed to load chats', 'error');
    } finally {
      if (!silent) setLoadingThreads(false);
    }
    return [];
  }, []);

  const loadMessages = useCallback(async (threadId: string, silent = false) => {
    if (!silent) setLoadingMessages(true);
    try {
      const res = await fetch(`/api/v1/chat/threads/${threadId}/messages`, {
        headers: authHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setMessages(data.data || []);
        loadedMessagesThreadRef.current = threadId;
      } else if (!silent) {
        showToastRef.current(data.message || 'Failed to load messages', 'error');
      }
    } catch {
      if (!silent) showToastRef.current('Failed to load messages', 'error');
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  }, []);

  const loadTemplatesForThread = useCallback(async (threadId: string) => {
    try {
      const res = await fetch(
        `/api/v1/chat/templates?threadId=${encodeURIComponent(threadId)}`,
        { headers: authHeaders() }
      );
      const data = await res.json();
      if (data.success) {
        const list: TemplateOption[] = data.data.templates || [];
        setTemplates(list);
        setSelectedTemplate(list[0]?.key || '');
        setChatRole(data.data.role || (data.data.side === 'BUYER' ? 'buyer' : 'supplier'));
        setPendingQuestion(data.data.pendingQuestion || null);
        setTemplateHint(data.data.hint || '');
        setAnswerDate('');
      } else {
        setTemplates([]);
        setSelectedTemplate('');
        setChatRole(null);
        setPendingQuestion(null);
        setTemplateHint('');
        setAnswerDate('');
      }
    } catch {
      setTemplates([]);
      setSelectedTemplate('');
      setChatRole(null);
      setPendingQuestion(null);
      setTemplateHint('');
    }
  }, []);

  useEffect(() => {
    loadThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeThreadId) {
      setMessages([]);
      setTemplates([]);
      loadedMessagesThreadRef.current = null;
      return;
    }
    if (loadedMessagesThreadRef.current !== activeThreadId) {
      loadMessages(activeThreadId);
    }
    loadTemplatesForThread(activeThreadId);
  }, [activeThreadId, loadMessages, loadTemplatesForThread]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!realtimeEvent?.chatMessage || !realtimeEvent.threadId) return;
    if (realtimeEvent._at && realtimeEvent._at <= lastRealtimeAtRef.current) return;
    lastRealtimeAtRef.current = realtimeEvent._at ?? Date.now();

    const { threadId, chatMessage } = realtimeEvent;
    bumpThread(threadId, chatMessage.label, chatMessage.createdAt);

    if (activeThreadIdRef.current === threadId) {
      appendMessage({
        id: chatMessage.id,
        label: chatMessage.label,
        isMine: chatMessage.senderCompanyId === myCompanyId,
        senderCompanyName: chatMessage.senderCompanyName,
        createdAt: chatMessage.createdAt,
      });
      loadTemplatesForThread(threadId);
    }
  }, [realtimeEvent, bumpThread, appendMessage, myCompanyId, loadTemplatesForThread]);

  const openNewChatModal = async () => {
    setShowNewChat(true);
    setSelectedCompanyId('');
    setSelectedPoId('');
    setChatPurpose('ORDER_STATUS');
    setPos([]);
    setLoadingCompanies(true);
    try {
      const res = await fetch('/api/v1/chat/companies', { headers: authHeaders() });
      const data = await res.json();
      if (data.success) {
        setCompanies(data.data || []);
      } else {
        showToast(data.message || 'Failed to load companies', 'error');
      }
    } catch {
      showToast('Failed to load companies', 'error');
    } finally {
      setLoadingCompanies(false);
    }
  };

  const onCompanyChange = async (companyIdVal: string) => {
    setSelectedCompanyId(companyIdVal);
    setSelectedPoId('');
    setPos([]);
    if (!companyIdVal) return;

    setLoadingPos(true);
    try {
      const res = await fetch(`/api/v1/chat/companies/${companyIdVal}/purchase-orders`, {
        headers: authHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setPos(data.data || []);
      } else {
        showToast(data.message || 'Failed to load purchase orders', 'error');
      }
    } catch {
      showToast('Failed to load purchase orders', 'error');
    } finally {
      setLoadingPos(false);
    }
  };

  const startChat = async () => {
    if (!selectedPoId) return;
    setStartingChat(true);
    try {
      const res = await fetch('/api/v1/chat/threads', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ purchaseOrderId: selectedPoId, purpose: chatPurpose }),
      });
      const data = await res.json();
      if (data.success) {
        setShowNewChat(false);
        await loadThreads();
        setActiveThreadId(data.data.id);
        showToast(openingExistingChat ? 'Chat opened' : 'Chat started', 'success');
      } else if (data.code === 'DUPLICATE_THREAD') {
        const refreshed = await loadThreads(true);
        const existing = refreshed.find(
          (t) => t.purchaseOrderId === selectedPoId && t.purpose === chatPurpose
        );
        if (existing) {
          setShowNewChat(false);
          setActiveThreadId(existing.id);
          showToast('Chat opened', 'success');
        } else {
          showToast(data.message || 'Failed to start chat', 'error');
        }
      } else {
        showToast(data.message || 'Failed to start chat', 'error');
      }
    } catch {
      showToast('Failed to start chat', 'error');
    } finally {
      setStartingChat(false);
    }
  };

  const sendMessage = async () => {
    if (!activeThreadId || !selectedTemplate) return;
    if (requiresAnswerDate && !answerDate) {
      showToast('Please select a date for this answer', 'error');
      return;
    }
    setSending(true);
    try {
      const payload: { templateKey: string; dateValue?: string } = { templateKey: selectedTemplate };
      if (requiresAnswerDate) {
        payload.dateValue = answerDate;
      }
      const res = await fetch(`/api/v1/chat/threads/${activeThreadId}/messages`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        appendMessage(data.data);
        bumpThread(activeThreadId, data.data.label, data.data.createdAt);
        setAnswerDate('');
        await loadTemplatesForThread(activeThreadId);
      } else {
        showToast(data.message || 'Failed to send message', 'error');
      }
    } catch {
      showToast('Failed to send message', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-blue-400 shrink-0" />
            Company Chat
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            PO-linked messaging for order status or repeat orders — pick a purpose when starting a chat.
          </p>
        </div>
        <div className="flex gap-2 shrink-0 w-full sm:w-auto">
          <Button variant="primary" onClick={openNewChatModal} className="flex-1 sm:flex-none whitespace-nowrap">
            <Plus className="w-4 h-4" /> New Chat
          </Button>
          <RefreshButton onRefresh={loadThreads} />
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0 lg:min-h-[480px]">
        {/* Thread list — hidden on mobile when a chat is open */}
        <div
          className={`glass-card rounded-2xl border border-white/5 overflow-hidden flex flex-col lg:col-span-1 min-h-0 ${
            activeThreadId ? 'hidden lg:flex' : 'flex'
          }`}
        >
          <div className="p-3 border-b border-white/5 text-xs font-bold text-slate-300 uppercase tracking-wider">
            Conversations
          </div>
          <div className="flex-1 overflow-y-auto max-h-[50vh] lg:max-h-none min-h-0">
            {loadingThreads && threads.length === 0 ? (
              <div className="p-8 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
              </div>
            ) : threads.length === 0 ? (
              <p className="p-6 text-sm text-slate-500 text-center">
                No chats yet. Start a new conversation linked to a purchase order.
              </p>
            ) : (
              threads.map((thread) => (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => setActiveThreadId(thread.id)}
                  className={`w-full text-left p-3 border-b border-white/5 transition-colors ${
                    activeThreadId === thread.id
                      ? 'bg-blue-500/10 border-l-2 border-l-blue-500'
                      : 'hover:bg-white/5'
                  }`}
                >
                  <p className="text-sm font-semibold text-white truncate">
                    {thread.counterpartyCompany?.name || 'Company'}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-[10px] text-blue-400 font-mono">{thread.poNumber || 'PO'}</span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                        thread.purpose === 'REPEAT_ORDER'
                          ? 'bg-purple-500/15 text-purple-300'
                          : 'bg-amber-500/15 text-amber-300'
                      }`}
                    >
                      {thread.purposeLabel || (thread.purpose === 'REPEAT_ORDER' ? 'Repeat Order' : 'Order Status')}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                    {thread.lastMessagePreview || 'No messages yet'}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {thread.lastMessageAt
                      ? new Date(thread.lastMessageAt).toLocaleString()
                      : ''}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Active chat — full width on mobile when selected */}
        <div
          className={`glass-card rounded-2xl border border-white/5 flex flex-col lg:col-span-2 min-h-[50vh] lg:min-h-[420px] ${
            activeThreadId ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {!activeThread ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <MessageSquare className="w-12 h-12 text-slate-600 mb-3" />
              <p className="text-sm text-slate-400">Select a conversation or start a new chat</p>
            </div>
          ) : (
            <>
              <div className="p-4 border-b border-white/5">
                <button
                  type="button"
                  onClick={() => setActiveThreadId(null)}
                  className="lg:hidden mb-3 flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to conversations
                </button>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <Building2 className="w-4 h-4 text-blue-400 shrink-0" />
                    <span className="font-bold text-white text-sm">
                      {activeThread.counterpartyCompany?.name || 'Counterparty'}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                      {activeThread.poNumber}
                    </span>
                    {activeThread.poStatus && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 uppercase">
                        {activeThread.poStatus}
                      </span>
                    )}
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                        activeThread.purpose === 'REPEAT_ORDER'
                          ? 'bg-purple-500/15 text-purple-300'
                          : 'bg-amber-500/15 text-amber-300'
                      }`}
                    >
                      {activeThread.purposeLabel ||
                        (activeThread.purpose === 'REPEAT_ORDER' ? 'Repeat Order' : 'Order Status')}
                    </span>
                  </div>
                  {canCreateRepeatPo && (
                    <Button
                      variant="purple"
                      onClick={() => setShowRepeatPoModal(true)}
                      className="w-full sm:w-auto shrink-0"
                    >
                      <FilePlus2 className="w-4 h-4" /> Create Repeat PO
                    </Button>
                  )}
                </div>
                {canCreateRepeatPo && (
                  <p className="text-[10px] text-slate-500 mt-2">
                    Ready for the next step — create a repeat PO with new quantity, price, and delivery date
                    (new PR when required). No bidding.
                  </p>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0 lg:max-h-[360px]">
                {loadingMessages && messages.length === 0 ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-8">
                    No messages yet. Choose a question from the dropdown below.
                  </p>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.isMine ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                          msg.isMine
                            ? 'bg-blue-600 text-white rounded-br-md'
                            : 'bg-slate-800 text-slate-100 rounded-bl-md border border-white/5'
                        }`}
                      >
                        {!msg.isMine && msg.senderCompanyName && (
                          <p className="text-[10px] font-bold opacity-70 mb-1">{msg.senderCompanyName}</p>
                        )}
                        <p>{msg.label}</p>
                        <p
                          className={`text-[10px] mt-1 ${msg.isMine ? 'text-blue-200' : 'text-slate-500'}`}
                        >
                          {new Date(msg.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-4 border-t border-white/5 flex flex-col gap-2">
                {templateHint && (
                  <p className="text-[11px] text-slate-400">
                    {chatRole === 'buyer' ? (
                      <>Pick a question to send to the seller.</>
                    ) : pendingQuestion ? (
                      <>
                        Replying to:{' '}
                        <span className="text-emerald-300 font-medium">{pendingQuestion.text}</span>
                      </>
                    ) : (
                      templateHint
                    )}
                  </p>
                )}
                <div className="flex flex-col sm:flex-row sm:items-end gap-2">
                  <DarkSelect
                    aria-label="Chat message template"
                    value={selectedTemplate}
                    onChange={(v) => {
                      setSelectedTemplate(v);
                      setAnswerDate('');
                    }}
                    disabled={templates.length === 0 || sending}
                    placeholder={
                      chatRole === 'supplier'
                        ? 'Waiting for buyer question…'
                        : 'No questions available'
                    }
                    options={templates.map((t) => ({ value: t.key, label: t.label }))}
                    className="flex-1 min-w-0"
                  />
                  {requiresAnswerDate && (
                    <ChatDatePicker
                      value={answerDate}
                      onChange={setAnswerDate}
                      disabled={sending}
                      className="w-full sm:w-[11.5rem] shrink-0"
                    />
                  )}
                  <Button
                    variant="primary"
                    onClick={sendMessage}
                    loading={sending}
                    disabled={
                      !selectedTemplate ||
                      templates.length === 0 ||
                      (requiresAnswerDate && !answerDate)
                    }
                    className="w-full sm:w-auto shrink-0 h-[42px]"
                  >
                    Send
                  </Button>
                </div>
                {answerPreview && (
                  <p className="text-[11px] text-slate-500">
                    Preview: <span className="text-slate-300">{answerPreview}</span>
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* New chat modal */}
      {showNewChat && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => !startingChat && setShowNewChat(false)}
        >
          <div
            className="relative max-w-md w-full bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-white">Start New Chat</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Each PO can have two chats — one for order status and one for repeat orders.
                </p>
              </div>
              <button type="button" onClick={() => setShowNewChat(false)} disabled={startingChat}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 font-semibold mb-1.5 block">Company</label>
                {loadingCompanies ? (
                  <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading companies...
                  </div>
                ) : (
                  <DarkSelect
                    aria-label="Select company"
                    value={selectedCompanyId}
                    onChange={onCompanyChange}
                    placeholder="Select a verified company"
                    options={companies.map((c) => ({ value: c.id, label: c.name }))}
                  />
                )}
              </div>

              {selectedCompanyId && (
                <div>
                  <label className="text-xs text-slate-400 font-semibold mb-1.5 flex items-center gap-1">
                    <ShoppingCart className="w-3.5 h-3.5" /> Purchase Order
                  </label>
                  {loadingPos ? (
                    <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Loading orders...
                    </div>
                  ) : pos.length === 0 ? (
                    <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                      No purchase orders exist with this company. Chat requires a shared PO.
                    </p>
                  ) : (
                    <DarkSelect
                      aria-label="Select purchase order"
                      value={selectedPoId}
                      onChange={setSelectedPoId}
                      placeholder="Select a purchase order"
                      options={pos.map((po) => ({
                        value: po.id,
                        label: `${po.poNumber} — ${po.status}`,
                      }))}
                    />
                  )}
                </div>
              )}

              <div>
                <label className="text-xs text-slate-400 font-semibold mb-2 block">
                  What is this chat about?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PURPOSE_OPTIONS.map((opt) => {
                    const alreadyOpen = selectedPoId && selectedPoExistingPurposes.has(opt.value);
                    return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setChatPurpose(opt.value)}
                      className={`text-left p-3 rounded-xl border transition-all ${
                        chatPurpose === opt.value
                          ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/30'
                          : 'border-white/10 bg-slate-950/60 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-bold text-white">{opt.label}</p>
                        {alreadyOpen && (
                          <span className="text-[9px] font-bold uppercase tracking-wide text-emerald-400 shrink-0">
                            Open
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">{opt.description}</p>
                    </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewChat(false)}
                  disabled={startingChat}
                  className="flex-1 py-2.5 px-4 bg-white/5 border border-white/10 rounded-xl text-xs font-semibold text-slate-300 hover:bg-white/10"
                >
                  Cancel
                </button>
                <Button
                  variant="primary"
                  onClick={startChat}
                  loading={startingChat}
                  disabled={!selectedPoId}
                  className="flex-1"
                >
                  {openingExistingChat ? 'Open Chat' : 'Start Chat'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showRepeatPoModal && activeThreadId && (
        <RepeatPoModal
          threadId={activeThreadId}
          user={user}
          showToast={showToast}
          onClose={() => setShowRepeatPoModal(false)}
          onCreated={() => {
            setShowRepeatPoModal(false);
          }}
        />
      )}
    </div>
  );
}
