const fs = require('fs');
const path = require('path');

const pagePath = path.join(__dirname, '../../frontend/src/app/dashboard/[[...tab]]/page.tsx');
let content = fs.readFileSync(pagePath, 'utf8');

// Replace Mobile Top Header (Lines ~941 to ~981)
const oldMobileHeaderRegex = /\{\/\* Mobile Top Header \*\/\}.*?(?=\{\/\* Mobile Sidebar Overlay \*\/\})/s;

const newMobileHeader = `{/* Mobile Top Header */}
      <div className="md:hidden bg-[#F8FAFC] px-4 py-3 flex flex-col space-y-4 z-40 shrink-0 pt-safe">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center space-x-2 min-w-0 flex-1">
            <Hexagon className="w-8 h-8 text-emerald-600 fill-emerald-600 shrink-0" />
            <span className="font-extrabold text-[13px] text-[#001D4A] uppercase tracking-wider min-w-0 truncate">
              {user?.company?.name || 'AMIT'}
            </span>
            {user?.company?.isActive !== false ? (
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[9px] font-bold shrink-0 flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div> ACTIVE
              </span>
            ) : (
              <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-[9px] font-bold shrink-0 flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div> INACTIVE
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button className="relative text-gray-500">
               <Bell className="w-5 h-5" />
               <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
            </button>
            <div className="flex items-center bg-gray-100 rounded-full p-1 border border-gray-200">
               <button onClick={() => setMode('buyer')} className={\`p-1.5 rounded-full transition-colors \${mode === 'buyer' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400'}\`}>
                 <ShoppingCart className="w-4 h-4" />
               </button>
               <button onClick={() => setMode('seller')} className={\`p-1.5 rounded-full transition-colors \${mode === 'seller' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-400'}\`}>
                 <Truck className="w-4 h-4" />
               </button>
            </div>
          </div>
        </div>
      </div>

      `;

content = content.replace(oldMobileHeaderRegex, newMobileHeader);

// Inject Bottom Navigation just before closing div of the flex-1 container or at the very end
const oldBottomNavPlaceholderRegex = /\{\/\* Publish RFQ Modal \*\/\}/s;

const bottomNavigation = `{/* Bottom Navigation Bar (Mobile) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex justify-between items-center px-6 py-2 pb-safe z-50 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.05)]">
        <button onClick={() => handleTabChange('marketplace')} className={\`flex flex-col items-center gap-1 \${activeTab === 'marketplace' ? 'text-emerald-600' : 'text-gray-400'}\`}>
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={activeTab==='marketplace'?2.5:2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
          <span className={\`text-[9px] font-bold \${activeTab === 'marketplace' ? 'border-b-2 border-emerald-600 pb-0.5' : ''}\`}>Market</span>
        </button>
        <button onClick={() => handleTabChange('my_rfqs')} className={\`flex flex-col items-center gap-1 \${activeTab === 'my_rfqs' ? 'text-blue-600' : 'text-gray-400'}\`}>
          <FileText className="w-5 h-5" />
          <span className={\`text-[9px] font-bold \${activeTab === 'my_rfqs' ? 'border-b-2 border-blue-600 pb-0.5' : ''}\`}>Bids</span>
        </button>
        <button onClick={() => handleTabChange('orders')} className={\`flex flex-col items-center gap-1 \${activeTab === 'orders' ? 'text-blue-600' : 'text-gray-400'}\`}>
          <ShoppingCart className="w-5 h-5" />
          <span className={\`text-[9px] font-bold \${activeTab === 'orders' ? 'border-b-2 border-blue-600 pb-0.5' : ''}\`}>Orders</span>
        </button>
        <button onClick={() => handleTabChange('company_chat')} className={\`flex flex-col items-center gap-1 relative \${activeTab === 'company_chat' ? 'text-blue-600' : 'text-gray-400'}\`}>
          <MessageSquare className="w-5 h-5" />
          {chatUnreadCount > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-white"></span>}
          <span className={\`text-[9px] font-bold \${activeTab === 'company_chat' ? 'border-b-2 border-blue-600 pb-0.5' : ''}\`}>Chat</span>
        </button>
        <button onClick={() => handleTabChange('profile')} className={\`flex flex-col items-center gap-1 \${activeTab === 'profile' ? 'text-blue-600' : 'text-gray-400'}\`}>
          <User className="w-5 h-5" />
          <span className={\`text-[9px] font-bold \${activeTab === 'profile' ? 'border-b-2 border-blue-600 pb-0.5' : ''}\`}>Profile</span>
        </button>
        <button onClick={() => setShowMobileSidebar(true)} className="flex flex-col items-center gap-1 text-gray-400">
          <Menu className="w-5 h-5" />
          <span className="text-[9px] font-bold">Menu</span>
        </button>
      </div>

      {/* Publish RFQ Modal */}`;

content = content.replace(oldBottomNavPlaceholderRegex, bottomNavigation);

if (!content.includes('Hexagon,')) {
    content = content.replace('X, User, Loader2, MessageSquare', 'X, User, Loader2, MessageSquare, Hexagon, Bell');
} else if (!content.includes('Bell,')) {
    content = content.replace('Hexagon', 'Hexagon, Bell');
}

content = content.replace('className="flex-1 flex flex-col overflow-y-auto bg-slate-950 p-4 md:p-10 pb-24 md:pb-10 min-h-0"', 'className="flex-1 flex flex-col overflow-y-auto bg-[#F8FAFC] md:bg-slate-950 p-0 md:p-10 pb-24 md:pb-10 min-h-0 relative"');

fs.writeFileSync(pagePath, content);
console.log('Updated page.tsx layout');
