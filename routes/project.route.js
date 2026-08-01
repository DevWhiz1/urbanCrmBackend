const express = require('express');
const projectController = require('../controllers/project.controller');
const { authenticateToken } = require('../middleware/auth.middleware');
const router = express.Router();

router.use(authenticateToken);

// Create a new project
router.post('/create-project', projectController.createProject);
// Get all projects
router.get('/get-all-projects', projectController.getAllProjects);
// Get a single project
router.get('/get-single-project/:id', projectController.getProjectById);
// Update a project
router.put('/update-project/:id', projectController.updateProject);
// Delete a project
router.delete('/delete-project/:id', projectController.deleteProject);

module.exports = router;