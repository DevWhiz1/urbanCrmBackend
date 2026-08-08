/**
 * portal.controller.js
 *
 * Dedicated controller for Client and Contractor portal views.
 * All endpoints enforce strict ownership verification — not just role checks.
 * Responses are explicitly mapped to DTOs (no raw MongoDB documents returned).
 * Supports Server-Side Pagination, Filtering, and Sorting.
 */

const Project = require('../models/project.schema');
const Payment = require('../models/payment.Schema');
const ProjectContract = require('../models/projectContractSchema');
const Client = require('../models/client.schema');
const Contractor = require('../models/contractor.schema');
const mongoose = require('mongoose');

// ─── Utility: build a 403 ownership error ─────────────────────────────────────
const forbidden = (res, msg = 'Access denied.') =>
  res.status(403).json({ status: 403, message: msg });

// ─── Utility: parse pagination/sort/filter query ─────────────────────────────
const parseQueryParams = (query) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.max(1, parseInt(query.limit) || 10);
  const skip = (page - 1) * limit;
  const { status, method, sortBy } = query;

  let sortObj = { date: -1 }; // default
  if (sortBy === 'date_asc') sortObj = { date: 1 };
  if (sortBy === 'amount_desc') sortObj = { amount: -1 };
  if (sortBy === 'amount_asc') sortObj = { amount: 1 };
  // For contracts where 'date' isn't the primary field, we'll map date to startDate/createdAt later

  return { page, limit, skip, status, method, sortBy, sortObj };
};

// ─── CLIENT PORTAL ────────────────────────────────────────────────────────────

/**
 * GET /api/portal/client/project
 */
const getClientProject = async (req, res) => {
  try {
    if (!req.clientId) return forbidden(res, 'No client profile linked to your account.');

    const project = await Project.findOne({
      customer: req.clientId,
      isDeleted: { $ne: true },
    }).lean();

    if (!project) return res.status(404).json({ status: 404, message: 'No project found for your account.' });

    const dto = {
      id: project._id,
      projectCode: project.projectCode,
      name: project.name,
      location: project.location,
      projectCategory: project.projectCategory,
      projectType: project.projectType,
      totalCoverageArea: project.totalCoverageArea,
      totalCost: project.totalCost,
      status: project.status,
      progress: project.progress,
      startDate: project.startDate,
      estimatedDuration: project.estimatedDuration,
    };

    return res.status(200).json({ status: 200, project: dto });
  } catch (error) {
    console.error('getClientProject error:', error);
    return res.status(500).json({ status: 500, message: 'Internal Server Error' });
  }
};

/**
 * GET /api/portal/client/payments
 * Supports: ?page, ?limit, ?status, ?method, ?sortBy
 */
const getClientPayments = async (req, res) => {
  try {
    if (!req.clientId) return forbidden(res, 'No client profile linked to your account.');

    const project = await Project.findOne({
      customer: req.clientId,
      isDeleted: { $ne: true },
    }).lean();

    if (!project) return res.status(404).json({ status: 404, message: 'No project found for your account.' });

    const { page, limit, skip, status, method, sortObj } = parseQueryParams(req.query);

    const matchQuery = {
      project: project._id,
      type: 'credit',
      isDeleted: { $ne: true },
    };

    if (status && status !== 'all') matchQuery.status = status;
    if (method && method !== 'all') matchQuery.paymentMethod = method;

    const [payments, totalItems] = await Promise.all([
      Payment.find(matchQuery).sort(sortObj).skip(skip).limit(limit).lean(),
      Payment.countDocuments(matchQuery),
    ]);

    const paymentDtos = payments.map((p) => ({
      id: p._id,
      paymentId: p.paymentId,
      amount: p.amount,
      date: p.date,
      paymentMethod: p.paymentMethod,
      status: p.status,
      transactionId: p.transactionId,
      notes: p.notes,
    }));

    // Calculate total received using aggregate (ignoring pagination/filters to show true total)
    const agg = await Payment.aggregate([
      { $match: { project: project._id, type: 'credit', isDeleted: { $ne: true } } },
      { $group: { _id: null, totalReceived: { $sum: '$amount' } } },
    ]);
    const totalReceived = agg[0]?.totalReceived || 0;
    const pendingBalance = (project.totalCost || 0) - totalReceived;

    return res.status(200).json({
      status: 200,
      summary: {
        projectName: project.name,
        projectCode: project.projectCode,
        projectStatus: project.status,
        projectProgress: project.progress,
        totalCost: project.totalCost,
        totalReceived,
        pendingBalance,
      },
      payments: paymentDtos,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit),
        totalItems,
        pageSize: limit,
      },
    });
  } catch (error) {
    console.error('getClientPayments error:', error);
    return res.status(500).json({ status: 500, message: 'Internal Server Error' });
  }
};

