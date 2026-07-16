const express = require('express');
const router = express.Router();
const { generateVoice, getVoices, addVoice } = require('../controllers/voiceController');
const { protect } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/adminMiddleware');

router.post('/generate', protect, generateVoice);
router.get('/library', protect, getVoices);
router.post('/add', protect, admin, addVoice);

module.exports = router;