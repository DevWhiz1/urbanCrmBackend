const Material = require("../models/material.schema");
const Project = require("../models/project.schema");

const materialController = {};

// Create a new material entry
materialController.createMaterial = async (req, res) => {
  try {
    const materialData = req.body;
    const newMaterial = new Material(materialData);
    const savedMaterial = await newMaterial.save();
    
    // Update project cost
    const project = await Project.findById(savedMaterial.project);
    if (project) {
      if (savedMaterial.transactionType === 'return') {
        project.materialReturnAmount = (project.materialReturnAmount || 0) + savedMaterial.totalAmount;
      } else {
        project.materialPurchaseCost = (project.materialPurchaseCost || 0) + savedMaterial.totalAmount;
      }
      project.netMaterialCost = project.materialPurchaseCost - project.materialReturnAmount;
      await project.save();
    }

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

// Get all materials (legacy, unpaginated)
materialController.getAllMaterials = async (req, res) => {
  try {
    const materials = await Material.find({ isDeleted: { $ne: true } })
      .populate("project", "_id name")
      .populate("createdBy", "userName");
    res.status(200).json({ data: materials });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch materials",
      error: error.message,
    });
  }
};

// Get materials by project with pagination and search
materialController.getMaterialsByProject = async (req, res) => {
  try {
    const { getPaginationParams, formatPaginatedResponse } = require('../utils/paginate');
    const { projectId } = req.params;
    const { type } = req.query;
    
    let filter = { project: projectId, isDeleted: { $ne: true } };
    
    if (type) filter.transactionType = type;
    
    if (req.query.search) {
      const searchTerm = req.query.search;
      filter.$or = [
        { materialDetail: { $regex: searchTerm, $options: 'i' } },
        { materialProvider: { $regex: searchTerm, $options: 'i' } }
      ];
    }

    const { isPaginated, page, limit, skip } = getPaginationParams(req);
    const total = await Material.countDocuments(filter);

    let sortOptions = { createdAt: -1 };
    if (req.query.sort) {
      if (req.query.sort === 'date_desc') sortOptions = { date: -1 };
      else if (req.query.sort === 'date_asc') sortOptions = { date: 1 };
      else if (req.query.sort === 'amount_desc') sortOptions = { totalAmount: -1 };
      else if (req.query.sort === 'amount_asc') sortOptions = { totalAmount: 1 };
    }

    let query = Material.find(filter)
      .populate("createdBy", "userName")
      .sort(sortOptions);

    if (isPaginated && limit > 0) {
      query = query.skip(skip).limit(limit);
    }

    const materials = await query;
    const response = formatPaginatedResponse(materials, total, page, limit);
    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch materials by project', error: error.message });
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
        status: m.status || 'paid',
        paymentMethod: m.paymentMethod || 'online',
        receiptPhoto: m.receiptPhoto || '',
        createdBy: createdBy || undefined
      };
    });

    const savedMaterials = await Material.insertMany(materialsToInsert);

    // Update project cost for bulk import
    const projectDoc = await Project.findById(project);
    if (projectDoc) {
      let purchaseCostToAdd = 0;
      let returnAmountToAdd = 0;
      savedMaterials.forEach(m => {
         if (m.transactionType === 'return') returnAmountToAdd += m.totalAmount;
         else purchaseCostToAdd += m.totalAmount;
      });
      projectDoc.materialPurchaseCost = (projectDoc.materialPurchaseCost || 0) + purchaseCostToAdd;
      projectDoc.materialReturnAmount = (projectDoc.materialReturnAmount || 0) + returnAmountToAdd;
      projectDoc.netMaterialCost = projectDoc.materialPurchaseCost - projectDoc.materialReturnAmount;
      await projectDoc.save();
    }

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

    // Revert project cost
    const project = await Project.findById(materialToSoftDelete.project);
    if (project) {
      if (materialToSoftDelete.transactionType === 'return') {
        project.materialReturnAmount = (project.materialReturnAmount || 0) - materialToSoftDelete.totalAmount;
      } else {
        project.materialPurchaseCost = (project.materialPurchaseCost || 0) - materialToSoftDelete.totalAmount;
      }
      project.netMaterialCost = project.materialPurchaseCost - project.materialReturnAmount;
      await project.save();
    }

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

// Update a material
materialController.updateMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const oldMaterial = await Material.findById(id);
    if (!oldMaterial) {
      return res.status(404).json({ message: "Material not found" });
    }
    
    // If totalAmount is not directly provided but qty/rate are, calculate it
    if (updateData.MaterialQuantity && updateData.MaterialRate && !updateData.totalAmount) {
       updateData.totalAmount = updateData.MaterialQuantity * updateData.MaterialRate;
    }
    
    const updatedMaterial = await Material.findByIdAndUpdate(id, updateData, { new: true });
    
    // Adjust project cost if project is still the same
    if (oldMaterial.project.toString() === updatedMaterial.project.toString()) {
      const project = await Project.findById(oldMaterial.project);
      if (project) {
        // Revert old
        if (oldMaterial.transactionType === 'return') {
          project.materialReturnAmount = (project.materialReturnAmount || 0) - oldMaterial.totalAmount;
        } else {
          project.materialPurchaseCost = (project.materialPurchaseCost || 0) - oldMaterial.totalAmount;
        }
        
        // Apply new
        if (updatedMaterial.transactionType === 'return') {
          project.materialReturnAmount = (project.materialReturnAmount || 0) + updatedMaterial.totalAmount;
        } else {
          project.materialPurchaseCost = (project.materialPurchaseCost || 0) + updatedMaterial.totalAmount;
        }
        project.netMaterialCost = project.materialPurchaseCost - project.materialReturnAmount;
        await project.save();
      }
    }

    res.status(200).json({
      message: "Material updated successfully",
      data: updatedMaterial,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to update material",
      error: error.message,
    });
  }
};

module.exports = materialController;
