const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearDb() {
  try {
    // Delete all records from collections that Prisma knows about
    console.log("Wiping collections...");
    const models = [
      'user', 'company', 'companyAddress', 'companyDocument', 'companyBankAccount', 
      'rFQ', 'rFQItem', 'bid', 'purchaseOrder', 'purchaseOrderItem', 'deliveryOrder',
      'review', 'dispute', 'milestone', 'payment', 'invoice', 'invoiceLine',
      'ledgerEntry', 'goodsReceipt', 'auditLog', 'platformConfig', 'companyCapability',
      'rfqQuestion', 'purchaseRequisition', 'purchaseRequisitionLine', 'approvalRule',
      'catalogItem', 'purchaseOrderRevision', 'creditNote', 'refreshToken'
    ];
    for (const model of models) {
      if (prisma[model]) {
        try {
          await prisma[model].deleteMany({});
          console.log(`Cleared ${model}`);
        } catch (e) {
          // ignore
        }
      }
    }
    console.log("All known collections cleared.");
  } catch (error) {
    console.error("Error clearing DB:", error);
  } finally {
    await prisma.$disconnect();
  }
}

clearDb();
