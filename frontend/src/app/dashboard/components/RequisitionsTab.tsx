import { useState } from 'react';
import { RefreshCw, FileText, CheckCircle, XCircle, Plus, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

interface RequisitionsTabProps {
  prs: any[];
  fetchData: () => Promise<void>;
  user: any;
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void;
  companyComponents?: any[];
}

export default function RequisitionsTab({
  prs,
  fetchData,
  user,
  showToast,
  companyComponents = []
}: RequisitionsTabProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newItems, setNewItems] = useState<any[]>([{ componentName: companyComponents[0]?.componentName || '', quantity: 100 }]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleAddItem = () => {
    setNewItems([...newItems, { componentName: companyComponents[0]?.componentName || '', quantity: 100 }]);
  };

  const handleCreatePR = async (e: React.FormEvent) => {
    e.preventDefault();
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
    } catch (err) {
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
    } catch (err) {
      showToast('Error acting on PR', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Purchase Requisitions (PR)</h1>
          <p className="text-xs text-slate-400">Internal approvals required before publishing an RFQ</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="p-2.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all flex items-center justify-center">
            <RefreshCw className="w-4 h-4 text-slate-300" />
          </button>
          <Button variant="primary" onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-2" /> Create PR
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {prs.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">No Purchase Requisitions found.</div>
        ) : (
          prs.map((pr: any) => (
            <Card key={pr.id} className="grid md:grid-cols-4 gap-4 items-center">
              <div className="md:col-span-2">
                <span className="text-[10px] text-slate-500 font-semibold">{pr.prNumber}</span>
                <h4 className="font-bold text-sm text-white mt-1">{pr.title}</h4>
                <p className="text-xs text-slate-400 mt-1">{pr.description}</p>
                <div className="text-[10px] text-slate-500 mt-2">
                  Created by: {pr.creator?.email || pr.createdByUserId}
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 font-semibold block uppercase">Status</span>
                <span className={`text-xs font-semibold mt-1 block ${
                  pr.status === 'APPROVED' ? 'text-green-400' :
                  pr.status === 'REJECTED' ? 'text-red-400' : 'text-yellow-400'
                }`}>
                  {pr.status}
                </span>
              </div>

              <div className="flex justify-end gap-2">
                {pr.status === 'PENDING_APPROVER' && ['OWNER', 'PLATFORM_ADMIN'].includes(user.role) && (
                  <>
                    <button
                      onClick={() => handleApprovePR(pr.id, true)}
                      disabled={actionLoading === pr.id}
                      className="py-1.5 px-3 bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> Approve
                    </button>
                    <button
                      onClick={() => handleApprovePR(pr.id, false)}
                      disabled={actionLoading === pr.id}
                      className="py-1.5 px-3 bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Reject
                    </button>
                  </>
                )}
                {pr.status === 'PENDING_APPROVER' && user.id === pr.createdByUserId && !['OWNER', 'PLATFORM_ADMIN'].includes(user.role) && (
                  <span className="text-[10px] text-slate-500 italic">Waiting for another user's approval (Maker-Checker)</span>
                )}
              </div>
            </Card>
          ))
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-2xl p-6 flex flex-col max-h-[90vh] shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Create Purchase Requisition</h3>
            <form onSubmit={handleCreatePR} className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar">
              <Input
                label="Requisition Title"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g., Q3 Restock of Fasteners"
              />
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Description</label>
                <textarea
                  required
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
                  rows={3}
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 ml-1">PR Line Items</label>
                  <button type="button" onClick={handleAddItem} className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add Item
                  </button>
                </div>
                {newItems.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-start p-3 bg-slate-950/50 rounded-xl border border-white/5">
                    <div className="flex-1 space-y-2">
                      <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Component Name <span className="text-red-500">*</span></label>
                      <select
                        required
                        value={item.componentName}
                        onChange={(e) => {
                          const arr = [...newItems];
                          arr[idx].componentName = e.target.value;
                          setNewItems(arr);
                        }}
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none"
                      >
                        <option value="" disabled>Select component...</option>
                        {companyComponents.map(c => (
                          <option key={c.id} value={c.componentName}>{c.componentName}</option>
                        ))}
                      </select>
                    </div>
                    <div className="w-24 space-y-2">
                      <Input
                        label="Qty"
                        type="number"
                        required
                        min="1"
                        value={item.quantity}
                        onChange={(e) => {
                          const arr = [...newItems];
                          arr[idx].quantity = Number(e.target.value);
                          setNewItems(arr);
                        }}
                      />
                    </div>
                    {newItems.length > 1 && (
                      <button type="button" onClick={() => setNewItems(newItems.filter((_, i) => i !== idx))} className="mt-7 p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg">
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-4 border-t border-white/10 mt-6">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowCreateModal(false)}>Cancel</Button>
                <Button type="submit" variant="primary" className="flex-1" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit for Approval'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
