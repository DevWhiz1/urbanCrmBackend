const express = require('express');
const reportsController = require('../controllers/reports.controller');
const { authenticateToken, ensureUserAuth, authorizeRoles } = require('../middleware/auth.middleware');
const { attachUserScope } = require('../middleware/scope.middleware');
const router = express.Router();

router.use(authenticateToken);
router.use(ensureUserAuth);
router.use(attachUserScope);

// Admin-only reports
router.get('/projects', authorizeRoles('Admin'), reportsController.getProjectReports);
router.get('/contractors', authorizeRoles('Admin'), reportsController.getContractorReports);
router.get('/clients', authorizeRoles('Admin'), reportsController.getClientReports);
router.get('/payments', authorizeRoles('Admin'), reportsController.getPaymentReports);
router.get('/financial-summary', authorizeRoles('Admin'), reportsController.getFinancialSummary);
router.get('/payment-analytics', authorizeRoles('Admin'), reportsController.getPaymentAnalytics);

module.exports = router;
