const { default: mongoose } = require('mongoose');
const projectModel = require('../models/project.schema');

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

    // Generate project code
    const projectCode = await generateProjectCode(name);

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

// Get all projects
projectController.getAllProjects = async (req, res) => {
  try {
    const { status, projectType, projectCategory } = req.query;
    const filter = {};
    
    if (status) filter.status = status;
    if (projectType) filter.projectType = projectType;
    if (projectCategory) filter.projectCategory = projectCategory;

    const projects = await projectModel.find(filter)
      .populate('customer', 'name email phone')
      .populate('contractors', 'name email phone');
    
    res.status(200).json({ status: 200, data: projects });
  } catch (error) {
    res.status(500).json({ status: 500, message: "Internal server error", error: error.message });
  }
};

// Get single project by ID
projectController.getProjectById = async (req, res) => {
  try {
    const project = await projectModel.findById(req.params.id)
      .populate('customer', 'name email phone')
      .populate('contractors', 'name email phone')
      .populate('materials');
    
    if (!project) {
      return res.status(404).json({ status: 404, message: "Project not found" });
    }
    
    res.status(200).json({ status: 200, data: project });
  } catch (error) {
    if (error instanceof mongoose.CastError) {
      return res.status(400).json({ status: 400, message: "Invalid project ID" });
    }
    res.status(500).json({ status: 500, message: "Internal server error", error: error.message });
  }
};

// Update project
projectController.updateProject = async (req, res) => {
  try {
    const updates = req.body;
    updates.updatedAt = Date.now();

    // Recalculate costs if relevant fields are updated
    if (updates.ratePerSquareFoot || updates.totalArea) {
      updates.totalCost = updates.ratePerSquareFoot * updates.totalArea;
    }
    
    if (updates.labouRate || updates.totalArea) {
      updates.totalLabourCost = updates.labouRate * updates.totalArea;
    }

    const updatedProject = await projectModel.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    if (!updatedProject) {
      return res.status(404).json({ status: 404, message: "Project not found" });
    }

    res.status(200).json({ status: 200, message: "Project updated successfully", data: updatedProject });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ status: 400, message: error.message });
    }
    res.status(500).json({ status: 500, message: "Internal server error", error: error.message });
  }
};

// Delete project
projectController.deleteProject = async (req, res) => {
  try {
    const deletedProject = await projectModel.findByIdAndDelete(req.params.id);
    
    if (!deletedProject) {
      return res.status(404).json({ status: 404, message: "Project not found" });
    }
    
    res.status(200).json({ status: 200, message: "Project deleted successfully" });
  } catch (error) {
    if (error instanceof mongoose.CastError) {
      return res.status(400).json({ status: 400, message: "Invalid project ID" });
    }
    res.status(500).json({ status: 500, message: "Internal server error", error: error.message });
  }
};

// Add materials to project
projectController.addMaterials = async (req, res) => {
  try {
    const { materials } = req.body;
    
    const updatedProject = await projectModel.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { materials: { $each: materials } } },
      { new: true }
    );
    
    if (!updatedProject) {
      return res.status(404).json({ status: 404, message: "Project not found" });
    }
    
    res.status(200).json({ status: 200, message: "Materials added to project", data: updatedProject });
  } catch (error) {
    res.status(500).json({ status: 500, message: "Internal server error", error: error.message });
  }
};

// Update project progress
projectController.updateProgress = async (req, res) => {
  try {
    const { progress } = req.body;
    
    if (progress < 0 || progress > 100) {
      return res.status(400).json({ status: 400, message: "Progress must be between 0 and 100" });
    }
    
    const updatedProject = await projectModel.findByIdAndUpdate(
      req.params.id,
      { progress, updatedAt: Date.now() },
      { new: true }
    );
    
    if (!updatedProject) {
      return res.status(404).json({ status: 404, message: "Project not found" });
    }
    
    // If progress is 100%, mark as completed
    if (progress === 100 && updatedProject.status !== 'completed') {
      await projectModel.findByIdAndUpdate(
        req.params.id,
        { status: 'completed', actualCompletionDate: Date.now() }
      );
    }
    
    res.status(200).json({ status: 200, message: "Project progress updated", data: updatedProject });
  } catch (error) {
    res.status(500).json({ status: 500, message: "Internal server error", error: error.message });
  }
};

// Get projects by customer
projectController.getProjectsByCustomer = async (req, res) => {
  try {
    const projects = await projectModel.find({ customer: req.params.customerId })
      .sort({ startDate: -1 });
    
    res.status(200).json({ status: 200, data: projects });
  } catch (error) {
    res.status(500).json({ status: 500, message: "Internal server error", error: error.message });
  }
};

module.exports = projectController;