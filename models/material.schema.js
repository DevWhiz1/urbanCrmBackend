const mongoose = require('mongoose');

const materialSchema = new mongoose.Schema({
  project: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Project', 
    required: true 
  },
  materialDetail: {
    type: String,
  },
  materialProvider: {
    type: String,
  },
  MaterialQuantity: {
    type: Number,
  },
MaterialRate: {
    type: Number,
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

const Material = mongoose.model('Material', materialSchema);
module.exports = Material;
