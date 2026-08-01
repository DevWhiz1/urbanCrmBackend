const { default: mongoose } = require('mongoose');
const Project = require('../models/project.schema');
const Contractor = require('../models/contractor.schema');
const Client = require('../models/client.schema');
const Payment = require('../models/payment.schema');
const ProjectContract = require('../models/projectContractSchema');

const reportsController = {};

// Get project reports
reportsController.getProjectReports = async (req, res) => {
  try {
    const { startDate, endDate, status, category } = req.query;
    
    // Build filter object
    const filter = {};
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

    // Get projects with populated data
    const projects = await Project.find(filter)
      .populate('customer', 'user paymentTerms bankDetails address phoneNumber isActive')
      .populate('contractors', 'companyName contractorType user paymentTerms bankDetails address phoneNumber')
      .sort({ createdAt: -1 });

    // Calculate statistics
    const totalProjects = projects.length;
    const totalRevenue = projects.reduce((sum, project) => sum + (project.totalCost || 0), 0);
    const averageProjectValue = totalProjects > 0 ? totalRevenue / totalProjects : 0;
    
    const statusBreakdown = projects.reduce((acc, project) => {
      acc[project.status] = (acc[project.status] || 0) + 1;
      return acc;
    }, {});

    const categoryBreakdown = projects.reduce((acc, project) => {
      acc[project.projectCategory] = (acc[project.projectCategory] || 0) + 1;
      return acc;
    }, {});

    res.status(200).json({
      status: 200,
      message: "Project reports retrieved successfully",
      data: {
        summary: {
          totalProjects,
          totalRevenue,
          averageProjectValue,
          statusBreakdown,
          categoryBreakdown
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
    
    // Build filter object
    const filter = {};
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

    // Get contractors with populated data
    const contractors = await Contractor.find(filter)
      .populate('user', 'userName email phoneNumber address status')
      .sort({ rating: -1, createdAt: -1 });

    // Calculate statistics
    const totalContractors = contractors.length;
    const activeContractors = contractors.filter(c => c.isActive).length;
    const averageRating = contractors.length > 0 
      ? contractors.reduce((sum, c) => sum + (c.rating || 0), 0) / contractors.length 
      : 0;

    const typeBreakdown = contractors.reduce((acc, contractor) => {
      acc[contractor.contractorType] = (acc[contractor.contractorType] || 0) + 1;
      return acc;
    }, {});

    const ratingDistribution = contractors.reduce((acc, contractor) => {
      const rating = Math.floor(contractor.rating || 0);
      acc[rating] = (acc[rating] || 0) + 1;
      return acc;
    }, {});

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
        contractors
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
    
    // Build filter object
    const filter = {};
    if (startDate && endDate) {
      filter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    // Get clients with populated data
    const clients = await Client.find(filter)
      .populate('user', 'userName email phoneNumber address status')
      .sort({ createdAt: -1 });

    // Calculate statistics
    const totalClients = clients.length;
    const activeClients = clients.filter(c => c.isActive).length;
    const newClientsThisMonth = clients.filter(c => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return c.createdAt >= startOfMonth;
    }).length;

    const paymentTermsBreakdown = clients.reduce((acc, client) => {
      acc[client.paymentTerms] = (acc[client.paymentTerms] || 0) + 1;
      return acc;
    }, {});

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
        clients
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
    
    // Build filter object
    const filter = {};
    if (startDate && endDate) {
      filter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    if (status) {
      filter.status = status;
    }
    if (paymentType) {
      filter.paymentType = paymentType;
    }

    // Get payments
    const payments = await Payment.find(filter).sort({ createdAt: -1 });

    // Calculate statistics - considering credit/debit types
    const totalAmount = payments.reduce((sum, payment) => {
      const amount = payment.amount || 0;
      return payment.type === 'credit' ? sum + amount : sum - amount;
    }, 0);
    
    const paidAmount = payments
      .filter(p => p.status === 'paid')
      .reduce((sum, payment) => {
        const amount = payment.amount || 0;
        return payment.type === 'credit' ? sum + amount : sum - amount;
      }, 0);
      
    const pendingAmount = payments
      .filter(p => p.status === 'pending')
      .reduce((sum, payment) => {
        const amount = payment.amount || 0;
        return payment.type === 'credit' ? sum + amount : sum - amount;
      }, 0);
      
    const overdueAmount = payments
      .filter(p => p.status === 'overdue')
      .reduce((sum, payment) => {
        const amount = payment.amount || 0;
        return payment.type === 'credit' ? sum + amount : sum - amount;
      }, 0);

    const statusBreakdown = payments.reduce((acc, payment) => {
      acc[payment.status] = (acc[payment.status] || 0) + 1;
      return acc;
    }, {});

    const monthlyBreakdown = payments.reduce((acc, payment) => {
      const month = payment.createdAt.toISOString().substring(0, 7); // YYYY-MM
      if (!acc[month]) {
        acc[month] = { count: 0, amount: 0, credit: 0, debit: 0 };
      }
      acc[month].count += 1;
      const amount = payment.amount || 0;
      if (payment.type === 'credit') {
        acc[month].amount += amount;
        acc[month].credit += amount;
      } else {
        acc[month].amount -= amount;
        acc[month].debit += amount;
      }
      return acc;
    }, {});

    res.status(200).json({
      status: 200,
      message: "Payment reports retrieved successfully",
      data: {
        summary: {
          totalAmount,
          paidAmount,
          pendingAmount,
          overdueAmount,
          statusBreakdown,
          monthlyBreakdown
        },
        payments
      }
    });

  } catch (error) {
    console.error('Payment reports error:', error);
    res.status(500).json({
      status: 500,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Get financial summary report
reportsController.getFinancialSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Build date filter
    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    // Get all projects in date range
    const projects = await Project.find(dateFilter);
    const totalProjectRevenue = projects.reduce((sum, project) => sum + (project.totalCost || 0), 0);

    // Get all payments in date range
    const payments = await Payment.find(dateFilter);
    const totalPayments = payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
    const paidPayments = payments
      .filter(p => p.status === 'paid')
      .reduce((sum, payment) => sum + (payment.amount || 0), 0);

    // Get project contracts
    const contracts = await ProjectContract.find(dateFilter)
      .populate('project', 'name totalCost')
      .populate('contractor', 'companyName');
    
    const totalContractValue = contracts.reduce((sum, contract) => sum + (contract.totalAmount || 0), 0);

    // Calculate profit margin (simplified)
    const totalCosts = totalContractValue;
    const grossProfit = totalProjectRevenue - totalCosts;
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
        costs: {
          totalContractValue,
          grossProfit,
          profitMargin
        },
        projects: projects.length,
        contracts: contracts.length,
        payments: payments.length
      }
    });

  } catch (error) {
    console.error('Financial summary error:', error);
    res.status(500).json({
      status: 500,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Get payment analytics for dashboard graphs
reportsController.getPaymentAnalytics = async (req, res) => {
  try {
    const { period = 'monthly' } = req.query; // daily, weekly, monthly, yearly
    
    // Build date filter based on period
    const now = new Date();
    let startDate, endDate;
    
    switch (period) {
      case 'daily':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
        endDate = now;
        break;
      case 'weekly':
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        endDate = now;
        break;
      case 'monthly':
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
        endDate = now;
        break;
      case 'yearly':
        startDate = new Date(now.getFullYear() - 5, 0, 1);
        endDate = now;
        break;
      default:
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
        endDate = now;
    }

    const filter = {
      createdAt: {
        $gte: startDate,
        $lte: endDate
      }
    };

    // Get payments
    const payments = await Payment.find(filter).sort({ createdAt: 1 });

    // Group by period
    let groupedData = {};
    
    payments.forEach(payment => {
      let key;
      const date = new Date(payment.createdAt);
      
      switch (period) {
        case 'daily':
          key = date.toISOString().split('T')[0]; // YYYY-MM-DD
          break;
        case 'weekly':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split('T')[0];
          break;
        case 'monthly':
          key = date.toISOString().substring(0, 7); // YYYY-MM
          break;
        case 'yearly':
          key = date.getFullYear().toString();
          break;
        default:
          key = date.toISOString().substring(0, 7);
      }
      
      if (!groupedData[key]) {
        groupedData[key] = {
          date: key,
          credit: 0,
          debit: 0,
          net: 0,
          count: 0
        };
      }
      
      const amount = payment.amount || 0;
      groupedData[key].count += 1;
      
      if (payment.type === 'credit') {
        groupedData[key].credit += amount;
        groupedData[key].net += amount;
      } else {
        groupedData[key].debit += amount;
        groupedData[key].net -= amount;
      }
    });

    // Convert to array and sort by date
    const analytics = Object.values(groupedData).sort((a, b) => a.date.localeCompare(b.date));

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
    res.status(500).json({
      status: 500,
      message: "Internal server error",
      error: error.message
    });
  }
};

module.exports = reportsController;
