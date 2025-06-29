const express = require("express");
const userController = require("../controllers/users.controller");
const router = express.Router();


router.put("/update-user/:id", userController.updateUser);
router.get("/get-single-user/:id", userController.getSingleUser);
router.put("/update-password/:id", userController.updatePassword);
router.get("/get-all-users", userController.getAllUsers);

module.exports = router;