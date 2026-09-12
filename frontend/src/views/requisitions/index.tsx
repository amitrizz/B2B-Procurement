'use client';

import { useState, useRef, useEffect } from 'react';
import { 
  FileText, CheckCircle, XCircle, Plus, Loader2, Clock, 
  User, Check, AlertCircle, X, ChevronRight, ChevronDown, Layers, Package,
  Search, Filter, ArrowLeft, Tag
} from 'lucide-react';
import { RefreshButton } from '@/components/ui/RefreshButton';

interface RequisitionsTabProps {
  prs: any[];
  fetchData: () => Promise<void>;
  user: any;
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void;
  companyComponents?: any[];
  companyCategories?: any[];
}

export default function RequisitionsTab({
  prs = [],
  fetchData,
  user,
  showToast,
  companyComponents = [],
  companyCategories = []
}: RequisitionsTabProps) {
  // Top switcher between PRs and Internal Components
  const [mainView, setMainView] = useState<'prs' | 'components'>('prs');

  // PR state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'PENDING_APPROVER' | 'APPROVED' | 'REJECTED'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newItems, setNewItems] = useState<any[]>([{ componentName: companyComponents[0]?.componentName || '', quantity: 100 }]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Component state
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showAddComponentModal, setShowAddComponentModal] = useState(false);
  const [newComponentName, setNewComponentName] = useState('');
  const [newComponentCategory, setNewComponentCategory] = useState('');
  const [newComponentDesc, setNewComponentDesc] = useState('');
  const [newComponentUnit, setNewComponentUnit] = useState('pcs');
  const [compLoading, setCompLoading] = useState(false);

  // Category creation state
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDesc, setNewCategoryDesc] = useState('');
  const [catLoading, setCatLoading] = useState(false);
  const [catalogSubTab, setCatalogSubTab] = useState<'components' | 'categories'>('components');

  // Custom Category Dropdown state
  const [isCatDropdownOpen, setIsCatDropdownOpen] = useState(false);
  const catDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (catDropdownRef.current && !catDropdownRef.current.contains(e.target as Node)) {
        setIsCatDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const canManage = !user?.role || ['OWNER', 'PLATFORM_ADMIN', 'ADMIN', 'PROCUREMENT', 'BUYER'].includes(user?.role);

  // Extract all categories
  const allCategories = Array.from(
    new Set([
      ...companyCategories.map((c: any) => c.categoryName).filter(Boolean),
      ...companyComponents.map((c: any) => c.category || c.categoryName).filter(Boolean)
    ])
  );

  const handleAddItem = () => {
    setNewItems([...newItems, { componentName: companyComponents[0]?.componentName || '', quantity: 100 }]);
  };

  const handleCreatePR = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      showToast('Please enter a requisition title', 'error');
      return;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/prs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: newTitle,
          description: newDesc,
          items: newItems
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Purchase Requisition created successfully!', 'success');
        setShowCreateModal(false);
        setNewTitle('');
        setNewDesc('');
        setNewItems([{ componentName: companyComponents[0]?.componentName || '', quantity: 100 }]);
        fetchData();
      } else {
        showToast(data.message || 'Failed to create PR', 'error');
      }
    } catch {
      showToast('Error creating PR', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleApprovePR = async (prId: string, approve: boolean) => {
    setActionLoading(prId);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/v1/prs/${prId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action: approve ? 'APPROVE' : 'REJECT' })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`PR ${approve ? 'Approved' : 'Rejected'} successfully!`, 'success');
        fetchData();
      } else {
        showToast(data.message || 'Action failed', 'error');
      }
    } catch {
      showToast('Error acting on PR', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddComponent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComponentName.trim()) {
      showToast('Component Name is required', 'error');
      return;
    }
    setCompLoading(true);
    try {
      const res = await fetch('/api/v1/company/components', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          componentName: newComponentName,
          category: newComponentCategory || 'General',
          categoryName: newComponentCategory || 'General',
          description: newComponentDesc,
          defaultUnit: newComponentUnit
        })
      });
      const d = await res.json();
      if (d.success) {
        showToast('Component added to internal catalog!', 'success');
        setShowAddComponentModal(false);
        setNewComponentName('');
        setNewComponentCategory('');
        setNewComponentDesc('');
        setNewComponentUnit('pcs');
        fetchData();
      } else {
        showToast(d.message || 'Failed to add component', 'error');
      }
    } catch {
      showToast('Failed to connect to server', 'error');
    } finally {
      setCompLoading(false);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) {
      showToast('Category name is required', 'error');
      return;
    }

    setCatLoading(true);
    try {
      const res = await fetch('/api/v1/company/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          categoryName: newCategoryName.trim(),
          description: newCategoryDesc.trim()
        })
      });

      const d = await res.json();
      if (d.success) {
        showToast('Category added to catalog!', 'success');
        setShowAddCategoryModal(false);
        const createdCat = newCategoryName.trim();
        setNewCategoryName('');
        setNewCategoryDesc('');
        setSelectedCategory(createdCat);
        fetchData();
      } else {
        showToast(d.message || 'Failed to add category', 'error');
      }
    } catch {
      showToast('Failed to connect to server', 'error');
    } finally {
      setCatLoading(false);
    }
  };

  const handleOpenAddComponent = () => {
    setNewComponentCategory(allCategories[0] || 'General');
    setShowAddComponentModal(true);
  };

  const openCreatePrForComponent = (compName: string) => {
    setNewTitle(`Requisition for ${compName}`);
    setNewDesc(`Restock requirement for ${compName}`);
    setNewItems([{ componentName: compName, quantity: 100 }]);
    setShowCreateModal(true);
  };

  // Counters
  const pendingCount = prs.filter((p: any) => p.status === 'PENDING_APPROVER').length;
  const approvedCount = prs.filter((p: any) => p.status === 'APPROVED').length;
  const rejectedCount = prs.filter((p: any) => p.status === 'REJECTED').length;

  // Filtered PR list
  const filteredPrs = prs.filter((pr: any) => {
    if (statusFilter !== 'all' && pr.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNum = pr.prNumber?.toLowerCase().includes(q);
      const matchTitle = pr.title?.toLowerCase().includes(q);
      const matchLine = pr.lines?.some((l: any) => l.componentName?.toLowerCase().includes(q));
      return matchNum || matchTitle || matchLine;
    }
    return true;
  });

  // Filtered Components list
  const filteredComponents = companyComponents.filter((comp: any) => {
    const compCategory = comp.category || comp.categoryName || 'General';
    if (selectedCategory !== 'all' && compCategory.toLowerCase() !== selectedCategory.toLowerCase()) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        comp.componentName?.toLowerCase().includes(q) ||
        compCategory.toLowerCase().includes(q) ||
        comp.description?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Category cards list for Categories sub-tab
  const categoryCardsList = allCategories.map((catName: string) => {
    const fromApi = companyCategories.find((c: any) => c.categoryName?.toLowerCase() === catName.toLowerCase());
    const count = companyComponents.filter(
      (c: any) => (c.category || c.categoryName || 'General').toLowerCase() === catName.toLowerCase()
    ).length;
    return {
      name: catName,
      description: fromApi?.description || `Standard category for ${catName.toLowerCase()} components and materials.`,
      componentCount: count
    };
  });

  const filteredCategoryCards = categoryCardsList.filter((cat) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return cat.name.toLowerCase().includes(q) || cat.description.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      {/* ---------------------------------------------------- */}
      {/* VIEW 1: PURCHASE REQUISITIONS (PRs) */}
      {/* ---------------------------------------------------- */}
      {mainView === 'prs' && (
        <>
          {/* Top Header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#001D4A]">
                Purchase Requisitions (PR)
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Internal approvals required before publishing an RFQ.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <RefreshButton onRefresh={fetchData} />
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all"
              >
                <Plus className="w-4 h-4" /> Create PR
              </button>
            </div>
          </div>

          {/* Internal Components Entry Button (From Reference Image 1) */}
          <div>
            <button
              onClick={() => { setMainView('components'); setSearchQuery(''); setSelectedCategory('all'); }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-xs sm:text-sm font-semibold shadow-xs transition-all active:scale-95"
            >
              <Package className="w-4 h-4 text-white" />
              <span>Internal Components</span>
              <ChevronRight className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* Status Filter Pills & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-0.5 custom-scrollbar">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all ${
                  statusFilter === 'all'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50'
                }`}
              >
                All ({prs.length})
              </button>
              <button
                onClick={() => setStatusFilter('PENDING_APPROVER')}
                className={`px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all ${
                  statusFilter === 'PENDING_APPROVER'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50'
                }`}
              >
                Pending ({pendingCount})
              </button>
              <button
                onClick={() => setStatusFilter('APPROVED')}
                className={`px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all ${
                  statusFilter === 'APPROVED'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50'
                }`}
              >
                Approved ({approvedCount})
              </button>
              <button
                onClick={() => setStatusFilter('REJECTED')}
                className={`px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all ${
                  statusFilter === 'REJECTED'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50'
                }`}
              >
                Rejected ({rejectedCount})
              </button>
            </div>

            {/* Compact Search Bar */}
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search PR by title or component..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl placeholder:text-slate-400 text-[#001D4A] focus:outline-none focus:border-blue-500 shadow-2xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Compact PR Cards List */}
          <div className="space-y-2.5">
            {filteredPrs.length === 0 ? (
              <div className="py-12 text-center bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
                <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-bold text-[#001D4A]">No Purchase Requisitions found</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {statusFilter === 'all'
                    ? 'Create a requisition to get internal approval.'
                    : `No requisitions found with status: ${statusFilter}`}
                </p>
                {statusFilter === 'all' && (
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" /> Create Your First PR
                  </button>
                )}
              </div>
            ) : (
              filteredPrs.map((pr: any) => {
                const isPending = pr.status === 'PENDING_APPROVER';
                const isApproved = pr.status === 'APPROVED';
                const isRejected = pr.status === 'REJECTED';
                const canApprove = isPending && ['OWNER', 'PLATFORM_ADMIN'].includes(user?.role);
                const isMakerWaiting = isPending && pr.createdByUserId === user?.id && !['OWNER', 'PLATFORM_ADMIN'].includes(user?.role);

                const formattedDate = pr.createdAt 
                  ? new Date(pr.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                  : '';

                return (
                  <div
                    key={pr.id}
                    className="bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200/90 shadow-2xs hover:shadow-sm hover:border-blue-200 transition-all flex flex-col gap-2"
                  >
                    {/* Compact Top Row: Number, Date, Status */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-bold text-[#001D4A] bg-slate-100 px-2 py-0.5 rounded border border-slate-200/80">
                          {pr.prNumber}
                        </span>
                        {formattedDate && (
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {formattedDate}
                          </span>
                        )}
                      </div>

                      {/* Status Badge */}
                      <div>
                        {isApproved && (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div> APPROVED
                          </span>
                        )}
                        {isPending && (
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
                            <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></div> PENDING
                          </span>
                        )}
                        {isRejected && (
                          <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
                            <div className="w-1.5 h-1.5 bg-rose-500 rounded-full"></div> REJECTED
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Title & Component Chips Inline */}
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-[#001D4A] leading-tight">
                        {pr.title}
                      </h3>

                      {/* Component Chips */}
                      {pr.lines && pr.lines.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {pr.lines.map((line: any, i: number) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50/70 border border-blue-100 rounded-md text-[11px] font-medium text-slate-700"
                            >
                              <Package className="w-3 h-3 text-blue-500" />
                              <span>{line.componentName}</span>
                              <span className="text-blue-600 font-bold">× {line.quantity} pcs</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Bottom Row: Creator & Actions */}
                    <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-100">
                      <div className="flex items-center gap-1 text-[10px] text-slate-400">
                        <User className="w-3 h-3" />
                        <span>Created by:</span>
                        <span className="font-semibold text-slate-600 truncate max-w-[140px] sm:max-w-none">
                          {pr.creator?.name || pr.creator?.email || pr.createdByUserId}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {canApprove && (
                          <>
                            <button
                              onClick={() => handleApprovePR(pr.id, true)}
                              disabled={actionLoading === pr.id}
                              className="py-1 px-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-[10px] font-bold transition-all shadow-xs flex items-center gap-1"
                            >
                              {actionLoading === pr.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <CheckCircle className="w-3 h-3" />
                              )}
                              <span>Approve</span>
                            </button>
                            <button
                              onClick={() => handleApprovePR(pr.id, false)}
                              disabled={actionLoading === pr.id}
                              className="py-1 px-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 disabled:opacity-50 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1"
                            >
                              {actionLoading === pr.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <XCircle className="w-3 h-3" />
                              )}
                              <span>Reject</span>
                            </button>
                          </>
                        )}

                        {isMakerWaiting && (
                          <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/80 font-medium italic">
                            Awaiting Approval
                          </span>
                        )}

                        {isApproved && (
                          <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                            <Check className="w-3 h-3 text-emerald-500" />
                            Ready to link with RFQ
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* ---------------------------------------------------- */}
      {/* VIEW 2: INTERNAL COMPONENTS & CATEGORIES CATALOG */}
      {/* ---------------------------------------------------- */}
      {mainView === 'components' && (
        <div className="space-y-3.5 animate-in fade-in duration-150">
          {/* Top Bar: Back Button at Top Left, Dynamic Action Button on Right */}
          <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-100">
            <button
              onClick={() => { setMainView('prs'); setSearchQuery(''); setSelectedCategory('all'); }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-[#001D4A] rounded-full text-xs font-bold transition-all active:scale-95"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Purchase Requisitions</span>
            </button>

            <div className="flex items-center gap-2 shrink-0">
              <RefreshButton onRefresh={fetchData} />
            </div>
          </div>

          {/* Sub-Tabs: Components vs Categories */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setCatalogSubTab('components'); setSearchQuery(''); }}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 ${
                catalogSubTab === 'components'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200/90 hover:bg-slate-50'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Components ({companyComponents.length})</span>
            </button>

            <button
              onClick={() => { setCatalogSubTab('categories'); setSearchQuery(''); }}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 ${
                catalogSubTab === 'categories'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200/90 hover:bg-slate-50'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Categories ({allCategories.length})</span>
            </button>
          </div>

          {/* TAB 1: COMPONENTS VIEW */}
          {catalogSubTab === 'components' && (
            <div className="space-y-3">
              {/* Category Dropdown Filter */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Filter className="w-3 h-3 text-blue-600" /> Filter by Category
                  </span>
                  <div className="flex items-center gap-2">
                    {selectedCategory !== 'all' && (
                      <button
                        onClick={() => setSelectedCategory('all')}
                        className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-0.5"
                      >
                        <X className="w-2.5 h-2.5" /> Clear Filter
                      </button>
                    )}
                    <span className="text-[11px] text-slate-400 font-medium">
                      {filteredComponents.length} component{filteredComponents.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1" ref={catDropdownRef}>
                  {/* Custom Dropdown Trigger Button */}
                  <button
                    type="button"
                    onClick={() => setIsCatDropdownOpen(!isCatDropdownOpen)}
                    className={`w-full pl-3 pr-3.5 py-2 bg-white border rounded-xl text-xs font-semibold text-[#001D4A] shadow-2xs flex items-center justify-between transition-all cursor-pointer ${
                      isCatDropdownOpen
                        ? 'border-blue-500 ring-2 ring-blue-500/10'
                        : 'border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-5 h-5 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                        <Tag className="w-3 h-3" />
                      </div>
                      <span className="truncate">
                        {selectedCategory === 'all'
                          ? `All Categories (${companyComponents.length})`
                          : `${selectedCategory} (${
                              companyComponents.filter(
                                (c: any) =>
                                  (c.category || c.categoryName || 'General').toLowerCase() ===
                                  selectedCategory.toLowerCase()
                              ).length
                            })`}
                      </span>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${
                        isCatDropdownOpen ? 'rotate-180 text-blue-600' : ''
                      }`}
                    />
                  </button>

                  {/* Custom Dropdown Menu Popover */}
                  {isCatDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200/95 rounded-2xl shadow-xl z-40 p-1.5 space-y-1 max-h-60 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-150">
                      {/* Option: All Categories */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCategory('all');
                          setIsCatDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                          selectedCategory === 'all'
                            ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200/70'
                            : 'text-slate-700 hover:bg-slate-50 hover:text-[#001D4A]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Tag className={`w-3.5 h-3.5 ${selectedCategory === 'all' ? 'text-blue-600' : 'text-slate-400'}`} />
                          <span>All Categories</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              selectedCategory === 'all'
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {companyComponents.length}
                          </span>
                          {selectedCategory === 'all' && (
                            <Check className="w-3.5 h-3.5 text-blue-600" />
                          )}
                        </div>
                      </button>

                      {/* Options: Individual Categories */}
                      {allCategories.map((cat: string) => {
                        const count = companyComponents.filter(
                          (c: any) =>
                            (c.category || c.categoryName || 'General').toLowerCase() ===
                            cat.toLowerCase()
                        ).length;
                        const isSelected = selectedCategory.toLowerCase() === cat.toLowerCase();

                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => {
                              setSelectedCategory(cat);
                              setIsCatDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200/70'
                                : 'text-slate-700 hover:bg-slate-50 hover:text-[#001D4A]'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <Tag className={`w-3.5 h-3.5 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`} />
                              <span>{cat}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  isSelected
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-100 text-slate-500'
                                }`}
                              >
                                {count}
                              </span>
                              {isSelected && (
                                <Check className="w-3.5 h-3.5 text-blue-600" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  </div>

                  {/* Add Component Button Next to Dropdown */}
                  {canManage && (
                    <button
                      type="button"
                      onClick={handleOpenAddComponent}
                      className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95 whitespace-nowrap"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Component</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Search bar */}
              <div className="relative w-full">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search internal components by name, category, or spec..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl placeholder:text-slate-400 text-[#001D4A] focus:outline-none focus:border-blue-500 shadow-2xs"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Components Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {filteredComponents.length === 0 ? (
                  <div className="col-span-full py-12 text-center bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
                    <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-bold text-[#001D4A]">No components found</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {selectedCategory !== 'all'
                        ? `No components found in category "${selectedCategory}".`
                        : canManage ? 'Add your company standard components to use them in PRs and RFQs.' : 'No components registered.'}
                    </p>
                    {canManage && (
                      <button
                        onClick={handleOpenAddComponent}
                        className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Component
                      </button>
                    )}
                  </div>
                ) : (
                  filteredComponents.map((comp: any) => (
                    <div
                      key={comp.id}
                      className="bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200/90 shadow-2xs hover:shadow-xs hover:border-blue-200 transition-all flex flex-col justify-between gap-2.5"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                              <Package className="w-3.5 h-3.5" />
                            </div>
                            <h4 className="font-bold text-sm text-[#001D4A] truncate">
                              {comp.componentName}
                            </h4>
                          </div>
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-semibold shrink-0 border border-slate-200/60">
                            {comp.defaultUnit || 'pcs'}
                          </span>
                        </div>

                        {/* Category Pill Badge */}
                        <div>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200/80 rounded-md text-[10px] font-bold">
                            <Tag className="w-2.5 h-2.5 text-blue-600" />
                            <span>{comp.category || comp.categoryName || 'General'}</span>
                          </span>
                        </div>

                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                          {comp.description || 'Standard procurement component item.'}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                        <span className="text-[10px] text-slate-400 font-mono">
                          Unit: {comp.defaultUnit || 'pcs'}
                        </span>
                        <button
                          onClick={() => openCreatePrForComponent(comp.componentName)}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg text-[10px] transition-all flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> Create PR
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 2: CATEGORIES VIEW */}
          {catalogSubTab === 'categories' && (
            <div className="space-y-3">
              {/* Search bar & Add Category Button */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search categories by name or description..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-8 py-2 text-xs bg-white border border-slate-200 rounded-xl placeholder:text-slate-400 text-[#001D4A] focus:outline-none focus:border-blue-500 shadow-2xs"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {canManage && (
                  <button
                    type="button"
                    onClick={() => setShowAddCategoryModal(true)}
                    className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95 whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Category</span>
                  </button>
                )}
              </div>

              {/* Categories Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {filteredCategoryCards.length === 0 ? (
                  <div className="col-span-full py-12 text-center bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
                    <Tag className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-bold text-[#001D4A]">No categories found</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Create standard component categories to organize your internal catalog.
                    </p>
                    {canManage && (
                      <button
                        onClick={() => setShowAddCategoryModal(true)}
                        className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Category
                      </button>
                    )}
                  </div>
                ) : (
                  filteredCategoryCards.map((cat) => (
                    <div
                      key={cat.name}
                      className="bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200/90 shadow-2xs hover:shadow-xs hover:border-blue-200 transition-all flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                              <Tag className="w-3.5 h-3.5" />
                            </div>
                            <h4 className="font-bold text-sm text-[#001D4A] truncate">
                              {cat.name}
                            </h4>
                          </div>
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-[10px] font-bold shrink-0 border border-blue-200/60">
                            {cat.componentCount} {cat.componentCount === 1 ? 'item' : 'items'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                          {cat.description}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                        <span className="text-[10px] text-slate-400 font-medium">
                          Category Catalog
                        </span>
                        <button
                          onClick={() => {
                            setSelectedCategory(cat.name);
                            setCatalogSubTab('components');
                          }}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 font-bold rounded-lg text-[10px] transition-all flex items-center gap-1"
                        >
                          <span>View Components</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* Create PR Modal */}
      {/* ---------------------------------------------------- */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-5 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-extrabold text-[#001D4A]">Create Purchase Requisition</h3>
                <p className="text-xs text-slate-400 mt-0.5">Submit item requirements for internal company approval</p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePR} className="space-y-3.5 flex-1 overflow-y-auto pt-3.5 pr-1 custom-scrollbar">
              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Requisition Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g., Q3 Restock of Fasteners"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-[#001D4A] placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-blue-500 transition-all font-medium"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Description / Justification
                </label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Reason for procurement, budget reference, or department notes..."
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-[#001D4A] placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-blue-500 transition-all font-medium resize-none"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    PR Line Items <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-xs text-blue-600 font-bold hover:text-blue-700 flex items-center gap-1 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Item
                  </button>
                </div>

                {newItems.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-end bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                    <div className="flex-1 space-y-1">
                      <label className="text-[10px] text-slate-500 font-bold">Component Name</label>
                      {companyComponents && companyComponents.length > 0 ? (
                        <select
                          required
                          value={item.componentName}
                          onChange={(e) => {
                            const arr = [...newItems];
                            arr[idx].componentName = e.target.value;
                            setNewItems(arr);
                          }}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#001D4A] focus:outline-none focus:border-blue-500"
                        >
                          <option value="" disabled>Select component...</option>
                          {companyComponents.map(c => (
                            <option key={c.id} value={c.componentName}>{c.componentName}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          required
                          placeholder="e.g. M8 Stainless Nut"
                          value={item.componentName}
                          onChange={(e) => {
                            const arr = [...newItems];
                            arr[idx].componentName = e.target.value;
                            setNewItems(arr);
                          }}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#001D4A] focus:outline-none focus:border-blue-500"
                        />
                      )}
                    </div>
                    <div className="w-24 space-y-1">
                      <label className="text-[10px] text-slate-500 font-bold">Quantity</label>
                      <input
                        type="number"
                        required
                        min="1"
                        value={item.quantity}
                        onChange={(e) => {
                          const arr = [...newItems];
                          arr[idx].quantity = Number(e.target.value);
                          setNewItems(arr);
                        }}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#001D4A] focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    {newItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setNewItems(newItems.filter((_, i) => i !== idx))}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all shadow-xs flex items-center justify-center gap-1.5"
                >
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Submit for Approval</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* Add Component Modal (With Category Selection & Entry) */}
      {/* ---------------------------------------------------- */}
      {showAddComponentModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-5 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-extrabold text-[#001D4A]">Add Internal Component</h3>
                <p className="text-xs text-slate-400 mt-0.5">Register a standard component with category</p>
              </div>
              <button
                onClick={() => setShowAddComponentModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddComponent} className="space-y-3.5 pt-3.5">
              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Component Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Gear Box, Control Panel, M10 Bolt"
                  value={newComponentName}
                  onChange={(e) => setNewComponentName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-[#001D4A] placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-blue-500 transition-all font-medium"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddComponentModal(false);
                      setShowAddCategoryModal(true);
                    }}
                    className="text-[10px] font-bold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-0.5"
                  >
                    <Plus className="w-2.5 h-2.5" /> New Category
                  </button>
                </div>
                <select
                  required
                  value={newComponentCategory}
                  onChange={(e) => setNewComponentCategory(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-[#001D4A] focus:bg-white focus:outline-none focus:border-blue-500 transition-all"
                >
                  <option value="" disabled>-- Select Category --</option>
                  {allCategories.map((cat, idx) => (
                    <option key={idx} value={cat}>
                      {cat}
                    </option>
                  ))}
                  {allCategories.length === 0 && (
                    <option value="General">General</option>
                  )}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  Selected from your company standard category catalog
                </p>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Default Unit
                </label>
                <select
                  value={newComponentUnit}
                  onChange={(e) => setNewComponentUnit(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-[#001D4A] focus:bg-white focus:outline-none focus:border-blue-500 transition-all"
                >
                  <option value="pcs">Pieces (pcs)</option>
                  <option value="kg">Kilograms (kg)</option>
                  <option value="meter">Meters (meter)</option>
                  <option value="set">Set (set)</option>
                  <option value="box">Box (box)</option>
                  <option value="ton">Tons (ton)</option>
                  <option value="liter">Liters (liter)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Description / Specifications
                </label>
                <textarea
                  rows={2}
                  placeholder="Standard material spec, dimensions, or internal part number..."
                  value={newComponentDesc}
                  onChange={(e) => setNewComponentDesc(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-[#001D4A] placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-blue-500 transition-all font-medium resize-none"
                />
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddComponentModal(false)}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={compLoading}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all shadow-xs flex items-center justify-center gap-1.5"
                >
                  {compLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Component</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* Add Category Modal */}
      {/* ---------------------------------------------------- */}
      {showAddCategoryModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shrink-0">
                  <Tag className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#001D4A]">Add Category</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Create a category to group internal components</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddCategoryModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddCategory} className="space-y-3.5 pt-3.5">
              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Raw Materials, Fasteners, Electrical, Hydraulics"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-[#001D4A] placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-blue-500 transition-all font-medium"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Description <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Brief description of this component category..."
                  value={newCategoryDesc}
                  onChange={(e) => setNewCategoryDesc(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-[#001D4A] placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-blue-500 transition-all font-medium resize-none"
                />
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddCategoryModal(false)}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={catLoading}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all shadow-xs flex items-center justify-center gap-1.5"
                >
                  {catLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Category</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
