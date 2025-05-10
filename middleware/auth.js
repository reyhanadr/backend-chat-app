const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  try {
    // Ambil token dari header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Token tidak ditemukan' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Token tidak valid' });
    }

    // Verifikasi token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || !decoded.userId) {
      return res.status(401).json({ message: 'Token tidak valid' });
    }

    // Tambahkan user ID ke request
    req.user = { userId: decoded.userId };
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Token tidak valid' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token telah kadaluarsa' });
    }
    res.status(500).json({ message: 'Terjadi kesalahan pada autentikasi' });
  }
}; 