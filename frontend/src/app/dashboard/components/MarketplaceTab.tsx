import { RefreshCw, ArrowLeft, ChevronRight, Search } from 'lucide-react';

interface MarketplaceTabProps {
  marketplaceRfqs: any[];
  selectedRfqForBidding: any;
  setSelectedRfqForBidding: (rfq: any) => void;
  bidInputs: { [key: string]: { priceWith: number, priceWithout: number, leadTime: number } };
  setBidInputs: (inputs: any) => void;
  handleStartBidding: (rfq: any) => void;
  handleSubmitBid: (rfqItemId: string) => Promise<void>;
  handleWithdrawBid: (rfqItemId: string) => Promise<void>;
  fetchData: () => Promise<void>;
}

export default function MarketplaceTab({
  marketplaceRfqs,
  selectedRfqForBidding,
  setSelectedRfqForBidding,
  bidInputs,
  setBidInputs,
  handleStartBidding,
  handleSubmitBid,
  handleWithdrawBid,
  fetchData
}: MarketplaceTabProps) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Public B2B Marketplace</h1>
          <p className="text-xs text-slate-400">Quote on open procurement requirements from other companies</p>
        </div>
        <button onClick={fetchData} className="p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all">
          <RefreshCw className="w-4 h-4 text-slate-300" />
        </button>
      </div>

      {selectedRfqForBidding ? (
        <div className="glass-card rounded-2xl p-6 border border-white/5 space-y-6">
          <div className="flex justify-between items-center border-b border-white/5 pb-4">
            <h2 className="text-lg font-bold text-white">Submit Bids for {selectedRfqForBidding.title}</h2>
             <button
              onClick={() => setSelectedRfqForBidding(null)}
              className="px-3.5 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-slate-300 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Marketplace</span>
            </button>
          </div>
          {new Date(selectedRfqForBidding.bidEndAt) < new Date() && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-semibold text-center">
              Bidding has closed for this requirement. You can no longer submit or update quotes.
            </div>
          )}
          <div className="space-y-6">
            {selectedRfqForBidding.items.map((item: any) => (
              <div key={item.id} className="p-4 bg-slate-900/50 rounded-xl border border-white/5 grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-sm text-blue-400">{item.componentName}</h4>
                  <p className="text-xs text-slate-400 mt-1">Quantity Requested: {Number(item.quantity)} {item.unit}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Target Lead Time: <span className="font-semibold text-slate-300">{item.expectedTimeDays || 'N/A'} days</span></p>
                  <p className="text-[10px] text-slate-500 mt-1 font-semibold uppercase">
                    Sourcing option: {item.materialOptionPreference === 'WITH_MATERIAL' ? 'With Material' : 'Without Material'}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">Drawing: <a href={`/uploads/${item.drawingFileId}`} target="_blank" rel="noreferrer" className="underline text-blue-500">{item.drawingFileId}</a></p>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Your Price Quote</label>
                    {item.materialOptionPreference === 'WITH_MATERIAL' ? (
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-semibold">₹</span>
                        <input
                          type="text"
                          placeholder="Enter price with material included"
                          value={bidInputs[item.id]?.priceWith ? Number(bidInputs[item.id].priceWith).toLocaleString('en-IN') : ''}
                          onChange={(e) => {
                            const clean = e.target.value.replace(/,/g, '');
                            if (clean === '' || !isNaN(Number(clean))) {
                              setBidInputs({
                                ...bidInputs,
                                [item.id]: { ...(bidInputs[item.id] || {}), priceWith: clean === '' ? 0 : Number(clean) }
                              });
                            }
                          }}
                          className="w-full bg-slate-900/60 border border-white/10 focus:border-blue-500/70 rounded-xl pl-8 pr-4 py-2.5 text-xs text-slate-200 focus:outline-none transition-all placeholder:text-slate-600 focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>
                    ) : (
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-semibold">₹</span>
                        <input
                          type="text"
                          placeholder="Enter price without material (labor only)"
                          value={bidInputs[item.id]?.priceWithout ? Number(bidInputs[item.id].priceWithout).toLocaleString('en-IN') : ''}
                          onChange={(e) => {
                            const clean = e.target.value.replace(/,/g, '');
                            if (clean === '' || !isNaN(Number(clean))) {
                              setBidInputs({
                                ...bidInputs,
                                [item.id]: { ...(bidInputs[item.id] || {}), priceWithout: clean === '' ? 0 : Number(clean) }
                              });
                            }
                          }}
                          className="w-full bg-slate-900/60 border border-white/10 focus:border-blue-500/70 rounded-xl pl-8 pr-4 py-2.5 text-xs text-slate-200 focus:outline-none transition-all placeholder:text-slate-600 focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>
                    )}
                  </div>
                  {new Date(selectedRfqForBidding.bidEndAt) < new Date() ? (
                    <div className="w-full py-2.5 bg-slate-800/50 text-slate-500 border border-white/5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center cursor-not-allowed">
                      Bidding Closed
                    </div>
                  ) : item.bids && item.bids.length > 0 ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSubmitBid(item.id)}
                        className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-extrabold uppercase tracking-wider py-2.5 rounded-xl transition-all duration-300 transform active:scale-95 shadow-lg shadow-blue-500/10 hover:shadow-blue-500/25 flex items-center justify-center gap-2"
                      >
                        Update Bid Quote
                      </button>
                      <button
                        onClick={() => handleWithdrawBid(item.id)}
                        className="px-4 bg-red-600/10 border border-red-500/20 text-red-400 hover:bg-red-600 hover:text-white text-xs font-extrabold uppercase tracking-wider py-2.5 rounded-xl transition-all duration-300 transform active:scale-95 flex items-center justify-center"
                      >
                        Withdraw
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleSubmitBid(item.id)}
                      className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-extrabold uppercase tracking-wider py-2.5 rounded-xl transition-all duration-300 transform active:scale-95 shadow-lg shadow-blue-500/10 hover:shadow-blue-500/25 flex items-center justify-center gap-2"
                    >
                      Submit Bid Quote
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {marketplaceRfqs.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-500 text-sm">No marketplace requirements open at the moment.</div>
          ) : (
            marketplaceRfqs.map((rfq: any) => (
              <div key={rfq.id} className="glass-card rounded-2xl p-5 border border-white/5 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">{rfq.category}</span>
                    <span className="text-[10px] text-slate-500 font-semibold">{rfq.rfqNumber}</span>
                  </div>
                  <h3 className="font-bold text-base text-white mt-2.5">{rfq.title}</h3>
                  <p className="text-xs text-slate-400 mt-1.5 line-clamp-2">{rfq.description}</p>
                  <div className="mt-4 pt-3 border-t border-white/5 space-y-1.5 text-[11px] text-slate-400">
                    <div className="flex justify-between"><span>Components:</span> <span className="font-semibold text-slate-200">{rfq.items.length} parts</span></div>
                    <div className="flex justify-between"><span>Total Bids:</span> <span className="font-semibold text-blue-400">{rfq._count?.bids || 0} bids</span></div>
                    <div className="flex justify-between">
                      <span>Time Remaining:</span>
                      <span className={`font-semibold ${new Date(rfq.bidEndAt) < new Date() ? 'text-red-400' : 'text-green-400'}`}>
                        {new Date(rfq.bidEndAt) < new Date() ? 'Closed' : (() => {
                          const diff = new Date(rfq.bidEndAt).getTime() - Date.now();
                          const days = Math.floor(diff / (24 * 60 * 60 * 1000));
                          if (days > 0) return `${days} days left`;
                          const hours = Math.floor(diff / (60 * 60 * 1000));
                          return `${hours} hours left`;
                        })()}
                      </span>
                    </div>
                  </div>
                </div>
                {new Date(rfq.bidEndAt) < new Date() ? (
                  <div className="w-full py-2.5 bg-slate-800 text-slate-500 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-not-allowed">
                    <span>Bidding Closed</span>
                  </div>
                ) : (
                  <button
                    onClick={() => handleStartBidding(rfq)}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                  >
                    <span>Bid on Components</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
