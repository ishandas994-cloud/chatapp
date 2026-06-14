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
    const { chatId, content, type = 'text' } = req.body;
    if (!chatId || !content)
      return res.status(400).json({ message: 'chatId and content required' });

    const message = await Message.create({
      chatId, sender: req.user._id, content, type,
      readBy: [req.user._id],
    });
    await Chat.findByIdAndUpdate(chatId, { lastMessage: message._id, updatedAt: new Date() });
    const populated = await message.populate('sender', 'name avatar');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});