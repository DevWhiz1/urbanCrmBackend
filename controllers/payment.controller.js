const Payment = require("../models/payment.Schema");
const Project = require('../models/project.schema');
const Material = require('../models/material.schema');
const ProjectContract = require('../models/projectContractSchema');
const mongoose = require('mongoose');
const { getPaginationParams, formatPaginatedResponse } = require('../utils/paginate');
const generateBusinessId = require('../utils/generateId');

const paymentController = {};

// Create a new payment
paymentController.createPayment = async (req, res) => {
  try {
    const paymentData = req.body;
    paymentData.paymentId = await generateBusinessId('PAY');
    paymentData.receiptNo = await generateBusinessId('RCP');
    
    if (!paymentData.createdBy && req.user) {
      paymentData.createdBy = req.user.userId;
    }

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
    const matchStage = { isDeleted: { $ne: true } };

    // Role-based scoping
    if (req.user?.role === 'Contractor') {
      if (req.contractorId) {
        matchStage.contractor = new mongoose.Types.ObjectId(req.contractorId);
      }
    } else if (req.user?.role === 'Client' && req.clientId) {
      const projectIds = await Project.find({ customer: req.clientId, isDeleted: { $ne: true } }).distinct('_id');
      matchStage.project = { $in: projectIds };
    }

    let query = Payment.find(matchStage)
      .select('amount date status type paymentMethod transactionId workDescription notes receiptPhoto createdAt project contractor contract createdBy receiptNo paymentId')
      .populate('project', 'name')
      .populate('contractor', 'companyName')
      .populate('contract', 'contractType')
      .populate('createdBy', 'userName')
      .sort({ createdAt: -1 })
      .lean();

    if (isPaginated && limit > 0) {
      query = query.skip(skip).limit(limit);
    }

    const [total, payments] = await Promise.all([
      Payment.countDocuments(matchStage),
      query
    ]);

    const response = formatPaginatedResponse(payments, total, page, limit);
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
    paymentData.paymentId = await generateBusinessId('PAY');
    paymentData.receiptNo = await generateBusinessId('RCP');

    if (!paymentData.createdBy && req.user) {
      paymentData.createdBy = req.user.userId;
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
      { $match: { project: new mongoose.Types.ObjectId(projectId), isDeleted: { $ne: true } } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const total = result[0]?.total || 0;
    res.json({ projectId, totalPaymentReceived: total });
  } catch (error) {
    res.status(500).json({ message: "Failed to calculate total payment", error: error.message });
  }
};

// Get all payments for a project (using find and populate for performance)
paymentController.getPaymentsByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { type, contract, method, status, contractor, startDate, endDate, sort, search } = req.query;
    const { isPaginated, page, limit, skip } = getPaginationParams(req);

    const matchStage = {
      project: new mongoose.Types.ObjectId(projectId),
      isDeleted: { $ne: true }
    };

    if (type) matchStage.type = type;
    if (contract) matchStage.contract = new mongoose.Types.ObjectId(contract);
    if (method) matchStage.paymentMethod = method;
    if (status) matchStage.status = status;

    // Role-based scoping
    if (req.user?.role === 'Contractor' && req.contractorId) {
      matchStage.contractor = new mongoose.Types.ObjectId(req.contractorId);
    } else if (contractor) {
      matchStage.contractor = new mongoose.Types.ObjectId(contractor);
    }

    if (startDate || endDate) {
      matchStage.date = {};
      if (startDate) matchStage.date.$gte = new Date(startDate);
      if (endDate) matchStage.date.$lte = new Date(endDate);
    }

    let sortOptions = { createdAt: -1 };
    if (sort === 'date_desc') sortOptions = { date: -1 };
    else if (sort === 'date_asc') sortOptions = { date: 1 };
    else if (sort === 'amount_desc') sortOptions = { amount: -1 };
    else if (sort === 'amount_asc') sortOptions = { amount: 1 };

    let searchStage = { ...matchStage };

    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      const searchFilter = {
        $or: [
          { workDescription: searchRegex },
          { notes: searchRegex },
          { paymentMethod: searchRegex }
        ]
      };
      
      const Contractor = require('../models/contractor.schema');
      const matchingContractors = await Contractor.find({ companyName: searchRegex }).distinct('_id');
      
      if (matchingContractors.length > 0) {
        searchFilter.$or.push({ contractor: { $in: matchingContractors } });
      }

      if (!isNaN(parseFloat(search))) {
        searchFilter.$or.push({ amount: parseFloat(search) });
      }
      
      searchStage = { ...matchStage, ...searchFilter };
    }

    let query = Payment.find(searchStage)
      .select('paymentId receiptNo amount date status type paymentMethod transactionId workDescription notes receiptPhoto createdAt contractor contract createdBy')
      .populate('contractor', 'companyName')
      .populate('contract', 'contractType')
      .populate('createdBy', 'userName')
      .sort(sortOptions)
      .lean();

    if (isPaginated && limit > 0) {
      query = query.skip(skip).limit(limit);
    }

    const [total, payments] = await Promise.all([
      Payment.countDocuments(searchStage),
      query
    ]);

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

    // Run all three queries in parallel — debit sum is computed by MongoDB, not JS
    const [project, paymentAgg, payments] = await Promise.all([
      Project.findById(projectId).select('totalPaymentReceived').lean(),
      Payment.aggregate([
        { $match: { project: new mongoose.Types.ObjectId(projectId), isDeleted: { $ne: true } } },
        {
          $group: {
            _id: null,
            totalDebits: { $sum: { $cond: [{ $eq: ['$type', 'debit'] }, '$amount', 0] } },
          }
        }
      ]),
      Payment.find({ project: projectId, isDeleted: { $ne: true } }).lean()
    ]);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    const totalDebits = paymentAgg[0]?.totalDebits || 0;
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
    const { isPaginated, page, limit, skip } = getPaginationParams(req);

    const filter = { project: projectId, isDeleted: { $ne: true } };

    const project = await Project.findById(projectId).select('netMaterialCost').lean();
    const totalMaterialPayments = project ? (project.netMaterialCost || 0) : 0;

    let query = Material.find(filter).sort({ createdAt: -1 }).lean();
    if (isPaginated && limit > 0) {
      query = query.skip(skip).limit(limit);
    }

    const [total, materials] = await Promise.all([
      Material.countDocuments(filter),
      query
    ]);

    if (isPaginated) {
      const materialsResponse = formatPaginatedResponse(materials, total, page, limit);
      res.json({ 
        projectId, 
        totalMaterialPayments, 
        materials: materialsResponse.data,
        pagination: materialsResponse.pagination
      });
    } else {
      res.json({ projectId, totalMaterialPayments, materials });
    }
  } catch (error) {
    res.status(500).json({ message: 'Failed to get material payments', error: error.message });
  }
};

