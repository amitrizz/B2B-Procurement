'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MessageSquare,
  Plus,
  X,
  Loader2,
  ShoppingCart,
  FilePlus2,
  ArrowLeft,
  Search,
  Paperclip,
  Send,
  CheckCheck,
  MoreVertical,
  RotateCw,
  ChevronUp,
  ChevronDown,
  Check,
} from 'lucide-react';
import { ChatDatePicker } from '@/components/ui/ChatDatePicker';
import { DarkSelect } from '@/components/ui/DarkSelect';
import { answerRequiresDate, previewAnswerWithDate } from '@/lib/chatPlaceholders';
import RepeatPoModal from '../orders/components/RepeatPoModal';

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
  mode?: 'buyer' | 'supplier' | 'seller';
}

const AVATAR_PALETTES = [
  { bg: 'bg-[#1e293b]', text: 'text-white' },          // Navy
  { bg: 'bg-[#e0f2fe]', text: 'text-[#0284c7]' },      // Sky
  { bg: 'bg-[#dcfce7]', text: 'text-[#16a34a]' },      // Mint
  { bg: 'bg-[#f3e8ff]', text: 'text-[#9333ea]' },      // Purple
  { bg: 'bg-[#ffedd5]', text: 'text-[#ea580c]' },      // Peach/Orange
  { bg: 'bg-[#dbeafe]', text: 'text-[#2563eb]' },      // Blue
];

function getAvatarStyle(name: string = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[index];
}

