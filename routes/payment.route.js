const express = require("express");
const paymentController = require("../controllers/payment.controller");
const router = express.Router();

router.post("/create-payment", paymentController.createPayment);
router.get("/get-all-payments", paymentController.getAllPayments);
// Add payment for a specific project
router.post("/add-payment-for-project", paymentController.addPaymentForProject);
// Get total payment for a specific project
router.get("/total/:projectId", paymentController.getTotalPaymentForProject);
// Get all payments for a project (optionally filter by type)
router.get("/by-project/:projectId", paymentController.getPaymentsByProject);
// Get payment summary for a project
router.get("/summary/:projectId", paymentController.getProjectPaymentSummary);
// Get all material payments for a project
router.get("/material-payments/:projectId", paymentController.getMaterialPaymentsByProject);
// Get full project financial summary
router.get("/full-summary/:projectId", paymentController.getFullProjectFinancialSummary);
// Get all project contracts for a specific project
router.get("/contracts/by-project/:projectId", paymentController.getProjectContractsByProject);
// Get summary and all payments for a specific project contract
router.get("/contract-summary/:projectContractId", paymentController.getProjectContractSummary);

module.exports = router;