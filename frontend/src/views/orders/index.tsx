'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Clock, Image as ImageIcon, Loader2, X, Sparkles, CheckCircle, Star, FileText, Search } from 'lucide-react';
import { RefreshButton } from '@/components/ui/RefreshButton';
import { ButtonSpinner } from '@/components/ui/ActionButton';
import {
  clearPaymentReturnQuery,
  clearPendingPayment,
  readPaymentReturnParams,
  readPendingPayment,
  runCashfreeCheckout,
  storePendingPayment,
} from '@/lib/cashfreeCheckout';

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
  user?: any;
}

export default function PurchaseOrdersTab({
  orders,
  fetchData,
  handleStartProcessing,
  handleReadyForPickup,
  handleConfirmDelivery,
  mode,
  showToast,
  user,
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
  const [payStep, setPayStep] = useState<'summary' | 'gateway'>('summary');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const cashfreeContainerRef = useRef<HTMLDivElement>(null);
  const checkoutStartedRef = useRef(false);

  const handleAcceptPo = async (orderId: string) => {
    setActionLoading(`accept-${orderId}`);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/v1/orders/${orderId}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        showToast('Purchase order accepted — you can start manufacturing', 'success');
        fetchData();
      } else {
        showToast(data.message || 'Failed to accept PO', 'error');
      }
    } catch {
      showToast('Failed to accept PO', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const getFriendlyStatus = (status: string) => {
    switch (status) {
      case 'AWAITING_ACCEPTANCE':
        return 'Awaiting Your Acceptance';
      case 'ACCEPTED':
        return 'Accepted — Ready to Start';
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
      case 'COMPLETED':
        return 'Completed';
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
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ milestone })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Milestone ${milestone}% approved`, 'success');
        fetchData();
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
    setActionLoading(`review-${reviewOrder.id}`);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/v1/orders/${reviewOrder.id}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          rating: reviewRating,
          feedback: reviewFeedback,
          comment: getFeedbackLabel(reviewFeedback)
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Thank you for your feedback! Review submitted.', 'success');
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

  const closePayModal = () => {
    setPayCheckout(null);
    setPayStep('summary');
    checkoutStartedRef.current = false;
    if (cashfreeContainerRef.current) {
      cashfreeContainerRef.current.innerHTML = '';
    }
  };

  const verifyCashfreePayment = async (invoiceId: string, orderId: string) => {
    const token = localStorage.getItem('token');
    const verifyRes = await fetch('/api/v1/payments/cashfree/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ invoiceId, orderId }),
    });
    return verifyRes.json();
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
      storePendingPayment(data.data.invoice.id, data.data.orderId);
      setPayCheckout({ order, checkout: data.data });
      setPayStep(data.data.stubMode ? 'summary' : 'gateway');
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
        clearPendingPayment();
        closePayModal();
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

  const openCashfreeCheckout = useCallback(async () => {
    if (!payCheckout || payCheckout.checkout.stubMode) return;
    const { checkout } = payCheckout;
    const container = cashfreeContainerRef.current;

    setPayStep('gateway');
    setActionLoading(`pay-${checkout.invoice.id}`);

    try {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      const result = await runCashfreeCheckout({
        paymentSessionId: checkout.paymentSessionId,
        environment: checkout.environment,
        container,
      });

      if (result?.error) {
        showToast(result.error.message || 'Payment cancelled or failed', 'error');
        setActionLoading(null);
        return;
      }

      const verifyData = await verifyCashfreePayment(checkout.invoice.id, checkout.orderId);
      if (verifyData.success) {
        showToast('Payment received by platform. Supplier will be paid after verification.', 'success');
        clearPendingPayment();
        closePayModal();
        fetchData();
      } else {
        showToast(verifyData.message || 'Payment verification failed', 'error');
      }
    } catch {
      showToast('Could not load payment gateway', 'error');
    } finally {
      setActionLoading(null);
    }
  }, [payCheckout, fetchData, showToast]);

  useEffect(() => {
    if (payStep !== 'gateway' || !payCheckout || payCheckout.checkout.stubMode) return;
    if (checkoutStartedRef.current) return;
    checkoutStartedRef.current = true;
    openCashfreeCheckout();
  }, [payStep, payCheckout, openCashfreeCheckout]);

  useEffect(() => {
    const returnParams = readPaymentReturnParams();
    if (!returnParams) return;

    const pending = readPendingPayment();
    const invoiceId = returnParams.invoiceId || pending?.invoiceId || '';
    const orderId = returnParams.orderId || pending?.orderId || '';

    setActionLoading('payment-return');
    verifyCashfreePayment(invoiceId, orderId)
      .then((verifyData) => {
        if (verifyData.success) {
          showToast(verifyData.message || 'Payment received by platform.', 'success');
          clearPendingPayment();
          closePayModal();
          fetchData();
        } else if (verifyData.code === 'PAYMENT_PENDING') {
          showToast('Payment was not completed. You can try again from your order.', 'info');
        } else {
          showToast(verifyData.message || 'Payment verification failed', 'error');
        }
      })
      .catch(() => showToast('Payment verification failed', 'error'))
      .finally(() => {
        clearPaymentReturnQuery();
        setActionLoading(null);
      });
  }, [fetchData, showToast]);

  const handleAmendPO = async (orderId: string) => {
    const reason = window.prompt('Please enter the reason/terms for amending this Purchase Order:');
    if (!reason) return;

    setActionLoading(`amend-${orderId}`);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/v1/orders/${orderId}/amend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
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

  const [searchQuery, setSearchQuery] = useState('');

  const currentUser = user || (typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || 'null') : null);
  const isAdmin = currentUser?.role === 'PLATFORM_ADMIN';
  const isBuyerMode = mode === 'buyer';

  let filteredOrders = orders;
  if (!isAdmin) {
    filteredOrders = orders.filter((order) => order.flowType?.toLowerCase() === (isBuyerMode ? 'buying' : 'selling'));
  }

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    filteredOrders = filteredOrders.filter((order) =>
      order.poNumber?.toLowerCase().includes(q) ||
      order.buyerCompany?.name?.toLowerCase().includes(q) ||
      order.supplierCompany?.name?.toLowerCase().includes(q) ||
      order.status?.toLowerCase().includes(q)
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-extrabold tracking-tight text-[#001D4A]">
              {isBuyerMode ? 'Purchase Orders' : 'Sales Orders'}
            </h1>
            {isAdmin && (
              <span className={`px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider rounded-full border ${
                isBuyerMode
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}>
                Admin • {isBuyerMode ? 'Buyer Perspective' : 'Seller Perspective'}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {isAdmin
              ? (isBuyerMode
                  ? 'Supervising all platform orders through the Buyer perspective with milestone approvals, invoices, and payments.'
                  : 'Supervising all platform orders through the Seller perspective with manufacturing progress, proof uploads, and pickup.')
              : `Track milestones and status transitions for your ${isBuyerMode ? 'procured items and purchase orders' : 'sales orders and fulfilled deliveries'}`}
          </p>
        </div>
        <RefreshButton onRefresh={fetchData} />
      </div>

      {/* Search Input Bar */}
      <div className="relative w-full max-w-md">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search by PO#, Buyer, Supplier, or Status..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white border border-slate-200/90 rounded-xl pl-10 pr-9 py-2.5 text-xs text-slate-800 placeholder-slate-400 shadow-2xs focus:outline-none focus:border-blue-500 transition-all"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer font-bold"
          >
            ✕
          </button>
        )}
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {filteredOrders.length === 0 ? (
          <div className="py-16 text-center bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2.5" />
            <p className="text-sm font-semibold text-[#001D4A]">
              {searchQuery ? 'No orders match your search query.' : (isAdmin ? 'No platform orders found.' : `No active ${mode === 'buyer' ? 'buying' : 'selling'} orders found.`)}
            </p>
            <p className="text-xs text-slate-400 mt-1">Orders and milestone updates will appear here.</p>
          </div>
        ) : (
          filteredOrders.map((order: any) => {
            const isCardBuyer = !isAdmin ? order.flowType === 'Buying' : isBuyerMode;
            const showSellerActions = !isAdmin ? order.flowType === 'Selling' : !isBuyerMode;
            const showBuyerActions = !isAdmin ? order.flowType === 'Buying' : isBuyerMode;

            return (
            <div
              key={order.id}
              className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs hover:shadow-md hover:border-blue-200 transition-all grid grid-cols-1 md:grid-cols-4 gap-4 items-start md:items-center"
            >
              {/* Col 1: Meta & Counterparty */}
              <div>
                <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${isCardBuyer ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                    {isCardBuyer ? 'Buying' : 'Selling'}
                  </span>
                  {order.orderType === 'REPEAT' && (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                      Repeat
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400 font-semibold font-mono">{order.poNumber}</span>
                </div>
                {isAdmin ? (
                  <div className="mt-1.5 space-y-0.5">
                    {isCardBuyer ? (
                      <>
                        <div className="text-xs text-slate-700 font-medium truncate">
                          <span className="text-slate-400 text-[10px] font-semibold uppercase">Supplier:</span>{' '}
                          <strong className="text-emerald-700 text-xs font-bold">{order.supplierCompany?.name || 'Unknown Supplier'}</strong>
                        </div>
                        <div className="text-xs text-slate-500 font-medium truncate">
                          <span className="text-slate-400 text-[10px] font-semibold uppercase">Buyer:</span>{' '}
                          <strong className="text-[#001D4A] font-semibold">{order.buyerCompany?.name || 'Unknown Buyer'}</strong>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-xs text-slate-700 font-medium truncate">
                          <span className="text-slate-400 text-[10px] font-semibold uppercase">Buyer:</span>{' '}
                          <strong className="text-[#001D4A] text-xs font-bold">{order.buyerCompany?.name || 'Unknown Buyer'}</strong>
                        </div>
                        <div className="text-xs text-slate-500 font-medium truncate">
                          <span className="text-slate-400 text-[10px] font-semibold uppercase">Supplier:</span>{' '}
                          <strong className="text-emerald-700 font-semibold">{order.supplierCompany?.name || 'Unknown Supplier'}</strong>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <h4 className="font-bold text-sm text-[#001D4A] mt-1.5 leading-snug">
                    {order.flowType === 'Buying' ? `Supplier: ${order.supplierCompany?.name || 'Unknown Supplier'}` : `Buyer: ${order.buyerCompany?.name || 'Unknown Buyer'}`}
                  </h4>
                )}
              </div>

              {/* Col 2: Total Amount */}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Amount</span>
                <span className="font-extrabold text-base text-[#001D4A] mt-0.5 block">
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

              {/* Col 3: Status Milestone */}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Status Milestone</span>
                <div className="flex flex-col gap-1.5 mt-1">
                  {order.status === 'COMPLETED' || order.status === 'DELIVERED' ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold w-fit shadow-2xs">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                      {getFriendlyStatus(order.status)}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold w-fit shadow-2xs">
                      <Clock className="w-3.5 h-3.5 text-blue-600" />
                      {getFriendlyStatus(order.status)}
                    </span>
                  )}
                  
                  {/* Milestone Thumbnails */}
                  <div className="flex flex-wrap gap-2 mt-1">
                    {order.workImage20 && (
                      <div className="relative group shrink-0">
                        <img 
                          src={`/uploads/${order.workImage20}`} 
                          alt="20% Progress" 
                          className={`w-12 h-12 object-cover rounded-xl border-2 transition-all cursor-pointer shadow-2xs ${Number(order.milestoneApproved || 0) >= 20 ? 'border-emerald-500/60 hover:border-emerald-600' : 'border-slate-200 hover:border-blue-500'}`}
                          onClick={() => setLightbox({ src: `/uploads/${order.workImage20}`, label: '20% Manufacturing Proof' })}
                        />
                        <span className={`absolute -top-1.5 -right-1.5 px-1.5 py-0.2 rounded-full text-[8px] text-white font-bold flex items-center gap-0.5 shadow-2xs ${Number(order.milestoneApproved || 0) >= 20 ? 'bg-emerald-600' : 'bg-blue-600'}`}>
                          20% {Number(order.milestoneApproved || 0) >= 20 && <CheckCircle className="w-2 h-2" />}
                        </span>
                      </div>
                    )}
                    {order.workImage40 && (
                      <div className="relative group shrink-0">
                        <img 
                          src={`/uploads/${order.workImage40}`} 
                          alt="40% Progress" 
                          className={`w-12 h-12 object-cover rounded-xl border-2 transition-all cursor-pointer shadow-2xs ${Number(order.milestoneApproved || 0) >= 40 ? 'border-emerald-500/60 hover:border-emerald-600' : 'border-slate-200 hover:border-blue-500'}`}
                          onClick={() => setLightbox({ src: `/uploads/${order.workImage40}`, label: '40% Manufacturing Proof' })}
                        />
                        <span className={`absolute -top-1.5 -right-1.5 px-1.5 py-0.2 rounded-full text-[8px] text-white font-bold flex items-center gap-0.5 shadow-2xs ${Number(order.milestoneApproved || 0) >= 40 ? 'bg-emerald-600' : 'bg-blue-600'}`}>
                          40% {Number(order.milestoneApproved || 0) >= 40 && <CheckCircle className="w-2 h-2" />}
                        </span>
                      </div>
                    )}
                    {order.workImage60 && (
                      <div className="relative group shrink-0">
                        <img 
                          src={`/uploads/${order.workImage60}`} 
                          alt="60% Progress" 
                          className={`w-12 h-12 object-cover rounded-xl border-2 transition-all cursor-pointer shadow-2xs ${Number(order.milestoneApproved || 0) >= 60 ? 'border-emerald-500/60 hover:border-emerald-600' : 'border-slate-200 hover:border-blue-500'}`}
                          onClick={() => setLightbox({ src: `/uploads/${order.workImage60}`, label: '60% Manufacturing Proof' })}
                        />
                        <span className={`absolute -top-1.5 -right-1.5 px-1.5 py-0.2 rounded-full text-[8px] text-white font-bold flex items-center gap-0.5 shadow-2xs ${Number(order.milestoneApproved || 0) >= 60 ? 'bg-emerald-600' : 'bg-blue-600'}`}>
                          60% {Number(order.milestoneApproved || 0) >= 60 && <CheckCircle className="w-2 h-2" />}
                        </span>
                      </div>
                    )}
                    {order.workImage80 && (
                      <div className="relative group shrink-0">
                        <img 
                          src={`/uploads/${order.workImage80}`} 
                          alt="80% Progress" 
                          className={`w-12 h-12 object-cover rounded-xl border-2 transition-all cursor-pointer shadow-2xs ${Number(order.milestoneApproved || 0) >= 80 ? 'border-emerald-500/60 hover:border-emerald-600' : 'border-slate-200 hover:border-blue-500'}`}
                          onClick={() => setLightbox({ src: `/uploads/${order.workImage80}`, label: '80% Manufacturing Proof' })}
                        />
                        <span className={`absolute -top-1.5 -right-1.5 px-1.5 py-0.2 rounded-full text-[8px] text-white font-bold flex items-center gap-0.5 shadow-2xs ${Number(order.milestoneApproved || 0) >= 80 ? 'bg-emerald-600' : 'bg-blue-600'}`}>
                          80% {Number(order.milestoneApproved || 0) >= 80 && <CheckCircle className="w-2 h-2" />}
                        </span>
                      </div>
                    )}
                    {order.workImageId && (
                      <div className="relative group shrink-0">
                        <img 
                          src={`/uploads/${order.workImageId}`} 
                          alt="Pickup Progress" 
                          className="w-12 h-12 object-cover rounded-xl border-2 border-purple-500/40 hover:border-purple-600 transition-all cursor-pointer shadow-2xs"
                          onClick={() => setLightbox({ src: `/uploads/${order.workImageId}`, label: 'Ready for Pickup Proof' })}
                        />
                        <span className="absolute -top-1.5 -right-1.5 bg-purple-600 text-white px-1.5 py-0.2 rounded-full text-[8px] font-bold shadow-2xs">Pickup</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Col 4: Actions */}
              <div className="flex flex-col gap-2 items-stretch md:items-end w-full">
                {showSellerActions && (
                  <div className="flex flex-col gap-2 w-full">
                    {order.status === 'AWAITING_ACCEPTANCE' && (
                      <button
                        onClick={() => handleAcceptPo(order.id)}
                        disabled={actionLoading === `accept-${order.id}`}
                        className="py-2 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-emerald-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {actionLoading === `accept-${order.id}` ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Accepting...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-3.5 h-3.5" />
                            Accept PO
                          </>
                        )}
                      </button>
                    )}
                    {(order.status === 'CREATED' || order.status === 'ACCEPTED' || order.status === 'PROCESSING_20' || order.status === 'PROCESSING_40' || order.status === 'PROCESSING_60') && (
                      <div className="relative w-full">
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
                          className="w-full py-2 px-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          {uploadingOrderId === order.id ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Uploading Proof...
                            </>
                          ) : (
                            order.status === 'CREATED' || order.status === 'ACCEPTED' ? 'Start Processing (20%)' :
                            order.status === 'PROCESSING_20' ? 'Update Progress to 40%' :
                            order.status === 'PROCESSING_40' ? 'Update Progress to 60%' :
                            'Update Progress to 80%'
                          )}
                        </button>
                      </div>
                    )}
                    {order.status === 'PROCESSING_80' && (
                      <div className="relative w-full">
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
                          className="w-full py-2 px-3.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-purple-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
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
                        <div className="mt-2 text-xs bg-slate-50 border border-purple-200/80 rounded-xl p-3 text-slate-700 max-w-xs">
                          <span className="block font-bold text-purple-700 uppercase tracking-wider text-[10px] mb-1">Pickup OTP</span>
                          <div className="flex flex-col gap-1">
                            <span className="text-sm font-mono font-bold text-purple-700 bg-white border border-purple-200 px-2.5 py-1 rounded-lg w-fit shadow-2xs">
                              {order.deliveryOrder.pickupOtp}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              Share this OTP with the transporter when they arrive for pickup.
                            </span>
                          </div>
                        </div>
                      )}
                  </div>
                )}

                {showBuyerActions && (
                  <div className="flex flex-col gap-2 w-full">
                    {/* Buyer Milestone Approvals */}
                    {(order.status === 'ACCEPTED' || order.status === 'CREATED') && (
                      <button
                        onClick={() => handleAmendPO(order.id)}
                        disabled={actionLoading === `amend-${order.id}`}
                        className="py-2 px-3.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {actionLoading === `amend-${order.id}` && <ButtonSpinner />}
                        {actionLoading === `amend-${order.id}` ? 'Amending...' : 'Amend PO Terms'}
                      </button>
                    )}

                    {order.invoices?.map((inv: any) => (
                      inv.type === 'TAX_INVOICE' && (
                        <div key={inv.id} className="flex flex-col gap-2 w-full">
                          <button
                            type="button"
                            onClick={() => openInvoiceView(inv.id)}
                            disabled={loadingInvoice}
                            className="w-full py-2.5 px-3.5 bg-white hover:bg-slate-50 border border-slate-200 text-[#001D4A] rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-2xs transition-all cursor-pointer"
                          >
                            <FileText className="w-4 h-4 text-blue-600" />
                            View Invoice {inv.number}
                          </button>
                          {inv.status === 'UNPAID' && (
                            <button
                              onClick={() => handlePayInvoice(order, inv)}
                              disabled={actionLoading === `pay-${inv.id}`}
                              className="w-full py-2.5 px-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              {actionLoading === `pay-${inv.id}` && <ButtonSpinner />}
                              {actionLoading === `pay-${inv.id}` ? 'Processing...' : `Pay Platform ${formatInr(getPayableAmount(order))}`}
                            </button>
                          )}
                          {(inv.status === 'PAID' || inv.status === 'SETTLED') && (
                            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl inline-flex items-center justify-center gap-1 shadow-2xs self-end">
                              Paid to platform
                            </span>
                          )}
                        </div>
                      )
                    ))}

                    {(order.status === 'PROCESSING_20' && order.milestoneApproved !== '20') && (
                      <button onClick={() => handleApproveMilestone(order.id, '20')} disabled={actionLoading === `approve-${order.id}`} className="py-2 px-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5 cursor-pointer">
                        {actionLoading === `approve-${order.id}` && <ButtonSpinner />}
                        {actionLoading === `approve-${order.id}` ? 'Approving...' : 'Approve 20% Milestone'}
                      </button>
                    )}
                    {(order.status === 'PROCESSING_40' && order.milestoneApproved !== '40') && (
                      <button onClick={() => handleApproveMilestone(order.id, '40')} disabled={actionLoading === `approve-${order.id}`} className="py-2 px-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5 cursor-pointer">
                        {actionLoading === `approve-${order.id}` && <ButtonSpinner />}
                        {actionLoading === `approve-${order.id}` ? 'Approving...' : 'Approve 40% Milestone'}
                      </button>
                    )}
                    {(order.status === 'PROCESSING_60' && order.milestoneApproved !== '60') && (
                      <button onClick={() => handleApproveMilestone(order.id, '60')} disabled={actionLoading === `approve-${order.id}`} className="py-2 px-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5 cursor-pointer">
                        {actionLoading === `approve-${order.id}` && <ButtonSpinner />}
                        {actionLoading === `approve-${order.id}` ? 'Approving...' : 'Approve 60% Milestone'}
                      </button>
                    )}
                    {(order.status === 'PROCESSING_80' && order.milestoneApproved !== '80') && (
                      <button onClick={() => handleApproveMilestone(order.id, '80')} disabled={actionLoading === `approve-${order.id}`} className="py-2 px-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5 cursor-pointer">
                        {actionLoading === `approve-${order.id}` && <ButtonSpinner />}
                        {actionLoading === `approve-${order.id}` ? 'Approving...' : 'Approve 80% Milestone'}
                      </button>
                    )}

                    {order.status === 'DELIVERED' && (
                      <button
                        onClick={async () => {
                          setActionLoading(`confirm-${order.id}`);
                          try {
                            await handleConfirmDelivery(order.id);
                          } finally {
                            setActionLoading(null);
                          }
                        }}
                        disabled={actionLoading === `confirm-${order.id}`}
                        className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-emerald-500/20 flex items-center justify-center gap-1.5 cursor-pointer w-full"
                      >
                        {actionLoading === `confirm-${order.id}` && <ButtonSpinner />}
                        {actionLoading === `confirm-${order.id}` ? 'Confirming...' : 'Confirm Delivery (GRN)'}
                      </button>
                    )}

                    {order.status === 'COMPLETED' && !order.reviews?.length && (
                      <button
                        onClick={() => openReviewModal(order)}
                        className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 active:scale-95 cursor-pointer w-full"
                      >
                        <Sparkles className="w-4 h-4 text-white" /> Leave a Review
                      </button>
                    )}
                    
                    {/* Delivery OTP for buyer to give transporter at drop-off */}
                    {(order.deliveryOrder?.deliveryOtp || order.deliveryOrder?.otp) &&
                      (order.status === 'READY_FOR_PICKUP' ||
                        order.status === 'PICKED_UP' ||
                        order.status === 'IN_TRANSIT') && (
                       <div className="mt-2 text-xs bg-slate-50 border border-blue-200/80 rounded-xl p-3 text-slate-700 max-w-xs">
                          <span className="block font-bold text-blue-700 uppercase tracking-wider text-[10px] mb-1">Delivery OTP</span>
                          <div className="flex flex-col gap-1">
                            <span className="text-sm font-mono font-bold text-blue-700 bg-white border border-blue-200 px-2.5 py-1 rounded-lg w-fit shadow-2xs">
                              {order.deliveryOrder.deliveryOtp || order.deliveryOrder.otp}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              Provide this OTP to the transporter when you receive the order.
                            </span>
                          </div>
                       </div>
                    )}
                  </div>
                )}

                {showSellerActions && getSettlementInvoice(order) && (
                  <div className="flex flex-col gap-2 w-full mt-2">
                    {getSupplierPayoutLabel(order) && (
                      <span
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border max-w-xs text-right ${
                          order.supplierPayoutStatus === 'SETTLED'
                            ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                            : order.supplierPayoutStatus === 'PENDING_RELEASE'
                              ? 'text-amber-700 bg-amber-50 border-amber-200'
                              : 'text-slate-600 bg-slate-50 border-slate-200'
                        }`}
                      >
                        {getSupplierPayoutLabel(order)}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => openInvoiceView(getSettlementInvoice(order).id)}
                      disabled={loadingInvoice}
                      className="py-2 px-3.5 bg-white hover:bg-slate-50 border border-slate-200 text-[#001D4A] rounded-xl font-bold text-xs transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5 text-blue-600" />
                      View Settlement Invoice
                    </button>
                  </div>
                )}

                {showSellerActions && order.status === 'COMPLETED' && !getTaxInvoice(order) && (
                  <button
                    onClick={() => handleGenerateInvoice(order.id)}
                    disabled={actionLoading === `invoice-${order.id}`}
                    className="py-2 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-emerald-500/20 flex items-center justify-center gap-1.5 cursor-pointer w-full"
                  >
                    {actionLoading === `invoice-${order.id}` && <ButtonSpinner />}
                    {actionLoading === `invoice-${order.id}` ? 'Generating...' : 'Generate Invoices'}
                  </button>
                )}
              </div>
            </div>
          );
        })
      )}
      </div>

      {/* Image Lightbox Modal */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => setLightbox(null)}
        >
          <div
            className="relative max-w-2xl w-full bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
              <h3 className="text-sm font-bold text-[#001D4A]">{lightbox.label}</h3>
              <button
                onClick={() => setLightbox(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 flex items-center justify-center bg-slate-50">
              <img
                src={lightbox.src}
                alt={lightbox.label}
                className="max-w-full max-h-[65vh] object-contain rounded-lg shadow-2xs"
              />
            </div>
          </div>
        </div>
      )}

      {/* Payment checkout modal */}
      {payCheckout && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
          onClick={closePayModal}
        >
          <div
            className={`relative w-full bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xl p-6 text-slate-800 ${
              payStep === 'gateway' ? 'max-w-lg max-h-[92vh] overflow-y-auto' : 'max-w-md'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-[#001D4A]">Pay Platform</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Invoice {payCheckout.checkout.invoice.number}
                </p>
              </div>
              <button type="button" onClick={closePayModal} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {payStep === 'summary' && (
              <>
                <div className="space-y-3 text-sm mb-5">
                  <div className="p-3 rounded-xl bg-blue-50 border border-blue-200/80 text-blue-700 text-xs leading-relaxed">
                    {payCheckout.checkout.paymentNote}
                  </div>

                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-1">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Payee (Platform)</p>
                    <p className="text-sm font-bold text-[#001D4A]">{payCheckout.checkout.platform.name}</p>
                    <p className="text-xs text-slate-500">GSTIN: {payCheckout.checkout.platform.gstin}</p>
                    <p className="text-xs text-slate-500">State: {payCheckout.checkout.platform.state}</p>
                  </div>

                  {payCheckout.checkout.purchaseOrder && (
                    <div className="flex justify-between items-center bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 text-xs">
                      <span className="font-semibold text-slate-500">PO / Supplier</span>
                      <span className="text-right font-mono font-bold text-[#001D4A]">
                        {payCheckout.checkout.purchaseOrder.poNumber}
                        <span className="block text-slate-500 font-sans font-normal">
                          {payCheckout.checkout.purchaseOrder.supplierName}
                        </span>
                      </span>
                    </div>
                  )}

                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2 text-xs text-slate-600">
                    {payCheckout.checkout.invoice.goodsTaxable != null && (
                      <div className="flex justify-between">
                        <span>Goods value</span>
                        <span className="font-semibold text-slate-800">{formatInr(payCheckout.checkout.invoice.goodsTaxable)}</span>
                      </div>
                    )}
                    {payCheckout.checkout.invoice.commissionAmount > 0 && (
                      <div className="flex justify-between">
                        <span>Platform fee</span>
                        <span className="font-semibold text-slate-800">{formatInr(payCheckout.checkout.invoice.commissionAmount)}</span>
                      </div>
                    )}
                    {payCheckout.checkout.invoice.goodsTaxable == null && (
                      <div className="flex justify-between">
                        <span>Taxable</span>
                        <span className="font-semibold text-slate-800">{formatInr(payCheckout.checkout.invoice.taxable)}</span>
                      </div>
                    )}
                    {payCheckout.checkout.invoice.cgstAmount > 0 && (
                      <div className="flex justify-between text-slate-500">
                        <span>CGST on platform fee</span>
                        <span>{formatInr(payCheckout.checkout.invoice.cgstAmount)}</span>
                      </div>
                    )}
                    {payCheckout.checkout.invoice.sgstAmount > 0 && (
                      <div className="flex justify-between text-slate-500">
                        <span>SGST on platform fee</span>
                        <span>{formatInr(payCheckout.checkout.invoice.sgstAmount)}</span>
                      </div>
                    )}
                    {payCheckout.checkout.invoice.igstAmount > 0 && (
                      <div className="flex justify-between text-slate-500">
                        <span>IGST on platform fee</span>
                        <span>{formatInr(payCheckout.checkout.invoice.igstAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-sm font-extrabold text-[#001D4A] pt-2 border-t border-slate-200">
                      <span>Total payable</span>
                      <span>{formatInr(payCheckout.checkout.invoice.total)}</span>
                    </div>
                  </div>

                  {payCheckout.checkout.stubMode && (
                    <p className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px]">
                      Dev mode: Cashfree is not configured. Use simulated payment to mark this invoice paid.
                    </p>
                  )}
                </div>

                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={closePayModal}
                    className="flex-1 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  {payCheckout.checkout.stubMode ? (
                    <button
                      type="button"
                      onClick={confirmStubPayment}
                      disabled={actionLoading === `pay-${payCheckout.checkout.invoice.id}`}
                      className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-blue-500/20 cursor-pointer"
                    >
                      {actionLoading === `pay-${payCheckout.checkout.invoice.id}`
                        ? 'Processing...'
                        : `Confirm ${formatInr(payCheckout.checkout.invoice.total)}`}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        checkoutStartedRef.current = false;
                        setPayStep('gateway');
                      }}
                      disabled={actionLoading === `pay-${payCheckout.checkout.invoice.id}`}
                      className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-blue-500/20 cursor-pointer"
                    >
                      Continue to payment
                    </button>
                  )}
                </div>
              </>
            )}

            {payStep === 'gateway' && !payCheckout.checkout.stubMode && (
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs font-semibold text-slate-600">
                  <span>Secure payment ({payCheckout.checkout.environment})</span>
                  <span className="font-bold text-[#001D4A]">
                    {formatInr(payCheckout.checkout.invoice.total)}
                  </span>
                </div>
                <div
                  ref={cashfreeContainerRef}
                  className="min-h-[50vh] sm:min-h-[520px] w-full"
                />
                {actionLoading === `pay-${payCheckout.checkout.invoice.id}` && (
                  <div className="flex items-center justify-center gap-2 text-xs font-semibold text-blue-600 py-3">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Loading payment…</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    checkoutStartedRef.current = false;
                    setPayStep('summary');
                    if (cashfreeContainerRef.current) {
                      cashfreeContainerRef.current.innerHTML = '';
                    }
                  }}
                  className="w-full py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-all cursor-pointer"
                >
                  Back to summary
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Invoice View Modal */}
      {viewInvoice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => setViewInvoice(null)}
        >
          <div
            className="relative max-w-lg w-full bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xl p-6 text-slate-800 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-[#001D4A]">
                  {viewInvoice.type === 'SUPPLIER_PAYOUT' ? 'Settlement Invoice' : 'Tax Invoice'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">{viewInvoice.number}</p>
              </div>
              <button onClick={() => setViewInvoice(null)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {viewInvoice.paymentNote && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-800 text-xs mb-3">
                {viewInvoice.paymentNote}
              </div>
            )}

            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs">
                  <p className="text-[10px] uppercase font-bold text-slate-400">
                    {viewInvoice.sellerParty?.label || 'Seller'}
                  </p>
                  <p className="text-sm font-bold text-[#001D4A] mt-0.5">
                    {viewInvoice.sellerParty?.name || viewInvoice.supplierCompany?.name}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    GSTIN: {viewInvoice.sellerParty?.gstin || '—'}
                  </p>
                  <p className="text-xs text-slate-500">
                    State: {viewInvoice.sellerParty?.state || '—'}
                  </p>
                </div>
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs">
                  <p className="text-[10px] uppercase font-bold text-slate-400">
                    {viewInvoice.buyerParty?.label || 'Buyer'}
                  </p>
                  <p className="text-sm font-bold text-[#001D4A] mt-0.5">
                    {viewInvoice.buyerParty?.name || viewInvoice.buyerCompany?.name}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    GSTIN: {viewInvoice.buyerParty?.gstin || '—'}
                  </p>
                  <p className="text-xs text-slate-500">
                    State: {viewInvoice.buyerParty?.state || '—'}
                  </p>
                </div>
              </div>

              {/* Order Reference */}
              <div className="flex justify-between items-center bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs">
                <span className="text-slate-500 font-semibold">PO Number</span>
                <span className="font-mono font-bold text-[#001D4A]">{viewInvoice.purchaseOrder?.poNumber}</span>
              </div>

              {/* Breakdown */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2 text-xs text-slate-600">
                {viewInvoice.type === 'TAX_INVOICE' ? (
                  <>
                    <div className="flex justify-between">
                      <span>Goods taxable</span>
                      <span className="font-semibold text-slate-800">{formatInr(viewInvoice.goodsTaxable)}</span>
                    </div>
                    {viewInvoice.commissionAmount > 0 && (
                      <div className="flex justify-between">
                        <span>Platform fee</span>
                        <span className="font-semibold text-slate-800">{formatInr(viewInvoice.commissionAmount)}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex justify-between">
                    <span>Goods settlement</span>
                    <span className="font-semibold text-slate-800">{formatInr(viewInvoice.goodsTaxable ?? viewInvoice.taxable)}</span>
                  </div>
                )}
                {viewInvoice.cgstAmount > 0 && (
                  <div className="flex justify-between text-slate-500">
                    <span>CGST on platform fee</span>
                    <span>{formatInr(viewInvoice.cgstAmount)}</span>
                  </div>
                )}
                {viewInvoice.sgstAmount > 0 && (
                  <div className="flex justify-between text-slate-500">
                    <span>SGST on platform fee</span>
                    <span>{formatInr(viewInvoice.sgstAmount)}</span>
                  </div>
                )}
                {viewInvoice.igstAmount > 0 && (
                  <div className="flex justify-between text-slate-500">
                    <span>IGST on platform fee</span>
                    <span>{formatInr(viewInvoice.igstAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-sm font-extrabold text-[#001D4A] pt-2 border-t border-slate-200">
                  <span>Total</span>
                  <span>{formatInr(viewInvoice.total)}</span>
                </div>
              </div>

              {viewInvoice.irn && (
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200/80 text-blue-700 text-xs mb-3">
                  <p className="font-bold mb-1">E-Invoice (stub)</p>
                  <p>IRN: {viewInvoice.irn}</p>
                  <p>Ack: {viewInvoice.ackNo}</p>
                </div>
              )}

              <div className="flex justify-between items-center">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                  viewInvoice.status === 'SETTLED' || viewInvoice.status === 'PAID'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : viewInvoice.status === 'PENDING_RELEASE'
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}>
                  {viewInvoice.status === 'SETTLED' && viewInvoice.type === 'SUPPLIER_PAYOUT'
                    ? 'PAID TO SUPPLIER'
                    : viewInvoice.status}
                </span>
              </div>

              {viewInvoice.lines?.length > 0 && (
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
                  <p className="text-[10px] uppercase font-bold text-slate-400 mb-2">Line items</p>
                  <div className="space-y-2">
                    {viewInvoice.lines.map((line: any) => (
                      <div key={line.id} className="bg-white border border-slate-200/80 rounded-lg p-2.5 shadow-2xs">
                        <p className="text-xs font-semibold text-[#001D4A]">{line.description}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Qty {line.qty} × {formatInr(line.unitPrice)} = {formatInr(line.taxable)}
                          {line.taxAmount > 0 && (
                            <span className="text-slate-400"> (incl. GST {formatInr(line.taxAmount)})</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4" onClick={() => setReviewOrder(null)}>
          <div className="relative max-w-md w-full bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xl p-6 text-slate-800" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-[#001D4A]">Rate Supplier</h3>
              <button onClick={() => setReviewOrder(null)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Rating</label>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setReviewRating(num)}
                      className="p-1 rounded-lg transition-transform hover:scale-110 cursor-pointer"
                      aria-label={`Rate ${num} out of 5`}
                    >
                      <Star
                        className={`w-8 h-8 transition-colors ${
                          num <= reviewRating
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-slate-300 hover:text-amber-300'
                        }`}
                      />
                    </button>
                  ))}
                </div>
                <p className="text-xs font-medium text-slate-500 mt-1.5">{reviewRating} out of 5 stars</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Feedback</label>
                <select
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-[#001D4A] font-medium focus:outline-none focus:border-blue-500 focus:bg-white transition-all cursor-pointer"
                  value={reviewFeedback}
                  onChange={(e) => setReviewFeedback(e.target.value)}
                >
                  {SUPPLIER_FEEDBACK_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value} className="bg-white text-slate-800">
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Choose a preset message — no typing required.
                </p>
              </div>
              <button
                onClick={submitReview}
                disabled={actionLoading === `review-${reviewOrder.id}`}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:scale-98 disabled:opacity-50 text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                {actionLoading === `review-${reviewOrder.id}` && <ButtonSpinner className="w-4 h-4 text-white" />}
                {actionLoading === `review-${reviewOrder.id}` ? 'Submitting...' : 'Submit Review'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
