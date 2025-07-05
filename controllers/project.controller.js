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
// Get all projects
projectController.getAllProjects = async (req, res) => {
  try {
    const projects = await projectModel.find()
      .populate('customer')
      .populate('contractors')
      .populate('contracts');
    res.status(200).json({ status: 200, message: "Projects fetched successfully", data: projects });
  } catch (error) {
    res.status(500).json({ status: 500, message: "Internal server error", error: error.message });
  }
};

module.exports = projectController;
