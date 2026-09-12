const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../frontend/src/app/dashboard/components/MarketplaceTab.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Replace everything from the return statement to the end
const renderStartRegex = /return\s*\(\s*<div className="space-y-[0-9]+">[\s\S]*/;

const newRender = `return (
    <div className="space-y-4">
      <div className="relative pt-4 pb-12 mb-4">
        <div className="absolute right-0 top-0 opacity-20 pointer-events-none">
          {mode === 'buyer' ? (
            <svg width="200" height="100" viewBox="0 0 200 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="130" y="20" width="50" height="70" rx="4" fill="#3B82F6"/>
              <rect x="140" y="10" width="30" height="20" rx="2" fill="#93C5FD"/>
              <line x1="140" y1="50" x2="170" y2="50" stroke="#EFF6FF" strokeWidth="4" strokeLinecap="round"/>
              <line x1="140" y1="65" x2="160" y2="65" stroke="#EFF6FF" strokeWidth="4" strokeLinecap="round"/>
              <circle cx="165" cy="75" r="15" fill="#1D4ED8" fillOpacity="0.5"/>
            </svg>
          ) : (
            <svg width="200" height="100" viewBox="0 0 200 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M120 100V40L160 20L200 40V100H120Z" fill="#10B981"/>
              <path d="M140 60H180V100H140V60Z" fill="#34D399"/>
              <path d="M80 80V50L100 40L120 50V80H80Z" fill="#A7F3D0"/>
            </svg>
          )}
        </div>
        <div className="relative z-10 flex justify-between items-start">
          <div className="pr-12">
            <h1 className="text-[22px] font-extrabold tracking-tight text-[#001D4A]">
              {mode === 'buyer' ? 'My RFQs & Procurement' : 'Public B2B Marketplace'}
            </h1>
            <p className="text-[13px] text-gray-500 mt-1 leading-relaxed max-w-[280px]">
              {mode === 'buyer' ? 'Track bids received and award winner contracts' : 'Quote on open procurement requirements from other companies'}
            </p>
          </div>
          <div className={\`rounded-full p-2 \${mode === 'buyer' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}\`}>
             <RefreshCw className="w-4 h-4 cursor-pointer" onClick={fetchData} />
          </div>
        </div>
      </div>

      {selectedRfqForBidding ? (
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] space-y-6">
          <div className="flex justify-between items-center border-b border-gray-100 pb-4">
            <h2 className="text-lg font-bold text-[#001D4A]">Submit Bids for {selectedRfqForBidding.title}</h2>
             <button
              onClick={() => setSelectedRfqForBidding(null)}
              className="px-3.5 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 border border-gray-200"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          </div>
          {new Date(selectedRfqForBidding.bidEndAt) < new Date() && (
            <div className="p-4 bg-red-50 text-red-600 rounded-xl text-xs font-bold text-center border border-red-100">
              Bidding has closed for this requirement. You can no longer submit or update quotes.
            </div>
          )}
          <div className="space-y-6">
            {selectedRfqForBidding.items.map((item: any) => (
              <div key={item.id} className="p-4 bg-[#F8FAFC] rounded-xl border border-gray-200 grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-bold text-sm text-blue-600">{item.componentName}</h4>
                  <p className="text-xs text-gray-500 mt-1 font-medium">Quantity Requested: {Number(item.quantity)} {item.unit}</p>
                  <p className="text-xs text-gray-500 mt-0.5 font-medium">Target Lead Time: <span className="font-bold text-[#001D4A]">{item.expectedTimeDays || 'N/A'} days</span></p>
                  <p className="text-[10px] text-gray-500 mt-1 font-bold uppercase">
                    Sourcing option: {item.materialOptionPreference === 'WITH_MATERIAL' ? 'With Material' : 'Without Material'}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-1 font-medium">Drawing: <button onClick={() => handleViewDrawing(item.drawingFileId)} className="underline text-blue-600 font-bold">{item.drawingFileId}</button></p>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Your Price Quote</label>
                    {item.materialOptionPreference === 'WITH_MATERIAL' ? (
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">₹</span>
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
                          className="w-full bg-white border border-gray-200 focus:border-blue-500 rounded-xl pl-8 pr-4 py-2.5 text-xs text-[#001D4A] font-bold focus:outline-none transition-all placeholder:text-gray-400 placeholder:font-medium focus:ring-2 focus:ring-blue-500/20 shadow-sm"
                        />
                      </div>
                    ) : (
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">₹</span>
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
                          className="w-full bg-white border border-gray-200 focus:border-blue-500 rounded-xl pl-8 pr-4 py-2.5 text-xs text-[#001D4A] font-bold focus:outline-none transition-all placeholder:text-gray-400 placeholder:font-medium focus:ring-2 focus:ring-blue-500/20 shadow-sm"
                        />
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Estimated Lead Time (Days)</label>
                    <input
                      type="number"
                      placeholder="e.g. 14"
                      value={bidInputs[item.id]?.leadTime || ''}
                      onChange={(e) => {
                        setBidInputs({
                          ...bidInputs,
                          [item.id]: { ...(bidInputs[item.id] || {}), leadTime: Number(e.target.value) }
                        });
                      }}
                      className="w-full bg-white border border-gray-200 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs text-[#001D4A] font-bold focus:outline-none transition-all placeholder:text-gray-400 placeholder:font-medium focus:ring-2 focus:ring-blue-500/20 shadow-sm"
                    />
                  </div>
                  {item.bids && item.bids.length > 0 ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSubmitBid(item.id)}
                        disabled={submittingActions[\`submitBid_\${item.id}\`]}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-extrabold uppercase tracking-wider py-2.5 rounded-xl transition-all duration-300 transform active:scale-95 shadow-md flex items-center justify-center gap-2"
                      >
                        {submittingActions[\`submitBid_\${item.id}\`] ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Update Quote'}
                      </button>
                      <button
                        onClick={() => handleWithdrawBid(item.id)}
                        disabled={submittingActions[\`withdrawBid_\${item.id}\`]}
                        className="px-4 py-2.5 bg-red-50 border border-red-200 hover:bg-red-100 text-red-600 text-[11px] font-extrabold uppercase tracking-wider rounded-xl transition-all duration-300 transform active:scale-95 flex items-center justify-center min-w-[90px]"
                      >
                        {submittingActions[\`withdrawBid_\${item.id}\`] ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Withdraw'}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleSubmitBid(item.id)}
                      disabled={submittingActions[\`submitBid_\${item.id}\`]}
                      className="w-full bg-[#389D7F] text-white text-[12px] font-extrabold tracking-wider py-3 rounded-full transition-all duration-300 transform active:scale-95 shadow-md flex items-center justify-center gap-2"
                    >
                      {submittingActions[\`submitBid_\${item.id}\`] ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Submit Bid Quote'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRfqs.length === 0 ? (
            <div className="col-span-full py-12 text-center text-gray-500 font-medium text-sm">
              {mode === 'buyer' ? 'You have not published any requirements yet.' : 'No marketplace requirements open at the moment.'}
            </div>
          ) : (
            filteredRfqs.map((rfq: any) => (
              <div key={rfq.id} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex justify-between items-start">
                    <span className={\`text-[10px] \${mode === 'buyer' ? 'text-blue-700 bg-blue-100' : 'text-emerald-700 bg-emerald-100'} px-2.5 py-1 rounded-full font-bold uppercase tracking-wider\`}>{rfq.category}</span>
                    <span className="text-[10px] text-gray-400 font-semibold">{rfq.rfqNumber}</span>
                  </div>
                  <h3 className="font-extrabold text-[17px] text-[#001D4A] mt-3">{rfq.title}</h3>
                  <p className="text-[13px] text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">{rfq.description}</p>
                  
                  <div className="mt-4 pt-4 border-t border-gray-100 space-y-2.5 text-[12px] text-gray-500">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2"><svg className="w-4 h-4 text-[#001D4A]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg><span>Components:</span></div> 
                      <span className="font-bold text-[#001D4A]">{rfq.items.length} parts</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2"><svg className="w-4 h-4 text-[#001D4A]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" /></svg><span>Total Bids:</span></div> 
                      <span className="font-bold text-blue-600">{rfq._count?.bids || 0} bids</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2"><svg className="w-4 h-4 text-[#001D4A]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><span>Time Remaining:</span></div>
                      <span className={\`font-bold \${new Date(rfq.bidEndAt) < new Date() ? 'text-red-500' : 'text-emerald-600'}\`}>
                        {new Date(rfq.bidEndAt) < new Date() ? 'Closed' : (() => {
                          const diff = new Date(rfq.bidEndAt).getTime() - Date.now();
                          const days = Math.floor(diff / (24 * 60 * 60 * 1000));
                          if (days > 0) return \`\${days} days left\`;
                          const hours = Math.floor(diff / (60 * 60 * 1000));
                          return \`\${hours} hours left\`;
                        })()}
                      </span>
                    </div>
                  </div>
                </div>
                {mode === 'buyer' ? (
                  <button
                    onClick={() => handleManageRfq(rfq)}
                    className="w-full py-3 bg-blue-50 text-blue-700 rounded-full text-[13px] font-bold flex items-center justify-between px-6 transition-all active:scale-95 mt-2"
                  >
                    <div className="flex items-center gap-2">
                       <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                       <span>Manage RFQ & Bids</span>
                    </div>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                  </button>
                ) : new Date(rfq.bidEndAt) < new Date() ? (
                  <div className="w-full py-3 bg-gray-100 text-gray-500 rounded-full text-[13px] font-bold flex items-center justify-center gap-1.5 cursor-not-allowed mt-2">
                    <span>Bidding Closed</span>
                  </div>
                ) : (
                  <button
                    onClick={() => handleStartBidding(rfq)}
                    className="w-full py-3 bg-[#389D7F] text-white rounded-full text-[13px] font-bold flex items-center justify-center gap-2 transition-all active:scale-95 mt-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" /></svg>
                    <span>Bid on Components</span>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Document Viewer Modal */}
      {viewFileId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden relative">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-sm font-bold text-[#001D4A] flex items-center gap-2">
                Drawing Document
              </h3>
              <button 
                onClick={() => setViewFileId(null)}
                className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 bg-gray-100 p-4 overflow-hidden">
              <iframe 
                src={\`/uploads/\${viewFileId}\`} 
                className="w-full h-full rounded-xl border border-gray-200 bg-white shadow-sm"
                title="Drawing Viewer"
              />
            </div>
          </div>
        </div>
      )}

      {/* NDA Modal */}
      {showNdaModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 relative">
            <h3 className="text-lg font-extrabold text-[#001D4A] mb-4">Non-Disclosure Agreement</h3>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 h-48 overflow-y-auto text-xs text-gray-600 mb-6 space-y-3">
              <p>By viewing these drawings, you agree to the following terms and conditions:</p>
              <p>1. <strong>Confidentiality:</strong> You agree to keep all drawings, specifications, and related technical information completely confidential.</p>
              <p>2. <strong>Non-Use:</strong> The provided information shall only be used for the purpose of submitting a bid quote for this specific requirement. You shall not use the information for manufacturing, reverse engineering, or any other commercial purpose without explicit authorization.</p>
              <p>3. <strong>Non-Disclosure:</strong> You shall not disclose, distribute, or share these drawings with any third party, competitor, or unauthorized personnel within your organization.</p>
              <p>4. <strong>Data Deletion:</strong> Upon completion of the bidding process, or upon request, you agree to securely delete and destroy any copies of these drawings.</p>
              <p className="text-red-500 font-bold mt-2">Violation of this agreement may result in immediate suspension from the platform and potential legal action.</p>
            </div>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowNdaModal(null)}
                className="px-5 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                disabled={acceptingNda}
              >
                Cancel
              </button>
              <button 
                onClick={handleAcceptNda}
                disabled={acceptingNda}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-full transition-all flex items-center gap-2 active:scale-95"
              >
                {acceptingNda && <RefreshCw className="w-4 h-4 animate-spin" />}
                Accept & View Drawing
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
console.log('Successfully updated MarketplaceTab to support dynamic Buyer (Blue) / Seller (Green) modes.');
