const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
db.purchaseOrder.findMany().then(orders => {
  console.log('Total orders:', orders.length);
  orders.forEach(o => {
    console.log(`Order ID: ${o.id}, Status: ${o.status}, workImage20: ${o.workImage20}, workImage40: ${o.workImage40}`);
  });
}).catch(console.error).finally(() => db.$disconnect());
