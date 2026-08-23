import { RefreshCw, Clock } from 'lucide-react';

interface PurchaseOrdersTabProps {
  orders: any[];
  fetchData: () => Promise<void>;
  handleStartProcessing: (orderId: string) => Promise<void>;
  handleReadyForPickup: (orderId: string) => Promise<void>;
  handleConfirmDelivery: (orderId: string) => Promise<void>;
}

export default function PurchaseOrdersTab({
  orders,
  fetchData,
  handleStartProcessing,
  handleReadyForPickup,
  handleConfirmDelivery
}: PurchaseOrdersTabProps) {
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
                <h4 className="font-bold text-sm text-white mt-1.5">
                  {order.flowType === 'Buying' ? `Supplier: ${order.supplierCompany.name}` : `Buyer: ${order.buyerCompany.name}`}
                </h4>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 font-semibold block uppercase">Total Amount</span>
                <span className="font-bold text-sm text-slate-200 mt-1 block">₹{Number(order.totalAmount).toLocaleString()}</span>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 font-semibold block uppercase">Status Milestone</span>
                <span className="text-xs font-semibold text-blue-400 flex items-center gap-1.5 mt-1">
                  <Clock className="w-3.5 h-3.5" />
                  {order.status}
                </span>
              </div>

              <div className="flex justify-end gap-2">
                {order.flowType === 'Selling' && order.status === 'CREATED' && (
                  <button
                    onClick={() => handleStartProcessing(order.id)}
                    className="py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all"
                  >
                    Start Processing
                  </button>
                )}
                {order.flowType === 'Selling' && order.status === 'SUPPLIER_PROCESSING' && (
                  <button
                    onClick={() => handleReadyForPickup(order.id)}
                    className="py-1.5 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-all"
                  >
                    Ready for Pickup
                  </button>
                )}
                {order.flowType === 'Buying' && order.status === 'DELIVERED' && (
                  <button
                    onClick={() => handleConfirmDelivery(order.id)}
                    className="py-1.5 px-3 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition-all"
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
