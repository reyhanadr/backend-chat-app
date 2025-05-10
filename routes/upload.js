const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const Chat = require('../models/Chat');

// Middleware untuk autentikasi
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Token tidak ditemukan' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Token tidak valid' });
    }
    req.user = user;
    next();
  });
};

// Konfigurasi Multer untuk upload file
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('Format file tidak didukung. Hanya gambar dan video yang diperbolehkan.'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Route untuk upload file
router.post('/', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    console.log('Upload request received:', req.file);
    
    if (!req.file) {
      console.log('No file in request');
      return res.status(400).json({ 
        message: 'Tidak ada file yang diupload',
        error: 'NO_FILE'
      });
    }

    const fileType = req.file.mimetype.startsWith('image/') ? 'image' : 'video';
    const fileUrl = req.file.path.replace(/\\/g, '/'); // Normalize path untuk Windows
    const fileName = req.file.originalname;

    console.log('File processed:', {
      fileType,
      fileUrl,
      fileName,
      mimetype: req.file.mimetype,
      size: req.file.size
    });

    // Simpan informasi file ke database
    const chatId = req.body.chatId;
    if (chatId) {
      const chat = await Chat.findById(chatId);
      if (chat) {
        const newMessage = {
          sender: req.user.userId,
          message: fileName,
          timestamp: new Date(),
          avatar: req.user.avatar || 'uploads/default-avatar.png',
          fileType,
          fileUrl,
          fileName
        };

        chat.messages.push(newMessage);
        chat.lastMessage = new Date();
        
        try {
          await chat.save();
          console.log('Message saved to database:', newMessage);
        } catch (error) {
          console.error('Error saving message:', error);
          throw new Error('Gagal menyimpan pesan ke database');
        }
      }
    }

    res.json({
      message: 'File berhasil diupload',
      fileType,
      fileUrl,
      fileName
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ 
      message: 'Gagal mengupload file', 
      error: error.message,
      details: error.stack
    });
  }
});

module.exports = router; 