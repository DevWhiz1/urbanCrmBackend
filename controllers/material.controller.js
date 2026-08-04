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
    const materials = await Material.find({ isDeleted: { $ne: true } })
      .populate("project", "_id name");
    res.status(200).json({ data: materials });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch materials",
      error: error.message,
    });
  }
};

// Bulk import material payments from Excel / CSV
materialController.bulkImportMaterials = async (req, res) => {
  try {
    const { project, materials } = req.body;

    if (!project) {
      return res.status(400).json({ message: "Project ID is required." });
    }
    if (!materials || !Array.isArray(materials) || materials.length === 0) {
      return res.status(400).json({ message: "No material rows provided for import." });
    }

    const createdBy = req.user?.userId || req.user?.id || req.user?._id;

    const materialsToInsert = materials.map((m) => {
      let parsedAmount = parseFloat(m.totalAmount || m.amount);
      let parsedQty = parseFloat(m.MaterialQuantity || m.quantity);
      let parsedRate = parseFloat(m.MaterialRate || m.rate);

      // Option 1 vs Option 2 calculation
      if ((isNaN(parsedAmount) || parsedAmount <= 0) && !isNaN(parsedQty) && !isNaN(parsedRate)) {
        parsedAmount = parsedQty * parsedRate;
      }

      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new Error(`Invalid material total amount in row: ${m.materialDetail || 'Material'}`);
      }

      if (isNaN(parsedQty) || parsedQty <= 0) {
        parsedQty = 1;
      }
      if (isNaN(parsedRate) || parsedRate <= 0) {
        parsedRate = parsedAmount / parsedQty;
      }

      const parsedDate = m.date ? new Date(m.date) : new Date();
      const detailStr = (m.materialDetail || m.item || m.description || '').trim();
      const providerStr = (m.materialProvider || m.vendor || m.supplier || '').trim();

      return {
        project,
        materialDetail: detailStr !== '' ? detailStr : 'None',
        materialProvider: providerStr !== '' ? providerStr : 'None',
        MaterialQuantity: parsedQty,
        MaterialRate: parsedRate,
        totalAmount: parsedAmount,
        date: isNaN(parsedDate.getTime()) ? new Date() : parsedDate,
        createdBy: createdBy || undefined
      };
    });

    const savedMaterials = await Material.insertMany(materialsToInsert);

    res.status(201).json({
      message: `Successfully imported ${savedMaterials.length} material payments`,
      count: savedMaterials.length,
      materials: savedMaterials
    });
  } catch (error) {
    console.error("Error bulk importing material payments:", error);
    res.status(500).json({
      message: "Failed to bulk import material payments",
      error: error.message
    });
  }
};

// Soft delete a material
materialController.deleteMaterial = async (req, res) => {
  try {
    const { id } = req.params;

    const materialToSoftDelete = await Material.findById(id);
    if (!materialToSoftDelete) {
      return res.status(404).json({ message: "Material not found" });
    }

    materialToSoftDelete.isDeleted = true;
    materialToSoftDelete.deletedAt = new Date();
    materialToSoftDelete.deletedBy = req.user ? (req.user.id || req.user._id) : null;
    await materialToSoftDelete.save();

    res.status(200).json({
      message: "Material deleted successfully",
      data: materialToSoftDelete,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to delete material",
      error: error.message,
    });
  }
};

module.exports = materialController;
