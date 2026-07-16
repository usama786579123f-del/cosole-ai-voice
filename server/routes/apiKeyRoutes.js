const express = require('express');
const router = express.Router();
const { getApiKey, regenerateApiKey } = require('../controllers/apiKeyController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getApiKey);
router.post('/regenerate', protect, regenerateApiKey);

module.exports = router;