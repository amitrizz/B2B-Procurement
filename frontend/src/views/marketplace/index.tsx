import { RefreshCw, ArrowLeft, ChevronRight, Search, X, Loader2 } from 'lucide-react';
import styles from './marketplace.module.scss';
import { useState } from 'react';
import { RefreshButton } from '@/components/ui/RefreshButton';

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
  mode: 'buyer' | 'seller';
  user: any;
  setActiveTab: (tab: string) => void;
  setSelectedRfqForDetails: (rfq: any) => void;
  submittingActions?: Record<string, boolean>;
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
  fetchData,
  mode,
  user,
  setActiveTab,
  setSelectedRfqForDetails,
  submittingActions = {}
}: MarketplaceTabProps) {
  const [viewFileId, setViewFileId] = useState<string | null>(null);
  const [showNdaModal, setShowNdaModal] = useState<{fileId: string} | null>(null);
  const [acceptingNda, setAcceptingNda] = useState(false);

  const handleViewDrawing = async (fileId: string) => {
    try {
      const res = await fetch(`/api/v1/upload/${fileId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.status === 403) {
        const text = await res.text();
        try {
          const data = JSON.parse(text);
          if (data.code === 'NDA_REQUIRED') {
            setShowNdaModal({ fileId });
            return;
          }
        } catch(e) {
          // not json
        }
      }
      setViewFileId(fileId);
    } catch (err) {
      setViewFileId(fileId); // fallback
    }
  };

  const handleAcceptNda = async () => {
    if (!showNdaModal) return;
    setAcceptingNda(true);
    try {
      const res = await fetch('/api/v1/company/me/accept-drawings-nda', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        setViewFileId(showNdaModal.fileId);
        setShowNdaModal(null);
      } else {
        alert('Failed to accept NDA');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to accept NDA');
    } finally {
      setAcceptingNda(false);
    }
  };

  const filteredRfqs = marketplaceRfqs.filter((rfq: any) => {
    if (mode === 'buyer') {
      return rfq.buyerCompanyId === user?.companyId;
    } else {
      return rfq.buyerCompanyId !== user?.companyId;
    }
  });

  const handleManageRfq = async (rfq: any) => {
    try {
      const headers = { 'Authorization': `Bearer ${localStorage.getItem('token')}` };
      const res = await fetch(`/api/v1/rfqs/${rfq.id}`, { headers });
      const d = await res.json();
      if (d.success) {
        setSelectedRfqForDetails(d.data);
        setActiveTab('my_rfqs');
      }
    } catch (err) {
      console.error('Failed to load RFQ details', err);
    }
  };

  return (
    <div className={styles['marketplace--space-y-4']}>
      <div className={styles['marketplace--relative-pt-4-pb-12']}>
        <div className={styles['marketplace--absolute-right-0-top-0']}>
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
        <div className={styles['marketplace--relative-z-10-flex']}>
          <div className={styles['marketplace--pr-12']}>
            <h1 className={styles['marketplace--text-22px-font-extrabold-tracking-tight']}>
              {mode === 'buyer' ? 'My RFQs & Procurement' : 'Public B2B Marketplace'}
            </h1>
            <p className={styles['marketplace--text-13px-text-gray-500-mt-1']}>
              {mode === 'buyer' ? 'Track bids received and award winner contracts' : 'Quote on open procurement requirements from other companies'}
            </p>
          </div>
          <div className={`rounded-full p-2 ${mode === 'buyer' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
             <RefreshCw className={styles['marketplace--w-4-h-4-cursor-pointer']} onClick={fetchData} />
          </div>
        </div>
      </div>

      {selectedRfqForBidding ? (
        <div className={styles['marketplace--bg-white-rounded-2xl-p-6']}>
          <div className={styles['marketplace--flex-justify-between-items-center']}>
            <h2 className={styles['marketplace--text-lg-font-bold-text-001D4A']}>Submit Bids for {selectedRfqForBidding.title}</h2>
             <button
              onClick={() => setSelectedRfqForBidding(null)}
              className={styles['marketplace--px-35-py-15-bg-gray-50']}
            >
              <ArrowLeft className={styles['marketplace--w-35-h-35']} />
              <span>Back</span>
            </button>
          </div>
          {new Date(selectedRfqForBidding.bidEndAt) < new Date() && (
            <div className={styles['marketplace--p-4-bg-red-50-text-red-600']}>
              Bidding has closed for this requirement. You can no longer submit or update quotes.
            </div>
          )}
          <div className={styles['marketplace--space-y-6']}>
            {selectedRfqForBidding.items.map((item: any) => (
              <div key={item.id} className={styles['marketplace--p-4-bg-F8FAFC-rounded-xl']}>
                <div>
                  <h4 className={styles['marketplace--font-bold-text-sm-text-blue-600']}>{item.componentName}</h4>
                  <p className={styles['marketplace--text-xs-text-gray-500-mt-1']}>Quantity Requested: {Number(item.quantity)} {item.unit}</p>
                  <p className={styles['marketplace--text-xs-text-gray-500-mt-05']}>Target Lead Time: <span className={styles['marketplace--font-bold-text-001D4A']}>{item.expectedTimeDays || 'N/A'} days</span></p>
                  <p className={styles['marketplace--text-10px-text-gray-500-mt-1']}>
                    Sourcing option: {item.materialOptionPreference === 'WITH_MATERIAL' ? 'With Material' : 'Without Material'}
                  </p>
                  <p className={styles['marketplace--text-10px-text-gray-500-mt-1-1']}>Drawing: <button onClick={() => handleViewDrawing(item.drawingFileId)} className={styles['marketplace--underline-text-blue-600-font-bold']}>{item.drawingFileId}</button></p>
                </div>
                <div className={styles['marketplace--space-y-4-1']}>
                  <div className={styles['marketplace--space-y-1']}>
                    <label className={styles['marketplace--text-10px-text-gray-500-font-bold']}>Your Price Quote</label>
                    {item.materialOptionPreference === 'WITH_MATERIAL' ? (
                      <div className={styles['marketplace--relative']}>
                        <span className={styles['marketplace--absolute-left-35-top-12']}>₹</span>
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
                          className={styles['marketplace--w-full-bg-white-border']}
                        />
                      </div>
                    ) : (
                      <div className={styles['marketplace--relative-1']}>
                        <span className={styles['marketplace--absolute-left-35-top-12-1']}>₹</span>
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
                          className={styles['marketplace--w-full-bg-white-border-1']}
                        />
                      </div>
                    )}
                  </div>
                  <div className={styles['marketplace--space-y-1-1']}>
                    <label className={styles['marketplace--text-10px-text-gray-500-font-bold-1']}>Estimated Lead Time (Days)</label>
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
                      className={styles['marketplace--w-full-bg-white-border-2']}
                    />
                  </div>
                  {item.bids && item.bids.length > 0 ? (
                    <div className={styles['marketplace--flex-gap-2']}>
                      <button
                        onClick={() => handleSubmitBid(item.id)}
                        disabled={submittingActions[`submitBid_${item.id}`]}
                        className={styles['marketplace--flex-1-bg-blue-600-hoverbg-blue-700']}
                      >
                        {submittingActions[`submitBid_${item.id}`] ? <RefreshCw className={styles['marketplace--w-4-h-4-animate-spin']} /> : 'Update Quote'}
                      </button>
                      <button
                        onClick={() => handleWithdrawBid(item.id)}
                        disabled={submittingActions[`withdrawBid_${item.id}`]}
                        className={styles['marketplace--px-4-py-25-bg-red-50']}
                      >
                        {submittingActions[`withdrawBid_${item.id}`] ? <RefreshCw className={styles['marketplace--w-4-h-4-animate-spin-1']} /> : 'Withdraw'}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleSubmitBid(item.id)}
                      disabled={submittingActions[`submitBid_${item.id}`]}
                      className={styles['marketplace--w-full-bg-389D7F-text-white']}
                    >
                      {submittingActions[`submitBid_${item.id}`] ? <RefreshCw className={styles['marketplace--w-4-h-4-animate-spin-2']} /> : 'Submit Bid Quote'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className={styles['marketplace--grid-mdgrid-cols-2-lggrid-cols-3']}>
          {filteredRfqs.length === 0 ? (
            <div className={styles['marketplace--col-span-full-py-12-text-center']}>
              {mode === 'buyer' ? 'You have not published any requirements yet.' : 'No marketplace requirements open at the moment.'}
            </div>
          ) : (
            filteredRfqs.map((rfq: any) => (
              <div key={rfq.id} className={styles['marketplace--bg-white-rounded-2xl-p-5']}>
                <div>
                  <div className={styles['marketplace--flex-justify-between-items-start']}>
                    <span className={`text-[10px] ${mode === 'buyer' ? 'text-blue-700 bg-blue-100' : 'text-emerald-700 bg-emerald-100'} px-2.5 py-1 rounded-full font-bold uppercase tracking-wider`}>{rfq.category}</span>
                    <span className={styles['marketplace--text-10px-text-gray-400-font-semibold']}>{rfq.rfqNumber}</span>
                  </div>
                  <h3 className={styles['marketplace--font-extrabold-text-17px-text-001D4A']}>{rfq.title}</h3>
                  <p className={styles['marketplace--text-13px-text-gray-500-mt-15']}>{rfq.description}</p>
                  
                  <div className={styles['marketplace--mt-4-pt-4-border-t']}>
                    <div className={styles['marketplace--flex-justify-between-items-center-1']}>
                      <div className={styles['marketplace--flex-items-center-gap-2']}><svg className={styles['marketplace--w-4-h-4-text-001D4A']} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg><span>Components:</span></div> 
                      <span className={styles['marketplace--font-bold-text-001D4A-1']}>{rfq.items.length} parts</span>
                    </div>
                    <div className={styles['marketplace--flex-justify-between-items-center-2']}>
                      <div className={styles['marketplace--flex-items-center-gap-2-1']}><svg className={styles['marketplace--w-4-h-4-text-001D4A-1']} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" /></svg><span>Total Bids:</span></div> 
                      <span className={styles['marketplace--font-bold-text-blue-600']}>{rfq._count?.bids || 0} bids</span>
                    </div>
                    <div className={styles['marketplace--flex-justify-between-items-center-3']}>
                      <div className={styles['marketplace--flex-items-center-gap-2-2']}><svg className={styles['marketplace--w-4-h-4-text-001D4A-2']} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><span>Time Remaining:</span></div>
                      <span className={`font-bold ${new Date(rfq.bidEndAt) < new Date() ? 'text-red-500' : 'text-emerald-600'}`}>
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
                {mode === 'buyer' ? (
                  <button
                    onClick={() => handleManageRfq(rfq)}
                    className={styles['marketplace--w-full-py-3-bg-blue-50']}
                  >
                    <div className={styles['marketplace--flex-items-center-gap-2-3']}>
                       <svg className={styles['marketplace--w-4-h-4']} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                       <span>Manage RFQ & Bids</span>
                    </div>
                    <svg className={styles['marketplace--w-4-h-4-1']} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                  </button>
                ) : new Date(rfq.bidEndAt) < new Date() ? (
                  <div className={styles['marketplace--w-full-py-3-bg-gray-100']}>
                    <span>Bidding Closed</span>
                  </div>
                ) : (
                  <button
                    onClick={() => handleStartBidding(rfq)}
                    className={styles['marketplace--w-full-py-3-bg-389D7F']}
                  >
                    <svg className={styles['marketplace--w-4-h-4-2']} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" /></svg>
                    <span>Bid on Components</span>
                    <svg className={styles['marketplace--w-4-h-4-3']} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Document Viewer Modal */}
      {viewFileId && (
        <div className={styles['marketplace--fixed-inset-0-z-60']}>
          <div className={styles['marketplace--bg-white-rounded-2xl-shadow-2xl']}>
            <div className={styles['marketplace--p-4-border-b-border-gray-200']}>
              <h3 className={styles['marketplace--text-sm-font-bold-text-001D4A']}>
                Drawing Document
              </h3>
              <button 
                onClick={() => setViewFileId(null)}
                className={styles['marketplace--p-15-hoverbg-gray-200-rounded-lg']}
              >
                <X className={styles['marketplace--w-5-h-5']} />
              </button>
            </div>
            <div className={styles['marketplace--flex-1-bg-gray-100-p-4']}>
              <iframe 
                src={`/uploads/${viewFileId}`} 
                className={styles['marketplace--w-full-h-full-rounded-xl']}
                title="Drawing Viewer"
              />
            </div>
          </div>
        </div>
      )}

      {/* NDA Modal */}
      {showNdaModal && (
        <div className={styles['marketplace--fixed-inset-0-z-70']}>
          <div className={styles['marketplace--bg-white-rounded-2xl-shadow-2xl-1']}>
            <h3 className={styles['marketplace--text-lg-font-extrabold-text-001D4A']}>Non-Disclosure Agreement</h3>
            <div className={styles['marketplace--bg-gray-50-border-border-gray-200']}>
              <p>By viewing these drawings, you agree to the following terms and conditions:</p>
              <p>1. <strong>Confidentiality:</strong> You agree to keep all drawings, specifications, and related technical information completely confidential.</p>
              <p>2. <strong>Non-Use:</strong> The provided information shall only be used for the purpose of submitting a bid quote for this specific requirement. You shall not use the information for manufacturing, reverse engineering, or any other commercial purpose without explicit authorization.</p>
              <p>3. <strong>Non-Disclosure:</strong> You shall not disclose, distribute, or share these drawings with any third party, competitor, or unauthorized personnel within your organization.</p>
              <p>4. <strong>Data Deletion:</strong> Upon completion of the bidding process, or upon request, you agree to securely delete and destroy any copies of these drawings.</p>
              <p className={styles['marketplace--text-red-500-font-bold-mt-2']}>Violation of this agreement may result in immediate suspension from the platform and potential legal action.</p>
            </div>
            <div className={styles['marketplace--flex-justify-end-gap-3']}>
              <button 
                onClick={() => setShowNdaModal(null)}
                className={styles['marketplace--px-5-py-25-text-sm']}
                disabled={acceptingNda}
              >
                Cancel
              </button>
              <button 
                onClick={handleAcceptNda}
                disabled={acceptingNda}
                className={styles['marketplace--px-5-py-25-bg-blue-600']}
              >
                {acceptingNda && <RefreshCw className={styles['marketplace--w-4-h-4-animate-spin-3']} />}
                Accept & View Drawing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}