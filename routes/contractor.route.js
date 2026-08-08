const express = require('express');
const contractorController = require('../controllers/contractor.controller');
const { authenticateToken, ensureUserAuth, authorizeRoles } = require('../middleware/auth.middleware');
const { attachUserScope } = require('../middleware/scope.middleware');
const router = express.Router();

router.use(authenticateToken);
router.use(ensureUserAuth);
router.use(attachUserScope);

router.post('/create-contractor', authorizeRoles('Admin'), contractorController.createContractor);
router.get('/get-all-contractors', contractorController.getAllContractor);
router.get('/get-single-contractor/:id', contractorController.getContractorById);
router.put('/update-contractor/:id', authorizeRoles('Admin'), contractorController.updateContractor);
router.delete('/delete-contractor/:id', authorizeRoles('Admin'), contractorController.deleteContractor);

module.exports = router;