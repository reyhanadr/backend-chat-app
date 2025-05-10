const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const auth = require('../middleware/auth');

// Semua route memerlukan autentikasi
router.use(auth);

// Mendapatkan daftar pengguna
router.get('/users', chatController.getUsers);

// Mendapatkan daftar chat pengguna
router.get('/chats', chatController.getUserChats);

// Mendapatkan atau membuat chat dengan pengguna tertentu
router.get('/with/:participantId', chatController.getOrCreateChat);

// Mendapatkan riwayat chat
router.get('/history/:chatId', chatController.getChatHistory);

module.exports = router; 