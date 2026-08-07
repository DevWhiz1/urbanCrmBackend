const jwt = require("jsonwebtoken");
const User = require("../models/users.schema.js");

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

// ─── Authorize Roles (verifies role live from DB) ─────────────────────────────
const authorizeRoles = (...roles) => {
  return async (req, res, next) => {
    try {
      // Fetch fresh role from DB to capture any real-time permission changes
      const user = await User.findById(req.user.userId).select("role status");

      if (!user) {
        return res.status(403).json({ status: 403, message: "User no longer exists." });
      }

      if (user.status !== "Active") {
        return res.status(403).json({ status: 403, message: "Account is inactive." });
      }

      if (!roles.includes(user.role)) {
        return res.status(403).json({ status: 403, message: "Permission denied." });
      }

      // Attach the fresh role to req.user so downstream handlers can use it
      req.user.role = user.role;
      next();
    } catch (error) {
      console.error("authorizeRoles error:", error);
      return res.status(500).json({ status: 500, message: "Internal Server Error" });
    }
  };
};

module.exports = {
  authenticateToken,
  authorizeRoles,
};
