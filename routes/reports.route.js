const express = require('express');
const reportsController = require('../controllers/reports.controller');
const router = express.Router();

// Get project reports
router.get('/projects', reportsController.getProjectReports);

// Get contractor performance reports
router.get('/contractors', reportsController.getContractorReports);

// Get client reports
router.get('/clients', reportsController.getClientReports);

// Get payment reports
router.get('/payments', reportsController.getPaymentReports);

// Get financial summary report
router.get('/financial-summary', reportsController.getFinancialSummary);

// Get payment analytics for dashboard graphs
router.get('/payment-analytics', reportsController.getPaymentAnalytics);

module.exports = router;
