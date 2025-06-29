const express = require("express");
const projectContractController = require("../controllers/projectContract.controller");
const router = express.Router();

// Create a new project contract
router.post("/create-project-contract", projectContractController.createProjectContract);
// Get all project contracts 
router.get("/get-all-project-contracts", projectContractController.getAllProjectContracts);
// // Get a single project contract    
// router.get('/get-single-project-contract/:id', projectContractController.getSingleProjectContract);
// // Update a project contract 
// router.put('/update-project-contract/:id', projectContractController.updateProjectContract);
// // Delete a project contract
// router.delete('/delete-project-contract/:id', projectContractController.deleteProjectContract);
// Get all project contracts by project ID
// router.get('/get-project-contracts-by-project/:projectId', projectContractController.getProjectContractsByProject);
// Get all project contracts by contractor ID
// router.get('/get-project-contracts-by-contractor/:contractorId', projectContractController.getProjectContractsByContractor);


module.exports = router;