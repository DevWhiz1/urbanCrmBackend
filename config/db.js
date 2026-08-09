// config/db.js
const mongoose = require('mongoose');

let cached = global._mongoConn;

const connectDB = async () => {
  if (cached) return cached;
  
  try {
    const conn = await mongoose.connect(process.env.Database_Connection_String, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log(`MongoDB Connected`);
    cached = conn;
    global._mongoConn = cached;
    return conn;
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    // Do not terminate a serverless function process. Terminating here turns
    // every request (including CORS preflight) into FUNCTION_INVOCATION_FAILED.
    throw error;
  }
};

module.exports = connectDB;
