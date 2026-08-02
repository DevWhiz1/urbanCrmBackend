const express = require("express");
const clientController = require("../controllers/client.controller");
const { authenticateToken, authorizeRoles } = require("../middleware/auth.middleware");
const { attachUserScope } = require("../middleware/scope.middleware");
const router = express.Router();

router.use(authenticateToken);
router.use(attachUserScope);

router.post("/create-client", authorizeRoles('Admin'), clientController.createClient);
router.get("/get-all-clients", clientController.getAllClients);
router.get('/get-single-client/:id', clientController.getClientById);
router.put('/update-client/:id', authorizeRoles('Admin'), clientController.updateClient);
router.delete('/delete-client/:id', authorizeRoles('Admin'), clientController.deleteClient);

module.exports = router;