const fs = require('fs');
const path = require('path');

const frontendDir = path.join(__dirname, '../../frontend');

// 1. Fix views/rfqs/index.tsx missing styles import
const rfqsIndex = path.join(frontendDir, 'src/views/rfqs/index.tsx');
let rfqsContent = fs.readFileSync(rfqsIndex, 'utf8');
if (!rfqsContent.includes("import styles from './index.module.scss'")) {
  rfqsContent = rfqsContent.replace(
    "import { useState, useEffect } from 'react';", 
    "import { useState, useEffect } from 'react';\nimport styles from './index.module.scss';"
  );
  fs.writeFileSync(rfqsIndex, rfqsContent);
  console.log('Fixed rfqs/index.tsx');
}

// 2. Fix layout.tsx containing the old rendering block
const layoutPath = path.join(frontendDir, 'src/app/dashboard/layout.tsx');
let layoutContent = fs.readFileSync(layoutPath, 'utf8');

// Find where DashboardContext.Provider is. My refactor-routing.js injected:
// <DashboardContext.Provider value={...}>
//   {children}
// </DashboardContext.Provider>
// If it's there, then the old components might STILL be there.
// Let's just remove the entire switch block.
// The old block started with `{/* Tab content switcher */}`
const startMarker = "{/* Tab content switcher */}";
const endMarker = "</main>";

const startIndex = layoutContent.indexOf(startMarker);
if (startIndex !== -1) {
  // We want to delete from startMarker to right before </main>
  // Wait, the injected DashboardContext might be inside there or before it.
  // Let's just rewrite the end of the file from `</nav>` or whatever.
  
  // It's easier to just use regex to strip out all `{activeTab === '...' && (...)}`
  const tabs = ['marketplace', 'my_rfqs', 'orders', 'transporter', 'admin_users', 'admin', 'standard_catalog', 'profile', 'requisitions', 'catalog', 'company_chat'];
  
  for (const tab of tabs) {
    // A regex to match {activeTab === 'tab' && ( ... )}
    // This is tricky because of nested braces.
    // Since we know the exact components, let's just delete them.
  }
}

// Actually, since I have full control, I can write a regex that matches from `{activeTab === 'marketplace'` down to the end of the last tab.
const regex = /\{activeTab === 'marketplace' && \([\s\S]*?\{activeTab === 'company_chat' && \([\s\S]*?\)\}/;
if (regex.test(layoutContent)) {
  layoutContent = layoutContent.replace(regex, "");
  fs.writeFileSync(layoutPath, layoutContent);
  console.log('Removed old tabs from layout.tsx');
} else {
  console.log('Regex failed to match old tabs in layout.tsx');
}
