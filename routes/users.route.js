const express = require("express");
const userController = require("../controllers/users.controller");
const { authenticateToken, ensureUserAuth, authorizeRoles } = require("../middleware/auth.middleware");
const { attachUserScope } = require("../middleware/scope.middleware");
const router = express.Router();

router.use(authenticateToken);
router.use(ensureUserAuth);
router.use(attachUserScope);

// User Management (Admin only)
router.put("/update-user/:id", authorizeRoles('Admin'), userController.updateUser);
router.get("/get-single-user/:id", authorizeRoles('Admin'), userController.getSingleUser);
router.put("/update-password/:id", userController.updatePassword);
router.put("/force-update-password/:id", authorizeRoles('Admin'), userController.forceUpdatePassword);
router.get("/get-all-users", authorizeRoles('Admin'), userController.getAllUsers);
router.delete("/delete-user/:id", authorizeRoles('Admin'), userController.deleteUser);

module.exports = router;