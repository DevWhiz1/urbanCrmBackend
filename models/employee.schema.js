const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
    },
    cnic: {
      type: String,
    },
    phone: {
      type: String,
    },
    email: {
      type: String,
    },
    address: {
      type: String,
    },
    designation: {
      type: String,
    },
    department: {
      type: String,
    },
    employmentType: {
      type: String,
      enum: ['Permanent', 'Contract', 'Daily Wage', 'Intern'],
      required: true,
    },
    joiningDate: {
      type: Date,
      required: true,
    },
    salary: {
      type: Number,
    },
    status: {
      type: String,
      enum: ['Active', 'On Leave', 'Resigned', 'Terminated', 'Inactive'],
      default: 'Active',
    },
    emergencyContact: {
      type: String,
    },
    documents: [
      {
        url: String,
        name: String,
      },
    ],
    role: {
      type: String,
      enum: [
        'Super Admin',
        'Admin',
        'Project Manager',
        'Site Engineer',
        'Civil Engineer',
        'Site Supervisor',
        'Accountant',
        'Sales',
        'Guard',
        'Support Staff',
      ],
      required: true,
    },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Employee', employeeSchema);
