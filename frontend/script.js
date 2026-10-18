/* ZeroCalc frontend – plain JavaScript, talks only to the Express API */
const API = ['localhost', '127.0.0.1', ''].includes(location.hostname)
  ? 'http://localhost:5000/api'
  : 'https://zero-calc.onrender.com/api';  // <- replace after deploying the backend

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let token = null, role = null, user = null, guestHist = [], gid = 0, guestTimer = null;

/* ---------- API + toast ---------- */
async function api(path, opts = {}) {
  const r = await fetch(API + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.message || 'Request failed');
  return d;
}
let tt; function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 2600); }

/* ---------- Theme + tabs ---------- */
const setTheme = t => { document.documentElement.dataset.theme = t; localStorage.setItem('zc_theme', t); };
setTheme(localStorage.getItem('zc_theme') || (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light'));
$('#themeBtn').onclick = () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
$('#tabs').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  document.querySelectorAll('.tabs button,.panel').forEach(x => x.classList.remove('active'));
  b.classList.add('active'); $('#' + b.dataset.tab).classList.add('active');
  if (b.dataset.tab === 'hist') renderHistory();
};

/* ---------- Calculation engine (recursive-descent parser, no eval) ---------- */
function tokenize(s) {
  s = s.toLowerCase().replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/π/g, 'pi').replace(/φ/g, 'phi');
  const t = [], re = /\s*(?:(\d*\.?\d+(?:e[+-]?\d+)?)|([a-z]+\d*)|(\S))/y; let i = 0, m;
  while (i < s.length) {
    re.lastIndex = i; m = re.exec(s); if (!m) break; i = re.lastIndex;
    if (m[1] !== undefined) t.push({ n: parseFloat(m[1]) }); else if (m[2]) t.push({ id: m[2] }); else t.push({ op: m[3] });
  }
  return t;
}
function fact(n) {
  if (n < 0 || !Number.isInteger(n) || n > 170) throw Error('Factorial needs a whole number from 0 to 170');
  let r = 1; for (let i = 2; i <= n; i++) r *= i; return r;
}
function calc(src, deg, ans) {
  const t = tokenize(src); let p = 0;
  const isOp = o => t[p] && t[p].op === o;
  const toR = x => deg ? x * Math.PI / 180 : x, fromR = x => deg ? x * 180 / Math.PI : x;
  const F = {
    sin: x => Math.sin(toR(x)), cos: x => Math.cos(toR(x)), tan: x => Math.tan(toR(x)),
    asin: x => fromR(Math.asin(x)), acos: x => fromR(Math.acos(x)), atan: x => fromR(Math.atan(x)),
    sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh, asinh: Math.asinh, acosh: Math.acosh, atanh: Math.atanh,
    log: Math.log10, ln: Math.log, log2: Math.log2, exp: Math.exp, sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs,
    floor: Math.floor, ceil: Math.ceil, round: Math.round, sign: Math.sign, trunc: Math.trunc
  };
  const C = { pi: Math.PI, e: Math.E, phi: (1 + Math.sqrt(5)) / 2, ans };
  const close = () => { if (!isOp(')')) throw Error('Missing closing bracket'); p++; };
  function expr() { let v = term(); while (isOp('+') || isOp('-')) v = t[p++].op === '+' ? v + term() : v - term(); return v; }
  function term() {
    let v = unary();
    for (;;) {
      const k = t[p]; if (!k) break;
      if (k.op === '*') { p++; v *= unary(); }
      else if (k.op === '/') { p++; v /= unary(); }
      else if (k.id === 'mod') { p++; v %= unary(); }
      else if (k.n !== undefined || k.id || k.op === '(') v *= unary();   // implicit multiplication: 2π, 3(4+1)
      else break;
    }
    return v;
  }
  function unary() { if (isOp('-')) { p++; return -unary(); } if (isOp('+')) { p++; return unary(); } return power(); }
  function power() { const b = postfix(); if (isOp('^')) { p++; return Math.pow(b, unary()); } return b; }
  function postfix() { let v = primary(); while (isOp('!') || isOp('%')) v = t[p++].op === '!' ? fact(v) : v / 100; return v; }
  function primary() {
    const k = t[p++]; if (!k) throw Error('Incomplete expression');
    if (k.n !== undefined) return k.n;
    if (k.op === '(') { const v = expr(); close(); return v; }
    if (k.id in C) return C[k.id];
    if (k.id in F) { let a; if (isOp('(')) { p++; a = expr(); close(); } else a = unary(); return F[k.id](a); }
    throw Error('Syntax error');
  }
  const r = expr(); if (p < t.length) throw Error('Syntax error');
  if (!Number.isFinite(r)) throw Error('Math error');
  return Math.abs(r) < 1e-12 ? 0 : parseFloat(r.toPrecision(12));
}
const fmt = n => String(n);

