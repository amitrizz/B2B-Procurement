import { useState } from 'react';
import styles from './delivery.module.scss';
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
    <div className={styles['delivery--space-y-6']}>
      <div className={styles['delivery--flex-flex-col-smflex-row']}>
        <div>
          <h1 className={styles['delivery--text-xl-smtext-2xl-font-bold']}>Local Transporter Portal</h1>
          <p className={styles['delivery--text-xs-text-slate-400']}>
            Pickup and delivery require OTP verification from supplier and buyer
          </p>
        </div>
        <RefreshButton onRefresh={fetchData} />
      </div>

      <div className={styles['delivery--space-y-4']}>
        {deliveries.length === 0 ? (
          <div className={styles['delivery--py-12-text-center-text-slate-500']}>No delivery orders generated yet.</div>
        ) : (
          deliveries.map((del: any) => (
            <div
              key={del.id}
              className={`glass-card glass-card ${styles['delivery--glass-card-rounded-2xl-p-4']}`}
            >
              <div className={styles['delivery--mdcol-span-2']}>
                <div className={styles['delivery--flex-items-center-gap-2']}>
                  <span className={styles['delivery--text-10px-text-slate-500-font-semibold']}>{del.deliveryNumber}</span>
                  {(del.purpose === 'SAMPLE' || del.purchaseOrder?.orderType === 'SAMPLE') && (
                    <span className={styles['delivery--text-9px-px-2-py-05']}>
                      Sample pickup
                    </span>
                  )}
                </div>
                <div className={styles['delivery--grid-grid-cols-1-smgrid-cols-2']}>
                  <div>
                    <h4 className={styles['delivery--font-bold-text-sm-text-white']}>Pickup From:</h4>
                    <span className={styles['delivery--text-xs-text-slate-200-block']}>{del.purchaseOrder?.supplierCompany?.name}</span>
                    <p className={styles['delivery--text-10px-text-slate-400-mt-05']}>
                      {del.purchaseOrder?.supplierCompany?.address || 'Address not provided'}
                    </p>
                  </div>
                  <div>
                    <h4 className={styles['delivery--font-bold-text-sm-text-white-1']}>Deliver To:</h4>
                    <span className={styles['delivery--text-xs-text-slate-200-block-1']}>{del.purchaseOrder?.buyerCompany?.name}</span>
                    <p className={styles['delivery--text-10px-text-slate-400-mt-05-1']}>
                      {del.purchaseOrder?.buyerCompany?.address || 'Address not provided'}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <span className={styles['delivery--text-10px-text-slate-500-font-semibold-1']}>Status</span>
                <span className={styles['delivery--text-xs-font-semibold-text-purple-400']}>{del.status}</span>
              </div>

              <div className={styles['delivery--flex-flex-col-items-stretch']}>
                {del.status === 'CREATED' && (
                  <ActionButton
                    onClick={() => handleUpdateDeliveryStatus(del.id, 'ACCEPTED')}
                    disabled={loadingId === del.id}
                    className={styles['delivery--w-full-smw-auto']}
                  >
                    Accept Assignment
                  </ActionButton>
                )}

                {del.status === 'ACCEPTED' && (
                  <>
                    {del.requiresPickupOtp ? (
                      <div className={styles['delivery--flex-flex-col-gap-2']}>
                        <p className={styles['delivery--text-10px-text-slate-400-text-right']}>
                          Enter Pickup OTP from supplier
                        </p>
                        <div className={styles['delivery--flex-flex-col-smflex-row-1']}>
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="Pickup OTP"
                            className={styles['delivery--bg-slate-900-border-border-white10']}
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
                            className={styles['delivery--w-full-smw-auto-1']}
                          >
                            {!loadingId && <CheckCircle className={styles['delivery--w-35-h-35']} />}
                            Verify & Pick Up
                          </ActionButton>
                        </div>
                      </div>
                    ) : (
                      <ActionButton
                        variant="purple"
                        onClick={() => handleUpdateDeliveryStatus(del.id, 'PICKED_UP')}
                        disabled={loadingId === del.id}
                        className={styles['delivery--w-full-smw-auto-2']}
                      >
                        Mark Picked Up
                      </ActionButton>
                    )}
                  </>
                )}

                {(del.status === 'PICKED_UP' || del.status === 'IN_TRANSIT') && (
                  <div className={styles['delivery--flex-flex-col-gap-2-1']}>
                    <p className={styles['delivery--text-10px-text-slate-400-text-right-1']}>
                      Enter Delivery OTP from buyer + upload POD photo
                    </p>
                    <div className={styles['delivery--flex-flex-col-smflex-row-2']}>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="Delivery OTP"
                        className={styles['delivery--bg-slate-900-border-border-white10-1']}
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
                          <Upload className={styles['delivery--w-35-h-35-1']} />
                        )}
                        POD Photo
                        <input
                          type="file"
                          accept="image/*"
                          className={styles['delivery--hidden']}
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
                  <span className={styles['delivery--text-red-400-text-10px-text-right']}>{errorMap[del.id]}</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
