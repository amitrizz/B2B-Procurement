import { useState } from 'react';
import { RefreshCw, FileText, ExternalLink, X, Loader2 } from 'lucide-react';

interface AdminTabProps {
  adminCompanies: any[];
  adminPayments: any[];
  fetchData: () => Promise<void>;
  handleVerifyCompany: (companyId: string) => Promise<void>;
}

export default function AdminTab({
  adminCompanies,
  adminPayments,
  fetchData,
  handleVerifyCompany
}: AdminTabProps) {
  const [selectedDoc, setSelectedDoc] = useState<{ url: string; name: string } | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const handleReleasePayment = async (paymentId: string) => {
    try {
      const headers = { 'Authorization': `Bearer ${localStorage.getItem('token')}` };
      const res = await fetch(`/api/v1/admin/payments/${paymentId}/release`, {
        method: 'POST',
        headers
      });
      const d = await res.json();
      if (d.success) {
        alert('Payment released successfully!');
        fetchData();
      } else {
        alert(d.message || 'Failed to release payment');
      }
    } catch (err) {
      alert('Error releasing payment');
    }
  };

  const handleToggleActive = async (companyId: string, currentIsActive: boolean) => {
    try {
      setTogglingId(companyId);
      const headers = { 
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      };
      const res = await fetch(`/api/v1/admin/companies/${companyId}/toggle-active`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ isActive: !currentIsActive })
      });
      const d = await res.json();
      if (d.success) {
        await fetchData();
      } else {
        alert(d.message || 'Failed to toggle company status');
      }
    } catch (err) {
      alert('Error toggling company status');
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-white">Platform Administration</h2>
          <p className="text-xs text-slate-400">Review company registrations, KYC profiles, and platform status</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => window.open('/api/v1/admin/export/invoices', '_blank')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all"
          >
            Export Invoices (CSV)
          </button>
          <button onClick={fetchData} className="p-2.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all flex items-center justify-center">
            <RefreshCw className="w-4 h-4 text-slate-300" />
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {adminCompanies.map((c: any) => (
          <div key={c.id} className={`glass-card rounded-2xl p-5 border flex flex-col gap-4 ${c.isActive === false ? 'border-red-500/30 opacity-75' : 'border-white/5'}`}>
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
                  {c.name}
                  {c.isActive !== false ? (
                    <span className="px-2 py-0.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded-md text-[10px] font-bold">ACTIVE</span>
                  ) : (
                    <span className="px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-md text-[10px] font-bold">INACTIVE</span>
                  )}
                </h3>
                <p className="text-[10px] text-slate-500">GSTIN: {c.gstin} | Status: <span className="font-semibold text-blue-400">{c.status}</span></p>
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
                    onClick={() => handleVerifyCompany(c.id)}
                    className="py-1.5 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold"
                  >
                    Approve KYC (Verify)
                  </button>
                )}
              </div>
            </div>
            
            {/* KYC Documents Viewer */}
            <div className="pt-4 border-t border-white/5">
              <h4 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" /> Uploaded KYC Documents ({c.documents?.length || 0}/4)
              </h4>
              {c.documents?.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {c.documents.map((doc: any) => (
                    <button 
                      key={doc.id} 
                      onClick={() => setSelectedDoc({ url: `/api/v1/upload/${doc.fileId}`, name: doc.documentType })}
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
        ))}
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-bold tracking-tight text-white mb-4">Escrow Payments</h2>
        <div className="space-y-4">
          {adminPayments.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-sm">No payments found.</div>
          ) : (
            adminPayments.map((p: any) => (
              <div key={p.id} className="glass-card rounded-2xl p-5 border border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div>
                  <div className="flex gap-2 items-center flex-wrap">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                      p.status === 'HELD' ? 'bg-yellow-500/10 text-yellow-500' :
                      p.status === 'RELEASED' ? 'bg-green-500/10 text-green-400' : 'bg-slate-500/10 text-slate-400'
                    }`}>
                      {p.status}
                    </span>
                    {p.invoice?.number && (
                      <span className="text-[10px] text-slate-500 font-semibold">Inv: {p.invoice.number}</span>
                    )}
                    {p.invoice?.purchaseOrder?.poNumber && (
                      <span className="text-[10px] text-slate-500 font-semibold">PO: {p.invoice.purchaseOrder.poNumber}</span>
                    )}
                  </div>
                  <h3 className="font-bold text-sm text-slate-200 mt-2">
                    Buyer paid: ₹{(p.amount / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </h3>
                  {p.supplierPayoutAmount != null && (
                    <p className="text-[10px] text-green-400 mt-1">
                      Supplier item payout: ₹{(p.supplierPayoutAmount / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      {p.status === 'RELEASED' ? ' (sent)' : ' (pending)'}
                    </p>
                  )}
                  <p className="text-[10px] text-slate-400 mt-1">
                    Buyer: <span className="font-semibold text-slate-300">{p.invoice?.purchaseOrder?.buyerCompany?.name || '—'}</span>
                    {' → '}
                    Supplier: <span className="font-semibold text-slate-300">{p.invoice?.purchaseOrder?.supplierCompany?.name || '—'}</span>
                  </p>
                </div>
                {p.status === 'HELD' && (
                  <button
                    onClick={() => handleReleasePayment(p.id)}
                    className="py-1.5 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold whitespace-nowrap"
                  >
                    Release to Supplier
                  </button>
                )}
              </div>
            ))
          )}
      </div>
      </div>

      {/* Document Viewer Modal */}
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
