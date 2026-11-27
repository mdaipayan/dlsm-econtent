// ===== Virtual Lab: total station simulator =====
// Four stages of a first total-station practical:
//   1 Set up (centring and levelling)   2 Station setup and orientation
//   3 Detail survey                     4 Setting out
// Every roll number gets its own site (seeded), so answers differ per student.
// Progress is kept in the browser (localStorage) for that roll number.
(function () {
  'use strict';
  var mount = document.getElementById('tsim');
  if (!mount) return;

  var NS = 'http://www.w3.org/2000/svg';
  var D2R = Math.PI / 180, SEC = 1 / 3600;
  var C = {
    p: 'var(--color-primary)', ph: 'var(--color-primary-highlight)',
    a: 'var(--color-amber)', ah: 'var(--color-amber-highlight)',
    d: 'var(--color-danger)', s: 'var(--color-success)', sh: 'var(--color-success-highlight)',
    t: 'var(--color-text)', m: 'var(--color-text-muted)', f: 'var(--color-text-faint)',
    b: 'var(--color-border)', so: 'var(--color-surface-offset)', sf: 'var(--color-surface)'
  };
  var TOL = { centre: 1.0, tilt: 30, aimH: 10, aimV: 20, bsHD: 0.010, bsRL: 0.020, detail: 0.015, stake: 0.010, peg: 0.015 };
  var CODES = ['BLD', 'TREE', 'POLE', 'MH', 'RD'];
  var KEY = 'dlsm-tsim-v1:';

  // ---------- small helpers ----------
  function S(tag, a, p) { var e = document.createElementNS(NS, tag); for (var k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; }
  function H(tag, a, p) {
    var e = document.createElement(tag);
    for (var k in a) { if (k === 'text') e.textContent = a[k]; else if (k === 'html') e.innerHTML = a[k]; else e.setAttribute(k, a[k]); }
    if (p) p.appendChild(e); return e;
  }
  function T(p, x, y, s, a) { a = a || {}; a.x = x; a.y = y; if (!a['font-size']) a['font-size'] = 12; if (!a.fill) a.fill = C.m; var t = S('text', a, p); t.textContent = s; return t; }
  function btn(p, label, on, cls, aria) { var b = H('button', { type: 'button', class: 'tsim-btn' + (cls ? ' ' + cls : ''), text: label }, p); if (aria) b.setAttribute('aria-label', aria); b.addEventListener('click', on); return b; }
  function clear(e) { while (e.firstChild) e.removeChild(e.firstChild); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function w360(a) { return ((a % 360) + 360) % 360; }
  function dang(a) { return w360(a + 180) - 180; }
  function brg(dE, dN) { return w360(Math.atan2(dE, dN) / D2R); }
  function f3(x) { return x.toFixed(3); }
  function dms(x, signed) {
    var neg = x < 0; if (!signed) { x = w360(x); neg = false; }
    x = Math.abs(x);
    var d = Math.floor(x), m = Math.floor((x - d) * 60), s = Math.round(((x - d) * 60 - m) * 60);
    if (s === 60) { s = 0; m++; } if (m === 60) { m = 0; d++; }
    return (neg ? '−' : signed ? '+' : '') + d + '° ' + String(m).padStart(2, '0') + '′ ' + String(s).padStart(2, '0') + '″';
  }
  function hashStr(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var noiseR = mulberry(Date.now() & 0xffffffff);
  function gauss() { var u = noiseR() || 1e-9, v = noiseR(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function r3(x) { return Math.round(x * 1000) / 1000; }
  function mm(x) { var v = Math.round(x * 1000); return String(v === 0 ? 0 : v); }

  // ---------- the site for one roll number ----------
  function makeSite(roll) {
    var r = mulberry(hashStr('dlsm-tsim|' + roll.trim().toUpperCase()));
    function R(a, b) { return a + (b - a) * r(); }
    var stn = { id: 'STN1', E: r3(R(5000, 5500)), N: r3(R(2000, 2500)), RL: r3(R(280, 300)) };
    var sa = R(-0.03, 0.03), sb = R(-0.03, 0.03);
    function ground(E, N) { return stn.RL + sa * (E - stn.E) + sb * (N - stn.N); }
    function at(b, d) { return { E: r3(stn.E + d * Math.sin(b * D2R)), N: r3(stn.N + d * Math.cos(b * D2R)) }; }
    var used = [];
    function freeB(b, gap) { return used.every(function (u) { return Math.abs(dang(u - b)) >= gap; }); }
    function pick(lo, hi, gap) {
      for (var i = 0; i < 300; i++) { var b = w360(R(lo, hi)); if (freeB(b, gap || 6)) { used.push(b); return b; } }
      var bb = w360(R(lo, hi)); used.push(bb); return bb;
    }
    var bsB = R(0, 360), bsD = R(42, 55);
    used.push(bsB);
    var bs = at(bsB, bsD); bs.id = 'CP2'; bs.RL = r3(ground(bs.E, bs.N) + R(0.15, 0.35));
    var hi = r3(R(1.420, 1.620));

    // road first: two edge points on a straight road; the road band is 7 m wide on one side
    var rb = pick(bsB + 225, bsB + 250, 8), rd1 = at(rb, R(30, 38));
    var rdir = w360(rb + 90 + R(-15, 15)), rlen = R(13, 17);
    var rd2 = { E: r3(rd1.E + rlen * Math.sin(rdir * D2R)), N: r3(rd1.N + rlen * Math.cos(rdir * D2R)) };
    used.push(brg(rd2.E - stn.E, rd2.N - stn.N));
    var rn = [Math.cos(rdir * D2R), -Math.sin(rdir * D2R)];
    function offRoad(q) { var s = (q.E - rd1.E) * rn[0] + (q.N - rd1.N) * rn[1]; return s < -2.5 || s > 9.5; }
    var stnOff = offRoad(stn);
    // existing building B1 (4 corners), in one sector
    var pts = [], b1;
    for (var tries = 0; tries < 200; tries++) {
      var cb = w360(bsB + R(55, 130)), cd = R(24, 34), rot = R(0, 90), cen = at(cb, cd), corners = [];
      var hw = 6, hh = 4;
      [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].forEach(function (q) {
        var c = Math.cos(rot * D2R), s = Math.sin(rot * D2R);
        corners.push({ E: r3(cen.E + q[0] * c + q[1] * s), N: r3(cen.N - q[0] * s + q[1] * c) });
      });
      var bb = corners.map(function (q) { return brg(q.E - stn.E, q.N - stn.N); });
      var ok = corners.every(offRoad) && bb.every(function (x, i) { return freeB(x, 6) && bb.every(function (y, j) { return i === j || Math.abs(dang(x - y)) >= 4; }); });
      if (ok || tries === 199) { bb.forEach(function (x) { used.push(x); }); b1 = corners; break; }
    }
    b1.forEach(function (q, i) { pts.push({ id: 'B1-' + (i + 1), code: 'BLD', E: q.E, N: q.N }); });
    function add(id, code, lo, hi2, dlo, dhi) { var b = pick(bsB + lo, bsB + hi2), q = at(b, R(dlo, dhi)); pts.push({ id: id, code: code, E: q.E, N: q.N }); }
    add('T1', 'TREE', 145, 175, 18, 30);
    add('LP1', 'POLE', 185, 215, 15, 26);
    add('MH1', 'MH', 290, 330, 14, 24);
    pts.push({ id: 'RD1', code: 'RD', E: rd1.E, N: rd1.N });
    pts.push({ id: 'RD2', code: 'RD', E: rd2.E, N: rd2.N });
    pts.forEach(function (p) { p.RL = r3(ground(p.E, p.N) + R(-0.05, 0.05)); p.HT = p.code === 'TREE' ? 2.5 : 1.8; });

    // new building N1 to set out: 10 m × 6 m
    var design = [];
    for (var nt = 0; nt < 400; nt++) {
      var nb = w360(bsB + R(255, 345)), nd = R(16, 28), ncen = at(nb, nd), nrot = Math.round(R(0, 18)) * 5;
      design = [];
      [[-5, -3], [5, -3], [5, 3], [-5, 3]].forEach(function (q, i) {
        var c = Math.cos(nrot * D2R), s = Math.sin(nrot * D2R);
        design.push({ id: 'D' + (i + 1), E: r3(ncen.E + q[0] * c + q[1] * s), N: r3(ncen.N - q[0] * s + q[1] * c) });
      });
      var clearB1 = design.every(function (q) { return b1.every(function (c2) { return Math.hypot(q.E - c2.E, q.N - c2.N) > 8; }); });
      if (design.every(offRoad) && clearB1) break;
    }
    design.forEach(function (q) { q.RL = r3(ground(q.E, q.N)); });
    return { roll: roll, stn: stn, bs: bs, hi: hi, pts: pts, design: design, ground: ground, rd: [rd1, rd2], offRoad: offRoad };
  }

  // ---------- state ----------
  var site = null, st = null;
  function fresh(roll, name) {
    var r = mulberry(hashStr('setup|' + roll + '|' + Date.now()));
    var ca = r() * 360, cm = 60 + r() * 60, ta = r() * 360, tm = 420 + r() * 480;
    return {
      roll: roll, name: name || '', stage: 1, done: { 1: false, 2: false, 3: false, 4: false },
      setup: { c: [cm * Math.sin(ca * D2R), cm * Math.cos(ca * D2R)], t: [tm * Math.sin(ta * D2R), tm * Math.cos(ta * D2R)], moves: 0 },
      hiTyped: '', ht: 1.8, oriented: false, off: 100 + r() * 200, h: r() * 360, z: 90,
      bsCheck: null, last: null, detail: [], nextPt: 101,
      stake: { sel: 'D1', prism: {}, last: null, pegs: {} }, started: new Date().toISOString()
    };
  }
  function save() { try { localStorage.setItem(KEY + st.roll.toUpperCase(), JSON.stringify(st)); } catch (e) { /* storage may be blocked */ } }
  function load(roll) { try { var s = localStorage.getItem(KEY + roll.toUpperCase()); return s ? JSON.parse(s) : null; } catch (e) { return null; } }

  // instrument centre (true): station + centring residual
  function inst() { return { E: site.stn.E + st.setup.c[0] / 1000, N: site.stn.N + st.setup.c[1] / 1000, H: site.stn.RL + site.hi }; }
  // things the telescope can see in this stage
  function targets() {
    var list = [{ id: site.bs.id, kind: 'bs', E: site.bs.E, N: site.bs.N, Z: site.bs.RL + 1.8, HT: 1.8 }];
    if (st.stage === 3) site.pts.forEach(function (p) { list.push({ id: p.id, kind: 'pt', ref: p, E: p.E, N: p.N, Z: p.RL + p.HT, HT: p.HT }); });
    if (st.stage === 4) {
      var pr = st.stake.prism[st.stake.sel];
      if (pr) list.push({ id: 'Prism', kind: 'prism', E: pr.E, N: pr.N, Z: site.ground(pr.E, pr.N) + 1.8, HT: 1.8 });
    }
    var o = inst();
    list.forEach(function (q) {
      var dE = q.E - o.E, dN = q.N - o.N; q.HD = Math.hypot(dE, dN); q.b = brg(dE, dN);
      q.VD = q.Z - o.H; q.zen = Math.atan2(q.HD, q.VD) / D2R; q.SD = Math.hypot(q.HD, q.VD);
    });
    return list;
  }
  function aimed() {
    var best = null;
    targets().forEach(function (q) {
      var dh = Math.abs(dang(q.b - st.h)) * 3600, dv = Math.abs(q.zen - st.z) * 3600;
      if (dh <= TOL.aimH && dv <= TOL.aimV && (!best || dh < best.dh)) { best = q; best.dh = dh; }
    });
    return best;
  }
  function inView() {
    return targets().filter(function (q) { return Math.abs(dang(q.b - st.h)) < 0.5 && Math.abs(q.zen - st.z) < 0.5; });
  }

  // ---------- page skeleton ----------
  var el = {};
  function skeleton() {
    clear(mount);
    var top = H('div', { class: 'tsim-top' }, mount);
    var who = H('div', { class: 'tsim-who' }, top);
    var l1 = H('label', {}, who); H('span', { text: 'Name' }, l1); el.name = H('input', { type: 'text', autocomplete: 'name', placeholder: 'Your name', maxlength: 60 }, l1);
    var l2 = H('label', {}, who); H('span', { text: 'Roll number' }, l2); el.roll = H('input', { type: 'text', placeholder: 'CE22045', maxlength: 20 }, l2);
    btn(who, 'Start my practical', start, 'primary');
    el.whoErr = H('span', { class: 'tsim-err', 'aria-live': 'polite' }, who);
    el.steps = H('ol', { class: 'tsim-steps' }, top);
    ['Set up', 'Station and orientation', 'Detail survey', 'Setting out'].forEach(function (n, i) {
      var li = H('li', {}, el.steps), b = H('button', { type: 'button', 'data-stage': i + 1 }, li);
      H('span', { class: 'n', text: String(i + 1) }, b); H('span', { text: n }, b);
      b.addEventListener('click', function () { go(i + 1); });
    });
    el.body = H('div', { class: 'tsim-body' }, mount);
    el.book = H('div', { class: 'tsim-book' }, mount);
    el.foot = H('div', { class: 'tsim-foot' }, mount);
    btn(el.foot, 'Print my lab record', printRecord);
    btn(el.foot, 'Start again (new attempt)', function () {
      if (!st) return;
      if (!window.confirm('Clear your progress for roll ' + st.roll + ' and start again?')) return;
      st = fresh(st.roll, st.name); save(); go(1);
    }, 'ghost');
  }
  function start() {
    var roll = el.roll.value.trim(), name = el.name.value.trim();
    if (!/^[A-Za-z0-9\-\/]{3,20}$/.test(roll)) { el.whoErr.textContent = 'Enter your roll number (3–20 letters or digits).'; return; }
    el.whoErr.textContent = '';
    site = makeSite(roll);
    st = load(roll) || fresh(roll, name);
    if (name) st.name = name;
    el.name.value = st.name;
    save();
    go(st.stage);
  }
  function unlocked(n) { return n === 1 || st.done[n - 1]; }
  function go(n) {
    if (!st) return;
    if (!unlocked(n)) return;
    st.stage = n; st.last = null; save();
    Array.prototype.forEach.call(el.steps.querySelectorAll('button'), function (b) {
      var k = +b.getAttribute('data-stage');
      b.disabled = !unlocked(k);
      b.classList.toggle('on', k === n);
      b.classList.toggle('done', !!st.done[k]);
      b.setAttribute('aria-current', k === n ? 'step' : 'false');
    });
    clear(el.body); clear(el.book);
    if (n === 1) stage1(); else stageAim(n);
  }

  // ---------- stage 1: centring and levelling ----------
  var U = { A: [Math.cos(210 * D2R), Math.sin(210 * D2R)], B: [Math.cos(330 * D2R), Math.sin(330 * D2R)], C: [0, 1] };
  function stage1() {
    var views = H('div', { class: 'tsim-views two' }, el.body);
    var v1 = H('div', { class: 'tsim-pane' }, views); H('p', { class: 'tsim-lbl', text: 'Optical plummet view (looking down at the station mark)' }, v1);
    el.plum = S('svg', { viewBox: '0 0 240 240', role: 'img', 'aria-label': 'Optical plummet view of the station mark' }, v1);
    var v2 = H('div', { class: 'tsim-pane' }, views); H('p', { class: 'tsim-lbl', text: 'Circular bubble and electronic level' }, v2);
    el.bub = S('svg', { viewBox: '0 0 240 240', role: 'img', 'aria-label': 'Circular bubble' }, v2);
    el.lcd1 = H('div', { class: 'tsim-lcd' }, v2);

    var side = H('div', { class: 'tsim-side' }, el.body);
    H('ol', { class: 'tsim-proc', html:
      '<li><b>Rough centring:</b> move the tripod until the mark is near the centre of the plummet circle.</li>' +
      '<li><b>Rough levelling:</b> lengthen or shorten the tripod legs to bring the circular bubble near the ring.</li>' +
      '<li><b>Fine levelling:</b> use the three foot screws. The bubble moves towards the screw you raise (left-thumb rule).</li>' +
      '<li><b>Fine centring:</b> slide the instrument on the tripod head. Levelling disturbs centring a little, so repeat 3 and 4 until both are within limits: centring ≤ 1 mm, tilt ≤ 30″.</li>' }, side);
    function group(title) { var g = H('div', { class: 'tsim-grp' }, side); H('span', { class: 'tsim-gt', text: title }, g); return H('div', { class: 'tsim-row' }, g); }
    var g1 = group('Move tripod (10 mm)');
    [['N ▲', 0, 10], ['S ▼', 0, -10], ['W ◀', -10, 0], ['E ▶', 10, 0]].forEach(function (m) {
      btn(g1, m[0], function () { act(function () { st.setup.c[0] += m[1]; st.setup.c[1] += m[2]; st.setup.t[0] += gauss() * 40; st.setup.t[1] += gauss() * 40; }); }, '', 'Move tripod ' + m[0]);
    });
    var g2 = group('Tripod legs (about 2′ each)');
    ['A', 'B', 'C'].forEach(function (k) {
      btn(g2, k + ' longer', function () { leg(k, 1); });
      btn(g2, k + ' shorter', function () { leg(k, -1); });
    });
    var g3 = group('Foot screws (10″ each)');
    ['A', 'B', 'C'].forEach(function (k) {
      btn(g3, k + ' ▲', function () { screw(k, 1); }, '', 'Raise foot screw ' + k);
      btn(g3, k + ' ▼', function () { screw(k, -1); }, '', 'Lower foot screw ' + k);
    });
    var g4 = group('Slide on tripod head');
    [['N 1 mm', 0, 1], ['S 1 mm', 0, -1], ['W 1 mm', -1, 0], ['E 1 mm', 1, 0], ['N 0.2', 0, 0.2], ['S 0.2', 0, -0.2], ['W 0.2', -0.2, 0], ['E 0.2', 0.2, 0]].forEach(function (m) {
      btn(g4, m[0], function () { act(function () { st.setup.c[0] += m[1]; st.setup.c[1] += m[2]; }); });
    });
    el.msg = H('p', { class: 'tsim-msg', 'aria-live': 'polite' }, side);
    el.next = H('div', { class: 'tsim-next' }, side);
    draw1();
  }
  function leg(k, s) {
    act(function () {
      st.setup.t[0] += 120 * s * U[k][0]; st.setup.t[1] += 120 * s * U[k][1];
      st.setup.c[0] += (1.5 + noiseR() * 2) * s * U[k][0]; st.setup.c[1] += (1.5 + noiseR() * 2) * s * U[k][1];
    });
  }
  function screw(k, s) {
    act(function () {
      st.setup.t[0] += 10 * s * U[k][0]; st.setup.t[1] += 10 * s * U[k][1];
      // tilting the instrument moves the plummet line on the ground (about 1.5 m × angle)
      st.setup.c[0] += 1500 * 10 * s * U[k][0] / 206265; st.setup.c[1] += 1500 * 10 * s * U[k][1] / 206265;
    });
  }
  function act(fn) {
    if (st.done[1]) { msg('The set-up is complete. Go on to stage 2.', 's'); return; }
    fn(); st.setup.moves++; save(); draw1();
  }
  function msg(t, kind) { if (!el.msg) return; el.msg.textContent = t; el.msg.className = 'tsim-msg' + (kind ? ' ' + kind : ''); }
  function draw1() {
    var c = st.setup.c, t = st.setup.t, cm = Math.hypot(c[0], c[1]), tm = Math.hypot(t[0], t[1]);
    // plummet: the mark appears at −c (plummet is the centre); 4 px per mm, view ±25 mm
    clear(el.plum);
    S('circle', { cx: 120, cy: 120, r: 110, fill: C.so, stroke: C.b }, el.plum);
    var k = 4, mx = 120 - c[0] * k, my = 120 + c[1] * k;
    S('rect', { x: Math.max(14, Math.min(226, mx)) - 9, y: Math.max(14, Math.min(226, my)) - 9, width: 18, height: 18, fill: C.f, opacity: 0.35 }, el.plum);
    if (Math.abs(mx - 120) < 110 && Math.abs(my - 120) < 110) {
      S('line', { x1: mx - 7, y1: my, x2: mx + 7, y2: my, stroke: C.t, 'stroke-width': 2 }, el.plum);
      S('line', { x1: mx, y1: my - 7, x2: mx, y2: my + 7, stroke: C.t, 'stroke-width': 2 }, el.plum);
    } else T(el.plum, 120, 228, 'mark out of view: move the tripod', { 'text-anchor': 'middle', fill: C.d, 'font-size': 11 });
    S('circle', { cx: 120, cy: 120, r: TOL.centre * k * 4, fill: 'none', stroke: C.p, 'stroke-width': 1.5 }, el.plum);
    S('circle', { cx: 120, cy: 120, r: TOL.centre * k, fill: 'none', stroke: C.p, 'stroke-width': 1 }, el.plum);
    T(el.plum, 120, 16, 'N', { 'text-anchor': 'middle', 'font-size': 11 });
    // bubble: ring = 60″; 0.25 px per second
    clear(el.bub);
    S('circle', { cx: 120, cy: 120, r: 100, fill: C.sh, stroke: C.m }, el.bub);
    S('circle', { cx: 120, cy: 120, r: 15, fill: 'none', stroke: C.t, 'stroke-width': 1.5 }, el.bub);
    var bx = t[0] * 0.25, by = -t[1] * 0.25, bm = Math.hypot(bx, by);
    if (bm > 88) { bx *= 88 / bm; by *= 88 / bm; }
    S('circle', { cx: 120 + bx, cy: 120 + by, r: 11, fill: C.sf, stroke: C.m, 'fill-opacity': 0.9 }, el.bub);
    [['A', 210], ['B', 330], ['C', 90]].forEach(function (q) {
      var x = 120 + 112 * Math.cos(q[1] * D2R), y = 120 - 112 * Math.sin(q[1] * D2R);
      S('circle', { cx: x, cy: y, r: 9, fill: C.p }, el.bub);
      T(el.bub, x, y + 4, q[0], { 'text-anchor': 'middle', fill: C.sf, 'font-size': 11, 'font-weight': 700 });
    });
    el.lcd1.innerHTML = 'Tilt N–S: ' + esc(dms(t[1] * SEC, true)) + '<br>Tilt E–W: ' + esc(dms(t[0] * SEC, true)) +
      '<br>Centring error: ' + cm.toFixed(1) + ' mm<br>Moves: ' + st.setup.moves +
      '<br>Compensator: ' + (tm <= 180 ? '<span class="ok">in range</span>' : '<span class="bad">out of range</span>');
    var ok = cm <= TOL.centre && tm <= TOL.tilt;
    if (ok && !st.done[1]) { st.done[1] = true; st.setupResult = { moves: st.setup.moves, centre: r3(cm), tilt: Math.round(tm) }; save(); }
    clear(el.next);
    if (st.done[1]) {
      msg('Set-up complete in ' + st.setupResult.moves + ' moves: centred to ' + st.setupResult.centre.toFixed(1) + ' mm and levelled to ' + st.setupResult.tilt + '″.', 's');
      H('div', { class: 'tsim-tape', html: '<b>Now measure the instrument height with the tape.</b> From the station mark to the trunnion-axis mark the tape reads <span class="big">HI = ' + site.hi.toFixed(3) + ' m</span>. Write it in your field book: you will need it in stage 2.' }, el.next);
      btn(el.next, 'Go to stage 2 →', function () { go(2); }, 'primary');
      go_steps();
    } else msg(cm > 25 ? 'Start with rough centring: move the tripod.' : tm > 180 ? 'Now rough-level with the tripod legs until the compensator is in range.' : 'Fine level with the foot screws and fine centre by sliding on the tripod head.');
  }
  function go_steps() { Array.prototype.forEach.call(el.steps.querySelectorAll('button'), function (b) { var k = +b.getAttribute('data-stage'); b.disabled = !unlocked(k); b.classList.toggle('done', !!st.done[k]); }); }

  // ---------- stages 2–4: the instrument ----------
  function stageAim(n) {
    var views = H('div', { class: 'tsim-views' }, el.body);
    var v1 = H('div', { class: 'tsim-pane plan' }, views);
    H('p', { class: 'tsim-lbl', text: 'Site plan (north up). Click the plan to point the telescope roughly.' }, v1);
    el.plan = S('svg', { viewBox: '0 0 420 360', role: 'img', 'aria-label': 'Site plan with the station, backsight and points' }, v1);
    el.plan.addEventListener('click', planClick);
    var v2 = H('div', { class: 'tsim-pane' }, views);
    H('p', { class: 'tsim-lbl', text: 'Eyepiece' }, v2);
    el.eye = S('svg', { viewBox: '0 0 220 238', role: 'img', 'aria-label': 'Telescope eyepiece view with crosshair' }, v2);
    el.lcd = H('div', { class: 'tsim-lcd', 'aria-live': 'polite' }, v2);
    el.radio = H('p', { class: 'tsim-radio' }, v2);

    var side = H('div', { class: 'tsim-side' }, el.body);
    el.proc = H('ol', { class: 'tsim-proc' }, side);
    var aim = H('div', { class: 'tsim-grp' }, side);
    H('span', { class: 'tsim-gt', text: 'Turn the telescope (or use the arrow keys; Shift = 5′)' }, aim);
    var rh = H('div', { class: 'tsim-pad five' }, aim);
    [['◀ 10°', -10], ['◀ 1°', -1], ['◀ 5′', -5 / 60], ['◀ 20″', -20 * SEC], ['◀ 5″', -5 * SEC], ['10° ▶', 10], ['1° ▶', 1], ['5′ ▶', 5 / 60], ['20″ ▶', 20 * SEC], ['5″ ▶', 5 * SEC]].forEach(function (m) {
      btn(rh, m[0], function () { turn(m[1], 0); }, 'sm', 'Turn ' + (m[1] < 0 ? 'left ' : 'right ') + m[0].replace(/[◀▶ ]/g, ''));
    });
    var rv = H('div', { class: 'tsim-pad four' }, aim);
    [['▲ 1°', -1], ['▲ 5′', -5 / 60], ['▲ 20″', -20 * SEC], ['▲ 5″', -5 * SEC], ['▼ 1°', 1], ['▼ 5′', 5 / 60], ['▼ 20″', 20 * SEC], ['▼ 5″', 5 * SEC]].forEach(function (m) {
      btn(rv, m[0], function () { turn(0, m[1]); }, 'sm', 'Telescope ' + (m[1] < 0 ? 'up ' : 'down ') + m[0].replace(/[▲▼ ]/g, ''));
    });
    el.ctl = H('div', { class: 'tsim-grp' }, side);
    el.msg = H('p', { class: 'tsim-msg', 'aria-live': 'polite' }, side);
    el.next = H('div', { class: 'tsim-next' }, side);
    if (n === 2) ctl2(); else if (n === 3) ctl3(); else ctl4();
    redraw();
  }
  function turn(dh, dv) {
    st.h = w360(st.h + dh); st.z = Math.max(60, Math.min(120, st.z + dv)); st.last = null;
    save(); redraw();
  }
  mount.addEventListener('keydown', function (e) {
    if (!st || st.stage === 1) return;
    if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    var s = e.shiftKey ? 5 / 60 : 20 * SEC, used = true;
    if (e.key === 'ArrowLeft') turn(-s, 0); else if (e.key === 'ArrowRight') turn(s, 0);
    else if (e.key === 'ArrowUp') turn(0, -s); else if (e.key === 'ArrowDown') turn(0, s); else used = false;
    if (used) e.preventDefault();
  });
  // plan scale: fit 60 m radius
  var PS = 3, PC = [210, 180];
  function fitPlan() {
    var mE = 10, mN = 10, o = site.stn, all = [site.bs].concat(site.pts, site.design);
    all.forEach(function (q) { mE = Math.max(mE, Math.abs(q.E - o.E)); mN = Math.max(mN, Math.abs(q.N - o.N)); });
    PS = Math.min(185 / mE, 150 / mN, 7);
  }
  function toPlan(E, N) { var o = site.stn; return [PC[0] + (E - o.E) * PS, PC[1] - (N - o.N) * PS]; }
  function planClick(e) {
    var pt = el.plan.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    var p = pt.matrixTransform(el.plan.getScreenCTM().inverse());
    var E = site.stn.E + (p.x - PC[0]) / PS, N = site.stn.N - (p.y - PC[1]) / PS;
    var o = inst(), b = brg(E - o.E, N - o.N);
    var near = null, nd = 4;
    targets().forEach(function (q) { var d = Math.hypot(q.E - E, q.N - N); if (d < nd) { nd = d; near = q; } });
    st.h = w360(b + (noiseR() - 0.5) * 0.5);
    st.z = near ? near.zen + (noiseR() - 0.5) * 0.4 : 90;
    st.last = null; save(); redraw();
    msg('Telescope pointed roughly. Now fine-turn until the target is on the crosshair.');
  }
  function HA() { return w360(st.h + st.off); }

  function drawPlan() {
    var g = el.plan; clear(g); fitPlan();
    for (var i = -12; i <= 12; i++) {
      S('line', { x1: PC[0] + i * 10 * PS, y1: 0, x2: PC[0] + i * 10 * PS, y2: 360, stroke: C.b, 'stroke-width': 0.6 }, g);
      S('line', { x1: 0, y1: PC[1] + i * 10 * PS, x2: 420, y2: PC[1] + i * 10 * PS, stroke: C.b, 'stroke-width': 0.6 }, g);
    }
    // road band
    var a = toPlan(site.rd[0].E, site.rd[0].N), b = toPlan(site.rd[1].E, site.rd[1].N);
    var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, nx = -uy, ny = ux, w = 7 * PS;
    var ext = 200;
    S('polygon', { points: [[a[0] - ux * ext, a[1] - uy * ext], [b[0] + ux * ext, b[1] + uy * ext], [b[0] + ux * ext + nx * w, b[1] + uy * ext + ny * w], [a[0] - ux * ext + nx * w, a[1] - uy * ext + ny * w]].map(function (q) { return q.join(','); }).join(' '), fill: C.so, stroke: C.f }, g);
    // building B1
    var b1 = site.pts.filter(function (p) { return p.code === 'BLD'; }).map(function (p) { return toPlan(p.E, p.N).join(','); }).join(' ');
    S('polygon', { points: b1, fill: C.ph, stroke: C.p }, g);
    // design building in stage 4
    if (st.stage === 4) {
      S('polygon', { points: site.design.map(function (p) { return toPlan(p.E, p.N).join(','); }).join(' '), fill: 'none', stroke: C.a, 'stroke-dasharray': '5 4', 'stroke-width': 1.5 }, g);
      var dc = site.design.reduce(function (a, p) { var q = toPlan(p.E, p.N); return [a[0] + q[0] / 4, a[1] + q[1] / 4]; }, [0, 0]);
      site.design.forEach(function (p) {
        var q = toPlan(p.E, p.N), vx = q[0] - dc[0], vy = q[1] - dc[1], vl = Math.hypot(vx, vy) || 1;
        T(g, q[0] + vx / vl * 11, q[1] + vy / vl * 11 + 4, p.id, { 'font-size': 12, fill: C.a, 'font-weight': 700, 'text-anchor': 'middle' });
        var peg = st.stake.pegs[p.id]; if (peg) { var pq = toPlan(peg.E, peg.N); S('rect', { x: pq[0] - 3, y: pq[1] - 3, width: 6, height: 6, fill: C.s }, g); }
      });
    }
    // points
    if (st.stage === 3) site.pts.forEach(function (p) {
      var q = toPlan(p.E, p.N), stored = st.detail.some(function (d) { return d.target === p.id; });
      if (p.code === 'TREE') S('circle', { cx: q[0], cy: q[1], r: 9, fill: C.sh, stroke: C.s }, g);
      if (p.code === 'MH') S('rect', { x: q[0] - 4, y: q[1] - 4, width: 8, height: 8, fill: 'none', stroke: C.t }, g);
      S('circle', { cx: q[0], cy: q[1], r: 3.5, fill: stored ? C.s : C.a }, g);
      T(g, q[0] + 6, q[1] - 5, p.id, { 'font-size': 12.5, fill: C.t });
    });
    if (st.stage === 4) { var pr = st.stake.prism[st.stake.sel]; if (pr) { var pq = toPlan(pr.E, pr.N); S('circle', { cx: pq[0], cy: pq[1], r: 4, fill: C.a, stroke: C.t }, g); } }
    // backsight and station
    var bq = toPlan(site.bs.E, site.bs.N);
    S('path', { d: 'M' + bq[0] + ' ' + (bq[1] - 8) + 'l7 12h-14z', fill: C.p }, g);
    T(g, bq[0] + 9, bq[1] + 4, site.bs.id + ' (BS)', { 'font-size': 13, fill: C.t, 'font-weight': 700 });
    var r = st.h * D2R;
    S('line', { x1: PC[0], y1: PC[1], x2: PC[0] + 230 * Math.sin(r), y2: PC[1] - 230 * Math.cos(r), stroke: C.d, 'stroke-width': 1.3, 'stroke-dasharray': '6 4' }, g);
    S('circle', { cx: PC[0], cy: PC[1], r: 6, fill: C.s, stroke: C.sf, 'stroke-width': 2 }, g);
    T(g, PC[0] + 9, PC[1] + 16, 'STN1', { 'font-size': 13, fill: C.t, 'font-weight': 700 });
    // north arrow and scale
    S('path', { d: 'M400 10 l6 14 h-12z', fill: C.m }, g); T(g, 400, 36, 'N', { 'text-anchor': 'middle', 'font-size': 11 });
    S('line', { x1: 14, y1: 348, x2: 14 + 10 * PS, y2: 348, stroke: C.t, 'stroke-width': 2 }, g);
    T(g, 14, 340, '10 m', { 'font-size': 10.5 });
  }
  function drawEye() {
    clear(el.eye);
    var defs = S('defs', {}, el.eye), cp = S('clipPath', { id: 'tsim-eye-clip' }, defs);
    S('circle', { cx: 110, cy: 110, r: 104 }, cp);
    S('circle', { cx: 110, cy: 110, r: 104, fill: C.so, stroke: C.m }, el.eye);
    var g = S('g', { 'clip-path': 'url(#tsim-eye-clip)' }, el.eye);
    var k = 104 / 0.5;
    inView().forEach(function (q) {
      var x = 110 + dang(q.b - st.h) * k, y = 110 + (q.zen - st.z) * k;
      var poleLen = Math.atan2(q.HT, q.HD) / D2R * k;
      S('line', { x1: x, y1: y, x2: x, y2: y + poleLen, stroke: C.m, 'stroke-width': 3 }, g);
      S('circle', { cx: x, cy: y, r: 7, fill: q.kind === 'bs' ? C.p : C.a, stroke: C.t }, g);
      T(g, x + 10, y - 8, q.id, { 'font-size': 11, fill: C.t, 'font-weight': 700 });
    });
    S('line', { x1: 6, y1: 110, x2: 214, y2: 110, stroke: C.d, 'stroke-width': 0.8 }, g);
    S('line', { x1: 110, y1: 6, x2: 110, y2: 214, stroke: C.d, 'stroke-width': 0.8 }, g);
    S('line', { x1: 96, y1: 100, x2: 96, y2: 120, stroke: C.d, 'stroke-width': 0.8 }, g);
    S('line', { x1: 124, y1: 100, x2: 124, y2: 120, stroke: C.d, 'stroke-width': 0.8 }, g);
    var a = aimed();
    T(el.eye, 110, 232, a ? 'on target: ' + a.id : 'not on a target', { 'text-anchor': 'middle', 'font-size': 12, fill: a ? C.s : C.f, 'font-weight': 700 });
  }
  function lcd(extra) {
    var s = 'STN ' + site.stn.id + '  HI ' + (st.hiTyped ? (+st.hiTyped).toFixed(3) : '-.---') + '  ' + (st.oriented ? 'ORI ✓' : 'ORI ✗') +
      '<br>HA  ' + dms(HA()) + '<br>V   ' + dms(st.z);
    if (st.last && st.last.SD) s += '<br>SD  ' + f3(st.last.SD) + '  HD ' + f3(st.last.HD) + '<br>VD  ' + (st.last.VD >= 0 ? '+' : '') + f3(st.last.VD);
    if (extra) s += '<br>' + extra;
    el.lcd.innerHTML = s;
  }
  function radio() {
    var msgs = [];
    inView().forEach(function (q) {
      if (q.ref && q.ref.code === 'TREE') msgs.push('Rod person at ' + q.id + ': “I have raised the pole to 2.500 m to clear the hedge.”');
    });
    if (st.stage === 3 && !msgs.length) msgs.push('Rod person: “Pole height is 1.800 m.”');
    if (st.stage === 2) msgs.push('Rod person at ' + site.bs.id + ': “Prism on the pole, height 1.800 m.”');
    el.radio.textContent = msgs.join(' ');
  }
  function redraw() { drawPlan(); drawEye(); radio(); if (st.stage === 2) upd2(); else if (st.stage === 3) upd3(); else upd4(); }

  function measure(q, htUsed) {
    var o = inst();
    var SD = q.SD + gauss() * (0.002 + 2e-6 * q.SD);
    var ha = w360(HA() + gauss() * 2 * SEC), z = st.z + gauss() * 2 * SEC;
    var HD = SD * Math.sin(z * D2R), VD = SD * Math.cos(z * D2R), hi = +st.hiTyped;
    return {
      target: q.id, SD: SD, HA: ha, Z: z, HD: HD, VD: VD, HT: htUsed,
      E: site.stn.E + HD * Math.sin(ha * D2R), N: site.stn.N + HD * Math.cos(ha * D2R), RL: site.stn.RL + hi + VD - htUsed
    };
  }
  function htBox(p) {
    var l = H('label', { class: 'tsim-in' }, p); H('span', { text: 'Target height HT (m)' }, l);
    var i = H('input', { type: 'number', step: '0.001', min: '0', max: '5', value: st.ht }, l);
    i.addEventListener('input', function () { var v = parseFloat(i.value); if (v >= 0 && v <= 5) { st.ht = v; save(); } });
    return i;
  }

  // ---- stage 2 ----
  function ctl2() {
    el.proc.innerHTML =
      '<li><b>Station:</b> the instrument is over <b>STN1</b>. Its coordinates come from the control list below.</li>' +
      '<li><b>Instrument height:</b> type the HI you measured with the tape in stage 1.</li>' +
      '<li><b>Backsight:</b> the instrument computes the bearing to <b>' + site.bs.id + '</b> from the coordinates. Aim exactly at the ' + site.bs.id + ' prism and press <b>Set orientation</b>.</li>' +
      '<li><b>Check:</b> measure the backsight. The measured distance must agree within 10 mm and the height within 20 mm. If not, look for a wrong HI, wrong HT or careless aiming.</li>';
    var c = el.ctl;
    H('span', { class: 'tsim-gt', text: 'Station setup' }, c);
    var tb = H('table', { class: 'tsim-ctrl-list' }, c);
    tb.innerHTML = '<tr><th>Point</th><th>E (m)</th><th>N (m)</th><th>RL (m)</th></tr>' +
      '<tr><td>STN1</td><td>' + f3(site.stn.E) + '</td><td>' + f3(site.stn.N) + '</td><td>' + f3(site.stn.RL) + '</td></tr>' +
      '<tr><td>' + site.bs.id + '</td><td>' + f3(site.bs.E) + '</td><td>' + f3(site.bs.N) + '</td><td>' + f3(site.bs.RL) + '</td></tr>';
    var row = H('div', { class: 'tsim-row' }, c);
    var l = H('label', { class: 'tsim-in' }, row); H('span', { text: 'HI (m)' }, l);
    el.hi = H('input', { type: 'number', step: '0.001', min: '0.5', max: '2.5', value: st.hiTyped, placeholder: '1.500' }, l);
    el.hi.addEventListener('input', function () { st.hiTyped = el.hi.value; st.oriented = false; st.bsCheck = null; save(); redraw(); });
    el.ht = htBox(row);
    var b = bsBrg();
    H('p', { class: 'tsim-note', html: 'Backsight bearing STN1 → ' + site.bs.id + ' (from coordinates): <b>' + dms(b.b) + '</b>, horizontal distance <b>' + f3(b.d) + ' m</b>.' }, c);
    var r2 = H('div', { class: 'tsim-row' }, c);
    btn(r2, 'Set orientation', setOri, 'primary');
    btn(r2, 'MEAS (backsight check)', bsCheck);
  }
  function bsBrg() { var dE = site.bs.E - site.stn.E, dN = site.bs.N - site.stn.N; return { b: brg(dE, dN), d: Math.hypot(dE, dN) }; }
  function hiOK() { var v = parseFloat(st.hiTyped); return v >= 0.5 && v <= 2.5; }
  function setOri() {
    if (!hiOK()) { msg('Type the instrument height HI first (it was shown after stage 1).', 'e'); return; }
    var a = aimed();
    if (!a || a.kind !== 'bs') { msg('Aim exactly at the ' + site.bs.id + ' prism first: within 10″ horizontally and 20″ vertically.', 'e'); return; }
    st.off = bsBrg().b - st.h; st.oriented = true; st.bsCheck = null; save(); redraw();
    msg('Orientation set: HA now reads the true bearing. Now measure the backsight as a check.', 's');
  }
  function bsCheck() {
    if (!st.oriented) { msg('Set the orientation first.', 'e'); return; }
    var a = aimed();
    if (!a || a.kind !== 'bs') { msg('Aim at the ' + site.bs.id + ' prism to measure it.', 'e'); return; }
    var m = measure(a, st.ht); st.last = m;
    var dHD = m.HD - bsBrg().d, dRL = m.RL - (site.bs.RL + 0);
    // the pillar RL is the ground mark; the prism pole stands on it
    dRL = m.RL - site.bs.RL;
    var ok = Math.abs(dHD) <= TOL.bsHD && Math.abs(dRL) <= TOL.bsRL;
    st.bsCheck = { dHD: dHD, dRL: dRL, ok: ok, hi: +st.hiTyped, ht: st.ht };
    if (ok) { st.done[2] = true; st.oriResult = { dHD: r3(dHD), dRL: r3(dRL), hi: +st.hiTyped }; }
    save(); redraw();
  }
  function upd2() {
    lcd(st.bsCheck ? 'BS check  dHD ' + mm(st.bsCheck.dHD) + ' mm  dRL ' + mm(st.bsCheck.dRL) + ' mm' : '');
    clear(el.next);
    if (st.bsCheck) {
      if (st.bsCheck.ok) {
        msg('Backsight check passed: distance differs by ' + mm(st.bsCheck.dHD) + ' mm and height by ' + mm(st.bsCheck.dRL) + ' mm. The station is ready.', 's');
        btn(el.next, 'Go to stage 3 →', function () { go(3); }, 'primary'); go_steps();
      } else {
        var why = Math.abs(st.bsCheck.dRL) > TOL.bsRL ? ' The height is wrong: check HI (tape reading from stage 1) and HT (1.800 m).' : ' The distance is wrong: check that you aimed at the right prism.';
        msg('Backsight check failed: distance ' + mm(st.bsCheck.dHD) + ' mm, height ' + mm(st.bsCheck.dRL) + ' mm.' + why, 'e');
      }
    }
  }

  // ---- stage 3 ----
  function ctl3() {
    el.proc.innerHTML =
      '<li>Pick up all <b>' + site.pts.length + '</b> detail points: the four corners of building B1, the tree, the lamp post, the manhole and two road-edge points.</li>' +
      '<li>For each: aim at the prism, check the target height HT (listen to the rod person), press <b>MEAS</b>, choose the right <b>code</b>, then <b>Store</b>.</li>' +
      '<li>Codes: BLD building corner · TREE · POLE lamp post · MH manhole · RD road edge.</li>' +
      '<li>When all are stored, press <b>Check my survey</b>, then download the CSV and plot it in QGIS.</li>';
    var c = el.ctl;
    H('span', { class: 'tsim-gt', text: 'Measure and store' }, c);
    var row = H('div', { class: 'tsim-row' }, c);
    el.ht = htBox(row);
    var l = H('label', { class: 'tsim-in' }, row); H('span', { text: 'Code' }, l);
    el.code = H('select', {}, l);
    H('option', { value: '', text: 'choose…' }, el.code);
    CODES.forEach(function (k) { H('option', { value: k, text: k }, el.code); });
    var r2 = H('div', { class: 'tsim-row' }, c);
    btn(r2, 'MEAS', meas3, 'primary');
    el.store = btn(r2, 'Store as point ' + st.nextPt, store3);
    var r3b = H('div', { class: 'tsim-row' }, c);
    btn(r3b, 'Check my survey', check3);
    btn(r3b, 'Download CSV for QGIS', csv3);
  }
  function meas3() {
    var a = aimed();
    if (!a) { msg('No prism on the crosshair. Aim within 10″ horizontally and 20″ vertically.', 'e'); return; }
    if (a.kind === 'bs') { msg('That is the backsight ' + a.id + '. Measure the detail points.', 'w'); return; }
    if (!(st.ht >= 0 && st.ht <= 5)) { msg('Enter the target height HT in metres.', 'e'); return; }
    st.last = measure(a, st.ht); save(); redraw();
    msg('Measured. Choose the code for this point and press Store.');
  }
  function store3() {
    if (!st.last || !st.last.SD) { msg('Press MEAS first.', 'e'); return; }
    if (!el.code.value) { msg('Choose a code before storing.', 'e'); return; }
    var m = st.last, prev = st.detail.findIndex(function (d) { return d.target === m.target; });
    var rec = { pt: prev >= 0 ? st.detail[prev].pt : st.nextPt, code: el.code.value, target: m.target, HA: m.HA, Z: m.Z, SD: m.SD, HT: m.HT, E: m.E, N: m.N, RL: m.RL };
    if (prev >= 0) st.detail[prev] = rec; else { st.detail.push(rec); st.nextPt++; }
    st.last = null; st.checked3 = false; el.code.value = ''; save(); redraw();
    msg('Stored point ' + rec.pt + (prev >= 0 ? ' (re-measured, old reading replaced)' : '') + '. ' + (st.detail.length < site.pts.length ? (site.pts.length - st.detail.length) + ' to go.' : 'All points stored: press Check my survey.'), 's');
  }
  function err3(d) {
    var p = site.pts.filter(function (q) { return q.id === d.target; })[0];
    return { plan: Math.hypot(d.E - p.E, d.N - p.N), ht: d.RL - p.RL, code: d.code === p.code, p: p };
  }
  function check3() {
    if (st.detail.length < site.pts.length) { msg('Store all ' + site.pts.length + ' points first (' + st.detail.length + ' stored).', 'e'); return; }
    st.checked3 = true;
    var bad = st.detail.filter(function (d) { var e = err3(d); return e.plan > TOL.detail || Math.abs(e.ht) > TOL.detail || !e.code; });
    if (!bad.length) { st.done[3] = true; st.detailResult = { n: st.detail.length }; }
    save(); redraw();
    if (bad.length) msg(bad.length + ' point(s) not acceptable (red). Look at the error column: a height error means a wrong HT; a plan error means careless aiming; a wrong code must be re-stored. Re-measure those points.', 'e');
    else { msg('All ' + st.detail.length + ' points are within 15 mm and correctly coded. Well done.', 's'); }
  }
  function csv3() {
    if (!st.detail.length) { msg('Store some points first.', 'e'); return; }
    var lines = ['Point,Easting,Northing,RL,Code'];
    st.detail.slice().sort(function (a, b) { return a.pt - b.pt; }).forEach(function (d) { lines.push([d.pt, f3(d.E), f3(d.N), f3(d.RL), d.code].join(',')); });
    var blob = new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/csv' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'detail_survey_' + st.roll + '.csv';
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function upd3() {
    var extra = '';
    if (st.last && st.last.SD) extra = 'E ' + f3(st.last.E) + '  N ' + f3(st.last.N) + '  RL ' + f3(st.last.RL);
    lcd(extra);
    el.store.textContent = 'Store as point ' + (st.last ? (function () { var p = st.detail.filter(function (d) { return d.target === st.last.target; })[0]; return p ? p.pt : st.nextPt; })() : st.nextPt);
    bookTable3();
    clear(el.next);
    if (st.done[3]) { btn(el.next, 'Go to stage 4 →', function () { go(4); }, 'primary'); go_steps(); }
  }
  function bookTable3() {
    clear(el.book);
    H('h3', { text: 'Field book: detail survey from STN1 (HI ' + (st.hiTyped ? (+st.hiTyped).toFixed(3) : '?') + ' m)' }, el.book);
    var wrap = H('div', { class: 'tsim-tablewrap' }, el.book);
    var t = H('table', { class: 'data-table tsim-fb' }, wrap);
    var head = '<thead><tr><th>Pt</th><th>Code</th><th>HA</th><th>V</th><th>SD (m)</th><th>HT (m)</th><th>E (m)</th><th>N (m)</th><th>RL (m)</th>' + (st.checked3 ? '<th>Error plan / height</th>' : '') + '</tr></thead>';
    var rows = st.detail.slice().sort(function (a, b) { return a.pt - b.pt; }).map(function (d) {
      var e = st.checked3 ? err3(d) : null, cell = '';
      if (e) { var ok = e.plan <= TOL.detail && Math.abs(e.ht) <= TOL.detail && e.code; cell = '<td class="' + (ok ? 'ok' : 'bad') + '">' + mm(e.plan) + ' / ' + mm(e.ht) + ' mm' + (e.code ? '' : ' · code should be ' + e.p.code) + '</td>'; }
      return '<tr><td>' + d.pt + '</td><td>' + d.code + '</td><td>' + dms(d.HA) + '</td><td>' + dms(d.Z) + '</td><td>' + f3(d.SD) + '</td><td>' + f3(d.HT) + '</td><td>' + f3(d.E) + '</td><td>' + f3(d.N) + '</td><td>' + f3(d.RL) + '</td>' + cell + '</tr>';
    }).join('');
    t.innerHTML = head + '<tbody>' + (rows || '<tr><td colspan="9">No points stored yet.</td></tr>') + '</tbody>';
  }

  // ---- stage 4 ----
  function ctl4() {
    el.proc.innerHTML =
      '<li>Choose a design corner (D1–D4) of the new building. The instrument shows the bearing to turn to and the distance.</li>' +
      '<li>Turn the telescope until <b>dHA</b> is about zero. The rod person is standing roughly near the point.</li>' +
      '<li>Press <b>MEAS</b> (with the prism in view the instrument fine-aims itself, like ATR). Read the instruction, then move the rod person with the buttons. Measure again.</li>' +
      '<li>When both offsets are within 10 mm, press <b>Drive peg</b>. Do all four corners, then <b>Check pegs</b> (diagonals too).</li>';
    var c = el.ctl;
    H('span', { class: 'tsim-gt', text: 'Stake out' }, c);
    var tb = H('table', { class: 'tsim-ctrl-list' }, c);
    tb.innerHTML = '<tr><th></th><th>Point</th><th>E (m)</th><th>N (m)</th></tr>' + site.design.map(function (p) {
      return '<tr><td><input type="radio" name="tsim-d" value="' + p.id + '"' + (st.stake.sel === p.id ? ' checked' : '') + ' aria-label="Stake ' + p.id + '"></td><td>' + p.id + '</td><td>' + f3(p.E) + '</td><td>' + f3(p.N) + '</td></tr>';
    }).join('');
    Array.prototype.forEach.call(tb.querySelectorAll('input'), function (i) {
      i.addEventListener('change', function () { st.stake.sel = i.value; st.stake.last = null; ensurePrism(); save(); redraw(); });
    });
    el.stakeInfo = H('p', { class: 'tsim-note' }, c);
    var r1 = H('div', { class: 'tsim-row' }, c);
    btn(r1, 'MEAS', meas4, 'primary');
    el.peg = btn(r1, 'Drive peg', peg4);
    btn(r1, 'Check pegs', check4);
    H('span', { class: 'tsim-gt', text: 'Tell the rod person to move (as seen from the instrument)' }, c);
    var r2 = H('div', { class: 'tsim-pad three' }, c);
    [['← 1 m', -1, 0], ['← 0.1', -0.1, 0], ['← 0.01', -0.01, 0], ['1 m →', 1, 0], ['0.1 →', 0.1, 0], ['0.01 →', 0.01, 0]].forEach(function (m) { btn(r2, m[0], function () { move4(m[1], m[2]); }, 'sm', 'Move rod ' + (m[1] < 0 ? 'left ' : 'right ') + Math.abs(m[1]) + ' m'); });
    var r3 = H('div', { class: 'tsim-pad three' }, c);
    [['Toward 1 m', 0, -1], ['Toward 0.1', 0, -0.1], ['Toward 0.01', 0, -0.01], ['Away 1 m', 0, 1], ['Away 0.1', 0, 0.1], ['Away 0.01', 0, 0.01]].forEach(function (m) { btn(r3, m[0], function () { move4(m[1], m[2]); }, 'sm'); });
    ensurePrism();
  }
  function des(id) { return site.design.filter(function (p) { return p.id === id; })[0]; }
  function ensurePrism() {
    var id = st.stake.sel; if (st.stake.prism[id]) return;
    var d = des(id), a = noiseR() * 360, m = 0.6 + noiseR() * 1.2;
    st.stake.prism[id] = { E: d.E + m * Math.sin(a * D2R), N: d.N + m * Math.cos(a * D2R) };
  }
  function lineFrame() { var d = des(st.stake.sel), dE = d.E - site.stn.E, dN = d.N - site.stn.N, L = Math.hypot(dE, dN); return { b: brg(dE, dN), HD: L, u: [dE / L, dN / L], r: [dN / L, -dE / L] }; }
  function move4(lr, ta) {
    var f = lineFrame(), p = st.stake.prism[st.stake.sel];
    p.E += f.r[0] * lr + f.u[0] * ta; p.N += f.r[1] * lr + f.u[1] * ta;
    st.stake.last = null; save(); redraw();
    msg('Rod person moved. Measure again.');
  }
  function meas4() {
    var q = inView().filter(function (x) { return x.kind === 'prism'; })[0];
    if (!q) { msg('The prism is not in the telescope view. Turn until dHA is near zero and look for the prism.', 'e'); return; }
    st.h = q.b; st.z = q.zen; // fine aim (ATR)
    var m = measure(q, 1.8), f = lineFrame();
    var dHA = dang(m.HA - f.b) * D2R;
    var lat = m.HD * Math.sin(dHA), along = m.HD * Math.cos(dHA) - f.HD;
    st.stake.last = { lat: lat, along: along, E: m.E, N: m.N };
    st.last = m; save(); redraw();
  }
  function peg4() {
    var L = st.stake.last;
    if (!L) { msg('Measure the prism first (after every move).', 'e'); return; }
    if (Math.abs(L.lat) > TOL.stake || Math.abs(L.along) > TOL.stake) { msg('Not yet: both offsets must be within 10 mm.', 'e'); return; }
    var p = st.stake.prism[st.stake.sel];
    st.stake.pegs[st.stake.sel] = { E: p.E, N: p.N };
    var nextD = site.design.filter(function (d) { return !st.stake.pegs[d.id]; })[0];
    msg('Peg driven at ' + st.stake.sel + '.' + (nextD ? ' Next: ' + nextD.id + '.' : ' All four pegs are in: press Check pegs.'), 's');
    if (nextD) { st.stake.sel = nextD.id; st.stake.last = null; ensurePrism(); }
    st.checked4 = false; save(); clear(el.body); stageAim(4);
  }
  function diag() {
    var P = st.stake.pegs, Dd = function (a, b) { return Math.hypot(a.E - b.E, a.N - b.N); };
    var s = site.design;
    return [['D1–D3', Dd(P.D1, P.D3), Dd(s[0], s[2])], ['D2–D4', Dd(P.D2, P.D4), Dd(s[1], s[3])]];
  }
  function check4() {
    var missing = site.design.filter(function (d) { return !st.stake.pegs[d.id]; });
    if (missing.length) { msg('Drive all four pegs first (' + missing.map(function (d) { return d.id; }).join(', ') + ' left).', 'e'); return; }
    st.checked4 = true;
    var bad = site.design.filter(function (d) { var p = st.stake.pegs[d.id]; return Math.hypot(p.E - d.E, p.N - d.N) > TOL.peg; });
    var dg = diag(), dbad = dg.some(function (x) { return Math.abs(x[1] - x[2]) > 0.02; });
    if (!bad.length && !dbad) { st.done[4] = true; st.finished = new Date().toISOString(); }
    save(); redraw();
    msg(st.done[4] ? 'All four pegs are within 15 mm and both diagonals agree. Practical complete: print your lab record.' : 'Some pegs are out of tolerance (red). Select that corner, measure and adjust again.', st.done[4] ? 's' : 'e');
  }
  function upd4() {
    var f = lineFrame(), L = st.stake.last;
    lcd('dHA ' + dms(dang(HA() - f.b), true) + '  HD to point ' + f3(f.HD) + (L ? '<br>' + instr(L) : ''));
    el.stakeInfo.innerHTML = 'Staking <b>' + st.stake.sel + '</b>: turn to HA <b>' + dms(f.b) + '</b>, distance <b>' + f3(f.HD) + ' m</b>.';
    el.peg.disabled = !(L && Math.abs(L.lat) <= TOL.stake && Math.abs(L.along) <= TOL.stake);
    clear(el.book);
    H('h3', { text: 'Setting-out record' }, el.book);
    var wrap = H('div', { class: 'tsim-tablewrap' }, el.book);
    var t = H('table', { class: 'data-table tsim-fb' }, wrap);
    t.innerHTML = '<thead><tr><th>Point</th><th>Design E</th><th>Design N</th><th>Peg</th>' + (st.checked4 ? '<th>Peg error</th>' : '') + '</tr></thead><tbody>' + site.design.map(function (d) {
      var p = st.stake.pegs[d.id], e = p ? Math.hypot(p.E - d.E, p.N - d.N) : null;
      return '<tr><td>' + d.id + '</td><td>' + f3(d.E) + '</td><td>' + f3(d.N) + '</td><td>' + (p ? 'driven' : '–') + '</td>' + (st.checked4 ? '<td class="' + (e !== null && e <= TOL.peg ? 'ok' : 'bad') + '">' + (e !== null ? (e * 1000).toFixed(0) + ' mm' : '–') + '</td>' : '') + '</tr>';
    }).join('') + '</tbody>';
    if (st.checked4) {
      var dg = diag();
      H('p', { class: 'tsim-note', html: 'Diagonal check (tape between pegs): ' + dg.map(function (x) { var dd = (x[1] - x[2]) * 1000; return x[0] + ' ' + f3(x[1]) + ' m (design ' + f3(x[2]) + ', <span class="' + (Math.abs(dd) <= 20 ? 'ok' : 'bad') + '">' + mm(dd / 1000) + ' mm</span>)'; }).join(' · ') }, el.book);
    }
  }
  function instr(L) {
    var lr = L.lat > 0 ? 'move LEFT ' + f3(Math.abs(L.lat)) : 'move RIGHT ' + f3(Math.abs(L.lat));
    var ta = L.along > 0 ? 'TOWARD instrument ' + f3(Math.abs(L.along)) : 'AWAY ' + f3(Math.abs(L.along));
    var ok = Math.abs(L.lat) <= TOL.stake && Math.abs(L.along) <= TOL.stake;
    return ok ? '<span class="ok">ON POINT: drive the peg</span>' : lr + ' m · ' + ta + ' m';
  }

  // ---------- lab record ----------
  function printRecord() {
    if (!st) { el.whoErr.textContent = 'Start your practical first.'; return; }
    var w = window.open('', '_blank');
    if (!w) { msg('Allow pop-ups for this site to print the record.', 'e'); return; }
    var d3 = st.detail.slice().sort(function (a, b) { return a.pt - b.pt; }).map(function (d) {
      var e = err3(d);
      return '<tr><td>' + d.pt + '</td><td>' + d.code + '</td><td>' + dms(d.HA) + '</td><td>' + dms(d.Z) + '</td><td>' + f3(d.SD) + '</td><td>' + f3(d.HT) + '</td><td>' + f3(d.E) + '</td><td>' + f3(d.N) + '</td><td>' + f3(d.RL) + '</td><td>' + mm(e.plan) + ' / ' + mm(e.ht) + '</td></tr>';
    }).join('');
    var d4 = site.design.map(function (d) { var p = st.stake.pegs[d.id]; return '<tr><td>' + d.id + '</td><td>' + f3(d.E) + '</td><td>' + f3(d.N) + '</td><td>' + (p ? (Math.hypot(p.E - d.E, p.N - d.N) * 1000).toFixed(0) + ' mm' : 'not done') + '</td></tr>'; }).join('');
    var stg = function (k) { return st.done[k] ? 'Completed' : 'Not completed'; };
    var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Lab record ' + esc(st.roll) + '</title><style>body{font:13px/1.5 Arial,sans-serif;margin:24px;color:#111}h1{font-size:18px;margin:0}h2{font-size:14px;margin:18px 0 6px}table{border-collapse:collapse;width:100%;margin:6px 0}td,th{border:1px solid #999;padding:4px 6px;text-align:left}th{background:#eee}.sig{margin-top:40px;display:flex;justify-content:space-between}</style></head><body>' +
      '<h1>Virtual Lab: Total Station Practical</h1><p>BTCVE802T Digital Land Surveying and Mapping · Department of Civil Engineering, KITS Ramtek</p>' +
      '<table><tr><th>Name</th><td>' + esc(st.name || '') + '</td><th>Roll number</th><td>' + esc(st.roll) + '</td></tr><tr><th>Started</th><td>' + esc(new Date(st.started).toLocaleString()) + '</td><th>Printed</th><td>' + esc(new Date().toLocaleString()) + '</td></tr></table>' +
      '<h2>1. Set up (centring and levelling): ' + stg(1) + '</h2>' + (st.setupResult ? '<p>Moves: ' + st.setupResult.moves + '; centring error ' + st.setupResult.centre.toFixed(1) + ' mm; tilt ' + st.setupResult.tilt + '″. HI measured: ' + site.hi.toFixed(3) + ' m.</p>' : '') +
      '<h2>2. Station setup and orientation: ' + stg(2) + '</h2>' + (st.oriResult ? '<p>Station STN1 (E ' + f3(site.stn.E) + ', N ' + f3(site.stn.N) + ', RL ' + f3(site.stn.RL) + '), backsight ' + site.bs.id + '. HI entered ' + st.oriResult.hi.toFixed(3) + ' m. Backsight check: ΔHD ' + mm(st.oriResult.dHD) + ' mm, ΔRL ' + mm(st.oriResult.dRL) + ' mm.</p>' : '') +
      '<h2>3. Detail survey: ' + stg(3) + '</h2><table><tr><th>Pt</th><th>Code</th><th>HA</th><th>V</th><th>SD</th><th>HT</th><th>E</th><th>N</th><th>RL</th><th>Error plan/height (mm)</th></tr>' + (d3 || '<tr><td colspan="10">No points</td></tr>') + '</table>' +
      '<h2>4. Setting out: ' + stg(4) + '</h2><table><tr><th>Point</th><th>Design E</th><th>Design N</th><th>Peg error</th></tr>' + d4 + '</table>' +
      '<div class="sig"><span>Student signature</span><span>Teacher signature</span></div>' +
      '<script>window.onload=function(){window.print()}<\/script></body></html>';
    w.document.open(); w.document.write(html); w.document.close();
  }

  // test hook for automated checks (not used by the page)
  window.DLSM_tsim = { makeSite: makeSite, state: function () { return st; }, site: function () { return site; }, targets: function () { return targets(); }, redraw: function () { redraw(); }, go: go };

  skeleton();
  // resume the last roll used on this device
  try { var lastRoll = localStorage.getItem(KEY + 'last'); if (lastRoll) { el.roll.value = lastRoll; } } catch (e) { /* ignore */ }
  var _save = save;
  save = function () { _save(); try { localStorage.setItem(KEY + 'last', st.roll); } catch (e) { /* ignore */ } };
})();
