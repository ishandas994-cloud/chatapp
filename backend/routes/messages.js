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

    // Mark as read
    const unreadIds = messages
      .filter(m => {
        const sid = m.sender?._id?.toString() || m.sender?.toString();
        return sid !== req.user._id.toString() &&
          !m.readBy.map(id => id.toString()).includes(req.user._id.toString());
      })
      .map(m => m._id);

    if (unreadIds.length > 0) {
      await Message.updateMany(
        { _id: { $in: unreadIds } },
        { $addToSet: { readBy: req.user._id } }
      );
    }

    res.json(messages.reverse());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/messages/:chatId/poll?since=timestamp
// Returns only NEW messages since the given timestamp — used for polling
router.get('/:chatId/poll', auth, async (req, res) => {
  try {
    const since = req.query.since
      ? new Date(req.query.since)
      : new Date(Date.now() - 5000);

    const messages = await Message.find({
      chatId: req.params.chatId,
      createdAt: { $gt: since },
      deletedFor: { $ne: req.user._id },
    })
      .populate('sender', 'name avatar')
      .sort({ createdAt: 1 });

    // Mark these as read too
    const unreadIds = messages
      .filter(m => {
        const sid = m.sender?._id?.toString() || m.sender?.toString();
        return sid !== req.user._id.toString() &&
          !m.readBy.map(id => id.toString()).includes(req.user._id.toString());
      })
      .map(m => m._id);

    if (unreadIds.length > 0) {
      await Message.updateMany(
        { _id: { $in: unreadIds } },
        { $addToSet: { readBy: req.user._id } }
      );
      // Return messages with updated readBy
      const updated = await Message.find({ _id: { $in: messages.map(m => m._id) } })
        .populate('sender', 'name avatar')
        .sort({ createdAt: 1 });
      return res.json(updated);
    }

    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/messages/chats/poll?since=timestamp
// Returns updated chat list (for sidebar refresh)
router.get('/chats/poll', auth, async (req, res) => {
  try {
    const since = req.query.since
      ? new Date(req.query.since)
      : new Date(Date.now() - 5000);

    const chats = await Chat.find({
      members: req.user._id,
      updatedAt: { $gt: since },
    })
      .populate('members', '-password')
      .populate({ path: 'lastMessage', populate: { path: 'sender', select: 'name avatar' } })
      .sort({ updatedAt: -1 });

    res.json(chats);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/messages — send text
router.post('/', auth, async (req, res) => {
  try {
    const { chatId, content, type = 'text', replyTo } = req.body;
    if (!chatId || !content)
      return res.status(400).json({ message: 'chatId and content required' });

    const message = await Message.create({
      chatId,
      sender:  req.user._id,
      content,
      type,
      readBy:  [req.user._id],
      replyTo: replyTo || undefined,
    });

    await Chat.findByIdAndUpdate(chatId, { lastMessage: message._id, updatedAt: new Date() });
    const populated = await message.populate('sender', 'name avatar');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/messages/media — send file via Cloudinary
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

// POST /api/messages/read — mark messages as read
router.post('/read', auth, async (req, res) => {
  try {
    const { chatId } = req.body;
    await Message.updateMany(
      { chatId, readBy: { $ne: req.user._id } },
      { $addToSet: { readBy: req.user._id } }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
// POST /api/messages/:id/react — add or remove a reaction
router.post('/:id/react', auth, async (req, res) => {
  try {
    const { emoji } = req.body;
    if (!emoji) return res.status(400).json({ message: 'emoji required' });

    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ message: 'Message not found' });

    const existing = message.reactions.find(
      r => r.userId.toString() === req.user._id.toString() && r.emoji === emoji
    );

    if (existing) {
      // Remove reaction if same emoji clicked again (toggle)
      message.reactions = message.reactions.filter(
        r => !(r.userId.toString() === req.user._id.toString() && r.emoji === emoji)
      );
    } else {
      // Remove any previous reaction from this user first
      message.reactions = message.reactions.filter(
        r => r.userId.toString() !== req.user._id.toString()
      );
      // Add new reaction
      message.reactions.push({
        emoji,
        userId: req.user._id,
        name:   req.user.name,
      });
    }

    await message.save();
    const populated = await message.populate('sender', 'name avatar');
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
// DELETE /api/messages/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const { everyone } = req.query;

    if (everyone === 'true') {
      // Delete for everyone — replace content
      await Message.findByIdAndUpdate(req.params.id, {
        content:  '🚫 This message was deleted',
        type:     'text',
        fileUrl:  '',
        fileName: '',
        $addToSet: { deletedFor: req.user._id },
      });
    } else {
      // Delete for me only
      await Message.findByIdAndUpdate(req.params.id, {
        $addToSet: { deletedFor: req.user._id },
      });
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;