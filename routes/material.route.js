const express = require('express');
const router = express.Router();
const materialController = require('../controllers/material.controller');
const { authenticateToken, authorizeRoles } = require('../middleware/auth.middleware');
const { attachUserScope } = require('../middleware/scope.middleware');

router.use(authenticateToken);
router.use(attachUserScope);

// Add new material (Admin only)
router.post('/add-material-payment', authorizeRoles('Admin'), materialController.createMaterial);

// Get all materials
router.get('/get-all-material-payment', materialController.getAllMaterials);

module.exports = router;
