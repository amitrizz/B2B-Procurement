const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../frontend/src/app/dashboard/components/MyRequirementsTab.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Increase vertical padding on the status filter container or the buttons
content = content.replace(/className="flex p-1\.5 rounded-full bg-slate-100 max-w-full"/g, 'className="flex p-1.5 rounded-full bg-slate-100 max-w-full mt-2"');

// Increase py on the status filter buttons
content = content.replace(/className={`flex-1 py-2 text-\[13px\] font-semibold rounded-full transition-all \${statusFilter === 'open' \? \(mode === 'buyer' \? 'bg-blue-500 text-white shadow-sm' : 'bg-\[#10b981\] text-white shadow-sm'\) : 'text-slate-500 hover:text-slate-700'}`}/g, 'className={`flex-1 py-3 text-[13.5px] font-bold rounded-full transition-all ${statusFilter === \'open\' ? (mode === \'buyer\' ? \'bg-blue-500 text-white shadow-sm\' : \'bg-[#10b981] text-white shadow-sm\') : \'text-slate-500 hover:text-slate-700\'}`}');
content = content.replace(/className={`flex-1 py-2 text-\[13px\] font-semibold rounded-full transition-all \${statusFilter === 'in_progress' \? \(mode === 'buyer' \? 'bg-blue-500 text-white shadow-sm' : 'bg-\[#10b981\] text-white shadow-sm'\) : 'text-slate-500 hover:text-slate-700'}`}/g, 'className={`flex-1 py-3 text-[13.5px] font-bold rounded-full transition-all ${statusFilter === \'in_progress\' ? (mode === \'buyer\' ? \'bg-blue-500 text-white shadow-sm\' : \'bg-[#10b981] text-white shadow-sm\') : \'text-slate-500 hover:text-slate-700\'}`}');
content = content.replace(/className={`flex-1 py-2 text-\[13px\] font-semibold rounded-full transition-all \${statusFilter === 'closed' \? \(mode === 'buyer' \? 'bg-blue-500 text-white shadow-sm' : 'bg-\[#10b981\] text-white shadow-sm'\) : 'text-slate-500 hover:text-slate-700'}`}/g, 'className={`flex-1 py-3 text-[13.5px] font-bold rounded-full transition-all ${statusFilter === \'closed\' ? (mode === \'buyer\' ? \'bg-blue-500 text-white shadow-sm\' : \'bg-[#10b981] text-white shadow-sm\') : \'text-slate-500 hover:text-slate-700\'}`}');

// Increase padding on Publish New RFQ
content = content.replace(/className="py-2\.5 px-5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-full text-\[13px\] font-semibold transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95"/g, 'className="py-3.5 px-6 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-full text-[14px] font-bold transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95 mt-2"');

fs.writeFileSync(filePath, content);
console.log('Successfully added padding to MyRequirementsTab.tsx');
