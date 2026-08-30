'use client';

import React, { useState } from 'react';
import { Package, Plus, Loader2 } from 'lucide-react';

interface StandardCatalogTabProps {
  user: any;
  companyComponents: any[];
  companyCategories: any[];
  fetchData: () => void;
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export default function StandardCatalogTab({ user, companyComponents, companyCategories, fetchData, showToast }: StandardCatalogTabProps) {
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  
  const [newComponentName, setNewComponentName] = useState('');
  const [newComponentDesc, setNewComponentDesc] = useState('');
  const [newComponentUnit, setNewComponentUnit] = useState('pcs');

  const handleAddComponent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComponentName.trim()) {
      showToast('Component Name is required', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/v1/company/components', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          componentName: newComponentName,
          description: newComponentDesc,
          defaultUnit: newComponentUnit
        })
      });
      
      const d = await res.json();
      if (d.success) {
        showToast('Component added to standard catalog!', 'success');
        setShowAddModal(false);
        setNewComponentName('');
        setNewComponentDesc('');
        setNewComponentUnit('pcs');
        fetchData(); // Refresh the list
      } else {
        showToast(d.message || 'Failed to add component', 'error');
      }
    } catch (err) {
      showToast('Failed to connect to server', 'error');
    } finally {
      setLoading(false);
    }
  };

  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDesc, setNewCategoryDesc] = useState('');

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) {
      showToast('Category Name is required', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/v1/company/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          categoryName: newCategoryName,
          description: newCategoryDesc
        })
      });
      
      const d = await res.json();
      if (d.success) {
        showToast('Category added to standard catalog!', 'success');
        setShowAddCategoryModal(false);
        setNewCategoryName('');
        setNewCategoryDesc('');
        fetchData();
      } else {
        showToast(d.message || 'Failed to add category', 'error');
      }
    } catch (err) {
      showToast('Failed to connect to server', 'error');
    } finally {
      setLoading(false);
    }
  };

  const isOwner = user?.role === 'OWNER' || user?.role === 'PLATFORM_ADMIN';

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-400" /> Standard Component Catalog
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Maintain a standard list of components for consistent internal Purchase Requisitions.
          </p>
        </div>
        {isOwner && (
          <button
            onClick={() => setShowAddModal(true)}
            className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-[0_0_20px_rgba(37,99,235,0.2)] flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add Component
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {companyComponents.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-500 text-sm glass-card rounded-2xl border border-white/5">
            No components found in the standard catalog. {isOwner && 'Add your first component to get started!'}
          </div>
        ) : (
          companyComponents.map(comp => (
            <div key={comp.id} className="glass-card rounded-2xl p-5 border border-white/5 flex flex-col justify-between hover:border-blue-500/30 transition-colors">
              <div>
                <h3 className="font-bold text-base text-white">{comp.componentName}</h3>
                <p className="text-xs text-slate-400 mt-1.5 line-clamp-2">{comp.description || 'No description provided.'}</p>
              </div>
              <div className="mt-4 pt-3 border-t border-white/5 flex justify-between items-center text-[10px] text-slate-400">
                <span>Unit: <span className="text-white font-semibold">{comp.defaultUnit}</span></span>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mt-12 pt-8 border-t border-white/10">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-400" /> Standard RFQ Categories
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Maintain a standard list of categories for consistent RFQ creation.
          </p>
        </div>
        {isOwner && (
          <button
            onClick={() => setShowAddCategoryModal(true)}
            className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-[0_0_20px_rgba(37,99,235,0.2)] flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add Category
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {companyCategories?.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-500 text-sm glass-card rounded-2xl border border-white/5">
            No categories found. {isOwner && 'Add your first category to get started!'}
          </div>
        ) : (
          companyCategories?.map(cat => (
            <div key={cat.id} className="glass-card rounded-2xl p-5 border border-white/5 flex flex-col justify-between hover:border-blue-500/30 transition-colors">
              <div>
                <h3 className="font-bold text-base text-white">{cat.categoryName}</h3>
                <p className="text-xs text-slate-400 mt-1.5 line-clamp-2">{cat.description || 'No description provided.'}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {showAddModal && isOwner && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Add Standard Component</h3>
            <form onSubmit={handleAddComponent} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Component Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Gearbox Housing v2"
                  value={newComponentName}
                  onChange={(e) => setNewComponentName(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Description</label>
                <textarea
                  placeholder="Optional description"
                  value={newComponentDesc}
                  onChange={(e) => setNewComponentDesc(e.target.value)}
                  className="w-full h-24 bg-slate-950 border border-white/10 rounded-xl p-4 text-sm text-slate-200 focus:outline-none resize-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Default Unit</label>
                <select
                  value={newComponentUnit}
                  onChange={(e) => setNewComponentUnit(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none"
                >
                  <option value="pcs">pcs (Pieces)</option>
                  <option value="kg">kg (Kilograms)</option>
                  <option value="m">m (Meters)</option>
                  <option value="l">l (Liters)</option>
                  <option value="tons">tons</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/5 mt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-5 py-2 text-slate-300 hover:text-white text-xs font-semibold" disabled={loading}>Cancel</button>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center min-w-[120px]"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Component'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddCategoryModal && isOwner && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Add Standard Category</h3>
            <form onSubmit={handleAddCategory} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Category Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Industrial Parts"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Description</label>
                <textarea
                  placeholder="Optional description"
                  value={newCategoryDesc}
                  onChange={(e) => setNewCategoryDesc(e.target.value)}
                  className="w-full h-24 bg-slate-950 border border-white/10 rounded-xl p-4 text-sm text-slate-200 focus:outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/5 mt-4">
                <button type="button" onClick={() => setShowAddCategoryModal(false)} className="px-5 py-2 text-slate-300 hover:text-white text-xs font-semibold" disabled={loading}>Cancel</button>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center min-w-[120px]"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
