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
      contractors: req.body.contractors || [],
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
      const ProjectContract = require('../models/projectContractSchema');
      const contractProjectIds = await ProjectContract.find({ contractor: req.contractorId }).distinct('project');
      filter.$or = [
        { contractors: req.contractorId },
        { _id: { $in: contractProjectIds } }
      ];
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
      .populate({ path: 'customer', select: 'user paymentTerms bankDetails address phoneNumber isActive', populate: { path: 'user', select: 'userName email' } })
      .populate({ path: 'contractors', select: 'user companyName contractorType paymentTerms bankDetails address phoneNumber', populate: { path: 'user', select: 'userName email' } })
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
      .populate({ path: 'customer', select: 'user paymentTerms bankDetails address phoneNumber isActive', populate: { path: 'user', select: 'userName email' } })
      .populate({ path: 'contractors', select: 'user companyName contractorType paymentTerms bankDetails address phoneNumber', populate: { path: 'user', select: 'userName email' } });

    if (!project) {
      return res.status(404).json({ 
        status: 404, 
        message: "Project not found" 
      });
    }

    // Clean up any email-based addedBy entries to show real userName
    if (project.additions && project.additions.length > 0) {
      const User = require('../models/users.schema');
      let modified = false;
      for (let addition of project.additions) {
        if (addition.addedBy && addition.addedBy.includes('@')) {
          const u = await User.findOne({ email: addition.addedBy }).select('userName');
          if (u) {
            addition.addedBy = u.userName;
            modified = true;
          }
        }
      }
      if (modified) {
        await project.save();
      }
    }

    // Role-Based Authorization Check
    if (req.user?.role === 'Contractor') {
      const ProjectContract = require('../models/projectContractSchema');
      const isAssigned = project.contractors.some(c => c._id.toString() === req.contractorId?.toString());
      const hasContract = await ProjectContract.exists({ project: id, contractor: req.contractorId });
      if (!isAssigned && !hasContract) {
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

    const existingProject = await projectModel.findById(id).select('additions');
    const additionsSum = (existingProject?.additions || []).reduce((s, a) => s + (a.amount || 0), 0);

    if (updateData.ratePerSquareFoot && updateData.totalCoverageArea) {
      updateData.totalCost = (updateData.ratePerSquareFoot * updateData.totalCoverageArea) + additionsSum;
    }
    if (updateData.labouRate && updateData.totalCoverageArea) {
      updateData.totalLabourCost = (updateData.labouRate * updateData.totalCoverageArea) + additionsSum;
    }

    updateData.updatedAt = Date.now();

    const updatedProject = await projectModel.findByIdAndUpdate(
      id, 
      updateData, 
      { new: true, runValidators: true }
    )
    .populate({ path: 'customer', select: 'user paymentTerms bankDetails address phoneNumber isActive', populate: { path: 'user', select: 'userName email' } })
    .populate({ path: 'contractors', select: 'user companyName contractorType paymentTerms bankDetails address phoneNumber', populate: { path: 'user', select: 'userName email' } });

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

// Add price addition to project
projectController.addProjectAddition = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ status: 400, message: "Invalid project ID" });
    }

    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return res.status(400).json({ status: 400, message: "A valid positive addition amount is required" });
    }

    if (!reason || !reason.trim()) {
      return res.status(400).json({ status: 400, message: "Reason for price addition is required" });
    }

    const project = await projectModel.findById(id);
    if (!project) {
      return res.status(404).json({ status: 404, message: "Project not found" });
    }

    const User = require('../models/users.schema');
    let currentUser = null;
    if (req.user?.userId) {
      currentUser = await User.findById(req.user.userId).select('userName email');
    } else if (req.user?.email) {
      currentUser = await User.findOne({ email: req.user.email }).select('userName email');
    }

    const addedByName = currentUser?.userName || req.user?.userName || 'Admin';

    // Clean up existing addition records if they store an email address
    for (let addition of project.additions) {
      if (addition.addedBy && addition.addedBy.includes('@')) {
        const u = await User.findOne({ email: addition.addedBy }).select('userName');
        if (u) {
          addition.addedBy = u.userName;
        }
      }
    }

    const newAddition = {
      amount: parseFloat(amount),
      reason: reason.trim(),
      date: new Date(),
      createdBy: currentUser?._id,
      addedBy: addedByName
    };

    project.additions.push(newAddition);

    // Update totalCost / totalLabourCost directly so all APIs (Dashboard, Reports, Aggregations) automatically reflect additions
    if (project.projectType === 'withMaterial') {
      project.totalCost = (project.totalCost || 0) + newAddition.amount;
    } else if (project.projectType === 'labourRate') {
      project.totalLabourCost = (project.totalLabourCost || 0) + newAddition.amount;
    }

    project.updatedAt = Date.now();
    await project.save();

    const updatedProject = await projectModel.findById(id)
      .populate({ path: 'customer', select: 'user paymentTerms bankDetails address phoneNumber isActive', populate: { path: 'user', select: 'userName email' } })
      .populate({ path: 'contractors', select: 'user companyName contractorType paymentTerms bankDetails address phoneNumber', populate: { path: 'user', select: 'userName email' } });

    res.status(200).json({
      status: 200,
      message: "Price addition added successfully",
      data: updatedProject
    });
  } catch (error) {
    res.status(500).json({ status: 500, message: "Internal server error", error: error.message });
  }
};

module.exports = projectController;
