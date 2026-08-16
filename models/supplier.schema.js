const mongoose = require("mongoose");
const { Schema } = mongoose;

const supplierSchema = new mongoose.Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  companyName: { type: String, required: true },
  phoneNumber: { type: String },
  supplierType: {
    type: String,
    required: true,
  },
  paymentTerms: {
    type: String,
    default: "monthly",
  },
  accountNumber: {
    type: String,
  },
  address: {
    type: String,
  },
  isActive: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date },
});

supplierSchema.index({ user: 1, isDeleted: 1 });
supplierSchema.index({ isDeleted: 1, createdAt: -1 });

const Supplier = mongoose.model("Supplier", supplierSchema);

module.exports = Supplier;
