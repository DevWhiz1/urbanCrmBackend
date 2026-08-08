const express = require('express');
const { uploadFile } = require('../controllers/upload.controller');
const upload = require('../middleware/upload');

const { authenticateToken, ensureUserAuth } = require('../middleware/auth.middleware');
const { attachUserScope } = require('../middleware/scope.middleware');

const router = express.Router();

router.use(authenticateToken);
router.use(ensureUserAuth);
router.use(attachUserScope);

router.post('/', upload.single('file'), uploadFile);

module.exports = router;
