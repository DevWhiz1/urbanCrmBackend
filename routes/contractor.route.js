const express = require('express');
const contractorController = require('../controllers/contractor.controller');
const { authenticateToken } = require('../middleware/auth.middleware');
const router = express.Router();

router.use(authenticateToken);

// Create a new contractor
router.post('/create-contractor', contractorController.createContractor);
// Get all contractors
router.get('/get-all-contractors', contractorController.getAllContractor);
// Get a single contractor
router.get('/get-single-contractor/:id', contractorController.getContractorById);
// Update a contractor
router.put('/update-contractor/:id', contractorController.updateContractor);
// Delete a contractor
router.delete('/delete-contractor/:id', contractorController.deleteContractor);

module.exports = router;