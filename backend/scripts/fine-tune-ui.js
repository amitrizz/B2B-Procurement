const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../frontend/src/app/dashboard/components/MyRequirementsTab.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Title Section
content = content.replace(/className="text-\[20px\] font-extrabold tracking-tight text-\[#001D4A\]"/g, 'className="text-[22px] font-bold tracking-tight text-[#001D4A]"');
content = content.replace(/className="text-\[12px\] text-gray-500 mt-1 leading-relaxed"/g, 'className="text-[13px] text-slate-500 mt-1.5 leading-relaxed"');
content = content.replace(/className={`shrink-0 rounded-full p-2 \${mode === 'buyer' \? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}/g, 'className={`shrink-0 rounded-full p-2.5 ${mode === \'buyer\' ? \'bg-blue-50 text-blue-600\' : \'bg-emerald-50 text-emerald-600\'}`}');

// Status Filter Tabs
content = content.replace(/className="flex p-1 rounded-full border border-gray-100 bg-gray-50 max-w-full"/g, 'className="flex p-1.5 rounded-full bg-slate-100 max-w-full"');
content = content.replace(/className={`flex-1 py-2\.5 text-\[12px\] font-bold rounded-full transition-all \${statusFilter === 'open' \? \(mode === 'buyer' \? 'bg-blue-600 text-white shadow-sm' : 'bg-\[#10b981\] text-white shadow-sm'\) : 'text-gray-500 hover:text-gray-700'}`}/g, 'className={`flex-1 py-2 text-[13px] font-semibold rounded-full transition-all ${statusFilter === \'open\' ? (mode === \'buyer\' ? \'bg-blue-500 text-white shadow-sm\' : \'bg-[#10b981] text-white shadow-sm\') : \'text-slate-500 hover:text-slate-700\'}`}');
content = content.replace(/className={`flex-1 py-2\.5 text-\[12px\] font-bold rounded-full transition-all \${statusFilter === 'in_progress' \? \(mode === 'buyer' \? 'bg-blue-600 text-white shadow-sm' : 'bg-\[#10b981\] text-white shadow-sm'\) : 'text-gray-500 hover:text-gray-700'}`}/g, 'className={`flex-1 py-2 text-[13px] font-semibold rounded-full transition-all ${statusFilter === \'in_progress\' ? (mode === \'buyer\' ? \'bg-blue-500 text-white shadow-sm\' : \'bg-[#10b981] text-white shadow-sm\') : \'text-slate-500 hover:text-slate-700\'}`}');
content = content.replace(/className={`flex-1 py-2\.5 text-\[12px\] font-bold rounded-full transition-all \${statusFilter === 'closed' \? \(mode === 'buyer' \? 'bg-blue-600 text-white shadow-sm' : 'bg-\[#10b981\] text-white shadow-sm'\) : 'text-gray-500 hover:text-gray-700'}`}/g, 'className={`flex-1 py-2 text-[13px] font-semibold rounded-full transition-all ${statusFilter === \'closed\' ? (mode === \'buyer\' ? \'bg-blue-500 text-white shadow-sm\' : \'bg-[#10b981] text-white shadow-sm\') : \'text-slate-500 hover:text-slate-700\'}`}');

// Publish Button
content = content.replace(/className="py-3 px-6 bg-gradient-to-r from-\[#4f46e5\] to-\[#8b5cf6\] hover:opacity-90 text-white rounded-full text-\[13px\] font-bold transition-all flex items-center justify-center gap-2 shadow-md active:scale-95"/g, 'className="py-2.5 px-5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-full text-[13px] font-semibold transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95"');

// Card
content = content.replace(/className="bg-white rounded-2xl p-5 border border-gray-100 shadow-\[0_4px_20px_-10px_rgba\(0,0,0,0\.04\)\] flex flex-col space-y-3"/g, 'className="bg-white rounded-3xl p-5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex flex-col space-y-3"');

// Urgent Badge
content = content.replace(/className="bg-blue-50 text-blue-600 px-2 py-0\.5 rounded-md text-\[10px\] font-bold flex items-center gap-1"/g, 'className="bg-[#EFF6FF] text-[#3B82F6] px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1"');
content = content.replace(/className="bg-emerald-50 text-emerald-600 px-2 py-0\.5 rounded-md text-\[10px\] font-bold flex items-center gap-1"/g, 'className="bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1"');

// Title
content = content.replace(/className="font-extrabold text-\[17px\] text-\[#001D4A\] pt-1"/g, 'className="font-bold text-[18px] text-[#001D4A] pt-1"');

// Card Action Buttons (Buyer)
// Compare Bids
content = content.replace(/className="flex-1 py-3 bg-blue-50 text-blue-700 disabled:opacity-60 disabled:cursor-not-allowed rounded-xl text-\[12px\] font-bold flex items-center justify-between px-4 transition-all"/g, 'className="flex-1 py-3 bg-[#EFF6FF] text-[#2563EB] disabled:opacity-60 disabled:cursor-not-allowed rounded-2xl text-[12px] font-semibold flex items-center justify-between px-4 transition-all"');

// Edit
content = content.replace(/className="py-3 px-4 bg-gray-50 text-\[#001D4A\] border border-gray-200 hover:bg-gray-100 rounded-xl text-\[12px\] font-bold flex items-center gap-2 transition-all"/g, 'className="py-3 px-5 bg-[#F8FAFC] text-[#334155] border border-slate-200 hover:bg-slate-100 rounded-2xl text-[13px] font-semibold flex items-center gap-2 transition-all"');

fs.writeFileSync(filePath, content);
console.log('Successfully fine-tuned MyRequirementsTab.tsx styles');
