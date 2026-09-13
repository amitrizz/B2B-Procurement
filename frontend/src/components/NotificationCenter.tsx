'use client';

import React, { useState } from 'react';
import { 
  X, 
  CheckCheck, 
  Check,
  Package, 
  FileText, 
  Truck, 
  MessageSquare, 
  Info, 
  Bell, 
  ExternalLink,
  CheckCircle2,
  Clock
} from 'lucide-react';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'ORDER' | 'RFQ' | 'BID' | 'LOGISTICS' | 'PAYMENT' | 'SAMPLING' | 'CHAT' | 'SYSTEM';
  link?: string;
  read: boolean;
  meta?: any;
  createdAt: string | Date;
}

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  unreadCount: number;
  onMarkAllRead: () => void;
  onMarkRead: (id: string) => void;
  onNavigate: (tab: string, link?: string) => void;
  loading?: boolean;
}

function timeAgo(dateInput: string | Date): string {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
  notifications,
  unreadCount,
  onMarkAllRead,
  onMarkRead,
  onNavigate,
  loading = false
}) => {
  const [activeFilter, setActiveFilter] = useState<'all' | 'ORDER' | 'RFQ_BID' | 'LOGISTICS' | 'OTHER'>('all');

  if (!isOpen) return null;

  const filteredNotifications = notifications.filter((n) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'ORDER') return n.type === 'ORDER' || n.type === 'PAYMENT';
    if (activeFilter === 'RFQ_BID') return n.type === 'RFQ' || n.type === 'BID' || n.type === 'SAMPLING';
    if (activeFilter === 'LOGISTICS') return n.type === 'LOGISTICS';
    if (activeFilter === 'OTHER') return n.type === 'CHAT' || n.type === 'SYSTEM';
    return true;
  });

  const getIconAndColor = (type: NotificationItem['type']) => {
    switch (type) {
      case 'ORDER':
        return {
          icon: <Package className="w-4 h-4 text-blue-400" />,
          bg: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
          dot: 'bg-blue-500'
        };
      case 'BID':
      case 'RFQ':
        return {
          icon: <FileText className="w-4 h-4 text-emerald-400" />,
          bg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
          dot: 'bg-emerald-500'
        };
      case 'LOGISTICS':
        return {
          icon: <Truck className="w-4 h-4 text-amber-400" />,
          bg: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
          dot: 'bg-amber-500'
        };
      case 'CHAT':
        return {
          icon: <MessageSquare className="w-4 h-4 text-purple-400" />,
          bg: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
          dot: 'bg-purple-500'
        };
      default:
        return {
          icon: <Info className="w-4 h-4 text-cyan-400" />,
          bg: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400',
          dot: 'bg-cyan-500'
        };
    }
  };

  const handleItemClick = (item: NotificationItem) => {
    if (!item.read) {
      onMarkRead(item.id);
    }
    
    // Resolve which dashboard tab to navigate to
    let targetTab = 'orders';
    if (item.link?.includes('marketplace')) {
      targetTab = 'marketplace';
    } else if (item.link?.includes('my_rfqs') || item.link?.includes('rfq')) {
      targetTab = 'my_rfqs';
    } else if (item.link?.includes('transporter')) {
      targetTab = 'transporter';
    } else if (item.link?.includes('chat')) {
      targetTab = 'company_chat';
    } else if (item.link?.includes('profile')) {
      targetTab = 'profile';
    } else if (item.type === 'LOGISTICS') {
      targetTab = 'orders';
    } else if (item.type === 'BID' || item.type === 'RFQ') {
      targetTab = item.link?.includes('marketplace') ? 'marketplace' : 'my_rfqs';
    } else if (item.type === 'CHAT') {
      targetTab = 'company_chat';
    }

    onNavigate(targetTab, item.link);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex justify-end animate-in fade-in duration-200">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity" 
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="relative w-full max-w-md bg-slate-900 border-l border-white/10 h-full shadow-2xl flex flex-col z-10 text-white">
        
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-slate-900/90 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold tracking-tight text-white">Activity Notifications</h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 bg-blue-600 text-white text-[11px] font-extrabold rounded-full animate-pulse shadow-sm">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">Live platform activities for buyer, supplier & transport</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-blue-400 px-2.5 py-1.5 rounded-lg hover:bg-white/5 transition-colors font-semibold cursor-pointer"
                title="Mark all notifications as read"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Mark read</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="px-4 py-2.5 border-b border-white/5 bg-slate-950/40 flex items-center gap-1.5 overflow-x-auto custom-scrollbar text-xs">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1 rounded-lg font-bold shrink-0 transition-all cursor-pointer ${
              activeFilter === 'all'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('ORDER')}
            className={`px-3 py-1 rounded-lg font-bold shrink-0 transition-all cursor-pointer ${
              activeFilter === 'ORDER'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            Orders
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('RFQ_BID')}
            className={`px-3 py-1 rounded-lg font-bold shrink-0 transition-all cursor-pointer ${
              activeFilter === 'RFQ_BID'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            RFQs & Bids
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('LOGISTICS')}
            className={`px-3 py-1 rounded-lg font-bold shrink-0 transition-all cursor-pointer ${
              activeFilter === 'LOGISTICS'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            Logistics
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('OTHER')}
            className={`px-3 py-1 rounded-lg font-bold shrink-0 transition-all cursor-pointer ${
              activeFilter === 'OTHER'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            Chat & System
          </button>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400 space-y-2">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs">Loading activity feed...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center px-6">
              <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-slate-500 mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-white mb-1">No notifications here</h4>
              <p className="text-xs text-slate-400 max-w-xs">
                {activeFilter === 'all'
                  ? 'All recent buyer, supplier, and logistics activities will appear here in real-time.'
                  : `No activities found in this filter category.`}
              </p>
            </div>
          ) : (
            filteredNotifications.map((item) => {
              const { icon, bg, dot } = getIconAndColor(item.type);
              return (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className={`group relative p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                    item.read
                      ? 'bg-slate-950/40 border-white/5 hover:border-white/15 hover:bg-white/5'
                      : 'bg-slate-800/80 border-blue-500/30 hover:border-blue-500/50 shadow-sm'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Activity Type Badge Icon */}
                    <div className={`p-2 rounded-xl border shrink-0 mt-0.5 ${bg}`}>
                      {icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h4 className={`text-xs font-bold truncate ${item.read ? 'text-slate-200' : 'text-white'}`}>
                          {item.title}
                        </h4>
                        <span className="text-[10px] text-slate-400 shrink-0 flex items-center gap-1 font-medium">
                          <Clock className="w-2.5 h-2.5" />
                          {timeAgo(item.createdAt)}
                        </span>
                      </div>
                      <p className={`text-xs leading-relaxed line-clamp-2 ${item.read ? 'text-slate-400' : 'text-slate-300'}`}>
                        {item.message}
                      </p>

                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1.5 py-0.5 rounded bg-white/5 border border-white/5">
                            {item.type}
                          </span>
                          <span className="text-[10px] text-blue-400 group-hover:underline flex items-center gap-0.5 font-medium">
                            View details
                            <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </span>
                        </div>

                        {/* Individual Mark as Read button */}
                        {!item.read ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onMarkRead(item.id);
                            }}
                            title="Mark this notification as read"
                            className="flex items-center gap-1 text-[10px] text-slate-300 hover:text-emerald-400 bg-white/5 hover:bg-emerald-500/15 border border-white/10 hover:border-emerald-500/30 px-2 py-0.5 rounded transition-all cursor-pointer font-semibold shrink-0 active:scale-95"
                          >
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span>Mark read</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-500 flex items-center gap-1 font-medium shrink-0">
                            <CheckCheck className="w-3 h-3 text-slate-500/70" />
                            <span>Read</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Unread blue dot */}
                    {!item.read && (
                      <div className="absolute top-4 right-3.5">
                        <span className={`block w-2 h-2 rounded-full ${dot} shadow-[0_0_8px_rgba(59,130,246,0.8)]`} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-white/10 bg-slate-950/60 text-center text-[11px] text-slate-400">
          Captures live procurement, quotes, deliveries & chat updates
        </div>
      </div>
    </div>
  );
};
