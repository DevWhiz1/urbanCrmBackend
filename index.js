const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
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
const employeeRoute = require('./routes/employee.route');
const expenseRoute = require('./routes/expense.route');
const uploadRoute = require('./routes/upload.route');
const portalRoute = require('./routes/portal.route');
const app = express();
const PORT = process.env.PORT || 5000;

// Connect Database
connectDB();

// Middleware
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://urban-construction-crm.vercel.app",
  process.env.CLIENT_URL,
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, origin);
    }
    return callback(new Error(`CORS blocked for origin: ${origin}`), false);
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));


app.use(cookieParser());

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
app.use('/api/employee', employeeRoute);
app.use('/api/expense', expenseRoute);
app.use('/api/upload', uploadRoute);
app.use('/api/portal', portalRoute);

// Start Server
app.listen(PORT, () => {
  console.log(`Server is listening on http://localhost:${PORT}`);
});