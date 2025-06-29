const mongoose = require("mongoose");
const { Schema } = mongoose;

const contractorSchema = new mongoose.Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  companyName: { type: String },
  phoneNumber: { type: String },
  contractorType: {
    type: String,
    // enum: [
    //   "greyStructure",
    //   "finishing",
    //   "interior",
    //   "exterior",
    //   "landscaping",
    //   "painting",
    //   "tiling",
    //   "general",
    //   "electrical",
    //   "plumbing",
    //   "masonry",
    //   "carpentry",
    //   "roofing",
    //   "other",
    // ],

  },
  paymentTerms: {
    type: String,
    // enum: ["daily", "weekly", "bi-weekly", "milestone", "monthly"],
    default: "weekly",
  },
accountNumber: {
    type: String,
  },
  address: {
    type: String,
  },
  isActive: { type: Boolean, default: true },
  rating: { type: Number, min: 1, max: 5 },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date },
});
const Contractor = mongoose.model("Contractor", contractorSchema);

module.exports = Contractor;
