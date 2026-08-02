const { default: mongoose } = require('mongoose');
const projectModel = require('../models/project.schema');
const { getPaginationParams, formatPaginatedResponse } = require('../utils/paginate');

const projectController = {};

// Generate project code helper function
const generateProjectCode = async (name) => {
  const count = await projectModel.countDocuments({ name: { $regex: new RegExp(`^${name}`, 'i') } });
  return `${name.replace(/\s+/g, '').toUpperCase().substring(0, 3)}-${(count + 1).toString().padStart(3, '0')}`;
};

// Create a new project
projectController.createProject = async (req, res) => {
  try {
    const {
      name,
      location,
      projectCategory,
      projectType,
      ratePerSquareFoot,
      totalArea,
      totalCoverageArea,
      labouRate,
      startDate,
      estimatedDuration,
      customer,
      contractors,
      description,
      status,
      drawings,
      contracts
    } = req.body;

    const projectCode = await generateProjectCode(name);
    const totalCost = (ratePerSquareFoot || 0) * (totalCoverageArea || 0);
    const totalLabourCost = (labouRate || 0) * (totalCoverageArea || 0);

    const newProject = new projectModel({
      name,
      projectCode,
      location,
      projectCategory,
      projectType,
      ratePerSquareFoot,
      totalArea,
      totalCoverageArea,
      totalCost,
      labouRate,
      totalLabourCost,
      startDate,
      estimatedDuration,
      customer,
      contractors,
      description,
      status: status || 'planning',
      drawings,
      contracts,
      updatedAt: Date.now()
    });

    const savedProject = await newProject.save();
    res.status(201).json({ status: 201, message: "Project created successfully", data: savedProject });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ status: 400, message: error.message });
    }
    res.status(500).json({ status: 500, message: "Internal server error", error: error.message });
  }
};

// Get all projects with Data Scoping & Pagination
projectController.getAllProjects = async (req, res) => {
  try {
    const filter = {};

    // Role-Based Data Scoping
    if (req.user?.role === 'Contractor') {
      filter.contractors = req.contractorId;
    } else if (req.user?.role === 'User') {
      filter.customer = req.clientId;
    }

    // Category / Status / Search filters
    if (req.query.status) {
      filter.status = req.query.status;
    }
    if (req.query.category) {
      filter.projectCategory = req.query.category;
    }
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { location: { $regex: req.query.search, $options: 'i' } },
        { projectCode: { $regex: req.query.search, $options: 'i' } },
      ];
    }

    const { isPaginated, page, limit, skip } = getPaginationParams(req);
    const total = await projectModel.countDocuments(filter);

    let query = projectModel.find(filter)
      .populate('customer', 'user paymentTerms bankDetails address phoneNumber isActive')
      .populate('contractors', 'user companyName contractorType paymentTerms bankDetails address phoneNumber')
      .sort({ createdAt: -1 });

    if (isPaginated && limit > 0) {
      query = query.skip(skip).limit(limit);
    }

    const projects = await query;
    const response = formatPaginatedResponse(projects, total, page, limit);
    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ 
      status: 500, 
      message: "Internal server error", 
      error: error.message 
    });
  }
};

// Get a single project by ID with Scope Verification
projectController.getProjectById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        status: 400, 
        message: "Invalid project ID" 
      });
    }

    const project = await projectModel.findById(id)
      .populate('customer', 'user paymentTerms bankDetails address phoneNumber isActive')
      .populate('contractors', 'user companyName contractorType paymentTerms bankDetails address phoneNumber');

    if (!project) {
      return res.status(404).json({ 
        status: 404, 
        message: "Project not found" 
      });
    }

    // Role-Based Authorization Check
    if (req.user?.role === 'Contractor') {
      const isAssigned = project.contractors.some(c => c._id.toString() === req.contractorId?.toString());
      if (!isAssigned) {
        return res.status(403).json({ status: 403, message: "Access denied to this project" });
      }
    } else if (req.user?.role === 'User') {
      if (project.customer?._id.toString() !== req.clientId?.toString()) {
        return res.status(403).json({ status: 403, message: "Access denied to this project" });
      }
    }

    res.status(200).json({ 
      status: 200, 
      message: "Project retrieved successfully", 
      data: project 
    });
  } catch (error) {
    res.status(500).json({ 
      status: 500, 
      message: "Internal server error", 
      error: error.message 
    });
  }
};

// Update a project
projectController.updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        status: 400, 
        message: "Invalid project ID" 
      });
    }

    if (updateData.ratePerSquareFoot && updateData.totalCoverageArea) {
      updateData.totalCost = updateData.ratePerSquareFoot * updateData.totalCoverageArea;
    }
    if (updateData.labouRate && updateData.totalCoverageArea) {
      updateData.totalLabourCost = updateData.labouRate * updateData.totalCoverageArea;
    }

    updateData.updatedAt = Date.now();

    const updatedProject = await projectModel.findByIdAndUpdate(
      id, 
      updateData, 
      { new: true, runValidators: true }
    )
    .populate('customer', 'user paymentTerms bankDetails address phoneNumber isActive')
    .populate('contractors', 'user companyName contractorType paymentTerms bankDetails address phoneNumber');

    if (!updatedProject) {
      return res.status(404).json({ 
        status: 404, 
        message: "Project not found" 
      });
    }

    res.status(200).json({ 
      status: 200, 
      message: "Project updated successfully", 
      data: updatedProject 
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
      error: error.message 
    });
  }
};

// Delete a project
projectController.deleteProject = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        status: 400, 
        message: "Invalid project ID" 
      });
    }

    const deletedProject = await projectModel.findByIdAndDelete(id);

    if (!deletedProject) {
      return res.status(404).json({ 
        status: 404, 
        message: "Project not found" 
      });
    }

    res.status(200).json({ 
      status: 200, 
      message: "Project deleted successfully", 
      data: deletedProject 
    });
  } catch (error) {
    res.status(500).json({ 
      status: 500, 
      message: "Internal server error", 
      error: error.message 
    });
  }
};

module.exports = projectController;
