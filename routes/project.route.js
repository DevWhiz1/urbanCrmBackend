const express = require('express');
const projectController = require('../controllers/project.controller');
const { authenticateToken, authorizeRoles } = require('../middleware/auth.middleware');
const { attachUserScope } = require('../middleware/scope.middleware');
const router = express.Router();

router.use(authenticateToken);
router.use(attachUserScope);

// Create a new project (Admin only)
router.post('/create-project', authorizeRoles('Admin'), projectController.createProject);
// Get all projects (Scoped for Contractor/User, All for Admin)
router.get('/get-all-projects', projectController.getAllProjects);
// Get a single project
router.get('/get-single-project/:id', projectController.getProjectById);
// Update a project (Admin only)
router.put('/update-project/:id', authorizeRoles('Admin'), projectController.updateProject);
// Delete a project (Admin only)
router.delete('/delete-project/:id', authorizeRoles('Admin'), projectController.deleteProject);

module.exports = router;