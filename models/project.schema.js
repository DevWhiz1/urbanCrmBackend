const mongoose = require('mongoose');
const { Schema } = mongoose;

const projectSchema = new mongoose.Schema({
  // Basic Information
  name: { type: String, required: true },
  projectCode: { type: String, unique: true },// automaticaly genereated with the help of project name+number
  location: { 
    type: String,
    required: true,
  },
  // People
    projectCategory: { 
    type: String,
    enum: ['residential', 'commercial', 'industrial', 'infrastructure', 'other']
  },
    projectType: { 
    type: String,
    enum: ['labourRate', 'withMaterial',]
  },
  ratePerSquareFoot: { type: Number },
  totalArea: { type: Number },
  totalCoverageArea: { type: Number },
  totalCost: { type: Number },
  labouRate: { type: Number },
  totalLabourCost: { type: Number },
      // Timeline
totalPaymentReceived: { 
  type: Number,
   default: 0 },
  startDate: { type: Date },
  estimatedDuration: { type: Date },
  actualCompletionDate: { type: Date },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
    contractors: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Contractor' 
    }],
  materials: [{ type: Schema.Types.ObjectId, ref: 'Material' }],
  // Project Details
  description: { type: String },
  // Status
  status: {
    type: String,
    enum: ['planning', 'pending', 'ongoing', 'completed', 'on_hold', 'cancelled'],
    default: 'planning',
  },
  progress: { type: Number, min: 0, max: 100, default: 0 }, 
  // Documents
  drawings: [{ type: String }], // URLs to drawings
  contracts: [{ type: String }], // URLs to contracts
    invoices: [{ type: String }], // URLs to invoices
  // Meta
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date },
});

const Project = mongoose.model('Project', projectSchema);
module.exports = Project;