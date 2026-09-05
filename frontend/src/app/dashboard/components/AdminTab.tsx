import { useState } from 'react';
import InvoiceDetailModal from '@/components/InvoiceDetailModal';
import { RefreshButton } from '@/components/ui/RefreshButton';
import {
  FileText,
  ExternalLink,
  X,
  Loader2,
  Truck,
  Users,
  Building,
  Clock,
  Receipt,
  ShieldCheck,
  MessageSquare,
} from 'lucide-react';
import AdminChatQaSection from './AdminChatQaSection';

type AdminSection = 'verification' | 'escrow' | 'invoices' | 'users' | 'samples' | 'chat_qa';

const ADMIN_TABS: {
  id: AdminSection;
  label: string;
  shortLabel: string;
  icon: typeof ShieldCheck;
}[] = [
  { id: 'verification', label: 'Company Verification', shortLabel: 'Verification', icon: ShieldCheck },
  { id: 'escrow', label: 'Escrow Payments', shortLabel: 'Payments', icon: Receipt },
  { id: 'invoices', label: 'Invoices', shortLabel: 'Invoices', icon: FileText },
  { id: 'users', label: 'List of Users', shortLabel: 'Users', icon: Users },
  { id: 'samples', label: 'Sample Pickup', shortLabel: 'Pickup', icon: Truck },
  { id: 'chat_qa', label: 'Chat Q&A', shortLabel: 'Q&A', icon: MessageSquare },
];

interface AdminTabProps {
  adminCompanies: any[];
  adminPayments: any[];
  adminUsers: any[];
  adminInvoices: any[];
  sampleDeliveries?: any[];
  fetchData: () => Promise<void>;
  handleVerifyCompany: (companyId: string) => Promise<void>;
  onOpenDeliveryPortal?: () => void;
}

