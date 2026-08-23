import { useState, useEffect } from 'react';
import { RefreshCw, Plus, Star, ChevronRight, FileText, ShoppingCart, Building } from 'lucide-react';

interface MyRequirementsTabProps {
  rfqs: any[];
  selectedRfqForDetails: any;
  setSelectedRfqForDetails: (rfq: any) => void;
  fetchData: () => Promise<void>;
  setShowRfqModal: (show: boolean) => void;
  handleSelectWinner: (rfqItemId: string, bidId: string) => Promise<void>;
  handleViewRfqDetails: (rfqId: string) => Promise<void>;
}

export default function MyRequirementsTab({
  rfqs,
  selectedRfqForDetails,
  setSelectedRfqForDetails,
  fetchData,
  setShowRfqModal,
  handleSelectWinner,
  handleViewRfqDetails
}: MyRequirementsTabProps) {
  const [subTab, setSubTab] = useState<'buying' | 'selling'>('buying');
  const [myBids, setMyBids] = useState<any[]>([]);
  const [loadingBids, setLoadingBids] = useState(false);

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
    if (subTab === 'selling') {
      fetchMyBids();
    }
  }, [subTab]);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    if (subTab === 'buying') {
      await fetchData();
    } else {
      await fetchMyBids();
    }
    setTimeout(() => setIsRefreshing(false), 600);
  };

  return (
    <div className="space-y-6">
      {/* Title & Description */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            {subTab === 'buying' ? 'My Requirements (Buying)' : 'My Submitted Bids (Selling)'}
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-400">
            {subTab === 'buying' 
              ? 'Create, monitor, and select winners for your component requirements' 
              : 'Monitor quotes and component bids you have submitted to other companies'}
          </p>
        </div>
        <button 
          onClick={handleRefresh} 
          disabled={isRefreshing}
          className="p-2.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all flex items-center justify-center shrink-0"
        >
          <RefreshCw className={`w-4 h-4 text-slate-300 ${isRefreshing ? 'animate-spin-once' : ''}`} />
        </button>
      </div>

      {/* Sub-tab selection (Placed Above Action Buttons) */}
      <div className="flex bg-slate-900/60 p-1 rounded-xl border border-white/5 max-w-sm">
        <button
          onClick={() => { setSubTab('buying'); setSelectedRfqForDetails(null); }}
          className={`flex-1 py-2 text-[11px] sm:text-xs font-semibold rounded-lg transition-all ${subTab === 'buying' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
        >
          Buying (My RFQs)
        </button>
        <button
          onClick={() => { setSubTab('selling'); setSelectedRfqForDetails(null); }}
          className={`flex-1 py-2 text-[11px] sm:text-xs font-semibold rounded-lg transition-all ${subTab === 'selling' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
        >
          Selling (My Bids)
        </button>
      </div>

      {/* Action Buttons (Placed Below Tab Bar) */}
      {subTab === 'buying' && (
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowRfqModal(true)}
            className="flex-1 sm:flex-none py-2.5 px-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Publish New RFQ</span>
          </button>
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
                                <th className="pb-2 font-semibold">Price</th>
                                <th className="pb-2 font-semibold">Delivery Time</th>
                                <th className="pb-2 font-semibold">Rating</th>
                                <th className="pb-2 font-semibold text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {item.bids.map((bid: any) => {
                                const qty = Number(item.quantity) || 0;
                                const totalBase = Number(item.materialOptionPreference === 'WITH_MATERIAL' ? bid.priceWithMaterial : bid.priceWithoutMaterial) || 0;
                                const totalEstimated = totalBase * 1.23; // base + 18% tax + 5% commission
                                const unitPrice = qty > 0 ? (totalBase / qty) : 0;

                                return (
                                  <tr key={bid.id} className="border-b border-white/5 text-slate-300">
                                    <td className="py-2.5 font-medium">{bid.supplierCompany.name}</td>
                                    {item.materialOptionPreference === 'WITH_MATERIAL' ? (
                                      <td className="py-2.5 font-semibold text-blue-400">
                                        Total: ₹{totalEstimated.toLocaleString()}
                                        <span className="text-[10px] font-normal text-slate-500 block">
                                          ₹{unitPrice.toLocaleString()} / unit
                                        </span>
                                      </td>
                                    ) : (
                                      <td className="py-2.5 font-semibold text-purple-400">
                                        Total: ₹{totalEstimated.toLocaleString()}
                                        <span className="text-[10px] font-normal text-slate-500 block">
                                          ₹{unitPrice.toLocaleString()} / unit
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
                                          onClick={() => handleSelectWinner(item.id, bid.id)}
                                          className="px-3 py-1 bg-green-600/10 border border-green-500/20 text-green-400 hover:bg-green-600 hover:text-white rounded-lg text-[10px] font-bold transition-all"
                                        >
                                          Accept Bid
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
              {rfqs.length === 0 ? (
                <div className="col-span-full py-12 text-center text-slate-500 text-sm">You haven't published any requirements yet.</div>
              ) : (
                rfqs.map((rfq: any) => (
                  <div key={rfq.id} className="glass-card rounded-2xl p-5 border border-white/5 flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex justify-between items-start">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${rfq.status === 'PUBLISHED' ? 'text-green-400 bg-green-500/10' : 'text-blue-400 bg-blue-500/10'}`}>{rfq.status}</span>
                        <span className="text-[10px] text-slate-500 font-semibold">{rfq.rfqNumber}</span>
                      </div>
                      <h3 className="font-bold text-base text-white mt-2.5">{rfq.title}</h3>
                      <p className="text-xs text-slate-400 mt-1.5 line-clamp-2">{rfq.description}</p>
                      <div className="mt-4 pt-3 border-t border-white/5 space-y-1.5 text-[11px] text-slate-400">
                        <div>Components: <span className="font-semibold text-slate-200">{rfq.items.length} parts</span></div>
                        <div>Ends: <span className="font-semibold text-slate-200">{new Date(rfq.bidEndAt).toLocaleDateString()}</span></div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleViewRfqDetails(rfq.id)}
                      className="w-full py-2.5 bg-blue-600/10 border border-blue-500/20 text-blue-400 hover:bg-blue-600 hover:text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                    >
                      <span>Compare Bids & Select Winner</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}

      {/* Selling Sub-Tab (Submitted Bids) */}
      {subTab === 'selling' && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loadingBids ? (
            <div className="col-span-full py-12 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
              <span>Loading submitted quotes...</span>
            </div>
          ) : myBids.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-500 text-sm">You haven't submitted any bids/quotes yet.</div>
          ) : (
            myBids.map((bid: any) => {
              const qty = Number(bid.quantity) || 0;
              const totalBase = Number(bid.materialOptionPreference === 'WITH_MATERIAL' ? bid.priceWithMaterial : bid.priceWithoutMaterial) || 0;
              const totalEstimated = totalBase * 1.23;
              const unitPrice = qty > 0 ? (totalBase / qty) : 0;

              return (
                <div key={bid.id} className="glass-card rounded-2xl p-5 border border-white/5 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex justify-between items-start">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                        bid.status === 'ACCEPTED' ? 'text-green-400 bg-green-500/10' : bid.status === 'REJECTED' ? 'text-red-400 bg-red-500/10' : 'text-blue-400 bg-blue-500/10'
                      }`}>
                        {bid.status}
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
                          Total: ₹{totalEstimated.toLocaleString()}
                          <span className="text-[10px] font-normal text-slate-400 block text-right">
                            ₹{unitPrice.toLocaleString()} / unit
                          </span>
                          <span className="text-[9px] font-normal text-slate-500 block text-right">
                            ({bid.materialOptionPreference === 'WITH_MATERIAL' ? 'With Material' : 'Without Material'})
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
      )}
    </div>
  );
}
