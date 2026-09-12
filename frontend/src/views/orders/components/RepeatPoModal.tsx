'use client';

import { useEffect, useState } from 'react';
import { Loader2, X, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ChatDatePicker } from '@/components/ui/ChatDatePicker';

type RepeatPoItem = {
  rfqItemId: string;
  componentName: string;
  quantity: number;
  unit: string;
  unitPriceRupees: number;
  previousUnitPricePaise: number;
};

type RepeatPoDraft = {
  poNumber: string;
  sourceRfqNumber: string | null;
  supplierCompany: { id: string; name: string | null };
  paymentTermsDays: number;
  items: RepeatPoItem[];
};

type RepeatPoModalProps = {
  threadId: string;
  user: any;
  onClose: () => void;
  onCreated: (po: { id: string; poNumber: string }) => void;
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void;
};

export default function RepeatPoModal({
  threadId,
  user,
  onClose,
  onCreated,
  showToast,
}: RepeatPoModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<RepeatPoDraft | null>(null);
  const [buyerPrId, setBuyerPrId] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [paymentTermsDays, setPaymentTermsDays] = useState(30);
  const [items, setItems] = useState<RepeatPoItem[]>([]);
  const [prs, setPrs] = useState<any[]>([]);

  const authHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('token')}`,
    'Content-Type': 'application/json',
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [draftRes, prRes] = await Promise.all([
          fetch(`/api/v1/chat/threads/${threadId}/repeat-po`, { headers: authHeaders() }),
          fetch('/api/v1/prs', { headers: authHeaders() }),
        ]);
        const draftData = await draftRes.json();
        const prData = await prRes.json();

        if (cancelled) return;

        if (!draftData.success) {
          showToast(draftData.message || 'Could not load repeat order form', 'error');
          onClose();
          return;
        }

        const d: RepeatPoDraft = draftData.data;
        setDraft(d);
        setItems(d.items || []);
        setPaymentTermsDays(d.paymentTermsDays || 30);

        if (prData.success) {
          setPrs(prData.data || []);
        }
      } catch {
        if (!cancelled) {
          showToast('Failed to load repeat order form', 'error');
          onClose();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [threadId, onClose, showToast]);

  const updateItem = (index: number, patch: Partial<RepeatPoItem>) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const lineTotal = items.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPriceRupees) || 0),
    0
  );

  const handleCreate = async () => {
    if (user?.company?.requirePr && !buyerPrId) {
      showToast('An approved Purchase Requisition is required', 'error');
      return;
    }
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (!item.quantity || item.quantity <= 0) {
        showToast(`Enter quantity for line ${i + 1}`, 'error');
        return;
      }
      if (item.unitPriceRupees == null || Number(item.unitPriceRupees) < 0) {
        showToast(`Enter unit price for line ${i + 1}`, 'error');
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/v1/chat/threads/${threadId}/repeat-po`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          buyerPrId: buyerPrId || undefined,
          expectedDeliveryDate: expectedDeliveryDate || undefined,
          paymentTermsDays,
          items: items.map((item) => ({
            rfqItemId: item.rfqItemId,
            quantity: Number(item.quantity),
            unitPriceRupees: Number(item.unitPriceRupees),
          })),
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`PO ${data.data.poNumber} sent to ${draft?.supplierCompany.name || 'supplier'}`, 'success');
        onCreated({ id: data.data.id, poNumber: data.data.poNumber });
        onClose();
      } else {
        showToast(data.message || 'Failed to create PO', 'error');
      }
    } catch {
      showToast('Failed to create PO', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="relative max-w-2xl w-full bg-white border border-slate-200 rounded-2xl shadow-2xl max-h-[90vh] flex flex-col text-slate-800">
        <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-[#001D4A] flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-blue-600" />
              Create Repeat Purchase Order
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              No bidding — set quantity, price, and delivery timeline, then send the PO directly to the
              supplier using a new PR when required.
            </p>
          </div>
          <button type="button" onClick={() => !saving && onClose()} disabled={saving} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {draft && (
              <div className="p-3 rounded-xl bg-purple-50 border border-purple-200/80 text-xs text-purple-700 font-medium">
                Repeat of {draft.poNumber}
                {draft.sourceRfqNumber ? ` · original RFQ ${draft.sourceRfqNumber}` : ''} · supplier{' '}
                {draft.supplierCompany.name}
              </div>
            )}

            {user?.company?.requirePr && (
              <div>
                <label className="text-[10px] text-blue-600 font-bold uppercase tracking-wider block mb-1.5">
                  Approved Purchase Requisition *
                </label>
                <select
                  value={buyerPrId}
                  onChange={(e) => setBuyerPrId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-[#001D4A] font-medium focus:outline-none focus:border-blue-500 focus:bg-white transition-all cursor-pointer"
                >
                  <option value="">Select approved PR…</option>
                  {prs
                    .filter((pr) => pr.status === 'APPROVED')
                    .map((pr) => (
                      <option key={pr.id} value={pr.id}>
                        {pr.prNumber} — {pr.title}
                      </option>
                    ))}
                </select>
              </div>
            )}

            {!user?.company?.requirePr && prs.some((pr) => pr.status === 'APPROVED') && (
              <div>
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1.5">
                  Link Purchase Requisition (optional)
                </label>
                <select
                  value={buyerPrId}
                  onChange={(e) => setBuyerPrId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-[#001D4A] font-medium focus:outline-none focus:border-blue-500 focus:bg-white transition-all cursor-pointer"
                >
                  <option value="">No PR linked</option>
                  {prs
                    .filter((pr) => pr.status === 'APPROVED')
                    .map((pr) => (
                      <option key={pr.id} value={pr.id}>
                        {pr.prNumber} — {pr.title}
                      </option>
                    ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1.5">
                  Expected delivery date
                </label>
                <ChatDatePicker
                  value={expectedDeliveryDate}
                  onChange={setExpectedDeliveryDate}
                  disabled={saving}
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1.5">
                  Payment terms (days)
                </label>
                <input
                  type="number"
                  min={1}
                  value={paymentTermsDays}
                  onChange={(e) => setPaymentTermsDays(Number(e.target.value) || 30)}
                  className="w-full h-[42px] bg-slate-50 border border-slate-200 rounded-xl px-3 text-xs text-[#001D4A] font-medium focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wider">Line items</h4>
              {items.map((item, idx) => (
                <div key={item.rfqItemId || idx} className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/80 space-y-2.5">
                  <p className="text-xs font-bold text-[#001D4A]">{item.componentName}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-1 font-medium">Quantity</label>
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) || 0 })}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-[#001D4A] font-medium focus:outline-none focus:border-blue-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-1 font-medium">Unit price (₹)</label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.unitPriceRupees}
                        onChange={(e) =>
                          updateItem(idx, { unitPriceRupees: Number(e.target.value) || 0 })
                        }
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-[#001D4A] font-medium focus:outline-none focus:border-blue-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-1 font-medium">Previous unit price</label>
                      <p className="text-xs text-slate-600 py-1.5 font-semibold">
                        ₹{(item.previousUnitPricePaise / 100).toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-xs text-slate-600">
              Estimated goods total:{' '}
              <span className="font-extrabold text-[#001D4A]">
                ₹{lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>{' '}
              <span className="text-[11px] text-slate-400">(tax &amp; commission added on server)</span>
            </p>
          </div>
        )}

        <div className="p-5 border-t border-slate-100 flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 transition-all cursor-pointer"
          >
            Cancel
          </button>
          <Button variant="primary" onClick={handleCreate} loading={saving} disabled={loading} className="flex-1 py-2.5 rounded-xl text-xs font-bold cursor-pointer">
            Create &amp; Send PO
          </Button>
        </div>
      </div>
    </div>
  );
}
