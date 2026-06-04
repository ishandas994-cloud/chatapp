const router = require('express').Router();
const Chat   = require('../models/Chat');
const auth   = require('../middleware/auth');

// Get all chats for logged-in user
router.get('/', auth, async (req, res) => {
  try {
    const chats = await Chat.find({ members: req.user._id })
      .populate('members', '-password')
      .populate({ path: 'lastMessage', populate: { path: 'sender', select: 'name avatar' } })
      .sort({ updatedAt: -1 });
    res.json(chats);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get or create a 1-on-1 chat
router.post('/direct', auth, async (req, res) => {
  try {
    const { userId } = req.body;
    let chat = await Chat.findOne({
      isGroup: false,
      members: { $all: [req.user._id, userId], $size: 2 },
    }).populate('members', '-password');

    if (!chat) {
      chat = await Chat.create({ isGroup: false, members: [req.user._id, userId] });
      chat = await chat.populate('members', '-password');
    }
    res.json(chat);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create a group chat
router.post('/group', auth, async (req, res) => {
  try {
    const { name, members } = req.body;
    if (!name || !members || members.length < 2)
      return res.status(400).json({ message: 'Need a name and at least 2 other members' });

    const allMembers = [...new Set([...members, req.user._id.toString()])];
    let chat = await Chat.create({ name, isGroup: true, members: allMembers, admin: req.user._id });
    chat = await chat.populate('members', '-password');
    res.status(201).json(chat);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get a single chat by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const chat = await Chat.findOne({ _id: req.params.id, members: req.user._id })
      .populate('members', '-password');
    if (!chat) return res.status(404).json({ message: 'Chat not found' });
    res.json(chat);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;