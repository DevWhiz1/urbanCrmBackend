const express = require("express");
const projectContractController = require("../controllers/projectContract.controller");
const { authenticateToken, authorizeRoles } = require("../middleware/auth.middleware");
const { attachUserScope } = require("../middleware/scope.middleware");
const router = express.Router();

router.use(authenticateToken);
router.use(attachUserScope);

router.post("/create-project-contract", authorizeRoles('Admin'), projectContractController.createProjectContract);
router.get("/get-all-project-contracts", projectContractController.getAllProjectContracts);
router.get('/get-single-project-contract/:id', projectContractController.getProjectContractById);
router.put('/update-project-contract/:id', authorizeRoles('Admin'), projectContractController.updateProjectContract);
router.delete('/delete-project-contract/:id', authorizeRoles('Admin'), projectContractController.deleteProjectContract);
router.post('/add-addition/:id', authorizeRoles('Admin'), projectContractController.addContractAddition);

module.exports = router;