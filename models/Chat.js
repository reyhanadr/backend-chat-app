const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  message: {
    type: String,
    default: ''
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  avatar: {
    type: String,
    default: 'uploads/default-avatar.png'
  },
  fileType: {
    type: String,
    enum: ['text', 'image', 'video'],
    default: 'text'
  },
  fileUrl: String,
  fileName: String
}, {
  timestamps: true
});

const chatSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  messages: [messageSchema],
  lastMessage: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Middleware untuk memastikan format timestamp yang benar
messageSchema.pre('save', function(next) {
  if (this.isModified('timestamp')) {
    if (typeof this.timestamp === 'string') {
      try {
        const date = new Date(this.timestamp);
        if (!isNaN(date.getTime())) {
          this.timestamp = date;
        }
      } catch (error) {
        console.error('Error converting timestamp:', error);
      }
    }
  }
  next();
});

// Middleware untuk memastikan format timestamp yang benar di chat
chatSchema.pre('save', function(next) {
  if (this.isModified('lastMessage')) {
    if (typeof this.lastMessage === 'string') {
      try {
        const date = new Date(this.lastMessage);
        if (!isNaN(date.getTime())) {
          this.lastMessage = date;
        }
      } catch (error) {
        console.error('Error converting lastMessage timestamp:', error);
      }
    }
  }
  next();
});

// Virtual untuk mendapatkan pesan terakhir
chatSchema.virtual('lastMessageContent').get(function() {
  if (this.messages && this.messages.length > 0) {
    return this.messages[this.messages.length - 1].message;
  }
  return '';
});

module.exports = mongoose.model('Chat', chatSchema); 