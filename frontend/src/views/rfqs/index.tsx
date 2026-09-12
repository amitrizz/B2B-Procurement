import { useState, useEffect } from 'react';
import styles from './rfqs.module.scss';
import {  Plus, Star, ChevronRight, FileText, ShoppingCart, Building, RefreshCw, Loader2 , Clock } from 'lucide-react';
import { ButtonSpinner } from '@/components/ui/ActionButton';
import SamplingPanel, { SupplierSamplingPanel } from './components/SamplingPanel';
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
    <div className={styles['rfq--container']}>
      {/* Title & Description */}
      <div className={styles['rfq--header']}>
        <div className={styles['rfq--header-padding']}>
          <h1 className={styles['rfq--title']}>
            {mode === 'buyer' ? 'My Requirements (Buying)' : 'My Submitted Bids (Selling)'}
          </h1>
          <p className={styles['rfq--subtitle']}>
            {mode === 'buyer' 
              ? 'Create, monitor, and select winners for your component requirements' 
              : 'Monitor quotes and component bids you have submitted to other companies'}
          </p>
        </div>
        <div className={`${styles['rfq--refresh-btn']} ${mode === 'buyer' ? styles['rfq--refresh-btn-buyer'] : styles['rfq--refresh-btn-seller']}`}>
           <RefreshCw className={styles['rfq--refresh-icon']} onClick={handleRefresh} />
        </div>
      </div>

      {/* Status Filter Sub-Tabs */}
      <div className={styles['rfq--tabs']}>
        <button
          onClick={() => { setStatusFilter('open'); setSelectedRfqForDetails(null); }}
          className={`${styles['rfq--tab-btn']} ${statusFilter === 'open' ? (mode === 'buyer' ? styles['rfq--tab-active-buyer'] : styles['rfq--tab-active-seller']) : styles['rfq--tab-inactive']}`}
        >
          Open
        </button>
        <button
          onClick={() => { setStatusFilter('in_progress'); setSelectedRfqForDetails(null); }}
          className={`${styles['rfq--tab-btn']} ${statusFilter === 'in_progress' ? (mode === 'buyer' ? styles['rfq--tab-active-buyer'] : styles['rfq--tab-active-seller']) : styles['rfq--tab-inactive']}`}
        >
          In Progress
        </button>
        <button
          onClick={() => { setStatusFilter('closed'); setSelectedRfqForDetails(null); }}
          className={`${styles['rfq--tab-btn']} ${statusFilter === 'closed' ? (mode === 'buyer' ? styles['rfq--tab-active-buyer'] : styles['rfq--tab-active-seller']) : styles['rfq--tab-inactive']}`}
        >
          Closed
        </button>
      </div>

      {/* Action Buttons */}
      {subTab === 'buying' && statusFilter === 'open' && !selectedRfqForDetails && (
        <div className={styles['rfq--publish-container']}>
          <button
            onClick={() => setShowRfqModal(true)}
            className={styles['rfq--publish-btn']}
          >
            <Plus className={styles['rfq--plus-icon']} />
            <span>Publish New RFQ</span>
          </button>
        </div>
      )}

      {/* Buying Sub-Tab (Existing view wrapper) */}
      {subTab === 'buying' && (
        <>
          {selectedRfqForDetails ? (
            <div className={styles['rfq--details-card']}>
              <div className={styles['rfq--details-header']}>
                <div>
                  <h2 className={styles['rfq--details-title']}>{selectedRfqForDetails.title}</h2>
                  <span className={styles['rfq--details-number']}>{selectedRfqForDetails.rfqNumber}</span>
                </div>
                <button onClick={() => setSelectedRfqForDetails(null)} className={styles['rfq--back-button']}>Back</button>
              </div>

              <SamplingPanel
                rfqId={selectedRfqForDetails.id}
                rfqNumber={selectedRfqForDetails.rfqNumber}
                items={selectedRfqForDetails.items}
                onRefresh={fetchData}
                onDetailsRefresh={handleViewRfqDetails}
                showToast={showToast}
              />

              <div className={styles['rfq--items-container']}>
                {selectedRfqForDetails.items.map((item: any) => (
                  <div key={item.id} className={styles['rfq--item-card']}>
                    <div className={styles['rfq--item-header']}>
                      <div>
                        <h4 className={styles['rfq--item-name']}>{item.componentName}</h4>
                        <span className={styles['rfq--item-meta']}>Qty: {Number(item.quantity)} {item.unit} | HSN: {item.hsnCode} | Sourcing: {item.materialOptionPreference === 'WITH_MATERIAL' ? 'With Material' : 'Without Material'}</span>
                      </div>
                    </div>

                    {/* Bids received list */}
                    <div className={styles['rfq--bids-container']}>
                      <h5 className={styles['rfq--bids-title']}>Received Quotes</h5>
                      {item.bids && item.bids.length > 0 ? (
                        <div className={styles['rfq--table-wrapper']}>
                          <table className={styles['rfq--table']}>
                            <thead>
                              <tr className={styles['rfq--table-head-row']}>
                                <th className={styles['rfq--th-supplier']}>Supplier</th>
                                {item.materialOptionPreference === 'WITH_MATERIAL' ? (
                                  <th className={styles['rfq--th-price-material']}>Price (With Material)</th>
                                ) : (
                                  <th className={styles['rfq--th-price-no-material']}>Price (Without Material)</th>
                                )}
                                <th className={styles['rfq--th-delivery']}>Delivery</th>
                                <th className={styles['rfq--th-action']}>Action</th>
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
                                  <tr key={bid.id} className={styles['rfq--table-row']}>
                                    <td className={styles['rfq--td-supplier']}>{bid.supplierCompany.name}</td>
                                    {item.materialOptionPreference === 'WITH_MATERIAL' ? (
                                      <td className={styles['rfq--td-price-mat']}>
                                        Total: ₹{buyerTotal.toLocaleString('en-IN')}
                                        <span className={styles['rfq--tax-label']}>
                                          ₹{unitTotal.toLocaleString('en-IN')} / unit
                                        </span>
                                      </td>
                                    ) : (
                                      <td className={styles['rfq--td-price-nomat']}>
                                        Total: ₹{buyerTotal.toLocaleString('en-IN')}
                                        <span className={styles['rfq--tax-label-nomat']}>
                                          ₹{unitTotal.toLocaleString('en-IN')} / unit
                                        </span>
                                      </td>
                                    )}
                                    <td className={styles['rfq--td-delivery']}>{bid.estimatedTimeDays} days</td>
                                    <td className={styles['rfq--td-action']}>
                                      {bid.status === 'ACCEPTED' ? (
                                        <span className={styles['rfq--status-accepted']}>Accepted</span>
                                      ) : bid.status === 'REJECTED' ? (
                                        <span className={styles['rfq--status-rejected']}>Rejected</span>
                                      ) : (
                                        <button
                                          onClick={() => setAwardModal({ rfqItemId: item.id, bidId: bid.id, maxQty: Number(item.quantity), currentQty: Number(item.quantity) })}
                                          disabled={selectedRfqForDetails.status === 'SAMPLING'}
                                          className={styles['rfq--select-winner-btn']}
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
                        <div className={styles['rfq--no-quotes']}>No quotes received yet.</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className={styles['rfq--list-container']}>
              {filteredRfqs.length === 0 ? (
                <div className={styles['rfq--empty-state']}>No requirements found matching this status.</div>
              ) : (
                filteredRfqs.map((rfq: any) => (
                  <div key={rfq.id} className={styles['rfq--card']}>
                    <div className={styles['rfq--card-header']}>
                      <span className={`${styles['rfq--status-pill']} ${rfq.status === 'PUBLISHED' || rfq.status === 'BIDDING_OPEN' ? styles['rfq--status-pill-seller'] : styles['rfq--status-pill-buyer']}`}>{rfq.status}</span>
                      <span className={styles['rfq--number']}>{rfq.rfqNumber}</span>
                    </div>
                    
                    <h3 className={styles['rfq--card-title']}>{rfq.title}</h3>
                    
                    <div className={styles['rfq--urgent-icon-wrapper']}>
                      <div className={styles['rfq--urgent-badge']}>
                        <Clock className={styles['rfq--urgent-icon']} /> Urgent requirement
                      </div>
                    </div>
                    
                    <div className={styles['rfq--properties-row']}>
                      {rfq.pr && (
                        <div className={styles['rfq--stats-row']}><span>Linked RFQ:</span> <span className={styles['rfq--stat-value']}>{rfq.pr.prNumber}</span></div>
                      )}
                      <div className={styles['rfq--stats-group']}><span>Components:</span> <span className={styles['rfq--stat-value-blue']}>{rfq.items.length} parts</span></div>
                      <div className={styles['rfq--stats-items']}><span>Ends:</span> <span className={styles['rfq--stat-value-dark']}>{new Date(rfq.bidEndAt).toLocaleDateString()}</span></div>
                    </div>
                    
                    {statusFilter === 'open' && (
                      <div className={styles['rfq--actions-row']}>
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
                          className={styles['rfq--compare-btn']}
                        >
                          {detailsLoadingId === rfq.id ? (
                            <Loader2 className={styles['rfq--spinner']} />
                          ) : (
                            <>
                              <div className={styles['rfq--btn-content']}>
                                <FileText className={styles['rfq--btn-icon']} />
                                <span>Compare Bids & Select Winner</span>
                              </div>
                              <ChevronRight className={styles['rfq--btn-icon-alt']} />
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleEditRfq(rfq)}
                          className={styles['rfq--edit-btn']}
                        >
                          <svg className={styles['rfq--btn-icon-dark']} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
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
        <div className={styles['rfq--seller-bids']}>
          <SupplierSamplingPanel showToast={showToast} isVisible={subTab === 'selling'} />
          
          {loadingBids ? (
            <div className={styles['rfq--loading-state']}>
              <RefreshCw className={styles['rfq--loading-spinner']} />
              <span>Loading submitted quotes...</span>
            </div>
          ) : filteredBids.length === 0 ? (
            <div className={styles['rfq--empty-bids']}>No bids found matching this status.</div>
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
                <div key={bid.id} className={styles['rfq--card']}>
                    <div className={styles['rfq--card-header']}>
                      <span className={`${styles['rfq--dynamic-status']} ${statusStyle}`}>{displayStatus}</span>
                      <span className={styles['rfq--number']}>{bid.rfq?.rfqNumber}</span>
                    </div>
                    
                    <h3 className={styles['rfq--card-title']}>{bid.rfq?.title}</h3>
                    
                    <div className={styles['rfq--urgent-badge']}>
                      <div className={styles['rfq--urgent-badge-seller']}>
                        <Clock className={styles['rfq--urgent-badge-icon']} /> Urgent requirement
                      </div>
                    </div>
                    
                    <div className={styles['rfq--bid-card-top']}>
                      Component Bid On:
                      <div className={styles['rfq--bid-card-title']}>{bid.rfqItem?.componentName || 'Spacer ring'}</div>
                    </div>

                    <div className={styles['rfq--bid-stats']}>
                       <div className={styles['rfq--bid-stat-col']}>
                          <p className={styles['rfq--bid-stat-label']}>Your Quote:</p>
                          <p className={styles['rfq--bid-stat-value']}>₹ {totalQuote.toLocaleString('en-IN')}</p>
                          <p className={styles['rfq--bid-stat-unit']}>(₹ {unitPrice.toLocaleString('en-IN')} / unit)</p>
                       </div>
                       <div className={styles['rfq--divider']}></div>
                       <div className={styles['rfq--bid-stat-col-alt']}>
                          <p className={styles['rfq--bid-stat-label-alt']}>Buyer Pays:</p>
                          <p className={styles['rfq--bid-stat-value-alt']}>₹ {buyerTotal.toLocaleString('en-IN')}</p>
                          <p className={styles['rfq--bid-stat-sub']}>(Incl. platform fee ₹{formatInrFromPaise(pricing.commissionPaise)} + GST ₹{formatInrFromPaise(pricing.feeGstPaise)})</p>
                       </div>
                    </div>

                    <div className={styles['rfq--bid-delivery']}>
                      <svg className={styles['rfq--clock-icon']} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                      <span className={styles['rfq--delivery-label']}>Quoted Delivery:</span> <span className={styles['rfq--delivery-value']}>{bid.estimatedTimeDays} days</span>
                    </div>

                    <div className={styles['rfq--bid-actions']}>
                        <button
                          className={styles['rfq--view-details-btn']}
                        >
                          <div className={styles['rfq--btn-inner']}>
                            <FileText className={styles['rfq--btn-inner-icon']} />
                            <span>View Bid Details</span>
                          </div>
                          <ChevronRight className={styles['rfq--btn-inner-icon-alt']} />
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
        <div className={styles['rfq--modal-overlay']} onClick={() => setAwardModal(null)}>
          <div className={styles['rfq--modal-content']} onClick={e => e.stopPropagation()}>
            <h3 className={styles['rfq--modal-title']}>Award Bid</h3>
            <p className={styles['rfq--modal-desc']}>You can award the full quantity or split it.</p>
            <div className={styles['rfq--modal-form']}>
              <div>
                <label className={styles['rfq--modal-label']}>Quantity to Award</label>
                <input
                  type="number"
                  min={1}
                  max={awardModal.maxQty}
                  value={awardModal.currentQty}
                  onChange={(e) => setAwardModal({ ...awardModal, currentQty: Number(e.target.value) })}
                  className={styles['rfq--modal-input']}
                />
                <span className={styles['rfq--modal-help']}>Max available to award: {awardModal.maxQty}</span>
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
                className={styles['rfq--modal-submit']}
              >
                {awardLoading && <Loader2 className={styles['rfq--modal-spinner']} />}
                {awardLoading ? 'Awarding...' : 'Confirm Award'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}