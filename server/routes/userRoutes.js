const express = require('express');
const router = express.Router();
const { getProfile, updateProfile, getUsage } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);
router.get('/usage', protect, getUsage);

module.exports = router;