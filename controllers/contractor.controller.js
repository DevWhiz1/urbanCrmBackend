const { default: mongoose } = require('mongoose');
const Contractor = require("../models/contractor.schema");
const { getPaginationParams, formatPaginatedResponse } = require('../utils/paginate');

const contractorController = {};

// Create a new contractor
contractorController.createContractor = async (req, res) => {
  try {
    const contractorData = req.body;
    const newContractor = new Contractor(contractorData);
    const savedContractor = await newContractor.save();

    res.status(201).json({
      message: "Contractor created successfully",
      contractor: savedContractor,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to create contractor",
      error: error.message,
    });
  }
};

// Get all contractors with Scoping & Pagination
contractorController.getAllContractor = async (req, res) => {
  try {
    const filter = {};

    if (req.user?.role === 'Contractor' && req.contractorId) {
      filter._id = req.contractorId;
    }

    if (req.query.search) {
      filter.companyName = { $regex: req.query.search, $options: 'i' };
    }

    const { isPaginated, page, limit, skip } = getPaginationParams(req);
    const total = await Contractor.countDocuments(filter);

    let query = Contractor.find(filter)
      .populate('user', 'userName email phoneNumber address status')
      .sort({ createdAt: -1 });

    if (isPaginated && limit > 0) {
      query = query.skip(skip).limit(limit);
    }

    const contractors = await query;
    const response = formatPaginatedResponse(contractors, total, page, limit);
    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: "Failed to fetch contractors",
      error: error.message,
    });
  }
};

// Get a single contractor by ID
contractorController.getContractorById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 400,
        message: "Invalid contractor ID"
      });
    }

    const contractor = await Contractor.findById(id)
      .populate('user', 'userName email phoneNumber address status role');

    if (!contractor) {
      return res.status(404).json({
        status: 404,
        message: "Contractor not found"
      });
    }

    if (req.user?.role === 'Contractor' && contractor._id.toString() !== req.contractorId?.toString()) {
      return res.status(403).json({ status: 403, message: "Access denied to contractor profile" });
    }

    res.status(200).json({
      status: 200,
      message: "Contractor retrieved successfully",
      data: contractor,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Update a contractor
contractorController.updateContractor = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 400,
        message: "Invalid contractor ID"
      });
    }

    updateData.updatedAt = Date.now();

    const updatedContractor = await Contractor.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
    .populate('user', 'userName email phoneNumber address status role');

    if (!updatedContractor) {
      return res.status(404).json({
        status: 404,
        message: "Contractor not found"
      });
    }

    res.status(200).json({
      status: 200,
      message: "Contractor updated successfully",
      data: updatedContractor,
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

// Delete a contractor
contractorController.deleteContractor = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 400,
        message: "Invalid contractor ID"
      });
    }

    const deletedContractor = await Contractor.findByIdAndDelete(id);

    if (!deletedContractor) {
      return res.status(404).json({
        status: 404,
        message: "Contractor not found"
      });
    }

    res.status(200).json({
      status: 200,
      message: "Contractor deleted successfully",
      data: deletedContractor,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: "Internal server error",
      error: error.message,
    });
  }
};

module.exports = contractorController;
