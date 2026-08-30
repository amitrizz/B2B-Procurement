import { useState } from 'react';
import { RefreshCw, CheckCircle } from 'lucide-react';

interface LocalDeliveryTabProps {
  deliveries: any[];
  fetchData: () => Promise<void>;
  handleUpdateDeliveryStatus: (deliveryId: string, nextStatus: string) => Promise<void>;
}

export default function LocalDeliveryTab({
  deliveries,
  fetchData,
  handleUpdateDeliveryStatus
}: LocalDeliveryTabProps) {
  const [deliveryOtp, setDeliveryOtp] = useState<{ [key: string]: string }>({});
  const [errorMap, setErrorMap] = useState<{ [key: string]: string }>({});

  const handleDeliver = (del: any) => {
    const input = deliveryOtp[del.id];
    if (!input || input !== del.otpHash) {
       setErrorMap({ ...errorMap, [del.id]: 'Invalid OTP. Please ask the supplier.' });
       return;
    }
    setErrorMap({ ...errorMap, [del.id]: '' });
    handleUpdateDeliveryStatus(del.id, 'DELIVERED');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Local Transporter Portal</h1>
          <p className="text-xs text-slate-400">Accept and fulfill delivery assignments in your service area</p>
        </div>
        <button onClick={fetchData} className="p-2.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all flex items-center justify-center">
          <RefreshCw className="w-4 h-4 text-slate-300" />
        </button>
      </div>

      <div className="space-y-4">
        {deliveries.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">No delivery orders generated yet.</div>
        ) : (
          deliveries.map((del: any) => (
            <div key={del.id} className="glass-card rounded-2xl p-5 border border-white/5 grid md:grid-cols-4 gap-4 items-center">
              <div>
                <span className="text-[10px] text-slate-500 font-semibold">{del.deliveryNumber}</span>
                <h4 className="font-bold text-sm text-white mt-1">From: {del.purchaseOrder.supplierCompany.name}</h4>
                <p className="text-[10px] text-slate-400">To: {del.purchaseOrder.buyerCompany.name}</p>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 font-semibold block uppercase">Status</span>
                <span className="text-xs font-semibold text-purple-400 mt-1 block">{del.status}</span>
              </div>

              <div className="flex md:col-span-2 justify-end gap-2">
                {del.status === 'CREATED' && (
                  <button
                    onClick={() => handleUpdateDeliveryStatus(del.id, 'ACCEPTED')}
                    className="py-1.5 px-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold"
                  >
                    Accept Assignment
                  </button>
                )}
                {del.status === 'ACCEPTED' && (
                  <button
                    onClick={() => handleUpdateDeliveryStatus(del.id, 'PICKED_UP')}
                    className="py-1.5 px-3.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold"
                  >
                    Mark Picked Up
                  </button>
                )}
                {del.status === 'PICKED_UP' && (
                  <div className="flex flex-col gap-2 items-end">
                    <div className="flex gap-2 items-center">
                      <input 
                        type="text" 
                        placeholder="Enter 6-digit OTP" 
                        className="bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none w-32 focus:border-green-500"
                        value={deliveryOtp[del.id] || ''}
                        onChange={(e) => setDeliveryOtp({ ...deliveryOtp, [del.id]: e.target.value })}
                        maxLength={6}
                      />
                      <button
                        onClick={() => handleDeliver(del)}
                        className="py-1.5 px-3.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Mark Delivered
                      </button>
                    </div>
                    {errorMap[del.id] && <span className="text-red-400 text-[10px]">{errorMap[del.id]}</span>}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
