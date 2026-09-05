import { useState } from 'react';
import { CheckCircle, Loader2, Upload } from 'lucide-react';
import { RefreshButton } from '@/components/ui/RefreshButton';
import { ActionButton, ButtonSpinner } from '@/components/ui/ActionButton';

interface LocalDeliveryTabProps {
  deliveries: any[];
  fetchData: () => Promise<void>;
  handleUpdateDeliveryStatus: (deliveryId: string, nextStatus: string) => Promise<boolean | void>;
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
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Local Transporter Portal</h1>
          <p className="text-xs text-slate-400">
            Pickup and delivery require OTP verification from supplier and buyer
          </p>
        </div>
        <RefreshButton onRefresh={fetchData} />
      </div>

      <div className="space-y-4">
        {deliveries.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">No delivery orders generated yet.</div>
        ) : (
          deliveries.map((del: any) => (
            <div
              key={del.id}
              className="glass-card rounded-2xl p-4 sm:p-5 border border-white/5 grid grid-cols-1 md:grid-cols-4 gap-4 items-start md:items-center"
            >
              <div className="md:col-span-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 font-semibold">{del.deliveryNumber}</span>
                  {(del.purpose === 'SAMPLE' || del.purchaseOrder?.orderType === 'SAMPLE') && (
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold uppercase">
                      Sample pickup
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-1">
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

              <div className="flex flex-col items-stretch sm:items-end gap-2 w-full">
                {del.status === 'CREATED' && (
                  <ActionButton
                    onClick={() => handleUpdateDeliveryStatus(del.id, 'ACCEPTED')}
                    disabled={loadingId === del.id}
                    className="w-full sm:w-auto"
                  >
                    Accept Assignment
                  </ActionButton>
                )}

                {del.status === 'ACCEPTED' && (
                  <>
                    {del.requiresPickupOtp ? (
                      <div className="flex flex-col gap-2 items-end w-full">
                        <p className="text-[10px] text-slate-400 text-right">
                          Enter Pickup OTP from supplier
                        </p>
                        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center w-full">
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="Pickup OTP"
                            className="bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none w-full sm:w-28 focus:border-purple-500"
                            value={pickupOtp[del.id] || ''}
                            onChange={(e) =>
                              setPickupOtp({ ...pickupOtp, [del.id]: e.target.value.replace(/\D/g, '').slice(0, 6) })
                            }
                            maxLength={6}
                            disabled={loadingId === del.id}
                          />
                          <ActionButton
                            variant="purple"
                            onClick={() => verifyPickup(del)}
                            disabled={loadingId === del.id}
                            className="w-full sm:w-auto"
                          >
                            {!loadingId && <CheckCircle className="w-3.5 h-3.5" />}
                            Verify & Pick Up
                          </ActionButton>
                        </div>
                      </div>
                    ) : (
                      <ActionButton
                        variant="purple"
                        onClick={() => handleUpdateDeliveryStatus(del.id, 'PICKED_UP')}
                        disabled={loadingId === del.id}
                        className="w-full sm:w-auto"
                      >
                        Mark Picked Up
                      </ActionButton>
                    )}
                  </>
                )}

                {(del.status === 'PICKED_UP' || del.status === 'IN_TRANSIT') && (
                  <div className="flex flex-col gap-2 items-end w-full">
                    <p className="text-[10px] text-slate-400 text-right">
                      Enter Delivery OTP from buyer + upload POD photo
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center w-full">
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="Delivery OTP"
                        className="bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none w-full sm:w-28 focus:border-green-500"
                        value={deliveryOtp[del.id] || ''}
                        onChange={(e) =>
                          setDeliveryOtp({
                            ...deliveryOtp,
                            [del.id]: e.target.value.replace(/\D/g, '').slice(0, 6),
                          })
                        }
                        maxLength={6}
                        disabled={loadingId === del.id || uploadingPodId === del.id}
                      />
                      <label
                        className={`py-1.5 px-3.5 bg-slate-800 hover:bg-slate-700 border border-white/10 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 w-full sm:w-auto ${
                          uploadingPodId === del.id || loadingId === del.id
                            ? 'opacity-60 cursor-not-allowed pointer-events-none'
                            : 'cursor-pointer'
                        }`}
                      >
                        {uploadingPodId === del.id || loadingId === del.id ? (
                          <ButtonSpinner />
                        ) : (
                          <Upload className="w-3.5 h-3.5" />
                        )}
                        POD Photo
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={uploadingPodId === del.id || loadingId === del.id}
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
