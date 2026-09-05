import { useState } from 'react';
import { RefreshCw, Clock, Image as ImageIcon, Loader2, X, Sparkles, CheckCircle, Star, FileText } from 'lucide-react';

const formatInr = (paise: number) =>
  `₹${((paise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const SUPPLIER_FEEDBACK_OPTIONS = [
  { value: 'excellent', label: 'Excellent quality and on-time delivery' },
  { value: 'good', label: 'Good quality, delivery as expected' },
  { value: 'acceptable', label: 'Acceptable quality, minor delays' },
  { value: 'quality_issues', label: 'Quality issues but order was usable' },
  { value: 'delays', label: 'Significant delivery delays' },
  { value: 'poor', label: 'Poor quality — would not recommend' },
] as const;

const DEFAULT_FEEDBACK = SUPPLIER_FEEDBACK_OPTIONS[0].value;

interface PurchaseOrdersTabProps {
  orders: any[];
  fetchData: () => Promise<void>;
  handleStartProcessing: (orderId: string, workImageId: string) => Promise<void>;
  handleReadyForPickup: (orderId: string, workImageId: string) => Promise<void>;
  handleConfirmDelivery: (orderId: string) => Promise<void>;
  mode: 'buyer' | 'seller';
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export default function PurchaseOrdersTab({
  orders,
  fetchData,
  handleStartProcessing,
  handleReadyForPickup,
  handleConfirmDelivery,
  mode,
  showToast
}: PurchaseOrdersTabProps) {
  const [uploadingOrderId, setUploadingOrderId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ src: string; label: string } | null>(null);
  const [reviewOrder, setReviewOrder] = useState<any | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewFeedback, setReviewFeedback] = useState<string>(DEFAULT_FEEDBACK);

  const openReviewModal = (order: any) => {
    setReviewOrder(order);
    setReviewRating(5);
    setReviewFeedback(DEFAULT_FEEDBACK);
  };

  const getFeedbackLabel = (value: string) =>
    SUPPLIER_FEEDBACK_OPTIONS.find((o) => o.value === value)?.label || '';

  const getTaxInvoice = (order: any) =>
    order.invoices?.find((inv: any) => inv.type === 'TAX_INVOICE');

  const getSettlementInvoice = (order: any) =>
    order.invoices?.find((inv: any) => inv.type === 'SUPPLIER_PAYOUT');

  /** Buyer pays goods + platform fee + GST on platform fee only. */
  const getPayableAmount = (order: any) =>
    Number(order.buyerTotal || order.totalAmount) || getTaxInvoice(order)?.total || 0;

  const getSupplierPayoutLabel = (order: any) => {
    const amount = order.supplierPayoutAmount || order.goodsTaxable || 0;
    if (!amount) return null;
    switch (order.supplierPayoutStatus) {
      case 'SETTLED':
        return `Platform sent ${formatInr(amount)} for items`;
      case 'PENDING_RELEASE':
        return `Buyer paid — platform sending ${formatInr(amount)} for items`;
      case 'AWAITING_BUYER_PAYMENT':
        return `Awaiting buyer payment (${formatInr(amount)} for your items)`;
      default:
        return null;
    }
  };

  const [viewInvoice, setViewInvoice] = useState<any | null>(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);
  const [payCheckout, setPayCheckout] = useState<{ order: any; checkout: any } | null>(null);
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
        showToast(data.message || 'Image upload failed', 'error');
      }
    } catch (err) {
      showToast('Failed to upload work image', 'error');
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
        showToast(data.message || 'Image upload failed', 'error');
      }
    } catch (err) {
      showToast('Failed to upload work image', 'error');
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
        body: JSON.stringify({ stage: milestone })
      });
      const data = await res.json();
      if (data.success) {
         fetchData();
         showToast(`Milestone ${milestone}% approved`, 'success');
      } else {
         showToast(data.message || 'Failed to approve milestone', 'error');
      }
    } catch (err) {
      showToast('Error approving milestone', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const submitReview = async () => {
    if (!reviewOrder) return;
    const comment = getFeedbackLabel(reviewFeedback);
    if (!comment) {
      showToast('Please select a feedback message', 'error');
      return;
    }
    setActionLoading(`review-${reviewOrder.id}`);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/v1/orders/${reviewOrder.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ rating: reviewRating, comment })
      });
      const data = await res.json();
      if (data.success) {
         showToast('Review submitted successfully!', 'success');
         setReviewOrder(null);
         fetchData();
      } else {
         showToast(data.message || 'Failed to submit review', 'error');
      }
    } catch (err) {
      showToast('Error submitting review', 'error');
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
         showToast('Invoices generated successfully!', 'success');
         fetchData();
      } else {
         showToast(data.message || 'Failed to generate invoice', 'error');
      }
    } catch (err) {
      showToast('Error generating invoice', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const openInvoiceView = async (invoiceId: string) => {
    setLoadingInvoice(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/v1/invoices/${invoiceId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setViewInvoice(data.data);
      } else {
        showToast(data.message || 'Failed to load invoice', 'error');
      }
    } catch {
      showToast('Failed to load invoice', 'error');
    } finally {
      setLoadingInvoice(false);
    }
  };

  const handlePayInvoice = async (order: any, invoice: any) => {
    setActionLoading(`pay-${invoice.id}`);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/payments/cashfree/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ invoiceId: invoice.id }),
      });
      const data = await res.json();
      if (!data.success) {
        showToast(data.message || 'Could not start payment', 'error');
        return;
      }
      setPayCheckout({ order, checkout: data.data });
    } catch {
      showToast('Error initializing payment', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const confirmStubPayment = async () => {
    if (!payCheckout) return;
    const invoiceId = payCheckout.checkout.invoice.id;
    setActionLoading(`pay-${invoiceId}`);
    try {
      const token = localStorage.getItem('token');
      const payRes = await fetch(`/api/v1/invoices/${invoiceId}/confirm-payment`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const payData = await payRes.json();
      if (payData.success) {
        showToast('Payment received by platform. Supplier will be paid after verification.', 'success');
        setPayCheckout(null);
        fetchData();
      } else {
        showToast(payData.message || 'Payment confirmation failed', 'error');
      }
    } catch {
      showToast('Payment confirmation failed', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const openCashfreeCheckout = () => {
    if (!payCheckout) return;
    const { checkout } = payCheckout;

    const loadScript = () =>
      new Promise<void>((resolve, reject) => {
        if ((window as any).Cashfree) {
          resolve();
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Cashfree SDK'));
        document.body.appendChild(script);
      });

    setActionLoading(`pay-${checkout.invoice.id}`);

    loadScript()
      .then(async () => {
        const token = localStorage.getItem('token');
        const cashfree = (window as any).Cashfree({
          mode: checkout.environment === 'production' ? 'production' : 'sandbox',
        });

        const result = await cashfree.checkout({
          paymentSessionId: checkout.paymentSessionId,
          redirectTarget: '_modal',
        });

        if (result?.error) {
          showToast(result.error.message || 'Payment failed', 'error');
          setActionLoading(null);
          return;
        }

        const verifyRes = await fetch('/api/v1/payments/cashfree/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            invoiceId: checkout.invoice.id,
            orderId: checkout.orderId,
          }),
        });
        const verifyData = await verifyRes.json();
        if (verifyData.success) {
          showToast('Payment received by platform. Supplier will be paid after verification.', 'success');
          setPayCheckout(null);
          fetchData();
        } else {
          showToast(verifyData.message || 'Payment verification failed', 'error');
        }
        setActionLoading(null);
      })
      .catch(() => {
        showToast('Could not load Cashfree checkout', 'error');
        setActionLoading(null);
      });
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
         showToast('PO Amended successfully. It is now awaiting supplier acceptance again.', 'success');
         fetchData();
      } else {
         showToast(data.message || 'Failed to amend PO', 'error');
      }
    } catch (err) {
      showToast('Error amending PO', 'error');
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
                  {order.flowType === 'Buying' ? `Supplier: ${order.supplierCompany?.name || 'Unknown Supplier'}` : `Buyer: ${order.buyerCompany?.name || 'Unknown Buyer'}`}
                </h4>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 font-semibold block uppercase">Total Amount</span>
                <span className="font-bold text-sm text-slate-200 mt-1 block">
                  {formatInr(order.buyerTotal || order.totalAmount)}
                </span>
                {order.commissionAmount > 0 && (
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    incl. platform fee {formatInr(order.commissionAmount)}
                    {(order.platformFeeGst || order.taxAmount) > 0 &&
                      ` + GST ${formatInr(order.platformFeeGst || order.taxAmount)}`}
                  </span>
                )}
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
                          className={`w-12 h-12 object-cover rounded-lg border transition-all cursor-pointer ${Number(order.milestoneApproved || 0) >= 20 ? 'border-green-500/50 hover:border-green-500' : 'border-white/10 hover:border-blue-500'}`}
                          onClick={() => setLightbox({ src: `/uploads/${order.workImage20}`, label: '20% Manufacturing Proof' })}
                        />
                        <span className={`absolute -top-1 -right-1 px-1 rounded text-[7px] text-white font-bold flex items-center gap-0.5 ${Number(order.milestoneApproved || 0) >= 20 ? 'bg-green-600' : 'bg-blue-600'}`}>
                          20% {Number(order.milestoneApproved || 0) >= 20 && <CheckCircle className="w-2 h-2" />}
                        </span>
                      </div>
                    )}
                    {order.workImage40 && (
                      <div className="relative group shrink-0">
                        <img 
                          src={`/uploads/${order.workImage40}`} 
                          alt="40% Progress" 
                          className={`w-12 h-12 object-cover rounded-lg border transition-all cursor-pointer ${Number(order.milestoneApproved || 0) >= 40 ? 'border-green-500/50 hover:border-green-500' : 'border-white/10 hover:border-blue-500'}`}
                          onClick={() => setLightbox({ src: `/uploads/${order.workImage40}`, label: '40% Manufacturing Proof' })}
                        />
                        <span className={`absolute -top-1 -right-1 px-1 rounded text-[7px] text-white font-bold flex items-center gap-0.5 ${Number(order.milestoneApproved || 0) >= 40 ? 'bg-green-600' : 'bg-blue-600'}`}>
                          40% {Number(order.milestoneApproved || 0) >= 40 && <CheckCircle className="w-2 h-2" />}
                        </span>
                      </div>
                    )}
                    {order.workImage60 && (
                      <div className="relative group shrink-0">
                        <img 
                          src={`/uploads/${order.workImage60}`} 
                          alt="60% Progress" 
                          className={`w-12 h-12 object-cover rounded-lg border transition-all cursor-pointer ${Number(order.milestoneApproved || 0) >= 60 ? 'border-green-500/50 hover:border-green-500' : 'border-white/10 hover:border-blue-500'}`}
                          onClick={() => setLightbox({ src: `/uploads/${order.workImage60}`, label: '60% Manufacturing Proof' })}
                        />
                        <span className={`absolute -top-1 -right-1 px-1 rounded text-[7px] text-white font-bold flex items-center gap-0.5 ${Number(order.milestoneApproved || 0) >= 60 ? 'bg-green-600' : 'bg-blue-600'}`}>
                          60% {Number(order.milestoneApproved || 0) >= 60 && <CheckCircle className="w-2 h-2" />}
                        </span>
                      </div>
                    )}
                    {order.workImage80 && (
                      <div className="relative group shrink-0">
                        <img 
                          src={`/uploads/${order.workImage80}`} 
                          alt="80% Progress" 
                          className={`w-12 h-12 object-cover rounded-lg border transition-all cursor-pointer ${Number(order.milestoneApproved || 0) >= 80 ? 'border-green-500/50 hover:border-green-500' : 'border-white/10 hover:border-blue-500'}`}
                          onClick={() => setLightbox({ src: `/uploads/${order.workImage80}`, label: '80% Manufacturing Proof' })}
                        />
                        <span className={`absolute -top-1 -right-1 px-1 rounded text-[7px] text-white font-bold flex items-center gap-0.5 ${Number(order.milestoneApproved || 0) >= 80 ? 'bg-green-600' : 'bg-blue-600'}`}>
                          80% {Number(order.milestoneApproved || 0) >= 80 && <CheckCircle className="w-2 h-2" />}
                        </span>
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

                    {order.deliveryOrder?.pickupOtp &&
                      (order.status === 'READY_FOR_PICKUP' ||
                        order.status === 'PICKED_UP' ||
                        order.status === 'IN_TRANSIT') && (
                        <div className="mt-2 text-[10px] bg-slate-800 p-2 rounded text-slate-300 border border-purple-500/20 max-w-xs">
                          <span className="block font-bold mb-0.5 text-purple-400">Pickup OTP</span>
                          <div className="flex flex-col gap-1 mt-1">
                            <span className="text-sm font-mono bg-slate-900 px-2 py-1 rounded text-white tracking-widest w-fit">
                              {order.deliveryOrder.pickupOtp}
                            </span>
                            <span className="text-slate-400">
                              Share this OTP with the transporter when they arrive for pickup.
                            </span>
                          </div>
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
                      inv.type === 'TAX_INVOICE' && (
                        <div key={inv.id} className="flex flex-col gap-2 items-end">
                          <button
                            type="button"
                            onClick={() => openInvoiceView(inv.id)}
                            disabled={loadingInvoice}
                            className="py-1.5 px-3 bg-slate-800 border border-white/10 hover:bg-slate-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            View Invoice {inv.number}
                          </button>
                          {inv.status === 'UNPAID' && (
                            <button
                              onClick={() => handlePayInvoice(order, inv)}
                              disabled={actionLoading === `pay-${inv.id}`}
                              className="py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all active:scale-95 shadow-[0_0_15px_rgba(37,99,235,0.5)]"
                            >
                              {actionLoading === `pay-${inv.id}` ? 'Processing...' : `Pay Platform ${formatInr(getPayableAmount(order))}`}
                            </button>
                          )}
                          {(inv.status === 'PAID' || inv.status === 'SETTLED') && (
                            <span className="text-[10px] font-bold text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-1 rounded-lg">
                              Paid to platform
                            </span>
                          )}
                        </div>
                      )
                    ))}

                    {(order.status === 'PROCESSING_20' && order.milestoneApproved !== '20') && (
                      <button onClick={() => handleApproveMilestone(order.id, '20')} disabled={actionLoading === `approve-${order.id}`} className="py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all active:scale-95">
                        {actionLoading === `approve-${order.id}` ? 'Approving...' : 'Approve 20% Milestone'}
                      </button>
                    )}
                    {(order.status === 'PROCESSING_40' && order.milestoneApproved !== '40') && (
                      <button onClick={() => handleApproveMilestone(order.id, '40')} disabled={actionLoading === `approve-${order.id}`} className="py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all active:scale-95">
                        {actionLoading === `approve-${order.id}` ? 'Approving...' : 'Approve 40% Milestone'}
                      </button>
                    )}
                    {(order.status === 'PROCESSING_60' && order.milestoneApproved !== '60') && (
                      <button onClick={() => handleApproveMilestone(order.id, '60')} disabled={actionLoading === `approve-${order.id}`} className="py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all active:scale-95">
                        {actionLoading === `approve-${order.id}` ? 'Approving...' : 'Approve 60% Milestone'}
                      </button>
                    )}
                    {(order.status === 'PROCESSING_80' && order.milestoneApproved !== '80') && (
                      <button onClick={() => handleApproveMilestone(order.id, '80')} disabled={actionLoading === `approve-${order.id}`} className="py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all active:scale-95">
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
                        onClick={() => openReviewModal(order)}
                        className="py-1.5 px-3 bg-yellow-500 hover:bg-yellow-600 text-black rounded-lg text-xs font-bold transition-all active:scale-95 flex items-center gap-1"
                      >
                        <Sparkles className="w-3.5 h-3.5" /> Leave a Review
                      </button>
                    )}
                    
                    {/* Delivery OTP for buyer to give transporter at drop-off */}
                    {(order.deliveryOrder?.deliveryOtp || order.deliveryOrder?.otp) &&
                      (order.status === 'READY_FOR_PICKUP' ||
                        order.status === 'PICKED_UP' ||
                        order.status === 'IN_TRANSIT') && (
                       <div className="mt-2 text-[10px] bg-slate-800 p-2 rounded text-slate-300 border border-blue-500/20 max-w-xs">
                          <span className="block font-bold mb-0.5 text-blue-400">Delivery OTP</span>
                          <div className="flex flex-col gap-1 mt-1">
                            <span className="text-sm font-mono bg-slate-900 px-2 py-1 rounded text-white tracking-widest w-fit">
                              {order.deliveryOrder.deliveryOtp || order.deliveryOrder.otp}
                            </span>
                            <span className="text-slate-400">
                              Provide this OTP to the transporter when you receive the order.
                            </span>
                          </div>
                       </div>
                    )}
                  </div>
                )}

                {order.flowType === 'Selling' && getSettlementInvoice(order) && (
                  <div className="flex flex-col gap-2 items-end">
                    {getSupplierPayoutLabel(order) && (
                      <span
                        className={`text-[10px] font-bold px-2 py-1 rounded-lg border max-w-xs text-right ${
                          order.supplierPayoutStatus === 'SETTLED'
                            ? 'text-green-400 bg-green-500/10 border-green-500/20'
                            : order.supplierPayoutStatus === 'PENDING_RELEASE'
                              ? 'text-amber-300 bg-amber-500/10 border-amber-500/20'
                              : 'text-slate-400 bg-slate-800 border-white/10'
                        }`}
                      >
                        {getSupplierPayoutLabel(order)}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => openInvoiceView(getSettlementInvoice(order).id)}
                      disabled={loadingInvoice}
                      className="py-1.5 px-3 bg-slate-800 border border-green-500/30 hover:bg-slate-700 text-green-400 rounded-lg text-xs font-bold flex items-center gap-1.5"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      View Settlement Invoice
                    </button>
                  </div>
                )}

                {order.flowType === 'Selling' && order.status === 'COMPLETED' && !getTaxInvoice(order) && (
                  <button
                    onClick={() => handleGenerateInvoice(order.id)}
                    disabled={actionLoading === `invoice-${order.id}`}
                    className="py-1.5 px-3 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition-all active:scale-95"
                  >
                    {actionLoading === `invoice-${order.id}` ? 'Generating...' : 'Generate Invoices'}
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

      {/* Payment checkout modal */}
      {payCheckout && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setPayCheckout(null)}
        >
          <div
            className="relative max-w-md w-full bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-white">Pay Platform</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Invoice {payCheckout.checkout.invoice.number}
                </p>
              </div>
              <button onClick={() => setPayCheckout(null)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-3 text-sm mb-5">
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-[11px] text-blue-100">
                {payCheckout.checkout.paymentNote}
              </div>

              <div className="bg-slate-950/60 rounded-xl p-3 border border-white/5">
                <p className="text-[10px] uppercase text-slate-500 font-bold">Payee (Platform)</p>
                <p className="text-white font-semibold mt-1">{payCheckout.checkout.platform.name}</p>
                <p className="text-[10px] text-slate-400">GSTIN: {payCheckout.checkout.platform.gstin}</p>
                <p className="text-[10px] text-slate-400">State: {payCheckout.checkout.platform.state}</p>
              </div>

              {payCheckout.checkout.purchaseOrder && (
                <div className="bg-slate-950/60 rounded-xl p-3 border border-white/5 flex justify-between text-xs">
                  <span className="text-slate-400">PO / Supplier</span>
                  <span className="text-white text-right">
                    {payCheckout.checkout.purchaseOrder.poNumber}
                    <span className="block text-slate-400">
                      {payCheckout.checkout.purchaseOrder.supplierName}
                    </span>
                  </span>
                </div>
              )}

              <div className="bg-slate-950/60 rounded-xl p-3 border border-white/5 space-y-2">
                {payCheckout.checkout.invoice.goodsTaxable != null && (
                  <div className="flex justify-between text-slate-300">
                    <span>Goods value</span>
                    <span>{formatInr(payCheckout.checkout.invoice.goodsTaxable)}</span>
                  </div>
                )}
                {payCheckout.checkout.invoice.commissionAmount > 0 && (
                  <div className="flex justify-between text-slate-300">
                    <span>Platform fee</span>
                    <span>{formatInr(payCheckout.checkout.invoice.commissionAmount)}</span>
                  </div>
                )}
                {payCheckout.checkout.invoice.goodsTaxable == null && (
                  <div className="flex justify-between text-slate-300">
                    <span>Taxable</span>
                    <span>{formatInr(payCheckout.checkout.invoice.taxable)}</span>
                  </div>
                )}
                {payCheckout.checkout.invoice.cgstAmount > 0 && (
                  <div className="flex justify-between text-slate-400 text-xs">
                    <span>CGST on platform fee</span>
                    <span>{formatInr(payCheckout.checkout.invoice.cgstAmount)}</span>
                  </div>
                )}
                {payCheckout.checkout.invoice.sgstAmount > 0 && (
                  <div className="flex justify-between text-slate-400 text-xs">
                    <span>SGST on platform fee</span>
                    <span>{formatInr(payCheckout.checkout.invoice.sgstAmount)}</span>
                  </div>
                )}
                {payCheckout.checkout.invoice.igstAmount > 0 && (
                  <div className="flex justify-between text-slate-400 text-xs">
                    <span>IGST on platform fee</span>
                    <span>{formatInr(payCheckout.checkout.invoice.igstAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-white font-bold border-t border-white/10 pt-2">
                  <span>Total payable</span>
                  <span>{formatInr(payCheckout.checkout.invoice.total)}</span>
                </div>
              </div>

              {payCheckout.checkout.stubMode && (
                <p className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2">
                  Dev mode: Cashfree is not configured. Use simulated payment to mark this invoice paid.
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPayCheckout(null)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-300 text-sm font-semibold hover:bg-white/5"
              >
                Cancel
              </button>
              {payCheckout.checkout.stubMode ? (
                <button
                  type="button"
                  onClick={confirmStubPayment}
                  disabled={actionLoading === `pay-${payCheckout.checkout.invoice.id}`}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold disabled:opacity-60"
                >
                  {actionLoading === `pay-${payCheckout.checkout.invoice.id}`
                    ? 'Processing...'
                    : `Confirm ${formatInr(payCheckout.checkout.invoice.total)}`}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={openCashfreeCheckout}
                  disabled={actionLoading === `pay-${payCheckout.checkout.invoice.id}`}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold disabled:opacity-60"
                >
                  {actionLoading === `pay-${payCheckout.checkout.invoice.id}`
                    ? 'Opening...'
                    : `Pay ${formatInr(payCheckout.checkout.invoice.total)}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Invoice View Modal */}
      {viewInvoice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setViewInvoice(null)}
        >
          <div
            className="relative max-w-lg w-full bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-white">
                  {viewInvoice.type === 'SUPPLIER_PAYOUT' ? 'Settlement Invoice' : 'Tax Invoice'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">{viewInvoice.number}</p>
              </div>
              <button onClick={() => setViewInvoice(null)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {viewInvoice.paymentNote && (
              <div className="mb-4 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-[11px] text-amber-100">
                {viewInvoice.paymentNote}
              </div>
            )}

            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-950/60 rounded-xl p-3 border border-white/5">
                  <p className="text-[10px] uppercase text-slate-500 font-bold">
                    {viewInvoice.sellerParty?.label || 'Seller'}
                  </p>
                  <p className="text-white font-semibold mt-1">
                    {viewInvoice.sellerParty?.name || viewInvoice.supplierCompany?.name}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    GSTIN: {viewInvoice.sellerParty?.gstin || '—'}
                  </p>
                </div>
                <div className="bg-slate-950/60 rounded-xl p-3 border border-white/5">
                  <p className="text-[10px] uppercase text-slate-500 font-bold">
                    {viewInvoice.buyerParty?.label || 'Buyer'}
                  </p>
                  <p className="text-white font-semibold mt-1">
                    {viewInvoice.buyerParty?.name || viewInvoice.buyerCompany?.name}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    GSTIN: {viewInvoice.buyerParty?.gstin || '—'}
                  </p>
                </div>
              </div>

              <div className="bg-slate-950/60 rounded-xl p-3 border border-white/5 flex justify-between">
                <span className="text-slate-400">PO</span>
                <span className="text-white font-mono">{viewInvoice.purchaseOrder?.poNumber}</span>
              </div>

              <div className="bg-slate-950/60 rounded-xl p-3 border border-white/5 space-y-2">
                {viewInvoice.type === 'TAX_INVOICE' ? (
                  <>
                    <div className="flex justify-between text-slate-300">
                      <span>Goods value</span>
                      <span>{formatInr(viewInvoice.goodsTaxable ?? 0)}</span>
                    </div>
                    {(viewInvoice.commissionAmount ?? 0) > 0 && (
                      <div className="flex justify-between text-slate-300">
                        <span>Platform fee</span>
                        <span>{formatInr(viewInvoice.commissionAmount)}</span>
                      </div>
                    )}
                    {(viewInvoice.feeTaxable ?? viewInvoice.taxable) > 0 && (
                      <div className="flex justify-between text-slate-400 text-xs">
                        <span>GST taxable (platform fee)</span>
                        <span>{formatInr(viewInvoice.feeTaxable ?? viewInvoice.taxable)}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex justify-between text-slate-300">
                    <span>Goods settlement</span>
                    <span>{formatInr(viewInvoice.goodsTaxable ?? viewInvoice.taxable)}</span>
                  </div>
                )}
                {viewInvoice.cgstAmount > 0 && (
                  <div className="flex justify-between text-slate-400 text-xs">
                    <span>CGST on platform fee</span>
                    <span>{formatInr(viewInvoice.cgstAmount)}</span>
                  </div>
                )}
                {viewInvoice.sgstAmount > 0 && (
                  <div className="flex justify-between text-slate-400 text-xs">
                    <span>SGST on platform fee</span>
                    <span>{formatInr(viewInvoice.sgstAmount)}</span>
                  </div>
                )}
                {viewInvoice.igstAmount > 0 && (
                  <div className="flex justify-between text-slate-400 text-xs">
                    <span>IGST on platform fee</span>
                    <span>{formatInr(viewInvoice.igstAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-white font-bold border-t border-white/10 pt-2">
                  <span>Total</span>
                  <span>{formatInr(viewInvoice.total)}</span>
                </div>
              </div>

              {viewInvoice.irn && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-[11px] text-blue-200">
                  <p className="font-bold text-blue-400 mb-1">E-Invoice (stub)</p>
                  <p>IRN: {viewInvoice.irn}</p>
                  <p>Ack: {viewInvoice.ackNo}</p>
                </div>
              )}

              <div className="flex justify-between items-center">
                <span className={`text-xs font-bold px-2 py-1 rounded ${
                  viewInvoice.status === 'SETTLED' || viewInvoice.status === 'PAID'
                    ? 'bg-green-500/20 text-green-400'
                    : viewInvoice.status === 'PENDING_RELEASE'
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {viewInvoice.status === 'SETTLED' && viewInvoice.type === 'SUPPLIER_PAYOUT'
                    ? 'PAID TO SUPPLIER'
                    : viewInvoice.status}
                </span>
              </div>

              {viewInvoice.lines?.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase text-slate-500 font-bold mb-2">Line items</p>
                  <div className="space-y-2">
                    {viewInvoice.lines.map((line: any) => (
                      <div key={line.id} className="bg-slate-950/40 rounded-lg p-2 text-xs border border-white/5">
                        <p className="text-white">{line.description}</p>
                        <p className="text-slate-400 mt-1">
                          Qty {line.qty} × {formatInr(line.unitPrice)} = {formatInr(line.taxable)}
                          {line.taxAmount > 0 && (
                            <span className="text-slate-500"> (incl. GST {formatInr(line.taxAmount)})</span>
                          )}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Rating</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setReviewRating(num)}
                      className="p-1 rounded-lg transition-all hover:scale-110"
                      aria-label={`Rate ${num} out of 5`}
                    >
                      <Star
                        className={`w-8 h-8 ${
                          num <= reviewRating
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-slate-600'
                        }`}
                      />
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">{reviewRating} out of 5 stars</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Feedback</label>
                <select
                  className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500 appearance-none cursor-pointer"
                  value={reviewFeedback}
                  onChange={(e) => setReviewFeedback(e.target.value)}
                >
                  {SUPPLIER_FEEDBACK_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value} className="bg-slate-950">
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-2">
                  Choose a preset message — no typing required.
                </p>
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
