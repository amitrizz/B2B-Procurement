import { useState, useEffect } from 'react';
import { Plus, Star, ChevronRight, FileText, ShoppingCart, Building, RefreshCw, Loader2 } from 'lucide-react';
import { ButtonSpinner } from '@/components/ui/ActionButton';
import SamplingPanel, { SupplierSamplingPanel } from './SamplingPanel';
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
    <div className="space-y-6">
      {/* Title & Description */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            {mode === 'buyer' ? 'My Requirements (Buying)' : 'My Submitted Bids (Selling)'}
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-400">
            {mode === 'buyer' 
              ? 'Create, monitor, and select winners for your component requirements' 
              : 'Monitor quotes and component bids you have submitted to other companies'}
          </p>
        </div>
        <RefreshButton onRefresh={handleRefresh} />
      </div>

      {/* Status Filter Sub-Tabs */}
      <div className="flex bg-slate-900/60 p-1 rounded-xl border border-white/5 max-w-md">
        <button
          onClick={() => { setStatusFilter('open'); setSelectedRfqForDetails(null); }}
          className={`flex-1 py-2 text-[11px] sm:text-xs font-semibold rounded-lg transition-all ${statusFilter === 'open' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
        >
          Open
        </button>
        <button
          onClick={() => { setStatusFilter('in_progress'); setSelectedRfqForDetails(null); }}
          className={`flex-1 py-2 text-[11px] sm:text-xs font-semibold rounded-lg transition-all ${statusFilter === 'in_progress' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
        >
          In Progress
        </button>
        <button
          onClick={() => { setStatusFilter('closed'); setSelectedRfqForDetails(null); }}
          className={`flex-1 py-2 text-[11px] sm:text-xs font-semibold rounded-lg transition-all ${statusFilter === 'closed' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
        >
          Closed
        </button>
      </div>

      {/* Action Buttons (Placed Below Tab Bar) */}
      {subTab === 'buying' && (
        <div className="flex gap-2 w-full sm:w-auto">
          {statusFilter === 'open' && (
            <button
              onClick={() => setShowRfqModal(true)}
              className="py-2 px-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-blue-500/10 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Publish New RFQ</span>
            </button>
          )}
        </div>
      )}

      {/* Buying Sub-Tab (Existing view) */}
      {subTab === 'buying' && (
        <>
          {selectedRfqForDetails ? (
            <div className="glass-card rounded-2xl p-6 border border-white/5 space-y-6">
              <div className="flex justify-between items-center border-b border-white/5 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white">{selectedRfqForDetails.title}</h2>
                  <span className="text-[10px] text-slate-500">{selectedRfqForDetails.rfqNumber}</span>
                </div>
                <button onClick={() => setSelectedRfqForDetails(null)} className="text-xs text-slate-400 hover:text-white">Close Details</button>
              </div>

              <SamplingPanel
                rfqId={selectedRfqForDetails.id}
                rfqNumber={selectedRfqForDetails.rfqNumber}
                items={selectedRfqForDetails.items}
                onRefresh={fetchData}
                onDetailsRefresh={handleViewRfqDetails}
                showToast={showToast}
              />

              <div className="space-y-6">
                {selectedRfqForDetails.items.map((item: any) => (
                  <div key={item.id} className="p-4 bg-slate-900/30 rounded-xl border border-white/5 space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-sm text-slate-200">{item.componentName}</h4>
                        <span className="text-[10px] text-slate-500">Qty: {Number(item.quantity)} {item.unit} | HSN: {item.hsnCode} | Sourcing: {item.materialOptionPreference === 'WITH_MATERIAL' ? 'With Material' : 'Without Material'}</span>
                      </div>
                    </div>

                    {/* Bids received list */}
                    <div className="space-y-2">
                      <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Received Quotes</h5>
                      {item.bids && item.bids.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="text-slate-500 border-b border-white/5">
                                <th className="pb-2 font-semibold">Supplier</th>
                                {item.materialOptionPreference === 'WITH_MATERIAL' ? (
                                  <th className="pb-2 font-semibold">Price (With Material)</th>
                                ) : (
                                  <th className="pb-2 font-semibold">Price (Without Material)</th>
                                )}
                                <th className="pb-2 font-semibold">Delivery Time</th>
                                <th className="pb-2 font-semibold">Rating</th>
                                <th className="pb-2 font-semibold text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {item.bids.map((bid: any) => {
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
                                const feeLabel = `incl. platform fee ₹${formatInrFromPaise(pricing.commissionPaise)} + GST ₹${formatInrFromPaise(pricing.feeGstPaise)}`;

                                return (
                                  <tr key={bid.id} className="border-b border-white/5 text-slate-300">
                                    <td className="py-2.5 font-medium">{bid.supplierCompany.name}</td>
                                    {item.materialOptionPreference === 'WITH_MATERIAL' ? (
                                      <td className="py-2.5 font-semibold text-blue-400">
                                        Total: ₹{buyerTotal.toLocaleString('en-IN')}
                                        <span className="text-[10px] font-normal text-slate-500 block">
                                          ₹{unitTotal.toLocaleString('en-IN')} / unit
                                        </span>
                                        <span className="text-[9px] font-normal text-slate-500 block">
                                          {feeLabel}
                                        </span>
                                      </td>
                                    ) : (
                                      <td className="py-2.5 font-semibold text-purple-400">
                                        Total: ₹{buyerTotal.toLocaleString('en-IN')}
                                        <span className="text-[10px] font-normal text-slate-500 block">
                                          ₹{unitTotal.toLocaleString('en-IN')} / unit
                                        </span>
                                        <span className="text-[9px] font-normal text-slate-500 block">
                                          {feeLabel}
                                        </span>
                                      </td>
                                    )}
                                    <td className="py-2.5">{bid.estimatedTimeDays} days</td>
                                    <td className="py-2.5 flex items-center text-yellow-400"><Star className="w-3 h-3 fill-yellow-400 mr-1" /> 4.8</td>
                                    <td className="py-2.5 text-right font-semibold text-xs">
                                      {bid.status === 'ACCEPTED' ? (
                                        <span className="text-green-400 bg-green-500/10 px-2.5 py-1.5 rounded-lg">Accepted</span>
                                      ) : bid.status === 'REJECTED' ? (
                                        <span className="text-red-400 bg-red-500/10 px-2.5 py-1.5 rounded-lg">Rejected</span>
                                      ) : (
                                        <button
                                          onClick={() => setAwardModal({ rfqItemId: item.id, bidId: bid.id, maxQty: Number(item.quantity), currentQty: Number(item.quantity) })}
                                          disabled={selectedRfqForDetails.status === 'SAMPLING'}
                                          className="px-3 py-1 bg-green-600/10 border border-green-500/20 text-green-400 hover:bg-green-600 hover:text-white rounded-lg text-[10px] font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                          title={selectedRfqForDetails.status === 'SAMPLING' ? 'Complete sampling first' : undefined}
                                        >
                                          Award Bid
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-600 italic">No quotes received yet.</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredRfqs.length === 0 ? (
                <div className="col-span-full py-12 text-center text-slate-500 text-sm">No requirements found matching this status.</div>
              ) : (
                filteredRfqs.map((rfq: any) => (
                  <div key={rfq.id} className="glass-card rounded-2xl p-5 border border-white/5 flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex justify-between items-start">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${rfq.status === 'PUBLISHED' || rfq.status === 'BIDDING_OPEN' ? 'text-green-400 bg-green-500/10' : 'text-blue-400 bg-blue-500/10'}`}>{rfq.status}</span>
                        <span className="text-[10px] text-slate-500 font-semibold">{rfq.rfqNumber}</span>
                      </div>
                      <h3 className="font-bold text-base text-white mt-2.5">{rfq.title}</h3>
                      <p className="text-xs text-slate-400 mt-1.5 line-clamp-2">{rfq.description}</p>
                      <div className="mt-4 pt-3 border-t border-white/5 space-y-1.5 text-[11px] text-slate-400">
                        {rfq.pr && (
                          <div>Linked PR: <span className="font-semibold text-slate-200">{rfq.pr.prNumber}</span></div>
                        )}
                        <div>Components: <span className="font-semibold text-slate-200">{rfq.items.length} parts</span></div>
                        <div>Ends: <span className="font-semibold text-slate-200">{new Date(rfq.bidEndAt).toLocaleDateString()}</span></div>
                      </div>
                    </div>
                    {statusFilter === 'open' && (
                      <div className="flex gap-2">
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
                          className="flex-1 py-2.5 bg-blue-600/10 border border-blue-500/20 text-blue-400 hover:bg-blue-600 hover:text-white disabled:opacity-60 disabled:cursor-not-allowed rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                        >
                          {detailsLoadingId === rfq.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <>
                              <span>Compare Bids & Select Winner</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleEditRfq(rfq)}
                          className="py-2.5 px-3 bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 rounded-xl text-xs font-semibold transition-all"
                        >
                          Edit
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
        <>
        <SupplierSamplingPanel showToast={showToast} isVisible={subTab === 'selling'} />
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loadingBids ? (
            <div className="col-span-full py-12 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
              <span>Loading submitted quotes...</span>
            </div>
          ) : filteredBids.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-500 text-sm">No bids found matching this status.</div>
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
              let statusStyle = 'text-blue-400 bg-blue-500/10';

              if (bid.status === 'ACCEPTED') {
                if (bid.rfq?.status === 'COMPLETED') {
                  displayStatus = 'COMPLETED';
                  statusStyle = 'text-green-400 bg-green-500/10';
                } else {
                  statusStyle = 'text-green-400 bg-green-500/10';
                }
              } else if (bid.status === 'REJECTED') {
                statusStyle = 'text-red-400 bg-red-500/10';
              } else if (bid.rfq?.status === 'CANCELLED' || bid.rfq?.status === 'EXPIRED' || bid.rfq?.status === 'COMPLETED') {
                displayStatus = bid.rfq.status;
                statusStyle = 'text-slate-400 bg-slate-500/10';
              } else if (bid.status === 'WITHDRAWN') {
                statusStyle = 'text-slate-400 bg-slate-500/10';
              }

              return (
                <div key={bid.id} className="glass-card rounded-2xl p-5 border border-white/5 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex justify-between items-start">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${statusStyle}`}>
                        {displayStatus}
                      </span>
                      <span className="text-[10px] text-slate-500 font-semibold">{bid.rfq?.rfqNumber}</span>
                    </div>
                    <h3 className="font-bold text-base text-white mt-2.5">{bid.rfq?.title}</h3>
                    <div className="mt-4 pt-3 border-t border-white/5 space-y-1.5 text-xs text-slate-300">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] text-slate-500 uppercase font-semibold">Component Bid On:</span>
                        <span className="text-blue-400 font-semibold">{bid.rfqItem?.componentName}</span>
                      </div>
                      <div className="flex justify-between mt-2 pt-2 border-t border-white/5">
                        <span className="text-slate-500">Your Quote:</span>
                        <span className="font-bold text-slate-200">
                          Total: ₹{totalQuote.toLocaleString('en-IN')}
                          <span className="text-[10px] font-normal text-slate-400 block text-right">
                            ₹{unitPrice.toLocaleString('en-IN')} / unit
                          </span>
                          <span className="text-[9px] font-normal text-slate-500 block text-right">
                            ({bid.materialOptionPreference === 'WITH_MATERIAL' ? 'With Material' : 'Without Material'})
                          </span>
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Buyer Pays:</span>
                        <span className="font-semibold text-slate-200 text-right">
                          ₹{buyerTotal.toLocaleString('en-IN')}
                          <span className="text-[9px] font-normal text-slate-500 block">
                            incl. platform fee ₹{formatInrFromPaise(pricing.commissionPaise)} + GST ₹{formatInrFromPaise(pricing.feeGstPaise)}
                          </span>
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Quoted Delivery:</span>
                        <span className="font-semibold text-slate-200">{bid.estimatedTimeDays} days</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        </>
      )}

      {/* Award Bid Modal */}
      {awardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setAwardModal(null)}>
          <div className="relative max-w-sm w-full bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-4">Award Bid</h3>
            <p className="text-xs text-slate-400 mb-4">You can award the full quantity or split it.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Quantity to Award</label>
                <input
                  type="number"
                  min={1}
                  max={awardModal.maxQty}
                  value={awardModal.currentQty}
                  onChange={(e) => setAwardModal({ ...awardModal, currentQty: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                />
                <span className="text-[10px] text-slate-500 block mt-1">Max available to award: {awardModal.maxQty}</span>
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
                className="w-full py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all active:scale-95 shadow-lg shadow-green-500/20 flex items-center justify-center gap-2"
              >
                {awardLoading && <ButtonSpinner />}
                {awardLoading ? 'Awarding...' : 'Confirm Award'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
