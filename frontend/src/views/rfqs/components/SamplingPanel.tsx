'use client';

import { useEffect, useState, useCallback } from 'react';
import { FlaskConical, CheckCircle, Truck, X, Clock, Loader2 } from 'lucide-react';
import { onCentrifugoEvent } from '@/lib/centrifugoClient';

function defaultDeadlineValue() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function formatDeadline(value: string | Date | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function isSamplePickedUp(delivery?: { status?: string }) {
  return Boolean(delivery?.status && ['PICKED_UP', 'IN_TRANSIT', 'DELIVERED'].includes(delivery.status));
}

function isSampleDelivered(delivery?: { status?: string }) {
  return delivery?.status === 'DELIVERED';
}

type SamplingPanelProps = {
  rfqId: string;
  rfqNumber: string;
  items: any[];
  onRefresh: () => void;
  onDetailsRefresh?: (rfqId: string) => Promise<void>;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
};

export default function SamplingPanel({
  rfqId,
  rfqNumber,
  items,
  onRefresh,
  onDetailsRefresh,
  showToast,
}: SamplingPanelProps) {
  const [campaign, setCampaign] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBidIds, setSelectedBidIds] = useState<string[]>([]);
  const [showStartModal, setShowStartModal] = useState(false);
  const [sampleDeadlineAt, setSampleDeadlineAt] = useState(defaultDeadlineValue);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const headers = () => ({
    Authorization: `Bearer ${localStorage.getItem('token')}`,
    'Content-Type': 'application/json',
  });

  const loadCampaign = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/rfqs/${rfqId}/sampling?_t=${Date.now()}`, {
        headers: headers(),
        cache: 'no-store',
      });
      const data = await res.json();
      if (data.success) setCampaign(data.data);
    } catch {
      showToast('Failed to load sampling', 'error');
    } finally {
      setLoading(false);
    }
  }, [rfqId]);

  useEffect(() => {
    loadCampaign();
  }, [loadCampaign]);

  useEffect(() => {
    const unsub = onCentrifugoEvent((data) => {
      const eventType = data?.eventType || '';
      if (/sample_picked_up|sample_delivered|sampling_|sample_ready/i.test(eventType)) {
        loadCampaign();
        if (/sampling_winner/i.test(eventType)) {
          onDetailsRefresh?.(rfqId);
        }
      }
    });
    return unsub;
  }, [loadCampaign, onDetailsRefresh, rfqId]);

  const uniqueBidders = () => {
    const map = new Map<string, { supplierName: string; bidIds: string[] }>();
    for (const item of items || []) {
      for (const bid of item.bids || []) {
        if (bid.status !== 'SUBMITTED') continue;
        const sid = bid.supplierCompany?.id || bid.supplierCompanyId;
        if (!sid) continue;
        if (!map.has(sid)) {
          map.set(sid, { supplierName: bid.supplierCompany?.name || 'Supplier', bidIds: [] });
        }
        map.get(sid)!.bidIds.push(bid.id);
      }
    }
    return [...map.entries()].map(([supplierId, v]) => ({ supplierId, ...v }));
  };

  const toggleBidSelection = (bidIds: string[]) => {
    const allSelected = bidIds.every((id) => selectedBidIds.includes(id));
    if (allSelected) {
      setSelectedBidIds((prev) => prev.filter((id) => !bidIds.includes(id)));
    } else {
      const nextSuppliers = new Set(
        uniqueBidders()
          .filter((b) => b.bidIds.some((id) => selectedBidIds.includes(id) || bidIds.includes(id)))
          .map((b) => b.supplierId)
      );
      const addingNew = !bidIds.some((id) => selectedBidIds.includes(id));
      if (addingNew && nextSuppliers.size > 5) {
        showToast('Maximum 5 suppliers for sampling', 'error');
        return;
      }
      setSelectedBidIds((prev) => [...new Set([...prev, ...bidIds])]);
    }
  };

  const startSampling = async () => {
    if (selectedBidIds.length === 0) {
      showToast('Select at least one supplier', 'error');
      return;
    }
    if (!sampleDeadlineAt) {
      showToast('Set a sampling deadline', 'error');
      return;
    }
    setActionLoading('start');
    try {
      const res = await fetch(`/api/v1/rfqs/${rfqId}/sampling`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ bidIds: selectedBidIds, sampleDeadlineAt }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Sampling started', 'success');
        setShowStartModal(false);
        setSelectedBidIds([]);
        setSampleDeadlineAt(defaultDeadlineValue());
        await loadCampaign();
        onRefresh();
      } else {
        showToast(data.message || 'Failed to start sampling', 'error');
      }
    } catch {
      showToast('Failed to start sampling', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const selectWinner = async (inviteId: string) => {
    setActionLoading(`winner-${inviteId}`);
    try {
      const res = await fetch(`/api/v1/rfqs/${rfqId}/sampling/select-winner`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ inviteId }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Winner selected', 'success');
        await loadCampaign();
        await onDetailsRefresh?.(rfqId);
        onRefresh();
      } else {
        showToast(data.message || 'Failed to select winner', 'error');
      }
    } catch {
      showToast('Failed to select winner', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const cancelSampling = async () => {
    setActionLoading('cancel');
    try {
      const res = await fetch(`/api/v1/rfqs/${rfqId}/sampling/cancel`, { method: 'POST', headers: headers() });
      const data = await res.json();
      if (data.success) {
        showToast('Sampling cancelled', 'success');
        setCampaign(null);
        onRefresh();
      } else {
        showToast(data.message || 'Failed to cancel', 'error');
      }
    } catch {
      showToast('Failed to cancel sampling', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return <div className="text-xs text-slate-500 py-4">Loading sampling...</div>;
  }

  const bidders = uniqueBidders();
  const hasBids = bidders.length > 0;
  const isActiveCampaign =
    campaign && !['CANCELLED', 'AWARDED'].includes(campaign.status);
  const canStart = !isActiveCampaign && hasBids;
  const canEvaluate = isActiveCampaign && ['DELIVERED', 'EVALUATION'].includes(campaign.status);

  return (
    <div className="p-4 bg-purple-500/5 border border-purple-500/20 rounded-xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-purple-400" />
          <h5 className="text-sm font-bold text-purple-300">Physical Sampling</h5>
        </div>
        {campaign && isActiveCampaign && campaign.status !== 'AWARDED' && campaign.status !== 'CANCELLED' && (
          <button
            onClick={cancelSampling}
            disabled={actionLoading === 'cancel'}
            className="text-[10px] text-red-400 hover:text-red-300 disabled:opacity-50 flex items-center gap-1"
          >
            {actionLoading === 'cancel' && <Loader2 className="w-3 h-3 animate-spin" />}
            Cancel
          </button>
        )}
      </div>

      {!isActiveCampaign && (
        <>
          <p className="text-[11px] text-slate-400">
            Invite up to 5 suppliers to prepare physical samples. A transporter will pick up and deliver samples to you
            — no photos required from suppliers.
          </p>
          {canStart && (
            <button
              onClick={() => setShowStartModal(true)}
              className="px-4 py-2 bg-purple-600/20 border border-purple-500/30 text-purple-300 rounded-lg text-xs font-bold hover:bg-purple-600/30"
            >
              Start Sampling
            </button>
          )}
          {!hasBids && (
            <p className="text-[11px] text-slate-500 italic">Waiting for supplier bids before sampling can start.</p>
          )}
        </>
      )}

      {isActiveCampaign && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 text-[11px]">
            <span className="text-slate-500">
              Status: <span className="font-bold text-purple-300">{campaign.status}</span>
            </span>
            {campaign.sampleDeadlineAt && (
              <span className="flex items-center gap-1 text-amber-400">
                <Clock className="w-3 h-3" />
                Deadline: {formatDeadline(campaign.sampleDeadlineAt)}
              </span>
            )}
          </div>
          <div className="space-y-2">
            {(campaign.invites || []).map((inv: any) => (
              <div
                key={inv.id}
                className="p-3 bg-slate-900/40 rounded-lg border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <p className="text-sm font-semibold text-white">{inv.supplierName}</p>
                  <p className="text-[10px] text-slate-500">Status: {inv.status}</p>
                  {isSamplePickedUp(inv.delivery) && !isSampleDelivered(inv.delivery) && (
                    <p className="text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2 py-1 mt-1 inline-block">
                      {inv.supplierName} sample picked up — in transit to you.
                    </p>
                  )}
                  {isSampleDelivered(inv.delivery) && (
                    <p className="text-[10px] text-green-300 bg-green-500/10 border border-green-500/20 rounded-lg px-2 py-1 mt-1 inline-block">
                      {inv.supplierName} sample delivered — ready for evaluation.
                    </p>
                  )}
                  {inv.submission?.notes && (
                    <p className="text-[11px] text-slate-400 mt-1">{inv.submission.notes}</p>
                  )}
                  {inv.delivery && (
                    <div className="mt-2 space-y-1">
                      <p className="text-[10px] text-blue-400 flex items-center gap-1">
                        <Truck className="w-3 h-3" /> {inv.delivery.deliveryNumber} — {inv.delivery.status}
                        {inv.delivery.transporterName
                          ? ` · ${inv.delivery.transporterName}`
                          : inv.delivery.status === 'CREATED'
                            ? ' · waiting for transporter'
                            : ''}
                      </p>
                      {inv.delivery.deliveryOtp && (
                        <p className="text-[10px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2 py-1 inline-block">
                          Delivery OTP: <span className="font-bold tracking-widest">{inv.delivery.deliveryOtp}</span>
                          <span className="block text-emerald-400/80 font-normal mt-0.5">
                            Share with transporter when sample arrives.
                          </span>
                        </p>
                      )}
                    </div>
                  )}
                  {inv.status === 'SUBMITTED' && !inv.delivery && (
                    <p className="text-[10px] text-amber-400 mt-1">Scheduling pickup job… refresh in a moment.</p>
                  )}
                </div>
                {canEvaluate && (inv.status === 'DELIVERED' || isSampleDelivered(inv.delivery)) && (
                  <button
                    onClick={() => selectWinner(inv.id)}
                    disabled={actionLoading === `winner-${inv.id}`}
                    className="px-3 py-1.5 bg-green-600/20 border border-green-500/30 text-green-400 rounded-lg text-[10px] font-bold flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {actionLoading === `winner-${inv.id}` ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <CheckCircle className="w-3 h-3" />
                    )}
                    {actionLoading === `winner-${inv.id}` ? 'Selecting...' : 'Select Winner'}
                  </button>
                )}
              </div>
            ))}
          </div>
          {canEvaluate && (
            <p className="text-[10px] text-slate-500">
              Review physical samples offline after delivery, then select the winning supplier.
            </p>
          )}
        </div>
      )}

      {showStartModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setShowStartModal(false)}
        >
          <div
            className="max-w-md w-full bg-slate-900 border border-white/10 rounded-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-white">Select suppliers for sampling</h3>
              <button onClick={() => setShowStartModal(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <p className="text-xs text-slate-400">RFQ {rfqNumber} — max 5 companies</p>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                Sample ready deadline
              </label>
              <input
                type="datetime-local"
                value={sampleDeadlineAt}
                min={defaultDeadlineValue().slice(0, 16)}
                onChange={(e) => setSampleDeadlineAt(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-200"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Suppliers must have samples ready for platform pickup by this date.
              </p>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {bidders.map((b) => {
                const selected = b.bidIds.every((id) => selectedBidIds.includes(id));
                return (
                  <label
                    key={b.supplierId}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${
                      selected ? 'border-purple-500/50 bg-purple-500/10' : 'border-white/5'
                    }`}
                  >
                    <input type="checkbox" checked={selected} onChange={() => toggleBidSelection(b.bidIds)} />
                    <span className="text-sm text-slate-200">{b.supplierName}</span>
                  </label>
                );
              })}
            </div>
            <button
              onClick={startSampling}
              disabled={actionLoading === 'start'}
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2"
            >
              {actionLoading === 'start' && <Loader2 className="w-4 h-4 animate-spin" />}
              {actionLoading === 'start' ? 'Starting...' : 'Start Sampling'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function SupplierSamplingPanel({
  showToast,
  isVisible = true,
}: {
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  isVisible?: boolean;
}) {
  const [invites, setInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/sampling/invites?_t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        cache: 'no-store',
      });
      const data = await res.json();
      if (data.success) setInvites(data.data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isVisible) load();
  }, [isVisible, load]);

  useEffect(() => {
    const unsub = onCentrifugoEvent((data) => {
      const eventType = data?.eventType || '';
      if (/sampling_cancelled|sampling_started|sampling_winner|sample_picked_up|sample_delivered|sample_ready/i.test(eventType)) {
        load();
      }
    });
    return unsub;
  }, [load]);

  const confirmReadyForPickup = async (rfqId: string, inviteId: string) => {
    setActionLoading(inviteId);
    try {
      const submitRes = await fetch(`/api/v1/rfqs/${rfqId}/sampling/invites/${inviteId}/submit`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notes }),
      });
      const submitData = await submitRes.json();
      if (!submitData.success) {
        showToast(submitData.message || 'Failed to confirm sample', 'error');
        return;
      }

      const pickupOtp = submitData.data?.pickupOtp || submitData.data?.delivery?.pickupOtp;
      const deliveryNumber = submitData.data?.delivery?.deliveryNumber;
      showToast(
        pickupOtp && deliveryNumber
          ? `Pickup ${deliveryNumber} created. Share pickup OTP with transporter: ${pickupOtp}`
          : submitData.message || 'Sample ready for transporter pickup',
        'success'
      );
      setExpandedId(null);
      setNotes('');
      load();
    } catch {
      showToast('Failed to confirm sample ready', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return null;
  const active = invites.filter(
    (i) =>
      !['NOT_SELECTED', 'WITHDRAWN', 'SELECTED'].includes(i.status) &&
      i.campaignStatus &&
      !['CANCELLED', 'AWARDED'].includes(i.campaignStatus)
  );
  if (active.length === 0) return null;

  return (
    <div className="glass-card rounded-2xl p-5 border border-purple-500/20 space-y-4 mb-6">
      <div className="flex items-center gap-2">
        <FlaskConical className="w-5 h-5 text-purple-400" />
        <h2 className="text-lg font-bold text-white">Sample Requests</h2>
      </div>
      <p className="text-[11px] text-slate-400">
        Prepare your physical sample. A transporter will pick it up and deliver to the buyer — no photo upload needed.
      </p>
      <div className="space-y-3">
        {active.map((inv) => {
          const pastDeadline =
            inv.sampleDeadlineAt && new Date(inv.sampleDeadlineAt).getTime() < Date.now();
          return (
            <div key={inv.id} className="p-4 bg-slate-900/40 rounded-xl border border-white/5">
              <p className="font-semibold text-white">{inv.rfqTitle}</p>
              <p className="text-[10px] text-slate-500">
                {inv.rfqNumber} — {inv.status}
              </p>
              {isSamplePickedUp(inv.delivery) && !isSampleDelivered(inv.delivery) && (
                <p className="text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2 py-1 mt-1 inline-block">
                  Sample picked up — on the way to buyer.
                </p>
              )}
              {isSampleDelivered(inv.delivery) && (
                <p className="text-[10px] text-green-300 bg-green-500/10 border border-green-500/20 rounded-lg px-2 py-1 mt-1 inline-block">
                  Sample delivered to buyer.
                </p>
              )}
              {inv.sampleDeadlineAt && (
                <p
                  className={`text-[10px] mt-1 flex items-center gap-1 ${
                    pastDeadline ? 'text-red-400' : 'text-amber-400'
                  }`}
                >
                  <Clock className="w-3 h-3" />
                  Ready by: {formatDeadline(inv.sampleDeadlineAt)}
                  {pastDeadline ? ' (deadline passed)' : ''}
                </p>
              )}
              {inv.delivery && (
                <div className="mt-2 space-y-1">
                  <p className="text-[10px] text-blue-400 flex items-center gap-1">
                    <Truck className="w-3 h-3" />
                    {inv.delivery.deliveryNumber} — {inv.delivery.status}
                  </p>
                  {inv.delivery.pickupOtp && ['CREATED', 'ACCEPTED'].includes(inv.delivery.status) && (
                    <p className="text-[10px] text-purple-300 bg-purple-500/10 border border-purple-500/20 rounded-lg px-2 py-1 inline-block">
                      Pickup OTP: <span className="font-bold tracking-widest">{inv.delivery.pickupOtp}</span>
                      <span className="block text-purple-400/80 font-normal mt-0.5">
                        Share with transporter at pickup.
                      </span>
                    </p>
                  )}
                </div>
              )}
              {['INVITED', 'PREPARING'].includes(inv.status) && !pastDeadline && (
                <>
                  <button
                    onClick={() => setExpandedId(expandedId === inv.id ? null : inv.id)}
                    className="mt-2 text-xs text-purple-400 font-bold"
                  >
                    Confirm Sample Ready
                  </button>
                  {expandedId === inv.id && (
                    <div className="mt-3 space-y-2">
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Optional notes for pickup (location, contact, etc.)"
                        className="w-full bg-slate-950 border border-white/10 rounded-lg p-2 text-xs text-slate-200"
                        rows={3}
                      />
                      <button
                        onClick={() => confirmReadyForPickup(inv.rfqId, inv.id)}
                        disabled={actionLoading === inv.id}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold flex items-center gap-2"
                      >
                        {actionLoading === inv.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        {actionLoading === inv.id ? 'Submitting...' : 'Sample Ready — Request Transporter Pickup'}
                      </button>
                    </div>
                  )}
                </>
              )}
              {inv.status === 'SUBMITTED' && !inv.delivery && (
                <p className="text-[10px] text-slate-500 mt-2">Scheduling transporter pickup…</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
