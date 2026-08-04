const express = require('express');
const {
  getExpenses,
  getExpenseById,
  createExpense,
  updateExpense,
  deleteExpense,
  getExpenseCategories,
  createExpenseCategory,
  deleteExpenseCategory,
} = require('../controllers/expense.controller');

const router = express.Router();

router.get('/categories', getExpenseCategories);
router.post('/categories', createExpenseCategory);
router.delete('/categories/:id', deleteExpenseCategory);

router.get('/', getExpenses);
router.get('/:id', getExpenseById);
router.post('/', createExpense);
router.put('/:id', updateExpense);
router.delete('/:id', deleteExpense);

module.exports = router;
