const Payment = require("../models/payment.Schema");

const paymentController = {};

// Create a new payment
paymentController.createPayment = async (req, res) => {
  try {
    const paymentData = req.body;
    const newPayment = new Payment(paymentData);
    const savedPayment = await newPayment.save();
    res.status(201).json({
      message: "Payment created successfully",
      payment: savedPayment,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to create payment",
      error: error.message,
    });
  }
};

// Get all payments
paymentController.getAllPayments = async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate("project")
      .populate("contractor")
      .populate("contract")
      .populate("createdBy");
    res.status(200).json({ data: payments });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch payments",
      error: error.message,
    });
  }
};

module.exports = paymentController;