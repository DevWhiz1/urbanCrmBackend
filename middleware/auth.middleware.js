const jwt = require("jsonwebtoken");
let config = {};
try {
  config = require("../config/config.json");
} catch (e) {
  config = { secret: "devsecretkey" };
}

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ status: 401, message: "Access denied. No token provided." });
  }

  const secret = process.env.JWT_SECRET || config.secret || "devsecretkey";

  try {
    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ status: 403, message: "Invalid or expired token." });
  }
};

const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ status: 403, message: "Permission denied." });
    }
    next();
  };
};

module.exports = {
  authenticateToken,
  authorizeRoles,
};
