const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../frontend/src/app/dashboard/components/MyRequirementsTab.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// We are going to replace everything from the first return ( line to the end of the file
const renderStartRegex = /return\s*\(\s*<div className="space-y-[0-9]+">[\s\S]*/;

const newRender = `return (
    <div className="space-y-5 pb-8">
      {/* Title & Description */}
      <div className="flex justify-between items-start pt-2">
        <div className="pr-4">
          <h1 className="text-[20px] font-extrabold tracking-tight text-[#001D4A]">
            {mode === 'buyer' ? 'My Requirements (Buying)' : 'My Submitted Bids (Selling)'}
          </h1>
          <p className="text-[12px] text-gray-500 mt-1 leading-relaxed">
            {mode === 'buyer' 
              ? 'Create, monitor, and select winners for your component requirements' 
              : 'Monitor quotes and component bids you have submitted to other companies'}
          </p>
        </div>
        <div className={\`shrink-0 rounded-full p-2 \${mode === 'buyer' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}\`}>
           <RefreshCw className="w-5 h-5 cursor-pointer" onClick={handleRefresh} />
        </div>
      </div>

      {/* Status Filter Sub-Tabs */}
      <div className="flex p-1 rounded-full border border-gray-100 bg-gray-50 max-w-full">
        <button
          onClick={() => { setStatusFilter('open'); setSelectedRfqForDetails(null); }}
          className={\`flex-1 py-2.5 text-[12px] font-bold rounded-full transition-all \${statusFilter === 'open' ? (mode === 'buyer' ? 'bg-blue-600 text-white shadow-sm' : 'bg-[#10b981] text-white shadow-sm') : 'text-gray-500 hover:text-gray-700'}\`}
        >
          Open
        </button>
        <button
          onClick={() => { setStatusFilter('in_progress'); setSelectedRfqForDetails(null); }}
          className={\`flex-1 py-2.5 text-[12px] font-bold rounded-full transition-all \${statusFilter === 'in_progress' ? (mode === 'buyer' ? 'bg-blue-600 text-white shadow-sm' : 'bg-[#10b981] text-white shadow-sm') : 'text-gray-500 hover:text-gray-700'}\`}
        >
          In Progress
        </button>
        <button
          onClick={() => { setStatusFilter('closed'); setSelectedRfqForDetails(null); }}
          className={\`flex-1 py-2.5 text-[12px] font-bold rounded-full transition-all \${statusFilter === 'closed' ? (mode === 'buyer' ? 'bg-blue-600 text-white shadow-sm' : 'bg-[#10b981] text-white shadow-sm') : 'text-gray-500 hover:text-gray-700'}\`}
        >
          Closed
        </button>
      </div>

      {/* Action Buttons */}
      {subTab === 'buying' && statusFilter === 'open' && !selectedRfqForDetails && (
        <div className="flex pt-1">
          <button
            onClick={() => setShowRfqModal(true)}
            className="py-3 px-6 bg-gradient-to-r from-[#4f46e5] to-[#8b5cf6] hover:opacity-90 text-white rounded-full text-[13px] font-bold transition-all flex items-center justify-center gap-2 shadow-md active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Publish New RFQ</span>
          </button>
        </div>
      )}

      {/* Buying Sub-Tab (Existing view wrapper) */}
      {subTab === 'buying' && (
        <>
          {selectedRfqForDetails ? (
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] space-y-6">
              <div className="flex justify-between items-center border-b border-gray-100 pb-4">
                <div>
                  <h2 className="text-lg font-extrabold text-[#001D4A]">{selectedRfqForDetails.title}</h2>
                  <span className="text-[11px] text-gray-500 font-bold">{selectedRfqForDetails.rfqNumber}</span>
                </div>
                <button onClick={() => setSelectedRfqForDetails(null)} className="px-3.5 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl text-xs font-bold transition-all border border-gray-200">Back</button>
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
                  <div key={item.id} className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-sm text-[#001D4A]">{item.componentName}</h4>
                        <span className="text-[11px] text-gray-500 font-medium">Qty: {Number(item.quantity)} {item.unit} | HSN: {item.hsnCode} | Sourcing: {item.materialOptionPreference === 'WITH_MATERIAL' ? 'With Material' : 'Without Material'}</span>
                      </div>
                    </div>

                    {/* Bids received list */}
                    <div className="space-y-2">
                      <h5 className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Received Quotes</h5>
                      {item.bids && item.bids.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="text-gray-500 border-b border-gray-200">
                                <th className="pb-2 font-bold">Supplier</th>
                                {item.materialOptionPreference === 'WITH_MATERIAL' ? (
                                  <th className="pb-2 font-bold">Price (With Material)</th>
                                ) : (
                                  <th className="pb-2 font-bold">Price (Without Material)</th>
                                )}
                                <th className="pb-2 font-bold">Delivery</th>
                                <th className="pb-2 font-bold text-right">Action</th>
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
                                const feeLabel = \`incl. platform fee ₹\${formatInrFromPaise(pricing.commissionPaise)} + GST ₹\${formatInrFromPaise(pricing.feeGstPaise)}\`;

                                return (
                                  <tr key={bid.id} className="border-b border-gray-100 text-[#001D4A]">
                                    <td className="py-3 font-bold">{bid.supplierCompany.name}</td>
                                    {item.materialOptionPreference === 'WITH_MATERIAL' ? (
                                      <td className="py-3 font-extrabold text-blue-600">
                                        Total: ₹{buyerTotal.toLocaleString('en-IN')}
                                        <span className="text-[10px] font-medium text-gray-500 block">
                                          ₹{unitTotal.toLocaleString('en-IN')} / unit
                                        </span>
                                      </td>
                                    ) : (
                                      <td className="py-3 font-extrabold text-blue-600">
                                        Total: ₹{buyerTotal.toLocaleString('en-IN')}
                                        <span className="text-[10px] font-medium text-gray-500 block">
                                          ₹{unitTotal.toLocaleString('en-IN')} / unit
                                        </span>
                                      </td>
                                    )}
                                    <td className="py-3 font-medium">{bid.estimatedTimeDays} days</td>
                                    <td className="py-3 text-right font-bold text-xs">
                                      {bid.status === 'ACCEPTED' ? (
                                        <span className="text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-lg">Accepted</span>
                                      ) : bid.status === 'REJECTED' ? (
                                        <span className="text-red-600 bg-red-50 px-2.5 py-1.5 rounded-lg">Rejected</span>
                                      ) : (
                                        <button
                                          onClick={() => setAwardModal({ rfqItemId: item.id, bidId: bid.id, maxQty: Number(item.quantity), currentQty: Number(item.quantity) })}
                                          disabled={selectedRfqForDetails.status === 'SAMPLING'}
                                          className="px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white rounded-lg text-[11px] font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed border border-emerald-200 hover:border-emerald-600"
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
                        <div className="text-xs text-gray-500 font-medium">No quotes received yet.</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRfqs.length === 0 ? (
                <div className="py-12 text-center text-gray-500 font-medium text-sm">No requirements found matching this status.</div>
              ) : (
                filteredRfqs.map((rfq: any) => (
                  <div key={rfq.id} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.04)] flex flex-col space-y-3">
                    <div className="flex justify-between items-center">
                      <span className={\`text-[10px] px-2.5 py-1 rounded-md font-bold uppercase tracking-wider \${rfq.status === 'PUBLISHED' || rfq.status === 'BIDDING_OPEN' ? 'text-emerald-700 bg-emerald-50' : 'text-blue-700 bg-blue-50'}\`}>{rfq.status}</span>
                      <span className="text-[11px] text-gray-400 font-bold">{rfq.rfqNumber}</span>
                    </div>
                    
                    <h3 className="font-extrabold text-[17px] text-[#001D4A] pt-1">{rfq.title}</h3>
                    
                    <div className="flex items-center">
                      <div className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Urgent requirement
                      </div>
                    </div>
                    
                    <div className="pt-3 space-y-1 text-[12px] text-gray-500 font-medium">
                      {rfq.pr && (
                        <div className="flex gap-2"><span>Linked RFQ:</span> <span className="font-bold text-[#001D4A]">{rfq.pr.prNumber}</span></div>
                      )}
                      <div className="flex gap-2"><span>Components:</span> <span className="font-bold text-[#001D4A]">{rfq.items.length} parts</span></div>
                      <div className="flex gap-2"><span>Ends:</span> <span className="font-bold text-[#001D4A]">{new Date(rfq.bidEndAt).toLocaleDateString()}</span></div>
                    </div>
                    
                    {statusFilter === 'open' && (
                      <div className="flex gap-2 pt-3">
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
                          className="flex-1 py-3 bg-blue-50 text-blue-700 disabled:opacity-60 disabled:cursor-not-allowed rounded-xl text-[12px] font-bold flex items-center justify-between px-4 transition-all"
                        >
                          {detailsLoadingId === rfq.id ? (
                            <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                          ) : (
                            <>
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                <span>Compare Bids & Select Winner</span>
                              </div>
                              <ChevronRight className="w-4 h-4" />
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleEditRfq(rfq)}
                          className="py-3 px-4 bg-gray-50 text-[#001D4A] border border-gray-200 hover:bg-gray-100 rounded-xl text-[12px] font-bold flex items-center gap-2 transition-all"
                        >
                          <svg className="w-4 h-4 text-[#001D4A]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          <span>Edit</span>
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
        <div className="space-y-4">
          <SupplierSamplingPanel showToast={showToast} isVisible={subTab === 'selling'} />
          
          {loadingBids ? (
            <div className="py-12 text-center text-gray-500 text-sm font-bold flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-[#10b981]" />
              <span>Loading submitted quotes...</span>
            </div>
          ) : filteredBids.length === 0 ? (
            <div className="py-12 text-center text-gray-500 font-medium text-sm">No bids found matching this status.</div>
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
              let statusStyle = 'text-blue-700 bg-blue-50';

              if (bid.status === 'ACCEPTED') {
                if (bid.rfq?.status === 'COMPLETED') {
                  displayStatus = 'COMPLETED';
                  statusStyle = 'text-emerald-700 bg-emerald-50';
                } else {
                  statusStyle = 'text-emerald-700 bg-emerald-50';
                }
              } else if (bid.status === 'REJECTED') {
                statusStyle = 'text-red-700 bg-red-50';
              } else if (bid.rfq?.status === 'CANCELLED' || bid.rfq?.status === 'EXPIRED' || bid.rfq?.status === 'COMPLETED') {
                displayStatus = bid.rfq.status;
                statusStyle = 'text-gray-500 bg-gray-100';
              } else if (bid.status === 'WITHDRAWN') {
                statusStyle = 'text-gray-500 bg-gray-100';
              }

              return (
                <div key={bid.id} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.04)] flex flex-col space-y-3">
                    <div className="flex justify-between items-center">
                      <span className={\`text-[10px] px-2.5 py-1 rounded-md font-bold uppercase tracking-wider \${statusStyle}\`}>{displayStatus}</span>
                      <span className="text-[11px] text-gray-400 font-bold">{bid.rfq?.rfqNumber}</span>
                    </div>
                    
                    <h3 className="font-extrabold text-[17px] text-[#001D4A] pt-1">{bid.rfq?.title}</h3>
                    
                    <div className="flex items-center">
                      <div className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Urgent requirement
                      </div>
                    </div>
                    
                    <div className="pt-2 text-[10px] uppercase tracking-wider font-extrabold text-blue-600/60">
                      Component Bid On:
                      <div className="text-[#001D4A] capitalize text-[13px] font-bold mt-0.5">{bid.rfqItem?.componentName || 'Spacer ring'}</div>
                    </div>

                    <div className="flex gap-4 pt-3 border-t border-gray-100 mt-2">
                       <div className="flex-1">
                          <p className="text-[11px] text-gray-500 font-medium">Your Quote:</p>
                          <p className="text-[16px] font-extrabold text-[#001D4A] pt-1">₹ {totalQuote.toLocaleString('en-IN')}</p>
                          <p className="text-[10px] text-gray-400 font-medium">(₹ {unitPrice.toLocaleString('en-IN')} / unit)</p>
                       </div>
                       <div className="w-[1px] bg-gray-200"></div>
                       <div className="flex-1">
                          <p className="text-[11px] text-gray-500 font-medium">Buyer Pays:</p>
                          <p className="text-[16px] font-extrabold text-[#001D4A] pt-1">₹ {buyerTotal.toLocaleString('en-IN')}</p>
                          <p className="text-[9px] text-gray-400 font-medium leading-tight">(Incl. platform fee ₹{formatInrFromPaise(pricing.commissionPaise)} + GST ₹{formatInrFromPaise(pricing.feeGstPaise)})</p>
                       </div>
                    </div>

                    <div className="flex gap-2 pt-3 mt-1 items-center text-[12px]">
                      <svg className="w-4 h-4 text-[#001D4A]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                      <span className="text-gray-500 font-medium">Quoted Delivery:</span> <span className="font-extrabold text-[#001D4A]">{bid.estimatedTimeDays} days</span>
                    </div>

                    <div className="pt-3">
                        <button
                          className="w-full py-3 bg-emerald-50 text-emerald-700 rounded-xl text-[12px] font-bold flex items-center justify-between px-4 transition-all border border-emerald-100"
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            <span>View Bid Details</span>
                          </div>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Award Bid Modal */}
      {awardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setAwardModal(null)}>
          <div className="relative max-w-sm w-full bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-2xl p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-extrabold text-[#001D4A] mb-4">Award Bid</h3>
            <p className="text-xs text-gray-500 mb-4">You can award the full quantity or split it.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-extrabold uppercase text-gray-400 mb-1">Quantity to Award</label>
                <input
                  type="number"
                  min={1}
                  max={awardModal.maxQty}
                  value={awardModal.currentQty}
                  onChange={(e) => setAwardModal({ ...awardModal, currentQty: Number(e.target.value) })}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-[#001D4A] font-bold focus:outline-none focus:border-emerald-500"
                />
                <span className="text-[10px] text-gray-500 font-medium block mt-1">Max available to award: {awardModal.maxQty}</span>
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
                className="w-full py-3 bg-[#10b981] hover:bg-[#059669] disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all active:scale-95 shadow-md flex items-center justify-center gap-2"
              >
                {awardLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {awardLoading ? 'Awarding...' : 'Confirm Award'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}`;

content = content.replace(renderStartRegex, newRender);

fs.writeFileSync(filePath, content);
console.log('Successfully updated MyRequirementsTab UI to the new dual light mode.');
