'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { 
  Building, LogOut, CheckCircle, Clock, ShoppingCart, 
  Plus, Users, FileText, ChevronRight, Truck, Info,
  Search, ShieldAlert, Star, RefreshCw, ArrowLeft,
  Menu, X, User, Loader2
} from 'lucide-react';

import MarketplaceTab from '../components/MarketplaceTab';
import MyRequirementsTab from '../components/MyRequirementsTab';
import PurchaseOrdersTab from '../components/PurchaseOrdersTab';
import LocalDeliveryTab from '../components/LocalDeliveryTab';
import AdminTab from '../components/AdminTab';
import AdminUsersTab from '../components/AdminUsersTab';
import StandardCatalogTab from '../components/StandardCatalogTab';
import ProfileTab from '../components/ProfileTab';
import RequisitionsTab from '../components/RequisitionsTab';
import CatalogTab from '../components/CatalogTab';

export default function Dashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

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
  else if (tabName) activeTab = tabName;

  const handleTabChange = (tab: string) => {
    let route = '/marketplace';
    if (tab === 'my_rfqs') route = '/rfqs';
    else if (tab === 'transporter') route = '/delivery';
    else if (tab !== 'marketplace') route = `/${tab}`;
    router.push(route);
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

  const withLoading = async (actionId: string, fn: () => Promise<void>) => {
    setSubmittingActions(prev => ({ ...prev, [actionId]: true }));
    try {
      await fn();
    } finally {
      setSubmittingActions(prev => ({ ...prev, [actionId]: false }));
    }
  };
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [mode, setMode] = useState<'buyer' | 'seller'>('buyer');

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const res = await originalFetch(...args);
      if (res.status === 401) {
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
      router.push('/');
    } else {
      const parsed = JSON.parse(storedUser);
      setUser(parsed);
      setCheckingAuth(false);
      // Fetch live company status
      const headers = { 'Authorization': `Bearer ${token}` };
      fetch('/api/v1/company/me', { headers })
        .then(res => res.json())
        .then(d => {
          if (d.success && d.data) {
            const updatedUser = { ...parsed, company: d.data };
            setUser(updatedUser);
            localStorage.setItem('user', JSON.stringify(updatedUser));
          }
        })
        .catch(err => console.error(err));
    }
  }, [router]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user?.company?.status, activeTab, mode]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${localStorage.getItem('token')}` };
      
      // Pull live company details to keep UI state in sync
      if (user?.companyId) {
        try {
          const resCompany = await fetch('/api/v1/company/me', { headers });
          const dCompany = await resCompany.json();
          if (dCompany.success && dCompany.data) {
            setUser((prev: any) => {
              if (!prev) return prev;
              const updated = { ...prev, company: dCompany.data };
              localStorage.setItem('user', JSON.stringify(updated));
              return updated;
            });
          }
        } catch (e) {
          console.error(e);
        }
      }

      if (activeTab === 'marketplace') {
        const res = await fetch('/api/v1/marketplace/requirements', { headers });
        const d = await res.json();
        if (d.success) setMarketplaceRfqs(d.data);
      }
      
      if (activeTab === 'my_rfqs') {
        const res = await fetch('/api/v1/rfqs', { headers });
        const d = await res.json();
        if (d.success) setRfqs(d.data);
      }

      if (activeTab === 'orders') {
        const resBuying = await fetch('/api/v1/orders?type=buying', { headers });
        const resSelling = await fetch('/api/v1/orders?type=selling', { headers });
        const dBuying = await resBuying.json();
        const dSelling = await resSelling.json();
        
        const combined = [
          ...(dBuying.data || []).map((o: any) => ({ ...o, flowType: 'Buying' })),
          ...(dSelling.data || []).map((o: any) => ({ ...o, flowType: 'Selling' }))
        ];
        setOrders(combined);
      }

      if (activeTab === 'admin' && user?.role === 'PLATFORM_ADMIN') {
        const res = await fetch('/api/v1/admin/companies', { headers });
        const d = await res.json();
        if (d.success) setAdminCompanies(d.data);

        const resPay = await fetch('/api/v1/admin/payments', { headers });
        const dPay = await resPay.json();
        if (dPay.success) setAdminPayments(dPay.data);
      }

      if (activeTab === 'admin_users' && user?.role === 'PLATFORM_ADMIN') {
        const res = await fetch('/api/v1/admin/users', { headers });
        const d = await res.json();
        if (d.success) setAdminUsers(d.data);
      }

      if (activeTab === 'transporter') {
        const res = await fetch('/api/v1/transporter/deliveries', { headers });
        const d = await res.json();
        if (d.success) setDeliveries(d.data);
      }

      if (activeTab === 'prs' || activeTab === 'marketplace' || activeTab === 'my_rfqs') {
        const res = await fetch('/api/v1/prs', { headers });
        const d = await res.json();
        if (d.success) setPrs(d.data);
      }

      if (activeTab === 'prs' || activeTab === 'catalog' || activeTab === 'marketplace' || activeTab === 'my_rfqs') {
        const res = await fetch('/api/v1/company/components', { headers });
        const d = await res.json();
        if (d.success) setCompanyComponents(d.data);

        const resCat = await fetch('/api/v1/company/categories', { headers });
        const dCat = await resCat.json();
        if (dCat.success) setCompanyCategories(dCat.data);
      }

      if (activeTab === 'catalog') {
        const res = await fetch('/api/v1/catalog', { headers });
        const d = await res.json();
        if (d.success) setCatalogItems(d.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
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
        setNewRfqItems(items);
        showToast(`Drawing "${file.name}" uploaded successfully!`, 'success');
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
        showToast('Order status: READY FOR PICKUP. Delivery generated.', 'success');
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
      const headers = { 'Authorization': `Bearer ${localStorage.getItem('token')}` };
      const res = await fetch(`/api/v1/orders/${orderId}/confirm-delivery`, { method: 'POST', headers });
      const d = await res.json();
      if (d.success) {
        showToast('Delivery confirmed. Order completed.', 'success');
        fetchData();
      }
    } catch (err) {
      showToast('Action failed', 'error');
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
        showToast(`Status updated to ${nextStatus}`, 'error');
        fetchData();
      }
    } catch (err) {
      showToast('Failed to update delivery', 'error');
    }
  };

  if (checkingAuth || !user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col md:flex-row h-screen overflow-hidden relative">
      {/* Mobile Top Header */}
      <div className="md:hidden bg-slate-900 border-b border-white/5 px-6 py-4 flex flex-col space-y-3 z-40">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Building className="w-5 h-5 text-blue-500" />
            <span className="font-extrabold text-xs text-white uppercase tracking-wider flex items-center gap-1.5">
              {user.company?.name || 'Platform Admin'}
              {user.company && (user.company.isActive !== false ? (
                <span className="px-1.5 py-0.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded text-[9px] font-bold">ACTIVE</span>
              ) : (
                <span className="px-1.5 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded text-[9px] font-bold">INACTIVE</span>
              ))}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="py-1 px-2.5 bg-red-500/10 border border-red-500/20 hover:bg-red-600 hover:text-white text-red-400 rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-all"
          >
            <LogOut className="w-3 h-3" />
            <span>Sign Out</span>
          </button>
        </div>

        {/* Global Mode Toggle Switch */}
        {user.role !== 'TRANSPORTER' && user.role !== 'PLATFORM_ADMIN' && (
          <div className="bg-slate-950 p-1 rounded-xl border border-white/5 flex w-full">
            <button
              onClick={() => setMode('buyer')}
              className={`flex-1 py-1 rounded-lg text-[11px] font-bold text-center transition-all ${mode === 'buyer' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}
            >
              Procure Mode
            </button>
            <button
              onClick={() => setMode('seller')}
              className={`flex-1 py-1 rounded-lg text-[11px] font-bold text-center transition-all ${mode === 'seller' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}
            >
              Supply Mode
            </button>
          </div>
        )}
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
              <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-400">
                <Building className="w-6 h-6" />
              </div>
              <div>
                <h2 className="font-extrabold text-sm tracking-tight text-white flex items-center gap-1.5">
                  {user.company?.name || 'Platform Admin'}
                  {user.company && (user.company.isActive !== false ? (
                    <span className="px-1.5 py-0.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded text-[9px] font-bold">ACTIVE</span>
                  ) : (
                    <span className="px-1.5 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded text-[9px] font-bold">INACTIVE</span>
                  ))}
                </h2>
                <span className="text-[10px] text-blue-400 font-semibold uppercase">{user.role}</span>
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
                <button
                  onClick={() => handleTabChange('marketplace')}
                  className={`w-full text-left py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center space-x-2.5 transition-all ${activeTab === 'marketplace' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'text-slate-400 hover:text-white'}`}
                >
                  <Search className="w-4 h-4" />
                  <span>Public Marketplace</span>
                </button>

                <button
                  onClick={() => handleTabChange('catalog')}
                  className={`w-full text-left py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center space-x-2.5 transition-all ${activeTab === 'catalog' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'text-slate-400 hover:text-white'}`}
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span>{mode === 'buyer' ? 'Internal Components' : 'Standard Catalog'}</span>
                </button>

                {mode === 'seller' && user.role !== 'FINANCE' && (
                  <button
                    onClick={() => handleTabChange('my_rfqs')}
                    className={`w-full text-left py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center space-x-2.5 transition-all ${activeTab === 'my_rfqs' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'text-slate-400 hover:text-white'}`}
                  >
                    <FileText className="w-4 h-4" />
                    <span>My Submitted Bids</span>
                  </button>
                )}
                
                {mode === 'buyer' && user.role !== 'PLATFORM_ADMIN' && (
                  <>
                    <button
                      onClick={() => handleTabChange('prs')}
                      className={`w-full text-left py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center space-x-2.5 transition-all ${activeTab === 'prs' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'text-slate-400 hover:text-white'}`}
                    >
                      <FileText className="w-4 h-4" />
                      <span>Purchase Requisitions</span>
                    </button>
                    {user.role !== 'FINANCE' && (
                      <button
                        onClick={() => handleTabChange('my_rfqs')}
                        className={`w-full text-left py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center space-x-2.5 transition-all ${activeTab === 'my_rfqs' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'text-slate-400 hover:text-white'}`}
                      >
                        <FileText className="w-4 h-4" />
                        <span>My Requirements</span>
                      </button>
                    )}
                  </>
                )}

                <button
                  onClick={() => handleTabChange('orders')}
                  className={`w-full text-left py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center space-x-2.5 transition-all ${activeTab === 'orders' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'text-slate-400 hover:text-white'}`}
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span>Purchase Orders</span>
                </button>
              </>
            )}

            {(user.role === 'PLATFORM_ADMIN' || user.role === 'TRANSPORTER') && (
              <button
                onClick={() => handleTabChange('transporter')}
                className={`w-full text-left py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center space-x-2.5 transition-all ${activeTab === 'transporter' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'text-slate-400 hover:text-white'}`}
              >
                <Truck className="w-4 h-4" />
                <span>Local Delivery Portal</span>
              </button>
            )}

            <button
              onClick={() => handleTabChange('profile')}
              className={`w-full text-left py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center space-x-2.5 transition-all ${activeTab === 'profile' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'text-slate-400 hover:text-white'}`}
            >
              <User className="w-4 h-4" />
              <span>Profile Settings</span>
            </button>

            {user.role === 'PLATFORM_ADMIN' && (
              <>
                <button
                  onClick={() => handleTabChange('admin')}
                  className={`w-full text-left py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center space-x-2.5 transition-all ${activeTab === 'admin' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'text-slate-400 hover:text-white'}`}
                >
                  <Users className="w-4 h-4" />
                  <span>KYC & Platform Admin</span>
                </button>
                <button
                  onClick={() => handleTabChange('admin_users')}
                  className={`w-full text-left py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center space-x-2.5 transition-all ${activeTab === 'admin_users' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'text-slate-400 hover:text-white'}`}
                >
                  <Users className="w-4 h-4" />
                  <span>List of Users</span>
                </button>
              </>
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
      <div className="flex-1 flex flex-col overflow-y-auto bg-slate-950 p-6 md:p-10 pb-24 md:pb-10">
        
        {/* Top Header Bar for Desktop */}
        <div className="hidden md:flex justify-between items-center pb-6 border-b border-white/5 mb-6">
          <div>
            <h2 className="text-xl font-bold text-white">Dashboard Portal</h2>
            <p className="text-xs text-slate-400">Manage your requirements, quotes, and manufacturing milestones.</p>
          </div>

          {/* Global Mode Switcher in Header */}
          {user.role !== 'TRANSPORTER' && user.role !== 'PLATFORM_ADMIN' && (
            <div className="bg-slate-900 border border-white/5 p-1 rounded-xl flex w-64">
              <button
                onClick={() => setMode('buyer')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold text-center transition-all ${mode === 'buyer' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Procure Mode
              </button>
              <button
                onClick={() => setMode('seller')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold text-center transition-all ${mode === 'seller' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Supply Mode
              </button>
            </div>
          )}
        </div>

        {msg.text && (
          <div className={`p-4 mb-6 rounded-xl border text-sm flex items-center justify-between ${msg.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
            <span>{msg.text}</span>
            <button onClick={() => setMsg({ type: '', text: '' })} className="font-bold">&times;</button>
          </div>
        )}

        {/* Tab content switcher */}
        {activeTab === 'marketplace' && (
          <MarketplaceTab
            marketplaceRfqs={marketplaceRfqs}
            selectedRfqForBidding={selectedRfqForBidding}
            setSelectedRfqForBidding={setSelectedRfqForBidding}
            bidInputs={bidInputs}
            setBidInputs={setBidInputs}
            handleStartBidding={handleStartBidding}
            handleSubmitBid={handleSubmitBid}
            handleWithdrawBid={handleWithdrawBid}
            fetchData={fetchData}
            mode={mode}
            user={user}
            setActiveTab={handleTabChange}
            setSelectedRfqForDetails={setSelectedRfqForDetails}
            submittingActions={submittingActions}
          />
        )}

        {activeTab === 'catalog' && mode === 'buyer' && (
          <StandardCatalogTab 
            user={user}
            companyComponents={companyComponents}
            companyCategories={companyCategories}
            fetchData={fetchData}
            showToast={showToast}
          />
        )}

        {activeTab === 'my_rfqs' && (
          <MyRequirementsTab
            rfqs={rfqs}
            selectedRfqForDetails={selectedRfqForDetails}
            setSelectedRfqForDetails={setSelectedRfqForDetails}
            fetchData={fetchData}
            setShowRfqModal={setShowRfqModal}
            handleEditRfq={handleEditRfq}
            handleSelectWinner={handleSelectWinner}
            handleViewRfqDetails={handleViewRfqDetails}
            mode={mode}
          />
        )}

        {activeTab === 'orders' && user.role !== 'TRANSPORTER' && (
          <PurchaseOrdersTab
            orders={orders}
            fetchData={fetchData}
            handleStartProcessing={handleStartProcessing}
            handleReadyForPickup={handleReadyForPickup}
            handleConfirmDelivery={handleConfirmDelivery}
            mode={mode}
          />
        )}

        {activeTab === 'transporter' && (user.role === 'PLATFORM_ADMIN' || user.role === 'TRANSPORTER') && (
          <LocalDeliveryTab
            deliveries={deliveries}
            fetchData={fetchData}
            handleUpdateDeliveryStatus={handleUpdateDeliveryStatus}
          />
        )}

        {activeTab === 'admin' && user.role === 'PLATFORM_ADMIN' && (
          <AdminTab
            adminCompanies={adminCompanies}
            adminPayments={adminPayments}
            fetchData={fetchData}
            handleVerifyCompany={handleVerifyCompany}
          />
        )}

        {activeTab === 'admin_users' && user.role === 'PLATFORM_ADMIN' && (
          <AdminUsersTab
            adminUsers={adminUsers}
            fetchData={fetchData}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileTab
            user={user}
            setUser={setUser}
            showToast={showToast}
          />
        )}

        {activeTab === 'prs' && (
          <RequisitionsTab
            prs={prs}
            fetchData={fetchData}
            user={user}
            showToast={showToast}
            companyComponents={companyComponents}
          />
        )}

        {activeTab === 'catalog' && mode === 'seller' && (
          <CatalogTab
            catalogItems={catalogItems}
            fetchData={fetchData}
            user={user}
            showToast={showToast}
            mode={mode}
          />
        )}

      </div>

      {/* Publish RFQ Modal */}
      {showRfqModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-2xl p-6 flex flex-col max-h-[90vh] shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">{editingRfqId ? 'Edit B2B Procurement Requirement' : 'Create B2B Procurement Requirement'}</h3>
            
            <div className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar">
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl mb-2">
                <label className="text-[10px] text-yellow-500 font-bold uppercase tracking-wider block mb-2">
                  {user?.company?.requirePr ? 'Approved Purchase Requisition Required ' : 'Link Purchase Requisition (Optional) '}
                  {user?.company?.requirePr && <span className="text-red-500">*</span>}
                </label>
                <select
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-sm text-slate-200 focus:outline-none"
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
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Requirement Title <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    placeholder="e.g. Gearbox Component Castings"
                    value={newRfqTitle}
                    onChange={(e) => setNewRfqTitle(e.target.value)}
                    disabled={!!buyerPrId}
                    className={`w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none ${buyerPrId ? 'opacity-50 cursor-not-allowed' : ''}`}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Category <span className="text-red-500">*</span></label>
                  <select
                    required
                    value={newRfqCategory}
                    onChange={(e) => setNewRfqCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none"
                  >
                    <option value="" disabled>Select category...</option>
                    {companyCategories.map(c => (
                      <option key={c.id} value={c.categoryName}>{c.categoryName}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Bidding End Date <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={newRfqBidEndAt}
                    onClick={(e) => (e.target as any).showPicker?.()}
                    onChange={(e) => setNewRfqBidEndAt(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none cursor-pointer"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Description (Optional)</label>
                <textarea
                  placeholder="Description of specifications and standards required..."
                  value={newRfqDesc}
                  onChange={(e) => setNewRfqDesc(e.target.value)}
                  disabled={!!buyerPrId}
                  className={`w-full h-24 bg-slate-950 border border-white/10 rounded-xl p-4 text-sm text-slate-200 focus:outline-none resize-none ${buyerPrId ? 'opacity-50 cursor-not-allowed' : ''}`}
                />
              </div>

              <div className="border-t border-white/5 pt-4 space-y-3">
                <h4 className="text-xs font-bold uppercase text-slate-400">RFQ Items (Components)</h4>
                {newRfqItems.map((item, idx) => (
                  <div key={idx} className="p-4 bg-slate-950/50 rounded-xl border border-white/5 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                      <div className="col-span-1 sm:col-span-2 space-y-1">
                        <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Component Name <span className="text-red-500">*</span></label>
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
                          className={`w-full bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 ${buyerPrId ? 'opacity-50 cursor-not-allowed' : ''}`}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Quantity <span className="text-red-500">*</span></label>
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
                          className={`w-full bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 ${buyerPrId ? 'opacity-50 cursor-not-allowed' : ''}`}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Drawing File <span className="text-red-500">*</span></label>
                        <label className="cursor-pointer bg-slate-950 border border-white/10 rounded-lg px-2 py-1.5 text-center hover:bg-slate-900 hover:border-blue-500/30 transition-all text-[11px] font-semibold text-blue-400 block truncate max-w-full">
                          {item.drawingFileId ? (item.drawingFileId.length > 15 ? item.drawingFileId.substring(0, 12) + '...' : item.drawingFileId) : 'Upload File'}
                          <input
                            type="file"
                            accept=".pdf,image/*"
                            onChange={(e) => handleFileUpload(e, idx)}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end pt-1">
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Material Sourcing Option <span className="text-red-500">*</span></label>
                        <select
                          value={item.materialOptionPreference}
                          onChange={(e) => {
                            const items = [...newRfqItems];
                            items[idx].materialOptionPreference = e.target.value;
                            setNewRfqItems(items);
                          }}
                          className="w-full bg-slate-950 border border-white/10 rounded-lg px-2.5 py-2 text-xs text-slate-200 focus:outline-none"
                        >
                          <option value="WITH_MATERIAL">With Material</option>
                          <option value="WITHOUT_MATERIAL">Without Material</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Lead Time (Days) <span className="text-red-500">*</span></label>
                        <input
                          type="number"
                          placeholder="e.g. 14"
                          value={item.expectedTimeDays || ''}
                          onChange={(e) => {
                            const items = [...newRfqItems];
                            items[idx].expectedTimeDays = Number(e.target.value);
                            setNewRfqItems(items);
                          }}
                          className="w-full bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">HSN Code <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          placeholder="e.g. 84799090"
                          value={item.hsnCode || ''}
                          onChange={(e) => {
                            const items = [...newRfqItems];
                            items[idx].hsnCode = e.target.value;
                            setNewRfqItems(items);
                          }}
                          className="w-full bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
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

            <div className="flex justify-end gap-3 pt-4 border-t border-white/5 mt-4">
              <button onClick={() => { setShowRfqModal(false); setEditingRfqId(null); }} className="px-5 py-2 text-slate-300 hover:text-white text-xs font-semibold" disabled={submittingActions['publishRfq']}>Cancel</button>
              <button 
                onClick={handlePublishRfq} 
                disabled={submittingActions['publishRfq']}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center min-w-[140px]"
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
      <div className="fixed top-5 right-5 z-[60] flex flex-col gap-2 pointer-events-none">
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

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-905/98 backdrop-blur-md border-t border-white/5 z-40 grid grid-cols-5 py-2 px-1 pb-safe">
        <button 
          onClick={() => handleTabChange('marketplace')} 
          className={`flex flex-col items-center justify-center py-1 text-[9px] font-semibold transition-all ${activeTab === 'marketplace' ? 'text-blue-400 font-bold' : 'text-slate-400'}`}
        >
          <Search className="w-4 h-4 mb-0.5" />
          <span className="truncate">Market</span>
        </button>
        <button 
          onClick={() => handleTabChange('my_rfqs')} 
          className={`flex flex-col items-center justify-center py-1 text-[9px] font-semibold transition-all ${activeTab === 'my_rfqs' ? 'text-blue-400 font-bold' : 'text-slate-400'}`}
        >
          <FileText className="w-4 h-4 mb-0.5" />
          <span className="truncate">{mode === 'buyer' ? 'Reqs' : 'Bids'}</span>
        </button>
        <button 
          onClick={() => handleTabChange('orders')} 
          className={`flex flex-col items-center justify-center py-1 text-[9px] font-semibold transition-all ${activeTab === 'orders' ? 'text-blue-400 font-bold' : 'text-slate-400'}`}
        >
          <ShoppingCart className="w-4 h-4 mb-0.5" />
          <span className="truncate">Orders</span>
        </button>
        <button 
          onClick={() => handleTabChange('profile')} 
          className={`flex flex-col items-center justify-center py-1 text-[9px] font-semibold transition-all ${activeTab === 'profile' ? 'text-blue-400 font-bold' : 'text-slate-400'}`}
        >
          <User className="w-4 h-4 mb-0.5" />
          <span className="truncate">Profile</span>
        </button>
        <button 
          onClick={() => setShowMobileSidebar(true)} 
          className="flex flex-col items-center justify-center py-1 text-[9px] font-semibold text-slate-400 transition-all hover:text-blue-400"
        >
          <Menu className="w-4 h-4 mb-0.5" />
          <span className="truncate">Menu</span>
        </button>
      </div>

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
