'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Building, LogOut, CheckCircle, Clock, ShoppingCart, 
  Plus, Users, FileText, ChevronRight, Truck, Info,
  Search, ShieldAlert, Star, RefreshCw, ArrowLeft,
  Menu, X, User
} from 'lucide-react';

import MarketplaceTab from './components/MarketplaceTab';
import MyRequirementsTab from './components/MyRequirementsTab';
import PurchaseOrdersTab from './components/PurchaseOrdersTab';
import LocalDeliveryTab from './components/LocalDeliveryTab';
import AdminTab from './components/AdminTab';
import ProfileTab from './components/ProfileTab';

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('marketplace'); // marketplace, my_rfqs, my_bids, orders, admin, transporter
  const [rfqs, setRfqs] = useState<any[]>([]);
  const [marketplaceRfqs, setMarketplaceRfqs] = useState<any[]>([]);
  const [myBids, setMyBids] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [adminCompanies, setAdminCompanies] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);

  // Modals / Selection States
  const [showRfqModal, setShowRfqModal] = useState(false);
  const [newRfqTitle, setNewRfqTitle] = useState('');
  const [newRfqDesc, setNewRfqDesc] = useState('');
  const [newRfqCategory, setNewRfqCategory] = useState('Industrial Parts');
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
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [toasts, setToasts] = useState<{ id: string; type: 'success' | 'error' | 'info'; text: string }[]>([]);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

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
    if (!storedUser) {
      router.push('/');
    } else {
      const parsed = JSON.parse(storedUser);
      setUser(parsed);
      // Fetch live company status
      const headers = { 'Authorization': `Bearer ${localStorage.getItem('token')}` };
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
  }, [user?.company?.status, activeTab]);

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
      }

      if (activeTab === 'transporter') {
        const res = await fetch('/api/v1/transporter/deliveries', { headers });
        const d = await res.json();
        if (d.success) setDeliveries(d.data);
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

  // RFQ Creation
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

    try {
      const headers = { 
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      };
      const bidEndAt = new Date(newRfqBidEndAt).toISOString();
      const res = await fetch('/api/v1/rfqs', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: newRfqTitle,
          description: newRfqDesc,
          category: newRfqCategory,
          bidEndAt,
          items: newRfqItems
        })
      });
      const d = await res.json();
      if (d.success) {
        setMsg({ type: 'success', text: 'RFQ published successfully!' });
        setShowRfqModal(false);
        setNewRfqTitle('');
        setNewRfqDesc('');
        setNewRfqItems([{ componentName: 'Bracket A', quantity: 500, unit: 'pcs', drawingFileId: 'drawing_bracket_a.pdf', hsnCode: '84799090', materialOptionPreference: 'WITH_MATERIAL', expectedTimeDays: 14 }]);
        fetchData();
      } else {
        setMsg({ type: 'error', text: d.message });
      }
    } catch (err) {
      setMsg({ type: 'error', text: 'Failed to publish RFQ' });
    }
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
  };

  const handleWithdrawBid = async (rfqItemId: string) => {
    if (!confirm('Are you sure you want to withdraw your quote for this component?')) return;
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
      const res = await fetch('/api/v1/upload', {
        method: 'POST',
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
  const handleStartProcessing = async (orderId: string) => {
    try {
      const headers = { 'Authorization': `Bearer ${localStorage.getItem('token')}` };
      const res = await fetch(`/api/v1/orders/${orderId}/start-processing`, { method: 'POST', headers });
      const d = await res.json();
      if (d.success) {
        showToast('Order status: PROCESSING', 'success');
        fetchData();
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

  if (!user) return null;

  return (
    <div className="flex-1 flex flex-col md:flex-row h-screen overflow-hidden relative">
      {/* Mobile Top Header */}
      <div className="md:hidden bg-slate-900 border-b border-white/5 px-6 py-4 flex items-center justify-between z-40">
        <div className="flex items-center space-x-2">
          <Building className="w-5 h-5 text-blue-500" />
          <span className="font-extrabold text-xs text-white uppercase tracking-wider">{user.company?.name || 'Platform Admin'}</span>
        </div>
        <button
          onClick={handleLogout}
          className="py-1.5 px-3 bg-red-500/10 border border-red-500/20 hover:bg-red-600 hover:text-white text-red-400 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>

      {/* Sidebar Navigation (Desktop only) */}
      <div className="hidden md:flex md:w-64 glass-panel border-r border-white/5 flex-col justify-between p-6">
        <div>
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-400">
                <Building className="w-6 h-6" />
              </div>
              <div>
                <h2 className="font-extrabold text-sm tracking-tight text-white">{user.company?.name || 'Platform Admin'}</h2>
                <span className="text-[10px] text-blue-400 font-semibold uppercase">{user.role}</span>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <button
              onClick={() => setActiveTab('marketplace')}
              className={`w-full text-left py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center space-x-2.5 transition-all ${activeTab === 'marketplace' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'text-slate-400 hover:text-white'}`}
            >
              <Search className="w-4 h-4" />
              <span>Public Marketplace</span>
            </button>
            
            <button
              onClick={() => setActiveTab('my_rfqs')}
              className={`w-full text-left py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center space-x-2.5 transition-all ${activeTab === 'my_rfqs' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'text-slate-400 hover:text-white'}`}
            >
              <FileText className="w-4 h-4" />
              <span>My Requirements</span>
            </button>

            <button
              onClick={() => setActiveTab('orders')}
              className={`w-full text-left py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center space-x-2.5 transition-all ${activeTab === 'orders' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'text-slate-400 hover:text-white'}`}
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Purchase Orders</span>
            </button>

            <button
              onClick={() => setActiveTab('transporter')}
              className={`w-full text-left py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center space-x-2.5 transition-all ${activeTab === 'transporter' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'text-slate-400 hover:text-white'}`}
            >
              <Truck className="w-4 h-4" />
              <span>Local Delivery Portal</span>
            </button>

            <button
              onClick={() => setActiveTab('profile')}
              className={`w-full text-left py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center space-x-2.5 transition-all ${activeTab === 'profile' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'text-slate-400 hover:text-white'}`}
            >
              <User className="w-4 h-4" />
              <span>Profile Settings</span>
            </button>

            {user.role === 'PLATFORM_ADMIN' && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`w-full text-left py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center space-x-2.5 transition-all ${activeTab === 'admin' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'text-slate-400 hover:text-white'}`}
              >
                <Users className="w-4 h-4" />
                <span>KYC & Platform Admin</span>
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
      <div className="flex-1 flex flex-col overflow-y-auto bg-slate-950 p-6 md:p-10 pb-24 md:pb-10">
        
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
          />
        )}

        {activeTab === 'my_rfqs' && (
          <MyRequirementsTab
            rfqs={rfqs}
            selectedRfqForDetails={selectedRfqForDetails}
            setSelectedRfqForDetails={setSelectedRfqForDetails}
            fetchData={fetchData}
            setShowRfqModal={setShowRfqModal}
            handleSelectWinner={handleSelectWinner}
            handleViewRfqDetails={handleViewRfqDetails}
          />
        )}

        {activeTab === 'orders' && (
          <PurchaseOrdersTab
            orders={orders}
            fetchData={fetchData}
            handleStartProcessing={handleStartProcessing}
            handleReadyForPickup={handleReadyForPickup}
            handleConfirmDelivery={handleConfirmDelivery}
          />
        )}

        {activeTab === 'transporter' && (
          <LocalDeliveryTab
            deliveries={deliveries}
            fetchData={fetchData}
            handleUpdateDeliveryStatus={handleUpdateDeliveryStatus}
          />
        )}

        {activeTab === 'admin' && user?.role === 'PLATFORM_ADMIN' && (
          <AdminTab
            adminCompanies={adminCompanies}
            fetchData={fetchData}
            handleVerifyCompany={handleVerifyCompany}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileTab
            user={user}
            setUser={setUser}
            showToast={showToast}
          />
        )}

      </div>

      {/* Publish RFQ Modal */}
      {showRfqModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-2xl p-6 flex flex-col max-h-[90vh] shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Create B2B Procurement Requirement</h3>
            
            <div className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Requirement Title <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    placeholder="e.g. Gearbox Component Castings"
                    value={newRfqTitle}
                    onChange={(e) => setNewRfqTitle(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Category <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    placeholder="Category"
                    value={newRfqCategory}
                    onChange={(e) => setNewRfqCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none"
                  />
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
                  className="w-full h-24 bg-slate-950 border border-white/10 rounded-xl p-4 text-sm text-slate-200 focus:outline-none resize-none"
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
                          className="w-full bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
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
                          className="w-full bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end pt-1">
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
                          className="w-full bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <button onClick={handleAddRfqItem} className="text-xs text-blue-400 font-semibold hover:underline">+ Add Component</button>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-white/5 mt-4">
              <button onClick={() => setShowRfqModal(false)} className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white">Cancel</button>
              <button onClick={handlePublishRfq} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold">Publish Requirement</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Container */}
      <div className="fixed top-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
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
      <div className={`md:hidden fixed bottom-0 left-0 right-0 bg-slate-905/98 backdrop-blur-md border-t border-white/5 z-40 grid ${user.role === 'PLATFORM_ADMIN' ? 'grid-cols-6' : 'grid-cols-5'} py-2 px-1`}>
        <button 
          onClick={() => setActiveTab('marketplace')} 
          className={`flex flex-col items-center justify-center py-1 text-[9px] font-semibold transition-all ${activeTab === 'marketplace' ? 'text-blue-400 font-bold' : 'text-slate-400'}`}
        >
          <Search className="w-4 h-4 mb-0.5" />
          <span className="truncate">Market</span>
        </button>
        <button 
          onClick={() => setActiveTab('my_rfqs')} 
          className={`flex flex-col items-center justify-center py-1 text-[9px] font-semibold transition-all ${activeTab === 'my_rfqs' ? 'text-blue-400 font-bold' : 'text-slate-400'}`}
        >
          <FileText className="w-4 h-4 mb-0.5" />
          <span className="truncate">Reqs</span>
        </button>
        <button 
          onClick={() => setActiveTab('orders')} 
          className={`flex flex-col items-center justify-center py-1 text-[9px] font-semibold transition-all ${activeTab === 'orders' ? 'text-blue-400 font-bold' : 'text-slate-400'}`}
        >
          <ShoppingCart className="w-4 h-4 mb-0.5" />
          <span className="truncate">Orders</span>
        </button>
        <button 
          onClick={() => setActiveTab('transporter')} 
          className={`flex flex-col items-center justify-center py-1 text-[9px] font-semibold transition-all ${activeTab === 'transporter' ? 'text-blue-400 font-bold' : 'text-slate-400'}`}
        >
          <Truck className="w-4 h-4 mb-0.5" />
          <span className="truncate">Delivery</span>
        </button>
        <button 
          onClick={() => setActiveTab('profile')} 
          className={`flex flex-col items-center justify-center py-1 text-[9px] font-semibold transition-all ${activeTab === 'profile' ? 'text-blue-400 font-bold' : 'text-slate-400'}`}
        >
          <User className="w-4 h-4 mb-0.5" />
          <span className="truncate">Profile</span>
        </button>
        {user.role === 'PLATFORM_ADMIN' && (
          <button 
            onClick={() => setActiveTab('admin')} 
            className={`flex flex-col items-center justify-center py-1 text-[9px] font-semibold transition-all ${activeTab === 'admin' ? 'text-blue-400 font-bold' : 'text-slate-400'}`}
          >
            <Users className="w-4 h-4 mb-0.5" />
            <span className="truncate">Admin</span>
          </button>
        )}
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
