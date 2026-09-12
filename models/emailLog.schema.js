const mongoose = require("mongoose");

const emailLogSchema = new mongoose.Schema({
  to: {
    type: String,
    required: true,
  },
  subject: {
    type: String,
    required: true,
  },
  text: {
    type: String,
  },
  html: {
    type: String,
  },
  messageId: {
    type: String,
  },
  status: {
    type: String,
    default: "Sent",
    enum: ["Sent", "Failed"],
  },
  error: {
    type: String,
  }
}, {
  timestamps: true
});

const EmailLog = mongoose.model("EmailLog", emailLogSchema);
module.exports = EmailLog;
