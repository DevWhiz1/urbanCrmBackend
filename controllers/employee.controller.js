const { getPaginationParams, formatPaginatedResponse } = require('../utils/paginate');
const Employee = require('../models/employee.schema');

const getEmployees = async (req, res) => {
  try {
    const filter = { isDeleted: false };
    if (req.query.status && req.query.status !== 'All') {
      filter.status = req.query.status;
    }
    if (req.query.search) {
      filter.$or = [
        { fullName: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } },
        { designation: { $regex: req.query.search, $options: 'i' } },
      ];
    }

    const { isPaginated, page, limit, skip } = getPaginationParams(req);
    const total = await Employee.countDocuments(filter);

    let query = Employee.find(filter).sort({ createdAt: -1 });

    if (isPaginated && limit > 0) {
      query = query.skip(skip).limit(limit);
    }

    const employees = await query;
    
    if (isPaginated) {
      const response = formatPaginatedResponse(employees, total, page, limit);
      return res.status(200).json(response);
    }
    
    res.status(200).json(employees);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getEmployeeById = async (req, res) => {
  try {
    const employee = await Employee.findOne({ _id: req.params.id, isDeleted: false });
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    res.status(200).json(employee);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const User = require('../models/users.schema');
const bcrypt = require('bcrypt');

const createEmployee = async (req, res) => {
  try {
    const { password, ...employeeData } = req.body;
    
    // Check if email already exists in User collection
    if (employeeData.email && password) {
      const existingUser = await User.findOne({ email: employeeData.email });
      if (existingUser) {
        return res.status(400).json({ message: "Email already exists in users" });
      }
      
      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = new User({
        userName: employeeData.fullName,
        email: employeeData.email,
        phoneNumber: employeeData.phone,
        password: hashedPassword,
        plainPassword: password,
        role: employeeData.role || 'Support Staff',
        status: 'Active'
      });
      await newUser.save();
    }

    const newEmployee = new Employee(employeeData);
    await newEmployee.save();
    res.status(201).json(newEmployee);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const updateEmployee = async (req, res) => {
  try {
    const updatedEmployee = await Employee.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedEmployee) return res.status(404).json({ message: 'Employee not found' });

    if (updatedEmployee.email) {
      const userStatus = ['Inactive', 'Resigned', 'Terminated'].includes(updatedEmployee.status) ? 'InActive' : 'Active';
      await User.findOneAndUpdate(
        { email: updatedEmployee.email },
        { status: userStatus, role: updatedEmployee.role }
      );
    }

    res.status(200).json(updatedEmployee);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const deleteEmployee = async (req, res) => {
  try {
    const deletedEmployee = await Employee.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { isDeleted: true, isActive: false, deletedAt: new Date() },
      { new: true }
    );
    if (!deletedEmployee) return res.status(404).json({ message: 'Employee not found' });

    if (deletedEmployee.email) {
      await User.findOneAndUpdate(
        { email: deletedEmployee.email },
        { isDeleted: true, status: 'InActive', deletedAt: new Date() }
      );
    }

    res.status(200).json({ message: 'Employee deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
};
