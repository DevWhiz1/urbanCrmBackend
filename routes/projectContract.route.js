const express = require("express");
const projectContractController = require("../controllers/projectContract.controller");
const router = express.Router();

// Create a new project contract
router.post("/create-project-contract", projectContractController.createProjectContract);
// Get all project contracts 
router.get("/get-all-project-contracts", projectContractController.getAllProjectContracts);
// Get a single project contract    
router.get('/get-single-project-contract/:id', projectContractController.getProjectContractById);
// Update a project contract 
router.put('/update-project-contract/:id', projectContractController.updateProjectContract);
// Delete a project contract
router.delete('/delete-project-contract/:id', projectContractController.deleteProjectContract);


module.exports = router;