// Get full project financial summary
paymentController.getFullProjectFinancialSummary = async (req, res) => {
  try {
    const { projectId } = req.params;

    // All three queries run in parallel — payment math done by MongoDB $group, not JS reduce
    const [project, paymentAgg, totalMaterialCount] = await Promise.all([
      Project.findById(projectId)
        .select('name totalPaymentReceived projectType totalCost additions netMaterialCost materialPurchaseCost materialReturnAmount')
        .lean(),
      Payment.aggregate([
        { $match: { project: new mongoose.Types.ObjectId(projectId), isDeleted: { $ne: true } } },
        {
          $group: {
            _id: null,
            totalDebits: { $sum: { $cond: [{ $eq: ['$type', 'debit'] }, '$amount', 0] } },
            totalCount: { $sum: 1 }
          }
        }
      ]),
      Material.countDocuments({ project: projectId, isDeleted: { $ne: true } })
    ]);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const totalDebits = paymentAgg[0]?.totalDebits || 0;
    const totalPaymentCount = paymentAgg[0]?.totalCount || 0;
    const totalMaterialPayments = project.netMaterialCost || 0;
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
      totalPaymentCount,
      totalMaterialPayments,
      totalMaterialCount,
      materialPurchaseCost: project.materialPurchaseCost || 0,
      materialReturnAmount: project.materialReturnAmount || 0,
      net
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get full project financial summary', error: error.message });
  }
};

// Get all project contracts for a specific project
paymentController.getProjectContractsByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const contracts = await ProjectContract.find({ project: projectId, isDeleted: { $ne: true } })
      .populate('contractor', 'companyName')
      .populate('project', 'name')
      .populate({
        path: 'payments',
        match: { isDeleted: { $ne: true } },
        select: '_id'
      });
    res.status(200).json({ projectId, contracts });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch project contracts', error: error.message });
  }
};

