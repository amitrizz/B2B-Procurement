import { useState, useEffect } from 'react';
import styles from './admin.module.scss';
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
  UserCheck,
  KeyRound,
} from 'lucide-react';
import AdminChatQaSection from '../chat/components/AdminChatQaSection';

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
  handleImpersonateCompany?: (company: any) => Promise<void>;
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
  handleImpersonateCompany,
  onOpenDeliveryPortal,
}: AdminTabProps) {
  const [section, setSection] = useState<AdminSection>('verification');
  const [internalPayments, setInternalPayments] = useState<any[] | null>(null);
  const [internalUsers, setInternalUsers] = useState<any[] | null>(null);
  const [internalInvoices, setInternalInvoices] = useState<any[] | null>(null);
  const [internalDeliveries, setInternalDeliveries] = useState<any[] | null>(null);
  const [loadingSection, setLoadingSection] = useState(false);

  const payments = internalPayments !== null ? internalPayments : (adminPayments || []);
  const users = internalUsers !== null ? internalUsers : (adminUsers || []);
  const invoices = internalInvoices !== null ? internalInvoices : (adminInvoices || []);
  const deliveries = internalDeliveries !== null ? internalDeliveries : (sampleDeliveries || []);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };

    if (section === 'escrow' && internalPayments === null && (!adminPayments || adminPayments.length === 0)) {
      setLoadingSection(true);
      fetch(`/api/v1/admin/payments?_t=${Date.now()}`, { headers })
        .then(r => r.json())
        .then(d => { if (d.success) setInternalPayments(d.data || []); })
        .catch(() => {})
        .finally(() => setLoadingSection(false));
    } else if (section === 'invoices' && internalInvoices === null && (!adminInvoices || adminInvoices.length === 0)) {
      setLoadingSection(true);
      fetch(`/api/v1/admin/invoices?_t=${Date.now()}`, { headers })
        .then(r => r.json())
        .then(d => { if (d.success) setInternalInvoices(d.data || []); })
        .catch(() => {})
        .finally(() => setLoadingSection(false));
    } else if (section === 'users' && internalUsers === null && (!adminUsers || adminUsers.length === 0)) {
      setLoadingSection(true);
      fetch(`/api/v1/admin/users?_t=${Date.now()}`, { headers })
        .then(r => r.json())
        .then(d => { if (d.success) setInternalUsers(d.data || []); })
        .catch(() => {})
        .finally(() => setLoadingSection(false));
    } else if (section === 'samples' && internalDeliveries === null && (!sampleDeliveries || sampleDeliveries.length === 0)) {
      setLoadingSection(true);
      fetch(`/api/v1/transporter/deliveries?_t=${Date.now()}`, { headers })
        .then(r => r.json())
        .then(d => { if (d.success) setInternalDeliveries(d.data || []); })
        .catch(() => {})
        .finally(() => setLoadingSection(false));
    }
  }, [section]);

  const [selectedDoc, setSelectedDoc] = useState<{ url: string; name: string } | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);
  const [releasingId, setReleasingId] = useState<string | null>(null);
  const [viewInvoice, setViewInvoice] = useState<any | null>(null);
  const [loadingInvoiceId, setLoadingInvoiceId] = useState<string | null>(null);

  const handleImpersonate = async (company: any) => {
    if (!handleImpersonateCompany) return;
    setImpersonatingId(company.id);
    try {
      await handleImpersonateCompany(company);
    } finally {
      setImpersonatingId(null);
    }
  };

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
    <div className={styles['admin--space-y-6']}>
      <div className={styles['admin--flex-flex-col-smflex-row']}>
        <div>
          <h2 className={styles['admin--text-xl-font-bold-text-white']}>Platform Administration</h2>
          <p className={styles['admin--text-xs-text-slate-400-mt-1']}>
            KYC, escrow, invoices, users, sample logistics, and chat Q&A
          </p>
        </div>
        <div className={styles['admin--flex-gap-2-shrink-0']}>
          {section === 'invoices' && (
            <button
              onClick={() => window.open('/api/v1/admin/export/invoices', '_blank')}
              className={styles['admin--px-4-py-2-bg-blue-600']}
            >
              Export CSV
            </button>
          )}
          <RefreshButton onRefresh={fetchData} size="sm" />
        </div>
      </div>

      <div className={styles['admin--grid-grid-cols-3-gap-15']}>
        {ADMIN_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = section === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSection(tab.id)}
              className={`px-2.5 py-2 sm:px-3.5 sm:py-2 rounded-xl text-xs font-semibold flex items-center justify-center sm:justify-start gap-1.5 transition-all min-w-0 cursor-pointer ${
                active
                  ? 'text-blue-600 bg-blue-50 border border-blue-200 font-bold shadow-2xs'
                  : 'text-slate-600 border border-transparent hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon className={styles['admin--w-3-h-3-smw-35']} />
              <span className={styles['admin--truncate-smhidden']}>{tab.shortLabel}</span>
              <span className={styles['admin--truncate-hidden-sminline']}>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {section === 'verification' && (
        <div className={styles['admin--space-y-4']}>
          {adminCompanies.length === 0 ? (
            <p className={styles['admin--text-sm-text-slate-500-py-8']}>No companies registered.</p>
          ) : (
            adminCompanies.map((c: any) => (
              <div
                key={c.id}
                className={`bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col gap-4 ${
                  c.isActive === false ? 'border-rose-300 opacity-80' : ''
                }`}
              >
                <div className={styles['admin--flex-justify-between-items-center']}>
                  <div>
                    <h3 className={styles['admin--font-bold-text-sm-text-slate-200']}>
                      {c.name}
                      {c.isActive !== false ? (
                        <span className={styles['admin--px-2-py-05-bg-green-50010']}>
                          ACTIVE
                        </span>
                      ) : (
                        <span className={styles['admin--px-2-py-05-bg-red-50010']}>
                          INACTIVE
                        </span>
                      )}
                    </h3>
                    <p className={styles['admin--text-10px-text-slate-500-mt-1']}>
                      GSTIN: <span className="font-semibold text-slate-700">{c.gstin}</span> | Status:{' '}
                      <span className={styles['admin--font-semibold-text-blue-400']}>{c.status}</span>
                    </p>
                  </div>
                  <div className={styles['admin--flex-gap-2']}>
                    {/* Impersonate Company Button */}
                    <button
                      type="button"
                      onClick={() => handleImpersonate(c)}
                      disabled={impersonatingId === c.id}
                      className={styles['admin--impersonate-btn']}
                      title={`Login as ${c.name} to view complete profile and portal`}
                    >
                      {impersonatingId === c.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600" />
                      ) : (
                        <UserCheck className="w-3.5 h-3.5 text-purple-600" />
                      )}
                      <span>Impersonate</span>
                    </button>

                    <button
                      onClick={() => handleToggleActive(c.id, c.isActive !== false)}
                      disabled={togglingId === c.id}
                      className={`py-1.5 px-3.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer ${
                        c.isActive !== false
                          ? 'bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200'
                      }`}
                    >
                      {togglingId === c.id && <Loader2 className={styles['admin--w-3-h-3-animate-spin']} />}
                      {c.isActive !== false ? 'Disable' : 'Enable'}
                    </button>
                    {(c.status === 'PENDING' || c.status === 'UNDER_REVIEW') && (
                      <button
                        type="button"
                        onClick={() => handleVerify(c.id)}
                        disabled={verifyingId === c.id}
                        className={styles['admin--py-15-px-4-bg-green-600']}
                      >
                        {verifyingId === c.id && <Loader2 className={styles['admin--w-3-h-3-animate-spin-1']} />}
                        Approve KYC (Verify)
                      </button>
                    )}
                  </div>
                </div>

                <div className={styles['admin--pt-4-border-t-border-white5']}>
                  <h4 className={styles['admin--text-xs-font-bold-text-slate-300']}>
                    <FileText className={styles['admin--w-35-h-35']} /> Uploaded KYC Documents ({c.documents?.length || 0}/4)
                  </h4>
                  {c.documents?.length > 0 ? (
                    <div className={styles['admin--flex-flex-wrap-gap-3']}>
                      {c.documents.map((doc: any) => (
                        <button
                          key={doc.id}
                          onClick={() =>
                            setSelectedDoc({ url: `/api/v1/upload/${doc.fileId}`, name: doc.documentType })
                          }
                          className={styles['admin--text-10px-flex-items-center']}
                        >
                          <span>{doc.documentType.replace(/_/g, ' ')}</span>
                          <ExternalLink className={styles['admin--w-3-h-3']} />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className={styles['admin--text-10px-text-slate-500-italic']}>No documents uploaded yet.</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {section === 'escrow' && (
        <div className={styles['admin--space-y-4-1']}>
          {loadingSection ? (
            <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              <span className="text-xs">Loading escrow payments...</span>
            </div>
          ) : payments.length === 0 ? (
            <div className={styles['admin--py-8-text-center-text-slate-500']}>No payments found.</div>
          ) : (
            payments.map((p: any) => (
              <div
                key={p.id}
                className={styles['admin--glass-card-rounded-2xl-p-5']}
              >
                <div>
                  <div className={styles['admin--flex-gap-2-items-center']}>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                        p.status === 'HELD'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : p.status === 'RELEASED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {p.status}
                    </span>
                    {p.invoice?.number && (
                      <span className={styles['admin--text-10px-text-slate-500-font-semibold']}>Inv: {p.invoice.number}</span>
                    )}
                    {p.invoice?.purchaseOrder?.poNumber && (
                      <span className={styles['admin--text-10px-text-slate-500-font-semibold-1']}>
                        PO: {p.invoice.purchaseOrder.poNumber}
                      </span>
                    )}
                  </div>
                  <h3 className={styles['admin--font-bold-text-sm-text-slate-200-1']}>
                    Buyer paid: {formatInr(p.amount)}
                  </h3>
                  {p.supplierPayoutAmount != null && (
                    <p className={styles['admin--text-10px-text-green-400-mt-1']}>
                      Supplier item payout: {formatInr(p.supplierPayoutAmount)}
                      {p.status === 'RELEASED' ? ' (sent)' : ' (pending)'}
                    </p>
                  )}
                  <p className={styles['admin--text-10px-text-slate-400-mt-1']}>
                    Buyer:{' '}
                    <span className={styles['admin--font-semibold-text-slate-300']}>
                      {p.invoice?.purchaseOrder?.buyerCompany?.name || '—'}
                    </span>
                    {' → '}
                    Supplier:{' '}
                    <span className={styles['admin--font-semibold-text-slate-300-1']}>
                      {p.invoice?.purchaseOrder?.supplierCompany?.name || '—'}
                    </span>
                  </p>
                </div>
                {p.status === 'HELD' && (
                  <button
                    type="button"
                    onClick={() => handleReleasePayment(p.id)}
                    disabled={releasingId === p.id}
                    className={styles['admin--py-15-px-4-bg-green-600-1']}
                  >
                    {releasingId === p.id && <Loader2 className={styles['admin--w-3-h-3-animate-spin-2']} />}
                    Release to Supplier
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {section === 'invoices' && (
        <div className={styles['admin--space-y-3']}>
          {loadingSection ? (
            <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              <span className="text-xs">Loading invoices...</span>
            </div>
          ) : invoices.length === 0 ? (
            <div className={styles['admin--py-8-text-center-text-slate-500-1']}>No invoices found.</div>
          ) : (
            invoices.map((inv: any) => (
              <div
                key={inv.id}
                className={styles['admin--glass-card-rounded-xl-p-4']}
              >
                <div>
                  <div className={styles['admin--flex-items-center-gap-2']}>
                    <span className={styles['admin--text-sm-font-bold-text-white']}>{inv.number}</span>
                    <span className={styles['admin--text-10px-uppercase-px-2']}>
                      {inv.type}
                    </span>
                    <span
                      className={`text-[10px] uppercase px-2 py-0.5 rounded font-bold ${
                        inv.status === 'PAID'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : inv.status === 'UNPAID'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {inv.status}
                    </span>
                  </div>
                  <p className={styles['admin--text-10px-text-slate-400-mt-1-1']}>
                    {inv.payerCompany?.name || 'Payer'} → {inv.payeeCompany?.name || 'Payee'}
                    {inv.purchaseOrder?.poNumber ? ` · PO ${inv.purchaseOrder.poNumber}` : ''}
                  </p>
                  <p className={styles['admin--text-10px-text-slate-500-mt-05']}>
                    {new Date(inv.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className={styles['admin--flex-flex-col-items-end']}>
                  <p className={styles['admin--text-sm-font-bold-text-blue-400']}>{formatInr(inv.total)}</p>
                  <p className={styles['admin--text-10px-text-slate-500']}>Taxable {formatInr(inv.taxable)}</p>
                  <button
                    type="button"
                    onClick={() => openInvoiceView(inv.id)}
                    disabled={loadingInvoiceId === inv.id}
                    className={styles['admin--py-15-px-3-bg-blue-60020']}
                  >
                    {loadingInvoiceId === inv.id ? (
                      <Loader2 className={styles['admin--w-3-h-3-animate-spin-3']} />
                    ) : (
                      <FileText className={styles['admin--w-3-h-3-1']} />
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
        <div className={styles['admin--space-y-4-2']}>
          {loadingSection ? (
            <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              <span className="text-xs">Loading users...</span>
            </div>
          ) : users.length === 0 ? (
            <div className={styles['admin--py-8-text-center-text-slate-500-2']}>No users found.</div>
          ) : (
            users.map((u: any) => (
              <div
                key={u.id}
                className={styles['admin--glass-card-rounded-2xl-p-5-1']}
              >
                <div className={styles['admin--flex-items-start-gap-4']}>
                  <div className={styles['admin--p-3-bg-blue-50010-rounded-full']}>
                    <Users className={styles['admin--w-6-h-6']} />
                  </div>
                  <div className={styles['admin--flex-1']}>
                    <div className={styles['admin--flex-items-center-gap-2-1']}>
                      <h3 className={styles['admin--font-bold-text-sm-text-slate-200-2']}>{u.name || 'N/A'}</h3>
                      <span className={styles['admin--text-10px-bg-slate-800-text-slate-300']}>
                        {u.role ? u.role.replace(/_/g, ' ') : 'N/A'}
                      </span>
                    </div>
                    <div className={styles['admin--grid-grid-cols-1-mdgrid-cols-2']}>
                      <div className={styles['admin--flex-items-center-gap-15']}>
                        <span className={styles['admin--text-slate-500-font-semibold-w-16']}>Email:</span>
                        <span className={styles['admin--text-slate-300-truncate']}>{u.email}</span>
                      </div>
                      {u.company && (
                        <div className={styles['admin--flex-items-center-gap-15-1']}>
                          <span className={styles['admin--text-slate-500-font-semibold-w-16-1']}>Company:</span>
                          <div className={styles['admin--flex-items-center-gap-1']}>
                            <Building className={styles['admin--w-3-h-3-shrink-0']} />
                            <span className={styles['admin--text-slate-300-truncate-1']} title={u.company.name}>
                              {u.company.name}
                            </span>
                          </div>
                        </div>
                      )}
                      <div className={styles['admin--flex-items-center-gap-15-2']}>
                        <span className={styles['admin--text-slate-500-font-semibold-w-16-2']}>Joined:</span>
                        <div className={styles['admin--flex-items-center-gap-1-1']}>
                          <Clock className={styles['admin--w-3-h-3-shrink-0-1']} />
                          <span className={styles['admin--text-slate-300']}>{new Date(u.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Latest OTP Block */}
                    <div className="mt-3 p-2.5 sm:p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                          <KeyRound className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span>Latest OTP:</span>
                        </div>
                        {u.latestOtp ? (
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-extrabold text-sm tracking-widest px-2.5 py-0.5 bg-white border border-blue-200 text-blue-700 rounded-md shadow-2xs select-all">
                              {u.latestOtp.code}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border ${
                                u.latestOtp.status === 'ACTIVE'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : u.latestOtp.status === 'VERIFIED'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}
                            >
                              {u.latestOtp.status}
                            </span>
                            {u.latestOtp.type && (
                              <span className="text-[10px] font-semibold text-slate-400">
                                ({u.latestOtp.type})
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">No OTP generated yet</span>
                        )}
                      </div>

                      {u.latestOtp && (
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 flex-wrap">
                          <span>
                            Generated:{' '}
                            <strong className="text-slate-700">
                              {new Date(u.latestOtp.generatedAt).toLocaleString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit'
                              })}
                            </strong>
                          </span>
                          <span className="text-slate-300">·</span>
                          <span>
                            Expires:{' '}
                            <strong
                              className={
                                u.latestOtp.status === 'EXPIRED'
                                  ? 'text-rose-600'
                                  : 'text-slate-700'
                              }
                            >
                              {new Date(u.latestOtp.expiresAt).toLocaleString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit'
                              })}
                            </strong>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  {u.company && (
                    <div className="shrink-0">
                      <button
                        type="button"
                        onClick={() => handleImpersonate(u.company)}
                        disabled={impersonatingId === u.company.id}
                        className={styles['admin--impersonate-btn']}
                        title={`Impersonate ${u.company.name}`}
                      >
                        {impersonatingId === u.company.id ? (
                          <Loader2 className={styles['admin--w-3-h-3-animate-spin-6']} />
                        ) : (
                          <UserCheck className={styles['admin--w-3-h-3-text-purple-600']} />
                        )}
                        <span>Impersonate</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {section === 'samples' && (
        <div className={styles['admin--glass-card-rounded-2xl-p-5-2']}>
          <div className={styles['admin--flex-justify-between-items-start']}>
            <div>
              <h3 className={styles['admin--text-lg-font-bold-text-white']}>
                <Truck className={styles['admin--w-4-h-4-text-purple-400']} />
                Sample Pickups
              </h3>
              <p className={styles['admin--text-xs-text-slate-400-mt-1-1']}>
                RFQ sampling deliveries waiting for pickup or in progress. Accept and complete them in Local
                Delivery Portal.
              </p>
            </div>
            {onOpenDeliveryPortal && (
              <button
                onClick={onOpenDeliveryPortal}
                className={styles['admin--px-3-py-15-bg-purple-60020']}
              >
                Open Delivery Portal
              </button>
            )}
          </div>

          {loadingSection ? (
            <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              <span className="text-xs">Loading sample deliveries...</span>
            </div>
          ) : deliveries.length === 0 ? (
            <p className={styles['admin--text-sm-text-slate-500-py-4']}>No sample pickup jobs right now.</p>
          ) : (
            <div className={styles['admin--space-y-2']}>
              {deliveries.map((del: any) => (
                <div
                  key={del.id}
                  className={styles['admin--p-3-bg-slate-90050-rounded-xl']}
                >
                  <div>
                    <p className={styles['admin--text-sm-font-semibold-text-white']}>
                      {del.deliveryNumber}{' '}
                      <span className={styles['admin--text-10px-text-purple-300-uppercase']}>{del.status}</span>
                    </p>
                    <p className={styles['admin--text-10px-text-slate-400-mt-1-2']}>
                      Pickup: {del.purchaseOrder?.supplierCompany?.name || 'Supplier'} → Deliver:{' '}
                      {del.purchaseOrder?.buyerCompany?.name || 'Buyer'}
                    </p>
                    <p className={styles['admin--text-10px-text-slate-500-1']}>
                      RFQ: {del.purchaseOrder?.poNumber || '—'}
                    </p>
                  </div>
                  {del.status === 'CREATED' && onOpenDeliveryPortal && (
                    <button
                      onClick={onOpenDeliveryPortal}
                      className={styles['admin--py-15-px-3-bg-blue-600']}
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
        <div className={styles['admin--fixed-inset-0-z-50']}>
          <div className={styles['admin--bg-slate-900-border-border-white10']}>
            <div className={styles['admin--p-4-border-b-border-white10']}>
              <h3 className={styles['admin--text-sm-font-bold-text-white-1']}>
                <FileText className={styles['admin--w-4-h-4-text-blue-400']} />
                {selectedDoc.name.replace('_', ' ')}
              </h3>
              <button
                onClick={() => setSelectedDoc(null)}
                className={styles['admin--p-15-hoverbg-white10-rounded-lg']}
              >
                <X className={styles['admin--w-5-h-5']} />
              </button>
            </div>
            <div className={styles['admin--flex-1-bg-slate-950-p-2']}>
              <iframe
                src={selectedDoc.url}
                className={styles['admin--w-full-h-full-rounded-xl']}
                title={selectedDoc.name}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
