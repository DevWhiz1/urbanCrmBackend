const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const usersSchema = require("../models/users.schema");
const { getPaginationParams, formatPaginatedResponse } = require("../utils/paginate");
const { invalidateUserAuth, invalidateUser } = require("../utils/authCache");
const { VALID_ROLES } = require("../utils/roles");

const userController = {};

userController.getAllUsers = async (req, res) => {
  try {
    const filter = { isDeleted: { $ne: true } };
    if (req.query.role) {
      filter.role = req.query.role;
    }
    if (req.query.status) {
      filter.status = req.query.status;
    }
    if (req.query.search) {
      filter.$or = [
        { userName: { $regex: req.query.search, $options: "i" } },
        { email: { $regex: req.query.search, $options: "i" } },
      ];
    }

    const { isPaginated, page, limit, skip } = getPaginationParams(req);
    const total = await usersSchema.countDocuments(filter);

    let query = usersSchema.find(filter, { password: 0, accessToken: 0 }).sort({ createdAt: -1 });

    if (isPaginated && limit > 0) {
      query = query.skip(skip).limit(limit);
    }

    const users = await query;
    const response = formatPaginatedResponse(users, total, page, limit);
    return res.status(200).json(response);
  } catch (error) {
    console.error("Something went wrong:", error);
    res.status(500).json({ status: 500, message: "Something went wrong" });
  }
};

