const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
  module: { type: String, required: true }, // e.g., 'PROJ', 'EMP', 'PAY'
  year: { type: Number, required: true },   // e.g., 2026
  sequence: { type: Number, default: 0 }    // e.g., 1
});

// Compound index to ensure uniqueness per module and year
counterSchema.index({ module: 1, year: 1 }, { unique: true });

const Counter = mongoose.model('Counter', counterSchema);
module.exports = Counter;
