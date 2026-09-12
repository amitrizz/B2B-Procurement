import { useState, useEffect } from 'react';
import styles from './catalog.module.scss';
import { Plus, ShoppingCart, Search, Building } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { RefreshButton } from '@/components/ui/RefreshButton';
import { computeBuyerPricing, formatInrFromPaise } from '@/lib/platformPricing';

interface CatalogTabProps {
  catalogItems: any[];
  fetchData: () => Promise<void>;
  user: any;
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void;
  mode: 'buyer' | 'seller';
}

export default function CatalogTab({
  catalogItems,
  fetchData,
  user,
  showToast,
  mode
}: CatalogTabProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState<any>(null);

  // Add item state
  const [name, setName] = useState('');
  const [hsnCode, setHsnCode] = useState('');
  const [desc, setDesc] = useState('');
  const [price, setPrice] = useState(0);
  const [validToDays, setValidToDays] = useState(30);
  const [loading, setLoading] = useState(false);

  // Order state
  const [orderQty, setOrderQty] = useState(1);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const validToDate = new Date();
      validToDate.setDate(validToDate.getDate() + validToDays);

      const res = await fetch('/api/v1/catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          name,
          hsnCode,
          description: desc,
          unitPrice: price * 100, // convert to paise
          validTo: validToDate.toISOString()
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Item added to catalog', 'success');
        setShowAddModal(false);
        setName('');
        setHsnCode('');
        setDesc('');
        setPrice(0);
        setValidToDays(30);
        fetchData();
      } else {
        showToast(data.message || 'Failed to add item', 'error');
      }
    } catch (err) {
      showToast('Error adding item', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showOrderModal) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/orders/from-catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          catalogItems: [{
            catalogItemId: showOrderModal.id,
            quantity: orderQty
          }]
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Direct Purchase Order created successfully!', 'success');
        setShowOrderModal(null);
        setOrderQty(1);
      } else {
        showToast(data.message || 'Failed to create order', 'error');
      }
    } catch (err) {
      showToast('Error creating order', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles['catalog--space-y-6']}>
      <div className={styles['catalog--flex-justify-between-items-center']}>
        <div>
          <h1 className={styles['catalog--text-2xl-font-bold-tracking-tight']}>Supplier Catalog</h1>
          <p className={styles['catalog--text-xs-text-slate-400']}>
            {mode === 'seller' ? 'Manage your standard items available for direct purchase' : 'Browse and purchase standard supplier components directly'}
          </p>
        </div>
        <div className={styles['catalog--flex-gap-2']}>
          <RefreshButton onRefresh={fetchData} />
          {mode === 'seller' && (
            <Button variant="primary" onClick={() => setShowAddModal(true)}>
              <Plus className={styles['catalog--w-4-h-4-mr-2']} /> Add Item
            </Button>
          )}
        </div>
      </div>

      <div className={styles['catalog--grid-mdgrid-cols-3-lggrid-cols-4']}>
        {catalogItems.length === 0 ? (
          <div className={styles['catalog--col-span-full-py-12-text-center']}>No catalog items found.</div>
        ) : (
          catalogItems.map((item: any) => (
            <Card key={item.id} className={styles['catalog--flex-flex-col-justify-between']}>
              <div>
                <div className={styles['catalog--flex-justify-between-items-start']}>
                  <span className={styles['catalog--text-10px-text-slate-500-font-semibold']}>HSN: {item.hsnCode}</span>
                  {mode === 'buyer' && (
                    <span className={styles['catalog--text-9px-bg-blue-50010-text-blue-400']}>{item.supplierCompany?.name}</span>
                  )}
                </div>
                <h3 className={styles['catalog--font-bold-text-base-text-white']}>{item.name}</h3>
                <p className={styles['catalog--text-xs-text-slate-400-mt-1']}>{item.description}</p>
                <div className={styles['catalog--mt-4-pt-3-border-t']}>
                  <span className={styles['catalog--text-slate-400']}>Price:</span>
                  <span className={styles['catalog--font-bold-text-green-400']}>₹{(Number(item.unitPrice) / 100).toLocaleString('en-IN')}</span>
                </div>
                <div className={styles['catalog--flex-justify-between-items-center-1']}>
                  <span>Valid until:</span>
                  <span className={styles['catalog--font-semibold-text-slate-400']}>{new Date(item.validTo).toLocaleDateString()}</span>
                </div>
              </div>

              {mode === 'buyer' && (
                <button
                  onClick={() => {
                    setShowOrderModal(item);
                    setOrderQty(1);
                  }}
                  className={styles['catalog--w-full-py-2-bg-blue-600']}
                >
                  <ShoppingCart className={styles['catalog--w-4-h-4']} /> Direct Buy
                </button>
              )}
            </Card>
          ))
        )}
      </div>

      {showAddModal && mode === 'seller' && (
        <div className={styles['catalog--fixed-inset-0-bg-slate-95080']}>
          <div className={styles['catalog--bg-slate-900-border-border-white10']}>
            <h3 className={styles['catalog--text-lg-font-bold-text-white']}>Add Catalog Item</h3>
            <form onSubmit={handleAddItem} className={styles['catalog--space-y-4']}>
              <Input label="Item Name" required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. standard fastener M8" />
              <div className={styles['catalog--grid-grid-cols-2-gap-4']}>
                <Input label="HSN Code" required value={hsnCode} onChange={e => setHsnCode(e.target.value)} placeholder="84799090" />
                <Input label="Unit Price (₹)" type="number" min="0.01" step="0.01" required value={price} onChange={e => setPrice(Number(e.target.value))} />
              </div>
              <div>
                <label className={styles['catalog--block-text-10px-font-bold']}>Description</label>
                <textarea required value={desc} onChange={e => setDesc(e.target.value)} className={styles['catalog--w-full-bg-slate-950-border']} rows={3} />
              </div>
              <Input label="Valid For (Days)" type="number" min="1" required value={validToDays} onChange={e => setValidToDays(Number(e.target.value))} />
              <div className={styles['catalog--flex-gap-3-pt-4']}>
                <Button type="button" variant="secondary" className={styles['catalog--flex-1']} onClick={() => setShowAddModal(false)}>Cancel</Button>
                <Button type="submit" variant="primary" className={styles['catalog--flex-1-1']} loading={loading} disabled={loading}>
                  Add Item
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showOrderModal && mode === 'buyer' && (
        <div className={styles['catalog--fixed-inset-0-bg-slate-95080-1']}>
          <div className={styles['catalog--bg-slate-900-border-border-white10-1']}>
            <h3 className={styles['catalog--text-lg-font-bold-text-white-1']}>Direct Purchase</h3>
            <div className={styles['catalog--p-4-bg-slate-950-rounded-xl']}>
              <h4 className={styles['catalog--font-bold-text-slate-200']}>{showOrderModal.name}</h4>
              <p className={styles['catalog--text-xs-text-slate-400-mt-1-1']}>{showOrderModal.supplierCompany?.name}</p>
              <div className={styles['catalog--flex-justify-between-mt-3']}>
                <span className={styles['catalog--text-slate-400-1']}>Unit Price:</span>
                <span className={styles['catalog--font-bold-text-green-400-1']}>₹{(Number(showOrderModal.unitPrice) / 100).toLocaleString('en-IN')}</span>
              </div>
            </div>

            <form onSubmit={handleCreateOrder} className={styles['catalog--space-y-4-1']}>
              <Input label="Order Quantity" type="number" min={1} required value={orderQty} onChange={e => setOrderQty(Number(e.target.value))} />

              <div className={styles['catalog--p-3-bg-blue-50010-border']}>
                {(() => {
                  const goodsPaise = orderQty * Number(showOrderModal.unitPrice);
                  const pricing = computeBuyerPricing(goodsPaise);
                  return (
                    <>
                      <div className={styles['catalog--flex-justify-between-text-sm']}>
                        <span>Estimated Total:</span>
                        <span>₹{formatInrFromPaise(pricing.buyerTotalPaise)}</span>
                      </div>
                      <div className={styles['catalog--text-10px-text-slate-500-text-right']}>
                        Quote ₹{formatInrFromPaise(pricing.goodsPaise)} + platform fee ₹{formatInrFromPaise(pricing.commissionPaise)} + GST ₹{formatInrFromPaise(pricing.feeGstPaise)}
                      </div>
                    </>
                  );
                })()}
              </div>

              <div className={styles['catalog--flex-gap-3-pt-4-1']}>
                <Button type="button" variant="secondary" className={styles['catalog--flex-1-2']} onClick={() => setShowOrderModal(null)}>Cancel</Button>
                <Button type="submit" variant="primary" className={styles['catalog--flex-1-3']} loading={loading} disabled={loading}>
                  Create Order
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
