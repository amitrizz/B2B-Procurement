'use client';

import { useState, useEffect } from 'react';
import {
  Building,
  ShieldCheck,
  CreditCard,
  Users,
  FileText,
  ExternalLink,
  X,
  Loader2,
  CheckCircle,
  Clock,
  AlertCircle,
  Calendar,
  MapPin,
  Phone,
  Mail,
  UserCheck,
  Package,
  ShoppingCart,
  TrendingUp,
  Tag,
  ShieldAlert,
} from 'lucide-react';

interface CompanyDetailModalProps {
  companyId: string;
  onClose: () => void;
  onImpersonate?: (company: any) => void;
  onToggleActive?: (companyId: string, currentIsActive: boolean) => Promise<void>;
  onVerifyCompany?: (companyId: string) => Promise<void>;
}

const formatInr = (paise: number) =>
  `₹${((paise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function CompanyDetailModal({
  companyId,
  onClose,
  onImpersonate,
  onToggleActive,
  onVerifyCompany,
}: CompanyDetailModalProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'bank' | 'kyc' | 'users' | 'activity'>('overview');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    const fetchDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        const res = await fetch(`/api/v1/admin/companies/${companyId}/details?_t=${Date.now()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (json.success && json.data) {
          setData(json.data);
        } else {
          setError(json.message || 'Failed to load company details');
        }
      } catch (err: any) {
        setError(err?.message || 'Error loading company details');
      } finally {
        setLoading(false);
      }
    };

    if (companyId) {
      fetchDetails();
    }
  }, [companyId]);

  if (!companyId) return null;

  const company = data?.company;
  const addresses = data?.addresses || [];
  const bankAccount = data?.bankAccount;
  const capability = data?.capability;
  const documents = data?.documents || [];
  const users = data?.users || [];
  const stats = data?.stats;

  const handleVerify = async () => {
    if (!onVerifyCompany || !company) return;
    setActionLoading('verify');
    try {
      await onVerifyCompany(company.id);
      setData((prev: any) => ({
        ...prev,
        company: { ...prev.company, status: 'VERIFIED' },
      }));
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggle = async () => {
    if (!onToggleActive || !company) return;
    setActionLoading('toggle');
    try {
      await onToggleActive(company.id, company.isActive);
      setData((prev: any) => ({
        ...prev,
        company: { ...prev.company, isActive: !prev.company.isActive },
      }));
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-2xl w-full max-w-4xl h-[94vh] sm:h-auto sm:max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* 1. Modal Top Bar (shrink-0) */}
        <div className="shrink-0 px-4 sm:px-6 py-3.5 sm:py-4 bg-slate-50/90 border-b border-slate-200">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-blue-600/10 text-blue-700 flex items-center justify-center shrink-0 border border-blue-600/20 shadow-2xs mt-0.5">
                <Building className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-black text-[#001D4A] break-words">
                    {company?.name || 'Company Profile'}
                  </h2>
                  {company && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider border ${
                          company.isActive
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {company.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider border ${
                          company.status === 'VERIFIED'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : company.status === 'REJECTED'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {company.status}
                      </span>
                    </div>
                  )}
                </div>

                {/* Company Meta Badges (never wrapping awkwardly) */}
                <div className="flex items-center gap-x-3 gap-y-1 mt-1.5 flex-wrap text-xs text-slate-500">
                  {company?.gstin && (
                    <span className="whitespace-nowrap flex items-center gap-1">
                      <span className="text-slate-400 text-[11px]">GSTIN:</span>{' '}
                      <strong className="text-slate-800 font-mono text-[11px] font-semibold">{company.gstin}</strong>
                    </span>
                  )}
                  {company?.pan && (
                    <span className="whitespace-nowrap flex items-center gap-1">
                      <span className="text-slate-400 text-[11px]">PAN:</span>{' '}
                      <strong className="text-slate-800 font-mono text-[11px] font-semibold">{company.pan}</strong>
                    </span>
                  )}
                  {company?.phone && (
                    <span className="whitespace-nowrap flex items-center gap-1">
                      <span className="text-slate-400 text-[11px]">Phone:</span>{' '}
                      <strong className="text-slate-800 text-[11px] font-semibold">{company.phone}</strong>
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl hover:bg-slate-200/70 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Action Buttons Row */}
          {company && (
            <div className="flex items-center gap-2 mt-2.5 pt-2.5 border-t border-slate-200/70 flex-wrap">
              {onImpersonate && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onImpersonate(company);
                  }}
                  className="py-1.5 px-3 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 shadow-2xs cursor-pointer"
                  title={`Impersonate ${company.name}`}
                >
                  <UserCheck className="w-3.5 h-3.5 text-purple-600" />
                  <span>Impersonate</span>
                </button>
              )}

              {onToggleActive && (
                <button
                  type="button"
                  onClick={handleToggle}
                  disabled={actionLoading === 'toggle'}
                  className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border shadow-2xs cursor-pointer ${
                    company.isActive
                      ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                  }`}
                >
                  {actionLoading === 'toggle' && <Loader2 className="w-3 h-3 animate-spin" />}
                  <span>{company.isActive ? 'Disable Company' : 'Enable Company'}</span>
                </button>
              )}

              {(company.status === 'PENDING' || company.status === 'UNDER_REVIEW') && onVerifyCompany && (
                <button
                  type="button"
                  onClick={handleVerify}
                  disabled={actionLoading === 'verify'}
                  className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  {actionLoading === 'verify' && <Loader2 className="w-3 h-3 animate-spin" />}
                  <span>Approve KYC (Verify)</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* 2. Tab Navigation (shrink-0, sticky, always visible at top of modal body) */}
        <div className="shrink-0 sticky top-0 z-20 bg-white border-b border-slate-200 px-3 sm:px-6 flex gap-1 sm:gap-2 overflow-x-auto scrollbar-none shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`shrink-0 whitespace-nowrap py-2.5 sm:py-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'overview'
                ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Building className="w-3.5 h-3.5" /> Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('bank')}
            className={`shrink-0 whitespace-nowrap py-2.5 sm:py-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'bank'
                ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" /> Bank Details
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('kyc')}
            className={`shrink-0 whitespace-nowrap py-2.5 sm:py-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'kyc'
                ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" /> KYC Docs ({documents.length}/4)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`shrink-0 whitespace-nowrap py-2.5 sm:py-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'users'
                ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" /> Team ({users.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('activity')}
            className={`shrink-0 whitespace-nowrap py-2.5 sm:py-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'activity'
                ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" /> Activity & Orders
          </button>
        </div>

        {/* 3. Modal Body (flex-1 overflow-y-auto min-h-0) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 min-h-0">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
              <p className="text-xs text-slate-500 font-semibold">Loading complete company profile...</p>
            </div>
          ) : error ? (
            <div className="py-16 text-center">
              <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-800">{error}</p>
            </div>
          ) : !data ? null : (
            <>
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Quick Stat Highlights */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-100">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block">
                        Orders as Buyer
                      </span>
                      <span className="text-xl font-black text-[#001D4A] mt-1 block">
                        {stats?.ordersAsBuyer?.count || 0}
                      </span>
                      <span className="text-[11px] text-blue-700 font-medium mt-0.5 block">
                        {formatInr(stats?.ordersAsBuyer?.totalAmount || 0)}
                      </span>
                    </div>

                    <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                        Orders as Supplier
                      </span>
                      <span className="text-xl font-black text-[#001D4A] mt-1 block">
                        {stats?.ordersAsSupplier?.count || 0}
                      </span>
                      <span className="text-[11px] text-emerald-700 font-medium mt-0.5 block">
                        {formatInr(stats?.ordersAsSupplier?.totalAmount || 0)}
                      </span>
                    </div>

                    <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-100">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 block">
                        RFQs Created
                      </span>
                      <span className="text-xl font-black text-[#001D4A] mt-1 block">
                        {stats?.rfqs?.createdCount || 0}
                      </span>
                      <span className="text-[11px] text-purple-700 font-medium mt-0.5 block">
                        Requirements
                      </span>
                    </div>

                    <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-100">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">
                        Bids Won / Placed
                      </span>
                      <span className="text-xl font-black text-[#001D4A] mt-1 block">
                        {stats?.bids?.wonCount || 0} / {stats?.bids?.submittedCount || 0}
                      </span>
                      <span className="text-[11px] text-amber-700 font-medium mt-0.5 block">
                        Quotes & Bids
                      </span>
                    </div>
                  </div>

                  {/* Company Profile Details Grid */}
                  <div className="bg-slate-50/60 rounded-2xl p-5 border border-slate-200/80 space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Company Profile Information
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[11px]">Legal Entity Name</span>
                        <strong className="text-slate-800 font-semibold">{company.name}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">GSTIN Number</span>
                        <strong className="text-slate-800 font-mono font-semibold">{company.gstin}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">PAN Number</span>
                        <strong className="text-slate-800 font-mono font-semibold">{company.pan || 'Not provided'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Contact Phone</span>
                        <strong className="text-slate-800 font-semibold">{company.phone || 'Not provided'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Registered On</span>
                        <strong className="text-slate-800 font-semibold">
                          {company.createdAt ? new Date(company.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : 'N/A'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Drawings NDA Accepted</span>
                        <strong className="text-slate-800 font-semibold">
                          {company.drawingsNdaAcceptedAt ? (
                            <span className="text-emerald-700 font-bold flex items-center gap-1">
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Yes ({new Date(company.drawingsNdaAcceptedAt).toLocaleDateString('en-IN')})
                            </span>
                          ) : (
                            <span className="text-amber-700">Pending</span>
                          )}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">PR Approval Mandatory</span>
                        <strong className="text-slate-800 font-semibold">
                          {company.requirePr ? 'Required for RFQ' : 'Not Required'}
                        </strong>
                      </div>
                      {company.kycRejectReason && (
                        <div className="col-span-full p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700">
                          <span className="font-bold block text-[11px]">KYC Rejection Reason:</span>
                          <span className="text-xs">{company.kycRejectReason}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Addresses */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-blue-600" /> Registered Locations & Addresses ({addresses.length})
                    </h3>
                    {addresses.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No addresses on file.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {addresses.map((addr: any) => (
                          <div
                            key={addr.id}
                            className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-1 relative"
                          >
                            {addr.isPrimary && (
                              <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200 uppercase">
                                Primary
                              </span>
                            )}
                            <p className="text-xs font-bold text-slate-800">{addr.addressLine1}</p>
                            {addr.addressLine2 && <p className="text-xs text-slate-600">{addr.addressLine2}</p>}
                            <p className="text-xs text-slate-500">
                              {addr.city}, {addr.state} - <strong className="text-slate-700 font-mono">{addr.pincode}</strong>
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Capabilities */}
                  {capability && (
                    <div className="p-5 rounded-2xl bg-slate-50/60 border border-slate-200/80 space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-blue-600" /> Manufacturing Capabilities & Processes
                      </h3>
                      {capability.processes?.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {capability.processes.map((proc: string, i: number) => (
                            <span
                              key={i}
                              className="px-3 py-1 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg shadow-2xs"
                            >
                              {proc}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">No processes registered.</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: BANK ACCOUNT */}
              {activeTab === 'bank' && (
                <div className="space-y-6">
                  {bankAccount ? (
                    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-4 max-w-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-5 h-5 text-blue-600" />
                          <h3 className="font-extrabold text-sm text-[#001D4A]">Primary Bank Account</h3>
                        </div>
                        {bankAccount.isPrimary && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                            Verified for Escrow
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-xs pt-2">
                        <div>
                          <span className="text-slate-400 block text-[11px]">Account Holder Name</span>
                          <strong className="text-slate-800 text-sm font-bold">{bankAccount.accountName}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">IFSC Code</span>
                          <strong className="text-slate-800 text-sm font-mono font-bold">{bankAccount.ifsc}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">Account Number</span>
                          <strong className="text-slate-800 text-sm font-mono font-bold">
                            •••• •••• {bankAccount.accountNumberLast4}
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">Added On</span>
                          <strong className="text-slate-800 text-xs font-semibold">
                            {bankAccount.createdAt ? new Date(bankAccount.createdAt).toLocaleDateString('en-IN') : 'N/A'}
                          </strong>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-16 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-6">
                      <CreditCard className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm font-bold text-slate-700">No Bank Account Details On File</p>
                      <p className="text-xs text-slate-400 mt-1">This company has not linked a bank account yet.</p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: KYC DOCUMENTS */}
              {activeTab === 'kyc' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Uploaded Verification Documents ({documents.length}/4)
                    </h3>
                  </div>

                  {documents.length === 0 ? (
                    <div className="py-16 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-6">
                      <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm font-bold text-slate-700">No KYC Documents Uploaded</p>
                      <p className="text-xs text-slate-400 mt-1">Company has not submitted verification documents.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {documents.map((doc: any) => (
                        <div
                          key={doc.id}
                          className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex items-center justify-between gap-3 hover:border-blue-200 transition-all"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                              <FileText className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-xs text-slate-800 truncate">
                                {doc.documentType.replace(/_/g, ' ')}
                              </p>
                              <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1 mt-0.5">
                                <CheckCircle className="w-3 h-3 text-emerald-500" /> Uploaded Document
                              </span>
                            </div>
                          </div>

                          <a
                            href={`/api/v1/upload/${doc.fileId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="py-1.5 px-3 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shrink-0 shadow-2xs"
                          >
                            <span>View</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: USERS / TEAM */}
              {activeTab === 'users' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Associated Team Members & Users ({users.length})
                    </h3>
                  </div>

                  {users.length === 0 ? (
                    <div className="py-16 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-6">
                      <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm font-bold text-slate-700">No Users Found</p>
                      <p className="text-xs text-slate-400 mt-1">No user accounts registered under this company.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
                      {users.map((u: any) => (
                        <div key={u.id} className="p-4 flex items-center justify-between gap-4 flex-wrap hover:bg-slate-50/60 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 font-bold text-sm flex items-center justify-center shrink-0">
                              {(u.name || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-xs text-[#001D4A]">{u.name}</h4>
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200 uppercase">
                                  {u.role}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 flex items-center gap-3 mt-0.5">
                                <span className="flex items-center gap-1">
                                  <Mail className="w-3 h-3 text-slate-400" /> {u.email}
                                </span>
                                {u.phone && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="w-3 h-3 text-slate-400" /> {u.phone}
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>

                          <div className="text-right text-[11px] text-slate-400">
                            <span>Joined: {u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN') : 'N/A'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: ACTIVITY & ORDERS */}
              {activeTab === 'activity' && (
                <div className="space-y-6">
                  {/* Buying Orders */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <ShoppingCart className="w-3.5 h-3.5 text-blue-600" /> Recent Purchase Orders (Buyer Side)
                      </h3>
                      <span className="text-xs font-bold text-blue-600">
                        Total: {formatInr(stats?.ordersAsBuyer?.totalAmount || 0)}
                      </span>
                    </div>

                    {!stats?.ordersAsBuyer?.recentOrders || stats.ordersAsBuyer.recentOrders.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No purchase orders on file.</p>
                    ) : (
                      <div className="divide-y divide-slate-100 bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
                        {stats.ordersAsBuyer.recentOrders.map((o: any) => (
                          <div key={o.id} className="p-3.5 flex items-center justify-between text-xs">
                            <div>
                              <strong className="text-slate-800 font-mono block">{o.poNumber}</strong>
                              <span className="text-[10px] text-slate-400">
                                {new Date(o.createdAt).toLocaleDateString('en-IN')}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="font-extrabold text-[#001D4A] block">{formatInr(o.totalAmount)}</span>
                              <span className="text-[10px] font-bold text-blue-600">{o.status}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Supplier Orders */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5 text-emerald-600" /> Recent Sales Orders (Supplier Side)
                      </h3>
                      <span className="text-xs font-bold text-emerald-600">
                        Total: {formatInr(stats?.ordersAsSupplier?.totalAmount || 0)}
                      </span>
                    </div>

                    {!stats?.ordersAsSupplier?.recentOrders || stats.ordersAsSupplier.recentOrders.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No sales orders fulfilled yet.</p>
                    ) : (
                      <div className="divide-y divide-slate-100 bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
                        {stats.ordersAsSupplier.recentOrders.map((o: any) => (
                          <div key={o.id} className="p-3.5 flex items-center justify-between text-xs">
                            <div>
                              <strong className="text-slate-800 font-mono block">{o.poNumber}</strong>
                              <span className="text-[10px] text-slate-400">
                                {new Date(o.createdAt).toLocaleDateString('en-IN')}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="font-extrabold text-[#001D4A] block">{formatInr(o.totalAmount)}</span>
                              <span className="text-[10px] font-bold text-emerald-600">{o.status}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition-all cursor-pointer shadow-2xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
