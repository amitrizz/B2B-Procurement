const fs = require('fs');
const path = require('path');

const layoutPath = path.join(__dirname, '../../frontend/src/app/dashboard/layout.tsx');
let content = fs.readFileSync(layoutPath, 'utf8');

const startMarker = "{/* Tab content switcher */}";
const endMarker = "{/* Bottom Navigation Bar (Mobile) */}";

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex !== -1 && endIndex !== -1) {
  // Extract all the variables that need to go into the context
  const contextVars = `
  marketplaceRfqs, selectedRfqForBidding, setSelectedRfqForBidding, bidInputs, setBidInputs, handleStartBidding, handleSubmitBid, handleWithdrawBid, fetchDataRef, mode, user, handleTabChange, setSelectedRfqForDetails, submittingActions, companyComponents, companyCategories, showToast, rfqs, selectedRfqForDetails, setShowRfqModal, handleEditRfq, handleSelectWinner, handleViewRfqDetails, orders, deliveries, adminCompanies, adminUsers, adminPayments, adminInvoices, refreshCompanyProfile, catalogItems, prs, chatRealtimeEvent, setPrs, setOrders, setDeliveries, setCatalogItems
  `;
  
  const ctxObjStr = `{ ${contextVars} }`;
  
  const replacement = `
        <DashboardContext.Provider value={${ctxObjStr}}>
          {children}
        </DashboardContext.Provider>

      </div>

      `;
      
  const before = content.substring(0, startIndex);
  const after = content.substring(endIndex);
  
  fs.writeFileSync(layoutPath, before + replacement + after);
  console.log('Fixed layout.tsx rendering block');
} else {
  console.log('Could not find markers in layout.tsx');
}