/* ---------- Scientific keypad ---------- */
let deg = true, ans = 0, mem = 0;
const FN = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh', 'log', 'ln', 'log2', 'exp',
  'sqrt', 'cbrt', 'abs', 'floor', 'ceil', 'round', 'sign', 'trunc'];
const fnList = FN.map(f => [f, f + '(']).concat([['n!', '!'], ['π', 'π'], ['e', 'e'], ['%', '%'], ['mod', ' mod '], ['xʸ', '^']]);
const padList = [['C', 'C', 'op'], ['⌫', 'B', 'op'], ['(', '(', 'op'], [')', ')', 'op'],
  ['7'], ['8'], ['9'], ['÷', '÷', 'op'], ['4'], ['5'], ['6'], ['×', '×', 'op'], ['1'], ['2'], ['3'], ['−', '−', 'op'],
  ['0'], ['.'], ['ANS', 'ANS', 'op'], ['+', '+', 'op'], ['=', '=', 'eq']];
const mk = (el, list) => el.innerHTML = list.map(([l, v, c]) => `<button class="${c || ''}" data-v="${v ?? l}">${l}</button>`).join('');
mk($('#fnKeys'), fnList); mk($('#padKeys'), padList);

function ins(s) {
  const x = $('#expr'), a = x.selectionStart ?? x.value.length, b = x.selectionEnd ?? a;
  x.value = x.value.slice(0, a) + s + x.value.slice(b); x.setSelectionRange(a + s.length, a + s.length);
}
function equals() {
  const ex = $('#expr').value.trim(); if (!ex) return;
  try {
    const r = calc(ex, deg, ans), out = fmt(r); ans = r;
    $('#res').textContent = out; $('#res').classList.remove('err'); save('scientific', ex, out);
  } catch (e) { $('#res').textContent = e.message; $('#res').classList.add('err'); }
}
document.querySelectorAll('#fnKeys,#padKeys').forEach(g => g.onclick = e => {
  const b = e.target.closest('button'); if (!b) return; const v = b.dataset.v;
  if (v === 'C') { $('#expr').value = ''; $('#res').textContent = '0'; $('#res').classList.remove('err'); }
  else if (v === 'B') $('#expr').value = $('#expr').value.slice(0, -1);
  else if (v === '=') equals();
  else if (v === 'ANS') ins('ans');
  else ins(v);
});
$('#expr').addEventListener('keydown', e => { if (e.key === 'Enter') equals(); });
$('#modeBtn').onclick = () => { deg = !deg; $('#modeBtn').textContent = deg ? 'DEG' : 'RAD'; };
document.querySelectorAll('[data-m]').forEach(b => b.onclick = () => {
  const k = b.dataset.m;
  if (k === 'MC') mem = 0; else if (k === 'MR') return ins(String(mem));
  else { let cur = ans; try { if ($('#expr').value.trim()) cur = calc($('#expr').value, deg, ans); } catch { return toast('Fix the expression first'); }
    mem += k === 'M+' ? cur : -cur; mem = parseFloat(mem.toPrecision(12)); }
  $('#memInd').classList.toggle('off', mem === 0);
});

