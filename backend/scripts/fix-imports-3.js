const fs = require('fs');
const path = require('path');

const replacements = [
  {
    file: 'src/app/api/v1/marketplace/requirements/route.ts',
    replaces: [
      { from: /const { RFQ, RFQItem, Bid: RFQBid } = await import\('@\/models\/Bid'\);/g, to: "const { RFQ, RFQItem } = await import('@/models/RFQ');\n    const { Bid: RFQBid } = await import('@/models/Bid');" }
    ]
  },
  {
    file: 'src/app/api/v1/rfqs/[id]/items/[rfqItemId]/bids/[bidId]/select/route.ts',
    replaces: [
      { from: /const { RFQ, RFQItem, Bid } = await import\('@\/models\/RFQ'\);/g, to: "const { RFQ, RFQItem } = await import('@/models/RFQ');\n    const { Bid } = await import('@/models/Bid');" },
      { from: /const { RFQ, RFQItem, Bid } = await import\('@\/models\/Bid'\);/g, to: "const { RFQ, RFQItem } = await import('@/models/RFQ');\n    const { Bid } = await import('@/models/Bid');" }
    ]
  },
  {
    file: 'src/app/api/v1/rfqs/[id]/items/[rfqItemId]/bids/route.ts',
    replaces: [
      { from: /const { RFQ, RFQItem, Bid } = await import\('@\/models\/RFQ'\);/g, to: "const { RFQ, RFQItem } = await import('@/models/RFQ');\n    const { Bid } = await import('@/models/Bid');" },
      { from: /const { RFQ, RFQItem, Bid } = await import\('@\/models\/Bid'\);/g, to: "const { RFQ, RFQItem } = await import('@/models/RFQ');\n    const { Bid } = await import('@/models/Bid');" }
    ]
  },
  {
    file: 'src/app/api/v1/rfqs/[id]/select-bids/route.ts',
    replaces: [
      { from: /const { RFQ, RFQItem, Bid } = await import\('@\/models\/RFQ'\);/g, to: "const { RFQ, RFQItem } = await import('@/models/RFQ');\n    const { Bid } = await import('@/models/Bid');" },
      { from: /const { RFQ, RFQItem, Bid } = await import\('@\/models\/Bid'\);/g, to: "const { RFQ, RFQItem } = await import('@/models/RFQ');\n    const { Bid } = await import('@/models/Bid');" }
    ]
  },
  {
    file: 'src/app/api/v1/rfqs/[id]/route.ts',
    replaces: [
      { from: /\(item\) =>/g, to: "(item: any) =>" }
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