const formatInr = (paise: number) =>
  `₹${((paise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function AdminTab({
  adminCompanies,
  adminPayments,
  adminUsers,
  adminInvoices,
  sampleDeliveries = [],
  fetchData,
  handleVerifyCompany,
  onOpenDeliveryPortal,
}: AdminTabProps) {
  const [section, setSection] = useState<AdminSection>('verification');
  const [selectedDoc, setSelectedDoc] = useState<{ url: string; name: string } | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [releasingId, setReleasingId] = useState<string | null>(null);
  const [viewInvoice, setViewInvoice] = useState<any | null>(null);
  const [loadingInvoiceId, setLoadingInvoiceId] = useState<string | null>(null);

  const openInvoiceView = async (invoiceId: string) => {
    setLoadingInvoiceId(invoiceId);
    try {
      const res = await fetch(`/api/v1/invoices/${invoiceId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await res.json();
      if (data.success) {
        setViewInvoice(data.data);
      } else {
        alert(data.message || 'Failed to load invoice');
      }
    } catch {
      alert('Failed to load invoice');
    } finally {
      setLoadingInvoiceId(null);
    }
  };

  const handleReleasePayment = async (paymentId: string) => {
    setReleasingId(paymentId);
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
      const res = await fetch(`/api/v1/admin/payments/${paymentId}/release`, {
        method: 'POST',
        headers,
      });
      const d = await res.json();
      if (d.success) {
        await fetchData();
      } else {
        alert(d.message || 'Failed to release payment');
      }
    } catch {
      alert('Error releasing payment');
    } finally {
      setReleasingId(null);
    }
  };

  const handleVerify = async (companyId: string) => {
    setVerifyingId(companyId);
    try {
      await handleVerifyCompany(companyId);
    } finally {
      setVerifyingId(null);
    }
  };

  const handleToggleActive = async (companyId: string, currentIsActive: boolean) => {
    try {
      setTogglingId(companyId);
      const headers = {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json',
      };
      const res = await fetch(`/api/v1/admin/companies/${companyId}/toggle-active`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ isActive: !currentIsActive }),
      });
      const d = await res.json();
      if (d.success) {
        await fetchData();
      } else {
        alert(d.message || 'Failed to toggle company status');
      }
    } catch {
      alert('Error toggling company status');
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Platform Administration</h2>
          <p className="text-xs text-slate-400 mt-1">
            KYC, escrow, invoices, users, sample logistics, and chat Q&A
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          {section === 'invoices' && (
            <button
              onClick={() => window.open('/api/v1/admin/export/invoices', '_blank')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all"
            >
              Export CSV
            </button>
          )}
          <RefreshButton onRefresh={fetchData} size="sm" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap sm:gap-2 border-b border-white/10 pb-1">
        {ADMIN_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = section === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSection(tab.id)}
              className={`px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg sm:rounded-t-lg text-[10px] sm:text-xs font-semibold flex items-center justify-center sm:justify-start gap-1 sm:gap-1.5 transition-all border-b-2 -mb-[1px] min-w-0 ${
                active
                  ? 'text-blue-400 border-blue-500 bg-blue-500/5'
                  : 'text-slate-400 border-transparent hover:text-slate-200'
              }`}
            >
              <Icon className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span className="truncate sm:hidden">{tab.shortLabel}</span>
              <span className="truncate hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {section === 'verification' && (
        <div className="space-y-4">
          {adminCompanies.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">No companies registered.</p>
          ) : (
            adminCompanies.map((c: any) => (
              <div
                key={c.id}
                className={`glass-card rounded-2xl p-5 border flex flex-col gap-4 ${
                  c.isActive === false ? 'border-red-500/30 opacity-75' : 'border-white/5'
                }`}
              >
                <div className="flex justify-between items-center gap-3 flex-wrap">
                  <div>
                    <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2 flex-wrap">
                      {c.name}
                      {c.isActive !== false ? (
                        <span className="px-2 py-0.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded-md text-[10px] font-bold">
                          ACTIVE
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-md text-[10px] font-bold">
                          INACTIVE
                        </span>
                      )}
                    </h3>
                    <p className="text-[10px] text-slate-500 mt-1">
                      GSTIN: {c.gstin} | Status:{' '}
                      <span className="font-semibold text-blue-400">{c.status}</span>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleToggleActive(c.id, c.isActive !== false)}
                      disabled={togglingId === c.id}
                      className={`py-1.5 px-4 rounded-lg text-xs font-bold transition-all flex items-center gap-2 disabled:opacity-50 ${
                        c.isActive !== false
                          ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20'
                          : 'bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20'
                      }`}
                    >
                      {togglingId === c.id && <Loader2 className="w-3 h-3 animate-spin" />}
                      {c.isActive !== false ? 'Disable' : 'Enable'}
                    </button>
                    {(c.status === 'PENDING' || c.status === 'UNDER_REVIEW') && (
                      <button
                        type="button"
                        onClick={() => handleVerify(c.id)}
                        disabled={verifyingId === c.id}
                        className="py-1.5 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 disabled:opacity-50"
                      >
                        {verifyingId === c.id && <Loader2 className="w-3 h-3 animate-spin" />}
                        Approve KYC (Verify)
                      </button>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5">
                  <h4 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5" /> Uploaded KYC Documents ({c.documents?.length || 0}/4)
                  </h4>
                  {c.documents?.length > 0 ? (
                    <div className="flex flex-wrap gap-3">
                      {c.documents.map((doc: any) => (
                        <button
                          key={doc.id}
                          onClick={() =>
                            setSelectedDoc({ url: `/api/v1/upload/${doc.fileId}`, name: doc.documentType })
                          }
                          className="text-[10px] flex items-center gap-1 bg-slate-900/80 hover:bg-slate-800 border border-white/10 px-3 py-1.5 rounded-md text-blue-400 transition-colors"
                        >
                          {doc.documentType.replace('_', ' ')} <ExternalLink className="w-3 h-3" />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-500 italic">No documents uploaded yet.</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {section === 'escrow' && (
        <div className="space-y-4">
          {adminPayments.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-sm">No payments found.</div>
          ) : (
            adminPayments.map((p: any) => (
              <div
                key={p.id}
                className="glass-card rounded-2xl p-5 border border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4"
              >
                <div>
                  <div className="flex gap-2 items-center flex-wrap">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                        p.status === 'HELD'
                          ? 'bg-yellow-500/10 text-yellow-500'
                          : p.status === 'RELEASED'
                            ? 'bg-green-500/10 text-green-400'
                            : 'bg-slate-500/10 text-slate-400'
                      }`}
                    >
                      {p.status}
                    </span>
                    {p.invoice?.number && (
                      <span className="text-[10px] text-slate-500 font-semibold">Inv: {p.invoice.number}</span>
                    )}
                    {p.invoice?.purchaseOrder?.poNumber && (
                      <span className="text-[10px] text-slate-500 font-semibold">
                        PO: {p.invoice.purchaseOrder.poNumber}
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-sm text-slate-200 mt-2">
                    Buyer paid: {formatInr(p.amount)}
                  </h3>
                  {p.supplierPayoutAmount != null && (
                    <p className="text-[10px] text-green-400 mt-1">
                      Supplier item payout: {formatInr(p.supplierPayoutAmount)}
                      {p.status === 'RELEASED' ? ' (sent)' : ' (pending)'}
                    </p>
                  )}
                  <p className="text-[10px] text-slate-400 mt-1">
                    Buyer:{' '}
                    <span className="font-semibold text-slate-300">
                      {p.invoice?.purchaseOrder?.buyerCompany?.name || '—'}
                    </span>
                    {' → '}
                    Supplier:{' '}
                    <span className="font-semibold text-slate-300">
                      {p.invoice?.purchaseOrder?.supplierCompany?.name || '—'}
                    </span>
                  </p>
                </div>
                {p.status === 'HELD' && (
                  <button
                    type="button"
                    onClick={() => handleReleasePayment(p.id)}
                    disabled={releasingId === p.id}
                    className="py-1.5 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold whitespace-nowrap flex items-center gap-2 disabled:opacity-50"
                  >
                    {releasingId === p.id && <Loader2 className="w-3 h-3 animate-spin" />}
                    Release to Supplier
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {section === 'invoices' && (
        <div className="space-y-3">
          {adminInvoices.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-sm">No invoices found.</div>
          ) : (
            adminInvoices.map((inv: any) => (
              <div
                key={inv.id}
                className="glass-card rounded-xl p-4 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-white">{inv.number}</span>
                    <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      {inv.type}
                    </span>
                    <span
                      className={`text-[10px] uppercase px-2 py-0.5 rounded font-bold ${
                        inv.status === 'PAID'
                          ? 'bg-green-500/10 text-green-400'
                          : inv.status === 'UNPAID'
                            ? 'bg-yellow-500/10 text-yellow-400'
                            : 'bg-slate-500/10 text-slate-400'
                      }`}
                    >
                      {inv.status}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {inv.payerCompany?.name || 'Payer'} → {inv.payeeCompany?.name || 'Payee'}
                    {inv.purchaseOrder?.poNumber ? ` · PO ${inv.purchaseOrder.poNumber}` : ''}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {new Date(inv.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <p className="text-sm font-bold text-blue-400">{formatInr(inv.total)}</p>
                  <p className="text-[10px] text-slate-500">Taxable {formatInr(inv.taxable)}</p>
                  <button
                    type="button"
                    onClick={() => openInvoiceView(inv.id)}
                    disabled={loadingInvoiceId === inv.id}
                    className="py-1.5 px-3 bg-blue-600/20 border border-blue-500/30 text-blue-300 hover:bg-blue-600 hover:text-white rounded-lg text-xs font-bold disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {loadingInvoiceId === inv.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <FileText className="w-3 h-3" />
                    )}
                    View Invoice
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {section === 'users' && (
        <div className="space-y-4">
          {adminUsers.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-sm">No users found.</div>
          ) : (
            adminUsers.map((u: any) => (
              <div
                key={u.id}
                className="glass-card rounded-2xl p-5 border border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4"
              >
                <div className="flex items-start gap-4 w-full">
                  <div className="p-3 bg-blue-500/10 rounded-full text-blue-400 shrink-0">
                    <Users className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-bold text-sm text-slate-200">{u.name || 'N/A'}</h3>
                      <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded uppercase tracking-wider font-semibold border border-slate-700">
                        {u.role ? u.role.replace(/_/g, ' ') : 'N/A'}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-y-1 gap-x-6 text-xs text-slate-400 mt-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500 font-semibold w-16">Email:</span>
                        <span className="text-slate-300 truncate">{u.email}</span>
                      </div>
                      {u.company && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-500 font-semibold w-16">Company:</span>
                          <div className="flex items-center gap-1 overflow-hidden">
                            <Building className="w-3 h-3 shrink-0" />
                            <span className="text-slate-300 truncate" title={u.company.name}>
                              {u.company.name}
                            </span>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500 font-semibold w-16">Joined:</span>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 shrink-0" />
                          <span className="text-slate-300">{new Date(u.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {section === 'samples' && (
        <div className="glass-card rounded-2xl p-5 border border-purple-500/20 space-y-3">
          <div className="flex justify-between items-start gap-3 flex-wrap">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Truck className="w-4 h-4 text-purple-400" />
                Sample Pickups
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                RFQ sampling deliveries waiting for pickup or in progress. Accept and complete them in Local
                Delivery Portal.
              </p>
            </div>
            {onOpenDeliveryPortal && (
              <button
                onClick={onOpenDeliveryPortal}
                className="px-3 py-1.5 bg-purple-600/20 border border-purple-500/30 text-purple-300 rounded-lg text-xs font-bold whitespace-nowrap"
              >
                Open Delivery Portal
              </button>
            )}
          </div>

          {sampleDeliveries.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">No sample pickup jobs right now.</p>
          ) : (
            <div className="space-y-2">
              {sampleDeliveries.map((del: any) => (
                <div
                  key={del.id}
                  className="p-3 bg-slate-900/50 rounded-xl border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {del.deliveryNumber}{' '}
                      <span className="text-[10px] text-purple-300 uppercase">{del.status}</span>
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Pickup: {del.purchaseOrder?.supplierCompany?.name || 'Supplier'} → Deliver:{' '}
                      {del.purchaseOrder?.buyerCompany?.name || 'Buyer'}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      RFQ: {del.purchaseOrder?.poNumber || '—'}
                    </p>
                  </div>
                  {del.status === 'CREATED' && onOpenDeliveryPortal && (
                    <button
                      onClick={onOpenDeliveryPortal}
                      className="py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold"
                    >
                      Accept in Portal
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {section === 'chat_qa' && <AdminChatQaSection />}

      {viewInvoice && (
        <InvoiceDetailModal invoice={viewInvoice} onClose={() => setViewInvoice(null)} />
      )}

      {selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-slate-950/50">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" />
                {selectedDoc.name.replace('_', ' ')}
              </h3>
              <button
                onClick={() => setSelectedDoc(null)}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 bg-slate-950 p-2 overflow-hidden">
              <iframe
                src={selectedDoc.url}
                className="w-full h-full rounded-xl border border-white/5 bg-white"
                title={selectedDoc.name}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
