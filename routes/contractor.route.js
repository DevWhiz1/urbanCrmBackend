const express = require('express');
const contractorController = require('../controllers/contractor.controller');
const router = express.Router();

// Create a new contractor
router.post('/create-contractor', contractorController.createContractor);

module.exports = router;