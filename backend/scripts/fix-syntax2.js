const fs = require('fs');
let code = fs.readFileSync('frontend/src/app/dashboard/layout.tsx', 'utf8');

const targetRegex = /<span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border border-white"><\/span>\s*<\/button>\s*<div className="flex items-center bg-gray-100 rounded-full p-1 border border-gray-200">\s*className=\{`w-full text-left py-2\.5 px-4 rounded-xl text-xs font-semibold flex items-center space-x-2\.5 transition-all \$\{activeTab === 'marketplace' \? 'bg-blue-500\/10 text-blue-400 border border-blue-500\/20' : 'text-slate-400 hover:text-white'\}`\}/;

const replacement = `<span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
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

      {/* Mobile Sidebar Overlay */}
      {showMobileSidebar && (
        <div 
          className="md:hidden fixed inset-0 bg-black/60 z-[60] backdrop-blur-sm" 
          onClick={() => setShowMobileSidebar(false)}
        />
      )}

      {/* Sidebar Navigation (Desktop & Mobile) */}
      <div className={\`fixed inset-y-0 left-0 z-[70] transform transition-transform duration-300 md:relative md:translate-x-0 w-64 glass-panel border-r border-white/5 flex flex-col justify-between p-6 bg-slate-950 shadow-2xl md:shadow-none \${showMobileSidebar ? 'translate-x-0' : '-translate-x-full'}\`}>
        <div>
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center space-x-3">
              <img src="/logo.png" alt="Company Logo" className="w-8 h-8 shrink-0 object-cover" style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }} />
              <div>
                <h2 className="font-extrabold text-sm tracking-tight text-white flex items-center gap-1.5">
                  {user.company?.name || 'Platform Admin'}
                  {user.company && (user.company.isActive !== false ? (
                    <span className="px-1.5 py-0.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded text-[9px] font-bold">ACTIVE</span>
                  ) : (
                    <span className="px-1.5 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded text-[9px] font-bold">INACTIVE</span>
                  ))}
                </h2>
                <span className="text-[10px] text-blue-400 font-semibold uppercase">{user.role}</span>
              </div>
            </div>
            {/* Close Button for Mobile */}
            <button onClick={() => setShowMobileSidebar(false)} className="md:hidden p-1 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-1">
            {user.role !== 'TRANSPORTER' && (
              <>
                <button
                  onClick={() => handleTabChange('marketplace')}
                  className={\`w-full text-left py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center space-x-2.5 transition-all \${activeTab === 'marketplace' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'text-slate-400 hover:text-white'}\`}`;

code = code.replace(targetRegex, replacement);
fs.writeFileSync('frontend/src/app/dashboard/layout.tsx', code);
console.log("Fixed syntax completely!");
