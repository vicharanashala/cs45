const mongoose = require('mongoose');

async function run() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/faq-platform');
    const db = mongoose.connection.db;
    const res = await db.collection('users').updateOne(
      { email: 'seedadmin@test.com' },
      { $set: { role: 'admin' } }
    );
    console.log("Modified:", res.modifiedCount);
  } catch (error) {
    console.error(error);
  } finally {
    await mongoose.disconnect();
  }
}

run();
