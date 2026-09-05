import mongoose from 'mongoose';

/** Replace legacy sparse unique indexes that rejected multiple sample deliveries (purchaseOrderId: null). */
export async function syncDeliveryOrderIndexes() {
  const { DeliveryOrder } = await import('@/models/Logistics');
  const collection = mongoose.connection.collection('deliveryorders');

  for (const indexName of ['purchaseOrderId_1', 'samplingInviteId_1']) {
    try {
      await collection.dropIndex(indexName);
      console.log(`[DeliveryOrder] Dropped legacy index ${indexName}`);
    } catch {
      // Index may not exist or already replaced
    }
  }

  await DeliveryOrder.syncIndexes();
  console.log('[DeliveryOrder] Indexes synced');
}
