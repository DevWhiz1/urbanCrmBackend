const express = require('express');
const router = express.Router();
const materialController = require('../controllers/material.controller');
const { authenticateToken, ensureUserAuth, authorizeRoles } = require('../middleware/auth.middleware');
const { attachUserScope } = require('../middleware/scope.middleware');

router.use(authenticateToken);
router.use(ensureUserAuth);
router.use(attachUserScope);

// Add new material (Admin only)
router.post('/add-material-payment', authorizeRoles('Admin'), materialController.createMaterial);
router.post('/bulk-import', authorizeRoles('Admin'), materialController.bulkImportMaterials);

// Get all materials
router.get('/get-all-material-payment', materialController.getAllMaterials);

// Get materials by project
router.get('/project/:projectId', materialController.getMaterialsByProject);

// Delete a material
router.delete('/delete-material/:id', authorizeRoles('Admin'), materialController.deleteMaterial);

// Update a material
router.put('/update-material/:id', authorizeRoles('Admin'), materialController.updateMaterial);

module.exports = router;
