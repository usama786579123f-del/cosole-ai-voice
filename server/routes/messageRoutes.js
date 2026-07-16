const express = require('express');
const router = express.Router();
const { createMessage, getAllMessages, markAsRead, deleteMessage } = require('../controllers/messageController');
const { protect } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/adminMiddleware');

router.post('/', createMessage);
router.get('/', protect, admin, getAllMessages);
router.put('/:id/read', protect, admin, markAsRead);
router.delete('/:id', protect, admin, deleteMessage);

module.exports = router;