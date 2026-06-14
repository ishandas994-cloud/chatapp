try { require('dotenv').config(); } catch (e) {}

const express      = require('express');
const cors         = require('cors');
const connectDB    = require('./lib/db');

const authRoutes    = require('./routes/auth');
const userRoutes    = require('./routes/users');
const chatRoutes    = require('./routes/chats');
const messageRoutes = require('./routes/messages');
const callRoutes    = require('./routes/calls');

const app = express();

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);

    const allowed = [
      'http://localhost:3000',
      'http://localhost:5000',
      'chatapp-c2o8-vfowxoutj-ishandas994-clouds-projects.vercel.app',
      'chatapp-frontend.vercel.app',
      'ishandas994-clouds-projects.vercel.app',
    ];

    const isAllowed =
      allowed.some(a => origin.includes(a)) ||
      origin.endsWith('.vercel.app');

    if (isAllowed) return cb(null, true);

    console.log('CORS blocked:', origin);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.options('*', cors());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (_, res) => res.json({
  status: 'ok',
  mongo: process.env.MONGO_URI  ? 'set' : 'MISSING',
  jwt:   process.env.JWT_SECRET ? 'set' : 'MISSING',
}));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/users',    userRoutes);
app.use('/api/chats',    chatRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/calls',    callRoutes);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.url} not found` });
});

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  res.status(500).json({ message: err.message || 'Internal server error' });
});

// ── Start server locally / export for Vercel ──────────────────────────────────
connectDB().then(() => {
  // Only listen when running locally — Vercel handles this itself
  if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () =>
      console.log(`🚀 Server → http://localhost:${PORT}`)
    );
  }
});

module.exports = app;