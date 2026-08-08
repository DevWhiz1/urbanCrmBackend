/**
 * portal.route.js
 *
 * Secure routes for the Client and Contractor portals.
 * Every route: authenticate JWT → attach role scope → ownership-checked controller.
 */

const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../middleware/auth.middleware');
const { attachUserScope } = require('../middleware/scope.middleware');
const {
  getClientProject,
  getClientPayments,
  getContractorContracts,
  getContractorContractPayments,
  getContractorSummary,
  getContractorAllPayments,
} = require('../controllers/portal.controller');

// Apply auth + scope to all portal routes
router.use(authenticateToken);
router.use(attachUserScope);

// ─── CLIENT ROUTES ────────────────────────────────────────────────────────────
// Only users with the 'Client' role can access these endpoints
router.get('/client/project', authorizeRoles('Client'), getClientProject);
router.get('/client/payments', authorizeRoles('Client'), getClientPayments);

// ─── CONTRACTOR ROUTES ────────────────────────────────────────────────────────
// Only users with the 'Contractor' role can access these endpoints
router.get('/contractor/summary', authorizeRoles('Contractor'), getContractorSummary);
router.get('/contractor/contracts', authorizeRoles('Contractor'), getContractorContracts);
router.get('/contractor/all-payments', authorizeRoles('Contractor'), getContractorAllPayments);
router.get('/contractor/payments/:contractId', authorizeRoles('Contractor'), getContractorContractPayments);

module.exports = router;