userController.updateUser = async (req, res) => {
  try {
    const body = req.body;
    const id = req.params.id;

    // Validate role if being changed
    if (body.role !== undefined && !VALID_ROLES.includes(body.role)) {
      return res.status(400).json({ message: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });
    }

    if (body.password) {
      body.plainPassword = body.password;
      body.password = await bcrypt.hash(body.password, 10);
    }

    // Fetch old user to detect role changes
    const oldUser = await usersSchema.findById(id).select('role email').lean();
    if (!oldUser) {
      return res.status(400).json({ message: "User not found" });
    }
    const oldRole = oldUser.role;

    const updateUser = await usersSchema.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true, select: "-password" } 
    );
    if (!updateUser) {
      return res.status(400).json({ message: "Error in updating user" });
    }

    // Sync Employee status
    try {
      const Employee = require("../models/employee.schema");
      if (updateUser.status === 'InActive') {
        await Employee.findOneAndUpdate({ email: updateUser.email }, { status: 'Inactive', isActive: false });
      } else if (updateUser.status === 'Active') {
        await Employee.findOneAndUpdate({ email: updateUser.email }, { status: 'Active', isActive: true });
      }
    } catch (err) {
      console.log('Employee sync skipped:', err.message);
    }

    // Role-change handling: soft-delete old profile record
    if (body.role !== undefined && body.role !== oldRole) {
      const softDelete = { isDeleted: true, deletedAt: new Date(), deletedBy: req.user ? (req.user.userId || req.user.id || req.user._id) : null };
      try {
        if (oldRole === 'Client') {
          const Client = require("../models/client.schema");
          await Client.findOneAndUpdate({ user: id, isDeleted: { $ne: true } }, softDelete);
        } else if (oldRole === 'Contractor') {
          const Contractor = require("../models/contractor.schema");
          await Contractor.findOneAndUpdate({ user: id, isDeleted: { $ne: true } }, softDelete);
        } else if (oldRole === 'Supplier') {
          const Supplier = require("../models/supplier.schema");
          await Supplier.findOneAndUpdate({ user: id, isDeleted: { $ne: true } }, softDelete);
        }
      } catch (err) {
        console.log('Old profile cleanup skipped:', err.message);
      }
    }

    // Role change can leave a stale contractorId/clientId/supplierId in scope cache —
    // clear both. Status-only changes only need the auth cache.
    if (body.role !== undefined) {
      invalidateUser(id);
    } else if (body.status !== undefined) {
      invalidateUserAuth(id);
    }

    res.status(200).json({ message: "User updated successfully", user: updateUser });
  } catch (error) {
    console.error("Error in updating user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

userController.getSingleUser = async (req, res) => {
  try {
    const id = req.params.id;
    const user = await usersSchema.findById(id, { password: 0 });
    return res.status(200).json({
      status: 200,
      message: "User Retrieved Successfully",
      data: user,
    });
  } catch (error) {
    console.error("Something went wrong:", error);
    res.status(500).json({ status: 500, message: "Something went wrong" });
  }
};

userController.updatePassword = async (req, res) => {
  try {
    const id = req.params.id;
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ status: 400, message: "Old and new password are required" });
    }
    const user = await usersSchema.findById(id);
    if (!user) {
      return res.status(404).json({ status: 404, message: "User Not Found" });
    }
    const passwordMatch = await bcrypt.compare(oldPassword, user.password);
    if (!passwordMatch) {
      return res.status(403).json({ status: 403, message: "Incorrect old password" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.plainPassword = newPassword;
    await user.save();

    return res.status(200).json({
      status: 200,
      message: "Password Updated Successfully.",
    });
  } catch (error) {
    console.error("Error updating password:", error);
    return res.status(500).json({ status: 500, message: "Internal Server Error" });
  }
};

userController.forceUpdatePassword = async (req, res) => {
  try {
    const id = req.params.id;
    const { newPassword } = req.body;
    if (!newPassword) {
      return res.status(400).json({ status: 400, message: "New password is required" });
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const updatedUser = await usersSchema.findByIdAndUpdate(
      id,
      { $set: { password: hashedPassword, plainPassword: newPassword } },
      { new: true, select: "-password" }
    );
    if (!updatedUser) {
      return res.status(404).json({ status: 404, message: "User Not Found" });
    }
    return res.status(200).json({
      status: 200,
      message: "Password Updated Successfully.",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error force updating password:", error);
    return res.status(500).json({ status: 500, message: "Internal Server Error" });
  }
};

userController.deleteUser = async (req, res) => {
  try {
    const id = req.params.id;
    const userToSoftDelete = await usersSchema.findById(id);
    if (!userToSoftDelete) {
      return res.status(404).json({ message: "User not found" });
    }

    const originalEmail = userToSoftDelete.email;

    userToSoftDelete.isDeleted = true;
    userToSoftDelete.deletedAt = new Date();
    userToSoftDelete.deletedBy = req.user ? (req.user.id || req.user._id) : null;
    userToSoftDelete.email = `${userToSoftDelete.email}_deleted_${Date.now()}`;
    await userToSoftDelete.save();

    // Also soft-delete any associated Client, Contractor, Supplier or Employee
    const Client = require("../models/client.schema");
    const Contractor = require("../models/contractor.schema");
    const Supplier = require("../models/supplier.schema");
    const Employee = require("../models/employee.schema");
    const updateObj = { isDeleted: true, deletedAt: new Date(), deletedBy: req.user ? (req.user.id || req.user._id) : null };
    
    await Client.findOneAndUpdate({ user: id }, updateObj);
    await Contractor.findOneAndUpdate({ user: id }, updateObj);
    await Supplier.findOneAndUpdate({ user: id }, updateObj);
    await Employee.findOneAndUpdate({ email: originalEmail }, { isDeleted: true, isActive: false, deletedAt: new Date() });

    // Invalidate both caches — user and all linked scope data is now gone
    invalidateUser(id);
    
    return res.status(200).json({ message: "User permanently deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

userController.createUser = async (req, res) => {
  try {
    const { userName, email, password, role } = req.body;

    if (!userName || !email || !password) {
      return res.status(400).json({ message: "userName, email and password are required" });
    }

    if (role && !VALID_ROLES.includes(role)) {
      return res.status(400).json({ message: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });
    }

    const existingUser = await usersSchema.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new usersSchema({
      userName,
      email,
      password: hashedPassword,
      plainPassword: password,
      role: role || "Client",
      status: "Active",
    });

    await user.save();

    return res.status(201).json({
      message: "User created successfully",
      user: {
        id: user._id,
        userName: user.userName,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    console.error("Error creating user:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = userController;

