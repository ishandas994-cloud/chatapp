require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const connectDB = require('./lib/db');

const authRoutes    = require('./routes/auth');
const userRoutes    = require('./routes/users');
const chatRoutes    = require('./routes/chats');
const messageRoutes = require('./routes/messages');

const app = express();
