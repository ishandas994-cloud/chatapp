require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const connectDB = require('./lib/db');

const authRoutes    = require('./routes/auth');
const userRoutes    = require('./routes/users');
const chatRoutes    = require('./routes/chats');
const messageRoutes = require('./routes/messages');

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