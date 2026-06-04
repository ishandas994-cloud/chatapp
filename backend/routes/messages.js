    const router  = require('express').Router();
const Message = require('../models/Message');
const Chat    = require('../models/Chat');
const auth    = require('../middleware/auth');
const { upload } = require('../lib/cloudinary');

// Get messages for a chat (paginated)
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

    await Message.updateMany(
      { chatId: req.params.chatId, readBy: { $ne: req.user._id } },
      { $addToSet: { readBy: req.user._id } }
    );

    res.json(messages.reverse());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Send a text message
router.post('/', auth, async (req, res) => {
  try {
    const { chatId, content, type = 'text' } = req.body;
    if (!chatId || !content)
      return res.status(400).json({ message: 'chatId and content required' });

    const message = await Message.create({
      chatId, sender: req.user._id, content, type, readBy: [req.user._id],
    });
    await Chat.findByIdAndUpdate(chatId, { lastMessage: message._id, updatedAt: new Date() });
    const populated = await message.populate('sender', 'name avatar');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Send a media message (Cloudinary)
router.post('/media', auth, upload.single('file'), async (req, res) => {
  try {
    const { chatId } = req.body;
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const mime = req.file.mimetype || '';
    let type = 'file';
    if (mime.startsWith('image/'))      type = 'image';
    else if (mime.startsWith('video/')) type = 'video';
    else if (mime.startsWith('audio/')) type = 'audio';

    const message = await Message.create({
      chatId, sender: req.user._id,
      type,
      fileUrl:  req.file.path,
      fileName: req.file.originalname,
      fileType: mime,
      readBy: [req.user._id],
    });
    await Chat.findByIdAndUpdate(chatId, { lastMessage: message._id, updatedAt: new Date() });
    const populated = await message.populate('sender', 'name avatar');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete message (soft delete for this user only)
router.delete('/:id', auth, async (req, res) => {
  try {
    await Message.findByIdAndUpdate(req.params.id, {
      $addToSet: { deletedFor: req.user._id },
    });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;