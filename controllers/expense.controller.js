const Expense = require('../models/expense.schema');
const ExpenseCategory = require('../models/expenseCategory.schema');

const { getPaginationParams, formatPaginatedResponse } = require('../utils/paginate');

// --- EXPENSES ---
const getExpenses = async (req, res) => {
  try {
    const filter = { isDeleted: false };
    
    if (req.query.expenseType && req.query.expenseType !== 'All') {
      filter.expenseType = req.query.expenseType;
    }

    if (req.query.category && req.query.category !== 'All') {
      filter.category = req.query.category;
    }

    if (req.query.project && req.query.project !== 'All') {
      filter.project = req.query.project;
    }

    if (req.query.employee && req.query.employee !== 'All') {
      filter.employee = req.query.employee;
    }

    if (req.query.dateFrom || req.query.dateTo) {
      filter.date = {};
      if (req.query.dateFrom) {
        filter.date.$gte = new Date(req.query.dateFrom);
      }
      if (req.query.dateTo) {
        const endDate = new Date(req.query.dateTo);
        endDate.setHours(23, 59, 59, 999);
        filter.date.$lte = endDate;
      }
    }
    
    if (req.query.search) {
      filter.$or = [
        { vendor: { $regex: req.query.search, $options: 'i' } },
        { description: { $regex: req.query.search, $options: 'i' } },
      ];
    }

    const { isPaginated, page, limit, skip } = getPaginationParams(req);
    const total = await Expense.countDocuments(filter);

    let query = Expense.find(filter)
      .populate('category', 'name')
      .populate('project', 'name')
      .populate('employee', 'fullName')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });

    if (isPaginated && limit > 0) {
      query = query.skip(skip).limit(limit);
    }

    const expenses = await query;
    
    if (isPaginated) {
      const response = formatPaginatedResponse(expenses, total, page, limit);
      return res.status(200).json(response);
    }
    
    res.status(200).json(expenses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getExpenseById = async (req, res) => {
  try {
    const expense = await Expense.findOne({ _id: req.params.id, isDeleted: false })
      .populate('category', 'name')
      .populate('project', 'name')
      .populate('employee', 'fullName')
      .populate('createdBy', 'name');
    if (!expense) return res.status(404).json({ message: 'Expense not found' });
    res.status(200).json(expense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createExpense = async (req, res) => {
  try {
    let payload = { ...req.body };
    if (!payload.project) delete payload.project;
    if (!payload.employee) delete payload.employee;

    const newExpense = new Expense(payload);
    await newExpense.save();
    res.status(201).json(newExpense);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const updateExpense = async (req, res) => {
  try {
    let payload = { ...req.body };
    if (!payload.project) delete payload.project;
    if (!payload.employee) delete payload.employee;

    const updatedExpense = await Expense.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      payload,
      { new: true, runValidators: true }
    );
    if (!updatedExpense) return res.status(404).json({ message: 'Expense not found' });
    res.status(200).json(updatedExpense);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const deleteExpense = async (req, res) => {
  try {
    const deletedExpense = await Expense.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { isDeleted: true, isActive: false, deletedAt: new Date() },
      { new: true }
    );
    if (!deletedExpense) return res.status(404).json({ message: 'Expense not found' });
    res.status(200).json({ message: 'Expense deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --- EXPENSE CATEGORIES ---
const getExpenseCategories = async (req, res) => {
  try {
    const categories = await ExpenseCategory.find().sort({ name: 1 });
    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createExpenseCategory = async (req, res) => {
  try {
    const newCategory = new ExpenseCategory(req.body);
    await newCategory.save();
    res.status(201).json(newCategory);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const deleteExpenseCategory = async (req, res) => {
  try {
    const deletedCategory = await ExpenseCategory.findByIdAndDelete(req.params.id);
    if (!deletedCategory) return res.status(404).json({ message: 'Category not found' });
    res.status(200).json({ message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getExpenses,
  getExpenseById,
  createExpense,
  updateExpense,
  deleteExpense,
  getExpenseCategories,
  createExpenseCategory,
  deleteExpenseCategory,
};
