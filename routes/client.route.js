const express = require("express");
const clientController = require("../controllers/client.controller");
const router = express.Router();

router.post("/create-client", clientController.createClient);
router.get("/get-all-clients", clientController.getAllClients);
// Get a single client
router.get('/get-single-client/:id', clientController.getClientById);
// Update a client
router.put('/update-client/:id', clientController.updateClient);
// Delete a client
router.delete('/delete-client/:id', clientController.deleteClient);

module.exports = router;