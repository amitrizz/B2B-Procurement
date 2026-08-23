import { useState } from 'react';
import { RefreshCw, Clock, Image as ImageIcon, Loader2 } from 'lucide-react';

interface PurchaseOrdersTabProps {
  orders: any[];
  fetchData: () => Promise<void>;
  handleStartProcessing: (orderId: string) => Promise<void>;
  handleReadyForPickup: (orderId: string, workImageId: string) => Promise<void>;
  handleConfirmDelivery: (orderId: string) => Promise<void>;
}

export default function PurchaseOrdersTab({
  orders,
  fetchData,
  handleStartProcessing,
  handleReadyForPickup,
  handleConfirmDelivery
}: PurchaseOrdersTabProps) {
  const [uploadingOrderId, setUploadingOrderId] = useState<string | null>(null);

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

  const handleUploadWorkImage = async (e: React.ChangeEvent<HTMLInputElement>, orderId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingOrderId(orderId);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/v1/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        // Call the ready-for-pickup handler passing the uploaded file ID
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
        {orders.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">No active purchase orders found.</div>
        ) : (
          orders.map((order: any) => (
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
                <span className="font-bold text-sm text-slate-200 mt-1 block">₹{Number(order.totalAmount).toLocaleString()}</span>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 font-semibold block uppercase">Status Milestone</span>
                <span className="text-xs font-semibold text-blue-400 flex flex-col gap-1 mt-1">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
                    {getFriendlyStatus(order.status)}
                  </span>
                  {order.workImageId && (
                    <a
                      href={`/uploads/${order.workImageId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-purple-400 hover:text-purple-300 underline flex items-center gap-1 mt-0.5"
                    >
                      <ImageIcon className="w-3 h-3" /> View Work Proof Image
                    </a>
                  )}
                </span>
              </div>

              <div className="flex justify-end gap-2">
                {order.flowType === 'Selling' && (
                  <>
                    {order.status === 'CREATED' && (
                      <button
                        onClick={() => handleStartProcessing(order.id)}
                        className="py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all active:scale-95"
                      >
                        Start Processing (20%)
                      </button>
                    )}
                    {order.status === 'PROCESSING_20' && (
                      <button
                        onClick={() => handleStartProcessing(order.id)}
                        className="py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all active:scale-95"
                      >
                        Update Progress to 40%
                      </button>
                    )}
                    {order.status === 'PROCESSING_40' && (
                      <button
                        onClick={() => handleStartProcessing(order.id)}
                        className="py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all active:scale-95"
                      >
                        Update Progress to 60%
                      </button>
                    )}
                    {order.status === 'PROCESSING_60' && (
                      <button
                        onClick={() => handleStartProcessing(order.id)}
                        className="py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all active:scale-95"
                      >
                        Update Progress to 80%
                      </button>
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

                {order.flowType === 'Buying' && order.status === 'DELIVERED' && (
                  <button
                    onClick={() => handleConfirmDelivery(order.id)}
                    className="py-1.5 px-3 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition-all active:scale-95"
                  >
                    Confirm Delivery
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
