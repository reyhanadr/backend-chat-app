const Chat = require('../models/Chat');
const User = require('../models/User');

// Mendapatkan daftar pengguna
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user.userId } })
      .select('username avatar');
    res.json(users);
  } catch (error) {
    console.error('Error in getUsers:', error);
    res.status(500).json({ message: 'Gagal mengambil daftar pengguna' });
  }
};

// Mendapatkan atau membuat chat baru
exports.getOrCreateChat = async (req, res) => {
  try {
    const { participantId } = req.params;
    
    // Validasi participantId
    if (!participantId) {
      return res.status(400).json({ message: 'ID peserta tidak valid' });
    }

    // Cek apakah participant ada
    const participant = await User.findById(participantId);
    if (!participant) {
      return res.status(404).json({ message: 'Peserta tidak ditemukan' });
    }

    // Cek apakah chat sudah ada
    let chat = await Chat.findOne({
      participants: { 
        $all: [req.user.userId, participantId],
        $size: 2
      }
    }).populate('participants', 'username avatar');

    if (!chat) {
      // Buat chat baru
      chat = await Chat.create({
        participants: [req.user.userId, participantId],
        messages: [],
        lastMessage: new Date()
      });
      chat = await chat.populate('participants', 'username avatar');
    }

    res.json(chat);
  } catch (error) {
    console.error('Error in getOrCreateChat:', error);
    res.status(500).json({ message: 'Gagal membuat atau mengambil chat' });
  }
};

// Mendapatkan riwayat chat
exports.getChatHistory = async (req, res) => {
  try {
    const { chatId } = req.params;
    
    const chat = await Chat.findById(chatId)
      .populate('participants', 'username avatar');
    
    if (!chat) {
      return res.status(404).json({ message: 'Chat tidak ditemukan' });
    }

    // Verifikasi bahwa user adalah peserta chat
    if (!chat.participants.some(p => p._id.toString() === req.user.userId)) {
      return res.status(403).json({ message: 'Akses ditolak' });
    }

    res.json(chat);
  } catch (error) {
    console.error('Error in getChatHistory:', error);
    res.status(500).json({ message: 'Gagal mengambil riwayat chat' });
  }
};

// Mendapatkan daftar chat pengguna
exports.getUserChats = async (req, res) => {
  try {
    const chats = await Chat.find({
      participants: req.user.userId
    })
    .populate('participants', 'username avatar')
    .sort({ lastMessage: -1 });

    res.json(chats);
  } catch (error) {
    console.error('Error in getUserChats:', error);
    res.status(500).json({ message: 'Gagal mengambil daftar chat' });
  }
}; 