/* ---------- History (server for users, memory only for guests) ---------- */
async function save(module, expression, result) {
  if (role === 'guest') { guestHist.unshift({ _id: 'g' + (++gid), module, expression, result, createdAt: new Date().toISOString() }); return; }
  try { await api('/history', { method: 'POST', body: { module, expression, result } }); } catch (e) { toast(e.message); }
}
async function renderHistory() {
  if (!token) return;
  const m = $('#hf').value, q = $('#hq').value.trim(); let rows = [];
  $('#hNote').textContent = role === 'guest' ? 'Guest history stays in this tab only. It is cleared when you log out, close the tab or the session expires.' : '';
  try {
    rows = role === 'guest'
      ? guestHist.filter(h => (!m || h.module === m) && (!q || (h.expression + h.result).toLowerCase().includes(q.toLowerCase())))
      : await api('/history?' + new URLSearchParams({ module: m, q }));
  } catch (e) { return toast(e.message); }
  $('#hList').innerHTML = rows.length ? rows.map(h => `<li><div class="ex">${esc(h.expression)} = ${esc(h.result)}</div>
    <div class="meta">${esc(h.module)} · ${new Date(h.createdAt).toLocaleString()}</div>
    <button data-id="${esc(h._id)}">Delete</button></li>`).join('') : '<li class="empty">No calculations yet. Use any module and it will appear here.</li>';
}
$('#hList').onclick = async e => {
  const b = e.target.closest('button'); if (!b) return;
  try {
    if (role === 'guest') guestHist = guestHist.filter(h => h._id !== b.dataset.id);
    else await api('/history/' + b.dataset.id, { method: 'DELETE' });
    renderHistory();
  } catch (x) { toast(x.message); }
};
$('#hClear').onclick = async () => {
  if (!confirm('Delete all history?')) return;
  try { if (role === 'guest') guestHist = []; else await api('/history', { method: 'DELETE' }); renderHistory(); } catch (x) { toast(x.message); }
};
$('#hq').oninput = renderHistory; $('#hf').onchange = renderHistory;

/* ---------- Currency ---------- */
let rates = null;
async function loadRates() {
  let d, note;
  try { d = await api('/currency'); localStorage.setItem('zc_rates', JSON.stringify(d)); note = d.source === 'live' ? 'Live rates' : 'Saved server rates'; }
  catch { d = JSON.parse(localStorage.getItem('zc_rates') || 'null'); note = 'Server unreachable. Showing last saved rates'; }
  if (!d) { $('#cInfo').textContent = 'Rates unavailable. Check your connection and reload.'; return; }
  rates = d.rates; $('#cInfo').textContent = `${note} · updated ${d.updated}`;
  const opts = Object.keys(rates).map(c => `<option>${c}</option>`).join('');
  $('#cFrom').innerHTML = opts; $('#cTo').innerHTML = opts; $('#cFrom').value = 'USD'; $('#cTo').value = rates.INR ? 'INR' : 'EUR';
}
$('#cSwap').onclick = () => { const f = $('#cFrom').value; $('#cFrom').value = $('#cTo').value; $('#cTo').value = f; };
$('#cGo').onclick = () => {
  const a = parseFloat($('#cAmt').value), f = $('#cFrom').value, t = $('#cTo').value;
  if (!rates) return toast('Rates are not loaded yet');
  if (isNaN(a)) return toast('Enter a valid amount');
  const r = a / rates[f] * rates[t], out = r.toLocaleString(undefined, { maximumFractionDigits: 4 }) + ' ' + t;
  $('#cOut').textContent = `${a} ${f} = ${out}`; save('currency', `${a} ${f} → ${t}`, out);
};

