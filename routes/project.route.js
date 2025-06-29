const express = require('express');
const projectController = require('../controllers/project.controller');
const router = express.Router();

// Create a new project
router.post('/create-project', projectController.createProject);
// Get all projects
// router.get('/get-all-projects', projectController.getAllProjects);
// // Get a single project
// router.get('/get-single-project/:id', projectController.getSingleProject);
// // Update a project
// router.put('/update-project/:id', projectController.updateProject);

module.exports = router;