const fs = require('fs');
const path = require('path');

const appDir = path.join(__dirname, '../../frontend/src/app/dashboard');
const oldPagePath = path.join(appDir, '[[...tab]]/page.tsx');
const layoutPath = path.join(appDir, 'layout.tsx');

let content = fs.readFileSync(oldPagePath, 'utf8');

// Extract the component renders to generate pages
const componentMap = {
  marketplace: 'MarketplaceTab',
  my_rfqs: 'MyRequirementsTab',
  orders: 'PurchaseOrdersTab',
  transporter: 'LocalDeliveryTab',
  admin: 'AdminTab',
  standard_catalog: 'StandardCatalogTab',
  profile: 'ProfileTab',
  requisitions: 'RequisitionsTab',
  catalog: 'CatalogTab',
  company_chat: 'CompanyChatTab'
};

// We will use a DashboardContext to pass all state.
// We need to construct the context object with everything.
const contextVariables = [
  'marketplaceRfqs', 'fetchDataRef', 'mode', 'user', 'handleViewRfqDetails', 'handleStartBidding',
  'rfqs', 'selectedRfqForDetails', 'setSelectedRfqForDetails', 'setShowRfqModal', 'handleSelectWinner', 'handleEditRfq', 'showToast',
  'orders', 'setOrders', 'deliveries', 'setDeliveries', 'adminCompanies', 'adminUsers', 'adminPayments', 'adminInvoices', 
  'refreshCompanyProfile', 'standard_catalog', 'catalogItems', 'setCatalogItems', 'companyComponents', 'companyCategories',
  'prs', 'setPrs', 'chatRealtimeEvent'
];

// Instead of passing manually, we will just pass a generic context object
// But since the current page defines all these in the render scope, we can just pack them into an object.
let ctxObjStr = `{
  marketplaceRfqs, fetchDataRef, mode, user, handleViewRfqDetails, handleStartBidding,
  rfqs, selectedRfqForDetails, setSelectedRfqForDetails, setShowRfqModal, handleSelectWinner, handleEditRfq, showToast,
  orders, setOrders, deliveries, setDeliveries, adminCompanies, adminUsers, adminPayments, adminInvoices, 
  refreshCompanyProfile, catalogItems, setCatalogItems, companyComponents, companyCategories,
  prs, setPrs, chatRealtimeEvent
}`;

// Create layout.tsx content
let layoutContent = content;

// Replace imports
layoutContent = `import React, { createContext, useContext } from 'react';\n` + layoutContent;
layoutContent = layoutContent.replace(/export default function Dashboard\(\) \{/, `export const DashboardContext = createContext<any>(null);\n\nexport default function DashboardLayout({ children }: { children: React.ReactNode }) {`);

// Remove the router redirection in handleTabChange since layout handles it differently?
// Actually handleTabChange is fine, it does `router.push(getRouteForTab(tab))` which works with individual pages!
// Wait, `getRouteForTab` returns `/dashboard/${tab}` so it's perfect.

// Find the render block
const renderBlockStartRegex = /\{activeTab === 'marketplace' && \([\s\S]*?\}\s*<\/main>/;

const renderReplacement = `
        <DashboardContext.Provider value={${ctxObjStr}}>
          {children}
        </DashboardContext.Provider>
      </main>
`;

layoutContent = layoutContent.replace(renderBlockStartRegex, renderReplacement);

// Write layout.tsx
fs.writeFileSync(layoutPath, layoutContent);
console.log('Created layout.tsx');

// Now create the individual pages
for (const [route, component] of Object.entries(componentMap)) {
  const pageDir = path.join(appDir, route);
  if (!fs.existsSync(pageDir)) fs.mkdirSync(pageDir, { recursive: true });
  
  const propsMatch = content.match(new RegExp(`<${component}\\s+([^>]+)\\/>`));
  
  let propAssignments = '';
  if (propsMatch) {
     const propsStr = propsMatch[1];
     // Ex: rfqs={marketplaceRfqs} fetchData={() => fetchDataRef.current()}
     // We will extract these and use the context variables
     const propPairs = propsStr.match(/(\w+)=\{([^}]+)\}/g);
     if (propPairs) {
         propAssignments = propPairs.map(p => {
             const [key, valStr] = p.split('=');
             // valStr is like {marketplaceRfqs} or {() => fetchDataRef.current()}
             // We can just use the exact valStr, since those variables are in the context scope!
             // Wait, the variables need to come from the context: `const ctx = useContext(DashboardContext);`
             // Then we can spread `ctx` or pull from `ctx.xyz`.
             // But it's easier to just spread ctx if we name things right, but they are named differently!
             // So we pull them from ctx:
             const newValStr = valStr.replace(/([a-zA-Z0-9_]+)/g, (match) => {
                 if (['mode', 'user', 'rfqs', 'marketplaceRfqs', 'fetchDataRef', 'selectedRfqForDetails', 'setSelectedRfqForDetails', 'setShowRfqModal', 'handleSelectWinner', 'handleViewRfqDetails', 'handleEditRfq', 'showToast', 'handleStartBidding', 'orders', 'setOrders', 'deliveries', 'setDeliveries', 'adminCompanies', 'adminUsers', 'adminPayments', 'adminInvoices', 'refreshCompanyProfile', 'catalogItems', 'setCatalogItems', 'companyComponents', 'companyCategories', 'prs', 'setPrs', 'chatRealtimeEvent'].includes(match)) {
                     return `ctx.${match}`;
                 }
                 return match;
             });
             return `${key}=${newValStr}`;
         }).join(' ');
     }
  }

  const pageContent = `'use client';
import { useContext } from 'react';
import { DashboardContext } from '../layout';
import ${component} from '../components/${component}';

export default function ${component}Page() {
  const ctx = useContext(DashboardContext);
  if (!ctx) return null; // Wait for layout to mount

  return <${component} ${propAssignments} />;
}
`;
  
  fs.writeFileSync(path.join(pageDir, 'page.tsx'), pageContent);
  console.log(`Created ${route}/page.tsx`);
}

// Rename [[...tab]] to backup so Next.js doesn't get confused
fs.renameSync(path.join(appDir, '[[...tab]]'), path.join(appDir, '[[...tab]]_backup'));
console.log('Renamed [[...tab]] to [[...tab]]_backup');