// Get summary and all payments for a specific contractor's project contract
paymentController.getProjectContractSummary = async (req, res) => {
  try {
    const { projectContractId } = req.params;
    const [contract, paymentAgg] = await Promise.all([
      ProjectContract.findById(projectContractId)
        .populate('project', 'name')
        .populate('contractor', 'companyName')
        .lean(),
      Payment.aggregate([
        { $match: { contract: new mongoose.Types.ObjectId(projectContractId), isDeleted: { $ne: true } } },
        {
          $group: {
            _id: null,
            totalPayments: { $sum: { $cond: [{ $eq: ['$type', 'debit'] }, '$amount', 0] } },
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    if (!contract || contract.isDeleted) {
      return res.status(404).json({ message: 'Project contract not found' });
    }

    const additionsTotal = (contract.additions || []).reduce((sum, a) => sum + (a.amount || 0), 0);
    const revisedTotalAmount = (contract.totalAmount || 0) + additionsTotal;
    const totalPayments = paymentAgg[0]?.totalPayments || 0;
    const totalPaymentCount = paymentAgg[0]?.count || 0;
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
      totalPaymentCount,
      net,
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

    const createdBy = req.user?.userId;

    // Prepare payments data array
    const paymentsToInsert = [];
    for (const p of payments) {
      const parsedAmount = parseFloat(p.amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new Error(`Invalid payment amount: ${p.amount}`);
      }

      const parsedDate = p.date ? new Date(p.date) : new Date();
      const rawDesc = p.workDescription || p.notes;
      const finalDesc = (rawDesc && rawDesc.trim() !== '') ? rawDesc.trim() : 'None';

      const paymentObj = {
        project,
        contractor,
        contract: contract || undefined,
        type: p.type || 'debit',
        date: isNaN(parsedDate.getTime()) ? new Date() : parsedDate,
        amount: parsedAmount,
        paymentMethod: p.paymentMethod || 'online',
        workDescription: finalDesc,
        status: p.status || 'paid',
        notes: p.notes || undefined,
        createdBy: createdBy || undefined,
        paymentId: await generateBusinessId('PAY'),
        receiptNo: await generateBusinessId('RCP')
      };
      paymentsToInsert.push(paymentObj);
    }

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

    const createdBy = req.user?.userId;

    let totalCreditAmount = 0;

    const paymentsToInsert = [];
    for (const p of payments) {
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

      const paymentObj = {
        project,
        type: paymentType,
        date: isNaN(parsedDate.getTime()) ? new Date() : parsedDate,
        amount: parsedAmount,
        paymentMethod: p.paymentMethod || 'online',
        workDescription: finalDesc,
        status: p.status || 'paid',
        notes: p.notes || undefined,
        createdBy: createdBy || undefined,
        paymentId: await generateBusinessId('PAY'),
        receiptNo: await generateBusinessId('RCP')
      };
      paymentsToInsert.push(paymentObj);
    }

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

// Update a payment
paymentController.updatePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const existingPayment = await Payment.findById(id);
    if (!existingPayment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    // Check if amount is changed for a credit payment to adjust project totalPaymentReceived
    if (existingPayment.type === 'credit' && updateData.amount !== undefined && updateData.amount !== existingPayment.amount) {
      const difference = updateData.amount - existingPayment.amount;
      await Project.findByIdAndUpdate(
        existingPayment.project,
        { $inc: { totalPaymentReceived: difference } }
      );
    }

    const updatedPayment = await Payment.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      message: "Payment updated successfully",
      payment: updatedPayment,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to update payment",
      error: error.message,
    });
  }
};

// Soft delete a payment
paymentController.deletePayment = async (req, res) => {
  try {
    const { id } = req.params;

    const paymentToSoftDelete = await Payment.findById(id);
    if (!paymentToSoftDelete) {
      return res.status(404).json({ message: "Payment not found" });
    }

    paymentToSoftDelete.isDeleted = true;
    paymentToSoftDelete.deletedAt = new Date();
    paymentToSoftDelete.deletedBy = req.user ? req.user.userId : null;
    await paymentToSoftDelete.save();

    // Revert totalPaymentReceived if it was a credit
    if (paymentToSoftDelete.type === 'credit') {
      await Project.findByIdAndUpdate(
        paymentToSoftDelete.project,
        { $inc: { totalPaymentReceived: -paymentToSoftDelete.amount } }
      );
    }

    res.status(200).json({
      message: "Payment deleted successfully",
      data: paymentToSoftDelete,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to delete payment",
      error: error.message,
    });
  }
};

// Get single payment details by ID
paymentController.getPaymentDetailById = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('contractor', 'companyName')
      .populate('contract', 'contractType')
      .populate({
        path: 'project',
        select: 'name projectCode customer',
        populate: {
          path: 'customer',
          select: 'user',
          populate: {
            path: 'user',
            select: 'userName'
          }
        }
      })
      .lean();
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    res.status(200).json(payment);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching payment', error: error.message });
  }
};

// Generate statement data
paymentController.getStatementData = async (req, res) => {
  try {
    const { statementType, projectId, contractorId, startDate, endDate } = req.query;

    if (!projectId) {
      return res.status(400).json({ message: 'Project ID is required' });
    }

    const project = await Project.findById(projectId).populate({
      path: 'customer',
      populate: { path: 'user', select: 'userName' }
    });

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.$lte = end;
    }

    let result = { summary: {}, payments: [] };

    // Common Summary Data
    result.summary.project = project.name;
    result.summary.client = project.customer?.user?.userName || 'N/A';
    result.summary.projectCost = project.totalCost || 0;

    if (statementType === 'client') {
      // Client Statement (Income)
      result.summary.contractAmount = project.totalCost || 0;
      
      const query = { project: projectId, type: 'credit', isDeleted: { $ne: true } };
      if (Object.keys(dateFilter).length > 0) query.date = dateFilter;

      const payments = await Payment.find(query).sort({ date: 1 }).lean();
      
      const totalPaid = payments.reduce((acc, curr) => acc + curr.amount, 0);
      result.summary.totalPaid = totalPaid;
      result.summary.balancePayable = (project.totalCost || 0) - totalPaid;
      result.payments = payments;

    } else if (statementType === 'contractor') {
      // Contractor Statement (Expenses)
      if (!contractorId) return res.status(400).json({ message: 'Contractor ID is required' });

      const contract = await ProjectContract.findOne({ project: projectId, contractor: contractorId, isDeleted: { $ne: true } })
        .populate({ path: 'contractor', populate: { path: 'user', select: 'userName' } });
      
      result.summary.contractor = contract?.contractor?.user?.userName || contract?.contractor?.companyName || 'N/A';
      result.summary.contractAmount = contract?.totalAmount || 0;

      const query = { project: projectId, contractor: contractorId, type: 'debit', isDeleted: { $ne: true } };
      if (Object.keys(dateFilter).length > 0) query.date = dateFilter;

      const payments = await Payment.find(query).sort({ date: 1 }).lean();
      
      const totalPaid = payments.reduce((acc, curr) => acc + curr.amount, 0);
      result.summary.totalPaid = totalPaid;
      result.summary.balancePayable = (contract?.totalAmount || 0) - totalPaid;
      result.payments = payments;

    } else if (statementType === 'material') {
      // Admin Material Statement
      const query = { project: projectId, isDeleted: { $ne: true } };
      if (Object.keys(dateFilter).length > 0) query.date = dateFilter;

      const materials = await Material.find(query).sort({ date: 1 }).lean();
      
      let purchaseCost = 0;
      let returnAmount = 0;

      materials.forEach(m => {
        if (m.transactionType === 'purchase') purchaseCost += m.totalAmount;
        else if (m.transactionType === 'return') returnAmount += m.totalAmount;
        
        m.amount = m.totalAmount; // Normalize field for template
      });

      result.summary.purchaseCost = purchaseCost;
      result.summary.returnAmount = returnAmount;
      result.summary.netMaterialCost = purchaseCost - returnAmount;
      result.summary.totalReceived = await Payment.aggregate([
        { $match: { project: new mongoose.Types.ObjectId(projectId), type: 'credit', isDeleted: { $ne: true } } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]).then(res => res[0]?.total || 0);

      result.summary.netProjectAmount = result.summary.totalReceived - result.summary.netMaterialCost;
      result.payments = materials;

    } else if (statementType === 'admin') {
      // Admin Statement (All Project Payments)
      result.summary.contractAmount = project.totalCost || 0;
      
      const query = { project: projectId, isDeleted: { $ne: true } };
      if (Object.keys(dateFilter).length > 0) query.date = dateFilter;

      const payments = await Payment.find(query).sort({ date: 1 }).lean();
      
      const totalReceived = payments.filter(p => p.type === 'credit').reduce((acc, curr) => acc + curr.amount, 0);
      result.summary.totalReceived = totalReceived;
      result.summary.yetReceivable = (project.totalCost || 0) - totalReceived;
      result.payments = payments;
    } else {
      return res.status(400).json({ message: 'Invalid statement type' });
    }

    res.status(200).json(result);
  } catch (error) {
    console.error("Error generating statement:", error);
    res.status(500).json({ message: 'Error generating statement', error: error.message });
  }
};

module.exports = paymentController;
