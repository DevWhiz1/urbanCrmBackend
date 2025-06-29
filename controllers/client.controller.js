const Client = require("../models/client.schema");

const clientController = {};

// Create a new client
clientController.createClient = async (req, res) => {
  try {
    const clientData = req.body;
    const newClient = new Client(clientData);
    const savedClient = await newClient.save();

    res.status(201).json({
      message: "Client created successfully",
      client: savedClient,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to create client",
      error: error.message,
    });
  }
};

// Get all clients
clientController.getAllClients = async (req, res) => {
  try {
    const clients = await Client.find().populate("user");
    res.status(200).json({ data: clients });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch clients",
      error: error.message,
    });
  }
};

module.exports = clientController;