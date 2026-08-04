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
    default: "Client",
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
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, {
  timestamps: true
});

const User = mongoose.model("User", userSchema);
module.exports = User;
