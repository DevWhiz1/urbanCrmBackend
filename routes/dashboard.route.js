const express = require('express');
const dashboardController = require('../controllers/dashboard.controller');
const { authenticateToken } = require('../middleware/auth.middleware');
const router = express.Router();

router.use(authenticateToken);

// Get dashboard statistics
router.get('/stats', dashboardController.getDashboardStats);

module.exports = router;
