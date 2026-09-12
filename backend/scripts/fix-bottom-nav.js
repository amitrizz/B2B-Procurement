const fs = require('fs');
const path = require('path');

const pagePath = path.join(__dirname, '../../frontend/src/app/dashboard/[[...tab]]/page.tsx');
let content = fs.readFileSync(pagePath, 'utf8');

// Replace the Market tab button
const oldMarketTab = /<button onClick=\{\(\) => handleTabChange\('marketplace'\)\} className=\{\`flex flex-col items-center gap-1 \\\$\\{activeTab === 'marketplace' \? 'text-emerald-600' : 'text-gray-400'\\}\`\}>[\s\S]*?<span className=\{\`text-\[9px\] font-bold \\\$\\{activeTab === 'marketplace' \? 'border-b-2 border-emerald-600 pb-0\.5' : ''\\}\`\}>Market<\/span>\s*<\/button>/;

const newMarketTab = `<button onClick={() => handleTabChange('marketplace')} className={\`flex flex-col items-center gap-1 \${activeTab === 'marketplace' ? (mode === 'buyer' ? 'text-blue-600' : 'text-emerald-600') : 'text-gray-400'}\`}>
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={activeTab==='marketplace'?2.5:2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
          <span className={\`text-[9px] font-bold \${activeTab === 'marketplace' ? (mode === 'buyer' ? 'border-b-2 border-blue-600 pb-0.5' : 'border-b-2 border-emerald-600 pb-0.5') : ''}\`}>Market</span>
        </button>`;

if (oldMarketTab.test(content)) {
    content = content.replace(oldMarketTab, newMarketTab);
    fs.writeFileSync(pagePath, content);
    console.log('Successfully updated bottom navigation tab colors to match mode.');
} else {
    console.log('Regex did not match. Please check the content of page.tsx');
}
