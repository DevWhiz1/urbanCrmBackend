const express = require('express');
const router = express.Router();
const materialController = require('../controllers/material.controller');

// Add new material
router.post('/add-material-payment', materialController.createMaterial);

// Get all materials
router.get('/get-all-material-payment', materialController.getAllMaterials);

module.exports = router;
