const mongoose = require('mongoose');

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
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);