const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');

dotenv.config();

// ─── General API Rate Limiter ─────────────────────────────────────────────────
// Moderate limit for all API routes as a DDoS safety net.
// Strict login/register limiter lives in auth.route.js, co-located with those routes.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,                 // max 300 requests per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    message: 'Too many requests. Please slow down and try again shortly.',
  },
});

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

// ─── Security Middleware ──────────────────────────────────────────────────────

// Helmet: sets secure HTTP response headers (XSS protection, HSTS, no-sniff, etc.)
app.use(helmet());

// Apply general rate limiter to all API routes
app.use('/api', apiLimiter);

// ─── CORS ─────────────────────────────────────────────────────────────────────
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

// ─── Dev-only Performance Logger ─────────────────────────────────────────────
// Logs method, path, status code, and response time in ms.
// Silent in production to avoid log noise.
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    const start = Date.now();
    const ts = new Date().toISOString();

    res.on('finish', () => {
      const ms = Date.now() - start;
      const status = res.statusCode;

      // Colour-code by status: green <300, yellow 3xx/4xx, red 5xx
      const colour =
        status >= 500 ? '\x1b[31m' :  // red
        status >= 400 ? '\x1b[33m' :  // yellow
        status >= 300 ? '\x1b[36m' :  // cyan
                        '\x1b[32m';   // green

      const reset = '\x1b[0m';
      const timeColour = ms > 500 ? '\x1b[31m' : ms > 200 ? '\x1b[33m' : '\x1b[32m';

      console.log(
        `[${ts}] ${req.method.padEnd(6)} ${colour}${status}${reset} ${timeColour}${ms}ms${reset}  ${req.originalUrl}`
      );
    });

    next();
  });
}

// Default Route
app.get('/', (req, res) => {
  res.send('Server is running!');
});

// API Routes
app.use('/api/auth', authRoute); // authLimiter applied per-route in auth.route.js
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