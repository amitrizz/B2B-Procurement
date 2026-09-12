const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../frontend/src/app/dashboard/components/MyRequirementsTab.tsx');
let content = fs.readFileSync(filePath, 'utf8');

if (!content.includes('import styles')) {
  content = content.replace("import { useState }", "import { useState }\nimport styles from './MyRequirementsTab.module.css';");
}

// Replace container
content = content.replace(/className="space-y-5 pb-8"/g, 'className={styles.container}');
content = content.replace(/className="flex justify-between items-start pt-2"/g, 'className={styles.header}');
content = content.replace(/className="text-\[22px\] font-bold tracking-tight text-\[#001D4A\]"/g, 'className={styles.title}');
content = content.replace(/className="text-\[13px\] text-slate-500 mt-1\.5 leading-relaxed"/g, 'className={styles.subtitle}');
content = content.replace(/className=\{`shrink-0 rounded-full p-2\.5 \$\{mode === 'buyer' \? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'\}`\}/g, 'className={`${styles.refreshButton} ${mode === \'buyer\' ? styles.refreshButtonBuyer : styles.refreshButtonSeller}`}');
content = content.replace(/className="flex p-1\.5 rounded-full bg-slate-100 max-w-full mt-2"/g, 'className={styles.tabsContainer}');

// Tabs
content = content.replace(/className=\{`flex-1 py-3 text-\[13\.5px\] font-bold rounded-full transition-all \$\{statusFilter === 'open' \? \(mode === 'buyer' \? 'bg-blue-500 text-white shadow-sm' : 'bg-\[#10b981\] text-white shadow-sm'\) : 'text-slate-500 hover:text-slate-700'\}`\}/g, 'className={`${styles.tabButton} ${statusFilter === \'open\' ? (mode === \'buyer\' ? styles.tabActiveBuyer : styles.tabActiveSeller) : styles.tabInactive}`}');
content = content.replace(/className=\{`flex-1 py-3 text-\[13\.5px\] font-bold rounded-full transition-all \$\{statusFilter === 'in_progress' \? \(mode === 'buyer' \? 'bg-blue-500 text-white shadow-sm' : 'bg-\[#10b981\] text-white shadow-sm'\) : 'text-slate-500 hover:text-slate-700'\}`\}/g, 'className={`${styles.tabButton} ${statusFilter === \'in_progress\' ? (mode === \'buyer\' ? styles.tabActiveBuyer : styles.tabActiveSeller) : styles.tabInactive}`}');
content = content.replace(/className=\{`flex-1 py-3 text-\[13\.5px\] font-bold rounded-full transition-all \$\{statusFilter === 'closed' \? \(mode === 'buyer' \? 'bg-blue-500 text-white shadow-sm' : 'bg-\[#10b981\] text-white shadow-sm'\) : 'text-slate-500 hover:text-slate-700'\}`\}/g, 'className={`${styles.tabButton} ${statusFilter === \'closed\' ? (mode === \'buyer\' ? styles.tabActiveBuyer : styles.tabActiveSeller) : styles.tabInactive}`}');

// Buttons
content = content.replace(/className="py-3\.5 px-6 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-full text-\[14px\] font-bold transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95 mt-2"/g, 'className={styles.publishButton}');

// Card
content = content.replace(/className="bg-white rounded-3xl p-5 shadow-\[0_2px_10px_-4px_rgba\(0,0,0,0\.05\)\] flex flex-col space-y-3"/g, 'className={styles.card}');
content = content.replace(/className="flex justify-between items-center"/g, 'className={styles.cardHeader}');
content = content.replace(/className=\{`text-\[10px\] px-2\.5 py-1 rounded-md font-bold uppercase tracking-wider \$\{rfq\.status === 'PUBLISHED' \|\| rfq\.status === 'BIDDING_OPEN' \? 'text-emerald-700 bg-emerald-50' : 'text-blue-700 bg-blue-50'\}`\}/g, 'className={`${styles.statusPill} ${rfq.status === \'PUBLISHED\' || rfq.status === \'BIDDING_OPEN\' ? styles.statusPillSeller : styles.statusPillBuyer}`}');
content = content.replace(/className="text-\[11px\] text-gray-400 font-bold"/g, 'className={styles.rfqNumber}');
content = content.replace(/className="font-bold text-\[18px\] text-\[#001D4A\] pt-1"/g, 'className={styles.cardTitle}');
content = content.replace(/className="bg-\[#EFF6FF\] text-\[#3B82F6\] px-2\.5 py-1 rounded-md text-\[11px\] font-semibold flex items-center gap-1"/g, 'className={styles.urgentBadge}');
content = content.replace(/className="bg-emerald-50 text-emerald-600 px-2\.5 py-1 rounded-md text-\[11px\] font-semibold flex items-center gap-1"/g, 'className={styles.urgentBadgeSeller}');
content = content.replace(/className="pt-3 space-y-1 text-\[12px\] text-gray-500 font-medium"/g, 'className={styles.propertiesRow}');
content = content.replace(/className="flex gap-2 pt-3"/g, 'className={styles.actionsRow}');
content = content.replace(/className="flex-1 py-3 bg-\[#EFF6FF\] text-\[#2563EB\] disabled:opacity-60 disabled:cursor-not-allowed rounded-2xl text-\[12px\] font-semibold flex items-center justify-between px-4 transition-all"/g, 'className={styles.compareButton}');
content = content.replace(/className="py-3 px-5 bg-\[#F8FAFC\] text-\[#334155\] border border-slate-200 hover:bg-slate-100 rounded-2xl text-\[13px\] font-semibold flex items-center gap-2 transition-all"/g, 'className={styles.editButton}');


fs.writeFileSync(filePath, content);
console.log('Successfully injected CSS modules into MyRequirementsTab.tsx');
