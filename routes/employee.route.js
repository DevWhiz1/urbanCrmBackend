const express = require('express');
const {
  getEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
} = require('../controllers/employee.controller');

const { authenticateToken, ensureUserAuth } = require('../middleware/auth.middleware');
const { attachUserScope } = require('../middleware/scope.middleware');

const router = express.Router();

router.use(authenticateToken);
router.use(ensureUserAuth);
router.use(attachUserScope);

router.get('/', getEmployees);
router.get('/:id', getEmployeeById);
router.post('/', createEmployee);
router.put('/:id', updateEmployee);
router.delete('/:id', deleteEmployee);

module.exports = router;
