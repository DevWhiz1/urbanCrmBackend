const projectContractSchema = new mongoose.Schema({
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
  contractType: {
    type: String,
  },
  totalAmount: { type: Number, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date },
   payments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment'
  }],
  // Status
  isTerminated: { type: Boolean, default: false }
}, { timestamps: true });

const ProjectContract = mongoose.model('ProjectContract', projectContractSchema);
module.exports = ProjectContract;