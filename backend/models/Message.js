const mongoose = require('mongoose');

const reactionSchema = new mongoose.Schema({
  emoji:  { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name:   { type: String, required: true },
}, { _id: false });

const messageSchema = new mongoose.Schema({
  chatId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true },
  sender:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content:    { type: String, default: '' },
  type:       { type: String, enum: ['text','image','video','audio','file'], default: 'text' },
  fileUrl:    { type: String, default: '' },
  fileName:   { type: String, default: '' },
  fileType:   { type: String, default: '' },
  readBy:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  reactions:  [reactionSchema],
  replyTo: {
    msgId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
    content: { type: String, default: '' },
    type:    { type: String, default: 'text' },
    senderName: { type: String, default: '' },
  },
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);