const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const Chat = require('./models/Chat');
const jwt = require('jsonwebtoken');
const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');
const uploadRoutes = require('./routes/upload');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { 
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: function(origin, callback) {
    const allowedOrigins = ['http://localhost:3000', 'http://localhost:5000', 'http://192.168.224.143:3000'];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/upload', uploadRoutes);

// Socket.IO middleware untuk autentikasi
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error'));
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return next(new Error('Authentication error'));
    }
    socket.userId = decoded.userId;
    next();
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  // Set content type ke JSON
  res.setHeader('Content-Type', 'application/json');
  
  if (err.name === 'MulterError') {
    return res.status(400).json({ message: err.message });
  }
  
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ message: 'Token tidak valid' });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ message: 'Token telah kadaluarsa' });
  }
  
  res.status(500).json({ message: 'Terjadi kesalahan pada server' });
});

// 404 handler
app.use((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.status(404).json({ message: 'Endpoint tidak ditemukan' });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.userId);

  // Join user's personal room
  socket.join(socket.userId);

  // Handle joining chat room
  socket.on('joinChat', (chatId) => {
    console.log(`User ${socket.userId} joining chat:`, chatId);
    socket.join(chatId);
  });

  // Handle leaving chat room
  socket.on('leaveChat', (chatId) => {
    console.log(`User ${socket.userId} leaving chat:`, chatId);
    socket.leave(chatId);
  });

  // Handle sending message
  socket.on('sendMessage', async (message) => {
    try {
      console.log('Processing message:', message);
      
      if (!message || typeof message !== 'object') {
        throw new Error('Format pesan tidak valid');
      }

      const { chatId, sender, message: content, fileType, fileUrl, fileName } = message;

      if (!chatId || !sender || (!content && !fileUrl)) {
        throw new Error('Data pesan tidak lengkap');
      }

      const Chat = require('./models/Chat');
      const chat = await Chat.findById(chatId);
      
      if (!chat) {
        throw new Error('Chat tidak ditemukan');
      }

      if (!chat.participants.includes(sender)) {
        throw new Error('Pengirim bukan peserta dalam chat ini');
      }

      const newMessage = {
        sender,
        message: content || '',
        timestamp: new Date(),
        avatar: message.avatar || 'uploads/default-avatar.png',
        fileType: fileType || 'text',
        fileUrl: fileUrl || null,
        fileName: fileName || null
      };

      chat.messages.push(newMessage);
      chat.lastMessage = new Date();
      await chat.save();

      console.log('Message saved successfully:', newMessage);

      // Broadcast ke semua peserta chat
      const messageToSend = {
        chatId,
        ...newMessage
      };

      // Emit ke room chat
      io.to(chatId).emit('receiveMessage', messageToSend);
      
      // Update chat list untuk semua peserta
      chat.participants.forEach(participantId => {
        io.to(participantId).emit('chatUpdated', {
          chatId,
          lastMessage: newMessage
        });
      });

    } catch (error) {
      console.error('Error processing message:', error);
      socket.emit('messageError', { 
        message: 'Gagal mengirim pesan', 
        error: error.message 
      });
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.userId);
  });
});

// MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
