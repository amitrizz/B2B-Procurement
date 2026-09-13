const mongoose = require('mongoose');
require('dotenv').config();

async function cleanDuplicates() {
  await mongoose.connect(process.env.DATABASE_URL);
  console.log('Connected to MongoDB');

  const coll = mongoose.connection.collection('Notification');
  const allNotifs = await coll.find({}).sort({ createdAt: -1 }).toArray();
  console.log('Total notifications before cleanup:', allNotifs.length);

  const seen = new Map();
  const idsToDelete = [];
  const idsToMarkRead = [];

  for (const n of allNotifs) {
    // Generate unique key for each distinct notification
    const sourceId = n.meta?.sourceId || n.meta?.rfqNumber || n.meta?.poNumber || n.meta?.deliveryNumber || n.message;
    const key = `${n.companyId || n.userId}_${n.type}_${sourceId}`;

    if (!seen.has(key)) {
      seen.set(key, n);
    } else {
      // Duplicate found!
      const existing = seen.get(key);
      // If any copy was marked read, ensure the preserved one stays read
      if (n.read && !existing.read) {
        existing.read = true;
        idsToMarkRead.push(existing._id);
      }
      idsToDelete.push(n._id);
    }
  }

  console.log(`Found ${idsToDelete.length} duplicates to delete, keeping ${seen.size} unique notifications.`);

  if (idsToMarkRead.length > 0) {
    await coll.updateMany({ _id: { $in: idsToMarkRead } }, { $set: { read: true } });
    console.log(`Updated ${idsToMarkRead.length} notifications to read: true`);
  }

  if (idsToDelete.length > 0) {
    // Delete in batches of 500
    for (let i = 0; i < idsToDelete.length; i += 500) {
      const batch = idsToDelete.slice(i, i + 500);
      await coll.deleteMany({ _id: { $in: batch } });
    }
    console.log(`Deleted ${idsToDelete.length} duplicate notifications.`);
  }

  const remaining = await coll.countDocuments();
  console.log('Total notifications after cleanup:', remaining);

  await mongoose.disconnect();
  console.log('Disconnected');
}

cleanDuplicates().catch(err => {
  console.error(err);
  process.exit(1);
});
