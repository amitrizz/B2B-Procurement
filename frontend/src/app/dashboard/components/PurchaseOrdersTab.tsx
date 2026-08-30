import { useState } from 'react';
import { RefreshCw, Clock, Image as ImageIcon, Loader2, X, Sparkles } from 'lucide-react';

interface PurchaseOrdersTabProps {
  orders: any[];
  fetchData: () => Promise<void>;
  handleStartProcessing: (orderId: string, workImageId: string) => Promise<void>;
  handleReadyForPickup: (orderId: string, workImageId: string) => Promise<void>;
  handleConfirmDelivery: (orderId: string) => Promise<void>;
  mode: 'buyer' | 'seller';
}

export default function PurchaseOrdersTab({
  orders,
  fetchData,
  handleStartProcessing,
  handleReadyForPickup,
  handleConfirmDelivery,
  mode
}: PurchaseOrdersTabProps) {
  const [uploadingOrderId, setUploadingOrderId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ src: string; label: string } | null>(null);
  const [reviewOrder, setReviewOrder] = useState<any | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const getFriendlyStatus = (status: string) => {
    switch (status) {
      case 'CREATED':
        return 'Order Received';
      case 'PROCESSING_20':
        return '20% Manufacturing Completed';
      case 'PROCESSING_40':
        return '40% Manufacturing Completed';
      case 'PROCESSING_60':
        return '60% Manufacturing Completed';
      case 'PROCESSING_80':
        return '80% Manufacturing Completed';
      case 'READY_FOR_PICKUP':
        return 'Ready for Pickup';
      case 'DELIVERED':
        return 'Delivered';
      case 'SUPPLIER_PROCESSING':
        return 'In Progress';
      default:
        return status;
    }
  };

  const handleProgressMilestone = async (e: React.ChangeEvent<HTMLInputElement>, orderId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingOrderId(orderId);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        await handleStartProcessing(orderId, data.data.filename);
      } else {
        alert(data.message || 'Image upload failed');
      }
    } catch (err) {
      alert('Failed to upload work image');
    } finally {
      setUploadingOrderId(null);
    }
  };

  const handleUploadWorkImage = async (e: React.ChangeEvent<HTMLInputElement>, orderId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingOrderId(orderId);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        await handleReadyForPickup(orderId, data.data.filename);
      } else {
        alert(data.message || 'Image upload failed');
      }
    } catch (err) {
      alert('Failed to upload work image');
    } finally {
      setUploadingOrderId(null);
    }
  };

  const handleApproveMilestone = async (orderId: string, milestone: string) => {
    setActionLoading(`approve-${orderId}`);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/v1/orders/${orderId}/milestones/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ milestone })
      });
      const data = await res.json();
      if (data.success) {
         fetchData();
      } else {
         alert(data.message || 'Failed to approve milestone');
      }
    } catch (err) {
      alert('Error approving milestone');
    } finally {
      setActionLoading(null);
    }
  };

  const submitReview = async () => {
    if (!reviewOrder) return;
    setActionLoading(`review-${reviewOrder.id}`);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/v1/orders/${reviewOrder.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ rating: reviewRating, comment: reviewComment })
      });
      const data = await res.json();
      if (data.success) {
         alert('Review submitted successfully!');
         setReviewOrder(null);
         fetchData();
      } else {
         alert(data.message || 'Failed to submit review');
      }
    } catch (err) {
      alert('Error submitting review');
    } finally {
      setActionLoading(null);
    }
  };

  const handleGenerateInvoice = async (orderId: string) => {
    setActionLoading(`invoice-${orderId}`);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/v1/orders/${orderId}/generate-invoice`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
         alert('Tax Invoice generated successfully with E-Invoice STUB!');
         fetchData();
      } else {
         alert(data.message || 'Failed to generate invoice');
      }
    } catch (err) {
      alert('Error generating invoice');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePayInvoice = async (order: any, invoice: any) => {
    setActionLoading(`pay-${invoice.id}`);
    try {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => {
        const options = {
          key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_mock',
          amount: invoice.total, // paise
          currency: 'INR',
          name: 'P2P Procurement',
          description: `Payment for Invoice ${invoice.number}`,
          handler: async function (response: any) {
            const token = localStorage.getItem('token');
            await fetch(`/api/v1/orders/${order.id}/pay`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}` }
            });
            alert('Payment completed successfully!');
            fetchData();
          },
          prefill: {
             name: 'Finance Team',
             email: 'finance@company.com'
          },
          theme: { color: '#3399cc' }
        };
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
        setActionLoading(null);
      };
      document.body.appendChild(script);
    } catch (err) {
      alert('Error initializing payment');
      setActionLoading(null);
    }
  };

  const handleAmendPO = async (orderId: string) => {
    const reason = prompt('Enter reason for amendment (e.g. adjust payment terms):');
    if (!reason) return;
    
    setActionLoading(`amend-${orderId}`);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/v1/orders/${orderId}/amend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ reason })
      });
      const data = await res.json();
      if (data.success) {
         alert('PO Amended successfully. It is now awaiting supplier acceptance again.');
         fetchData();
      } else {
         alert(data.message || 'Failed to amend PO');
      }
    } catch (err) {
      alert('Error amending PO');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredOrders = orders.filter((order) => order.flowType.toLowerCase() === (mode === 'buyer' ? 'buying' : 'selling'));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Purchase Orders</h1>
          <p className="text-xs text-slate-400">Track milestones and status transitions for your buying and selling orders</p>
        </div>
        <button onClick={fetchData} className="p-2.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all flex items-center justify-center">
          <RefreshCw className="w-4 h-4 text-slate-300" />
        </button>
      </div>

      <div className="space-y-4">
        {filteredOrders.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">No active {mode === 'buyer' ? 'buying' : 'selling'} orders found.</div>
        ) : (
          filteredOrders.map((order: any) => (
            <div key={order.id} className="glass-card rounded-2xl p-5 border border-white/5 grid md:grid-cols-4 gap-4 items-center">
              <div>
                <div className="flex items-center space-x-2">
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${order.flowType === 'Buying' ? 'bg-blue-500/15 text-blue-400' : 'bg-purple-500/15 text-purple-400'}`}>{order.flowType}</span>
                  <span className="text-[10px] text-slate-500 font-semibold">{order.poNumber}</span>
                </div>
                <h4 className="font-bold text-sm text-white mt-1.5 font-sans leading-snug">
                  {order.flowType === 'Buying' ? `Supplier: ${order.supplierCompany.name}` : `Buyer: ${order.buyerCompany.name}`}
                </h4>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 font-semibold block uppercase">Total Amount</span>
                <span className="font-bold text-sm text-slate-200 mt-1 block">₹{(Number(order.totalAmount) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 font-semibold block uppercase">Status Milestone</span>
                <span className="text-xs font-semibold text-blue-400 flex flex-col gap-1 mt-1">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
                    {getFriendlyStatus(order.status)}
                  </span>
                  
                  {/* List of uploaded milestone images shown as interactive thumbnails */}
                  <div className="flex flex-wrap gap-2.5 mt-2.5">
                    {order.workImage20 && (
                      <div className="relative group shrink-0">
                        <img 
                          src={`/uploads/${order.workImage20}`} 
                          alt="20% Progress" 
                          className="w-12 h-12 object-cover rounded-lg border border-white/10 hover:border-blue-500 transition-all cursor-pointer"
                          onClick={() => setLightbox({ src: `/uploads/${order.workImage20}`, label: '20% Manufacturing Proof' })}
                        />
                        <span className="absolute -top-1 -right-1 bg-blue-600 px-1 rounded text-[7px] text-white font-bold">20%</span>
                      </div>
                    )}
                    {order.workImage40 && (
                      <div className="relative group shrink-0">
                        <img 
                          src={`/uploads/${order.workImage40}`} 
                          alt="40% Progress" 
                          className="w-12 h-12 object-cover rounded-lg border border-white/10 hover:border-blue-500 transition-all cursor-pointer"
                          onClick={() => setLightbox({ src: `/uploads/${order.workImage40}`, label: '40% Manufacturing Proof' })}
                        />
                        <span className="absolute -top-1 -right-1 bg-blue-600 px-1 rounded text-[7px] text-white font-bold">40%</span>
                      </div>
                    )}
                    {order.workImage60 && (
                      <div className="relative group shrink-0">
                        <img 
                          src={`/uploads/${order.workImage60}`} 
                          alt="60% Progress" 
                          className="w-12 h-12 object-cover rounded-lg border border-white/10 hover:border-blue-500 transition-all cursor-pointer"
                          onClick={() => setLightbox({ src: `/uploads/${order.workImage60}`, label: '60% Manufacturing Proof' })}
                        />
                        <span className="absolute -top-1 -right-1 bg-blue-600 px-1 rounded text-[7px] text-white font-bold">60%</span>
                      </div>
                    )}
                    {order.workImage80 && (
                      <div className="relative group shrink-0">
                        <img 
                          src={`/uploads/${order.workImage80}`} 
                          alt="80% Progress" 
                          className="w-12 h-12 object-cover rounded-lg border border-white/10 hover:border-blue-500 transition-all cursor-pointer"
                          onClick={() => setLightbox({ src: `/uploads/${order.workImage80}`, label: '80% Manufacturing Proof' })}
                        />
                        <span className="absolute -top-1 -right-1 bg-blue-600 px-1 rounded text-[7px] text-white font-bold">80%</span>
                      </div>
                    )}
                    {order.workImageId && (
                      <div className="relative group shrink-0">
                        <img 
                          src={`/uploads/${order.workImageId}`} 
                          alt="Pickup Progress" 
                          className="w-12 h-12 object-cover rounded-lg border border-purple-500/30 hover:border-purple-500 transition-all cursor-pointer"
                          onClick={() => setLightbox({ src: `/uploads/${order.workImageId}`, label: 'Ready for Pickup Proof' })}
                        />
                        <span className="absolute -top-1 -right-1 bg-purple-600 px-1 rounded text-[7px] text-white font-bold">Pickup</span>
                      </div>
                    )}
                  </div>
                </span>
              </div>

              <div className="flex justify-end gap-2">
                {order.flowType === 'Selling' && (
                  <>
                    {(order.status === 'CREATED' || order.status === 'PROCESSING_20' || order.status === 'PROCESSING_40' || order.status === 'PROCESSING_60') && (
                      <div className="relative">
                        <input
                          type="file"
                          id={`progress-file-${order.id}`}
                          accept="image/*"
                          onChange={(e) => handleProgressMilestone(e, order.id)}
                          className="hidden"
                        />
                        <button
                          disabled={uploadingOrderId === order.id}
                          onClick={() => document.getElementById(`progress-file-${order.id}`)?.click()}
                          className="py-1.5 px-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-lg text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5"
                        >
                          {uploadingOrderId === order.id ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Uploading Proof...
                            </>
                          ) : (
                            order.status === 'CREATED' ? 'Start Processing (20%)' :
                            order.status === 'PROCESSING_20' ? 'Update Progress to 40%' :
                            order.status === 'PROCESSING_40' ? 'Update Progress to 60%' :
                            'Update Progress to 80%'
                          )}
                        </button>
                      </div>
                    )}
                    {order.status === 'PROCESSING_80' && (
                      <div className="relative">
                        <input
                          type="file"
                          id={`work-image-file-${order.id}`}
                          accept="image/*"
                          onChange={(e) => handleUploadWorkImage(e, order.id)}
                          className="hidden"
                        />
                        <button
                          disabled={uploadingOrderId === order.id}
                          onClick={() => document.getElementById(`work-image-file-${order.id}`)?.click()}
                          className="py-1.5 px-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white rounded-lg text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5"
                        >
                          {uploadingOrderId === order.id ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Uploading...
                            </>
                          ) : (
                            'Mark Ready for Pickup'
                          )}
                        </button>
                      </div>
                    )}
                  </>
                )}

                {order.flowType === 'Buying' && (
                  <div className="flex flex-col gap-2 items-end">
                    {/* Buyer Milestone Approvals */}
                    {(order.status === 'ACCEPTED' || order.status === 'CREATED') && (
                      <button onClick={() => handleAmendPO(order.id)} disabled={actionLoading === `amend-${order.id}`} className="py-1.5 px-3 bg-red-600/20 border border-red-600/50 hover:bg-red-600/40 text-red-400 rounded-lg text-xs font-bold transition-all active:scale-95">
                        {actionLoading === `amend-${order.id}` ? 'Amending...' : 'Amend PO Terms'}
                      </button>
                    )}

                    {order.invoices?.map((inv: any) => (
                      inv.type === 'TAX_INVOICE' && inv.status === 'UNPAID' && (
                        <button key={inv.id} onClick={() => handlePayInvoice(order, inv)} disabled={actionLoading === `pay-${inv.id}`} className="py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all active:scale-95 shadow-[0_0_15px_rgba(37,99,235,0.5)]">
                          {actionLoading === `pay-${inv.id}` ? 'Processing...' : `Pay Invoice ${inv.number} (Razorpay)`}
                        </button>
                      )
                    ))}

                    {(order.status === 'PROCESSING_20' && order.milestoneApproved !== 'PROCESSING_20') && (
                      <button onClick={() => handleApproveMilestone(order.id, 'PROCESSING_20')} disabled={actionLoading === `approve-${order.id}`} className="py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all active:scale-95">
                        {actionLoading === `approve-${order.id}` ? 'Approving...' : 'Approve 20% Milestone'}
                      </button>
                    )}
                    {(order.status === 'PROCESSING_40' && order.milestoneApproved !== 'PROCESSING_40') && (
                      <button onClick={() => handleApproveMilestone(order.id, 'PROCESSING_40')} disabled={actionLoading === `approve-${order.id}`} className="py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all active:scale-95">
                        {actionLoading === `approve-${order.id}` ? 'Approving...' : 'Approve 40% Milestone'}
                      </button>
                    )}
                    {(order.status === 'PROCESSING_60' && order.milestoneApproved !== 'PROCESSING_60') && (
                      <button onClick={() => handleApproveMilestone(order.id, 'PROCESSING_60')} disabled={actionLoading === `approve-${order.id}`} className="py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all active:scale-95">
                        {actionLoading === `approve-${order.id}` ? 'Approving...' : 'Approve 60% Milestone'}
                      </button>
                    )}
                    {(order.status === 'PROCESSING_80' && order.milestoneApproved !== 'PROCESSING_80') && (
                      <button onClick={() => handleApproveMilestone(order.id, 'PROCESSING_80')} disabled={actionLoading === `approve-${order.id}`} className="py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all active:scale-95">
                        {actionLoading === `approve-${order.id}` ? 'Approving...' : 'Approve 80% Milestone'}
                      </button>
                    )}

                    {order.status === 'DELIVERED' && (
                      <button
                        onClick={() => handleConfirmDelivery(order.id)}
                        className="py-1.5 px-3 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition-all active:scale-95"
                      >
                        Confirm Delivery (GRN)
                      </button>
                    )}

                    {order.status === 'COMPLETED' && !order.reviews?.length && (
                      <button
                        onClick={() => setReviewOrder(order)}
                        className="py-1.5 px-3 bg-yellow-500 hover:bg-yellow-600 text-black rounded-lg text-xs font-bold transition-all active:scale-95 flex items-center gap-1"
                      >
                        <Sparkles className="w-3.5 h-3.5" /> Leave a Review
                      </button>
                    )}
                    
                    {/* OTP Hash display for Supplier to give to Transporter */}
                    {order.deliveryOrder?.otpHash && order.status === 'READY_FOR_PICKUP' && (
                       <div className="mt-2 text-[10px] bg-slate-800 p-2 rounded text-slate-300">
                          <span className="block font-bold mb-0.5 text-blue-400">Delivery OTP</span>
                          Please provide the OTP sent to your registered contact to the Transporter to begin delivery.
                       </div>
                    )}
                  </div>
                )}

                {order.flowType === 'Selling' && order.status === 'COMPLETED' && !order.invoices?.find((i: any) => i.type === 'TAX_INVOICE') && (
                  <button
                    onClick={() => handleGenerateInvoice(order.id)}
                    disabled={actionLoading === `invoice-${order.id}`}
                    className="py-1.5 px-3 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition-all active:scale-95"
                  >
                    {actionLoading === `invoice-${order.id}` ? 'Generating...' : 'Generate Tax Invoice'}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
      {/* Image Lightbox Modal */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setLightbox(null)}
        >
          <div
            className="relative max-w-2xl w-full bg-slate-900/95 border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
              <h3 className="text-sm font-bold text-white">{lightbox.label}</h3>
              <button
                onClick={() => setLightbox(null)}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-all"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            {/* Image */}
            <div className="p-4 flex items-center justify-center min-h-[300px] max-h-[70vh]">
              <img
                src={lightbox.src}
                alt={lightbox.label}
                className="max-w-full max-h-[65vh] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {reviewOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setReviewOrder(null)}>
          <div className="relative max-w-md w-full bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white">Rate Supplier</h3>
              <button onClick={() => setReviewOrder(null)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Rating (1-5)</label>
                <div className="flex gap-2">
                  {[1,2,3,4,5].map(num => (
                    <button 
                      key={num}
                      type="button"
                      onClick={() => setReviewRating(num)}
                      className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold transition-all ${reviewRating >= num ? 'bg-yellow-500 text-black' : 'bg-slate-800 text-slate-400'}`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Comment</label>
                <textarea
                  className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500"
                  rows={4}
                  placeholder="How was the part quality and delivery speed?"
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                />
              </div>
              <button
                onClick={submitReview}
                disabled={actionLoading === `review-${reviewOrder.id}`}
                className="w-full py-3 bg-yellow-500 hover:bg-yellow-600 disabled:bg-yellow-700 text-black rounded-xl font-bold transition-all"
              >
                {actionLoading === `review-${reviewOrder.id}` ? 'Submitting...' : 'Submit Review'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
