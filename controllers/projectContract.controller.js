const ProjectContract = require("../models/projectContractSchema");

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

// Get all project contracts
projectContractController.getAllProjectContracts = async (req, res) => {
  try {
    const contracts = await ProjectContract.find()
      .populate("project")
      .populate("contractor")
      .populate("payments");
    res.status(200).json({ data: contracts });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch project contracts",
      error: error.message,
    });
  }
};

module.exports = projectContractController;