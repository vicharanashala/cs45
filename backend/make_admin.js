const mongoose = require('mongoose');

mongoose.connect('mongodb://remy03828_db_user:ftzbJCkRxgZZtgmx@ac-u3esotj-shard-00-00.ef8lsg3.mongodb.net:27017,ac-u3esotj-shard-00-01.ef8lsg3.mongodb.net:27017,ac-u3esotj-shard-00-02.ef8lsg3.mongodb.net:27017/faq-platform?ssl=true&replicaSet=atlas-lmpoim-shard-0&authSource=admin&appName=Cluster0')
  .then(async () => {
    await mongoose.connection.collection('users').updateOne({ email: 'admin@yaksha.in' }, { $set: { role: 'admin' } });
    console.log('Admin role updated');
    process.exit(0);
  });
