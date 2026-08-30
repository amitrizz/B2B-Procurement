const fs = require('fs');
const path = require('path');

const replacements = [
  {
    file: 'src/app/api/v1/auth/verify-email/route.ts',
    replaces: [
      { from: /import\('@\/models\/Platform'\)/g, to: "import('@/models/User')" }
    ]
  },
  {
    file: 'src/app/api/v1/catalog/route.ts',
    replaces: [
      { from: /import\('@\/models\/RFQ'\)/g, to: "import('@/models/Catalog')" }
    ]
  },
  {
    file: 'src/app/api/v1/company/invites/route.ts',
    replaces: [
      { from: /import\('@\/models\/Platform'\)/g, to: "import('@/models/User')" }
    ]
  },
  {
    file: 'src/app/api/v1/company/me/bank/route.ts',
    replaces: [
      { from: /CompanyBank/g, to: "CompanyBankAccount" }
    ]
  },
  {
    file: 'src/app/api/v1/orders/[id]/accept/route.ts',
    replaces: [
      { from: /CompanyBank/g, to: "CompanyBankAccount" }
    ]
  },
  {
    file: 'src/app/api/v1/marketplace/requirements/route.ts',
    replaces: [
      { from: /const { RFQBid } = await import\('@\/models\/RFQ'\);/g, to: "const { Bid: RFQBid } = await import('@/models/Bid');" }
    ]
  },
  {
    file: 'src/app/api/v1/orders/[id]/amend/route.ts',
    replaces: [
      { from: /POItem/g, to: "PurchaseOrderItem" }
    ]
  },
  {
    file: 'src/app/api/v1/orders/[id]/confirm-delivery/route.ts',
    replaces: [
      { from: /import\('@\/models\/Logistics'\)/g, to: "import('@/models/PurchaseOrder')" }
    ]
  },
  {
    file: 'src/app/api/v1/orders/[id]/generate-invoice/route.ts',
    replaces: [
      { from: /POItem/g, to: "PurchaseOrderItem" }
    ]
  },
  {
    file: 'src/app/api/v1/orders/from-catalog/route.ts',
    replaces: [
      { from: /const { CatalogItem } = await import\('@\/models\/RFQ'\);/g, to: "const { CatalogItem } = await import('@/models/Catalog');" },
      { from: /const { PurchaseRequisition } = await import\('@\/models\/Finance'\);/g, to: "const { PurchaseRequisition } = await import('@/models/Catalog');" },
      { from: /POItem/g, to: "PurchaseOrderItem" }
    ]
  },
  {
    file: 'src/app/api/v1/prs/[id]/approve/route.ts',
    replaces: [
      { from: /import\('@\/models\/PurchaseOrder'\)/g, to: "import('@/models/Catalog')" }
    ]
  },
  {
    file: 'src/app/api/v1/prs/route.ts',
    replaces: [
      { from: /const { PurchaseRequisition } = await import\('@\/models\/PurchaseOrder'\);/g, to: "const { PurchaseRequisition, PurchaseRequisitionLine: PRLine } = await import('@/models/Catalog');" },
      { from: /const { ApprovalRule } = await import\('@\/models\/Platform'\);/g, to: "const { ApprovalRule } = await import('@/models/Catalog');" },
      { from: /PRLine/g, to: "PRLine" }, // Already mapped
      { from: /\(l\) =>/g, to: "(l: any) =>" }
    ]
  },
  {
    file: 'src/app/api/v1/rfqs/[id]/items/[rfqItemId]/bids/[bidId]/select/route.ts',
    replaces: [
      { from: /const { Bid } = await import\('@\/models\/RFQ'\);/g, to: "const { Bid } = await import('@/models/Bid');" },
      { from: /POItem/g, to: "PurchaseOrderItem" },
      { from: /await RFQ\.updateOne\(\n      { _id: rfq\._id },\n      { \$set: { status: 'COMPLETED' } }\n    \);/g, to: "await RFQ.updateOne(\n      { _id: rfq._id },\n      { $set: { status: 'COMPLETED' } }, { session }\n    );" },
      { from: /await Bid\.updateMany\(\n      { rfqItemId, _id: { \$ne: bidId } },\n      { \$set: { status: 'REJECTED' } }\n    \);/g, to: "await Bid.updateMany(\n      { rfqItemId, _id: { $ne: bidId } },\n      { $set: { status: 'REJECTED' } }, { session }\n    );" }
    ]
  },
  {
    file: 'src/app/api/v1/rfqs/[id]/items/[rfqItemId]/bids/route.ts',
    replaces: [
      { from: /const { Bid } = await import\('@\/models\/RFQ'\);/g, to: "const { Bid } = await import('@/models/Bid');" }
    ]
  },
  {
    file: 'src/app/api/v1/rfqs/[id]/route.ts',
    replaces: [
      { from: /\(item\) =>/g, to: "(item: any) =>" }
    ]
  },
  {
    file: 'src/app/api/v1/rfqs/[id]/select-bids/route.ts',
    replaces: [
      { from: /const { Bid } = await import\('@\/models\/RFQ'\);/g, to: "const { Bid } = await import('@/models/Bid');" },
      { from: /POItem/g, to: "PurchaseOrderItem" }
    ]
  },
  {
    file: 'src/app/api/v1/rfqs/my-bids/route.ts',
    replaces: [
      { from: /import\('@\/models\/RFQ'\)/g, to: "import('@/models/Bid')" }
    ]
  },
  {
    file: 'src/app/api/v1/rfqs/route.ts',
    replaces: [
      { from: /const { PurchaseRequisition } = await import\('@\/models\/PurchaseOrder'\);/g, to: "const { PurchaseRequisition } = await import('@/models/Catalog');" }
    ]
  },
  {
    file: 'src/lib/notify.ts',
    replaces: [
      { from: /await db\.notification\.create/g, to: "const { Notification } = await import('@/models/User');\n    await Notification.create" },
      { from: /await db\.user\.findUnique/g, to: "const { User } = await import('@/models/User');\n    const user = await User.findById" },
      { from: /\(u\) =>/g, to: "(u: any) =>" }
    ]
  },
  {
    file: 'src/lib/sequence.ts',
    replaces: [
      { from: /db\.numberSequence\.findUnique/g, to: "NumberSequence.findOne" },
      { from: /db\.numberSequence\.create/g, to: "NumberSequence.create" },
      { from: /db\.numberSequence\.update/g, to: "NumberSequence.findOneAndUpdate" },
      { from: /db\.numberSequence\.upsert/g, to: "NumberSequence.findOneAndUpdate" },
      { from: /import { db } from '\.\/db';/g, to: "import { db } from './db';\nimport mongoose from 'mongoose';" },
      { from: /await db\(\);/g, to: "await db();\n  const { NumberSequence } = await import('@/models/Platform');" }
    ]
  }
];

async function run() {
  for (const { file, replaces } of replacements) {
    const fullPath = path.join(__dirname, '..', file);
    if (!fs.existsSync(fullPath)) {
      console.log(`Skipping ${fullPath} - does not exist`);
      continue;
    }
    
    let content = fs.readFileSync(fullPath, 'utf8');
    for (const { from, to } of replaces) {
      content = content.replace(from, to);
    }
    
    fs.writeFileSync(fullPath, content);
    console.log(`Updated ${file}`);
  }
}

run();
