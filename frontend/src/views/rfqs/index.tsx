import { useState, useEffect, useRef, useMemo } from 'react';
import styles from './rfqs.module.scss';
import { Plus, Star, ChevronRight, FileText, ShoppingCart, Building, RefreshCw, Loader2, Clock, Cog, X, Filter, Check, ChevronDown, Search } from 'lucide-react';
import { ButtonSpinner } from '@/components/ui/ActionButton';
import SamplingPanel, { SupplierSamplingPanel } from './components/SamplingPanel';
import { computeBuyerPricing, formatInrFromPaise, paiseToRupees } from '@/lib/platformPricing';
import { RefreshButton } from '@/components/ui/RefreshButton';

interface MyRequirementsTabProps {
  rfqs: any[];
  selectedRfqForDetails: any;
  setSelectedRfqForDetails: (rfq: any) => void;
  fetchData: () => Promise<void>;
  setShowRfqModal: (show: boolean) => void;
  handleSelectWinner: (rfqItemId: string, bidId: string, qty?: number) => Promise<void>;
  handleViewRfqDetails: (rfqId: string) => Promise<void>;
  handleEditRfq: (rfq: any) => void;
  mode: 'buyer' | 'seller';
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export default function MyRequirementsTab({
  rfqs,
  selectedRfqForDetails,
  setSelectedRfqForDetails,
  fetchData,
  setShowRfqModal,
  handleSelectWinner,
  handleViewRfqDetails,
  handleEditRfq,
  mode,
  showToast,
}: MyRequirementsTabProps) {
  const subTab = mode === 'buyer' ? 'buying' : 'selling';
  const [statusFilter, setStatusFilter] = useState<'open' | 'in_progress' | 'closed'>('open');
  const [myBids, setMyBids] = useState<any[]>([]);
  const [loadingBids, setLoadingBids] = useState(false);
  const [awardModal, setAwardModal] = useState<{ rfqItemId: string, bidId: string, maxQty: number, currentQty: number } | null>(null);
  const [detailsLoadingId, setDetailsLoadingId] = useState<string | null>(null);
  const [awardLoading, setAwardLoading] = useState(false);
  const [viewingMachinesSupplier, setViewingMachinesSupplier] = useState<{ companyName: string; machines: any[] } | null>(null);
  const [itemMachineFilters, setItemMachineFilters] = useState<Record<string, string[]>>({});
  const [itemMatchModes, setItemMatchModes] = useState<Record<string, 'ANY' | 'ALL'>>({});
  const [openDropdownItemId, setOpenDropdownItemId] = useState<string | null>(null);
  const [machineSearchQuery, setMachineSearchQuery] = useState('');
  const [catalogMachines, setCatalogMachines] = useState<{ id: string; name: string; model?: string }[]>([]);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const fetchCatalogMachines = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch('/api/v1/machines', { headers });
        const d = await res.json();
        if (d.success && Array.isArray(d.data)) {
          setCatalogMachines(d.data);
        }
      } catch (e) {
        console.error('Failed to load catalog machines', e);
      }
    };
    fetchCatalogMachines();
  }, []);

  const consolidatedSupplierMachines = useMemo(() => {
    if (!viewingMachinesSupplier?.machines) return [];
    const map = new Map<string, any>();
    for (const m of viewingMachinesSupplier.machines) {
      const machineName = m.name?.trim() || 'Machine';
      const key = machineName.toLowerCase();
      const count = Number(m.numberOfMachines) || 1;
      if (map.has(key)) {
        const existing = map.get(key);
        existing.numberOfMachines = (Number(existing.numberOfMachines) || 0) + count;
        if (!existing.model && m.model) existing.model = m.model;
        if (!existing.specifications && m.specifications) existing.specifications = m.specifications;
      } else {
        map.set(key, { ...m, name: machineName, numberOfMachines: count });
      }
    }
    return Array.from(map.values());
  }, [viewingMachinesSupplier]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdownItemId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleMachineFilter = (itemId: string, machineName: string) => {
    setItemMachineFilters(prev => {
      const current = prev[itemId] || [];
      const exists = current.includes(machineName);
      const updated = exists ? current.filter(m => m !== machineName) : [...current, machineName];
      return { ...prev, [itemId]: updated };
    });
  };

  const clearMachineFilter = (itemId: string) => {
    setItemMachineFilters(prev => ({ ...prev, [itemId]: [] }));
  };

  const selectAllMachines = (itemId: string, machines: string[]) => {
    setItemMachineFilters(prev => ({ ...prev, [itemId]: [...machines] }));
  };

  const toggleMatchMode = (itemId: string) => {
    setItemMatchModes(prev => ({
      ...prev,
      [itemId]: (prev[itemId] || 'ANY') === 'ANY' ? 'ALL' : 'ANY'
    }));
  };

  const fetchMyBids = async () => {
    setLoadingBids(true);
    try {
      const headers = { 'Authorization': `Bearer ${localStorage.getItem('token')}` };
      const res = await fetch('/api/v1/rfqs/my-bids', { headers });
      const data = await res.json();
      if (data.success) {
        setMyBids(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load my bids', err);
    } finally {
      setLoadingBids(false);
    }
  };

  useEffect(() => {
    if (mode === 'seller') {
      fetchMyBids();
    }
  }, [mode]);

  const handleRefresh = async () => {
    if (mode === 'buyer') {
      await fetchData();
    } else {
      await fetchMyBids();
    }
  };

  const filteredRfqs = rfqs.filter((rfq: any) => {
    const status = rfq.status;
    const isExpired = new Date(rfq.bidEndAt) < new Date();
    
    if (statusFilter === 'open') {
      return (status === 'PUBLISHED' || status === 'BIDDING_OPEN' || status === 'DRAFT' || status === 'SAMPLING') && !isExpired;
    } else if (statusFilter === 'in_progress') {
      return status === 'PARTIALLY_AWARDED' || status === 'FULLY_AWARDED' || status === 'ORDER_CREATED';
    } else {
      return status === 'COMPLETED' || status === 'CANCELLED' || status === 'EXPIRED' || 
             ((status === 'PUBLISHED' || status === 'BIDDING_OPEN') && isExpired);
    }
  });

  const filteredBids = myBids.filter((bid: any) => {
    const rfqStatus = bid.rfq?.status;
    const bidStatus = bid.status;
    const isExpired = new Date(bid.rfq?.bidEndAt) < new Date();
    const isRfqAwarded = rfqStatus === 'PARTIALLY_AWARDED' || rfqStatus === 'FULLY_AWARDED' || rfqStatus === 'ORDER_CREATED';

    if (statusFilter === 'open') {
      return (
        bidStatus === 'SUBMITTED' &&
        (rfqStatus === 'PUBLISHED' || rfqStatus === 'BIDDING_OPEN' || rfqStatus === 'SAMPLING') &&
        !isExpired
      );
    } else if (statusFilter === 'in_progress') {
      return bidStatus === 'ACCEPTED' && isRfqAwarded;
    } else {
      return bidStatus === 'WITHDRAWN' || bidStatus === 'REJECTED' || 
             rfqStatus === 'COMPLETED' || rfqStatus === 'CANCELLED' || rfqStatus === 'EXPIRED' ||
             (isExpired && bidStatus === 'SUBMITTED' && !isRfqAwarded) ||
             (isRfqAwarded && bidStatus !== 'ACCEPTED');
    }
  });

  return (
    <div className={styles['rfq--container']}>
      {/* Title & Description */}
      <div className={styles['rfq--header']}>
        <div className={styles['rfq--header-padding']}>
          <h1 className={styles['rfq--title']}>
            {mode === 'buyer' ? 'My Requirements (Buying)' : 'My Submitted Bids (Selling)'}
          </h1>
          <p className={styles['rfq--subtitle']}>
            {mode === 'buyer' 
              ? 'Create, monitor, and select winners for your component requirements' 
              : 'Monitor quotes and component bids you have submitted to other companies'}
          </p>
        </div>
        <div className={`${styles['rfq--refresh-btn']} ${mode === 'buyer' ? styles['rfq--refresh-btn-buyer'] : styles['rfq--refresh-btn-seller']}`}>
           <RefreshCw className={styles['rfq--refresh-icon']} onClick={handleRefresh} />
        </div>
      </div>

      {/* Status Filter Sub-Tabs */}
      <div className={styles['rfq--tabs']}>
        <button
          onClick={() => { setStatusFilter('open'); setSelectedRfqForDetails(null); }}
          className={`${styles['rfq--tab-btn']} ${statusFilter === 'open' ? (mode === 'buyer' ? styles['rfq--tab-active-buyer'] : styles['rfq--tab-active-seller']) : styles['rfq--tab-inactive']}`}
        >
          Open
        </button>
        <button
          onClick={() => { setStatusFilter('in_progress'); setSelectedRfqForDetails(null); }}
          className={`${styles['rfq--tab-btn']} ${statusFilter === 'in_progress' ? (mode === 'buyer' ? styles['rfq--tab-active-buyer'] : styles['rfq--tab-active-seller']) : styles['rfq--tab-inactive']}`}
        >
          In Progress
        </button>
        <button
          onClick={() => { setStatusFilter('closed'); setSelectedRfqForDetails(null); }}
          className={`${styles['rfq--tab-btn']} ${statusFilter === 'closed' ? (mode === 'buyer' ? styles['rfq--tab-active-buyer'] : styles['rfq--tab-active-seller']) : styles['rfq--tab-inactive']}`}
        >
          Closed
        </button>
      </div>

      {/* Action Buttons */}
      {subTab === 'buying' && statusFilter === 'open' && !selectedRfqForDetails && (
        <div className={styles['rfq--publish-container']}>
          <button
            onClick={() => setShowRfqModal(true)}
            className={styles['rfq--publish-btn']}
          >
            <Plus className={styles['rfq--plus-icon']} />
            <span>Publish New RFQ</span>
          </button>
        </div>
      )}

      {/* Buying Sub-Tab (Existing view wrapper) */}
      {subTab === 'buying' && (
        <>
          {selectedRfqForDetails ? (
            <div className={styles['rfq--details-card']}>
              <div className={styles['rfq--details-header']}>
                <div>
                  <h2 className={styles['rfq--details-title']}>{selectedRfqForDetails.title}</h2>
                  <span className={styles['rfq--details-number']}>{selectedRfqForDetails.rfqNumber}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      if (selectedRfqForDetails) {
                        await handleViewRfqDetails(selectedRfqForDetails.id);
                        showToast('Quotes & machinery refreshed', 'info');
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                    title="Refresh latest quotes and company machines"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                    <span className="hidden sm:inline">Refresh Bids</span>
                  </button>
                  <button onClick={() => setSelectedRfqForDetails(null)} className={styles['rfq--back-button']}>Back</button>
                </div>
              </div>

              <SamplingPanel
                rfqId={selectedRfqForDetails.id}
                rfqNumber={selectedRfqForDetails.rfqNumber}
                items={selectedRfqForDetails.items}
                onRefresh={fetchData}
                onDetailsRefresh={handleViewRfqDetails}
                showToast={showToast}
              />

              <div className={styles['rfq--items-container']}>
                {selectedRfqForDetails.items.map((item: any) => (
                  <div key={item.id} className={styles['rfq--item-card']}>
                    <div className={styles['rfq--item-header']}>
                      <div>
                        <h4 className={styles['rfq--item-name']}>{item.componentName}</h4>
                        <span className={styles['rfq--item-meta']}>Qty: {Number(item.quantity)} {item.unit} | HSN: {item.hsnCode} | Sourcing: {item.materialOptionPreference === 'WITH_MATERIAL' ? 'With Material' : 'Without Material'}</span>
                      </div>
                    </div>

                    {/* Bids received list */}
                    <div className={styles['rfq--bids-container']}>
                      {(() => {
                        const allItemBids = item.bids || [];
                        // Combine all unique machine names present across master catalog AND this item's bidder companies
                        const bidderMachines = allItemBids.flatMap((b: any) =>
                          (b.supplierCompany?.machines || []).map((m: any) => m.name?.trim())
                        );
                        const catalogMachineNames = catalogMachines.map((m: any) => m.name?.trim());
                        const availableItemMachines = Array.from(
                          new Set([...catalogMachineNames, ...bidderMachines])
                        ).filter(Boolean) as string[];

                        const selectedMachines = itemMachineFilters[item.id] || [];
                        const matchMode = itemMatchModes[item.id] || 'ANY';

                        const filteredBids = allItemBids.filter((bid: any) => {
                          if (selectedMachines.length === 0) return true;
                          const supplierMachineNames = (bid.supplierCompany?.machines || []).map((m: any) =>
                            m.name?.trim().toLowerCase()
                          );
                          if (matchMode === 'ALL') {
                            return selectedMachines.every((sm) =>
                              supplierMachineNames.includes(sm.trim().toLowerCase())
                            );
                          } else {
                            return selectedMachines.some((sm) =>
                              supplierMachineNames.includes(sm.trim().toLowerCase())
                            );
                          }
                        });

                        return (
                          <div className="space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                <span>Received Quotes</span>
                                <span className="px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-700 text-[11px] font-extrabold">
                                  {allItemBids.length}
                                </span>
                              </h5>

                              {/* Mobile scroll indicator */}
                              {allItemBids.length > 0 && (
                                <span className="text-[11px] text-slate-400 font-medium md:hidden flex items-center gap-1">
                                  ⇄ Scroll horizontally to view columns
                                </span>
                              )}
                            </div>

                            {/* Machine Filter Multi-Select Dropdown */}
                            {availableItemMachines.length > 0 && (
                              <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3.5 shadow-2xs space-y-2.5">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5">
                                    <Filter className="w-3.5 h-3.5 text-blue-600" />
                                    <span className="text-xs font-bold text-[#001D4A]">
                                      Filter Quotes by Machinery Fleet
                                    </span>
                                  </div>

                                  {selectedMachines.length > 0 && (
                                    <div className="flex items-center gap-2">
                                      {selectedMachines.length > 1 && (
                                        <button
                                          type="button"
                                          onClick={() => toggleMatchMode(item.id)}
                                          className="text-[10px] font-bold px-2 py-1 rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-all cursor-pointer shadow-2xs"
                                          title="Toggle matching rule"
                                        >
                                          Match:{' '}
                                          <span className="text-blue-600 font-extrabold">
                                            {matchMode === 'ALL' ? 'Must have ALL' : 'Has ANY'}
                                          </span>
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => clearMachineFilter(item.id)}
                                        className="text-[11px] font-bold text-red-600 hover:text-red-700 cursor-pointer flex items-center gap-1 hover:underline"
                                      >
                                        <X className="w-3 h-3" /> Clear filter ({selectedMachines.length})
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {/* Custom Dropdown Trigger & Panel */}
                                <div
                                  className="relative max-w-sm w-full"
                                  ref={openDropdownItemId === item.id ? dropdownRef : undefined}
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenDropdownItemId(openDropdownItemId === item.id ? null : item.id);
                                      setMachineSearchQuery('');
                                    }}
                                    className={`w-full flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer shadow-2xs ${
                                      selectedMachines.length > 0
                                        ? 'bg-blue-50/80 border-blue-300 text-blue-900'
                                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 truncate">
                                      <Cog className={`w-4 h-4 shrink-0 ${selectedMachines.length > 0 ? 'text-blue-600' : 'text-slate-400'}`} />
                                      <span className="truncate">
                                        {selectedMachines.length === 0
                                          ? 'Select machines to filter...'
                                          : `${selectedMachines.length} machine${selectedMachines.length > 1 ? 's' : ''} selected`}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      {selectedMachines.length > 0 && (
                                        <span className="px-1.5 py-0.2 rounded-full bg-blue-600 text-white text-[10px] font-extrabold">
                                          {selectedMachines.length}
                                        </span>
                                      )}
                                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${openDropdownItemId === item.id ? 'rotate-180' : ''}`} />
                                    </div>
                                  </button>

                                  {/* Dropdown Menu Popup */}
                                  {openDropdownItemId === item.id && (
                                    <div className="absolute top-full left-0 mt-1.5 w-full bg-white border border-slate-200 rounded-2xl shadow-xl z-30 p-2 space-y-2 animate-in fade-in zoom-in-95 duration-150">
                                      {/* Search input if more than 3 machines */}
                                      {availableItemMachines.length > 3 && (
                                        <div className="relative">
                                          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                          <input
                                            type="text"
                                            value={machineSearchQuery}
                                            onChange={(e) => setMachineSearchQuery(e.target.value)}
                                            placeholder="Search machines..."
                                            className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                                            autoFocus
                                          />
                                        </div>
                                      )}

                                      {/* Header with Select All / Clear */}
                                      <div className="flex items-center justify-between px-1 text-[11px] font-bold border-b border-slate-100 pb-1.5 text-slate-500">
                                        <span>Available Machinery ({availableItemMachines.length})</span>
                                        <div className="flex items-center gap-2">
                                          <button
                                            type="button"
                                            onClick={() => selectAllMachines(item.id, availableItemMachines)}
                                            className="text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                                          >
                                            Select All
                                          </button>
                                          <span>·</span>
                                          <button
                                            type="button"
                                            onClick={() => clearMachineFilter(item.id)}
                                            className="text-slate-400 hover:text-slate-600 hover:underline cursor-pointer"
                                          >
                                            Clear
                                          </button>
                                        </div>
                                      </div>

                                      {/* Machine Checkboxes List */}
                                      <div className="max-h-56 overflow-y-auto space-y-0.5 pr-0.5">
                                        {availableItemMachines
                                          .filter(m => !machineSearchQuery || m.toLowerCase().includes(machineSearchQuery.toLowerCase()))
                                          .map((mName) => {
                                            const isChecked = selectedMachines.includes(mName);
                                            const count = allItemBids.filter((b: any) =>
                                              (b.supplierCompany?.machines || []).some(
                                                (m: any) => m.name?.trim().toLowerCase() === mName.trim().toLowerCase()
                                              )
                                            ).length;

                                            return (
                                              <div
                                                key={mName}
                                                onClick={() => toggleMachineFilter(item.id, mName)}
                                                className={`flex items-center justify-between px-2.5 py-2 rounded-xl text-xs cursor-pointer transition-colors ${
                                                  isChecked
                                                    ? 'bg-blue-50 text-blue-900 font-bold'
                                                    : 'hover:bg-slate-50 text-slate-700 font-medium'
                                                }`}
                                              >
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                  <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => {}} // Handled by container click
                                                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 pointer-events-none shrink-0"
                                                  />
                                                  <span className="truncate">{mName}</span>
                                                </div>
                                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold shrink-0 ml-2">
                                                  {count} {count === 1 ? 'quote' : 'quotes'}
                                                </span>
                                              </div>
                                            );
                                          })}
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* Removable Selected Badges underneath */}
                                {selectedMachines.length > 0 && (
                                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                    <span className="text-[11px] text-slate-400 font-medium mr-1">Active:</span>
                                    {selectedMachines.map((mName) => (
                                      <span
                                        key={mName}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-600 text-white text-xs font-semibold shadow-2xs"
                                      >
                                        <Cog className="w-3 h-3 text-blue-200" />
                                        <span>{mName}</span>
                                        <button
                                          type="button"
                                          onClick={() => toggleMachineFilter(item.id, mName)}
                                          className="hover:bg-blue-700 p-0.5 rounded-full text-blue-200 hover:text-white transition-colors cursor-pointer"
                                          title={`Remove ${mName}`}
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </span>
                                    ))}
                                    <button
                                      type="button"
                                      onClick={() => clearMachineFilter(item.id)}
                                      className="text-[11px] text-slate-400 hover:text-red-600 font-bold ml-1 hover:underline cursor-pointer"
                                    >
                                      Clear All
                                    </button>
                                  </div>
                                )}

                                {selectedMachines.length > 0 && (
                                  <div className="text-[11px] text-slate-500 font-medium pt-0.5">
                                    Showing <span className="font-bold text-[#001D4A]">{filteredBids.length}</span> of{' '}
                                    <span className="font-bold text-[#001D4A]">{allItemBids.length}</span> quotes matching selected fleet
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Table of Quotes */}
                            {allItemBids.length > 0 ? (
                              <div className="w-full overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-xs">
                                <table className="w-full text-left border-collapse min-w-[700px]">
                                  <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold text-xs uppercase tracking-wider">
                                      <th className="py-3 px-4 min-w-[150px]">Supplier</th>
                                      <th className="py-3 px-4 min-w-[180px]">Company Machines</th>
                                      <th className="py-3 px-4 min-w-[170px]">
                                        {item.materialOptionPreference === 'WITH_MATERIAL'
                                          ? 'Price (With Material)'
                                          : 'Price (Without Material)'}
                                      </th>
                                      <th className="py-3 px-4 min-w-[110px] text-center">Delivery</th>
                                      <th className="py-3 px-4 min-w-[120px] text-right">Action</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 text-slate-800 text-xs">
                                    {filteredBids.length === 0 ? (
                                      <tr>
                                        <td colSpan={5} className="py-8 text-center text-xs text-slate-500 font-medium bg-slate-50/40">
                                          No supplier quotes match the selected machinery fleet.
                                          <button
                                            type="button"
                                            onClick={() => clearMachineFilter(item.id)}
                                            className="ml-2 font-bold text-blue-600 hover:underline cursor-pointer"
                                          >
                                            Reset Filter
                                          </button>
                                        </td>
                                      </tr>
                                    ) : (
                                      filteredBids.map((bid: any) => {
                                        const qty = Number(item.quantity) || 0;
                                        const goodsPaise =
                                          Number(
                                            item.materialOptionPreference === 'WITH_MATERIAL'
                                              ? bid.priceWithMaterial
                                              : bid.priceWithoutMaterial
                                          ) || 0;
                                        const pricing = computeBuyerPricing(goodsPaise);
                                        const buyerTotal = paiseToRupees(pricing.buyerTotalPaise);
                                        const unitTotal = qty > 0 ? buyerTotal / qty : 0;
                                        const supplierMachines = bid.supplierCompany?.machines || [];
                                        const totalMachineCount = supplierMachines.reduce(
                                          (acc: number, m: any) => acc + (Number(m.numberOfMachines) || 1),
                                          0
                                        );
                                        const supplierMachineTypes = new Set(supplierMachines.map((m: any) => m.name?.trim().toLowerCase())).size;

                                        return (
                                          <tr key={bid.id} className="hover:bg-slate-50/80 transition-colors">
                                            {/* Supplier */}
                                            <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap">
                                              <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 font-extrabold text-xs flex items-center justify-center border border-blue-100 shrink-0">
                                                  {bid.supplierCompany.name?.charAt(0).toUpperCase() || 'S'}
                                                </div>
                                                <span className="truncate max-w-[130px]" title={bid.supplierCompany.name}>
                                                  {bid.supplierCompany.name}
                                                </span>
                                              </div>
                                            </td>

                                            {/* Machinery Fleet */}
                                            <td className="py-3.5 px-4 whitespace-nowrap">
                                              {supplierMachines.length > 0 ? (
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    setViewingMachinesSupplier({
                                                      companyName: bid.supplierCompany.name,
                                                      machines: supplierMachines,
                                                    })
                                                  }
                                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold transition-all cursor-pointer shadow-2xs group"
                                                  title="Click to view fleet breakdown"
                                                >
                                                  <Cog className="w-3.5 h-3.5 text-amber-600 group-hover:rotate-45 transition-transform shrink-0" />
                                                  <span>{totalMachineCount} Machines</span>
                                                  <span className="text-[10px] text-amber-700/80 font-normal">
                                                    ({supplierMachineTypes} {supplierMachineTypes === 1 ? 'type' : 'types'})
                                                  </span>
                                                </button>
                                              ) : (
                                                <span className="inline-flex items-center text-[11px] text-slate-400 italic bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                                                  No machines listed
                                                </span>
                                              )}
                                            </td>

                                            {/* Price */}
                                            <td className="py-3.5 px-4 whitespace-nowrap">
                                              <div className="text-sm font-extrabold text-blue-600">
                                                Total: ₹{buyerTotal.toLocaleString('en-IN')}
                                              </div>
                                              <div className="text-[11px] font-medium text-slate-500">
                                                ₹{unitTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })} / unit
                                              </div>
                                            </td>

                                            {/* Delivery */}
                                            <td className="py-3.5 px-4 whitespace-nowrap text-center">
                                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                                                <Clock className="w-3 h-3 text-slate-400" />
                                                {bid.estimatedTimeDays} days
                                              </span>
                                            </td>

                                            {/* Action */}
                                            <td className="py-3.5 px-4 whitespace-nowrap text-right">
                                              {bid.status === 'ACCEPTED' ? (
                                                <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                  Accepted
                                                </span>
                                              ) : bid.status === 'REJECTED' ? (
                                                <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold bg-red-50 text-red-600 border border-red-200">
                                                  Rejected
                                                </span>
                                              ) : (
                                                <button
                                                  onClick={() =>
                                                    setAwardModal({
                                                      rfqItemId: item.id,
                                                      bidId: bid.id,
                                                      maxQty: Number(item.quantity),
                                                      currentQty: Number(item.quantity),
                                                    })
                                                  }
                                                  disabled={selectedRfqForDetails.status === 'SAMPLING'}
                                                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs inline-flex items-center gap-1 cursor-pointer"
                                                  title={
                                                    selectedRfqForDetails.status === 'SAMPLING'
                                                      ? 'Complete sampling first'
                                                      : undefined
                                                  }
                                                >
                                                  Award Bid
                                                </button>
                                              )}
                                            </td>
                                          </tr>
                                        );
                                      })
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className={styles['rfq--no-quotes']}>No quotes received yet.</div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className={styles['rfq--list-container']}>
              {filteredRfqs.length === 0 ? (
                <div className={styles['rfq--empty-state']}>No requirements found matching this status.</div>
              ) : (
                filteredRfqs.map((rfq: any) => (
                  <div key={rfq.id} className={styles['rfq--card']}>
                    <div className={styles['rfq--card-header']}>
                      <span className={`${styles['rfq--status-pill']} ${rfq.status === 'PUBLISHED' || rfq.status === 'BIDDING_OPEN' ? styles['rfq--status-pill-seller'] : styles['rfq--status-pill-buyer']}`}>{rfq.status}</span>
                      <span className={styles['rfq--number']}>{rfq.rfqNumber}</span>
                    </div>
                    
                    <h3 className={styles['rfq--card-title']}>{rfq.title}</h3>
                    
                    <div className={styles['rfq--urgent-icon-wrapper']}>
                      <div className={styles['rfq--urgent-badge']}>
                        <Clock className={styles['rfq--urgent-icon']} /> Urgent requirement
                      </div>
                    </div>
                    
                    <div className={styles['rfq--properties-row']}>
                      {rfq.pr && (
                        <div className={styles['rfq--stats-row']}><span>Linked RFQ:</span> <span className={styles['rfq--stat-value']}>{rfq.pr.prNumber}</span></div>
                      )}
                      <div className={styles['rfq--stats-group']}><span>Components:</span> <span className={styles['rfq--stat-value-blue']}>{rfq.items.length} parts</span></div>
                      <div className={styles['rfq--stats-items']}><span>Ends:</span> <span className={styles['rfq--stat-value-dark']}>{new Date(rfq.bidEndAt).toLocaleDateString()}</span></div>
                    </div>
                    
                    {statusFilter === 'open' && (
                      <div className={styles['rfq--actions-row']}>
                        <button
                          onClick={async () => {
                            setDetailsLoadingId(rfq.id);
                            try {
                              await handleViewRfqDetails(rfq.id);
                            } finally {
                              setDetailsLoadingId(null);
                            }
                          }}
                          disabled={detailsLoadingId === rfq.id}
                          className={styles['rfq--compare-btn']}
                        >
                          {detailsLoadingId === rfq.id ? (
                            <Loader2 className={styles['rfq--spinner']} />
                          ) : (
                            <>
                              <div className={styles['rfq--btn-content']}>
                                <FileText className={styles['rfq--btn-icon']} />
                                <span>Compare Bids & Select Winner</span>
                              </div>
                              <ChevronRight className={styles['rfq--btn-icon-alt']} />
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleEditRfq(rfq)}
                          className={styles['rfq--edit-btn']}
                        >
                          <svg className={styles['rfq--btn-icon-dark']} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          <span>Edit</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}

      {/* Selling Sub-Tab (Submitted Bids) */}
      {subTab === 'selling' && (
        <div className={styles['rfq--seller-bids']}>
          <SupplierSamplingPanel showToast={showToast} isVisible={subTab === 'selling'} />
          
          {loadingBids ? (
            <div className={styles['rfq--loading-state']}>
              <RefreshCw className={styles['rfq--loading-spinner']} />
              <span>Loading submitted quotes...</span>
            </div>
          ) : filteredBids.length === 0 ? (
            <div className={styles['rfq--empty-bids']}>No bids found matching this status.</div>
          ) : (
            filteredBids.map((bid: any) => {
              const qty = Number(bid.quantity) || 0;
              const goodsPaise =
                Number(
                  bid.materialOptionPreference === 'WITH_MATERIAL'
                    ? bid.priceWithMaterial
                    : bid.priceWithoutMaterial
                ) || 0;
              const pricing = computeBuyerPricing(goodsPaise);
              const totalQuote = paiseToRupees(goodsPaise);
              const unitPrice = qty > 0 ? totalQuote / qty : 0;
              const buyerTotal = paiseToRupees(pricing.buyerTotalPaise);
              let displayStatus = bid.status;
              let statusStyle = 'text-blue-700 bg-blue-50';

              if (bid.status === 'ACCEPTED') {
                if (bid.rfq?.status === 'COMPLETED') {
                  displayStatus = 'COMPLETED';
                  statusStyle = 'text-emerald-700 bg-emerald-50';
                } else {
                  statusStyle = 'text-emerald-700 bg-emerald-50';
                }
              } else if (bid.status === 'REJECTED') {
                statusStyle = 'text-red-700 bg-red-50';
              } else if (bid.rfq?.status === 'CANCELLED' || bid.rfq?.status === 'EXPIRED' || bid.rfq?.status === 'COMPLETED') {
                displayStatus = bid.rfq.status;
                statusStyle = 'text-gray-500 bg-gray-100';
              } else if (bid.status === 'WITHDRAWN') {
                statusStyle = 'text-gray-500 bg-gray-100';
              }

              return (
                <div key={bid.id} className={styles['rfq--card']}>
                    <div className={styles['rfq--card-header']}>
                      <span className={`${styles['rfq--dynamic-status']} ${statusStyle}`}>{displayStatus}</span>
                      <span className={styles['rfq--number']}>{bid.rfq?.rfqNumber}</span>
                    </div>
                    
                    <h3 className={styles['rfq--card-title']}>{bid.rfq?.title}</h3>
                    
                    <div className={styles['rfq--urgent-badge']}>
                      <div className={styles['rfq--urgent-badge-seller']}>
                        <Clock className={styles['rfq--urgent-badge-icon']} /> Urgent requirement
                      </div>
                    </div>
                    
                    <div className={styles['rfq--bid-card-top']}>
                      Component Bid On:
                      <div className={styles['rfq--bid-card-title']}>{bid.rfqItem?.componentName || 'Spacer ring'}</div>
                    </div>

                    <div className={styles['rfq--bid-stats']}>
                       <div className={styles['rfq--bid-stat-col']}>
                          <p className={styles['rfq--bid-stat-label']}>Your Quote:</p>
                          <p className={styles['rfq--bid-stat-value']}>₹ {totalQuote.toLocaleString('en-IN')}</p>
                          <p className={styles['rfq--bid-stat-unit']}>(₹ {unitPrice.toLocaleString('en-IN')} / unit)</p>
                       </div>
                       <div className={styles['rfq--divider']}></div>
                       <div className={styles['rfq--bid-stat-col-alt']}>
                          <p className={styles['rfq--bid-stat-label-alt']}>Buyer Pays:</p>
                          <p className={styles['rfq--bid-stat-value-alt']}>₹ {buyerTotal.toLocaleString('en-IN')}</p>
                          <p className={styles['rfq--bid-stat-sub']}>(Incl. platform fee ₹{formatInrFromPaise(pricing.commissionPaise)} + GST ₹{formatInrFromPaise(pricing.feeGstPaise)})</p>
                       </div>
                    </div>

                    <div className={styles['rfq--bid-delivery']}>
                      <svg className={styles['rfq--clock-icon']} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                      <span className={styles['rfq--delivery-label']}>Quoted Delivery:</span> <span className={styles['rfq--delivery-value']}>{bid.estimatedTimeDays} days</span>
                    </div>

                    <div className={styles['rfq--bid-actions']}>
                        <button
                          className={styles['rfq--view-details-btn']}
                        >
                          <div className={styles['rfq--btn-inner']}>
                            <FileText className={styles['rfq--btn-inner-icon']} />
                            <span>View Bid Details</span>
                          </div>
                          <ChevronRight className={styles['rfq--btn-inner-icon-alt']} />
                        </button>
                    </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Award Bid Modal */}
      {awardModal && (
        <div className={styles['rfq--modal-overlay']} onClick={() => setAwardModal(null)}>
          <div className={styles['rfq--modal-content']} onClick={e => e.stopPropagation()}>
            <h3 className={styles['rfq--modal-title']}>Award Bid</h3>
            <p className={styles['rfq--modal-desc']}>You can award the full quantity or split it.</p>
            <div className={styles['rfq--modal-form']}>
              <div>
                <label className={styles['rfq--modal-label']}>Quantity to Award</label>
                <input
                  type="number"
                  min={1}
                  max={awardModal.maxQty}
                  value={awardModal.currentQty}
                  onChange={(e) => setAwardModal({ ...awardModal, currentQty: Number(e.target.value) })}
                  className={styles['rfq--modal-input']}
                />
                <span className={styles['rfq--modal-help']}>Max available to award: {awardModal.maxQty}</span>
              </div>
              <button
                onClick={async () => {
                  if (!awardModal) return;
                  setAwardLoading(true);
                  try {
                    await handleSelectWinner(awardModal.rfqItemId, awardModal.bidId, awardModal.currentQty);
                    setAwardModal(null);
                  } finally {
                    setAwardLoading(false);
                  }
                }}
                disabled={awardLoading}
                className={styles['rfq--modal-submit']}
              >
                {awardLoading && <Loader2 className={styles['rfq--modal-spinner']} />}
                {awardLoading ? 'Awarding...' : 'Confirm Award'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: View Supplier Machinery Fleet */}
      {viewingMachinesSupplier && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => setViewingMachinesSupplier(null)}
        >
          <div
            className="relative max-w-lg w-full max-h-[85vh] bg-white border border-slate-200 rounded-3xl shadow-2xl p-5 sm:p-6 text-slate-800 flex flex-col overflow-hidden animate-in fade-in duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start pb-3.5 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0">
                  <Cog className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[#001D4A]">
                    {viewingMachinesSupplier.companyName}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Operational Machinery Fleet ({consolidatedSupplierMachines.length} equipment {consolidatedSupplierMachines.length === 1 ? 'type' : 'types'})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingMachinesSupplier(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3.5 space-y-2.5 pr-1">
              {consolidatedSupplierMachines.map((m: any, idx: number) => (
                <div
                  key={m.id || idx}
                  className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 shadow-2xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-bold text-[#001D4A]">{m.name}</span>
                    <span className="px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200/80 text-blue-700 text-[10px] font-extrabold">
                      {m.numberOfMachines || 1} {Number(m.numberOfMachines) > 1 ? 'Units' : 'Unit'}
                    </span>
                  </div>
                  {m.model && (
                    <div className="text-[11px] text-slate-600 font-medium mb-1">
                      <span className="text-slate-400">Model: </span>{m.model}
                    </div>
                  )}
                  {m.specifications && (
                    <div className="text-[11px] text-slate-600 font-medium leading-relaxed bg-white p-2 rounded-xl border border-slate-100 mt-1.5">
                      <span className="text-slate-400 font-bold block text-[10px] uppercase tracking-wider mb-0.5">Specifications</span>
                      {m.specifications}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-100 shrink-0 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingMachinesSupplier(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}