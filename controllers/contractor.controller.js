const Contractor = require("../models/contractor.schema");

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
contractorController.getAllContractor = async (req, res) => {
  try {
    const clients = await Contractor.find().populate("user");
    res.status(200).json({ data: clients });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch clients",
      error: error.message,
    });
  }
};
module.exports = contractorController;
