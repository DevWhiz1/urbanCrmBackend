const Payment = require("../models/payment.schema");
const Project = require('../models/project.schema');
const Material = require('../models/material.schema');
const ProjectContract = require('../models/projectContractSchema');
const mongoose = require('mongoose');
const { getPaginationParams, formatPaginatedResponse } = require('../utils/paginate');

const paymentController = {};

// Create a new payment
paymentController.createPayment = async (req, res) => {
  try {
    const paymentData = req.body;
    console.log("Payment Data:", paymentData);
    const newPayment = new Payment(paymentData);
    const savedPayment = await newPayment.save();
    res.status(201).json({
      message: "Payment created successfully",
      payment: savedPayment,
    });
  } catch (error) {
    console.error("Error creating payment:", error);
    res.status(500).json({
      message: "Failed to create payment",
      error: error.message,
    });
  }
};

// Get all payments with Role Scoping & Pagination
paymentController.getAllPayments = async (req, res) => {
  try {
    const { isPaginated, page, limit, skip } = getPaginationParams(req);
    const matchStage = {};

    // Role-based scoping
    if (req.user?.role === 'Contractor') {
      if (req.contractorId) {
        matchStage.contractor = new mongoose.Types.ObjectId(req.contractorId);
      }
    }

    const pipeline = [
      { $match: matchStage },
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

      // Filter by Client scope if User role
      ...(req.user?.role === 'User' && req.clientId ? [
        { $match: { "project.customer": new mongoose.Types.ObjectId(req.clientId) } }
      ] : []),

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

      // Project fields
      {
        $project: {
          _id: 1,
          amount: 1,
          date: 1,
          status: 1,
          type: 1,
          paymentMethod: 1,
          transactionId: 1,
          workDescription: 1,
          notes: 1,
          receiptPhoto: 1,
          createdAt: 1,
          "project._id": 1,
          "project.name": 1,
          "contractor._id": 1,
          "contractor.companyName": 1,
          "contract._id": 1,
          "contract.contractType": 1,
          "createdBy._id": 1,
          "createdBy.userName": 1,
        }
      },
      { $sort: { createdAt: -1 } }
    ];

    // Execution with Facet for Count & Pagination
    const facetPipeline = [
      ...pipeline,
      {
        $facet: {
          data: isPaginated && limit > 0 ? [{ $skip: skip }, { $limit: limit }] : [],
          totalCount: [{ $count: "count" }]
        }
      }
    ];

    const result = await Payment.aggregate(facetPipeline);
    const data = result[0]?.data || [];
    const total = result[0]?.totalCount[0]?.count || 0;

    const response = formatPaginatedResponse(data, total, page, limit);
    res.status(200).json(response);
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
    const paymentData = req.body;
    if (!paymentData.project) {
      return res.status(400).json({ message: "Project ID is required in the body." });
    }
    const newPayment = new Payment(paymentData);
    const savedPayment = await newPayment.save();
    if (savedPayment.type === 'credit') {
      await Project.findByIdAndUpdate(
        paymentData.project,
        { $inc: { totalPaymentReceived: savedPayment.amount } },
        { new: true }
      );
    }
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

// Get all payments for a project (with optional type filter and pagination)
paymentController.getPaymentsByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { type } = req.query;
    let filter = { project: new mongoose.Types.ObjectId(projectId) };
    if (type) filter.type = type;

    // Role-based scoping
    if (req.user?.role === 'Contractor' && req.contractorId) {
      filter.contractor = new mongoose.Types.ObjectId(req.contractorId);
    }

    const { isPaginated, page, limit, skip } = getPaginationParams(req);
    const total = await Payment.countDocuments(filter);

    let query = Payment.find(filter)
      .populate('contractor', 'companyName')
      .populate('contract', 'contractType')
      .populate('createdBy', 'userName')
      .sort({ createdAt: -1 });

    if (isPaginated && limit > 0) {
      query = query.skip(skip).limit(limit);
    }

    const payments = await query;
    const response = formatPaginatedResponse(payments, total, page, limit);
    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch payments by project', error: error.message });
  }
};

