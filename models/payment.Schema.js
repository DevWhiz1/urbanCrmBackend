const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  contractor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contractor',
  },
  contract: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProjectContract'
  },
  type: {
    type: String,
    enum: ['credit', 'debit'],
    default: 'debit',
    required: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  amount: {
    type: Number,
    required: true,
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'check', 'bank_transfer', 'upi', 'digital_wallet', 'online'],
    required: false,
    default: 'online'
  },
  transactionId: {
    type: String,
  },
  workDescription: String,

  // Status Tracking
  status: {
    type: String,
    enum: ['pending', 'paid', 'verified', 'disputed', 'rejected'],
    default: 'paid'
  },
  
  // Audit Trail
  receiptPhoto: String, // URL
  notes: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  isActive: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { 
  timestamps: true 
});

const Payment = mongoose.model('Payment', paymentSchema);
module.exports = Payment;