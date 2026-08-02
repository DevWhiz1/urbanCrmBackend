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
const materialRoute = require('./routes/material.route');
const dashboardRoute = require('./routes/dashboard.route');
const reportsRoute = require('./routes/reports.route');
const userRoute = require('./routes/users.route');

const app = express();
const PORT = process.env.PORT || 5000;

// Start the connection without blocking middleware registration. A failed
// connection is logged, but must not terminate a Vercel function before it can
// answer CORS preflight requests.
connectDB().catch((error) => {
  console.error(`Database initialization failed: ${error.message}`);
});

// Middleware
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Default Route
app.get('/', (req, res) => {
  res.send('Server is running!');
});

// API Routes
app.use('/api/auth', authRoute);
app.use('/api/user', userRoute);
app.use('/api/project', projectRoute);
app.use('/api/contractor', contractor);
app.use('/api/client', clientRoute);
app.use('/api/project-contract', projectContractRoute);
app.use('/api/payment', paymentRoute);
app.use('/api/material', materialRoute);
app.use('/api/dashboard', dashboardRoute);
app.use('/api/reports', reportsRoute);

// Vercel invokes the exported Express app. Keep a listener only for local use.
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server is listening on http://localhost:${PORT}`);
  });
}

module.exports = app;
