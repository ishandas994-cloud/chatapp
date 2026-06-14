const router  = require('express').Router();
const Message = require('../models/Message');
const Chat    = require('../models/Chat');
const auth    = require('../middleware/auth');
const { upload } = require('../lib/cloudinary');
// GET /api/messages/:chatId — full message history
router.get('/:chatId', auth, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const messages = await Message.find({
      chatId: req.params.chatId,
      deletedFor: { $ne: req.user._id },
    })
      .populate('sender', 'name avatar')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));