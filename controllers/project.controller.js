const { default: mongoose } = require('mongoose');
const projectModel = require('../models/project.schema');
const { getPaginationParams, formatPaginatedResponse } = require('../utils/paginate');
const ProjectContract = require('../models/projectContractSchema');
const Payment = require('../models/payment.Schema');

const projectController = {};
const generateBusinessId = require('../utils/generateId');



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

    const projectCode = await generateBusinessId('PROJ');
    let calculatedTotalCost = 0;
    if (projectType === 'labourRate') {
      calculatedTotalCost = (labouRate || 0) * (totalCoverageArea || 0);
    } else {
      calculatedTotalCost = (ratePerSquareFoot || 0) * (totalCoverageArea || 0);
    }
    const finalTotalCost = req.body.totalCost ? parseFloat(req.body.totalCost) : calculatedTotalCost;

    const newProject = new projectModel({
      name,
      projectCode,
      location,
      projectCategory,
      projectType,
      ratePerSquareFoot,
      totalArea,
      totalCoverageArea,
      totalCost: finalTotalCost,
      labouRate,
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
    const filter = { isDeleted: { $ne: true } };

    // Role-Based Data Scoping
    if (req.user?.role === 'Contractor') {
      const ProjectContract = require('../models/projectContractSchema');
      const contractProjectIds = await ProjectContract.find({ contractor: req.contractorId }).distinct('project');
      filter.$or = [
        { contractors: req.contractorId },
        { _id: { $in: contractProjectIds } }
      ];
    } else if (req.user?.role === 'Client') {
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
    let query;

    if (req.query.basic === 'true') {
      // Add isActive constraint for basic dropdowns
      filter.isActive = true;
      
      query = projectModel.find(filter)
        .select('_id name projectCode status')
        .sort({ createdAt: -1 });

      const projects = await query;
      return res.status(200).json({
        status: 200,
        data: projects,
      });
    } else {
      query = projectModel.find(filter)
        .populate({ path: 'customer', select: 'user paymentTerms bankDetails address phoneNumber isActive', populate: { path: 'user', select: 'userName email' } })
        .populate({ path: 'contractors', select: 'user companyName contractorType paymentTerms bankDetails address phoneNumber', populate: { path: 'user', select: 'userName email' } })
        .sort({ createdAt: -1 });

      if (isPaginated && limit > 0) {
        query = query.skip(skip).limit(limit);
      }

      const [total, projects] = await Promise.all([
        projectModel.countDocuments(filter),
        query.exec()
      ]);

      const response = formatPaginatedResponse(projects, total, page, limit);
      return res.status(200).json(response);
    }
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
    } else if (req.user?.role === 'Client') {
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

    const existingProject = await projectModel.findById(id).select('additions projectType labouRate ratePerSquareFoot totalCoverageArea');
    const additionsSum = (existingProject?.additions || []).reduce((s, a) => s + (a.amount || 0), 0);

    const projectType = updateData.projectType || existingProject?.projectType;
    const coverageArea = updateData.totalCoverageArea !== undefined ? updateData.totalCoverageArea : existingProject?.totalCoverageArea;
    
    if (projectType === 'labourRate' && (updateData.labouRate !== undefined || updateData.totalCoverageArea !== undefined)) {
      const rate = updateData.labouRate !== undefined ? updateData.labouRate : (existingProject?.labouRate || 0);
      updateData.totalCost = (rate * (coverageArea || 0)) + additionsSum;
    } else if (projectType === 'withMaterial' && (updateData.ratePerSquareFoot !== undefined || updateData.totalCoverageArea !== undefined)) {
      const rate = updateData.ratePerSquareFoot !== undefined ? updateData.ratePerSquareFoot : (existingProject?.ratePerSquareFoot || 0);
      updateData.totalCost = (rate * (coverageArea || 0)) + additionsSum;
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

    const projectToSoftDelete = await projectModel.findById(id);

    if (!projectToSoftDelete) {
      return res.status(404).json({ 
        status: 404, 
        message: "Project not found" 
      });
    }

    projectToSoftDelete.isDeleted = true;
    projectToSoftDelete.deletedAt = new Date();
    projectToSoftDelete.deletedBy = req.user ? (req.user.id || req.user._id) : null;
    await projectToSoftDelete.save();

    // Cascade soft-delete to Contracts and Payments
    const updateObj = {
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: req.user ? (req.user.id || req.user._id) : null
    };
    
    await ProjectContract.updateMany({ project: id, isDeleted: { $ne: true } }, { $set: updateObj });
    await Payment.updateMany({ project: id, isDeleted: { $ne: true } }, { $set: updateObj });

    res.status(200).json({ 
      status: 200, 
      message: "Project deleted successfully", 
      data: projectToSoftDelete 
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

    // Update totalCost directly so all APIs (Dashboard, Reports, Aggregations) automatically reflect additions
    project.totalCost = (project.totalCost || 0) + newAddition.amount;

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

// Get contractors for a specific project
projectController.getProjectContractors = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ status: 400, message: "Invalid project ID" });
    }

    const project = await projectModel.findOne({ _id: id, isDeleted: { $ne: true } })
      .select('contractors')
      .populate({
        path: 'contractors',
        match: { isDeleted: { $ne: true } },
        select: '_id companyName contractorType user isActive',
        populate: { path: 'user', select: 'userName email' }
      });

    if (!project) {
      return res.status(404).json({ status: 404, message: "Project not found or deleted" });
    }

    // Filter out any contractors that were populated but might have isActive: false (if we wanted to strictly enforce isActive here too)
    const activeContractors = project.contractors;

    res.status(200).json({
      status: 200,
      message: "Project contractors retrieved successfully",
      data: activeContractors
    });
  } catch (error) {
    res.status(500).json({ status: 500, message: "Internal server error", error: error.message });
  }
};

module.exports = projectController;
