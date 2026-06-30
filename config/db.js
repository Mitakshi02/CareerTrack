const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const connectDB = async () => {
  try {
    const connUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/job-tracker';
    console.log(`Attempting to connect to MongoDB at ${connUri}...`);
    
    // Set a short connection timeout so we don't hang if MongoDB is offline
    await mongoose.connect(connUri, {
      serverSelectionTimeoutMS: 3000
    });
    console.log(`MongoDB Connected: ${mongoose.connection.host}`);
  } catch (err) {
    console.warn(`\n[WARNING] Could not connect to standard MongoDB: ${err.message}`);
    console.log('Spinning up an in-memory MongoDB fallback server... (This may take a moment on first boot)');
    try {
      const mongod = await MongoMemoryServer.create();
      const uri = mongod.getUri();
      
      await mongoose.connect(uri);
      console.log('MongoDB Connected successfully to In-Memory instance!');
      console.log(`MongoDB Uri: ${uri}\n`);
      
      // Store the server instance in global so it can be terminated on process exit
      global.__MONGOD__ = mongod;
    } catch (memErr) {
      console.error(`Fatal: Failed to start in-memory MongoDB server: ${memErr.message}`);
      process.exit(1);
    }
  }
};

module.exports = connectDB;
