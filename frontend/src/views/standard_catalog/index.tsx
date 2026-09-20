'use client';

import React, { useState } from 'react';
import styles from './standard_catalog.module.scss';
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
  const [newComponentCategory, setNewComponentCategory] = useState('');
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
          category: newComponentCategory || 'General',
          categoryName: newComponentCategory || 'General',
          description: newComponentDesc,
          defaultUnit: newComponentUnit
        })
      });
      
      const d = await res.json();
      if (d.success) {
        showToast('Component added to standard catalog!', 'success');
        setShowAddModal(false);
        setNewComponentName('');
        setNewComponentCategory('');
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
    <div className={`animate-in slide-in-from-bottom-4 fade-in fade-in ${styles['standard_catalog--space-y-6-animate-in-fade-in']}`}>
      <div className={styles['standard_catalog--flex-flex-col-smflex-row']}>
        <div>
          <h2 className={styles['standard_catalog--text-xl-font-bold-text-white']}>
            <Package className={styles['standard_catalog--w-5-h-5-text-blue-400']} /> Standard Component Catalog
          </h2>
          <p className={styles['standard_catalog--text-xs-text-slate-400-mt-1']}>
            Maintain a standard list of components for consistent internal Purchase Requisitions.
          </p>
        </div>
        {isOwner && (
          <button
            onClick={() => setShowAddModal(true)}
            className={styles['standard_catalog--py-25-px-4-bg-blue-600']}
          >
            <Plus className={styles['standard_catalog--w-4-h-4']} /> Add Component
          </button>
        )}
      </div>

      <div className={styles['standard_catalog--grid-grid-cols-1-mdgrid-cols-2']}>
        {companyComponents.length === 0 ? (
          <div className={`glass-card glass-card ${styles['standard_catalog--col-span-full-py-12-text-center']}`}>
            No components found in the standard catalog. {isOwner && 'Add your first component to get started!'}
          </div>
        ) : (
          companyComponents.map(comp => (
            <div key={comp.id} className={styles['standard_catalog--glass-card-rounded-2xl-p-5']}>
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase tracking-wider">
                    {comp.category || comp.categoryName || 'General'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">Unit: <span className="text-white font-semibold">{comp.defaultUnit}</span></span>
                </div>
                <h3 className={styles['standard_catalog--font-bold-text-base-text-white']}>{comp.componentName}</h3>
                <p className={styles['standard_catalog--text-xs-text-slate-400-mt-15']}>{comp.description || 'No description provided.'}</p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className={styles['standard_catalog--flex-flex-col-smflex-row-1']}>
        <div>
          <h2 className={styles['standard_catalog--text-xl-font-bold-text-white-1']}>
            <Package className={styles['standard_catalog--w-5-h-5-text-blue-400-1']} /> Platform Global Categories
          </h2>
          <p className={styles['standard_catalog--text-xs-text-slate-400-mt-1-1']}>
            Standard platform categories common across all companies for components and RFQs.
          </p>
        </div>
        {user?.role === 'PLATFORM_ADMIN' && (
          <button
            onClick={() => setShowAddCategoryModal(true)}
            className={styles['standard_catalog--py-25-px-4-bg-blue-600-1']}
          >
            <Plus className={styles['standard_catalog--w-4-h-4-1']} /> Add Category
          </button>
        )}
      </div>

      <div className={styles['standard_catalog--grid-grid-cols-1-mdgrid-cols-2-1']}>
        {companyCategories?.length === 0 ? (
          <div className={styles['standard_catalog--col-span-full-py-12-text-center-1']}>
            No categories found. {isOwner && 'Add your first category to get started!'}
          </div>
        ) : (
          companyCategories?.map(cat => (
            <div key={cat.id} className={styles['standard_catalog--glass-card-rounded-2xl-p-5-1']}>
              <div>
                <h3 className={styles['standard_catalog--font-bold-text-base-text-white-1']}>{cat.categoryName}</h3>
                <p className={styles['standard_catalog--text-xs-text-slate-400-mt-15-1']}>{cat.description || 'No description provided.'}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {showAddModal && isOwner && (
        <div className={styles['standard_catalog--fixed-inset-0-bg-slate-95080']}>
          <div className={styles['standard_catalog--bg-slate-900-border-border-white10']}>
            <h3 className={styles['standard_catalog--text-lg-font-bold-text-white']}>Add Standard Component</h3>
            <form onSubmit={handleAddComponent} className={styles['standard_catalog--space-y-4']}>
              <div className={styles['standard_catalog--space-y-1']}>
                <label className={styles['standard_catalog--text-10px-text-slate-500-font-bold']}>Component Name <span className={styles['standard_catalog--text-red-500']}>*</span></label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Gearbox Housing v2"
                  value={newComponentName}
                  onChange={(e) => setNewComponentName(e.target.value)}
                  className={styles['standard_catalog--w-full-bg-slate-950-border']}
                />
              </div>
              <div className={styles['standard_catalog--space-y-1-2']}>
                <label className={styles['standard_catalog--text-10px-text-slate-500-font-bold-2']}>
                  Global Category <span className={styles['standard_catalog--text-red-500']}>*</span>
                </label>
                <select
                  required
                  value={newComponentCategory}
                  onChange={(e) => setNewComponentCategory(e.target.value)}
                  className={styles['standard_catalog--w-full-bg-slate-950-border-1']}
                >
                  <option value="" disabled>Select global category...</option>
                  {companyCategories?.map(c => (
                    <option key={c.id} value={c.categoryName}>{c.categoryName}</option>
                  ))}
                  {(!companyCategories || companyCategories.length === 0) && (
                    <option value="General">General</option>
                  )}
                </select>
              </div>
              <div className={styles['standard_catalog--space-y-1-1']}>
                <label className={styles['standard_catalog--text-10px-text-slate-500-font-bold-1']}>Description</label>
                <textarea
                  placeholder="Optional description"
                  value={newComponentDesc}
                  onChange={(e) => setNewComponentDesc(e.target.value)}
                  className={styles['standard_catalog--w-full-h-24-bg-slate-950']}
                />
              </div>
              <div className={styles['standard_catalog--space-y-1-2']}>
                <label className={styles['standard_catalog--text-10px-text-slate-500-font-bold-2']}>Default Unit</label>
                <select
                  value={newComponentUnit}
                  onChange={(e) => setNewComponentUnit(e.target.value)}
                  className={styles['standard_catalog--w-full-bg-slate-950-border-1']}
                >
                  <option value="pcs">pcs (Pieces)</option>
                  <option value="kg">kg (Kilograms)</option>
                  <option value="m">m (Meters)</option>
                  <option value="l">l (Liters)</option>
                  <option value="tons">tons</option>
                </select>
              </div>

              <div className={styles['standard_catalog--flex-justify-end-gap-3']}>
                <button type="button" onClick={() => setShowAddModal(false)} className={styles['standard_catalog--px-5-py-2-text-slate-300']} disabled={loading}>Cancel</button>
                <button 
                  type="submit" 
                  disabled={loading}
                  className={styles['standard_catalog--px-5-py-2-bg-blue-600']}
                >
                  {loading ? <Loader2 className={styles['standard_catalog--w-4-h-4-animate-spin']} /> : 'Add Component'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddCategoryModal && isOwner && (
        <div className={styles['standard_catalog--fixed-inset-0-bg-slate-95080-1']}>
          <div className={styles['standard_catalog--bg-slate-900-border-border-white10-1']}>
            <h3 className={styles['standard_catalog--text-lg-font-bold-text-white-1']}>Add Standard Category</h3>
            <form onSubmit={handleAddCategory} className={styles['standard_catalog--space-y-4-1']}>
              <div className={styles['standard_catalog--space-y-1-3']}>
                <label className={styles['standard_catalog--text-10px-text-slate-500-font-bold-3']}>Category Name <span className={styles['standard_catalog--text-red-500-1']}>*</span></label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Industrial Parts"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className={styles['standard_catalog--w-full-bg-slate-950-border-2']}
                />
              </div>
              <div className={styles['standard_catalog--space-y-1-4']}>
                <label className={styles['standard_catalog--text-10px-text-slate-500-font-bold-4']}>Description</label>
                <textarea
                  placeholder="Optional description"
                  value={newCategoryDesc}
                  onChange={(e) => setNewCategoryDesc(e.target.value)}
                  className={styles['standard_catalog--w-full-h-24-bg-slate-950-1']}
                />
              </div>

              <div className={styles['standard_catalog--flex-justify-end-gap-3-1']}>
                <button type="button" onClick={() => setShowAddCategoryModal(false)} className={styles['standard_catalog--px-5-py-2-text-slate-300-1']} disabled={loading}>Cancel</button>
                <button 
                  type="submit" 
                  disabled={loading}
                  className={styles['standard_catalog--px-5-py-2-bg-blue-600-1']}
                >
                  {loading ? <Loader2 className={styles['standard_catalog--w-4-h-4-animate-spin-1']} /> : 'Add Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
