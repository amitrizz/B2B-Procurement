'use client';
import { useContext } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardContext } from '../layout';
import RequisitionsTab from '@/views/requisitions';
import { ShieldAlert, ArrowRight, ShoppingCart, Search } from 'lucide-react';

export default function RequisitionsTabPage() {
  const ctx = useContext(DashboardContext);
  const router = useRouter();

  if (!ctx) return null; // Wait for layout to mount

  // Mode Restriction Guard: If active mode is Seller, restrict access to Buyer-only Requisitions
  if (ctx.mode === 'seller') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="max-w-md w-full bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 text-center shadow-lg space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200/80 shadow-xs">
            <ShieldAlert className="w-7 h-7" />
          </div>

          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100/80 text-amber-800 text-[10px] font-bold uppercase tracking-wider">
              Buyer Mode Only
            </div>
            <h2 className="text-xl font-extrabold text-[#001D4A] tracking-tight">
              Access Restricted
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
              Purchase Requisitions and Internal Catalog are only available in <strong>Buyer (Procure)</strong> mode. You are currently operating in <strong>Seller (Supply)</strong> mode.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5">
            <button
              onClick={() => {
                if (ctx.setMode) ctx.setMode('buyer');
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Switch to Buyer Mode</span>
            </button>

            <button
              onClick={() => router.push('/dashboard/rfqs')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer"
            >
              <span>Go to My Bids</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <RequisitionsTab 
      prs={ctx.prs} 
      fetchData={() => ctx.fetchDataRef.current()} 
      user={ctx.user} 
      showToast={ctx.showToast} 
      companyComponents={ctx.companyComponents} 
      companyCategories={ctx.companyCategories} 
    />
  );
}
