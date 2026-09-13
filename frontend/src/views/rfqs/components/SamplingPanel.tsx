'use client';

import { useEffect, useState, useCallback } from 'react';
import { FlaskConical, CheckCircle, Truck, X, Clock, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
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
    <div className="p-4 bg-purple-50/80 border border-purple-200/80 rounded-2xl space-y-4 shadow-2xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-purple-100 text-purple-700 rounded-lg border border-purple-200">
            <FlaskConical className="w-4 h-4" />
          </div>
          <h5 className="text-sm font-bold text-slate-900">Physical Sampling</h5>
        </div>
        {campaign && isActiveCampaign && campaign.status !== 'AWARDED' && campaign.status !== 'CANCELLED' && (
          <button
            onClick={cancelSampling}
            disabled={actionLoading === 'cancel'}
            className="text-xs text-red-600 hover:text-red-700 font-semibold disabled:opacity-50 flex items-center gap-1 cursor-pointer"
          >
            {actionLoading === 'cancel' && <Loader2 className="w-3 h-3 animate-spin" />}
            Cancel Campaign
          </button>
        )}
      </div>

      {!isActiveCampaign && (
        <>
          <p className="text-xs text-slate-600 leading-relaxed">
            Invite up to 5 suppliers to prepare physical samples. A transporter will pick up and deliver samples to you
            — no photos required from suppliers.
          </p>
          {canStart && (
            <button
              onClick={() => setShowStartModal(true)}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
            >
              Start Sampling
            </button>
          )}
          {!hasBids && (
            <p className="text-xs text-slate-500 italic">Waiting for supplier bids before sampling can start.</p>
          )}
        </>
      )}

      {isActiveCampaign && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="text-slate-600 font-medium">
              Status: <span className="font-bold text-purple-800 bg-purple-100 px-2 py-0.5 rounded border border-purple-200">{campaign.status}</span>
            </span>
            {campaign.sampleDeadlineAt && (
              <span className="flex items-center gap-1 font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                Deadline: {formatDeadline(campaign.sampleDeadlineAt)}
              </span>
            )}
          </div>
          <div className="space-y-2">
            {(campaign.invites || []).map((inv: any) => (
              <div
                key={inv.id}
                className="p-3.5 bg-white rounded-xl border border-purple-100 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-900">{inv.supplierName}</p>
                  <p className="text-xs text-slate-500 font-medium">Status: <span className="font-semibold text-purple-700">{inv.status}</span></p>
                  {isSamplePickedUp(inv.delivery) && !isSampleDelivered(inv.delivery) && (
                    <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1 mt-1 inline-block font-medium">
                      {inv.supplierName} sample picked up — in transit to you.
                    </p>
                  )}
                  {isSampleDelivered(inv.delivery) && (
                    <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1 mt-1 inline-block font-medium">
                      {inv.supplierName} sample delivered — ready for evaluation.
                    </p>
                  )}
                  {inv.submission?.notes && (
                    <p className="text-xs text-slate-600 mt-1 bg-slate-50 p-2 rounded border border-slate-200">{inv.submission.notes}</p>
                  )}
                  {inv.delivery && (
                    <div className="mt-2 space-y-1.5">
                      <p className="text-xs text-blue-700 font-medium flex items-center gap-1">
                        <Truck className="w-3.5 h-3.5" /> {inv.delivery.deliveryNumber} — {inv.delivery.status}
                        {inv.delivery.transporterName
                          ? ` · ${inv.delivery.transporterName}`
                          : inv.delivery.status === 'CREATED'
                            ? ' · waiting for transporter'
                            : ''}
                      </p>
                      {inv.delivery.deliveryOtp && (
                        <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1 inline-block">
                          Delivery OTP: <span className="font-mono font-bold tracking-widest text-emerald-900 bg-white px-2 py-0.5 rounded border border-emerald-300">{inv.delivery.deliveryOtp}</span>
                          <span className="block text-emerald-700 text-[11px] font-normal mt-0.5">
                            Share with transporter when sample arrives.
                          </span>
                        </p>
                      )}
                    </div>
                  )}
                  {inv.status === 'SUBMITTED' && !inv.delivery && (
                    <p className="text-xs text-amber-700 mt-1">Scheduling pickup job… refresh in a moment.</p>
                  )}
                </div>
                {canEvaluate && (inv.status === 'DELIVERED' || isSampleDelivered(inv.delivery)) && (
                  <button
                    onClick={() => selectWinner(inv.id)}
                    disabled={actionLoading === `winner-${inv.id}`}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-600 rounded-xl text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs transition-all cursor-pointer"
                  >
                    {actionLoading === `winner-${inv.id}` ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle className="w-3.5 h-3.5" />
                    )}
                    {actionLoading === `winner-${inv.id}` ? 'Selecting...' : 'Select Winner'}
                  </button>
                )}
              </div>
            ))}
          </div>
          {canEvaluate && (
            <p className="text-xs text-slate-500">
              Review physical samples offline after delivery, then select the winning supplier.
            </p>
          )}
        </div>
      )}

      {showStartModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => setShowStartModal(false)}
        >
          <div
            className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-900 text-base">Select suppliers for sampling</h3>
              <button onClick={() => setShowStartModal(false)} className="p-1 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <p className="text-xs text-slate-500">RFQ {rfqNumber} — max 5 companies</p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Sample ready deadline
              </label>
              <input
                type="datetime-local"
                value={sampleDeadlineAt}
                min={defaultDeadlineValue().slice(0, 16)}
                onChange={(e) => setSampleDeadlineAt(e.target.value)}
                className="w-full bg-white border border-slate-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 rounded-xl px-3 py-2 text-sm text-slate-800 outline-none transition-all shadow-2xs"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Suppliers must have samples ready for platform pickup by this date.
              </p>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
              {bidders.map((b) => {
                const selected = b.bidIds.every((id) => selectedBidIds.includes(id));
                return (
                  <label
                    key={b.supplierId}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      selected ? 'border-purple-500 bg-purple-50/60 text-purple-900 font-semibold' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input type="checkbox" checked={selected} onChange={() => toggleBidSelection(b.bidIds)} className="accent-purple-600 rounded" />
                    <span className="text-sm">{b.supplierName}</span>
                  </label>
                );
              })}
            </div>
            <button
              onClick={startSampling}
              disabled={actionLoading === 'start'}
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 active:scale-98 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
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
    <div className="bg-gradient-to-br from-purple-50/70 via-white to-purple-50/40 rounded-2xl p-4 sm:p-5 border border-purple-200/80 shadow-[0_2px_12px_-4px_rgba(147,51,234,0.08)] space-y-4 mb-6 transition-all">
      <div className="flex items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-purple-100/80 text-purple-700 rounded-xl border border-purple-200/60 shadow-xs flex items-center justify-center">
            <FlaskConical className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">Physical Sample Requests</h2>
              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-[11px] font-bold rounded-full border border-purple-200/60">
                {active.length} active
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Prepare your physical sample. A transporter will pick it up and deliver to the buyer — no photo upload needed.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {active.map((inv) => {
          const pastDeadline =
            inv.sampleDeadlineAt && new Date(inv.sampleDeadlineAt).getTime() < Date.now();
          const isExpanded = expandedId === inv.id;

          return (
            <div
              key={inv.id}
              className="bg-white rounded-xl p-4 border border-purple-100/90 shadow-xs hover:border-purple-200 hover:shadow-sm transition-all space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold text-slate-900 text-sm">{inv.rfqTitle || 'RFQ Requirement'}</h4>
                    <span className="text-[11px] font-bold text-slate-300">·</span>
                    <span className="text-xs font-semibold text-slate-500">{inv.rfqNumber}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider border ${
                      inv.status === 'SUBMITTED'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : inv.status === 'READY_FOR_PICKUP'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-purple-50 text-purple-700 border-purple-200'
                    }`}
                  >
                    {inv.status?.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>

              {/* Status Badges & Alerts */}
              {isSamplePickedUp(inv.delivery) && !isSampleDelivered(inv.delivery) && (
                <div className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200/80 rounded-lg px-3 py-2 font-medium">
                  <Truck className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Sample picked up by transporter — currently in transit to the buyer.</span>
                </div>
              )}

              {isSampleDelivered(inv.delivery) && (
                <div className="flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200/80 rounded-lg px-3 py-2 font-medium">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Sample delivered to buyer — waiting for buyer evaluation.</span>
                </div>
              )}

              {inv.sampleDeadlineAt && (
                <div
                  className={`text-xs flex items-center gap-1.5 font-medium ${
                    pastDeadline ? 'text-red-600' : 'text-slate-600'
                  }`}
                >
                  <Clock className={`w-3.5 h-3.5 ${pastDeadline ? 'text-red-500' : 'text-slate-400'}`} />
                  <span>Ready by:</span>
                  <span className={`font-semibold ${pastDeadline ? 'text-red-600' : 'text-slate-900'}`}>
                    {formatDeadline(inv.sampleDeadlineAt)}
                  </span>
                  {pastDeadline && (
                    <span className="text-[11px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                      Deadline passed
                    </span>
                  )}
                </div>
              )}

              {/* Delivery Details & Pickup OTP */}
              {inv.delivery && (
                <div className="p-3 bg-slate-50/80 rounded-lg border border-slate-200/70 text-xs space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 font-semibold text-slate-800">
                      <Truck className="w-3.5 h-3.5 text-blue-600" />
                      Shipment {inv.delivery.deliveryNumber}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                      {inv.delivery.status}
                    </span>
                  </div>

                  {inv.delivery.pickupOtp && ['CREATED', 'ACCEPTED'].includes(inv.delivery.status) && (
                    <div className="p-2.5 bg-purple-50/80 border border-purple-200 rounded-lg flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <span className="text-xs font-semibold text-purple-900">Pickup OTP:</span>
                        <p className="text-[10px] text-purple-700">Share this code with the transporter driver upon pickup</p>
                      </div>
                      <span className="font-mono font-extrabold tracking-widest text-purple-900 text-sm bg-white px-3 py-1 rounded-md border border-purple-300 shadow-2xs">
                        {inv.delivery.pickupOtp}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Action Area */}
              {['INVITED', 'PREPARING'].includes(inv.status) && !pastDeadline && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : inv.id)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-700 hover:text-purple-800 bg-purple-100/70 hover:bg-purple-100 border border-purple-200/80 px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-2xs active:scale-98"
                  >
                    <FlaskConical className="w-3.5 h-3.5 text-purple-600" />
                    <span>{isExpanded ? 'Cancel' : 'Confirm Sample Ready'}</span>
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {isExpanded && (
                    <div className="mt-3 p-3.5 bg-purple-50/40 rounded-xl border border-purple-200/70 space-y-3 animate-in fade-in duration-150">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Pickup Notes & Instructions <span className="text-slate-400 font-normal">(Optional)</span>
                        </label>
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Provide pickup location, contact person phone number, warehouse timing, or package details..."
                          className="w-full bg-white border border-slate-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 rounded-lg p-2.5 text-xs text-slate-800 placeholder-slate-400 outline-none transition-all shadow-2xs"
                          rows={3}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => confirmReadyForPickup(inv.rfqId, inv.id)}
                        disabled={actionLoading === inv.id}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 active:scale-98 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
                      >
                        {actionLoading === inv.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        <span>{actionLoading === inv.id ? 'Submitting...' : 'Sample Ready — Request Transporter Pickup'}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {inv.status === 'SUBMITTED' && !inv.delivery && (
                <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600" />
                  <span>Scheduling transporter pickup with the logistics network...</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
