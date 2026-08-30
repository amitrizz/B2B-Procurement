const fs = require('fs');
const path = require('path');

const replacements = [
  {
    file: 'src/app/api/v1/admin/companies/[id]/suspend/route.ts',
    replaces: [
      { from: /, requireRole/g, to: "" }
    ]
  },
  {
    file: 'src/app/api/v1/admin/payments/[id]/release/route.ts',
    replaces: [
      { from: /POItem/g, to: "PurchaseOrderItem" },
      { from: /const { GoodsReceipt } = await import\('@\/models\/Logistics'\);/g, to: "const { GoodsReceipt } = await import('@/models/PurchaseOrder');" }
    ]
  },
  {
    file: 'src/app/api/v1/auth/change-password/route.ts',
    replaces: [
      { from: /import\('@\/models\/Platform'\)/g, to: "import('@/models/User')" }
    ]
  },
  {
    file: 'src/app/api/v1/auth/forgot-password/route.ts',
    replaces: [
      { from: /import\('@\/models\/Platform'\)/g, to: "import('@/models/User')" }
    ]
  },
  {
    file: 'src/app/api/v1/auth/refresh/route.ts',
    replaces: [
      { from: /import\('@\/models\/Platform'\)/g, to: "import('@/models/User')" }
    ]
  },
  {
    file: 'src/app/api/v1/auth/reset-password/route.ts',
    replaces: [
      { from: /import\('@\/models\/Platform'\)/g, to: "import('@/models/User')" }
    ]
  },
  {
    file: 'src/app/api/v1/marketplace/requirements/route.ts',
    replaces: [
      { from: /import\('@\/models\/RFQ'\)/g, to: "import('@/models/Bid')" },
      { from: /const { RFQBid }/g, to: "const { Bid: RFQBid }" }
    ]
  },
  {
    file: 'src/app/api/v1/prs/route.ts',
    replaces: [
      { from: /import\('@\/models\/PurchaseOrder'\)/g, to: "import('@/models/Catalog')" },
      { from: /PRLine/g, to: "PurchaseRequisitionLine" },
      { from: /\(l\) =>/g, to: "(l: any) =>" }
    ]
  },
  {
    file: 'src/app/api/v1/rfqs/[id]/items/[rfqItemId]/bids/[bidId]/select/route.ts',
    replaces: [
      { from: /const { Bid } = await import\('@\/models\/RFQ'\);/g, to: "const { Bid } = await import('@/models/Bid');" },
      { from: /await RFQ\.updateOne\(\n      { _id: rfq\._id },\n      { \$set: { status: 'COMPLETED' } }, { session }\n    \);/g, to: "await RFQ.updateOne(\n      { _id: rfq._id },\n      { $set: { status: 'COMPLETED' } }, { session }\n    );" },
      { from: /await Bid\.updateMany\(\n      { rfqItemId, _id: { \$ne: bidId } },\n      { \$set: { status: 'REJECTED' } }, { session }\n    \);/g, to: "await Bid.updateMany(\n      { rfqItemId, _id: { $ne: bidId } },\n      { $set: { status: 'REJECTED' } }, { session }\n    );" }
    ]
  },
  {
    file: 'src/app/api/v1/rfqs/[id]/items/[rfqItemId]/bids/route.ts',
    replaces: [
      { from: /const { Bid } = await import\('@\/models\/RFQ'\);/g, to: "const { Bid } = await import('@/models/Bid');" }
    ]
  },
  {
    file: 'src/app/api/v1/rfqs/[id]/select-bids/route.ts',
    replaces: [
      { from: /const { Bid } = await import\('@\/models\/RFQ'\);/g, to: "const { Bid } = await import('@/models/Bid');" }
    ]
  },
  {
    file: 'src/lib/notify.ts',
    replaces: [
      { from: /createMany/g, to: "insertMany" }
    ]
  },
  {
    file: 'src/lib/sequence.ts',
    replaces: [
      { from: /await db\(\);\n  const { NumberSequence } = await import\('@\/models\/Platform'\);/g, to: "import { NumberSequence } from '@/models/Platform';\n" },
      { from: /import { db } from '\.\/db';\nimport mongoose from 'mongoose';/g, to: "import { db } from './db';\nimport mongoose from 'mongoose';\nimport { NumberSequence } from '@/models/Platform';" }
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
