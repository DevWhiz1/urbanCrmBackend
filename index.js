const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
dotenv.config();
const authRoute = require('./routes/auth.route');
const projectRoute = require('./routes/project.route');
const contractor = require('./routes/contractor.route');
const projectContractRoute = require('./routes/projectContract.route');
const clientRoute = require('./routes/client.route');
const paymentRoute = require('./routes/payment.route');

const userRoute = require('./routes/users.route');
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors()); 
app.use(express.json()); // <-- Add this line
app.use(express.urlencoded({ extended: true }));
connectDB();
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});
app.get('/', (req, res) => {
  res.send('Server is running!');
});
app.use('/api/auth', authRoute);
app.use('/api/user', userRoute);
app.use('/api/project', projectRoute);
app.use('/api/contractor', contractor);
app.use('/api/client', clientRoute);
app.use('/api/project-contract', projectContractRoute);
app.use('/api/payment', paymentRoute);

app.listen(PORT, () => {
  console.log(`Server is listening on http://localhost:${PORT}`);
});
