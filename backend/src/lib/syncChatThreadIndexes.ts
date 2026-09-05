import mongoose from 'mongoose';

const COMPOUND_INDEX = 'purchaseOrderId_1_purpose_1';
const LEGACY_INDEX = 'purchaseOrderId_1';

let chatIndexesSynced = false;

async function listChatThreadIndexes() {
  const collection = mongoose.connection.collection('companychatthreads');
  return collection.indexes();
}

function hasIndex(indexes: { name?: string }[], name: string) {
  return indexes.some((idx) => idx.name === name);
}

/** Assign ORDER_STATUS / REPEAT_ORDER when older threads were saved without purpose. */
async function backfillThreadPurposes() {
  const collection = mongoose.connection.collection('companychatthreads');
  const threads = await collection.find({}).sort({ createdAt: 1 }).toArray();
  const byPo = new Map<string, (typeof threads)[number][]>();

  for (const thread of threads) {
    const po = thread.purchaseOrderId.toString();
    const group = byPo.get(po) ?? [];
    group.push(thread);
    byPo.set(po, group);
  }

  for (const group of byPo.values()) {
    let hasOrderStatus = group.some((t) => t.purpose === 'ORDER_STATUS');

    for (const thread of group) {
      if (thread.purpose === 'ORDER_STATUS' || thread.purpose === 'REPEAT_ORDER') {
        continue;
      }

      const purpose = hasOrderStatus ? 'REPEAT_ORDER' : 'ORDER_STATUS';
      await collection.updateOne({ _id: thread._id }, { $set: { purpose } });
      if (purpose === 'ORDER_STATUS') {
        hasOrderStatus = true;
      }
    }
  }
}

/** Drop legacy unique index on purchaseOrderId alone; enforce PO + purpose compound unique key. */
export async function syncChatThreadIndexes(force = false) {
  if (!mongoose.connection?.db) return;

  const indexes = await listChatThreadIndexes();
  const legacyPresent = hasIndex(indexes, LEGACY_INDEX);
  const compoundPresent = hasIndex(indexes, COMPOUND_INDEX);

  if (chatIndexesSynced && !force && !legacyPresent && compoundPresent) {
    await backfillThreadPurposes();
    return;
  }

  const collection = mongoose.connection.collection('companychatthreads');

  if (legacyPresent) {
    try {
      await collection.dropIndex(LEGACY_INDEX);
      console.log(`[CompanyChatThread] Dropped legacy index ${LEGACY_INDEX}`);
    } catch {
      // Index may have been removed concurrently
    }
  }

  await backfillThreadPurposes();

  await collection.createIndex(
    { purchaseOrderId: 1, purpose: 1 },
    { unique: true, name: COMPOUND_INDEX }
  );

  if (mongoose.models.CompanyChatThread) {
    delete mongoose.models.CompanyChatThread;
  }

  const { getCompanyChatThreadModel } = await import('@/models/Chat');
  await getCompanyChatThreadModel().syncIndexes();

  const afterIndexes = await listChatThreadIndexes();
  if (hasIndex(afterIndexes, LEGACY_INDEX)) {
    try {
      await collection.dropIndex(LEGACY_INDEX);
      console.warn(`[CompanyChatThread] Removed ${LEGACY_INDEX} recreated by stale schema cache`);
    } catch {
      // ignore
    }
  }

  chatIndexesSynced = true;
  console.log('[CompanyChatThread] Indexes synced (purchaseOrderId + purpose)');
}
