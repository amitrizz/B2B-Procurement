const mongoose = require('mongoose');
const crypto = require('crypto');

mongoose.connect('mongodb://127.0.0.1:27017/p2p-procurement').then(async () => {
  const db = mongoose.connection.db;
  
  const otp = '123456';
  const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
  
  const res = await db.collection('deliveryorders').updateMany(
    { },
    { $set: { otp: otp, otpHash: otpHash } }
  );
  console.log('Fixed OTPs:', res.modifiedCount);
  process.exit(0);
});
