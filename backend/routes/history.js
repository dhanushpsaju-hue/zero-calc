const router = require('express').Router();
const History = require('../models/History');
const { auth, registeredOnly } = require('../middleware/auth');

router.use(auth, registeredOnly);
const wrap = fn => (req, res) => fn(req, res).catch(() => res.status(500).json({ message: 'Server error' }));

router.get('/', wrap(async (req, res) => {
  const filter = { user: req.user.id };
  if (req.query.module) filter.module = req.query.module;
  if (req.query.q) {
    const q = new RegExp(String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ expression: q }, { result: q }];
  }
  res.json(await History.find(filter).sort('-createdAt').limit(200));
}));

router.post('/', wrap(async (req, res) => {
  const { module, expression, result } = req.body || {};
  const item = await History.create({ user: req.user.id, module, expression, result });
  res.status(201).json(item);
}));

router.delete('/:id', wrap(async (req, res) => {
  const gone = await History.findOneAndDelete({ _id: req.params.id, user: req.user.id });
  if (!gone) return res.status(404).json({ message: 'Entry not found' });
  res.json({ ok: true });
}));

router.delete('/', wrap(async (req, res) => {
  await History.deleteMany({ user: req.user.id });
  res.json({ ok: true });
}));

module.exports = router;
