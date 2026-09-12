const express = require('express');
const router = express.Router();
const multer = require('multer');
const emailController = require('../controllers/email.controller');

// Configure multer for memory storage so we get the file buffer directly
const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post('/send-statement', upload.single('pdfFile'), emailController.sendStatementEmail);

module.exports = router;
