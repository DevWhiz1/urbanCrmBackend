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

const { authenticateToken, ensureUserAuth } = require('../middleware/auth.middleware');
const { attachUserScope } = require('../middleware/scope.middleware');

const router = express.Router();

router.use(authenticateToken);
router.use(ensureUserAuth);
router.use(attachUserScope);

router.get('/categories', getExpenseCategories);
router.post('/categories', createExpenseCategory);
router.delete('/categories/:id', deleteExpenseCategory);

router.get('/', getExpenses);
router.get('/:id', getExpenseById);
router.post('/', createExpense);
router.put('/:id', updateExpense);
router.delete('/:id', deleteExpense);

module.exports = router;
