/**
 * portal.route.js
 *
 * Secure routes for the Client and Contractor portals.
 * Every route: authenticate JWT → refresh role from cache/DB → attach scope → ownership-checked controller.
 */

const express = require('express');
const router = express.Router();
const { authenticateToken, ensureUserAuth, authorizeRoles } = require('../middleware/auth.middleware');
const { attachUserScope } = require('../middleware/scope.middleware');
const {
  getClientProject,
  getClientPayments,
  getContractorContracts,
  getContractorContractPayments,
  getContractorSummary,
  getContractorAllPayments,
} = require('../controllers/portal.controller');

// Apply auth + authoritative role refresh + scope to all portal routes
router.use(authenticateToken);
router.use(ensureUserAuth);
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
