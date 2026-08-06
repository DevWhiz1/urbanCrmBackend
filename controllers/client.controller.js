const { default: mongoose } = require('mongoose');
const Client = require("../models/client.schema");
const { getPaginationParams, formatPaginatedResponse } = require('../utils/paginate');

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

// Get all clients with Scoping & Pagination
clientController.getAllClients = async (req, res) => {
  try {
    const filter = { isDeleted: { $ne: true } };

    if (req.user?.role === 'Client' && req.clientId) {
      filter._id = req.clientId;
    }

    if (req.query.search) {
      const searchTerm = req.query.search;
      
      const User = require('../models/users.schema');
      const matchingUsers = await User.find({
        $or: [
          { userName: { $regex: searchTerm, $options: 'i' } },
          { email: { $regex: searchTerm, $options: 'i' } }
        ]
      }).select('_id');
      const userIds = matchingUsers.map(u => u._id);

      filter.$or = [
        { phoneNumber: { $regex: searchTerm, $options: 'i' } },
        { address: { $regex: searchTerm, $options: 'i' } },
        { paymentTerms: { $regex: searchTerm, $options: 'i' } },
        { user: { $in: userIds } }
      ];
    }

    const { isPaginated, page, limit, skip } = getPaginationParams(req);
    const total = await Client.countDocuments(filter);

    let query;

    if (req.query.basic === 'true') {
      // Basic query for dropdowns - unpaginated, minimal fields
      query = Client.find(filter)
        .select('_id user isActive')
        .populate('user', 'userName email')
        .sort({ createdAt: -1 });
      
      const clients = await query;
      return res.status(200).json({
        status: 200,
        data: clients,
      });
    } else {
      // Standard query with full population and pagination
      query = Client.find(filter)
        .populate('user', 'userName email phoneNumber address status')
        .sort({ createdAt: -1 });

      if (isPaginated && limit > 0) {
        query = query.skip(skip).limit(limit);
      }

      const clients = await query;
      const response = formatPaginatedResponse(clients, total, page, limit);
      return res.status(200).json(response);
    }
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

    if (req.user?.role === 'Client' && client._id.toString() !== req.clientId?.toString()) {
      return res.status(403).json({ status: 403, message: "Access denied to client profile" });
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

    const clientToSoftDelete = await Client.findById(id);

    if (!clientToSoftDelete) {
      return res.status(404).json({
        status: 404,
        message: "Client not found"
      });
    }

    clientToSoftDelete.isDeleted = true;
    clientToSoftDelete.deletedAt = new Date();
    clientToSoftDelete.deletedBy = req.user ? (req.user.id || req.user._id) : null;
    await clientToSoftDelete.save();

    // Also soft-delete the associated user
    if (clientToSoftDelete.user) {
      const User = require("../models/users.schema");
      const userToSoftDelete = await User.findById(clientToSoftDelete.user);
      if (userToSoftDelete) {
        userToSoftDelete.isDeleted = true;
        userToSoftDelete.deletedAt = new Date();
        userToSoftDelete.deletedBy = req.user ? (req.user.id || req.user._id) : null;
        userToSoftDelete.email = `${userToSoftDelete.email}_deleted_${Date.now()}`;
        await userToSoftDelete.save();
      }
    }

    res.status(200).json({
      status: 200,
      message: "Client deleted successfully",
      data: clientToSoftDelete,
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