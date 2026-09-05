import { useState, useEffect } from 'react';
import { RefreshCw, Plus, ShoppingCart, Search, Building } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Supplier Catalog</h1>
          <p className="text-xs text-slate-400">
            {mode === 'seller' ? 'Manage your standard items available for direct purchase' : 'Browse and purchase standard supplier components directly'}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="p-2.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all flex items-center justify-center">
            <RefreshCw className="w-4 h-4 text-slate-300" />
          </button>
          {mode === 'seller' && (
            <Button variant="primary" onClick={() => setShowAddModal(true)}>
              <Plus className="w-4 h-4 mr-2" /> Add Item
            </Button>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-6">
        {catalogItems.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-500 text-sm">No catalog items found.</div>
        ) : (
          catalogItems.map((item: any) => (
            <Card key={item.id} className="flex flex-col justify-between space-y-4">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase">HSN: {item.hsnCode}</span>
                  {mode === 'buyer' && (
                    <span className="text-[9px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded font-bold">{item.supplierCompany?.name}</span>
                  )}
                </div>
                <h3 className="font-bold text-base text-white">{item.name}</h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">{item.description}</p>
                <div className="mt-4 pt-3 border-t border-white/5 flex justify-between items-center text-sm">
                  <span className="text-slate-400">Price:</span>
                  <span className="font-bold text-green-400">₹{(Number(item.unitPrice) / 100).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] mt-1 text-slate-500">
                  <span>Valid until:</span>
                  <span className="font-semibold text-slate-400">{new Date(item.validTo).toLocaleDateString()}</span>
                </div>
              </div>

              {mode === 'buyer' && (
                <button
                  onClick={() => {
                    setShowOrderModal(item);
                    setOrderQty(1);
                  }}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                >
                  <ShoppingCart className="w-4 h-4" /> Direct Buy
                </button>
              )}
            </Card>
          ))
        )}
      </div>

      {showAddModal && mode === 'seller' && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Add Catalog Item</h3>
            <form onSubmit={handleAddItem} className="space-y-4">
              <Input label="Item Name" required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. standard fastener M8" />
              <div className="grid grid-cols-2 gap-4">
                <Input label="HSN Code" required value={hsnCode} onChange={e => setHsnCode(e.target.value)} placeholder="84799090" />
                <Input label="Unit Price (₹)" type="number" min="0.01" step="0.01" required value={price} onChange={e => setPrice(Number(e.target.value))} />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Description</label>
                <textarea required value={desc} onChange={e => setDesc(e.target.value)} className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-blue-500" rows={3} />
              </div>
              <Input label="Valid For (Days)" type="number" min="1" required value={validToDays} onChange={e => setValidToDays(Number(e.target.value))} />
              <div className="flex gap-3 pt-4 border-t border-white/10 mt-6">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowAddModal(false)}>Cancel</Button>
                <Button type="submit" variant="primary" className="flex-1" disabled={loading}>
                  {loading ? 'Saving...' : 'Add Item'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showOrderModal && mode === 'buyer' && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Direct Purchase</h3>
            <div className="p-4 bg-slate-950 rounded-xl border border-white/5 mb-4">
              <h4 className="font-bold text-slate-200">{showOrderModal.name}</h4>
              <p className="text-xs text-slate-400 mt-1">{showOrderModal.supplierCompany?.name}</p>
              <div className="flex justify-between mt-3 text-sm">
                <span className="text-slate-400">Unit Price:</span>
                <span className="font-bold text-green-400">₹{(Number(showOrderModal.unitPrice) / 100).toLocaleString('en-IN')}</span>
              </div>
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-4">
              <Input label="Order Quantity" type="number" min={1} required value={orderQty} onChange={e => setOrderQty(Number(e.target.value))} />

              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                <div className="flex justify-between text-sm font-bold text-blue-400">
                  <span>Estimated Total:</span>
                  <span>₹{((orderQty * Number(showOrderModal.unitPrice) * 1.23) / 100).toLocaleString('en-IN')}</span>
                </div>
                <div className="text-[10px] text-slate-500 text-right mt-1">Includes 5% platform fee + GST on fee</div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-white/10 mt-6">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowOrderModal(null)}>Cancel</Button>
                <Button type="submit" variant="primary" className="flex-1" disabled={loading}>
                  {loading ? 'Processing...' : 'Create Order'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
