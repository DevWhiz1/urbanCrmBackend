const express = require("express");
const rateLimit = require("express-rate-limit");
const authController = require("../controllers/auth.controller");
const { authenticateToken, ensureUserAuth } = require("../middleware/auth.middleware");
const router = express.Router();

// ─── Strict rate limiter: login + register only ───────────────────────────────
// These are the only routes that could be brute-forced. /me and /logout
// are not attack surfaces and must not be rate-limited this aggressively.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                  // max 10 attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    message: 'Too many login attempts. Please try again after 15 minutes.',
  },
});

router.post("/register", authLimiter, authController.register);
router.post("/login",    authLimiter, authController.login);
router.post("/logout",   authenticateToken, authController.logout);
router.get("/me",        authenticateToken, ensureUserAuth, authController.getMe);
router.put("/update-profile", authenticateToken, ensureUserAuth, authController.updateProfile);
router.put("/update-password", authenticateToken, ensureUserAuth, authController.updatePassword);

module.exports = router;
