const fs = require('fs');
const path = require('path');

const layoutPath = path.join(__dirname, '../../frontend/src/app/dashboard/layout.tsx');
let content = fs.readFileSync(layoutPath, 'utf8');

const startIndex = content.indexOf('{/* Publish RFQ Modal */}');
const endIndex = content.indexOf('{/* Toast Container */}');

if (startIndex !== -1 && endIndex !== -1) {
  let modalContent = content.substring(startIndex, endIndex);

  // Backgrounds
  modalContent = modalContent.replace(/bg-slate-950\/80/g, 'bg-slate-900/40');
  modalContent = modalContent.replace(/bg-slate-900/g, 'bg-white');
  modalContent = modalContent.replace(/bg-slate-950\/50/g, 'bg-slate-50');
  modalContent = modalContent.replace(/bg-slate-950/g, 'bg-white');
  
  // Borders
  modalContent = modalContent.replace(/border-white\/10/g, 'border-slate-200');
  modalContent = modalContent.replace(/border-white\/5/g, 'border-slate-100');
  
  // Text colors
  modalContent = modalContent.replace(/text-white/g, 'text-[var(--text-title)]');
  modalContent = modalContent.replace(/text-slate-200/g, 'text-[var(--text-normal)]');
  modalContent = modalContent.replace(/text-slate-300/g, 'text-[var(--text-normal)]');
  modalContent = modalContent.replace(/text-slate-400/g, 'text-[var(--text-subtitle)]');
  modalContent = modalContent.replace(/text-slate-500/g, 'text-[var(--text-subtitle)]');
  
  // Specific alerts
  modalContent = modalContent.replace(/bg-yellow-500\/10/g, 'bg-yellow-50');
  modalContent = modalContent.replace(/border-yellow-500\/20/g, 'border-yellow-200');
  modalContent = modalContent.replace(/text-yellow-500/g, 'text-yellow-700');
  
  // Buttons
  // The submit button is blue-600. Let's make it theme-aware using arbitrary variable syntax
  modalContent = modalContent.replace(/bg-blue-600/g, 'bg-[var(--buyer-primary)]');
  modalContent = modalContent.replace(/hover:bg-blue-700/g, 'hover:opacity-90');
  
  // We need to restore 'text-[var(--text-title)]' on the primary button back to 'text-white'
  // because bg-[var(--buyer-primary)] needs white text.
  modalContent = modalContent.replace(/text-\[var\(--text-title\)\] rounded-xl text-xs font-semibold flex items-center/g, 'text-white rounded-xl text-xs font-semibold flex items-center');

  content = content.substring(0, startIndex) + modalContent + content.substring(endIndex);
  fs.writeFileSync(layoutPath, content);
  console.log("Modal theme patched successfully.");
} else {
  console.error("Modal section not found in layout.tsx");
}
