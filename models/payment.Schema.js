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
    required: true
  },
  contract: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProjectContract'
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
    enum: ['cash', 'check', 'bank_transfer', 'upi', 'digital_wallet'],
    required: true
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
    required: true
  }
}, { 
  timestamps: true 
});
const Payment = mongoose.model('Payment', paymentSchema);
module.exports = Payment;