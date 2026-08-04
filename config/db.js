// config/db.js
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.Database_Connection_String, {
    });

    console.log(`MongoDB Connected`);
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    // Do not terminate a serverless function process. Terminating here turns
    // every request (including CORS preflight) into FUNCTION_INVOCATION_FAILED.
    throw error;
  }
};

module.exports = connectDB;
