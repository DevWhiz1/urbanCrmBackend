const { default: mongoose } = require('mongoose');
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
    const clients = await Client.find({})
      .populate('user', 'userName email phoneNumber address status')
      .sort({ createdAt: -1 });

    res.status(200).json({
      status: 200,
      message: "Clients retrieved successfully",
      data: clients,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: "Failed to fetch clients",
      error: error.message,
    });
  }
};

// Get a single client by ID
clientController.getClientById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 400,
        message: "Invalid client ID"
      });
    }

    const client = await Client.findById(id)
      .populate('user', 'userName email phoneNumber address status role');

    if (!client) {
      return res.status(404).json({
        status: 404,
        message: "Client not found"
      });
    }

    res.status(200).json({
      status: 200,
      message: "Client retrieved successfully",
      data: client,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Update a client
clientController.updateClient = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 400,
        message: "Invalid client ID"
      });
    }

    updateData.updatedAt = Date.now();

    const updatedClient = await Client.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
    .populate('user', 'userName email phoneNumber address status role');

    if (!updatedClient) {
      return res.status(404).json({
        status: 404,
        message: "Client not found"
      });
    }

    res.status(200).json({
      status: 200,
      message: "Client updated successfully",
      data: updatedClient,
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        status: 400,
        message: error.message
      });
    }
    res.status(500).json({
      status: 500,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Delete a client
clientController.deleteClient = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 400,
        message: "Invalid client ID"
      });
    }

    const deletedClient = await Client.findByIdAndDelete(id);

    if (!deletedClient) {
      return res.status(404).json({
        status: 404,
        message: "Client not found"
      });
    }

    res.status(200).json({
      status: 200,
      message: "Client deleted successfully",
      data: deletedClient,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: "Internal server error",
      error: error.message,
    });
  }
};

module.exports = clientController;