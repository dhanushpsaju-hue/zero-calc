const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const sign = (payload, exp) => jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: exp });
const pub = u => ({ id: u._id, name: u.name, email: u.email });
const fail = (res, code, message) => res.status(code).json({ message });

router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) return fail(res, 400, 'Name, email and password are required');
    if (!/^\S+@\S+\.\S+$/.test(email)) return fail(res, 400, 'Enter a valid email address');
    if (password.length < 8) return fail(res, 400, 'Password must be at least 8 characters');
    if (await User.findOne({ email: email.toLowerCase() })) return fail(res, 409, 'This email is already registered');
    const user = await User.create({ name, email, password: await bcrypt.hash(password, 10) });
    res.status(201).json({ token: sign({ id: user._id, role: 'user' }, '7d'), role: 'user', user: pub(user) });
  } catch { fail(res, 500, 'Server error'); }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const user = email && password ? await User.findOne({ email: String(email).toLowerCase() }) : null;
    if (!user || !(await bcrypt.compare(password, user.password))) return fail(res, 401, 'Incorrect email or password');
    res.json({ token: sign({ id: user._id, role: 'user' }, '7d'), role: 'user', user: pub(user) });
  } catch { fail(res, 500, 'Server error'); }
});

// Short-lived guest token: nothing is written to the database
router.post('/guest', (req, res) => {
  res.json({ token: sign({ role: 'guest', gid: crypto.randomUUID() }, '30m'), role: 'guest', expiresIn: 1800, user: { name: 'Guest' } });
});

router.get('/me', auth, async (req, res) => {
  try {
    if (req.user.role === 'guest') return res.json({ role: 'guest', user: { name: 'Guest' } });
    const user = await User.findById(req.user.id);
    if (!user) return fail(res, 401, 'Account not found');
    res.json({ role: 'user', user: pub(user) });
  } catch { fail(res, 500, 'Server error'); }
});

module.exports = router;
