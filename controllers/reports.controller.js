const { default: mongoose } = require('mongoose');
const Project = require('../models/project.schema');
const Contractor = require('../models/contractor.schema');
const Client = require('../models/client.schema');
const Payment = require('../models/payment.Schema');
const ProjectContract = require('../models/projectContractSchema');
const { getPaginationParams } = require('../utils/paginate');

const reportsController = {};

// Get project reports
reportsController.getProjectReports = async (req, res) => {
  try {
    const { startDate, endDate, status, category, projectIds } = req.query;
    
    // Build filter object
    const filter = { isDeleted: { $ne: true }, isActive: { $ne: false } };
    if (startDate && endDate) {
      filter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    if (status) {
      filter.status = status;
    }
    if (category) {
      filter.projectCategory = category;
    }
    
    if (projectIds) {
      const idsArray = Array.isArray(projectIds) ? projectIds : projectIds.split(',');
      filter._id = { $in: idsArray.map(id => new mongoose.Types.ObjectId(id)) };
    }

    // Aggregation pipeline
    const pipeline = [
      { $match: filter },
      // Lookup Materials
      {
        $lookup: {
          from: 'materials',
          localField: '_id',
          foreignField: 'project',
          pipeline: [
            { $match: { isDeleted: { $ne: true }, isActive: { $ne: false } } }
          ],
          as: 'materials'
        }
      },
      // Lookup Payments
      {
        $lookup: {
          from: 'payments',
          localField: '_id',
          foreignField: 'project',
          pipeline: [
            { $match: { isDeleted: { $ne: true }, isActive: { $ne: false } } }
          ],
          as: 'payments'
        }
      },
      // Lookup Expenses
      {
        $lookup: {
          from: 'expenses',
          localField: '_id',
          foreignField: 'project',
          pipeline: [
            { $match: { isDeleted: { $ne: true }, isActive: { $ne: false } } }
          ],
          as: 'expenses'
        }
      },
      // Lookup Customer
      {
        $lookup: {
          from: 'clients',
          localField: 'customer',
          foreignField: '_id',
          as: 'customerDetails'
        }
      },
      { $unwind: { path: "$customerDetails", preserveNullAndEmptyArrays: true } },
      
      // Calculate Metrics per project
      {
        $addFields: {
          materialCosts: { $sum: "$materials.totalAmount" },
          contractorCosts: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: "$payments",
                    as: "p",
                    cond: {
                      $and: [
                        { $eq: ["$$p.type", "debit"] },
                        { $ne: ["$$p.contractor", null] },
                        { $ne: ["$$p.contractor", undefined] }
                      ]
                    }
                  }
                },
                as: "payment",
                in: "$$payment.amount"
              }
            }
          },
          otherExpenses: { $sum: "$expenses.amount" },
          totalCredit: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: "$payments",
                    as: "p",
                    cond: { $eq: ["$$p.type", "credit"] }
                  }
                },
                as: "payment",
                in: "$$payment.amount"
              }
            }
          }
        }
      },
      {
        $addFields: {
          totalExpenses: { $add: ["$materialCosts", "$contractorCosts", "$otherExpenses"] },
          pendingAmount: { $subtract: [{ $ifNull: ["$totalCost", 0] }, "$totalCredit"] }
        }
      },
      {
        $addFields: {
          netVolume: { $subtract: ["$totalCredit", "$totalExpenses"] }
        }
      },
      { $sort: { createdAt: -1 } }
    ];

    const projects = await Project.aggregate(pipeline);

    // Calculate overall statistics
    const totalProjects = projects.length;
    const totalRevenue = projects.reduce((sum, project) => sum + (project.totalCost || 0), 0);
    const averageProjectValue = totalProjects > 0 ? totalRevenue / totalProjects : 0;
    
    let totalOverallExpenses = 0;
    let totalOverallCredit = 0;
    let totalOverallMaterialCosts = 0;
    let totalOverallContractorCosts = 0;
    let totalOverallOtherExpenses = 0;

    const statusBreakdown = {};
    const categoryBreakdown = {};

    projects.forEach(project => {
      // Breakdown counts
      statusBreakdown[project.status] = (statusBreakdown[project.status] || 0) + 1;
      
      if (project.projectCategory) {
        categoryBreakdown[project.projectCategory] = (categoryBreakdown[project.projectCategory] || 0) + 1;
      }

      // Overall metrics sum
      totalOverallExpenses += (project.totalExpenses || 0);
      totalOverallCredit += (project.totalCredit || 0);
      totalOverallMaterialCosts += (project.materialCosts || 0);
      totalOverallContractorCosts += (project.contractorCosts || 0);
      totalOverallOtherExpenses += (project.otherExpenses || 0);
    });

    const totalOverallPending = totalRevenue - totalOverallCredit;
    const totalOverallNetVolume = totalOverallCredit - totalOverallExpenses;

    res.status(200).json({
      status: 200,
      message: "Project reports retrieved successfully",
      data: {
        summary: {
          totalProjects,
          totalRevenue,
          averageProjectValue,
          statusBreakdown,
          categoryBreakdown,
          totalExpenses: totalOverallExpenses,
          totalCredit: totalOverallCredit,
          materialCosts: totalOverallMaterialCosts,
          contractorCosts: totalOverallContractorCosts,
          otherExpenses: totalOverallOtherExpenses,
          pendingAmount: totalOverallPending,
          netVolume: totalOverallNetVolume
        },
        projects
      }
    });

  } catch (error) {
    console.error('Project reports error:', error);
    res.status(500).json({
      status: 500,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Get contractor performance reports
reportsController.getContractorReports = async (req, res) => {
  try {
    const { startDate, endDate, contractorType, minRating } = req.query;
    const { isPaginated, page, limit, skip } = getPaginationParams(req);
    
    // Build filter object
    const filter = { isDeleted: { $ne: true } };
    if (startDate && endDate) {
      filter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    if (contractorType) {
      filter.contractorType = contractorType;
    }
    if (minRating) {
      filter.rating = { $gte: parseFloat(minRating) };
    }

    const [statsAgg, ratingAgg, total, contractors] = await Promise.all([
      Contractor.aggregate([
        { $match: filter },
        {
          $group: {
            _id: "$contractorType",
            count: { $sum: 1 },
            activeCount: { $sum: { $cond: ["$isActive", 1, 0] } },
            totalRating: { $sum: "$rating" }
          }
        }
      ]),
      Contractor.aggregate([
        { $match: filter },
        {
          $group: {
            _id: { $floor: { $ifNull: ["$rating", 0] } },
            count: { $sum: 1 }
          }
        }
      ]),
      Contractor.countDocuments(filter),
      Contractor.find(filter)
        .populate('user', 'userName email phoneNumber address status')
        .sort({ rating: -1, createdAt: -1 })
        .skip(isPaginated && limit > 0 ? skip : 0)
        .limit(isPaginated && limit > 0 ? limit : 100)
        .lean()
    ]);

    let totalContractors = 0;
    let activeContractors = 0;
    let sumRatings = 0;
    const typeBreakdown = {};
    
    for (const item of statsAgg) {
      const type = item._id || 'Unspecified';
      typeBreakdown[type] = item.count;
      totalContractors += item.count;
      activeContractors += item.activeCount;
      sumRatings += item.totalRating || 0;
    }

    const averageRating = totalContractors > 0 ? sumRatings / totalContractors : 0;
    
    const ratingDistribution = {};
    for (const item of ratingAgg) {
      ratingDistribution[item._id] = item.count;
    }

    res.status(200).json({
      status: 200,
      message: "Contractor reports retrieved successfully",
      data: {
        summary: {
          totalContractors,
          activeContractors,
          averageRating,
          typeBreakdown,
          ratingDistribution
        },
        contractors,
        pagination: {
          total,
          page,
          limit,
          totalPages: limit > 0 ? Math.ceil(total / limit) : 1
        }
      }
    });

  } catch (error) {
    console.error('Contractor reports error:', error);
    res.status(500).json({
      status: 500,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Get client reports
reportsController.getClientReports = async (req, res) => {
  try {
    const { startDate, endDate, isActive } = req.query;
    const { isPaginated, page, limit, skip } = getPaginationParams(req);
    
    // Build filter object
    const filter = { isDeleted: { $ne: true } };
    if (startDate && endDate) {
      filter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const [statsAgg, total, clients] = await Promise.all([
      Client.aggregate([
        { $match: filter },
        {
          $group: {
            _id: "$paymentTerms",
            count: { $sum: 1 },
            activeCount: { $sum: { $cond: ["$isActive", 1, 0] } },
            newThisMonth: { 
              $sum: { $cond: [ { $gte: ["$createdAt", startOfMonth] }, 1, 0 ] } 
            }
          }
        }
      ]),
      Client.countDocuments(filter),
      Client.find(filter)
        .populate('user', 'userName email phoneNumber address status')
        .sort({ createdAt: -1 })
        .skip(isPaginated && limit > 0 ? skip : 0)
        .limit(isPaginated && limit > 0 ? limit : 100)
        .lean()
    ]);

    let totalClients = 0;
    let activeClients = 0;
    let newClientsThisMonth = 0;
    const paymentTermsBreakdown = {};

    for (const item of statsAgg) {
      const term = item._id || 'Unspecified';
      paymentTermsBreakdown[term] = item.count;
      totalClients += item.count;
      activeClients += item.activeCount;
      newClientsThisMonth += item.newThisMonth;
    }

    res.status(200).json({
      status: 200,
      message: "Client reports retrieved successfully",
      data: {
        summary: {
          totalClients,
          activeClients,
          newClientsThisMonth,
          paymentTermsBreakdown
        },
        clients,
        pagination: {
          total,
          page,
          limit,
          totalPages: limit > 0 ? Math.ceil(total / limit) : 1
        }
      }
    });

  } catch (error) {
    console.error('Client reports error:', error);
    res.status(500).json({
      status: 500,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Get payment reports
reportsController.getPaymentReports = async (req, res) => {
  try {
    const { startDate, endDate, status, paymentType } = req.query;
    const { isPaginated, page, limit, skip } = getPaginationParams(req);

    const filter = { isDeleted: { $ne: true } };
    if (startDate && endDate) {
      filter.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    if (status) filter.status = status;
    if (paymentType) filter.type = paymentType;

    // All stats computed by MongoDB — no full document load + JS reduce passes
    const [statsAgg, monthlyAgg, payments, total] = await Promise.all([
      Payment.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$status',
            totalCredit: { $sum: { $cond: [{ $eq: ['$type', 'credit'] }, '$amount', 0] } },
            totalDebit:  { $sum: { $cond: [{ $eq: ['$type', 'debit']  }, '$amount', 0] } },
            count: { $sum: 1 }
          }
        }
      ]),
      Payment.aggregate([
        { $match: filter },
        {
          $group: {
            _id: {
              month: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
              type: '$type'
            },
            total: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.month': 1 } }
      ]),
      Payment.find(filter)
        .sort({ createdAt: -1 })
        .skip(isPaginated && limit > 0 ? skip : 0)
        .limit(isPaginated && limit > 0 ? limit : 100)
        .lean(),
      Payment.countDocuments(filter)
    ]);

    let totalAmount = 0, paidAmount = 0, pendingAmount = 0, overdueAmount = 0;
    const statusBreakdown = {};
    for (const row of statsAgg) {
      const net = (row.totalCredit || 0) - (row.totalDebit || 0);
      totalAmount += net;
      statusBreakdown[row._id] = row.count;
      if (row._id === 'paid')    paidAmount    += net;
      if (row._id === 'pending') pendingAmount += net;
      if (row._id === 'overdue') overdueAmount += net;
    }

    const monthlyBreakdown = {};
    for (const row of monthlyAgg) {
      const month = row._id.month;
      if (!monthlyBreakdown[month]) {
        monthlyBreakdown[month] = { count: 0, amount: 0, credit: 0, debit: 0 };
      }
      monthlyBreakdown[month].count += row.count;
      if (row._id.type === 'credit') {
        monthlyBreakdown[month].credit += row.total;
        monthlyBreakdown[month].amount += row.total;
      } else {
        monthlyBreakdown[month].debit += row.total;
        monthlyBreakdown[month].amount -= row.total;
      }
    }

    res.status(200).json({
      status: 200,
      message: "Payment reports retrieved successfully",
      data: {
        summary: { totalAmount, paidAmount, pendingAmount, overdueAmount, statusBreakdown, monthlyBreakdown },
        payments,
        pagination: {
          total,
          page,
          limit,
          totalPages: limit > 0 ? Math.ceil(total / limit) : 1
        }
      }
    });

  } catch (error) {
    console.error('Payment reports error:', error);
    res.status(500).json({ status: 500, message: "Internal server error", error: error.message });
  }
};

// Get financial summary report
reportsController.getFinancialSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    // Three parallel aggregates — no full document loads, isDeleted filter applied to all
    const [projectAgg, paymentAgg, contractAgg] = await Promise.all([
      Project.aggregate([
        { $match: { ...dateFilter, isDeleted: { $ne: true } } },
        { $group: { _id: null, totalRevenue: { $sum: '$totalCost' }, count: { $sum: 1 } } }
      ]),
      Payment.aggregate([
        { $match: { ...dateFilter, isDeleted: { $ne: true } } },
        { $group: { _id: '$status', total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]),
      ProjectContract.aggregate([
        { $match: { ...dateFilter, isDeleted: { $ne: true } } },
        { $group: { _id: null, totalContractValue: { $sum: '$totalAmount' }, count: { $sum: 1 } } }
      ])
    ]);

    const totalProjectRevenue = projectAgg[0]?.totalRevenue || 0;
    const projectCount = projectAgg[0]?.count || 0;

    let totalPayments = 0, paidPayments = 0, paymentCount = 0;
    for (const row of paymentAgg) {
      totalPayments += row.total;
      paymentCount  += row.count;
      if (row._id === 'paid') paidPayments += row.total;
    }

    const totalContractValue = contractAgg[0]?.totalContractValue || 0;
    const contractCount = contractAgg[0]?.count || 0;
    const grossProfit = totalProjectRevenue - totalContractValue;
    const profitMargin = totalProjectRevenue > 0 ? (grossProfit / totalProjectRevenue) * 100 : 0;

    res.status(200).json({
      status: 200,
      message: "Financial summary retrieved successfully",
      data: {
        revenue: {
          totalProjectRevenue,
          totalPayments,
          paidPayments,
          pendingPayments: totalPayments - paidPayments
        },
        costs: { totalContractValue, grossProfit, profitMargin },
        projects: projectCount,
        contracts: contractCount,
        payments: paymentCount
      }
    });

  } catch (error) {
    console.error('Financial summary error:', error);
    res.status(500).json({ status: 500, message: "Internal server error", error: error.message });
  }
};

// Get payment analytics for dashboard graphs
reportsController.getPaymentAnalytics = async (req, res) => {
  try {
    const { period = 'monthly' } = req.query; // daily, monthly, yearly

    const now = new Date();
    let startDate, endDate;

    switch (period) {
      case 'daily':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
        endDate = now; break;
      case 'weekly':
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        endDate = now; break;
      case 'monthly':
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
        endDate = now; break;
      case 'yearly':
        startDate = new Date(now.getFullYear() - 5, 0, 1);
        endDate = now; break;
      default:
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
        endDate = now;
    }

    const filter = { createdAt: { $gte: startDate, $lte: endDate } };

    // MongoDB $dateToString groups by period server-side — no full document load + JS loop
    const formatMap = { daily: '%Y-%m-%d', monthly: '%Y-%m', yearly: '%Y' };
    const groupFormat = formatMap[period] || '%Y-%m';

    const agg = await Payment.aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            key: { $dateToString: { format: groupFormat, date: '$createdAt' } },
            type: '$type'
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.key': 1 } }
    ]);

    // Merge credit/debit buckets into one entry per period key
    const grouped = {};
    for (const item of agg) {
      const k = item._id.key;
      if (!grouped[k]) grouped[k] = { date: k, credit: 0, debit: 0, net: 0, count: 0 };
      if (item._id.type === 'credit') {
        grouped[k].credit += item.total;
        grouped[k].net    += item.total;
      } else {
        grouped[k].debit += item.total;
        grouped[k].net   -= item.total;
      }
      grouped[k].count += item.count;
    }

    const analytics = Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));

    res.status(200).json({
      status: 200,
      message: "Payment analytics retrieved successfully",
      data: {
        period,
        analytics,
        summary: {
          totalCredit: analytics.reduce((sum, item) => sum + item.credit, 0),
          totalDebit: analytics.reduce((sum, item) => sum + item.debit, 0),
          netAmount: analytics.reduce((sum, item) => sum + item.net, 0),
          totalTransactions: analytics.reduce((sum, item) => sum + item.count, 0)
        }
      }
    });

  } catch (error) {
    console.error('Payment analytics error:', error);
    res.status(500).json({ status: 500, message: "Internal server error", error: error.message });
  }
};

module.exports = reportsController;