/* ---------- Units ---------- */
const U = {
  length: { m: 1, km: 1000, cm: .01, mm: .001, mi: 1609.344, yd: .9144, ft: .3048, in: .0254 },
  mass: { kg: 1, g: .001, mg: 1e-6, tonne: 1000, lb: .45359237, oz: .028349523125 },
  temperature: { '°C': 1, '°F': 1, K: 1 },
  area: { 'm²': 1, 'km²': 1e6, 'cm²': 1e-4, ha: 1e4, acre: 4046.8564224, 'ft²': .09290304 },
  volume: { L: 1, mL: .001, 'm³': 1000, gal: 3.785411784, cup: .2365882365, 'fl oz': .0295735295625 },
  speed: { 'm/s': 1, 'km/h': 1 / 3.6, mph: .44704, knot: .514444 },
  storage: { bit: 1 / 8, B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 },
  time: { s: 1, min: 60, h: 3600, day: 86400, week: 604800, year: 31557600 }
};
const fillUnits = () => { const o = Object.keys(U[$('#uCat').value]).map(u => `<option>${u}</option>`).join(''); $('#uFrom').innerHTML = o; $('#uTo').innerHTML = o; $('#uTo').selectedIndex = 1; };
$('#uCat').innerHTML = Object.keys(U).map(c => `<option>${c}</option>`).join(''); $('#uCat').onchange = fillUnits; fillUnits();
$('#uSwap').onclick = () => { const f = $('#uFrom').value; $('#uFrom').value = $('#uTo').value; $('#uTo').value = f; };
function convertUnit(v, cat, f, t) {
  if (cat === 'temperature') {
    const c = f === '°C' ? v : f === '°F' ? (v - 32) * 5 / 9 : v - 273.15;
    return t === '°C' ? c : t === '°F' ? c * 9 / 5 + 32 : c + 273.15;
  }
  return v * U[cat][f] / U[cat][t];
}
$('#uGo').onclick = () => {
  const v = parseFloat($('#uVal').value), c = $('#uCat').value, f = $('#uFrom').value, t = $('#uTo').value;
  if (isNaN(v)) return toast('Enter a valid value');
  const out = parseFloat(convertUnit(v, c, f, t).toPrecision(10)) + ' ' + t;
  $('#uOut').textContent = `${v} ${f} = ${out}`; save('unit', `${v} ${f} → ${t}`, out);
};

/* ---------- Dates ---------- */
const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const D = s => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const iso = d => d.toISOString().slice(0, 10);
$('#dGap').onclick = () => {
  if (!$('#d1').value || !$('#d2').value) return toast('Pick both dates');
  let a = D($('#d1').value), b = D($('#d2').value); if (a > b) [a, b] = [b, a];
  const days = Math.round((b - a) / 864e5);
  let y = b.getUTCFullYear() - a.getUTCFullYear(), m = b.getUTCMonth() - a.getUTCMonth(), d = b.getUTCDate() - a.getUTCDate();
  if (d < 0) { m--; d += new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), 0)).getUTCDate(); }
  if (m < 0) { y--; m += 12; }
  let work = 0; for (let i = 0; i < days; i++) { const w = new Date(a.getTime() + i * 864e5).getUTCDay(); if (w && w < 6) work++; }
  const out = `${days} days (${y} years, ${m} months, ${d} days) · ${Math.floor(days / 7)} weeks ${days % 7} days · ${work} working days`;
  $('#dOut').textContent = out; save('date', `${iso(a)} → ${iso(b)}`, out);
};
const shift = sign => {
  if (!$('#d3').value) return toast('Pick a date');
  const n = parseInt($('#dn').value, 10); if (isNaN(n) || n < 0) return toast('Enter days as 0 or more');
  const r = new Date(D($('#d3').value).getTime() + sign * n * 864e5), out = `${iso(r)} (${WD[r.getUTCDay()]})`;
  $('#dOut2').textContent = out; save('date', `${$('#d3').value} ${sign > 0 ? '+' : '−'} ${n} days`, out);
};
$('#dAdd').onclick = () => shift(1); $('#dSub').onclick = () => shift(-1);

