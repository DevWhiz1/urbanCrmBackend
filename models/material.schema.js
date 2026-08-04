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
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  isActive: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, {
  timestamps: true
});

const Material = mongoose.model('Material', materialSchema);
module.exports = Material;
