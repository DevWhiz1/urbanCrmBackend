const { default: mongoose } = require('mongoose');
const Supplier = require("../models/supplier.schema");
const { getPaginationParams, formatPaginatedResponse } = require('../utils/paginate');
const { invalidateUserScope, invalidateUser } = require('../utils/authCache');

const supplierController = {};

// Create a new supplier
supplierController.createSupplier = async (req, res) => {
  try {
    const supplierData = req.body;
    const newSupplier = new Supplier(supplierData);
    const savedSupplier = await newSupplier.save();

    // Invalidate scope cache — a new supplier→user link has been established
    if (supplierData.user) {
      invalidateUserScope(supplierData.user);
    }

    res.status(201).json({
      message: "Supplier created successfully",
      supplier: savedSupplier,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to create supplier",
      error: error.message,
    });
  }
};

// Get all suppliers with Pagination (Admin only)
supplierController.getAllSuppliers = async (req, res) => {
  try {
    const filter = { isDeleted: { $ne: true } };

    const { isPaginated, page, limit, skip } = getPaginationParams(req);

    if (req.query.basic === 'true') {
      filter.isActive = true;
      const query = Supplier.find(filter)
        .select('_id companyName supplierType')
        .sort({ createdAt: -1 })
        .lean();

      const suppliers = await query;
      return res.status(200).json({
        status: 200,
        data: suppliers,
      });
    } else {
      const pipeline = [
        { $match: filter },
        {
          $lookup: {
            from: 'users',
            localField: 'user',
            foreignField: '_id',
            as: 'user'
          }
        },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } }
      ];

      if (req.query.supplierType) {
        pipeline.push({
          $match: {
            supplierType: req.query.supplierType
          }
        });
      }

      if (req.query.status) {
        pipeline.push({
          $match: {
            'user.status': req.query.status
          }
        });
      }

      if (req.query.search) {
        const searchTerm = req.query.search;
        pipeline.push({
          $match: {
            $or: [
              { companyName: { $regex: searchTerm, $options: 'i' } },
              { supplierType: { $regex: searchTerm, $options: 'i' } },
              { 'user.userName': { $regex: searchTerm, $options: 'i' } },
              { 'user.email': { $regex: searchTerm, $options: 'i' } },
              { 'user.phoneNumber': { $regex: searchTerm, $options: 'i' } }
            ]
          }
        });
      }

      pipeline.push(
        { $sort: { createdAt: -1 } },
        { 
          $project: {
            'user.password': 0,
            'user.plainPassword': 0
          }
        }
      );

      const facetPipeline = [
        ...pipeline,
        {
          $facet: {
            data: isPaginated && limit > 0 ? [{ $skip: skip }, { $limit: limit }] : [],
            totalCount: [{ $count: 'count' }]
          }
        }
      ];

      const result = await Supplier.aggregate(facetPipeline);
      const data = result[0]?.data || [];
      const total = result[0]?.totalCount[0]?.count || 0;

      const response = formatPaginatedResponse(data, total, page, limit);
      return res.status(200).json(response);
    }
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: "Failed to fetch suppliers",
      error: error.message,
    });
  }
};

// Get a single supplier by ID (Admin only)
supplierController.getSupplierById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 400,
        message: "Invalid supplier ID"
      });
    }

    const supplier = await Supplier.findById(id)
      .populate('user', 'userName email phoneNumber address status role');

    if (!supplier) {
      return res.status(404).json({
        status: 404,
        message: "Supplier not found"
      });
    }

    res.status(200).json({
      status: 200,
      message: "Supplier retrieved successfully",
      data: supplier,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Update a supplier
supplierController.updateSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 400,
        message: "Invalid supplier ID"
      });
    }

    // Fetch existing record BEFORE update to capture the old userId.
    const existingSupplier = await Supplier.findById(id).select('user').lean();
    if (!existingSupplier) {
      return res.status(404).json({ status: 404, message: "Supplier not found" });
    }

    updateData.updatedAt = Date.now();

    const updatedSupplier = await Supplier.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
    .populate('user', 'userName email phoneNumber address status role');

    // Always invalidate the old user's scope cache
    invalidateUserScope(existingSupplier.user);

    // If the user field was changed, also invalidate the new user's scope cache
    const newUserId = updateData.user?.toString();
    if (newUserId && existingSupplier.user?.toString() !== newUserId) {
      invalidateUserScope(newUserId);
    }

    res.status(200).json({
      status: 200,
      message: "Supplier updated successfully",
      data: updatedSupplier,
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ status: 400, message: error.message });
    }
    res.status(500).json({
      status: 500,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Delete a supplier
supplierController.deleteSupplier = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 400,
        message: "Invalid supplier ID"
      });
    }

    const supplierToSoftDelete = await Supplier.findById(id);

    if (!supplierToSoftDelete) {
      return res.status(404).json({
        status: 404,
        message: "Supplier not found"
      });
    }

    supplierToSoftDelete.isDeleted = true;
    supplierToSoftDelete.deletedAt = new Date();
    supplierToSoftDelete.deletedBy = req.user ? (req.user.id || req.user._id) : null;
    await supplierToSoftDelete.save();

    // Also soft-delete the associated user
    if (supplierToSoftDelete.user) {
      const User = require("../models/users.schema");
      const userToSoftDelete = await User.findById(supplierToSoftDelete.user);
      if (userToSoftDelete) {
        userToSoftDelete.isDeleted = true;
        userToSoftDelete.deletedAt = new Date();
        userToSoftDelete.deletedBy = req.user ? (req.user.id || req.user._id) : null;
        userToSoftDelete.email = `${userToSoftDelete.email}_deleted_${Date.now()}`;
        await userToSoftDelete.save();
      }

      // Invalidate both caches — supplier and linked user are now soft-deleted
      invalidateUser(supplierToSoftDelete.user);
    }

    res.status(200).json({
      status: 200,
      message: "Supplier deleted successfully",
      data: supplierToSoftDelete,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: "Internal server error",
      error: error.message,
    });
  }
};

module.exports = supplierController;
