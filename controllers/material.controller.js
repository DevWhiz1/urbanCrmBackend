const Material = require("../models/material.schema");

const materialController = {};

// Create a new material entry
materialController.createMaterial = async (req, res) => {
  try {
    const materialData = req.body;
    const newMaterial = new Material(materialData);
    const savedMaterial = await newMaterial.save();
    res.status(201).json({
      message: "Material added successfully",
      material: savedMaterial,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to add material",
      error: error.message,
    });
  }
};

// Get all materials
materialController.getAllMaterials = async (req, res) => {
  try {
    const materials = await Material.find()
      .populate("project", "_id name");
    res.status(200).json({ data: materials });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch materials",
      error: error.message,
    });
  }
};

module.exports = materialController;
