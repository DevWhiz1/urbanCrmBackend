const { default: mongoose } = require('mongoose');
const ProjectContract = require("../models/projectContractSchema");
const { getPaginationParams, formatPaginatedResponse } = require('../utils/paginate');

const projectContractController = {};

// Create a new project contract
projectContractController.createProjectContract = async (req, res) => {
  try {
    const contractData = req.body;
    const newContract = new ProjectContract(contractData);
    const savedContract = await newContract.save();
    res.status(201).json({
      message: "Project contract created successfully",
      contract: savedContract,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to create project contract",
      error: error.message,
    });
  }
};

// Get all project contracts with Scoping & Pagination
projectContractController.getAllProjectContracts = async (req, res) => {
  try {
    const filter = {};

    if (req.user?.role === 'Contractor' && req.contractorId) {
      filter.contractor = req.contractorId;
    }

    const { isPaginated, page, limit, skip } = getPaginationParams(req);
    const total = await ProjectContract.countDocuments(filter);

    let query = ProjectContract.find(filter)
      .populate('project', 'name projectCode status location')
      .populate('contractor', 'companyName contractorType user')
      .sort({ createdAt: -1 });

    if (isPaginated && limit > 0) {
      query = query.skip(skip).limit(limit);
    }

    const contracts = await query;
    const response = formatPaginatedResponse(contracts, total, page, limit);
    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get a single project contract
projectContractController.getProjectContractById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 400,
        message: "Invalid project contract ID"
      });
    }

    const contract = await ProjectContract.findById(id)
      .populate('project', 'name projectCode status location projectCategory projectType')
      .populate('contractor', 'companyName contractorType user paymentTerms bankDetails address phoneNumber');

    if (!contract) {
      return res.status(404).json({
        status: 404,
        message: "Project contract not found"
      });
    }

    if (req.user?.role === 'Contractor' && contract.contractor?._id.toString() !== req.contractorId?.toString()) {
      return res.status(403).json({ status: 403, message: "Access denied to contract" });
    }

    res.status(200).json({
      status: 200,
      message: "Project contract retrieved successfully",
      data: contract,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Update a project contract
projectContractController.updateProjectContract = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 400,
        message: "Invalid project contract ID"
      });
    }

    if (updateData.totalAmount) {
      updateData.totalAmount = parseFloat(updateData.totalAmount);
    }

    const updatedContract = await ProjectContract.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
    .populate('project', 'name projectCode status location')
    .populate('contractor', 'companyName contractorType user');

    if (!updatedContract) {
      return res.status(404).json({
        status: 404,
        message: "Project contract not found"
      });
    }

    res.status(200).json({
      status: 200,
      message: "Project contract updated successfully",
      data: updatedContract,
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

// Delete a project contract
projectContractController.deleteProjectContract = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 400,
        message: "Invalid project contract ID"
      });
    }

    const deletedContract = await ProjectContract.findByIdAndDelete(id);

    if (!deletedContract) {
      return res.status(404).json({
        status: 404,
        message: "Project contract not found"
      });
    }

    res.status(200).json({
      status: 200,
      message: "Project contract deleted successfully",
      data: deletedContract,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: "Internal server error",
      error: error.message,
    });
  }
};

module.exports = projectContractController;