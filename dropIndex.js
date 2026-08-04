const mongoose = require('mongoose');
require('dotenv').config();
mongoose.connect(process.env.MONGO_URI).then(async () => {
    try { await mongoose.connection.collection('employees').dropIndex('employeeId_1'); console.log('Dropped employeeId_1'); } catch(e) { console.log(e.message); }
    try { await mongoose.connection.collection('expenses').dropIndex('expenseId_1'); console.log('Dropped expenseId_1'); } catch(e) { console.log(e.message); }
    console.log('Indexes dropped');
    process.exit(0);
});
