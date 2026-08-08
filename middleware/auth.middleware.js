const jwt = require("jsonwebtoken");
const User = require("../models/users.schema.js");
const { userAuthCache, TTL, cacheLog } = require("../utils/authCache");

// ─── In-flight deduplication (thundering herd) ───────────────────────────────
const pendingAuth = new Map();

/**
 * Cache-first load of { role, status }.
 * Soft-deleted users are treated as missing and are never cached.
 * Parallel misses for the same userId share one Mongo query.
 */
const loadUserAuthData = async (userId) => {
  if (!userId) return { error: "NO_USER_ID" };

  const cached = userAuthCache.get(userId);
  if (cached) {
    cacheLog(`auth HIT  — user:${userId} role:${cached.role} status:${cached.status}`);
    return { userData: cached };
  }

  if (pendingAuth.has(userId)) {
    cacheLog(`auth DEDUP — user:${userId} — waiting for in-flight query`);
    await pendingAuth.get(userId);
    const resolved = userAuthCache.get(userId);
    if (resolved) {
      cacheLog(`auth HIT  — user:${userId} role:${resolved.role} status:${resolved.status} (after dedup)`);
      return { userData: resolved };
    }
    // Prior in-flight lookup failed (deleted/missing) — fall through and re-check DB once.
  }

  let resolvePending;
  const pendingPromise = new Promise((resolve) => {
    resolvePending = resolve;
  });
  pendingAuth.set(userId, pendingPromise);

  try {
    cacheLog(`auth MISS — user:${userId} — querying MongoDB`);
    const user = await User.findById(userId).select("role status isDeleted");

    if (!user || user.isDeleted) {
      return { error: "NOT_FOUND" };
    }

    const userData = { role: user.role, status: user.status };
    // Admins are the hottest path — keep their auth entry longer.
    const ttl = userData.role === "Admin" ? TTL.AUTH_ADMIN : TTL.AUTH;
    userAuthCache.set(userId, userData, { ttl });
    return { userData };
  } finally {
    resolvePending();
    pendingAuth.delete(userId);
  }
};

// ─── Authenticate Token (reads from httpOnly cookie) ─────────────────────────
const authenticateToken = (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ status: 401, message: "Access denied. No token provided." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ status: 403, message: "Invalid or expired token." });
  }
};

/**
 * Refresh req.user.role / status from cache/DB (not JWT).
 * Must run after authenticateToken and before attachUserScope / authorizeRoles
 * so scope decisions use the authoritative role.
 */
const ensureUserAuth = async (req, res, next) => {
  try {
    const userId = req.user?.userId?.toString();
    const { userData, error } = await loadUserAuthData(userId);

    if (error === "NOT_FOUND" || !userData) {
      return res.status(403).json({ status: 403, message: "User no longer exists." });
    }

    if (userData.status !== "Active") {
      return res.status(403).json({ status: 403, message: "Account is inactive." });
    }

    req.user.role = userData.role;
    req.user.status = userData.status;
    req.user.isAuthRefreshed = true;
    next();
  } catch (error) {
    console.error("ensureUserAuth error:", error);
    return res.status(500).json({ status: 500, message: "Internal Server Error" });
  }
};

// ─── Authorize Roles (cache-first via loadUserAuthData) ──────────────────────
// On cache hit  → zero DB queries
// On cache miss → one User.findById query, result stored for future requests
const authorizeRoles = (...roles) => {
  return async (req, res, next) => {
    try {
      if (!req.user.isAuthRefreshed) {
        const userId = req.user?.userId?.toString();
        const { userData, error } = await loadUserAuthData(userId);

        if (error === "NOT_FOUND" || !userData) {
          return res.status(403).json({ status: 403, message: "User no longer exists." });
        }

        if (userData.status !== "Active") {
          return res.status(403).json({ status: 403, message: "Account is inactive." });
        }

        req.user.role = userData.role;
        req.user.status = userData.status;
        req.user.isAuthRefreshed = true;
      }

      if (!roles.includes(req.user.role)) {
        return res.status(403).json({ status: 403, message: "Permission denied." });
      }

      next();
    } catch (error) {
      console.error("authorizeRoles error:", error);
      return res.status(500).json({ status: 500, message: "Internal Server Error" });
    }
  };
};

module.exports = {
  authenticateToken,
  ensureUserAuth,
  authorizeRoles,
  loadUserAuthData,
};
