// Only the server calls the exchange-rate provider; results are cached for one hour.
const router = require('express').Router();

// Approximate static rates, used only if the provider has never answered
const FALLBACK = { USD: 1, EUR: 0.92, GBP: 0.79, INR: 83, JPY: 150, AUD: 1.55, CAD: 1.37, CHF: 0.88, CNY: 7.2, SGD: 1.35,
  AED: 3.67, SAR: 3.75, NZD: 1.67, ZAR: 18.5, BRL: 5, MXN: 17.5, KRW: 1350, HKD: 7.8, SEK: 10.6, NOK: 10.8, TRY: 32, THB: 36 };

let cache = null;

router.get('/', async (req, res) => {
  if (cache && Date.now() - cache.at < 60 * 60 * 1000) return res.json(cache.data);
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/USD');
    const j = await r.json();
    if (j.result !== 'success') throw new Error('provider error');
    const rates = {};
    Object.keys(FALLBACK).forEach(c => { if (j.rates[c]) rates[c] = j.rates[c]; });
    cache = { at: Date.now(), data: { base: 'USD', rates, updated: j.time_last_update_utc, source: 'live' } };
    res.json(cache.data);
  } catch {
    res.json(cache ? { ...cache.data, source: 'stale' } : { base: 'USD', rates: FALLBACK, updated: 'static values', source: 'fallback' });
  }
});

module.exports = router;
