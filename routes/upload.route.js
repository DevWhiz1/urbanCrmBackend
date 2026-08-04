const express = require('express');
const { uploadFile } = require('../controllers/upload.controller');
const upload = require('../middleware/upload');

const router = express.Router();

router.post('/', upload.single('file'), uploadFile);

module.exports = router;
