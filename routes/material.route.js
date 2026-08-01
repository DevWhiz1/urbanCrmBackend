const express = require('express');
const router = express.Router();
const materialController = require('../controllers/material.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

router.use(authenticateToken);

// Add new material
router.post('/add-material-payment', materialController.createMaterial);

// Get all materials
router.get('/get-all-material-payment', materialController.getAllMaterials);

module.exports = router;
