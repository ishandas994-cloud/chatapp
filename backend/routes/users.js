const router = require('express').Router();
const User   = require('../models/User');
const auth   = require('../middleware/auth');

// In-memory online users store (resets on cold start — fine for Vercel)
const onlineMap = new Map(); // userId → lastSeen timestamp

// POST /api/users/online — heartbeat ping
router.post('/online', async (req, res) => {
  try {
    const { userId } = req.body;
    if (userId) onlineMap.set(userId, Date.now());
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/users/online — returns list of online userIds
router.get('/online', async (req, res) => {
  try {
    const now    = Date.now();
    const cutoff = 15000; // 15 seconds — if no ping, considered offline
    const online = [];
    for (const [uid, ts] of onlineMap.entries()) {
      if (now - ts < cutoff) online.push(uid);
      else onlineMap.delete(uid);
    }
    res.json(online);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/users/search?q=name
router.get('/search', auth, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);
    const users = await User.find({
      _id: { $ne: req.user._id },
      $or: [
        { name:  { $regex: q.trim(), $options: 'i' } },
        { email: { $regex: q.trim(), $options: 'i' } },
      ],
    }).select('-password').limit(20);
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/users/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;