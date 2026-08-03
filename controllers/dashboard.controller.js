const { default: mongoose } = require('mongoose');
const Project = require('../models/project.schema');
const Contractor = require('../models/contractor.schema');
const Client = require('../models/client.schema');
const Payment = require('../models/payment.Schema');
const ProjectContract = require('../models/projectContractSchema');

const dashboardController = {};

// Get comprehensive dashboard statistics with Role Scoping
dashboardController.getDashboardStats = async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const projectFilter = {};
    const paymentFilter = {};

    if (req.user?.role === 'Contractor' && req.contractorId) {
      const contractProjectIds = await ProjectContract.find({ contractor: req.contractorId }).distinct('project');
      projectFilter.$or = [
        { contractors: req.contractorId },
        { _id: { $in: contractProjectIds } }
      ];
      paymentFilter.contractor = req.contractorId;
    } else if (req.user?.role === 'Client' && req.clientId) {
      projectFilter.customer = req.clientId;
    }

    // Projects Statistics
    const totalProjects = await Project.countDocuments(projectFilter);
    const activeProjects = await Project.countDocuments({ ...projectFilter, status: 'ongoing' });
    const completedProjects = await Project.countDocuments({ ...projectFilter, status: 'completed' });
    const planningProjects = await Project.countDocuments({ ...projectFilter, status: 'planning' });

    // Calculate total revenue from scoped projects
    const projects = await Project.find(projectFilter, 'totalCost');
    const totalRevenue = projects.reduce((sum, project) => sum + (project.totalCost || 0), 0);
    const averageProjectValue = totalProjects > 0 ? totalRevenue / totalProjects : 0;

    // Contractors Statistics
    const totalContractors = await Contractor.countDocuments();
    const activeContractors = await Contractor.countDocuments({ isActive: true });
    
    const contractorsWithRating = await Contractor.find({ rating: { $exists: true, $ne: null } }, 'rating');
    const averageRating = contractorsWithRating.length > 0 
      ? contractorsWithRating.reduce((sum, contractor) => sum + contractor.rating, 0) / contractorsWithRating.length 
      : 0;

    const topContractor = await Contractor.findOne({ rating: { $exists: true } })
      .populate('user', 'userName')
      .sort({ rating: -1 });

    // Clients Statistics
    const totalClients = await Client.countDocuments();
    const activeClients = await Client.countDocuments({ isActive: true });
    const newClientsThisMonth = await Client.countDocuments({
      createdAt: { $gte: startOfMonth }
    });

    // Payments Statistics
    const payments = await Payment.find(paymentFilter, 'amount status createdAt');
    const totalAmount = payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
    const pendingAmount = payments
      .filter(p => p.status === 'pending')
      .reduce((sum, payment) => sum + (payment.amount || 0), 0);
    const paidThisMonth = payments
      .filter(p => p.status === 'paid' && p.createdAt >= startOfMonth)
      .reduce((sum, payment) => sum + (payment.amount || 0), 0);
    const overdueAmount = payments
      .filter(p => p.status === 'overdue')
      .reduce((sum, payment) => sum + (payment.amount || 0), 0);

    // Recent Activity
    const recentProjects = await Project.find(projectFilter)
      .populate('customer', 'user')
      .populate('contractors', 'companyName')
      .sort({ updatedAt: -1 })
      .limit(5);

    const recentActivity = recentProjects.map(project => ({
      id: project._id,
      type: 'project',
      action: 'updated',
      description: `Project "${project.name}" was updated`,
      timestamp: project.updatedAt
    }));

    // Monthly Revenue (last 6 months)
    const monthlyRevenue = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      
      const monthProjects = await Project.find({
        ...projectFilter,
        createdAt: { $gte: monthStart, $lte: monthEnd }
      }, 'totalCost');
      
      const monthRevenue = monthProjects.reduce((sum, project) => sum + (project.totalCost || 0), 0);
      
      monthlyRevenue.push({
        month: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        revenue: monthRevenue,
        projects: monthProjects.length
      });
    }

    // Project Status Distribution
    const statusCounts = await Project.aggregate([
      { $match: projectFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    const projectStatusDistribution = statusCounts.map(status => ({
      status: status._id || 'unknown',
      count: status.count,
      percentage: totalProjects > 0 ? (status.count / totalProjects) * 100 : 0
    }));

    const dashboardStats = {
      projects: {
        total: totalProjects,
        active: activeProjects,
        completed: completedProjects,
        planning: planningProjects,
        totalRevenue: totalRevenue,
        averageProjectValue: averageProjectValue
      },
      contractors: {
        total: totalContractors,
        active: activeContractors,
        averageRating: Math.round(averageRating * 10) / 10,
        topContractor: topContractor?.companyName || topContractor?.user?.userName || 'N/A'
      },
      clients: {
        total: totalClients,
        active: activeClients,
        newThisMonth: newClientsThisMonth
      },
      payments: {
        totalAmount: totalAmount,
        pendingAmount: pendingAmount,
        paidThisMonth: paidThisMonth,
        overdueAmount: overdueAmount
      },
      recentActivity: recentActivity,
      monthlyRevenue: monthlyRevenue,
      projectStatusDistribution: projectStatusDistribution
    };

    res.status(200).json({
      status: 200,
      message: "Dashboard statistics retrieved successfully",
      data: dashboardStats
    });

  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({
      status: 500,
      message: "Internal server error",
      error: error.message
    });
  }
};

module.exports = dashboardController;
