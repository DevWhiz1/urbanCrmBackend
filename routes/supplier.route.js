const express = require('express');
const supplierController = require('../controllers/supplier.controller');
const { authenticateToken, ensureUserAuth, authorizeRoles } = require('../middleware/auth.middleware');
const { attachUserScope } = require('../middleware/scope.middleware');
const router = express.Router();

router.use(authenticateToken);
router.use(ensureUserAuth);
router.use(attachUserScope);

// All supplier routes are Admin-only
router.post('/create-supplier', authorizeRoles('Admin'), supplierController.createSupplier);
router.get('/get-all-suppliers', authorizeRoles('Admin'), supplierController.getAllSuppliers);
router.get('/get-single-supplier/:id', authorizeRoles('Admin'), supplierController.getSupplierById);
router.put('/update-supplier/:id', authorizeRoles('Admin'), supplierController.updateSupplier);
router.delete('/delete-supplier/:id', authorizeRoles('Admin'), supplierController.deleteSupplier);

module.exports = router;
