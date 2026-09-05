import { useState } from 'react';
import { RefreshCw, CheckCircle, Loader2, Upload } from 'lucide-react';

interface LocalDeliveryTabProps {
  deliveries: any[];
  fetchData: () => Promise<void>;
  handleUpdateDeliveryStatus: (deliveryId: string, nextStatus: string) => Promise<void>;
  handleVerifyDeliveryOtp: (
    deliveryId: string,
    otp: string,
    type: 'PICKUP' | 'DELIVERY',
    podFileId?: string
  ) => Promise<boolean>;
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export default function LocalDeliveryTab({
  deliveries,
  fetchData,
  handleUpdateDeliveryStatus,
  handleVerifyDeliveryOtp,
  showToast,
}: LocalDeliveryTabProps) {
  const [pickupOtp, setPickupOtp] = useState<Record<string, string>>({});
  const [deliveryOtp, setDeliveryOtp] = useState<Record<string, string>>({});
  const [errorMap, setErrorMap] = useState<Record<string, string>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [uploadingPodId, setUploadingPodId] = useState<string | null>(null);

  const verifyPickup = async (del: any) => {
    const input = pickupOtp[del.id]?.trim();
    if (!input || input.length !== 6) {
      setErrorMap({ ...errorMap, [del.id]: 'Enter the 6-digit Pickup OTP from the supplier.' });
      return;
    }
    setLoadingId(del.id);
    setErrorMap({ ...errorMap, [del.id]: '' });
    const ok = await handleVerifyDeliveryOtp(del.id, input, 'PICKUP');
    setLoadingId(null);
    if (!ok) {
      setErrorMap({ ...errorMap, [del.id]: 'Invalid Pickup OTP. Ask the supplier.' });
    }
  };

  const uploadPodAndDeliver = async (del: any, file: File) => {
    const input = deliveryOtp[del.id]?.trim();
    if (!input || input.length !== 6) {
      setErrorMap({ ...errorMap, [del.id]: 'Enter the 6-digit Delivery OTP from the buyer.' });
      return;
    }

    setUploadingPodId(del.id);
    setErrorMap({ ...errorMap, [del.id]: '' });

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);

      const uploadRes = await fetch('/api/v1/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const uploadData = await uploadRes.json();
      if (!uploadData.success) {
        showToast(uploadData.message || 'POD upload failed', 'error');
        return;
      }

      setLoadingId(del.id);
      const ok = await handleVerifyDeliveryOtp(del.id, input, 'DELIVERY', uploadData.data.filename);
      if (!ok) {
        setErrorMap({ ...errorMap, [del.id]: 'Invalid Delivery OTP. Ask the buyer.' });
      }
    } catch {
      showToast('Failed to upload proof of delivery', 'error');
    } finally {
      setLoadingId(null);
      setUploadingPodId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Local Transporter Portal</h1>
          <p className="text-xs text-slate-400">
            Pickup and delivery require OTP verification from supplier and buyer
          </p>
        </div>
        <button
          onClick={fetchData}
          className="p-2.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all flex items-center justify-center"
        >
          <RefreshCw className="w-4 h-4 text-slate-300" />
        </button>
      </div>

      <div className="space-y-4">
        {deliveries.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">No delivery orders generated yet.</div>
        ) : (
          deliveries.map((del: any) => (
            <div
              key={del.id}
              className="glass-card rounded-2xl p-5 border border-white/5 grid md:grid-cols-4 gap-4 items-center"
            >
              <div className="md:col-span-2">
                <span className="text-[10px] text-slate-500 font-semibold">{del.deliveryNumber}</span>
                <div className="grid grid-cols-2 gap-4 mt-1">
                  <div>
                    <h4 className="font-bold text-sm text-white">Pickup From:</h4>
                    <span className="text-xs text-slate-200 block">{del.purchaseOrder?.supplierCompany?.name}</span>
                    <p className="text-[10px] text-slate-400 mt-0.5 whitespace-pre-wrap">
                      {del.purchaseOrder?.supplierCompany?.address || 'Address not provided'}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white">Deliver To:</h4>
                    <span className="text-xs text-slate-200 block">{del.purchaseOrder?.buyerCompany?.name}</span>
                    <p className="text-[10px] text-slate-400 mt-0.5 whitespace-pre-wrap">
                      {del.purchaseOrder?.buyerCompany?.address || 'Address not provided'}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 font-semibold block uppercase">Status</span>
                <span className="text-xs font-semibold text-purple-400 mt-1 block">{del.status}</span>
              </div>

              <div className="flex flex-col items-end gap-2">
                {del.status === 'CREATED' && (
                  <button
                    onClick={() => handleUpdateDeliveryStatus(del.id, 'ACCEPTED')}
                    disabled={loadingId === del.id}
                    className="py-1.5 px-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold"
                  >
                    Accept Assignment
                  </button>
                )}

                {del.status === 'ACCEPTED' && (
                  <>
                    {del.requiresPickupOtp ? (
                      <div className="flex flex-col gap-2 items-end w-full">
                        <p className="text-[10px] text-slate-400 text-right">
                          Enter Pickup OTP from supplier
                        </p>
                        <div className="flex gap-2 items-center">
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="Pickup OTP"
                            className="bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none w-28 focus:border-purple-500"
                            value={pickupOtp[del.id] || ''}
                            onChange={(e) =>
                              setPickupOtp({ ...pickupOtp, [del.id]: e.target.value.replace(/\D/g, '').slice(0, 6) })
                            }
                            maxLength={6}
                          />
                          <button
                            onClick={() => verifyPickup(del)}
                            disabled={loadingId === del.id}
                            className="py-1.5 px-3.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white rounded-lg text-xs font-bold flex items-center gap-1.5"
                          >
                            {loadingId === del.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle className="w-3.5 h-3.5" />
                            )}
                            Verify & Pick Up
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleUpdateDeliveryStatus(del.id, 'PICKED_UP')}
                        className="py-1.5 px-3.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold"
                      >
                        Mark Picked Up
                      </button>
                    )}
                  </>
                )}

                {(del.status === 'PICKED_UP' || del.status === 'IN_TRANSIT') && (
                  <div className="flex flex-col gap-2 items-end w-full">
                    <p className="text-[10px] text-slate-400 text-right">
                      Enter Delivery OTP from buyer + upload POD photo
                    </p>
                    <div className="flex gap-2 items-center flex-wrap justify-end">
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="Delivery OTP"
                        className="bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none w-28 focus:border-green-500"
                        value={deliveryOtp[del.id] || ''}
                        onChange={(e) =>
                          setDeliveryOtp({
                            ...deliveryOtp,
                            [del.id]: e.target.value.replace(/\D/g, '').slice(0, 6),
                          })
                        }
                        maxLength={6}
                      />
                      <label className="py-1.5 px-3.5 bg-slate-800 hover:bg-slate-700 border border-white/10 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer">
                        {uploadingPodId === del.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Upload className="w-3.5 h-3.5" />
                        )}
                        POD Photo
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadPodAndDeliver(del, file);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    </div>
                  </div>
                )}

                {errorMap[del.id] && (
                  <span className="text-red-400 text-[10px] text-right">{errorMap[del.id]}</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
