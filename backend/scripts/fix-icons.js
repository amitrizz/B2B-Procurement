const fs = require('fs');
const path = require('path');

const pagePath = path.join(__dirname, '../../frontend/src/app/dashboard/[[...tab]]/page.tsx');
let content = fs.readFileSync(pagePath, 'utf8');

// Top Hexagon
const oldHexagon = '<Hexagon className="w-8 h-8 text-emerald-600 fill-emerald-600 shrink-0" />';
const newHexagon = "<Hexagon className={`w-8 h-8 shrink-0 ${mode === 'buyer' ? 'text-blue-600 fill-blue-600' : 'text-emerald-600 fill-emerald-600'}`} />";

if (content.includes(oldHexagon)) {
    content = content.replace(oldHexagon, newHexagon);
    console.log('Updated Hexagon');
}

// Bottom Nav Market Tab
const oldMarketStart = "onClick={() => handleTabChange('marketplace')} className={`flex flex-col items-center gap-1 ${activeTab === 'marketplace' ? 'text-emerald-600' : 'text-gray-400'}`}";
const newMarketStart = "onClick={() => handleTabChange('marketplace')} className={`flex flex-col items-center gap-1 ${activeTab === 'marketplace' ? (mode === 'buyer' ? 'text-blue-600' : 'text-emerald-600') : 'text-gray-400'}`}";

const oldMarketEnd = "className={`text-[9px] font-bold ${activeTab === 'marketplace' ? 'border-b-2 border-emerald-600 pb-0.5' : ''}`}";
const newMarketEnd = "className={`text-[9px] font-bold ${activeTab === 'marketplace' ? (mode === 'buyer' ? 'border-b-2 border-blue-600 pb-0.5' : 'border-b-2 border-emerald-600 pb-0.5') : ''}`}";

if (content.includes(oldMarketStart) && content.includes(oldMarketEnd)) {
    content = content.replace(oldMarketStart, newMarketStart);
    content = content.replace(oldMarketEnd, newMarketEnd);
    console.log('Updated Market Tab');
} else {
    console.log('Could not find market tab strings');
}

fs.writeFileSync(pagePath, content);