// Get project payment summary (total, totalPaymentReceived, totalDebits, net)
paymentController.getProjectPaymentSummary = async (req, res) => {
  try {
    const { projectId } = req.params;
    const project = await Project.findById(projectId).select('totalPaymentReceived');
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    const payments = await Payment.find({ project: projectId });
    const totalDebits = payments.filter(p => p.type === 'debit').reduce((sum, p) => sum + (p.amount || 0), 0);
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
    const project = await Project.findById(projectId).select('name totalPaymentReceived projectType totalCost additions');
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    const payments = await Payment.find({ project: projectId })
      .populate('contractor', 'companyName')
      .populate('contract', 'contractType')
      .populate('createdBy', 'userName');
    const totalDebits = payments.filter(p => p.type === 'debit').reduce((sum, p) => sum + (p.amount || 0), 0);
    const materials = await Material.find({ project: projectId });
    const totalMaterialPayments = materials.reduce((sum, m) => sum + (m.totalAmount || 0), 0);
    const net = project.totalPaymentReceived - totalDebits - totalMaterialPayments;
    const additionsTotal = (project.additions || []).reduce((sum, a) => sum + (a.amount || 0), 0);
    const projectCost = project.totalCost || 0;
    const baseProjectCost = Math.max(0, projectCost - additionsTotal);
    res.json({
      projectId,
      projectName: project.name,
      projectType: project.projectType,
      projectCost,
      baseProjectCost,
      additionsTotal,
      additions: project.additions || [],
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

// Get all project contracts for a specific project
paymentController.getProjectContractsByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const contracts = await ProjectContract.find({ project: projectId })
      .populate('contractor', 'companyName')
      .populate('project', 'name');
    res.status(200).json({ projectId, contracts });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch project contracts', error: error.message });
  }
};

// Get summary and all payments for a specific contractor's project contract
paymentController.getProjectContractSummary = async (req, res) => {
  try {
    const { projectContractId } = req.params;
    const contract = await ProjectContract.findById(projectContractId)
      .populate('project', 'name')
      .populate('contractor', 'companyName');
    if (!contract) {
      return res.status(404).json({ message: 'Project contract not found' });
    }
    const payments = await Payment.find({ contract: projectContractId })
      .populate('contractor', 'companyName')
      .populate('createdBy', 'userName');
    const additionsTotal = (contract.additions || []).reduce((sum, a) => sum + (a.amount || 0), 0);
    const revisedTotalAmount = (contract.totalAmount || 0) + additionsTotal;
    const totalPayments = payments.filter(p => p.type === 'debit').reduce((sum, p) => sum + (p.amount || 0), 0);
    const net = revisedTotalAmount - totalPayments;
    res.json({
      projectContractId,
      projectName: contract.project?.name,
      contractorName: contract.contractor?.companyName,
      contractType: contract.contractType,
      totalAmount: revisedTotalAmount,
      baseTotalAmount: contract.totalAmount,
      additionsTotal,
      additions: contract.additions || [],
      totalPayments,
      net,
      payments,
      contract
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get project contract summary', error: error.message });
  }
};

// Bulk import payments for a project, contractor, and contract
paymentController.bulkImportPayments = async (req, res) => {
  try {
    const { project, contractor, contract, payments } = req.body;

    if (!project) {
      return res.status(400).json({ message: "Project ID is required." });
    }
    if (!contractor) {
      return res.status(400).json({ message: "Contractor ID is required." });
    }
    if (!payments || !Array.isArray(payments) || payments.length === 0) {
      return res.status(400).json({ message: "No payments provided for import." });
    }

    const createdBy = req.user?.userId || req.user?.id || req.user?._id;

    // Prepare payments data array
    const paymentsToInsert = payments.map((p) => {
      const parsedAmount = parseFloat(p.amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new Error(`Invalid payment amount: ${p.amount}`);
      }

      const parsedDate = p.date ? new Date(p.date) : new Date();
      const rawDesc = p.workDescription || p.notes;
      const finalDesc = (rawDesc && rawDesc.trim() !== '') ? rawDesc.trim() : 'None';

      return {
        project,
        contractor,
        contract: contract || undefined,
        type: p.type || 'debit',
        date: isNaN(parsedDate.getTime()) ? new Date() : parsedDate,
        amount: parsedAmount,
        paymentMethod: p.paymentMethod || 'cash',
        workDescription: finalDesc,
        status: p.status || 'paid',
        notes: p.notes || undefined,
        createdBy: createdBy || undefined
      };
    });

    const savedPayments = await Payment.insertMany(paymentsToInsert);

    // If contract provided, push payment IDs to ProjectContract.payments
    if (contract && savedPayments.length > 0) {
      const paymentIds = savedPayments.map((p) => p._id);
      await ProjectContract.findByIdAndUpdate(
        contract,
        { $push: { payments: { $each: paymentIds } } }
      );
    }

    // Update totalPaymentReceived for project if any credit payments present
    const totalCreditAmount = savedPayments
      .filter((p) => p.type === 'credit')
      .reduce((sum, p) => sum + p.amount, 0);

    if (totalCreditAmount > 0) {
      await Project.findByIdAndUpdate(
        project,
        { $inc: { totalPaymentReceived: totalCreditAmount } }
      );
    }

    res.status(201).json({
      message: `Successfully imported ${savedPayments.length} payments`,
      count: savedPayments.length,
      payments: savedPayments
    });
  } catch (error) {
    console.error("Error bulk importing payments:", error);
    res.status(500).json({
      message: "Failed to bulk import payments",
      error: error.message
    });
  }
};

// Bulk import credit payments received for a project
paymentController.bulkImportProjectPayments = async (req, res) => {
  try {
    const { project, payments } = req.body;

    if (!project) {
      return res.status(400).json({ message: "Project ID is required." });
    }
    if (!payments || !Array.isArray(payments) || payments.length === 0) {
      return res.status(400).json({ message: "No payment records provided for import." });
    }

    const createdBy = req.user?.userId || req.user?.id || req.user?._id;

    let totalCreditAmount = 0;

    const paymentsToInsert = payments.map((p) => {
      const parsedAmount = parseFloat(p.amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new Error(`Invalid payment amount: ${p.amount}`);
      }

      const parsedDate = p.date ? new Date(p.date) : new Date();
      const rawDesc = p.workDescription || p.notes;
      const finalDesc = (rawDesc && rawDesc.trim() !== '') ? rawDesc.trim() : 'None';
      const paymentType = p.type || 'credit';

      if (paymentType === 'credit') {
        totalCreditAmount += parsedAmount;
      }

      return {
        project,
        type: paymentType,
        date: isNaN(parsedDate.getTime()) ? new Date() : parsedDate,
        amount: parsedAmount,
        paymentMethod: p.paymentMethod || 'bank_transfer',
        workDescription: finalDesc,
        status: p.status || 'paid',
        notes: p.notes || undefined,
        createdBy: createdBy || undefined
      };
    });

    const savedPayments = await Payment.insertMany(paymentsToInsert);

    // Update totalPaymentReceived on Project
    if (totalCreditAmount > 0) {
      await Project.findByIdAndUpdate(
        project,
        { $inc: { totalPaymentReceived: totalCreditAmount } }
      );
    }

    res.status(201).json({
      message: `Successfully imported ${savedPayments.length} project credit payments`,
      count: savedPayments.length,
      payments: savedPayments
    });
  } catch (error) {
    console.error("Error bulk importing project payments:", error);
    res.status(500).json({
      message: "Failed to bulk import project payments",
      error: error.message
    });
  }
};

module.exports = paymentController;