function formatThreadTime(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  if (isToday) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (isYesterday) {
    return 'Yesterday';
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatMessageTime(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function CompanyChatTab({
  user,
  showToast,
  realtimeEvent = null,
  mode = 'buyer',
}: CompanyChatTabProps) {
  const isSupplier = mode === 'supplier' || mode === 'seller';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [showQuestionSelector, setShowQuestionSelector] = useState(false);

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
  const dropdownRef = useRef<HTMLDivElement>(null);
  const lastRealtimeAtRef = useRef(0);
  const myCompanyId = user?.companyId;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowQuestionSelector(false);
      }
    }
    if (showQuestionSelector) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showQuestionSelector]);

  const activeThread = threads.find((t) => t.id === activeThreadId) ?? null;

  // Separate Buyer vs Seller chats automatically based on header mode
  const currentRoleThreads = threads.filter((t) =>
    isSupplier
      ? t.supplierCompany?.id === myCompanyId
      : t.buyerCompany?.id === myCompanyId
  );

  // Filter with search query
  const searchedThreads = currentRoleThreads.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.counterpartyCompany?.name?.toLowerCase().includes(q) ||
      t.poNumber?.toLowerCase().includes(q) ||
      t.lastMessagePreview?.toLowerCase().includes(q) ||
      t.purposeLabel?.toLowerCase().includes(q)
    );
  });

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
        setShowQuestionSelector(false);
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

  // Theme-based styling derived strictly from header mode
  const themeButtonClass = isSupplier
    ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/25'
    : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/25';

  const themeBubbleClass = isSupplier
    ? 'bg-emerald-600 text-white'
    : 'bg-blue-600 text-white';

  const counterpartyInitial = (activeThread?.counterpartyCompany?.name || 'C').charAt(0).toUpperCase();

  // ==========================================
  // VIEW 1: CONVERSATION LIST (When no thread is open)
  // ==========================================
  if (!activeThreadId || !activeThread) {
    return (
      <div className="flex flex-col h-full space-y-3 pb-8">
        {/* Header with Title & Subtitle */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[#001D4A]">
              Chat
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Connect with your team and get updates on your activities.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={openNewChatModal}
              className={`cursor-pointer py-2 px-3.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] text-white shadow-md ${themeButtonClass}`}
            >
              <Plus className="w-4 h-4" /> New Chat
            </button>
            <button
              type="button"
              onClick={() => loadThreads()}
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-700 shadow-2xs cursor-pointer"
              title="Refresh chats"
            >
              <RotateCw className={`w-4 h-4 ${loadingThreads ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Search Conversations Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 bg-white rounded-2xl border border-slate-200/80 shadow-2xs px-2">
          {loadingThreads && searchedThreads.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center">
              <Loader2 className="w-7 h-7 animate-spin text-blue-500 mb-2" />
              <p className="text-xs text-slate-400 font-medium">Loading conversations...</p>
            </div>
          ) : searchedThreads.length === 0 ? (
            <div className="p-12 text-center">
              <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">No conversations found</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                {searchQuery
                  ? 'No chats match your search criteria.'
                  : !isSupplier
                  ? 'No buyer chats yet. Click "New Chat" to connect on a Purchase Order.'
                  : 'No seller chats yet. When buyers reach out on POs, they will appear here.'}
              </p>
            </div>
          ) : (
            searchedThreads.map((thread) => {
              const palette = getAvatarStyle(thread.counterpartyCompany?.name || 'Company');
              const initial = (thread.counterpartyCompany?.name || 'C').charAt(0).toUpperCase();
              const timeStr = formatThreadTime(thread.lastMessageAt);

              return (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => setActiveThreadId(thread.id)}
                  className="w-full text-left py-3 px-2.5 hover:bg-slate-50 transition-colors flex items-start gap-3 rounded-xl cursor-pointer"
                >
                  {/* Colorful Avatar Circle */}
                  <div
                    className={`w-11 h-11 rounded-full ${palette.bg} ${palette.text} font-bold text-sm flex items-center justify-center shrink-0 shadow-2xs mt-0.5`}
                  >
                    {initial}
                  </div>

                  {/* Conversation Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-[#001D4A] truncate">
                        {thread.counterpartyCompany?.name || 'Company'}
                      </h3>
                      <span className="text-[10px] text-slate-400 font-medium shrink-0">
                        {timeStr}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                      <span className="text-[11px] text-emerald-600 font-medium">Active now</span>
                    </div>

                    <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                      {thread.poNumber ? (
                        <span className="font-semibold text-slate-700 mr-1">
                          {thread.poNumber}:
                        </span>
                      ) : null}
                      {thread.lastMessagePreview || 'No messages yet'}
                    </p>
                  </div>

                  {/* Right Status Badge */}
                  <div className="shrink-0 self-center pl-1">
                    {thread.purpose === 'REPEAT_ORDER' ? (
                      <span className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase bg-purple-50 text-purple-600 border border-purple-200">
                        Repeat PO
                      </span>
                    ) : (
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shadow-2xs">
                        1
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* New Chat Modal */}
        {renderNewChatModal()}
      </div>
    );
  }

  // ==========================================
  // VIEW 2: FULL PAGE CHAT SCREEN (When thread is open)
  // ==========================================
  return (
    <div className="flex flex-col h-full -mt-2 -mx-1 sm:mx-0">
      {/* 1. Chat Sub-Header: Back Button, Company Name, Active Status, Menu */}
      <div className="flex items-center justify-between py-2.5 px-3 bg-white border-b border-slate-100 rounded-t-2xl shadow-2xs">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setActiveThreadId(null)}
            className="p-1 -ml-1 rounded-full hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
            title="Back to conversations"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h2 className="font-extrabold text-sm text-[#001D4A] truncate">
              {activeThread.counterpartyCompany?.name || 'Company Chat'}
            </h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
              <span className="text-[11px] text-emerald-600 font-medium">Active now</span>
              {activeThread.poNumber && (
                <span className="text-[10px] text-blue-500 font-mono ml-1">• {activeThread.poNumber}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {canCreateRepeatPo && (
            <button
              type="button"
              onClick={() => setShowRepeatPoModal(true)}
              className="py-1 px-2.5 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all bg-purple-600 hover:bg-purple-700 text-white shadow-2xs cursor-pointer"
            >
              <FilePlus2 className="w-3.5 h-3.5" /> Repeat PO
            </button>
          )}
          <button
            type="button"
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 4. Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3.5 min-h-0 bg-[#F8FAFC]">
        {/* Centered Date Badge */}
        <div className="flex justify-center">
          <span className="px-3.5 py-1 rounded-full bg-slate-200/70 text-slate-600 text-[11px] font-medium shadow-2xs">
            Today, {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>

        {loadingMessages && messages.length === 0 ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-10 px-4">
            <p className="text-xs text-slate-400 font-medium">
              No messages in this chat yet. Select a question below to send to the seller.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const timeStr = formatMessageTime(msg.createdAt);

            if (msg.isMine) {
              // Outgoing Sent Message
              return (
                <div key={msg.id} className="flex flex-col items-end">
                  <div
                    className={`max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-tr-xs px-4 py-2.5 text-[13px] leading-relaxed shadow-xs ${themeBubbleClass}`}
                  >
                    <p>{msg.label}</p>
                  </div>
                  <div className="flex items-center gap-1 mt-1 mr-1 text-[10px] text-slate-400">
                    <span>{timeStr}</span>
                    <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
                  </div>
                </div>
              );
            }

            // Incoming Received Message
            return (
              <div key={msg.id} className="flex flex-col items-start">
                <div className="flex items-end gap-2 max-w-[85%] sm:max-w-[75%]">
                  <div className="w-7 h-7 rounded-full bg-sky-100 text-sky-600 font-bold text-xs flex items-center justify-center shrink-0 mb-1 shadow-2xs">
                    {counterpartyInitial}
                  </div>
                  <div className="bg-white text-[#001D4A] rounded-2xl rounded-tl-xs px-4 py-2.5 text-[13px] leading-relaxed shadow-2xs border border-slate-200/80">
                    <p>{msg.label}</p>
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 mt-1 ml-9">
                  {timeStr}
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 5. Bottom Interactive Input Bar */}
      <div className="p-3 bg-white border-t border-slate-100 relative">
        {/* Custom Styled Question Popover (opens upward above input bar) */}
        {showQuestionSelector && templates.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute bottom-full mb-2.5 left-3 right-3 bg-white border border-slate-200 rounded-2xl shadow-xl p-2.5 z-40 max-h-72 overflow-y-auto"
          >
            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between border-b border-slate-100 pb-2 mb-1.5">
              <span>{chatRole === 'supplier' ? 'Choose an Answer' : 'Select a Question'}</span>
              <button
                type="button"
                onClick={() => setShowQuestionSelector(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-1">
              {templates.map((t) => {
                const isSelected = selectedTemplate === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => {
                      setSelectedTemplate(t.key);
                      setAnswerDate('');
                      setShowQuestionSelector(false);
                    }}
                    className={`w-full text-left py-2.5 px-3 rounded-xl text-xs transition-all flex items-center justify-between gap-2 cursor-pointer ${
                      isSelected
                        ? isSupplier
                          ? 'bg-emerald-50 text-emerald-700 font-semibold'
                          : 'bg-blue-50 text-blue-700 font-semibold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="leading-snug">{t.label}</span>
                    {isSelected && <Check className="w-4 h-4 shrink-0 text-current" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Template Hint */}
        {templateHint && (
          <p className="text-[11px] text-slate-400 mb-2 px-1">
            {chatRole === 'buyer' ? (
              <>Pick a question to send to the seller:</>
            ) : pendingQuestion ? (
              <>
                Replying to:{' '}
                <span className="text-emerald-600 font-semibold">{pendingQuestion.text}</span>
              </>
            ) : (
              templateHint
            )}
          </p>
        )}

        {/* Quick Question Chips for fast 1-tap messaging */}
        {templates.length > 0 && !requiresAnswerDate && (
          <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-none">
            {templates.slice(0, 3).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setSelectedTemplate(t.key);
                  setAnswerDate('');
                }}
                className={`text-[11px] px-3 py-1 rounded-full whitespace-nowrap transition-all border shrink-0 cursor-pointer ${
                  selectedTemplate === t.key
                    ? 'bg-blue-50 text-blue-600 border-blue-200 font-semibold'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* Input Capsule with Paperclip, Custom Dropdown Trigger, and Send button */}
        <div className="bg-[#F8FAFC] border border-slate-200 rounded-2xl p-1.5 flex items-center gap-2 shadow-2xs">
          <button
            type="button"
            onClick={() => setShowQuestionSelector(!showQuestionSelector)}
            className="p-2 text-slate-400 hover:text-slate-600 transition-colors rounded-xl hover:bg-slate-200/50 cursor-pointer shrink-0"
            title="Available question templates"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => setShowQuestionSelector(!showQuestionSelector)}
            disabled={templates.length === 0 || sending}
            className="flex-1 min-w-0 text-left py-1.5 px-1 flex items-center justify-between gap-1.5 cursor-pointer"
          >
            <span
              className={`text-xs truncate ${
                selectedTemplateOption?.label
                  ? 'text-slate-800 font-medium'
                  : 'text-slate-400'
              }`}
            >
              {selectedTemplateOption?.label ||
                (templates.length === 0
                  ? chatRole === 'supplier'
                    ? 'Waiting for buyer question…'
                    : 'No questions available'
                  : chatRole === 'supplier'
                  ? 'Choose answer...'
                  : 'Type your message...')}
            </span>
            <ChevronUp
              className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                showQuestionSelector ? 'rotate-180' : ''
              }`}
            />
          </button>

          {requiresAnswerDate && (
            <div className="w-28 sm:w-36 shrink-0">
              <input
                type="date"
                value={answerDate}
                onChange={(e) => setAnswerDate(e.target.value)}
                disabled={sending}
                className="w-full bg-white border border-slate-200 rounded-xl px-2 py-1 text-xs text-slate-800 focus:outline-none"
              />
            </div>
          )}

          <button
            type="button"
            onClick={sendMessage}
            disabled={!selectedTemplate || sending || (requiresAnswerDate && !answerDate)}
            className={`w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0 transition-all active:scale-95 shadow-md ${
              !selectedTemplate || sending || (requiresAnswerDate && !answerDate)
                ? 'opacity-40 cursor-not-allowed bg-slate-400'
                : `cursor-pointer ${themeButtonClass}`
            }`}
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Send className="w-4 h-4 text-white -rotate-12 translate-x-[-1px] translate-y-[-1px]" />
            )}
          </button>
        </div>

        {answerPreview && (
          <p className="text-[10px] text-slate-500 mt-1 px-2">
            Preview: <span className="text-slate-700 font-medium">{answerPreview}</span>
          </p>
        )}
      </div>

      {/* Repeat PO Modal */}
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

      {/* New Chat Modal */}
      {renderNewChatModal()}
    </div>
  );

  // ==========================================
  // HELPER: NEW CHAT MODAL
  // ==========================================
  function renderNewChatModal() {
    if (!showNewChat) return null;

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
        onClick={() => !startingChat && setShowNewChat(false)}
      >
        <div
          className="relative max-w-md w-full bg-white border border-slate-200 rounded-2xl shadow-2xl p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-bold text-[#001D4A]">Start New Chat</h3>
              <p className="text-xs text-slate-400 mt-1">
                Each PO can have two chats — one for order status and one for repeat orders.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowNewChat(false)}
              disabled={startingChat}
              className="p-1 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-600 font-semibold mb-1.5 block">
                Company
              </label>
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
                <label className="text-xs text-slate-600 font-semibold mb-1.5 flex items-center gap-1">
                  <ShoppingCart className="w-3.5 h-3.5" /> Purchase Order
                </label>
                {loadingPos ? (
                  <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading orders...
                  </div>
                ) : pos.length === 0 ? (
                  <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl p-3">
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
              <label className="text-xs text-slate-600 font-semibold mb-2 block">
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
                          ? 'border-blue-500 bg-blue-50/70 ring-1 ring-blue-500/30'
                          : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-bold text-[#001D4A]">{opt.label}</p>
                        {alreadyOpen && (
                          <span className="text-[9px] font-bold uppercase tracking-wide text-emerald-600 shrink-0">
                            Open
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">{opt.description}</p>
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
                className="flex-1 py-2.5 px-4 bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={startChat}
                disabled={!selectedPoId || startingChat}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold text-white shadow-md flex items-center justify-center gap-2 ${
                  !selectedPoId || startingChat ? 'opacity-50 cursor-not-allowed bg-slate-400' : themeButtonClass
                }`}
              >
                {startingChat ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : openingExistingChat ? (
                  'Open Chat'
                ) : (
                  'Start Chat'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
