const User = require('../models/User');
const jwt = require('jsonwebtoken');
const fs = require('fs').promises;
const path = require('path');

// Register user
exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validasi password
    if (password.length < 6) {
      return res.status(400).json({ 
        message: 'Password harus minimal 6 karakter' 
      });
    }

    // Cek apakah user sudah ada
    let user = await User.findOne({ $or: [{ email }, { username }] });
    if (user) {
      return res.status(400).json({ message: 'User sudah terdaftar' });
    }

    // Buat user baru
    user = new User({
      username,
      email,
      password
    });

    await user.save();

    // Buat token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar
      }
    });
  } catch (error) {
    console.error(error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ message: messages[0] });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

// Login user
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Cek user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Email atau password salah' });
    }

    // Verifikasi password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Email atau password salah' });
    }

    // Buat token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar || 'uploads/default-avatar.png'
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get current user
exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User tidak ditemukan' });
    }
    
    res.json({
      _id: user._id,
      username: user.username,
      email: user.email,
      avatar: user.avatar || 'uploads/default-avatar.png'
    });
  } catch (error) {
    console.error('Error getting current user:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update profile
exports.updateProfile = async (req, res) => {
  try {
    const { username, email } = req.body;
    const userId = req.user.userId;

    // Cek apakah username atau email sudah digunakan
    if (username || email) {
      const existingUser = await User.findOne({
        $and: [
          { _id: { $ne: userId } },
          { $or: [
            ...(username ? [{ username }] : []),
            ...(email ? [{ email }] : [])
          ]}
        ]
      });

      if (existingUser) {
        return res.status(400).json({ 
          message: 'Username atau email sudah digunakan' 
        });
      }
    }

    const updateData = {};
    if (username) updateData.username = username;
    if (email) updateData.email = email;
    if (req.file) {
      console.log('File uploaded:', req.file);
      // Hapus foto lama jika ada
      const user = await User.findById(userId);
      if (user.avatar) {
        const oldAvatarPath = path.join(__dirname, '..', user.avatar);
        try {
          await fs.unlink(oldAvatarPath);
        } catch (unlinkError) {
          console.error('Error deleting old avatar:', unlinkError);
        }
      }
      updateData.avatar = 'uploads/' + req.file.filename;
      console.log('New avatar path:', updateData.avatar);
    }

    const updatedUser = await User.findByIdAndUpdate(userId, { $set: updateData }, { new: true }).select('-password');
    if (!updatedUser) {
      return res.status(404).json({ message: 'User tidak ditemukan' });
    }
    res.json({
      message: 'Profil berhasil diperbarui',
      user: updatedUser
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    if (error.name === 'MulterError') {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'Ukuran file terlalu besar. Maksimal 5MB' });
      }
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

// Update password
exports.updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User tidak ditemukan' });
    }

    // Verifikasi password lama
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Password saat ini tidak sesuai' });
    }

    // Validasi password baru
    if (newPassword.length < 6) {
      return res.status(400).json({ 
        message: 'Password baru harus minimal 6 karakter' 
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password berhasil diperbarui' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Fungsi logout
exports.logout = async (req, res) => {
  try {
    // Di sini, kita anggap logout hanya mengembalikan pesan sukses karena JWT biasanya dihandle client-side
    // Jika diperlukan, Anda bisa menambahkan logika untuk blacklist token
    res.json({ message: 'Logout berhasil' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Fungsi checkLogin untuk memeriksa status login
exports.checkLogin = async (req, res) => {
  try {
    // Gunakan req.user dari middleware untuk memverifikasi
    if (req.user && req.user.userId) {
      const user = await User.findById(req.user.userId).select('-password');
      if (user) {
        res.json({ loggedIn: true, user: { id: user._id, username: user.username, email: user.email } });
      } else {
        res.json({ loggedIn: false, message: 'User tidak ditemukan' });
      }
    } else {
      res.json({ loggedIn: false, message: 'Tidak ada sesi aktif' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};