/* ---------- Auth ---------- */
let mode = 'login';
function setMode(m) {
  mode = m; $('#tLogin').classList.toggle('active', m === 'login'); $('#tSignup').classList.toggle('active', m === 'signup');
  $('#nameWrap').hidden = m === 'login'; $('#aGo').textContent = m === 'login' ? 'Log in' : 'Create account'; $('#aErr').textContent = '';
}
$('#tLogin').onclick = () => setMode('login'); $('#tSignup').onclick = () => setMode('signup');
/* Clears every field and result so the next person never sees the previous user's data */
function resetUI() {
  ['aName', 'aEmail', 'aPass'].forEach(id => $('#' + id).value = '');
  $('#aErr').textContent = ''; setMode('login');
  $('#expr').value = ''; $('#res').textContent = '0'; $('#res').classList.remove('err');
  ans = 0; mem = 0; deg = true; $('#modeBtn').textContent = 'DEG'; $('#memInd').classList.add('off');
  $('#cAmt').value = 1; $('#cOut').textContent = 'Enter an amount and press Convert.';
  if (rates) { $('#cFrom').value = 'USD'; $('#cTo').value = rates.INR ? 'INR' : 'EUR'; }
  $('#uCat').selectedIndex = 0; fillUnits(); $('#uVal').value = 1; $('#uOut').textContent = 'Choose units and press Convert.';
  ['d1', 'd2', 'd3'].forEach(id => $('#' + id).value = ''); $('#dn').value = 30;
  $('#dOut').textContent = 'Pick two dates.'; $('#dOut2').textContent = 'Result and weekday appear here.';
  $('#hq').value = ''; $('#hf').value = ''; $('#hList').innerHTML = ''; $('#hNote').textContent = '';
  document.querySelector('.tabs button').click();   // back to the Scientific tab
}
function startSession(d, persist) {
  resetUI();
  token = d.token; role = d.role; user = d.user; guestHist = []; clearTimeout(guestTimer);
  if (persist) localStorage.setItem('zc_token', token);
  else guestTimer = setTimeout(() => { toast('Guest session expired'); logout(); }, d.expiresIn * 1000);
  $('#whoami').textContent = role === 'guest' ? 'Guest' : user.name;
  $('#logoutBtn').hidden = false; $('#auth').classList.remove('show'); renderHistory();
}
function logout() {
  token = role = user = null; guestHist = []; clearTimeout(guestTimer); localStorage.removeItem('zc_token');
  resetUI(); $('#whoami').textContent = ''; $('#auth').classList.add('show');
}
$('#aGo').onclick = async () => {
  $('#aErr').textContent = '';
  const body = { email: $('#aEmail').value.trim(), password: $('#aPass').value };
  if (mode === 'signup') body.name = $('#aName').value.trim();
  try { startSession(await api('/auth/' + (mode === 'login' ? 'login' : 'signup'), { method: 'POST', body }), true); }
  catch (e) { $('#aErr').textContent = e.message; }
};
$('#aGuest').onclick = async () => {
  try { startSession(await api('/auth/guest', { method: 'POST' }), false); }
  catch (e) { $('#aErr').textContent = 'Cannot reach the server. ' + e.message; }
};
$('#logoutBtn').onclick = logout;
['aEmail', 'aPass', 'aName'].forEach(id => $('#' + id).addEventListener('keydown', e => { if (e.key === 'Enter') $('#aGo').click(); }));

(async function init() {
  loadRates();
  const saved = localStorage.getItem('zc_token');
  if (saved) {
    token = saved;
    try { const d = await api('/auth/me'); return startSession({ token: saved, role: d.role, user: d.user }, true); } catch { token = null; localStorage.removeItem('zc_token'); }
  }
  $('#logoutBtn').hidden = true; $('#auth').classList.add('show');
})();