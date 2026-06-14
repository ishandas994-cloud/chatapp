const router = require('express').Router();

// In-memory signal store — signals expire after 30 seconds
const signals = new Map(); // userId → [signal, ...]

const addSignal = (userId, signal) => {
  const existing = signals.get(userId) || [];
  signals.set(userId, [...existing, {
    ...signal,
    _id: `${Date.now()}_${Math.random()}`,
    _expires: Date.now() + 30000,
  }]);
};

const cleanExpired = () => {
  const now = Date.now();
  for (const [uid, sigs] of signals.entries()) {
    const fresh = sigs.filter(s => s._expires > now);
    if (fresh.length === 0) signals.delete(uid);
    else signals.set(uid, fresh);
  }
};

// POST /api/calls/signal — send a signal to another user
router.post('/signal', async (req, res) => {
  try {
    cleanExpired();
    const { to, ...rest } = req.body;
    if (!to) return res.status(400).json({ message: 'to is required' });
    addSignal(to, rest);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/calls/signal?userId=xxx — get pending signals for a user
router.get('/signal', async (req, res) => {
  try {
    cleanExpired();
    const { userId } = req.query;
    if (!userId) return res.json([]);
    const pending = signals.get(userId) || [];
    signals.delete(userId); // consume signals
    res.json(pending);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;