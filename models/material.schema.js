const mongoose = require('mongoose');

const materialSchema = new mongoose.Schema({
  project: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Project', 
    required: true 
  },
  paymentId: {
    type: String,
    unique: true
  },
  materialDetail: {
    type: String,
  },
  materialProvider: {
    type: String,
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
  },
  MaterialQuantity: {
    type: Number,
    required: true
  },
MaterialRate: {
    type: Number,
    required: true
  },
  totalAmount: {
    type: Number,
    required: true
  },
  transactionType: {
    type: String,
    enum: ['purchase', 'return'],
    default: 'purchase'
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'verified', 'disputed', 'rejected'],
    default: 'paid'
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'check', 'bank_transfer', 'upi', 'digital_wallet', 'online'],
    required: false,
    default: 'online'
  },
  receiptPhoto: {
    type: String
  },
  description: {
    type: String
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  isActive: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, {
  timestamps: true
});

materialSchema.index({ project: 1, isDeleted: 1, createdAt: -1 });

const Material = mongoose.model('Material', materialSchema);
module.exports = Material;
