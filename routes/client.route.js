const express = require("express");
const clientController = require("../controllers/client.controller");
const router = express.Router();

router.post("/create-client", clientController.createClient);
router.get("/get-all-clients", clientController.getAllClients);

module.exports = router;