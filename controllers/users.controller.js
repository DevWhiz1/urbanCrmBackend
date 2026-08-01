const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const usersSchema = require("../models/users.schema");

const userController = {};

userController.getAllUsers = async (req, res) => {
  try {
    const users = await usersSchema.find({ role: "User" }, { password: 0, accessToken: 0 });
    return res.status(200).json({
      status: 200,
      message: "Users Retrieved Successfully",
      data: users,
    });
  } catch (error) {
    console.error("Something went wrong:", error);
    res.status(500).json({ status: 500, message: "Something went wrong" });
  }
};

userController.updateUser = async (req, res) => {
  try {
    const body = req.body;
    const id = req.params.id;
    const updateUser = await usersSchema.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true } 
    );
    if (!updateUser) {
      return res.status(400).json({ message: "Error in updating user" });
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
    const user = await usersSchema.findById(id);
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
      { $set: { password: hashedPassword } },
      { new: true }
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

module.exports = userController;
