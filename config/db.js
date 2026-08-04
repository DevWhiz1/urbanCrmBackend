// config/db.js
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.Database_Connection_String, {
    });

    console.log(`MongoDB Connected`);
    
    // Drop legacy indexes
    try {
      await mongoose.connection.collection('employees').dropIndex('employeeId_1');
      console.log('Dropped employeeId_1 index');
    } catch (e) {}
    try {
      await mongoose.connection.collection('expenses').dropIndex('expenseId_1');
      console.log('Dropped expenseId_1 index');
    } catch (e) {}
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    // Do not terminate a serverless function process. Terminating here turns
    // every request (including CORS preflight) into FUNCTION_INVOCATION_FAILED.
    throw error;
  }
};

module.exports = connectDB;
