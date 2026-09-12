const fs = require('fs');
const path = require('path');

function updateMarketplace() {
    const filePath = path.join(__dirname, '../../frontend/src/app/dashboard/components/MarketplaceTab.tsx');
    let content = fs.readFileSync(filePath, 'utf8');

    // Replace the Header section
    const oldHeaderRegex = /<div className="flex justify-between items-center">[\s\S]*?<RefreshButton onRefresh=\{fetchData\} size="sm" \/>\s*<\/div>/;
    
    const newHeader = `<div className="relative pt-4 pb-12 mb-4">
        <div className="absolute right-0 top-0 opacity-20 pointer-events-none">
          {/* Simple SVG Illustration of warehouse */}
          <svg width="200" height="100" viewBox="0 0 200 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M120 100V40L160 20L200 40V100H120Z" fill="#10B981"/>
            <path d="M140 60H180V100H140V60Z" fill="#34D399"/>
            <path d="M80 80V50L100 40L120 50V80H80Z" fill="#A7F3D0"/>
          </svg>
        </div>
        <div className="relative z-10 flex justify-between items-start">
          <div className="pr-12">
            <h1 className="text-[22px] font-extrabold tracking-tight text-[#001D4A]">
              Public B2B Marketplace
            </h1>
            <p className="text-[13px] text-gray-500 mt-1 leading-relaxed max-w-[280px]">
              Quote on open procurement requirements from other companies
            </p>
          </div>
          <div className="bg-emerald-50 rounded-full p-2 text-emerald-600">
             <RefreshCw className="w-4 h-4 cursor-pointer" onClick={fetchData} />
          </div>
        </div>
      </div>`;

    content = content.replace(oldHeaderRegex, newHeader);

    // Replace the empty state text color
    content = content.replace(/text-slate-500/g, 'text-gray-500');

    // Replace Card Styling
    content = content.replace(/glass-card rounded-2xl p-5 border border-white\/5 flex flex-col justify-between space-y-4/g, 'bg-white rounded-2xl p-5 border border-gray-100 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] flex flex-col justify-between space-y-4');
    
    // Replace category pill
    content = content.replace(/<span className="text-\[10px\] text-blue-400 bg-blue-500\/10 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">\{rfq\.category\}<\/span>/g, '<span className="text-[10px] text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">{rfq.category}</span>');
    
    // Replace RFQ number color
    content = content.replace(/<span className="text-\[10px\] text-slate-500 font-semibold">\{rfq\.rfqNumber\}<\/span>/g, '<span className="text-[10px] text-gray-400 font-semibold">{rfq.rfqNumber}</span>');
    
    // Replace Title color
    content = content.replace(/<h3 className="font-bold text-base text-white mt-2\.5">\{rfq\.title\}<\/h3>/g, '<h3 className="font-extrabold text-[17px] text-[#001D4A] mt-3">{rfq.title}</h3>');
    
    // Replace description color
    content = content.replace(/<p className="text-xs text-slate-400 mt-1\.5 line-clamp-2">\{rfq\.description\}<\/p>/g, '<p className="text-[13px] text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">{rfq.description}</p>');
    
    // Replace Info Box
    const oldInfoBoxRegex = /<div className="mt-4 pt-3 border-t border-white\/5 space-y-1\.5 text-\[11px\] text-slate-400">[\s\S]*?<\/div>\s*<\/div>\s*\{mode === 'buyer'/;
    
    const newInfoBox = `<div className="mt-4 pt-4 border-t border-gray-100 space-y-2.5 text-[12px] text-gray-500">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2"><svg className="w-4 h-4 text-[#001D4A]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg><span>Components:</span></div> 
                      <span className="font-bold text-[#001D4A]">{rfq.items.length} parts</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2"><svg className="w-4 h-4 text-[#001D4A]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" /></svg><span>Total Bids:</span></div> 
                      <span className="font-bold text-blue-600">{rfq._count?.bids || 0} bids</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2"><svg className="w-4 h-4 text-[#001D4A]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><span>Time Remaining:</span></div>
                      <span className={\`font-bold \${new Date(rfq.bidEndAt) < new Date() ? 'text-red-500' : 'text-emerald-600'}\`}>
                        {new Date(rfq.bidEndAt) < new Date() ? 'Closed' : (() => {
                          const diff = new Date(rfq.bidEndAt).getTime() - Date.now();
                          const days = Math.floor(diff / (24 * 60 * 60 * 1000));
                          if (days > 0) return \`\${days} days left\`;
                          const hours = Math.floor(diff / (60 * 60 * 1000));
                          return \`\${hours} hours left\`;
                        })()}
                      </span>
                    </div>
                  </div>
                </div>
                {mode === 'buyer'`;
    
    content = content.replace(oldInfoBoxRegex, newInfoBox);

    // Replace the Bid on components button
    const oldButtonRegex = /<button\s*onClick=\{\(\) => handleStartBidding\(rfq\)\}\s*className="w-full py-2\.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1\.5 transition-all"\s*>\s*<span>Bid on Components<\/span>\s*<ChevronRight className="w-3\.5 h-3\.5" \/>\s*<\/button>/;
    
    const newButton = `<button
                    onClick={() => handleStartBidding(rfq)}
                    className="w-full py-3 bg-[#389D7F] text-white rounded-full text-[13px] font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" /></svg>
                    <span>Bid on Components</span>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                  </button>`;

    content = content.replace(oldButtonRegex, newButton);

    // Change the outer div space-y-6 to space-y-2 or bg-transparent
    content = content.replace(/<div className="space-y-6">/, '<div className="space-y-4">');

    fs.writeFileSync(filePath, content);
    console.log('Updated MarketplaceTab.tsx');
}

function updateMyRequirements() {
    const filePath = path.join(__dirname, '../../frontend/src/app/dashboard/components/MyRequirementsTab.tsx');
    if (!fs.existsSync(filePath)) return;
    
    let content = fs.readFileSync(filePath, 'utf8');

    // Similar replacements for MyRequirementsTab
    const oldHeaderRegex = /<div className="flex justify-between items-center">[\s\S]*?<RefreshButton onRefresh=\{fetchData\} size="sm" \/>\s*<\/div>/;
    
    const newHeader = `<div className="relative pt-4 pb-12 mb-4">
        <div className="absolute right-0 top-0 opacity-20 pointer-events-none">
          {/* Simple SVG Illustration of clipboard */}
          <svg width="200" height="100" viewBox="0 0 200 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="130" y="20" width="50" height="70" rx="4" fill="#3B82F6"/>
            <rect x="140" y="10" width="30" height="20" rx="2" fill="#93C5FD"/>
            <line x1="140" y1="50" x2="170" y2="50" stroke="#EFF6FF" strokeWidth="4" strokeLinecap="round"/>
            <line x1="140" y1="65" x2="160" y2="65" stroke="#EFF6FF" strokeWidth="4" strokeLinecap="round"/>
            <circle cx="165" cy="75" r="15" fill="#1D4ED8" fillOpacity="0.5"/>
          </svg>
        </div>
        <div className="relative z-10 flex justify-between items-start">
          <div className="pr-12">
            <h1 className="text-[22px] font-extrabold tracking-tight text-[#001D4A]">
              My RFQs & Procurement
            </h1>
            <p className="text-[13px] text-gray-500 mt-1 leading-relaxed max-w-[280px]">
              Track bids received and award winner contracts
            </p>
          </div>
          <div className="bg-blue-50 rounded-full p-2 text-blue-600">
             <RefreshCw className="w-4 h-4 cursor-pointer" onClick={fetchData} />
          </div>
        </div>
      </div>`;

    content = content.replace(oldHeaderRegex, newHeader);

    // Replace Card Styling
    content = content.replace(/glass-card rounded-2xl p-5 border border-white\/5 flex flex-col justify-between space-y-4/g, 'bg-white rounded-2xl p-5 border border-gray-100 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] flex flex-col justify-between space-y-4 relative');
    
    // Replace category pill
    content = content.replace(/<span className="text-\[10px\] text-blue-400 bg-blue-500\/10 px-2 py-0\.5 rounded-full font-bold uppercase tracking-wider">\{rfq\.category\}<\/span>/g, '<span className="text-[10px] text-blue-700 bg-blue-100 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">{rfq.category}</span>');
    
    // Replace RFQ number color
    content = content.replace(/<span className="text-\[10px\] text-slate-500 font-semibold">\{rfq\.rfqNumber\}<\/span>/g, '<span className="text-[10px] text-gray-400 font-semibold">{rfq.rfqNumber}</span>');
    
    // Replace Title color & add Urgent Badge
    const titleRegex = /<h3 className="font-bold text-base text-white mt-2\.5">\{rfq\.title\}<\/h3>/g;
    content = content.replace(titleRegex, '<h3 className="font-extrabold text-[17px] text-[#001D4A] mt-3">{rfq.title}</h3>\n<div className="flex items-center gap-1.5 mt-2">\n<div className="bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1"><Clock className="w-3 h-3" /> Urgent requirement</div>\n</div>');

    
    // Info Box for MyRequirements Tab
    const oldInfoBoxRegex = /<div className="mt-4 pt-3 border-t border-white\/5 space-y-1\.5 text-\[11px\] text-slate-400">[\s\S]*?<\/div>\s*<\/div>\s*\{rfq\.status === 'AWARDED'/;
    
    const newInfoBox = `<div className="mt-4 pt-4 border-t border-gray-100 space-y-2.5 text-[12px] text-gray-500">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2"><svg className="w-4 h-4 text-[#001D4A]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg><span>Components:</span></div> 
                      <span className="font-bold text-[#001D4A]">{rfq.items.length} parts</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2"><svg className="w-4 h-4 text-[#001D4A]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" /></svg><span>Total Bids:</span></div> 
                      <span className="font-bold text-blue-600">{rfq._count?.bids || 0} bids</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2"><svg className="w-4 h-4 text-[#001D4A]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><span>Time Remaining:</span></div>
                      <span className={\`font-bold \${new Date(rfq.bidEndAt) < new Date() ? 'text-red-500' : 'text-emerald-600'}\`}>
                        {new Date(rfq.bidEndAt) < new Date() ? 'Closed' : (() => {
                          const diff = new Date(rfq.bidEndAt).getTime() - Date.now();
                          const days = Math.floor(diff / (24 * 60 * 60 * 1000));
                          if (days > 0) return \`\${days} days left\`;
                          const hours = Math.floor(diff / (60 * 60 * 1000));
                          return \`\${hours} hours left\`;
                        })()}
                      </span>
                    </div>
                  </div>
                </div>
                {rfq.status === 'AWARDED'`;
                
    content = content.replace(oldInfoBoxRegex, newInfoBox);

    // Replace Manage RFQ & Bids button
    const oldButtonRegex = /<button\s*onClick=\{\(\) => handleViewRfqDetails\(rfq.id\)\}\s*className="w-full py-2\.5 bg-white\/5 border border-white\/10 hover:bg-white\/10 hover:border-white\/20 text-slate-200 hover:text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1\.5 transition-all"\s*>\s*<span>Manage RFQ & Bids<\/span>\s*<ChevronRight className="w-3\.5 h-3\.5 text-slate-400" \/>\s*<\/button>/;
    
    const newButton = `<button
                    onClick={() => handleViewRfqDetails(rfq.id)}
                    className="w-full py-3 bg-blue-50 text-blue-700 rounded-full text-[13px] font-bold flex items-center justify-between px-6 transition-all active:scale-95 mt-2"
                  >
                    <div className="flex items-center gap-2">
                       <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                       <span>Manage RFQ & Bids</span>
                    </div>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                  </button>`;
                  
    content = content.replace(oldButtonRegex, newButton);
    
    // Replace Bidding Closed div
    const oldClosedRegex = /<div className="w-full py-2\.5 bg-slate-800 text-slate-500 rounded-xl text-xs font-semibold flex items-center justify-center gap-1\.5 cursor-not-allowed">/g;
    content = content.replace(oldClosedRegex, '<div className="w-full py-3 bg-gray-100 text-gray-500 rounded-full text-[13px] font-bold flex items-center justify-center gap-1.5 cursor-not-allowed mt-2">');

    // Insert banner at the end of the grid
    const oldGridEndRegex = /<\/div>\s*\)\s*\}\s*\{\/\* RFQ Details View \*\/\}/s;
    const bannerHtml = `
          {filteredRfqs.length > 0 && (
            <div className="col-span-full mt-4 bg-gradient-to-r from-blue-50 to-[#E8F4F8] rounded-2xl p-4 border border-blue-100 flex items-center justify-between shadow-sm">
               <div className="flex items-center gap-3">
                 <div className="bg-blue-600 rounded-lg p-2 text-white">
                   <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                 </div>
                 <div>
                   <h4 className="text-[13px] font-bold text-[#001D4A]">Build strong supply chains</h4>
                   <p className="text-[11px] text-gray-500 mt-0.5">Find the best suppliers for your business needs.</p>
                 </div>
               </div>
               <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </div>
          )}
        </div>
      )}
      {/* RFQ Details View */}`;

    if (oldGridEndRegex.test(content)) {
        content = content.replace(oldGridEndRegex, bannerHtml);
    }
    
    // Also change outer space-y-6
    content = content.replace(/<div className="space-y-6">/, '<div className="space-y-4">');

    fs.writeFileSync(filePath, content);
    console.log('Updated MyRequirementsTab.tsx');
}

updateMarketplace();
updateMyRequirements();
