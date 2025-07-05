const Payment = require("../models/payment.Schema");
    const Project = require('../models/project.schema');
const paymentController = {};
const mongoose = require('mongoose');
const Material = require('../models/material.schema');

// Create a new payment
paymentController.createPayment = async (req, res) => {
  try {
    const paymentData = req.body;
    // console.log("Payment Data:", paymentData);
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
    // console.error("Error creating payment:", error);
  }
};

// Get all payments
// paymentController.getAllPayments = async (req, res) => {
//   try {
//     const payments = await Payment.find()
//       .populate("project")
//       .populate("contractor")
//       .populate("contract")
//       .populate("createdBy");
//     res.status(200).json({ data: payments });
//   } catch (error) {
//     res.status(500).json({
//       message: "Failed to fetch payments",
//       error: error.message,
//     });
//   }
// };

paymentController.getAllPayments = async (req, res) => {
  try {
    const payments = await Payment.aggregate([
      // Lookup Project
      {
        $lookup: {
          from: "projects",
          localField: "project",
          foreignField: "_id",
          as: "project"
        }
      },
      { $unwind: { path: "$project", preserveNullAndEmptyArrays: true } },

      // Lookup Contractor
      {
        $lookup: {
          from: "contractors",
          localField: "contractor",
          foreignField: "_id",
          as: "contractor"
        }
      },
      { $unwind: { path: "$contractor", preserveNullAndEmptyArrays: true } },

      // Lookup Contract
      {
        $lookup: {
          from: "projectcontracts",
          localField: "contract",
          foreignField: "_id",
          as: "contract"
        }
      },
      { $unwind: { path: "$contract", preserveNullAndEmptyArrays: true } },

      // Lookup CreatedBy (User)
      {
        $lookup: {
          from: "users",
          localField: "createdBy",
          foreignField: "_id",
          as: "createdBy"
        }
      },
      { $unwind: { path: "$createdBy", preserveNullAndEmptyArrays: true } },

      // Project only needed fields
      {
        $project: {
          _id: 1,
          amount: 1,
          date: 1,
          status: 1,
          paymentMethod: 1,
          transactionId: 1,
          workDescription: 1,
          notes: 1,
          receiptPhoto: 1,
          "project._id": 1,
          "project.name": 1,
          "contractor._id": 1,
          "contractor.companyName": 1,
          "contract._id": 1,
          "contract.contractType": 1,
          "createdBy._id": 1,
          "createdBy.userName": 1,
        }
      }
    ]);
    res.status(200).json({ data: payments });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch payments",
      error: error.message,
    });
  }
};

// Add payment for a project
paymentController.addPaymentForProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const paymentData = req.body;
    paymentData.project = projectId;
    const newPayment = new Payment(paymentData);
    const savedPayment = await newPayment.save();
    // Update the project's totalPaymentReceived
    await Project.findByIdAndUpdate(
      projectId,
      { $inc: { totalPaymentReceived: savedPayment.amount } },
      { new: true }
    );
    res.status(201).json({
      message: "Payment added successfully",
      payment: savedPayment,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to add payment",
      error: error.message,
    });
  }
};

// Get total payment for a project
paymentController.getTotalPaymentForProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const result = await Payment.aggregate([
{ $match: { project: new mongoose.Types.ObjectId(projectId) } },

      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const total = result[0]?.total || 0;
    res.json({ projectId, totalPaymentReceived: total });
  } catch (error) {
    res.status(500).json({ message: "Failed to calculate total payment", error: error.message });
  }
};

// Get all payments for a project (with optional type filter)
paymentController.getPaymentsByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { type } = req.query; // e.g. ?type=debit
    let filter = { project: new mongoose.Types.ObjectId(projectId) };
    if (type) filter.status = type; // assuming status is used for debit/credit
    const payments = await Payment.find(filter)
      .populate('contractor', 'companyName')
      .populate('contract', 'contractType')
      .populate('createdBy', 'userName');
    res.status(200).json({ data: payments });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch payments by project', error: error.message });
  }
};

// Get project payment summary (total, totalPaymentReceived, totalDebits, net)
paymentController.getProjectPaymentSummary = async (req, res) => {
  try {
    const { projectId } = req.params;
    // Get totalPaymentReceived from Project collection
    const project = await Project.findById(projectId).select('totalPaymentReceived');
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    // Get all payments for the project
    const payments = await Payment.find({ project: projectId });
    // Calculate total debits (status === 'debit')
const totalDebits = payments.filter(p => p.type === 'debit').reduce((sum, p) => sum + (p.amount || 0), 0);
    // Net = totalPaymentReceived - total debits
    const net = project.totalPaymentReceived - totalDebits;
    res.json({ projectId, totalPaymentReceived: project.totalPaymentReceived, totalDebits, net, payments });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get project payment summary', error: error.message });
  }
};

// Get all material payments for a project and their sum
paymentController.getMaterialPaymentsByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const materials = await Material.find({ project: projectId });
    const totalMaterialPayments = materials.reduce((sum, m) => sum + (m.totalAmount || 0), 0);
    res.json({ projectId, totalMaterialPayments, materials });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get material payments', error: error.message });
  }
};

// Get full project financial summary
paymentController.getFullProjectFinancialSummary = async (req, res) => {
  try {
    const { projectId } = req.params;
    // Get full project details
    const project = await Project.findById(projectId).select('name totalPaymentReceived projectType totalLabourCost totalCost');
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    // Payments with contractor and contract populated
    const payments = await Payment.find({ project: projectId })
      .populate('contractor', 'companyName')
      .populate('contract', 'contractType')
      .populate('createdBy', 'userName');
    const totalDebits = payments.filter(p => p.type === 'debit').reduce((sum, p) => sum + (p.amount || 0), 0);
    // Materials
    const materials = await Material.find({ project: projectId });
    const totalMaterialPayments = materials.reduce((sum, m) => sum + (m.totalAmount || 0), 0);
    // Net calculation
    const net = project.totalPaymentReceived - totalDebits - totalMaterialPayments;
    // Project cost logic
    let projectCost = null;
    if (project.projectType === 'labourRate') {
      projectCost = project.totalLabourCost;
    } else if (project.projectType === 'withMaterial') {
      projectCost = project.totalCost;
    }
    res.json({
      projectId,
      projectName: project.name,
      projectType: project.projectType,
      projectCost,
      totalPaymentReceived: project.totalPaymentReceived,
      totalDebits,
      totalMaterialPayments,
      net,
      payments,
      materials
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get full project financial summary', error: error.message });
  }
};

module.exports = paymentController;