// ─── CONTRACTOR PORTAL ────────────────────────────────────────────────────────

/**
 * GET /api/portal/contractor/contracts
 * Supports: ?page, ?limit
 */
const getContractorContracts = async (req, res) => {
  try {
    if (!req.contractorId) return forbidden(res, 'No contractor profile linked to your account.');

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, parseInt(req.query.limit) || 10);
    const skip = (page - 1) * limit;

    const matchQuery = {
      contractor: req.contractorId,
      isDeleted: { $ne: true },
    };

    const [contracts, totalItems] = await Promise.all([
      ProjectContract.find(matchQuery)
        .populate('project', 'name projectCode location status progress')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ProjectContract.countDocuments(matchQuery),
    ]);

    const contractIds = contracts.map(c => c._id);
    const payments = await Payment.find({
      contract: { $in: contractIds },
      type: 'debit',
      isDeleted: { $ne: true },
    }).lean();

    const paymentMap = payments.reduce((acc, p) => {
      const cid = p.contract.toString();
      acc[cid] = (acc[cid] || 0) + (p.amount || 0);
      return acc;
    }, {});

    const contractDtos = contracts.map((c) => {
      const totalReceived = paymentMap[c._id.toString()] || 0;
      const pendingBalance = (c.totalAmount || 0) - totalReceived;
      return {
        id: c._id,
        contractType: c.contractType,
        totalAmount: c.totalAmount,
        totalReceived,
        pendingBalance,
        startDate: c.startDate,
        endDate: c.endDate,
        isTerminated: c.isTerminated,
        description: c.Description,
        project: c.project
          ? {
              id: c.project._id,
              name: c.project.name,
              projectCode: c.project.projectCode,
              location: c.project.location,
              status: c.project.status,
              progress: c.project.progress,
            }
          : null,
      };
    });

    return res.status(200).json({
      status: 200,
      contracts: contractDtos,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit),
        totalItems,
        pageSize: limit,
      },
    });
  } catch (error) {
    console.error('getContractorContracts error:', error);
    return res.status(500).json({ status: 500, message: 'Internal Server Error' });
  }
};

/**
 * GET /api/portal/contractor/payments/:contractId
 * Supports: ?page, ?limit, ?status, ?method, ?sortBy
 */
const getContractorContractPayments = async (req, res) => {
  try {
    if (!req.contractorId) return forbidden(res, 'No contractor profile linked to your account.');

    const { contractId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(contractId)) {
      return res.status(400).json({ status: 400, message: 'Invalid contract ID.' });
    }

    const contract = await ProjectContract.findOne({
      _id: contractId,
      contractor: req.contractorId,
      isDeleted: { $ne: true },
    }).populate('project', 'name projectCode location status').lean();

    if (!contract) return forbidden(res, 'You do not have access to this contract.');

    const { page, limit, skip, status, method, sortObj } = parseQueryParams(req.query);

    const matchQuery = {
      contract: contract._id,
      type: 'debit',
      isDeleted: { $ne: true },
    };

    if (status && status !== 'all') matchQuery.status = status;
    if (method && method !== 'all') matchQuery.paymentMethod = method;

    const [payments, totalItems] = await Promise.all([
      Payment.find(matchQuery).sort(sortObj).skip(skip).limit(limit).lean(),
      Payment.countDocuments(matchQuery),
    ]);

    const paymentDtos = payments.map((p) => ({
      id: p._id,
      paymentId: p.paymentId,
      amount: p.amount,
      date: p.date,
      paymentMethod: p.paymentMethod,
      status: p.status,
      transactionId: p.transactionId,
      workDescription: p.workDescription,
      notes: p.notes,
    }));

    // Calculate total received using aggregate (ignoring pagination/filters)
    const agg = await Payment.aggregate([
      { $match: { contract: contract._id, type: 'debit', isDeleted: { $ne: true } } },
      { $group: { _id: null, totalReceived: { $sum: '$amount' } } },
    ]);
    const totalReceived = agg[0]?.totalReceived || 0;
    const pendingBalance = (contract.totalAmount || 0) - totalReceived;

    return res.status(200).json({
      status: 200,
      summary: {
        contractId: contract._id,
        contractType: contract.contractType,
        totalAmount: contract.totalAmount,
        totalReceived,
        pendingBalance,
        project: contract.project
          ? {
              id: contract.project._id,
              name: contract.project.name,
              projectCode: contract.project.projectCode,
              location: contract.project.location,
              status: contract.project.status,
            }
          : null,
      },
      payments: paymentDtos,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit),
        totalItems,
        pageSize: limit,
      },
    });
  } catch (error) {
    console.error('getContractorContractPayments error:', error);
    return res.status(500).json({ status: 500, message: 'Internal Server Error' });
  }
};

