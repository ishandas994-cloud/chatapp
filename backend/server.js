require('dotenv').config();
const express   = require('express');
const http      = require('http');
const { Server } = require('socket.io');
const cors      = require('cors');
const connectDB = require('./lib/db');

const authRoutes    = require('./routes/auth');
const userRoutes    = require('./routes/users');
const chatRoutes    = require('./routes/chats');
const messageRoutes = require('./routes/messages');

const app    = express();
const server = http.createServer(app);

// ── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:3000')
  .split(',').map(s => s.trim());

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── REST routes ───────────────────────────────────────────────────────────────
app.get('/api/health', (_, res) => res.json({ status: 'ok' }));
app.use('/api/auth',     authRoutes);
app.use('/api/users',    userRoutes);
app.use('/api/chats',    chatRoutes);
app.use('/api/messages', messageRoutes);

// ── Socket.IO ─────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: allowedOrigins, methods: ['GET','POST'], credentials: true },
  transports: ['websocket', 'polling'],
});

const onlineUsers = new Map(); // userId → socketId

io.on('connection', (socket) => {

  socket.on('user:online', (userId) => {
    onlineUsers.set(userId, socket.id);
    io.emit('users:online', Array.from(onlineUsers.keys()));
  });

  socket.on('chat:join',    (chatId) => socket.join(chatId));

  socket.on('message:send', (msg) =>
    socket.to(msg.chatId).emit('message:receive', msg));

  socket.on('typing:start', ({ chatId, userId, userName }) =>
    socket.to(chatId).emit('typing:start', { userId, userName }));

  socket.on('typing:stop', ({ chatId, userId }) =>
    socket.to(chatId).emit('typing:stop', { userId }));

  // WebRTC signaling
  const relay = (event) => socket.on(event, ({ to, ...rest }) => {
    const target = onlineUsers.get(to);
    if (target) io.to(target).emit(event.replace('call:', 'call:'), rest);
  });

  socket.on('call:initiate', ({ to, from, callType, offer }) => {
    const target = onlineUsers.get(to);
    if (target) io.to(target).emit('call:incoming', { from, callType, offer });
  });
  socket.on('call:answer',        ({ to, answer })    => { const t = onlineUsers.get(to); if(t) io.to(t).emit('call:answered',      { answer }); });
  socket.on('call:reject',        ({ to })             => { const t = onlineUsers.get(to); if(t) io.to(t).emit('call:rejected'); });
  socket.on('call:end',           ({ to })             => { const t = onlineUsers.get(to); if(t) io.to(t).emit('call:ended'); });
  socket.on('call:ice-candidate', ({ to, candidate }) => { const t = onlineUsers.get(to); if(t) io.to(t).emit('call:ice-candidate', { candidate }); });

  socket.on('disconnect', () => {
    for (const [uid, sid] of onlineUsers.entries()) {
      if (sid === socket.id) {
        onlineUsers.delete(uid);
        io.emit('users:online', Array.from(onlineUsers.keys()));
        break;
      }
    }
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
connectDB().then(() => {
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => console.log(`🚀 Server → http://localhost:${PORT}`));
});

module.exports = app;