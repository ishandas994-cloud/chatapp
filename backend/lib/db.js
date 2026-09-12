const mongoose = require('mongoose');

let isConnected = false;
let connecting = null;

mongoose.connection.on('connected', () => { isConnected = true; });
mongoose.connection.on('disconnected', () => { isConnected = false; });

const connectDB = async () => {
  if (isConnected) return;
  // If a connection is already in progress, wait for it instead of racing
  if (connecting) return connecting;

  const uri = process.env.MONGO_URI;

  if (!uri) {
    console.error('❌ MONGO_URI is not set in environment variables');
    throw new Error('MONGO_URI is not set');
  }

  connecting = mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: 1,
  });

  try {
    const conn = await connecting;
    isConnected = true;
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    connecting = null;
    console.error('❌ MongoDB error:', err.message);
    throw err;
  } finally {
    connecting = null;
  }
};

module.exports = connectDB;