// ─── CONTRACTOR SUMMARY (Dashboard) ──────────────────────────────────────────

/**
 * GET /api/portal/contractor/summary
 */
async function getContractorSummary(req, res) {
  try {
    if (!req.contractorId) return forbidden(res, 'No contractor profile linked to your account.');

    const contracts = await ProjectContract.find({
      contractor: req.contractorId,
      isDeleted: { $ne: true },
    }).lean();

    const contractIds = contracts.map((c) => c._id);
    const totalContractValue = contracts.reduce((s, c) => s + (c.totalAmount || 0), 0);
    const activeContracts = contracts.filter((c) => !c.isTerminated).length;

    const agg = contractIds.length > 0 ? await Payment.aggregate([
      { $match: { contract: { $in: contractIds }, type: 'debit', isDeleted: { $ne: true } } },
      { $group: { _id: null, totalReceived: { $sum: '$amount' } } },
    ]) : [];
    
    const totalReceived = agg[0]?.totalReceived || 0;
    const pendingBalance = totalContractValue - totalReceived;

    return res.status(200).json({
      status: 200,
      summary: {
        totalContracts: contracts.length,
        activeContracts,
        totalContractValue,
        totalReceived,
        pendingBalance,
      },
    });
  } catch (error) {
    console.error('getContractorSummary error:', error);
    return res.status(500).json({ status: 500, message: 'Internal Server Error' });
  }
}

/**
 * GET /api/portal/contractor/all-payments
 * Supports: ?page, ?limit
 */
async function getContractorAllPayments(req, res) {
  try {
    if (!req.contractorId) return forbidden(res, 'No contractor profile linked to your account.');

    const contracts = await ProjectContract.find({
      contractor: req.contractorId,
      isDeleted: { $ne: true },
    }).populate('project', 'name projectCode').lean();

    if (!contracts.length) {
      return res.status(200).json({ status: 200, payments: [], pagination: { currentPage: 1, totalPages: 0, totalItems: 0, pageSize: 10 } });
    }

    const contractMap = {};
    contracts.forEach((c) => { contractMap[c._id.toString()] = c; });
    const contractIds = contracts.map((c) => c._id);

    const { page, limit, skip, status, method, sortObj } = parseQueryParams(req.query);

    const matchQuery = {
      contract: { $in: contractIds },
      type: 'debit',
      isDeleted: { $ne: true },
    };

    if (status && status !== 'all') matchQuery.status = status;
    if (method && method !== 'all') matchQuery.paymentMethod = method;

    const [payments, totalItems] = await Promise.all([
      Payment.find(matchQuery).sort(sortObj).skip(skip).limit(limit).lean(),
      Payment.countDocuments(matchQuery),
    ]);

    const paymentDtos = payments.map((p) => {
      const contract = contractMap[p.contract?.toString()];
      return {
        id: p._id,
        paymentId: p.paymentId,
        amount: p.amount,
        date: p.date,
        paymentMethod: p.paymentMethod,
        status: p.status,
        transactionId: p.transactionId,
        workDescription: p.workDescription,
        notes: p.notes,
        contract: contract
          ? {
              id: contract._id,
              contractType: contract.contractType,
              totalAmount: contract.totalAmount,
              project: contract.project
                ? { id: contract.project._id, name: contract.project.name, projectCode: contract.project.projectCode }
                : null,
            }
          : null,
      };
    });

    return res.status(200).json({
      status: 200,
      payments: paymentDtos,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit),
        totalItems,
        pageSize: limit,
      },
    });
  } catch (error) {
    console.error('getContractorAllPayments error:', error);
    return res.status(500).json({ status: 500, message: 'Internal Server Error' });
  }
}

module.exports = {
  getClientProject,
  getClientPayments,
  getContractorContracts,
  getContractorContractPayments,
  getContractorSummary,
  getContractorAllPayments,
};
