const jwt = require('jsonwebtoken');

exports.auth = (req, res, next) => {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Please log in first' });
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch { res.status(401).json({ message: 'Session expired. Please log in again' }); }
};

// Guests never touch the database
exports.registeredOnly = (req, res, next) =>
  req.user.role === 'guest' ? res.status(403).json({ message: 'Guest history is not saved' }) : next();
