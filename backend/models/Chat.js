const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  name:        { type: String, trim: true },
  isGroup:     { type: Boolean, default: false },
  members:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  admin:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  groupAvatar: { type: String, default: '' },
  lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
}, { timestamps: true });

module.exports = mongoose.model('Chat', chatSchema);