'use client';
import React, { createContext, useContext } from 'react';

import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { onCentrifugoEvent } from '@/lib/centrifugoClient';
import { applyCompanyToUser, getCompanyIdFromUser, persistUser, patchUserCompany, readDashboardMode, persistDashboardMode, type DashboardMode } from '@/lib/userSession';
import { resolveToastType, isIncomingChatEvent } from '@/lib/realtimeNotifications';
import { getDefaultRouteForRole, getRouteForTab, isTabAllowedForRole, isTabAllowedForMode, getDefaultRouteForMode } from '@/lib/roleRouting';
import { 
  Building, LogOut, CheckCircle, Clock, ShoppingCart, Package,
  Plus, Users, FileText, ChevronRight, Truck, Info,
  Search, ShieldAlert, Star, RefreshCw, ArrowLeft,
  Menu, X, User, Loader2, MessageSquare, Hexagon, Bell, ClipboardList, UserCheck
} from 'lucide-react';
import { NotificationCenter, type NotificationItem } from '@/components/NotificationCenter';



let refreshTokenPromise: Promise<any> | null = null;

export const DashboardContext = createContext<any>(null);

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [impersonatedCompany, setImpersonatedCompany] = useState<any>(null);

  // Extract active tab state from path segments
  const pathParts = pathname.split('/').filter(Boolean);
  const pathSegment = pathParts[0]; // First segment of the path (e.g. "orders")
  
  let tabName = pathSegment;
  if (pathSegment === 'dashboard') {
    tabName = pathParts[1] || 'marketplace';
  }

  let activeTab = 'marketplace';
  if (tabName === 'rfqs') activeTab = 'my_rfqs';
  else if (tabName === 'delivery') activeTab = 'transporter';
  else if (tabName === 'chat') activeTab = 'company_chat';
  else if (tabName === 'requisitions') activeTab = 'prs';
  else if (tabName) activeTab = tabName;

  const companyId = getCompanyIdFromUser(user);

  const handleTabChange = (tab: string) => {
    if (!isTabAllowedForMode(tab, mode)) {
      if (mode === 'buyer') {
        showToast('Public Marketplace is only accessible in Seller mode', 'info');
      } else {
        showToast('Purchase Requisitions are only accessible in Buyer mode', 'info');
      }
      router.push(getDefaultRouteForMode(mode));
      return;
    }
    if (user && !isTabAllowedForRole(tab, user.role)) {
      router.push(getDefaultRouteForRole(user.role, mode));
      return;
    }
    router.push(getRouteForTab(tab));
    setShowMobileSidebar(false);
  };

  const [rfqs, setRfqs] = useState<any[]>([]);
  const [marketplaceRfqs, setMarketplaceRfqs] = useState<any[]>([]);
  const [myBids, setMyBids] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [adminCompanies, setAdminCompanies] = useState<any[]>([]);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [prs, setPrs] = useState<any[]>([]);
  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  const [adminPayments, setAdminPayments] = useState<any[]>([]);
  const [adminInvoices, setAdminInvoices] = useState<any[]>([]);
  const [companyComponents, setCompanyComponents] = useState<any[]>([]);
  const [companyCategories, setCompanyCategories] = useState<any[]>([]);

  // Modals / Selection States
  const [showRfqModal, setShowRfqModal] = useState(false);
  const [editingRfqId, setEditingRfqId] = useState<string | null>(null);
  const [newRfqTitle, setNewRfqTitle] = useState('');
  const [newRfqDesc, setNewRfqDesc] = useState('');
  const [newRfqCategory, setNewRfqCategory] = useState('');
  const [buyerPrId, setBuyerPrId] = useState('');
  const [newRfqBidEndAt, setNewRfqBidEndAt] = useState(() => {
    const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  });
  const [newRfqItems, setNewRfqItems] = useState<any[]>([
    { componentName: 'Bracket A', quantity: 500, unit: 'pcs', drawingFileId: 'drawing_bracket_a.pdf', hsnCode: '84799090', materialOptionPreference: 'WITH_MATERIAL', expectedTimeDays: 14 }
  ]);

  const [selectedRfqForBidding, setSelectedRfqForBidding] = useState<any>(null);
  const [bidInputs, setBidInputs] = useState<{ [key: string]: { priceWith: number, priceWithout: number, leadTime: number } }>({});

  const [selectedRfqForDetails, setSelectedRfqForDetails] = useState<any>(null);
  const [compareToggle, setCompareToggle] = useState<'with_material' | 'without_material'>('with_material');

  const [loading, setLoading] = useState(false);
  const [submittingActions, setSubmittingActions] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [toasts, setToasts] = useState<{ id: string; type: 'success' | 'error' | 'info'; text: string }[]>([]);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [chatRealtimeEvent, setChatRealtimeEvent] = useState<any>(null);

  // Dynamic Multi-Role Notifications State
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  const withLoading = async (actionId: string, fn: () => Promise<void>) => {
    setSubmittingActions(prev => ({ ...prev, [actionId]: true }));
    try {
      await fn();
    } finally {
      setSubmittingActions(prev => ({ ...prev, [actionId]: false }));
    }
  };
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [mode, setModeState] = useState<DashboardMode>('buyer');

  const setMode = (next: DashboardMode) => {
    setModeState(next);
    persistDashboardMode(next, getCompanyIdFromUser(user));
    if (next === 'seller' && (activeTab === 'prs' || pathname.includes('/requisitions'))) {
      router.push('/dashboard/rfqs');
    }
    if (next === 'buyer' && (activeTab === 'marketplace' || pathname.includes('/marketplace'))) {
      router.push('/dashboard/rfqs');
    }
  };

  useEffect(() => {
    if (!user) return;
    setModeState(readDashboardMode(getCompanyIdFromUser(user)));
  }, [user?.id, companyId]);

  // Mode Route Restriction Guard: Ensure seller cannot stay on buyer-only pages and buyer cannot stay on marketplace
  useEffect(() => {
    if (checkingAuth) return;
    if (mode === 'seller' && (activeTab === 'prs' || pathname.includes('/requisitions'))) {
      router.replace('/dashboard/rfqs');
    }
    if (mode === 'buyer' && (activeTab === 'marketplace' || pathname.includes('/marketplace'))) {
      router.replace('/dashboard/rfqs');
    }
  }, [mode, activeTab, pathname, checkingAuth, router]);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const handleImpersonateCompany = async (company: any) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/admin/impersonate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ companyId: company.id }),
      });
      const data = await res.json();
      if (!data.success) {
        showToast(data.message || 'Failed to impersonate company', 'error');
        return;
      }

      // Save admin session backup before switching
      localStorage.setItem('admin_backup_token', token || '');
      localStorage.setItem('admin_backup_user', localStorage.getItem('user') || '');
      localStorage.setItem('is_impersonating', 'true');
      localStorage.setItem('impersonated_company', JSON.stringify(company));
      localStorage.setItem('impersonated_target_email', data.data.user.email);

      // Set impersonated credentials
      localStorage.setItem('token', data.data.accessToken);
      localStorage.setItem('user', JSON.stringify(data.data.user));
      if (data.data.refreshToken) {
        localStorage.setItem('refreshToken', data.data.refreshToken);
      }

      setUser(data.data.user);
      setIsImpersonating(true);
      setImpersonatedCompany(company);

      showToast(`Now impersonating ${company.name}`, 'success');
      const targetMode = readDashboardMode(company.id);
      router.push(getDefaultRouteForRole(data.data.user?.role, targetMode));
    } catch (err: any) {
      showToast('Error starting impersonation', 'error');
    }
  };

  const handleExitImpersonation = async () => {
    try {
      const targetEmail = localStorage.getItem('impersonated_target_email') || '';
      if (targetEmail) {
        await fetch('/api/v1/admin/impersonate/exit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetEmail }),
        }).catch(() => {});
      }

      const backupToken = localStorage.getItem('admin_backup_token');
      const backupUser = localStorage.getItem('admin_backup_user');

      if (backupToken && backupUser) {
        localStorage.setItem('token', backupToken);
        localStorage.setItem('user', backupUser);
        try {
          setUser(JSON.parse(backupUser));
        } catch {}
      }

      localStorage.removeItem('admin_backup_token');
      localStorage.removeItem('admin_backup_user');
      localStorage.removeItem('is_impersonating');
      localStorage.removeItem('impersonated_company');
      localStorage.removeItem('impersonated_target_email');

      setIsImpersonating(false);
      setImpersonatedCompany(null);

      showToast('Exited impersonation. Returned to Platform Admin.', 'info');
      router.push('/dashboard/admin');
    } catch {
      showToast('Error exiting impersonation', 'error');
    }
  };

  const fetchNotifications = async (showLoading = false) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;
    try {
      if (showLoading && notifications.length === 0) {
        setLoadingNotifications(true);
      }
      const res = await fetch('/api/v1/notifications', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success && json.data) {
        setNotifications(json.data.notifications || []);
        setUnreadNotificationsCount(json.data.unreadCount || 0);
      }
    } catch (e) {
      console.error('Failed to fetch notifications:', e);
    } finally {
      if (showLoading) {
        setLoadingNotifications(false);
      }
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;
    try {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadNotificationsCount(0);
      await fetch('/api/v1/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ action: 'mark_all_read' })
      });
    } catch (e) {
      console.error('Failed to mark all notifications read:', e);
    }
  };

  const handleMarkNotificationRead = async (id: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;
    try {
      const target = notifications.find((n) => n.id === id);
      const targetSourceId = target?.meta?.sourceId || target?.meta?.rfqId;

      setNotifications((prev) =>
        prev.map((n) => {
          if (n.id === id || (targetSourceId && (n.meta?.sourceId === targetSourceId || n.meta?.rfqId === targetSourceId))) {
            return { ...n, read: true };
          }
          return n;
        })
      );
      setUnreadNotificationsCount((prev) => {
        const newlyRead = notifications.filter(
          (n) => !n.read && (n.id === id || (targetSourceId && (n.meta?.sourceId === targetSourceId || n.meta?.rfqId === targetSourceId)))
        ).length;
        return Math.max(0, prev - (newlyRead || 1));
      });
      await fetch('/api/v1/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ action: 'mark_read', id })
      });
    } catch (e) {
      console.error('Failed to mark notification read:', e);
    }
  };

  const fetchDataRef = useRef<(isBackground?: boolean) => Promise<void>>(null as any);
  const companyFetchSeqRef = useRef(0);
  /** After a live Centrifugo patch, ignore stale API responses briefly. */
  const companyRealtimePatchAtRef = useRef(0);
  const lastCompanyRefreshRef = useRef(0);

  /** Fetch latest company profile; throttles duplicate calls within 60s unless forced. */
  const refreshCompanyProfile = async (force = false): Promise<void> => {
    const token = localStorage.getItem('token');
    const stored = localStorage.getItem('user');
    if (!token || !stored) return;

    if (!force && Date.now() - lastCompanyRefreshRef.current < 60000) {
      return;
    }
    lastCompanyRefreshRef.current = Date.now();

    let parsed: any;
    try {
      parsed = JSON.parse(stored);
    } catch {
      return;
    }

    const companyId = getCompanyIdFromUser(parsed);
    if (!companyId) return;

    const seq = ++companyFetchSeqRef.current;

    try {
      const res = await fetch(`/api/v1/company/me?_t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const raw = await res.text();
      let d: any;
      try {
        d = raw ? JSON.parse(raw) : null;
      } catch {
        console.error('Non-JSON response from /company/me:', raw.slice(0, 120));
        return;
      }
      if (seq !== companyFetchSeqRef.current) return;
      if (d.success && d.data) {
        setUser((prev: any) => {
          if (!prev) return prev;
          const recentlyPatched = Date.now() - companyRealtimePatchAtRef.current < 15000;
          if (
            recentlyPatched &&
            prev.company?.status &&
            prev.company.status !== 'PENDING' &&
            d.data.status === 'PENDING'
          ) {
            return prev;
          }
          const updated = applyCompanyToUser(prev, d.data);
          persistUser(updated);
          return updated;
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const res = await originalFetch(...args);
      if (res.status === 401) {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken && !args[0]?.toString().includes('/api/v1/auth/refresh')) {
          try {
            if (!refreshTokenPromise) {
              refreshTokenPromise = originalFetch('/api/v1/auth/refresh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken })
              }).then(res => res.json()).finally(() => {
                refreshTokenPromise = null;
              });
            }
            
            const refreshData = await refreshTokenPromise;
            
            if (refreshData.success && refreshData.data?.accessToken) {
              localStorage.setItem('token', refreshData.data.accessToken);
              if (refreshData.data.refreshToken) {
                localStorage.setItem('refreshToken', refreshData.data.refreshToken);
              }
              // Retry the original request with the new token
              const newArgs = [...args] as any;
              if (newArgs[1] && newArgs[1].headers) {
                if (newArgs[1].headers instanceof Headers) {
                  newArgs[1].headers.set('Authorization', `Bearer ${refreshData.data.accessToken}`);
                } else if (typeof newArgs[1].headers === 'object') {
                  newArgs[1].headers['Authorization'] = `Bearer ${refreshData.data.accessToken}`;
                }
              } else if (!newArgs[1]) {
                newArgs[1] = { headers: { 'Authorization': `Bearer ${refreshData.data.accessToken}` } };
              }
              return originalFetch(newArgs[0] as RequestInfo | URL, newArgs[1] as RequestInit);
            }
          } catch (e) {
            console.error('Failed to refresh token', e);
          }
        }
        
        localStorage.clear();
        router.push('/');
      }
      return res;
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, [router]);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (!storedUser || !token) {
      setCheckingAuth(false);
      router.push('/');
      return;
    }
      const parsed = JSON.parse(storedUser);
      setUser(parsed);
      setModeState(readDashboardMode(getCompanyIdFromUser(parsed)));

      const impersonatingFlag = localStorage.getItem('is_impersonating') === 'true';
      if (impersonatingFlag) {
        setIsImpersonating(true);
        try {
          const comp = JSON.parse(localStorage.getItem('impersonated_company') || '{}');
          setImpersonatedCompany(comp);
        } catch {}
      }

      setCheckingAuth(false);
  }, [router]);

  // Redirect legacy admin users route into unified admin portal
  useEffect(() => {
    if (!user || checkingAuth) return;
    if (user.role === 'PLATFORM_ADMIN' && activeTab === 'admin_users') {
      router.replace('/admin');
    }
  }, [user, checkingAuth, activeTab, router]);

  // Redirect users away from tabs their role cannot access
  useEffect(() => {
    if (!user || checkingAuth) return;
    if (!isTabAllowedForRole(activeTab, user.role)) {
      router.replace(getDefaultRouteForRole(user.role, mode));
    }
  }, [user, activeTab, checkingAuth, router, mode]);

  // Redirect naked /dashboard route based on current mode
  useEffect(() => {
    if (checkingAuth) return;
    if (pathname === '/dashboard' || pathname === '/dashboard/') {
      router.replace(mode === 'buyer' ? '/dashboard/rfqs' : '/dashboard/marketplace');
    }
  }, [pathname, mode, checkingAuth, router]);

  useEffect(() => {
    fetchDataRef.current = fetchData;
  });

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [activeTab, mode, user?.id]);

  // Initial fetch of notifications on session mount (reactive updates arrive via Centrifugo WebSocket)
  useEffect(() => {
    if (user?.id) {
      fetchNotifications(false);
    }
  }, [user?.id]);

  // Lazy-load PRs and company catalog components only when Create/Edit RFQ modal is actually opened
  useEffect(() => {
    if (showRfqModal) {
      const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
      if (prs.length === 0) {
        fetch('/api/v1/prs', { headers }).then(r => r.json()).then(d => { if (d?.success) setPrs(d.data); }).catch(() => {});
      }
      if (companyComponents.length === 0) {
        fetch('/api/v1/company/components', { headers }).then(r => r.json()).then(d => { if (d?.success) setCompanyComponents(d.data); }).catch(() => {});
      }
      if (companyCategories.length === 0) {
        fetch('/api/v1/company/categories', { headers }).then(r => r.json()).then(d => { if (d?.success) setCompanyCategories(d.data); }).catch(() => {});
      }
    }
  }, [showRfqModal]);

  useEffect(() => {
    if (activeTab === 'company_chat') {
      setChatUnreadCount(0);
    }
  }, [activeTab]);

  // Real-time updates — apply payload immediately, then refresh from API
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!user || !companyId || !token) return;

    const unsub = onCentrifugoEvent((data) => {
      const isCompanyStatus =
        data?.type === 'company_status_changed' ||
        data?.eventType?.startsWith('company_');

      if (isCompanyStatus && data?.status) {
        companyRealtimePatchAtRef.current = Date.now();
        setUser((prev: any) => {
          if (!prev) return prev;
          const updated = patchUserCompany(prev, {
            status: data.status,
            ...(data.kycRejectReason !== undefined ? { kycRejectReason: data.kycRejectReason } : {}),
            ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
          });
          persistUser(updated);
          return updated;
        });
      }

      if (data?.eventType === 'chat_message') {
        setChatRealtimeEvent({ ...data, _at: Date.now() });
        if (isIncomingChatEvent(data, companyId)) {
          if (activeTab !== 'company_chat') {
            setChatUnreadCount((c) => c + 1);
          }
          if (data.message) {
            showToast(data.message, resolveToastType(data));
          }
        }
      } else {
        const isExcludedCompany =
          (data?.excludeCompanyId && data.excludeCompanyId === companyId) ||
          (data?.senderCompanyId && data.senderCompanyId === companyId);

        if (data?.message && !isExcludedCompany) {
          showToast(data.message, resolveToastType(data));
        }
        if (data?.notification && !isExcludedCompany) {
          setNotifications((prev) => {
            const notifSrcId = data.notification.meta?.sourceId || data.notification.meta?.rfqId;
            const alreadyExists = prev.some(
              (n) =>
                n.id === data.notification.id ||
                (notifSrcId && (n.meta?.sourceId === notifSrcId || n.meta?.rfqId === notifSrcId))
            );
            if (alreadyExists) return prev;
            return [data.notification, ...prev];
          });
          setUnreadNotificationsCount((c) => c + 1);
        }
        fetchNotifications(false);
        refreshCompanyProfile();
        if (fetchDataRef.current) fetchDataRef.current(true);
      }
    });

    // Setup Web Push Notifications
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.register('/sw.js').then((registration) => {
        Notification.requestPermission().then((permission) => {
          if (permission === 'granted') {
            const applicationServerKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
            registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey
            }).then((subscription) => {
              fetch('/api/v1/notifications/subscribe', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(subscription)
              }).catch(err => console.error('Failed to save push subscription', err));
            });
          }
        });
      });
    }

    return () => {
      unsub();
    };
  }, [companyId, activeTab]);

  const fetchAbortControllerRef = useRef<AbortController | null>(null);

  const fetchData = async (isBackground = false) => {
    if (fetchAbortControllerRef.current) {
      fetchAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    fetchAbortControllerRef.current = controller;

    if (!isBackground) setLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${localStorage.getItem('token')}` };
      const fetchOpts: RequestInit = { headers, cache: 'no-store', signal: controller.signal };

      await refreshCompanyProfile();

      const role = user?.role;

      if (activeTab === 'marketplace' && role !== 'TRANSPORTER' && role !== 'FINANCE' && mode !== 'buyer') {
        const res = await fetch(`/api/v1/marketplace/requirements?_t=${Date.now()}`, fetchOpts);
        const d = await res.json();
        if (d.success) setMarketplaceRfqs(d.data);
      }
      
      if (activeTab === 'my_rfqs' && role !== 'TRANSPORTER' && role !== 'FINANCE') {
        const res = await fetch(`/api/v1/rfqs?_t=${Date.now()}`, fetchOpts);
        const d = await res.json();
        if (d.success) setRfqs(d.data);
      }

      if (activeTab === 'orders' && role !== 'TRANSPORTER') {
        const resBuying = await fetch(`/api/v1/orders?type=buying&_t=${Date.now()}`, fetchOpts);
        const resSelling = await fetch(`/api/v1/orders?type=selling&_t=${Date.now()}`, fetchOpts);
        const dBuying = await resBuying.json();
        const dSelling = await resSelling.json();
        
        const combined = [
          ...(dBuying.data || []).map((o: any) => ({ ...o, flowType: 'Buying' })),
          ...(dSelling.data || []).map((o: any) => ({ ...o, flowType: 'Selling' }))
        ];
        setOrders(combined);
      }

      if (activeTab === 'admin' && user?.role === 'PLATFORM_ADMIN') {
        const res = await fetch(`/api/v1/admin/companies?_t=${Date.now()}`, fetchOpts);
        const d = await res.json();
        if (d.success) setAdminCompanies(d.data);
      }

      if (activeTab === 'transporter') {
        const res = await fetch(`/api/v1/transporter/deliveries?_t=${Date.now()}`, fetchOpts);
        const d = await res.json();
        if (d.success) setDeliveries(d.data);
      }

      if (
        activeTab === 'prs' &&
        role !== 'TRANSPORTER' &&
        role !== 'FINANCE'
      ) {
        const res = await fetch('/api/v1/prs', { headers });
        const d = await res.json();
        if (d.success) setPrs(d.data);
      }

      if (
        (activeTab === 'catalog' || activeTab === 'components') &&
        role !== 'TRANSPORTER' &&
        role !== 'FINANCE'
      ) {
        const res = await fetch('/api/v1/company/components', { headers });
        const d = await res.json();
        if (d.success) setCompanyComponents(d.data);
      }

      if (role !== 'TRANSPORTER') {
        const resCat = await fetch(`/api/v1/company/categories?_t=${Date.now()}`, fetchOpts);
        const dCat = await resCat.json();
        if (dCat?.success) setCompanyCategories(dCat.data || []);
      }

      if (activeTab === 'catalog') {
        const res = await fetch('/api/v1/catalog', { headers });
        const d = await res.json();
        if (d.success) setCatalogItems(d.data);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    router.push('/');
  };

  // RFQ Creation & Editing
  const handleEditRfq = (rfq: any) => {
    setEditingRfqId(rfq.id);
    setNewRfqTitle(rfq.title);
    setNewRfqDesc(rfq.description || '');
    setNewRfqCategory(rfq.category || '');
    if (rfq.bidEndAt) {
      setNewRfqBidEndAt(new Date(rfq.bidEndAt).toISOString().slice(0, 10));
    }
    setBuyerPrId(rfq.buyerPrId || '');
    setNewRfqItems(rfq.items.map((item: any) => ({
      componentName: item.componentName,
      quantity: item.quantity,
      unit: item.unit,
      drawingFileId: item.drawingFileId,
      hsnCode: item.hsnCode,
      materialOptionPreference: item.materialOptionPreference,
      expectedTimeDays: item.expectedTimeDays,
      drawingRevision: item.drawingRevision,
      specification: item.specification || ''
    })));
    setShowRfqModal(true);
  };

  const handleAddRfqItem = () => {
    setNewRfqItems([...newRfqItems, { componentName: '', quantity: 100, unit: 'pcs', drawingFileId: 'drawing_spec_' + Date.now() + '.pdf', hsnCode: '84799090', materialOptionPreference: 'WITH_MATERIAL', expectedTimeDays: 7 }]);
  };

  const handlePublishRfq = async () => {
    if (!newRfqTitle.trim()) {
      showToast('Please fill out the Requirement Title.', 'error');
      return;
    }
    if (!newRfqCategory.trim()) {
      showToast('Please fill out the Category.', 'error');
      return;
    }
    if (user?.company?.requirePr && !buyerPrId) {
      showToast('Your company requires an Approved Purchase Requisition to publish an RFQ.', 'error');
      return;
    }
    const selectedDate = new Date(newRfqBidEndAt);
    selectedDate.setHours(23, 59, 59, 999);
    if (!newRfqBidEndAt || selectedDate <= new Date()) {
      showToast('Please select a future Bidding End Date.', 'error');
      return;
    }
    for (let i = 0; i < newRfqItems.length; i++) {
      const item = newRfqItems[i];
      if (!item.componentName.trim()) {
        showToast(`Please fill out the Component Name for component #${i + 1}.`, 'error');
        return;
      }
      if (!item.quantity || Number(item.quantity) <= 0) {
        showToast(`Please enter a valid Quantity for component #${i + 1}.`, 'error');
        return;
      }
      if (!item.drawingFileId) {
        showToast(`Please upload a Drawing File for component #${i + 1}.`, 'error');
        return;
      }
      if (!item.expectedTimeDays || Number(item.expectedTimeDays) <= 0) {
        showToast(`Please enter a valid Lead Time for component #${i + 1}.`, 'error');
        return;
      }
    }

    withLoading('publishRfq', async () => {
      try {
        const headers = { 
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        };
        const bidEndAt = new Date(newRfqBidEndAt).toISOString();
        const method = editingRfqId ? 'PUT' : 'POST';
        const endpoint = editingRfqId ? `/api/v1/rfqs/${editingRfqId}` : '/api/v1/rfqs';
        
        const res = await fetch(endpoint, {
          method,
          headers,
          body: JSON.stringify({
            title: newRfqTitle,
            description: newRfqDesc,
            category: newRfqCategory,
            bidEndAt,
            items: newRfqItems,
            ...(buyerPrId ? { buyerPrId } : {})
          })
        });
        const d = await res.json();
        if (d.success) {
          showToast(`RFQ ${editingRfqId ? 'updated' : 'published'} successfully!`, 'success');
          setShowRfqModal(false);
          setEditingRfqId(null);
          setNewRfqTitle('');
          setNewRfqDesc('');
          setNewRfqItems([{ componentName: 'Bracket A', quantity: 500, unit: 'pcs', drawingFileId: 'drawing_bracket_a.pdf', hsnCode: '84799090', materialOptionPreference: 'WITH_MATERIAL', expectedTimeDays: 14 }]);
          fetchData();
        } else {
          showToast(d.message, 'error');
        }
      } catch (err) {
        showToast('Failed to publish RFQ', 'error');
      }
    });
  };

  const handleStartBidding = (rfq: any) => {
    setSelectedRfqForBidding(rfq);
    const initialInputs: any = {};
    rfq.items.forEach((item: any) => {
      const existingBid = item.bids?.[0];
      if (existingBid) {
        initialInputs[item.id] = {
          priceWith: existingBid.priceWithMaterial || 0,
          priceWithout: existingBid.priceWithoutMaterial || 0,
          leadTime: existingBid.estimatedTimeDays || 14
        };
      }
    });
    setBidInputs(initialInputs);
  };

  // Bidding
  const handleSubmitBid = async (rfqItemId: string) => {
    const item = selectedRfqForBidding.items.find((i: any) => i.id === rfqItemId);
    const input = bidInputs[rfqItemId];
    
    if (!item) return;

    if (item.materialOptionPreference === 'WITH_MATERIAL' && (!input || !input.priceWith)) {
      showToast('Please enter a quote price (With Material).', 'error');
      return;
    }

    if (item.materialOptionPreference === 'WITHOUT_MATERIAL' && (!input || !input.priceWithout)) {
      showToast('Please enter a quote price (Without Material).', 'error');
      return;
    }

    withLoading(`submitBid_${rfqItemId}`, async () => {
      try {
        const headers = { 
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        };
        const res = await fetch(`/api/v1/rfqs/${selectedRfqForBidding.id}/items/${rfqItemId}/bids`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            priceWithMaterial: item.materialOptionPreference === 'WITH_MATERIAL' ? input.priceWith : 0,
            priceWithoutMaterial: item.materialOptionPreference === 'WITHOUT_MATERIAL' ? input.priceWithout : 0,
            estimatedTimeDays: item.expectedTimeDays || 7, // accepts buyer's requested lead time automatically
            materialOptionPreference: item.materialOptionPreference
          })
        });
        const d = await res.json();
        if (d.success) {
          showToast('Bid submitted successfully for this component!', 'success');
          setSelectedRfqForBidding(null);
          fetchData();
        } else {
          showToast(d.message, 'error');
        }
      } catch (err) {
        showToast('Failed to submit bid', 'error');
      }
    });
  };

  const handleWithdrawBid = async (rfqItemId: string) => {
    if (!confirm('Are you sure you want to withdraw your quote for this component?')) return;
    withLoading(`withdrawBid_${rfqItemId}`, async () => {
      try {
        const headers = { 'Authorization': `Bearer ${localStorage.getItem('token')}` };
      const res = await fetch(`/api/v1/rfqs/${selectedRfqForBidding.id}/items/${rfqItemId}/bids`, {
        method: 'DELETE',
        headers,
      });
      const d = await res.json();
      if (d.success) {
        showToast('Bid quote withdrawn successfully!', 'success');
        
        // Remove from local inputs state
        const updatedInputs = { ...bidInputs };
        delete updatedInputs[rfqItemId];
        setBidInputs(updatedInputs);

        // Close bidding view and return to marketplace list
        setSelectedRfqForBidding(null);
        fetchData();
      } else {
        showToast(d.message, 'error');
      }
      } catch (err) {
        showToast('Failed to withdraw bid', 'error');
      }
    });
  };

  const handleViewRfqDetails = async (rfqId: string) => {
    try {
      const headers = { 'Authorization': `Bearer ${localStorage.getItem('token')}` };
      const res = await fetch(`/api/v1/rfqs/${rfqId}`, { headers });
      const d = await res.json();
      if (d.success) {
        setSelectedRfqForDetails(d.data);
      } else {
        showToast(d.message || 'Failed to load details', 'error');
      }
    } catch (err) {
      showToast('Failed to load RFQ details', 'error');
    }
  };

  // Compare & Select Winner
  const handleSelectWinner = async (rfqItemId: string, bidId: string) => {
    try {
      const item = selectedRfqForDetails?.items?.find((i: any) => i.id === rfqItemId);
      const headers = { 
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      };
      const res = await fetch(`/api/v1/rfqs/${selectedRfqForDetails.id}/select-bids`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          selections: [{ rfqItemId, bidId, materialOption: item?.materialOptionPreference || 'WITH_MATERIAL' }]
        })
      });
      const d = await res.json();
      if (d.success) {
        showToast('Supplier selected and Purchase Order generated!', 'success');
        handleViewRfqDetails(selectedRfqForDetails.id);
        fetchData();
      } else {
        showToast(d.message, 'error');
      }
    } catch (err) {
      showToast('Failed to select bid', 'error');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        const items = [...newRfqItems];
        items[idx].drawingFileId = data.data.filename;
        items[idx].drawingOriginalName = data.data.originalName || file.name;
        items[idx].isCad = data.data.isCad || file.name.toLowerCase().endsWith('.sldprt');
        setNewRfqItems(items);
        showToast(`${items[idx].isCad ? '3D CAD file' : 'Drawing'} "${file.name}" uploaded successfully!`, 'success');
      } else {
        showToast(data.message || 'File upload failed', 'error');
      }
    } catch (err) {
      showToast('Failed to upload file', 'error');
    }
  };

  // Admin Actions
  const handleVerifyCompany = async (companyId: string) => {
    try {
      const headers = { 'Authorization': `Bearer ${localStorage.getItem('token')}` };
      const res = await fetch(`/api/v1/admin/companies/${companyId}/verify`, {
        method: 'POST',
        headers
      });
      const d = await res.json();
      if (d.success) {
        showToast('Company verified successfully!', 'success');
        fetchData();
      }
    } catch (err) {
      showToast('Failed to verify company', 'error');
    }
  };

  // Order Actions
  const handleStartProcessing = async (orderId: string, workImageId: string) => {
    try {
      const headers = { 
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      };
      const res = await fetch(`/api/v1/orders/${orderId}/start-processing`, { 
        method: 'POST', 
        headers,
        body: JSON.stringify({ workImageId })
      });
      const d = await res.json();
      if (d.success) {
        showToast('Order status progressed successfully', 'success');
        fetchData();
      } else {
        showToast(d.message || 'Action failed', 'error');
      }
    } catch (err) {
      showToast('Action failed', 'error');
    }
  };

  const handleReadyForPickup = async (orderId: string, workImageId: string) => {
    try {
      const headers = { 
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      };
      const res = await fetch(`/api/v1/orders/${orderId}/ready-for-pickup`, { 
        method: 'POST', 
        headers,
        body: JSON.stringify({ workImageId })
      });
      const d = await res.json();
      if (d.success) {
        const pickupOtp = d.data?.pickupOtp;
        showToast(
          pickupOtp
            ? `Ready for pickup! Share Pickup OTP ${pickupOtp} with the transporter.`
            : 'Order status: READY FOR PICKUP. Delivery generated.',
          'success'
        );
        fetchData();
      } else {
        showToast(d.message || 'Action failed', 'error');
      }
    } catch (err) {
      showToast('Action failed', 'error');
    }
  };

  const handleConfirmDelivery = async (orderId: string) => {
    try {
      const headers = {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json',
      };
      const res = await fetch(`/api/v1/orders/${orderId}/confirm-delivery`, {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      });
      const raw = await res.text();
      let d: any;
      try {
        d = raw ? JSON.parse(raw) : null;
      } catch {
        showToast('Server error while confirming GRN', 'error');
        return;
      }
      if (d?.success) {
        showToast(d.message || 'Delivery confirmed. Order completed.', 'success');
        fetchData();
      } else {
        showToast(d?.message || 'Failed to confirm delivery (GRN)', 'error');
      }
    } catch (err) {
      showToast('Failed to confirm delivery (GRN)', 'error');
    }
  };

  // Transporter Actions
  const handleUpdateDeliveryStatus = async (deliveryId: string, nextStatus: string) => {
    try {
      const headers = { 
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      };
      const res = await fetch(`/api/v1/transporter/deliveries/${deliveryId}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ status: nextStatus })
      });
      const d = await res.json();
      if (d.success) {
        showToast(`Status updated to ${nextStatus}`, 'success');
        fetchData();
        return true;
      }
      showToast(d.message || 'Failed to update delivery', 'error');
      return false;
    } catch (err) {
      showToast('Failed to update delivery', 'error');
      return false;
    }
  };

  const handleVerifyDeliveryOtp = async (
    deliveryId: string,
    otp: string,
    type: 'PICKUP' | 'DELIVERY',
    podFileId?: string
  ): Promise<boolean> => {
    try {
      const headers = {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json',
      };
      const res = await fetch(`/api/v1/transporter/deliveries/${deliveryId}/verify-otp`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ otp, type, podFileId }),
      });
      const d = await res.json();
      if (d.success) {
        showToast(d.message || (type === 'PICKUP' ? 'Pickup verified!' : 'Delivery verified!'), 'success');
        fetchData();
        return true;
      }
      showToast(d.message || 'OTP verification failed', 'error');
      return false;
    } catch {
      showToast('OTP verification failed', 'error');
      return false;
    }
  };

  if (checkingAuth || !user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  const isBuyer = mode === 'buyer';
  const activeSidebarTabClass = isBuyer
    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
  const activeMobileTabClass = isBuyer ? 'text-blue-600' : 'text-emerald-600';
  const activeMobileIndicatorClass = isBuyer ? 'bg-blue-600' : 'bg-emerald-600';
  const badgeClass = isBuyer ? 'bg-blue-600' : 'bg-emerald-600';

  return (
    <div className="flex-1 flex flex-col md:flex-row h-dvh max-h-dvh overflow-hidden relative">
      {/* Mobile Top Header */}
      <div className="md:hidden bg-[#F8FAFC] px-4 py-3 flex flex-col space-y-4 z-40 shrink-0 pt-safe">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center space-x-2 min-w-0 flex-1">
            <img src="/logo.jpeg" alt="Company Logo" className="w-8 h-8 shrink-0 object-cover rounded-lg shadow-xs border border-slate-200/60" />
            <span className="font-extrabold text-[13px] text-[#001D4A] uppercase tracking-wider min-w-0 truncate">
              {user?.company?.name || 'Company'}
            </span>
            {user?.company?.isActive !== false ? (
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[9px] font-bold shrink-0 flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div> ACTIVE
              </span>
            ) : (
              <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-[9px] font-bold shrink-0 flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div> INACTIVE
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isImpersonating && (
              <button
                type="button"
                onClick={handleExitImpersonation}
                className="flex items-center gap-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-2 py-1 rounded-full text-[10px] font-extrabold shadow-sm transition-all cursor-pointer active:scale-95 shrink-0"
                title={`Exit impersonation of ${impersonatedCompany?.name || user?.company?.name || 'Company'}`}
              >
                <UserCheck className="w-3.5 h-3.5 animate-pulse" />
                <span>Exit</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setIsNotificationOpen(true);
                if (notifications.length === 0) {
                  fetchNotifications(true);
                }
              }}
              className="relative p-1.5 text-slate-600 hover:text-[#001D4A] rounded-full transition-all cursor-pointer shrink-0"
              title="Activity Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-rose-600 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1 border-2 border-white shadow-sm animate-pulse">
                  {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setMode(mode === 'buyer' ? 'seller' : 'buyer')}
              className={`flex items-center justify-center p-2 rounded-full transition-all border ${
                mode === 'buyer' 
                  ? 'bg-blue-600 text-white border-blue-700 shadow-sm' 
                  : 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
              }`}
              title={mode === 'buyer' ? 'Switch to Seller (Supply) Mode' : 'Switch to Buyer (Procure) Mode'}
            >
              {mode === 'buyer' ? (
                <ShoppingCart className="w-4 h-4" />
              ) : (
                <Truck className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {showMobileSidebar && (
        <div 
          className="md:hidden fixed inset-0 bg-black/60 z-[60] backdrop-blur-sm" 
          onClick={() => setShowMobileSidebar(false)}
        />
      )}

      {/* Sidebar Navigation (Desktop & Mobile) */}
      <div className={`fixed inset-y-0 left-0 z-[70] transform transition-transform duration-300 md:relative md:translate-x-0 w-64 glass-panel border-r border-white/5 flex flex-col justify-between p-6 bg-slate-950 shadow-2xl md:shadow-none ${showMobileSidebar ? 'translate-x-0' : '-translate-x-full'}`}>
        <div>
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center space-x-3">
              <img src="/logo.jpeg" alt="Company Logo" className="w-8 h-8 shrink-0 object-cover rounded-lg shadow-xs border border-white/10" />
              <div>
                <h2 className="font-extrabold text-sm tracking-tight text-white flex items-center gap-1.5">
                  {user.company?.name || 'Platform Admin'}
                  {user.company && (user.company.isActive !== false ? (
                    <span className="px-1.5 py-0.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded text-[9px] font-bold">ACTIVE</span>
                  ) : (
                    <span className="px-1.5 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded text-[9px] font-bold">INACTIVE</span>
                  ))}
                </h2>
                <span className={`text-[10px] ${isBuyer ? 'text-blue-400' : 'text-emerald-400'} font-semibold uppercase`}>{user.role}</span>
              </div>
            </div>
            {/* Close Button for Mobile */}
            <button onClick={() => setShowMobileSidebar(false)} className="md:hidden p-1 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-1">
            {user.role !== 'TRANSPORTER' && (
              <>
                {!isBuyer && (
                  <button
                    onClick={() => handleTabChange('marketplace')}
                    className={`w-full text-left py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center space-x-2.5 transition-all ${activeTab === 'marketplace' ? activeSidebarTabClass : 'text-slate-400 hover:text-white'}`}
                  >
                    <Search className="w-4 h-4" />
                    <span>Public Marketplace</span>
                  </button>
                )}

                <button
                  onClick={() => handleTabChange('catalog')}
                  className={`w-full text-left py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center space-x-2.5 transition-all ${activeTab === 'catalog' ? activeSidebarTabClass : 'text-slate-400 hover:text-white'}`}
                >
                  {isBuyer ? <ShoppingCart className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                  <span>{isBuyer ? 'Internal Components' : 'Standard Catalog'}</span>
                </button>

                {!isBuyer && user.role !== 'FINANCE' && (
                  <button
                    onClick={() => handleTabChange('my_rfqs')}
                    className={`w-full text-left py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center space-x-2.5 transition-all ${activeTab === 'my_rfqs' ? activeSidebarTabClass : 'text-slate-400 hover:text-white'}`}
                  >
                    <FileText className="w-4 h-4" />
                    <span>My Submitted Bids</span>
                  </button>
                )}
                
                {isBuyer && user.role !== 'PLATFORM_ADMIN' && (
                  <>
                    <button
                      onClick={() => handleTabChange('prs')}
                      className={`w-full text-left py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center space-x-2.5 transition-all ${activeTab === 'prs' ? activeSidebarTabClass : 'text-slate-400 hover:text-white'}`}
                    >
                      <FileText className="w-4 h-4" />
                      <span>Purchase Requisitions</span>
                    </button>
                    {user.role !== 'FINANCE' && (
                      <button
                        onClick={() => handleTabChange('my_rfqs')}
                        className={`w-full text-left py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center space-x-2.5 transition-all ${activeTab === 'my_rfqs' ? activeSidebarTabClass : 'text-slate-400 hover:text-white'}`}
                      >
                        <FileText className="w-4 h-4" />
                        <span>My Requirements</span>
                      </button>
                    )}
                  </>
                )}

                <button
                  onClick={() => handleTabChange('orders')}
                  className={`w-full text-left py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center space-x-2.5 transition-all ${activeTab === 'orders' ? activeSidebarTabClass : 'text-slate-400 hover:text-white'}`}
                >
                  {isBuyer ? <ShoppingCart className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                  <span>{isBuyer ? 'Purchase Orders' : 'Sales Orders'}</span>
                </button>

                {user.role !== 'PLATFORM_ADMIN' && user.role !== 'TRANSPORTER' && (
                  <button
                    onClick={() => handleTabChange('company_chat')}
                    className={`w-full text-left py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center space-x-2.5 transition-all ${activeTab === 'company_chat' ? activeSidebarTabClass : 'text-slate-400 hover:text-white'}`}
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span className="flex-1">Company Chat</span>
                    {chatUnreadCount > 0 && (
                      <span className={`min-w-[1.25rem] h-5 px-1.5 rounded-full ${badgeClass} text-white text-[10px] font-bold flex items-center justify-center`}>
                        {chatUnreadCount > 9 ? '9+' : chatUnreadCount}
                      </span>
                    )}
                  </button>
                )}
              </>
            )}

            {(user.role === 'PLATFORM_ADMIN' || user.role === 'TRANSPORTER') && (
              <button
                onClick={() => handleTabChange('transporter')}
                className={`w-full text-left py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center space-x-2.5 transition-all ${activeTab === 'transporter' ? activeSidebarTabClass : 'text-slate-400 hover:text-white'}`}
              >
                <Truck className="w-4 h-4" />
                <span>Local Delivery Portal</span>
              </button>
            )}

            <button
              onClick={() => handleTabChange('profile')}
              className={`w-full text-left py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center space-x-2.5 transition-all ${activeTab === 'profile' ? activeSidebarTabClass : 'text-slate-400 hover:text-white'}`}
            >
              <User className="w-4 h-4" />
              <span>Profile Settings</span>
            </button>

            {user.role === 'PLATFORM_ADMIN' && (
              <button
                onClick={() => handleTabChange('admin')}
                className={`w-full text-left py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center space-x-2.5 transition-all ${activeTab === 'admin' ? activeSidebarTabClass : 'text-slate-400 hover:text-white'}`}
              >
                <Users className="w-4 h-4" />
                <span>Platform Admin</span>
              </button>
            )}
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full text-left py-2.5 px-4 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-500/10 transition-all flex items-center space-x-2.5"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-y-auto bg-[#F8FAFC] md:bg-slate-950 px-5 pt-4 pb-24 md:p-10 min-h-0 relative">
        
        {/* Top Header Bar for Desktop */}
        <div className="hidden md:flex justify-between items-center pb-6 border-b border-white/5 mb-6">
          <div>
            <h2 className="text-xl font-bold text-white">Dashboard Portal</h2>
            <p className="text-xs text-slate-400">Manage your requirements, quotes, and manufacturing milestones.</p>
          </div>

          <div className="flex items-center gap-3">
            {isImpersonating && (
              <div className="flex items-center gap-2 bg-purple-500/15 border border-purple-500/40 text-purple-200 px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-xs">
                <UserCheck className="w-4 h-4 text-purple-300 animate-pulse" />
                <span>Impersonating: <strong className="text-white">{impersonatedCompany?.name || user?.company?.name || 'Company'}</strong></span>
                <button
                  type="button"
                  onClick={handleExitImpersonation}
                  className="ml-2 px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[10px] uppercase tracking-wider font-extrabold cursor-pointer transition-all shadow-2xs active:scale-95"
                  title="Exit impersonation and return to Admin"
                >
                  Exit ✕
                </button>
              </div>
            )}

            {/* Global Mode Switcher in Header */}
            {user.role !== 'TRANSPORTER' && user.role !== 'PLATFORM_ADMIN' && (
              <div className="bg-slate-900 border border-white/5 p-1 rounded-xl flex w-64">
                <button
                  onClick={() => setMode('buyer')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold text-center transition-all ${mode === 'buyer' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Procure Mode
                </button>
                <button
                  onClick={() => setMode('seller')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold text-center transition-all ${mode === 'seller' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Supply Mode
                </button>
              </div>
            )}

            {/* Desktop Notification Bell */}
            <button
              type="button"
              onClick={() => {
                setIsNotificationOpen(true);
                if (notifications.length === 0) {
                  fetchNotifications(true);
                }
              }}
              className="relative p-2 text-slate-300 hover:text-white bg-slate-900 border border-white/10 hover:border-white/20 rounded-xl transition-all cursor-pointer flex items-center justify-center shadow-xs shrink-0 hover:bg-white/5 active:scale-95"
              title="Activity Notifications"
            >
              <Bell className="w-4 h-4 text-slate-300" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[19px] h-[19px] bg-rose-600 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1 border-2 border-slate-950 shadow-sm animate-pulse">
                  {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {msg.text && (
          <div className={`p-4 mb-6 rounded-xl border text-sm flex items-center justify-between ${msg.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
            <span>{msg.text}</span>
            <button onClick={() => setMsg({ type: '', text: '' })} className="font-bold">&times;</button>
          </div>
        )}

        
        <DashboardContext.Provider value={{ 
  marketplaceRfqs, selectedRfqForBidding, setSelectedRfqForBidding, bidInputs, setBidInputs, handleStartBidding, handleSubmitBid, handleWithdrawBid, fetchDataRef, mode, setMode, user, setUser, handleVerifyCompany, handleTabChange, setSelectedRfqForDetails, submittingActions, companyComponents, companyCategories, showToast, rfqs, selectedRfqForDetails, setShowRfqModal, handleEditRfq, handleSelectWinner, handleViewRfqDetails, orders, deliveries, adminCompanies, adminUsers, adminPayments, adminInvoices, refreshCompanyProfile, catalogItems, prs, chatRealtimeEvent, setPrs, setOrders, setDeliveries, setCatalogItems, handleImpersonateCompany, handleExitImpersonation, isImpersonating, impersonatedCompany
   }}>
          {children}
        </DashboardContext.Provider>

      </div>

      {/* Bottom Navigation Bar (Mobile) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 flex justify-between items-center px-2 py-2 pb-safe z-50 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.05)]">
        {/* Tab 1: Market (Seller Only) */}
        {!isBuyer && (
          <button onClick={() => handleTabChange('marketplace')} className={`flex flex-col items-center gap-0.5 flex-1 outline-none focus:outline-none focus:ring-0 select-none ${activeTab === 'marketplace' ? activeMobileTabClass : 'text-slate-400'}`}>
            <Search className="w-5 h-5" />
            <span className="text-[9px] font-semibold">Market</span>
            {activeTab === 'marketplace' ? <div className={`w-5 h-0.5 ${activeMobileIndicatorClass} rounded-full mt-0.5`}></div> : <div className="w-5 h-0.5 bg-transparent mt-0.5"></div>}
          </button>
        )}

        {/* Tab 2: PRs (Buyer Only - Purchase Requisitions) */}
        {isBuyer && (
          <button onClick={() => handleTabChange('prs')} className={`flex flex-col items-center gap-0.5 flex-1 outline-none focus:outline-none focus:ring-0 select-none ${activeTab === 'prs' ? activeMobileTabClass : 'text-slate-400'}`}>
            <ClipboardList className="w-5 h-5" />
            <span className="text-[9px] font-semibold">PRs</span>
            {activeTab === 'prs' ? <div className={`w-5 h-0.5 ${activeMobileIndicatorClass} rounded-full mt-0.5`}></div> : <div className="w-5 h-0.5 bg-transparent mt-0.5"></div>}
          </button>
        )}

        {/* Tab 3: RFQs (Buyer) / Bids (Seller) */}
        <button onClick={() => handleTabChange('my_rfqs')} className={`flex flex-col items-center gap-0.5 flex-1 outline-none focus:outline-none focus:ring-0 select-none ${activeTab === 'my_rfqs' ? activeMobileTabClass : 'text-slate-400'}`}>
          <FileText className="w-5 h-5" />
          <span className="text-[9px] font-semibold">{isBuyer ? 'RFQs' : 'Bids'}</span>
          {activeTab === 'my_rfqs' ? <div className={`w-5 h-0.5 ${activeMobileIndicatorClass} rounded-full mt-0.5`}></div> : <div className="w-5 h-0.5 bg-transparent mt-0.5"></div>}
        </button>

        {/* Tab 4: Orders (Both - ShoppingCart for Buyer, Package for Seller) */}
        <button onClick={() => handleTabChange('orders')} className={`flex flex-col items-center gap-0.5 flex-1 outline-none focus:outline-none focus:ring-0 select-none ${activeTab === 'orders' ? activeMobileTabClass : 'text-slate-400'}`}>
          {isBuyer ? <ShoppingCart className="w-5 h-5" /> : <Package className="w-5 h-5" />}
          <span className="text-[9px] font-semibold">Orders</span>
          {activeTab === 'orders' ? <div className={`w-5 h-0.5 ${activeMobileIndicatorClass} rounded-full mt-0.5`}></div> : <div className="w-5 h-0.5 bg-transparent mt-0.5"></div>}
        </button>

        {/* Tab 5: Chat (Both) */}
        <button onClick={() => handleTabChange('company_chat')} className={`flex flex-col items-center gap-0.5 flex-1 relative outline-none focus:outline-none focus:ring-0 select-none ${activeTab === 'company_chat' ? activeMobileTabClass : 'text-slate-400'}`}>
          <MessageSquare className="w-5 h-5" />
          {chatUnreadCount > 0 && <span className="absolute 0 right-3 w-2.5 h-2.5 bg-red-500 rounded-full border border-white"></span>}
          <span className="text-[9px] font-semibold">Chat</span>
          {activeTab === 'company_chat' ? <div className={`w-5 h-0.5 ${activeMobileIndicatorClass} rounded-full mt-0.5`}></div> : <div className="w-5 h-0.5 bg-transparent mt-0.5"></div>}
        </button>

        {/* Tab 6: Profile (Both) */}
        <button onClick={() => handleTabChange('profile')} className={`flex flex-col items-center gap-0.5 flex-1 outline-none focus:outline-none focus:ring-0 select-none ${activeTab === 'profile' ? activeMobileTabClass : 'text-slate-400'}`}>
          <User className="w-5 h-5" />
          <span className="text-[9px] font-semibold">Profile</span>
          {activeTab === 'profile' ? <div className={`w-5 h-0.5 ${activeMobileIndicatorClass} rounded-full mt-0.5`}></div> : <div className="w-5 h-0.5 bg-transparent mt-0.5"></div>}
        </button>
      </div>

      {/* Publish RFQ Modal */}
      {showRfqModal && (
        <div className="fixed inset-0 bg-white/40 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl p-6 flex flex-col max-h-[90vh] shadow-2xl">
            <h3 className="text-lg font-bold text-[var(--text-title)] mb-4">{editingRfqId ? 'Edit B2B Procurement Requirement' : 'Create B2B Procurement Requirement'}</h3>
            
            <div className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar">
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl mb-2">
                <label className="text-[10px] text-yellow-700 font-bold uppercase tracking-wider block mb-2">
                  {user?.company?.requirePr ? 'Approved Purchase Requisition Required ' : 'Link Purchase Requisition (Optional) '}
                  {user?.company?.requirePr && <span className="text-red-500">*</span>}
                </label>
                <select
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-[var(--text-normal)] focus:outline-none"
                  value={buyerPrId}
                  required={user?.company?.requirePr}
                  onChange={(e) => {
                    const selectedPrId = e.target.value;
                    setBuyerPrId(selectedPrId);
                    if (selectedPrId) {
                      const pr = prs.find(p => p.id === selectedPrId);
                      if (pr) {
                        setNewRfqTitle(pr.title || '');
                        setNewRfqDesc(pr.description || '');
                        if (pr.lines && pr.lines.length > 0) {
                          setNewRfqItems(pr.lines.map((line: any) => ({
                            componentName: line.componentName,
                            quantity: line.quantity,
                            unit: line.unit || 'pcs',
                            drawingFileId: '',
                            hsnCode: '84799090',
                            materialOptionPreference: 'WITH_MATERIAL',
                            expectedTimeDays: 7,
                            drawingRevision: 'v1',
                            specification: ''
                          })));
                        }
                      }
                    }
                  }}
                >
                  <option value="">Select an Approved PR...</option>
                  {prs.filter(pr => pr.status === 'APPROVED').map(pr => (
                    <option key={pr.id} value={pr.id}>{pr.prNumber} - {pr.title}</option>
                  ))}
                </select>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-[var(--text-subtitle)] font-bold uppercase tracking-wider block">Requirement Title <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    placeholder="e.g. Gearbox Component Castings"
                    value={newRfqTitle}
                    onChange={(e) => setNewRfqTitle(e.target.value)}
                    disabled={!!buyerPrId}
                    className={`w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-[var(--text-normal)] focus:outline-none ${buyerPrId ? 'opacity-50 cursor-not-allowed' : ''}`}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-[var(--text-subtitle)] font-bold uppercase tracking-wider block">Category <span className="text-red-500">*</span></label>
                  <select
                    required
                    value={newRfqCategory}
                    onChange={(e) => setNewRfqCategory(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-[var(--text-normal)] focus:outline-none"
                  >
                    <option value="" disabled>Select category...</option>
                    {companyCategories.map(c => (
                      <option key={c.id} value={c.categoryName}>{c.categoryName}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-[var(--text-subtitle)] font-bold uppercase tracking-wider block">Bidding End Date <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={newRfqBidEndAt}
                    onClick={(e) => (e.target as any).showPicker?.()}
                    onChange={(e) => setNewRfqBidEndAt(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-[var(--text-normal)] focus:outline-none cursor-pointer"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-[var(--text-subtitle)] font-bold uppercase tracking-wider block">Description (Optional)</label>
                <textarea
                  placeholder="Description of specifications and standards required..."
                  value={newRfqDesc}
                  onChange={(e) => setNewRfqDesc(e.target.value)}
                  disabled={!!buyerPrId}
                  className={`w-full h-24 bg-white border border-slate-200 rounded-xl p-4 text-sm text-[var(--text-normal)] focus:outline-none resize-none ${buyerPrId ? 'opacity-50 cursor-not-allowed' : ''}`}
                />
              </div>

              <div className="border-t border-slate-100 pt-4 space-y-3">
                <h4 className="text-xs font-bold uppercase text-[var(--text-subtitle)]">RFQ Items (Components)</h4>
                {newRfqItems.map((item, idx) => (
                  <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                      <div className="col-span-1 sm:col-span-2 space-y-1">
                        <label className="text-[10px] text-[var(--text-subtitle)] font-bold uppercase tracking-wider block">Component Name <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          placeholder="e.g. Bracket A"
                          value={item.componentName}
                          onChange={(e) => {
                            const items = [...newRfqItems];
                            items[idx].componentName = e.target.value;
                            setNewRfqItems(items);
                          }}
                          disabled={!!buyerPrId}
                          className={`w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-normal)] ${buyerPrId ? 'opacity-50 cursor-not-allowed' : ''}`}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-[var(--text-subtitle)] font-bold uppercase tracking-wider block">Quantity <span className="text-red-500">*</span></label>
                        <input
                          type="number"
                          placeholder="e.g. 500"
                          value={item.quantity}
                          onChange={(e) => {
                            const items = [...newRfqItems];
                            items[idx].quantity = Number(e.target.value);
                            setNewRfqItems(items);
                          }}
                          disabled={!!buyerPrId}
                          className={`w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-normal)] ${buyerPrId ? 'opacity-50 cursor-not-allowed' : ''}`}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-[var(--text-subtitle)] font-bold uppercase tracking-wider block">Drawing / 3D CAD File <span className="text-red-500">*</span></label>
                        <label className="cursor-pointer bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-center hover:bg-white hover:border-blue-500/30 transition-all text-[11px] font-semibold text-blue-500 block truncate max-w-full">
                          {item.drawingFileId ? (
                            <span className="flex items-center justify-center gap-1">
                              {item.isCad || item.drawingOriginalName?.toLowerCase().endsWith('.sldprt') ? (
                                <span className="text-emerald-600 font-bold truncate">📦 {item.drawingOriginalName || 'SolidWorks (.sldprt)'}</span>
                              ) : (
                                <span className="truncate">📄 {item.drawingOriginalName || (item.drawingFileId.length > 15 ? item.drawingFileId.substring(0, 12) + '...' : item.drawingFileId)}</span>
                              )}
                            </span>
                          ) : (
                            <span className="text-slate-500">📎 Upload (.pdf, .sldprt, .step)</span>
                          )}
                          <input
                            type="file"
                            accept=".pdf,.png,.jpg,.jpeg,.sldprt,.step,.stp,.iges,.igs,.dxf,.dwg,.sldasm"
                            onChange={(e) => handleFileUpload(e, idx)}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end pt-1">
                      <div className="space-y-1">
                        <label className="text-[10px] text-[var(--text-subtitle)] font-bold uppercase tracking-wider block">Material Sourcing Option <span className="text-red-500">*</span></label>
                        <select
                          value={item.materialOptionPreference}
                          onChange={(e) => {
                            const items = [...newRfqItems];
                            items[idx].materialOptionPreference = e.target.value;
                            setNewRfqItems(items);
                          }}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-[var(--text-normal)] focus:outline-none"
                        >
                          <option value="WITH_MATERIAL">With Material</option>
                          <option value="WITHOUT_MATERIAL">Without Material</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-[var(--text-subtitle)] font-bold uppercase tracking-wider block">Lead Time (Days) <span className="text-red-500">*</span></label>
                        <input
                          type="number"
                          placeholder="e.g. 14"
                          value={item.expectedTimeDays || ''}
                          onChange={(e) => {
                            const items = [...newRfqItems];
                            items[idx].expectedTimeDays = Number(e.target.value);
                            setNewRfqItems(items);
                          }}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-normal)] focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-[var(--text-subtitle)] font-bold uppercase tracking-wider block">HSN Code <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          placeholder="e.g. 84799090"
                          value={item.hsnCode || ''}
                          onChange={(e) => {
                            const items = [...newRfqItems];
                            items[idx].hsnCode = e.target.value;
                            setNewRfqItems(items);
                          }}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-normal)] focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                {!buyerPrId && (
                  <button onClick={handleAddRfqItem} className="text-xs text-blue-400 font-semibold hover:underline">+ Add Component</button>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-4">
              <button onClick={() => { setShowRfqModal(false); setEditingRfqId(null); }} className="px-5 py-2 text-[var(--text-normal)] hover:text-[var(--text-title)] text-xs font-semibold" disabled={submittingActions['publishRfq']}>Cancel</button>
              <button 
                onClick={handlePublishRfq} 
                disabled={submittingActions['publishRfq']}
                className="px-5 py-2 bg-[var(--buyer-primary)] hover:opacity-90 text-white rounded-xl text-xs font-semibold flex items-center justify-center min-w-[140px]"
              >
                {submittingActions['publishRfq'] ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  editingRfqId ? 'Save Changes' : 'Publish Requirement'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Container */}
      <div className="fixed top-16 left-4 right-4 md:top-5 md:right-5 md:left-auto z-[60] flex flex-col gap-2 pointer-events-none max-w-sm md:max-w-md">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-2.5 px-4.5 py-3 rounded-xl border shadow-xl text-xs font-semibold animate-slide-in transition-all duration-300 ${
              t.type === 'success'
                ? 'bg-green-950/90 border-green-500/30 text-green-200 shadow-green-950/20'
                : t.type === 'error'
                ? 'bg-red-950/90 border-red-500/30 text-red-200 shadow-red-950/20'
                : 'bg-slate-900/90 border-white/10 text-slate-200 shadow-slate-950/20'
            }`}
          >
            <span>{t.text}</span>
          </div>
        ))}
      </div>

      {/* Activity Notification Center */}
      <NotificationCenter
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
        notifications={notifications}
        unreadCount={unreadNotificationsCount}
        onMarkAllRead={handleMarkAllNotificationsRead}
        onMarkRead={handleMarkNotificationRead}
        onNavigate={(tab) => handleTabChange(tab)}
        loading={loadingNotifications}
      />

      <style jsx global>{`
        @keyframes toastSlideIn {
          from { transform: translateY(-1rem); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-in {
          animation: toastSlideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
}
