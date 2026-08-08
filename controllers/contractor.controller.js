const { default: mongoose } = require('mongoose');
const Contractor = require("../models/contractor.schema");
const { getPaginationParams, formatPaginatedResponse } = require('../utils/paginate');
const { invalidateUserScope, invalidateUser } = require('../utils/authCache');

const contractorController = {};

// Create a new contractor
contractorController.createContractor = async (req, res) => {
  try {
    const contractorData = req.body;
    const newContractor = new Contractor(contractorData);
    const savedContractor = await newContractor.save();

    // Invalidate scope cache — a new contractor→user link has been established
    if (contractorData.user) {
      invalidateUserScope(contractorData.user);
    }

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

// Get all contractors with Scoping & Pagination
contractorController.getAllContractor = async (req, res) => {
  try {
    const filter = { isDeleted: { $ne: true } };

    if (req.user?.role === 'Contractor' && req.contractorId) {
      filter._id = req.contractorId;
    }

    if (req.query.search) {
      const searchTerm = req.query.search;
      
      // Find matching users first
      const User = require('../models/users.schema');
      const matchingUsers = await User.find({
        $or: [
          { userName: { $regex: searchTerm, $options: 'i' } },
          { email: { $regex: searchTerm, $options: 'i' } }
        ]
      }).select('_id');
      const userIds = matchingUsers.map(u => u._id);

      filter.$or = [
        { companyName: { $regex: searchTerm, $options: 'i' } },
        { contractorType: { $regex: searchTerm, $options: 'i' } },
        { user: { $in: userIds } }
      ];
    }

    const { isPaginated, page, limit, skip } = getPaginationParams(req);
    let query;

    if (req.query.basic === 'true') {
      filter.isActive = true;
      query = Contractor.find(filter)
        .select('_id companyName contractorType user isActive')
        .populate('user', 'userName email')
        .sort({ createdAt: -1 });

      const contractors = await query;
      return res.status(200).json({
        status: 200,
        data: contractors,
      });
    } else {
      query = Contractor.find(filter)
        .populate('user', 'userName email phoneNumber address status')
        .sort({ createdAt: -1 });

      if (isPaginated && limit > 0) {
        query = query.skip(skip).limit(limit);
      }

      const [total, contractors] = await Promise.all([
        Contractor.countDocuments(filter),
        query.exec()
      ]);

      const response = formatPaginatedResponse(contractors, total, page, limit);
      return res.status(200).json(response);
    }
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: "Failed to fetch contractors",
      error: error.message,
    });
  }
};

// Get a single contractor by ID
contractorController.getContractorById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 400,
        message: "Invalid contractor ID"
      });
    }

    const contractor = await Contractor.findById(id)
      .populate('user', 'userName email phoneNumber address status role');

    if (!contractor) {
      return res.status(404).json({
        status: 404,
        message: "Contractor not found"
      });
    }

    if (req.user?.role === 'Contractor' && contractor._id.toString() !== req.contractorId?.toString()) {
      return res.status(403).json({ status: 403, message: "Access denied to contractor profile" });
    }

    res.status(200).json({
      status: 200,
      message: "Contractor retrieved successfully",
      data: contractor,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Update a contractor
contractorController.updateContractor = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 400,
        message: "Invalid contractor ID"
      });
    }

    // Fetch existing record BEFORE update to capture the old userId.
    // This handles the case where the admin reassigns a contractor to a different user.
    const existingContractor = await Contractor.findById(id).select('user').lean();
    if (!existingContractor) {
      return res.status(404).json({ status: 404, message: "Contractor not found" });
    }

    updateData.updatedAt = Date.now();

    const updatedContractor = await Contractor.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
    .populate('user', 'userName email phoneNumber address status role');

    // Always invalidate the old user's scope cache
    invalidateUserScope(existingContractor.user);

    // If the user field was changed, also invalidate the new user's scope cache
    const newUserId = updateData.user?.toString();
    if (newUserId && existingContractor.user?.toString() !== newUserId) {
      invalidateUserScope(newUserId);
    }

    res.status(200).json({
      status: 200,
      message: "Contractor updated successfully",
      data: updatedContractor,
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

// Delete a contractor
contractorController.deleteContractor = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 400,
        message: "Invalid contractor ID"
      });
    }

    const contractorToSoftDelete = await Contractor.findById(id);

    if (!contractorToSoftDelete) {
      return res.status(404).json({
        status: 404,
        message: "Contractor not found"
      });
    }

    contractorToSoftDelete.isDeleted = true;
    contractorToSoftDelete.deletedAt = new Date();
    contractorToSoftDelete.deletedBy = req.user ? (req.user.id || req.user._id) : null;
    await contractorToSoftDelete.save();

    // Also soft-delete the associated user
    if (contractorToSoftDelete.user) {
      const User = require("../models/users.schema");
      const userToSoftDelete = await User.findById(contractorToSoftDelete.user);
      if (userToSoftDelete) {
        userToSoftDelete.isDeleted = true;
        userToSoftDelete.deletedAt = new Date();
        userToSoftDelete.deletedBy = req.user ? (req.user.id || req.user._id) : null;
        userToSoftDelete.email = `${userToSoftDelete.email}_deleted_${Date.now()}`;
        await userToSoftDelete.save();
      }

      // Invalidate both caches — contractor and linked user are now soft-deleted
      invalidateUser(contractorToSoftDelete.user);
    }

    res.status(200).json({
      status: 200,
      message: "Contractor deleted successfully",
      data: contractorToSoftDelete,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: "Internal server error",
      error: error.message,
    });
  }
};

module.exports = contractorController;
