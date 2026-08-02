const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  userName: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true, 
  },
  phoneNumber: {
    type: String,
  },
  role: {
    type: String,
    default: "User",
    enum: ["Admin", "Contractor", "User"],
  },
  password: {
    type: String,
    required: true,
  },
  plainPassword: {
    type: String,
  },
  accessToken: {
    type: String,
  },
  address: {
    type: String,
  },
  status: {
    type: String,
    required: true,
    default: "Active",
    enum: ["Active", "InActive"],
  },
}, {
  timestamps: true
});

const User = mongoose.model("User", userSchema);
module.exports = User;
