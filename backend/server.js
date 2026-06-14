require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const connectDB = require('./lib/db');

const authRoutes    = require('./routes/auth');
const userRoutes    = require('./routes/users');
const chatRoutes    = require('./routes/chats');
const messageRoutes = require('./routes/messages');
const callRoutes = require('./routes/calls');

const app = express();

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:3000')
  .split(',').map(s => s.trim());

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.some(o => origin.startsWith(o))) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/api/health', (_, res) => res.json({ status: 'ok' }));
app.use('/api/auth',     authRoutes);
app.use('/api/users',    userRoutes);
app.use('/api/chats',    chatRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/calls', callRoutes);

// ── Start ─────────────────────────────────────────────────────────────────────
connectDB().then(() => {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`🚀 Server → http://localhost:${PORT}`));
});

module.exports = app;