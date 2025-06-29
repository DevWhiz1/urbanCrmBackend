const mongoose = require("mongoose");

const clientSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true
  },
  paymentTerms: {
    type: String
  },
  bankDetails: {
    type: String
  },
  address: {
    type: String
  },
  phoneNumber: {
    type: String
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

module.exports = mongoose.model("Client", clientSchema);