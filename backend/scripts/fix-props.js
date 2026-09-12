const fs = require('fs');
const path = require('path');

const appDashboardDir = path.join(__dirname, '../../frontend/src/app/dashboard');
const dirs = fs.readdirSync(appDashboardDir, { withFileTypes: true }).filter(d => d.isDirectory() && !d.name.includes('components') && !d.name.includes('backup'));

for (const dir of dirs) {
  const pagePath = path.join(appDashboardDir, dir.name, 'page.tsx');
  if (fs.existsSync(pagePath)) {
    let content = fs.readFileSync(pagePath, 'utf8');
    
    // Replace missing ctx.
    content = content.replace(/fetchData=\{fetchData\}/g, 'fetchData={() => ctx.fetchDataRef.current()}');
    
    const missingContextVars = ['selectedRfqForBidding', 'setSelectedRfqForBidding', 'bidInputs', 'setBidInputs', 'handleSubmitBid', 'handleWithdrawBid', 'handleStartProcessing', 'handleReadyForPickup', 'handleConfirmDelivery', 'handleUpdateDeliveryStatus', 'handleVerifyDeliveryOtp', 'submittingActions'];
    
    missingContextVars.forEach(v => {
      content = content.replace(new RegExp(`${v}=\\{${v}\\}`, 'g'), `${v}={ctx.${v}}`);
    });

    content = content.replace(/setActiveTab=\{handleTabChange\}/g, 'setActiveTab={ctx.handleTabChange}');

    fs.writeFileSync(pagePath, content);
  }
}

console.log('Fixed props in page.tsx files');
