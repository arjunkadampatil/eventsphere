const mongoose = require('mongoose');

mongoose.set('strictQuery', true);

async function connectDb(uri) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  return mongoose.connection;
}

module.exports = { connectDb };
