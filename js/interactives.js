// ===== Interactive concept visuals =====
// Each visual is a <figure data-ia="name"> with an empty .ia-mount inside.
// Plain SVG + DOM, no libraries. Motion is skipped when the reader has
// "reduce motion" turned on: the final picture is drawn straight away.
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var REDUCE = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var C = {
    p: 'var(--color-primary)', ph: 'var(--color-primary-highlight)',
    a: 'var(--color-amber)', ah: 'var(--color-amber-highlight)',
    d: 'var(--color-danger)', dh: 'var(--color-danger-highlight)',
    s: 'var(--color-success)', sh: 'var(--color-success-highlight)',
    t: 'var(--color-text)', m: 'var(--color-text-muted)', f: 'var(--color-text-faint)',
    b: 'var(--color-border)', so: 'var(--color-surface-offset)', sf: 'var(--color-surface)'
  };

  // ---------- helpers ----------
  function S(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function H(tag, attrs, parent) {
    var e = document.createElement(tag);
    for (var k in attrs) { if (k === 'text') e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); }
    if (parent) parent.appendChild(e);
    return e;
  }
  function T(parent, x, y, s, attrs) {
    attrs = attrs || {};
    attrs.x = x; attrs.y = y;
    if (!attrs['font-size']) attrs['font-size'] = 12;
    if (!attrs.fill) attrs.fill = C.m;
    if (attrs.halo) { delete attrs.halo; attrs.stroke = C.sf; attrs['stroke-width'] = 4; attrs['paint-order'] = 'stroke'; attrs['stroke-linejoin'] = 'round'; }
    var t = S('text', attrs, parent);
    t.textContent = s;
    return t;
  }
  function clear(g) { while (g.firstChild) g.removeChild(g.firstChild); }
  function makeSvg(mount, w, h, label) { return S('svg', { viewBox: '0 0 ' + w + ' ' + h, role: 'img', 'aria-label': label }, mount); }
  function controls(mount) { return H('div', { class: 'ia-controls' }, mount); }
  function slider(box, label, min, max, step, val, fmt, on) {
    var l = H('label', {}, box);
    H('span', { text: label }, l);
    var i = H('input', { type: 'range', min: min, max: max, step: step, value: val }, l);
    var o = H('output', {}, l);
    function u() { o.textContent = fmt(+i.value); on(+i.value); }
    i.addEventListener('input', u);
    o.textContent = fmt(+i.value);
    return i;
  }
  function button(box, label, on) {
    var b = H('button', { type: 'button', class: 'ia-btn', text: label }, box);
    b.addEventListener('click', on);
    return b;
  }
  function check(box, label, on) {
    var l = H('label', {}, box);
    var i = H('input', { type: 'checkbox' }, l);
    H('span', { text: label }, l);
    i.addEventListener('change', function () { on(i.checked); });
    return i;
  }
  function readout(mount, items) {
    var g = H('div', { class: 'ia-readout' }, mount), o = {};
    items.forEach(function (it) {
      var d = H('div', {}, g);
      H('span', { text: it[1] }, d);
      o[it[0]] = H('b', {}, d);
    });
    return o;
  }
  function status(mount) { return H('p', { class: 'ia-status', 'aria-live': 'polite' }, mount); }
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function gauss(r) { var u = r() || 1e-9, v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  // Runs step(k) for k from 0 to 1; a newer run on the same owner cancels the older one.
  function animate(owner, dur, step, done) {
    owner._run = (owner._run || 0) + 1;
    var id = owner._run;
    if (REDUCE) { step(1); if (done) done(); return; }
    var t0 = null;
    function f(ts) {
      if (id !== owner._run) return;
      if (t0 === null) t0 = ts;
      var k = Math.min(1, (ts - t0) / dur);
      step(k);
      if (k < 1) requestAnimationFrame(f); else if (done) done();
    }
    requestAnimationFrame(f);
  }
  function arrowDefs(svg, id, colour) {
    var defs = S('defs', {}, svg);
    var m = S('marker', { id: id, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, defs);
    S('path', { d: 'M0 0L10 5L0 10z', fill: colour }, m);
  }
  function f1(x) { return x.toFixed(1); }
  function dms(deg) {
    var sign = deg < 0 ? '−' : '';
    deg = Math.abs(deg);
    var d = Math.floor(deg), mf = (deg - d) * 60, m = Math.floor(mf), s = Math.round((mf - m) * 60);
    if (s === 60) { s = 0; m += 1; }
    if (m === 60) { m = 0; d += 1; }
    return sign + d + '° ' + String(m).padStart(2, '0') + '′ ' + String(s).padStart(2, '0') + '″';
  }

  var builders = {};

  // ============ CO1: whole to part ============
  builders['whole-to-part'] = function (mount) {
    var svg = makeSvg(mount, 600, 300, 'Detail points measured from control points compared with points measured one after another');
    var g = S('g', {}, svg);
    var ctrl = [[60, 262], [70, 40], [530, 34], [545, 258]];
    var r = rng(11), pts = [];
    for (var i = 0; i < 14; i++) pts.push([120 + r() * 360, 80 + r() * 150]);
    // order for the chain: nearest neighbour starting from control point 1
    var order = [], used = {}, cur = ctrl[0];
    for (var n = 0; n < pts.length; n++) {
      var best = -1, bd = 1e9;
      for (var j = 0; j < pts.length; j++) if (!used[j]) {
        var dd = Math.hypot(pts[j][0] - cur[0], pts[j][1] - cur[1]);
        if (dd < bd) { bd = dd; best = j; }
      }
      used[best] = true; order.push(best); cur = pts[best];
    }
    var re = rng(5), errCtrl = [], step = [];
    for (i = 0; i < pts.length; i++) { errCtrl.push([gauss(re), gauss(re)]); step.push([gauss(re), gauss(re)]); }
    var errChain = new Array(pts.length), acc = [0, 0];
    order.forEach(function (idx) { acc = [acc[0] + step[idx][0], acc[1] + step[idx][1]]; errChain[idx] = acc.slice(); });
    var mode = 'control';
    var ro;

    function nearestCtrl(p) {
      var b = ctrl[0], bd = 1e9;
      ctrl.forEach(function (c) { var d = Math.hypot(p[0] - c[0], p[1] - c[1]); if (d < bd) { bd = d; b = c; } });
      return b;
    }
    function draw(k) {
      clear(g);
      var showCtrl = mode === 'control';
      var kc = showCtrl ? Math.min(1, k / 0.25) : 1, kp = showCtrl ? Math.max(0, (k - 0.25) / 0.75) : k;
      if (showCtrl) {
        var poly = ctrl.concat([ctrl[0]]).map(function (c) { return c.join(','); }).join(' ');
        S('polyline', { points: poly, fill: 'none', stroke: C.p, 'stroke-width': 1.6, 'stroke-dasharray': '6 5', opacity: kc }, g);
      }
      ctrl.forEach(function (c, ci) {
        S('rect', { x: c[0] - 7, y: c[1] - 7, width: 14, height: 14, fill: showCtrl ? C.p : C.f, transform: 'rotate(45 ' + c[0] + ' ' + c[1] + ')', opacity: showCtrl ? kc : (ci === 0 ? 1 : 0.35) }, g);
      });
      T(g, ctrl[0][0] + 14, ctrl[0][1] + 4, showCtrl ? 'control' : 'start', { fill: C.p, 'font-weight': 700 });
      var shown = Math.floor(kp * pts.length + 1e-9), maxE = 0, sumE = 0;
      var seq = showCtrl ? pts.map(function (_, i2) { return i2; }) : order;
      var prev = ctrl[0];
      for (var s = 0; s < shown; s++) {
        var idx = seq[s], p = pts[idx];
        var e = showCtrl ? errCtrl[idx] : errChain[idx];
        var mag = Math.hypot(e[0], e[1]);
        maxE = Math.max(maxE, mag); sumE += mag;
        var from = showCtrl ? nearestCtrl(p) : prev;
        S('line', { x1: from[0], y1: from[1], x2: p[0], y2: p[1], stroke: C.f, 'stroke-width': 1 }, g);
        S('circle', { cx: p[0], cy: p[1], r: 3 + mag * 4, fill: C.dh, stroke: C.d, 'stroke-width': 1, 'fill-opacity': 0.7 }, g);
        S('circle', { cx: p[0], cy: p[1], r: 3.5, fill: C.a }, g);
        prev = p;
      }
      T(g, 300, 292, 'red circle = position error of each point (size grows with error)', { 'text-anchor': 'middle', 'font-size': 11, fill: C.f });
      ro.max.textContent = shown ? f1(maxE) + ' cm' : '–';
      ro.avg.textContent = shown ? f1(sumE / shown) + ' cm' : '–';
      ro.way.textContent = showCtrl ? 'From nearest control point' : 'From the previous point';
    }
    function play() { animate(mount, 3200, draw); }
    var box = controls(mount);
    var b1 = button(box, 'Control first', function () { mode = 'control'; b1.classList.add('on'); b2.classList.remove('on'); play(); });
    var b2 = button(box, 'Point to point, no control', function () { mode = 'chain'; b2.classList.add('on'); b1.classList.remove('on'); play(); });
    button(box, '↻ Play again', play);
    b1.classList.add('on');
    ro = readout(mount, [['way', 'Each point measured'], ['max', 'Largest error'], ['avg', 'Average error']]);
    draw(1);
  };

  // ============ CO2: trilateration and satellite geometry (DOP) ============
  builders['dop'] = function (mount) {
    var svg = makeSvg(mount, 600, 320, 'Three satellites and their distance circles meeting at the receiver; the overlap area grows when the satellites are close together');
    var g = S('g', {}, svg);
    var R = [300, 262], dist = 205, e = 9, spread = 55, ro, bestArea = null;
    function sats() {
      return [-spread, 0, spread].map(function (s) {
        var a = (-90 + s) * Math.PI / 180;
        return [R[0] + dist * Math.cos(a), R[1] + dist * Math.sin(a)];
      });
    }
    function dop(ss) {
      var a = 0, b = 0, c = 0;
      ss.forEach(function (s) { var ux = (s[0] - R[0]) / dist, uy = (s[1] - R[1]) / dist; a += ux * ux; b += ux * uy; c += uy * uy; });
      var det = a * c - b * b;
      return Math.sqrt((a + c) / det);
    }
    function region(ss, paint) {
      var area = 0;
      for (var x = -200; x <= 200; x += 2) for (var y = -56; y <= 56; y += 2) {
        var px = R[0] + x, py = R[1] + y, ok = true;
        for (var i = 0; i < 3 && ok; i++) if (Math.abs(Math.hypot(px - ss[i][0], py - ss[i][1]) - dist) > e) ok = false;
        if (ok) { area++; if (paint) S('rect', { x: px - 1, y: py - 1, width: 2, height: 2, fill: C.a }, g); }
      }
      return area;
    }
    function draw(k) {
      clear(g);
      var ss = sats();
      if (bestArea === null) { var keep = spread; spread = 60; bestArea = region(sats(), false); spread = keep; ss = sats(); }
      ss.forEach(function (s, i) {
        S('circle', { cx: s[0], cy: s[1], r: dist * k, fill: 'none', stroke: C.p, 'stroke-width': 2 * e, 'stroke-opacity': 0.13 }, g);
        S('circle', { cx: s[0], cy: s[1], r: dist * k, fill: 'none', stroke: C.p, 'stroke-width': 1, 'stroke-opacity': 0.6 }, g);
        S('rect', { x: s[0] - 9, y: s[1] - 5, width: 18, height: 10, rx: 2, fill: C.p }, g);
        S('line', { x1: s[0] - 18, y1: s[1], x2: s[0] + 18, y2: s[1], stroke: C.p, 'stroke-width': 3 }, g);
        T(g, s[0], s[1] - 12, 'Sat ' + (i + 1), { 'text-anchor': 'middle', fill: C.t });
      });
      var area = k >= 1 ? region(ss, true) : 0;
      S('circle', { cx: R[0], cy: R[1], r: 4, fill: C.t }, g);
      S('rect', { x: 0, y: R[1] + 22, width: 600, height: 60, fill: C.sf }, g);
      S('line', { x1: 20, y1: R[1] + 22, x2: 580, y2: R[1] + 22, stroke: C.b }, g);
      T(g, R[0], R[1] + 40, 'receiver (true position)', { 'text-anchor': 'middle', fill: C.t });
      T(g, R[0], R[1] + 56, 'bands = distance ± range error · orange = where the receiver could be', { 'text-anchor': 'middle', 'font-size': 11, fill: C.f });
      var d = dop(ss);
      ro.dop.textContent = d.toFixed(1);
      ro.geo.textContent = d < 2 ? 'Good' : d < 5 ? 'Fair' : 'Poor';
      ro.geo.style.color = d < 2 ? C.s : d < 5 ? C.a : C.d;
      ro.area.textContent = k >= 1 ? (area / bestArea).toFixed(1) + '× the well-spread case' : '…';
    }
    var box = controls(mount);
    slider(box, 'Satellite spread', 8, 80, 1, spread, function (v) { return v + '°'; }, function (v) { spread = v; draw(1); });
    button(box, '↻ Grow the circles', function () { animate(mount, 1600, draw); });
    ro = readout(mount, [['dop', 'DOP (geometry factor)'], ['geo', 'Geometry'], ['area', 'Possible-position area']]);
    draw(1);
  };

  // ============ CO2: multipath ============
  builders['multipath'] = function (mount) {
    var svg = makeSvg(mount, 600, 330, 'A satellite signal reaching an antenna directly and after reflecting from a building wall');
    arrowDefs(svg, 'mp-a', C.p);
    arrowDefs(svg, 'mp-b', C.d);
    var g = S('g', {}, svg), cloud = S('g', {}, svg);
    var elev = 30, d = 8, wall = true, ro, pts = [], r = rng(3);
    var ground = 240, ax = 240, ay = 196, px = 6;
    function amp() { return wall ? 1 + 7 * Math.cos(elev * Math.PI / 180) * Math.exp(-d / 20) : 1; }
    function draw() {
      clear(g);
      var e = elev * Math.PI / 180, ce = Math.cos(e), se = Math.sin(e);
      S('line', { x1: 0, y1: ground, x2: 600, y2: ground, stroke: C.f, 'stroke-width': 1.5 }, g);
      // direct ray from upper left
      var L = (ay - 10) / se;
      S('line', { x1: ax - L * ce, y1: ay - L * se, x2: ax - 4 * ce, y2: ay - 4 * se, stroke: C.p, 'stroke-width': 2, 'marker-end': 'url(#mp-a)' }, g);
      T(g, Math.max(14, ax - 0.55 * L * ce) + 6, ay - 0.55 * L * se, 'direct signal', { fill: C.p, 'font-weight': 700 });
      if (wall) {
        var xw = ax + d * px;
        S('rect', { x: xw, y: 40, width: 130, height: ground - 40, fill: C.so, stroke: C.f }, g);
        for (var wy = 60; wy < ground - 20; wy += 34) for (var wx = xw + 18; wx < xw + 120; wx += 36) S('rect', { x: wx, y: wy, width: 18, height: 18, fill: C.b }, g);
        T(g, xw + 65, ground - 8, 'building', { 'text-anchor': 'middle' });
        var t = (xw - ax) / ce, wyy = ay - t * se;
        if (wyy > 42) {
          var L2 = (wyy - 10) / se;
          S('line', { x1: xw - L2 * ce, y1: wyy - L2 * se, x2: xw, y2: wyy, stroke: C.d, 'stroke-width': 1.6, 'stroke-dasharray': '6 4' }, g);
          S('line', { x1: xw, y1: wyy, x2: ax + 4, y2: ay - 2, stroke: C.d, 'stroke-width': 1.6, 'stroke-dasharray': '6 4', 'marker-end': 'url(#mp-b)' }, g);
          T(g, xw - 0.5 * L2 * ce + 10, wyy - 0.5 * L2 * se - 8, 'reflected signal', { fill: C.d, 'font-weight': 700, halo: 1 });
        }
        S('line', { x1: ax, y1: ground + 14, x2: xw, y2: ground + 14, stroke: C.m }, g);
        T(g, (ax + xw) / 2, ground + 28, 'd = ' + d + ' m', { 'text-anchor': 'middle' });
      }
      S('line', { x1: ax, y1: ay, x2: ax, y2: ground, stroke: C.m, 'stroke-width': 2.5 }, g);
      S('ellipse', { cx: ax, cy: ay - 2, rx: 12, ry: 5, fill: C.a }, g);
      T(g, ax - 16, ground - 8, 'antenna', { 'text-anchor': 'end' });
      var extra = wall ? 2 * d * ce : 0;
      ro.extra.textContent = wall ? extra.toFixed(1) + ' m' : 'none';
      ro.risk.textContent = !wall ? 'Low' : amp() > 4 ? 'High' : amp() > 2.2 ? 'Medium' : 'Low';
      ro.risk.style.color = !wall ? C.s : amp() > 4 ? C.d : amp() > 2.2 ? C.a : C.s;
      pts = [];
    }
    // scatter box: positions computed one after another (illustration)
    var bx = 420, by = 262, bw = 160, bh = 62;
    function drawCloud() {
      clear(cloud);
      S('rect', { x: bx, y: by, width: bw, height: bh, rx: 6, fill: C.sf, stroke: C.b }, cloud);
      S('line', { x1: bx + bw / 2 - 6, y1: by + bh / 2, x2: bx + bw / 2 + 6, y2: by + bh / 2, stroke: C.t }, cloud);
      S('line', { x1: bx + bw / 2, y1: by + bh / 2 - 6, x2: bx + bw / 2, y2: by + bh / 2 + 6, stroke: C.t }, cloud);
      pts.forEach(function (p) { S('circle', { cx: bx + bw / 2 + p[0], cy: by + bh / 2 + p[1], r: 1.8, fill: C.a }, cloud); });
      T(cloud, bx, by - 6, 'computed positions (illustration)', { 'font-size': 11, fill: C.f });
    }
    function addPoint() {
      var a = amp() * 3;
      pts.push([Math.max(-bw / 2 + 3, Math.min(bw / 2 - 3, gauss(r) * a)), Math.max(-bh / 2 + 3, Math.min(bh / 2 - 3, gauss(r) * a * 0.6))]);
      if (pts.length > 40) pts.shift();
    }
    function fill() { pts = []; for (var i = 0; i < 40; i++) addPoint(); drawCloud(); }
    var box = controls(mount);
    slider(box, 'Satellite elevation', 10, 80, 1, elev, function (v) { return v + '°'; }, function (v) { elev = v; draw(); fill(); });
    slider(box, 'Distance to wall', 2, 30, 1, d, function (v) { return v + ' m'; }, function (v) { d = v; draw(); fill(); });
    check(box, 'Remove the building (open sky)', function (on) { wall = !on; draw(); fill(); });
    ro = readout(mount, [['extra', 'Extra path of reflected signal = 2 d cos(elevation)'], ['risk', 'Multipath risk']]);
    draw(); fill();
    if (!REDUCE) setInterval(function () { if (document.hidden) return; addPoint(); drawCloud(); }, 160);
  };

  // ============ CO3: base and rover ============
  builders['base-rover'] = function (mount) {
    var svg = makeSvg(mount, 600, 310, 'Base station and rover receiving the same satellite errors; the base sends a correction to the rover');
    arrowDefs(svg, 'br-a', C.s);
    var g = S('g', {}, svg);
    var step = 0, k = 1, st, ro;
    var ground = 285, base = [150, 245], rov = [450, 245];
    var sats = [[90, 26], [300, 16], [510, 30]];
    var errB = [3.2, -2.1], errR = [3.4, -1.8], sc = 9;
    var boxB = [70, 60], boxR = [370, 60], bw = 160, bh = 110;
    var texts = [
      'Both receivers track the same satellites at the same time.',
      'Each GPS position is wrong by almost the same amount, because both signals pass through the same sky (example: 3.2 m east, 2.1 m south).',
      'The base sits on a known point, so it can compute the correction = true position − GPS position.',
      'The base sends the correction to the rover by radio or mobile internet.',
      'The rover applies the correction. Only a small difference is left, because the two errors were not exactly equal.'
    ];
    function plan(o, label, err, moved) {
      S('rect', { x: o[0], y: o[1], width: bw, height: bh, rx: 8, fill: C.sf, stroke: C.b }, g);
      T(g, o[0] + 8, o[1] + 16, label, { fill: C.t, 'font-weight': 700, 'font-size': 11 });
      var cx = o[0] + bw / 2, cy = o[1] + bh / 2 + 8;
      S('line', { x1: cx - 8, y1: cy, x2: cx + 8, y2: cy, stroke: C.t }, g);
      S('line', { x1: cx, y1: cy - 8, x2: cx, y2: cy + 8, stroke: C.t }, g);
      T(g, cx - 6, cy + 18, 'true', { 'font-size': 11, 'text-anchor': 'end' });
      if (step >= 1) {
        var ex = err[0] * sc, ey = -err[1] * sc;
        var mx = cx + ex * (1 - moved), my = cy + ey * (1 - moved);
        S('circle', { cx: mx, cy: my, r: 5, fill: moved >= 1 ? C.s : C.a }, g);
        T(g, mx + 8, my - 6, moved >= 1 ? 'corrected' : 'GPS', { 'font-size': 11, fill: moved >= 1 ? C.s : C.a });
        return [cx, cy, cx + ex, cy + ey];
      }
      return [cx, cy, cx, cy];
    }
    function draw() {
      clear(g);
      S('line', { x1: 0, y1: ground, x2: 600, y2: ground, stroke: C.f, 'stroke-width': 1.5 }, g);
      sats.forEach(function (s) {
        S('rect', { x: s[0] - 8, y: s[1] - 4, width: 16, height: 8, rx: 2, fill: C.p }, g);
        S('line', { x1: s[0] - 16, y1: s[1], x2: s[0] + 16, y2: s[1], stroke: C.p, 'stroke-width': 3 }, g);
        [base, rov].forEach(function (r) { S('line', { x1: s[0], y1: s[1] + 4, x2: r[0], y2: r[1] - 12, stroke: C.p, 'stroke-opacity': 0.25, 'stroke-dasharray': '3 4' }, g); });
      });
      // base on pillar, rover on pole
      S('rect', { x: base[0] - 10, y: base[1], width: 20, height: ground - base[1], fill: C.so, stroke: C.f }, g);
      S('ellipse', { cx: base[0], cy: base[1] - 4, rx: 13, ry: 5, fill: C.p }, g);
      T(g, base[0] + 20, base[1] + 18, 'Base (known point)', { fill: C.t });
      S('line', { x1: rov[0], y1: rov[1], x2: rov[0], y2: ground, stroke: C.m, 'stroke-width': 2.5 }, g);
      S('ellipse', { cx: rov[0], cy: rov[1] - 4, rx: 13, ry: 5, fill: C.a }, g);
      T(g, rov[0] + 20, rov[1] + 18, 'Rover (unknown point)', { fill: C.t });
      var bB = plan(boxB, 'Base: plan view', errB, 0);
      var resid = [errR[0] - errB[0], errR[1] - errB[1]];
      var moved = step >= 4 ? k : 0;
      // rover moves from its GPS position by the base correction
      var cxR = boxR[0] + bw / 2, cyR = boxR[1] + bh / 2 + 8;
      S('rect', { x: boxR[0], y: boxR[1], width: bw, height: bh, rx: 8, fill: C.sf, stroke: C.b }, g);
      T(g, boxR[0] + 8, boxR[1] + 16, 'Rover: plan view', { fill: C.t, 'font-weight': 700, 'font-size': 11 });
      S('line', { x1: cxR - 8, y1: cyR, x2: cxR + 8, y2: cyR, stroke: C.t }, g);
      S('line', { x1: cxR, y1: cyR - 8, x2: cxR, y2: cyR + 8, stroke: C.t }, g);
      T(g, cxR - 6, cyR + 18, 'true', { 'font-size': 11, 'text-anchor': 'end' });
      if (step >= 1) {
        var gx = cxR + errR[0] * sc, gy = cyR - errR[1] * sc;
        var fx = cxR + resid[0] * sc, fy = cyR - resid[1] * sc;
        var x = gx + (fx - gx) * moved, y = gy + (fy - gy) * moved;
        if (moved > 0) S('circle', { cx: gx, cy: gy, r: 4, fill: 'none', stroke: C.a, 'stroke-dasharray': '2 2' }, g);
        S('circle', { cx: x, cy: y, r: 5, fill: moved >= 1 ? C.s : C.a }, g);
        T(g, x + 8, y - 6, moved >= 1 ? 'corrected' : 'GPS', { 'font-size': 11, fill: moved >= 1 ? C.s : C.a });
      }
      if (step >= 2) {
        S('line', { x1: bB[2], y1: bB[3], x2: bB[0] + 4, y2: bB[1] - 3, stroke: C.s, 'stroke-width': 2, 'marker-end': 'url(#br-a)' }, g);
        T(g, boxB[0] + 8, boxB[1] + bh - 8, 'correction: 3.2 m W, 2.1 m N', { 'font-size': 11, fill: C.s, 'font-weight': 700 });
      }
      if (step === 3) {
        for (var i = 0; i < 3; i++) {
          var rr = ((k * 3 + i) % 3) / 3, cx = base[0] + (rov[0] - base[0]) * rr;
          S('path', { d: 'M' + (cx - 6) + ' ' + (base[1] - 30) + ' q 6 -10 12 0', fill: 'none', stroke: C.s, 'stroke-width': 2, opacity: 1 - rr * 0.6 }, g);
        }
        T(g, 300, base[1] - 44, 'correction sent', { 'text-anchor': 'middle', fill: C.s, 'font-weight': 700 });
      }
      st.textContent = 'Step ' + (step + 1) + ' of 5: ' + texts[step];
      ro.b.textContent = step >= 1 ? '3.2 m E, 2.1 m S' : '–';
      ro.r.textContent = step >= 1 ? '3.4 m E, 1.8 m S' : '–';
      ro.f.textContent = step >= 4 && k >= 1 ? Math.hypot(resid[0], resid[1]).toFixed(1) + ' m' : '–';
    }
    function go(s) {
      step = Math.max(0, Math.min(4, s));
      if (step === 3 || step === 4) animate(mount, step === 3 ? 1800 : 1200, function (kk) { k = kk; draw(); });
      else { k = 1; draw(); }
    }
    var box = controls(mount);
    button(box, '← Back', function () { go(step - 1); });
    button(box, 'Next step →', function () { go(step + 1); });
    button(box, '↻ Start again', function () { go(0); });
    st = status(mount);
    ro = readout(mount, [['b', 'Base GPS error (example)'], ['r', 'Rover GPS error (example)'], ['f', 'Rover error after correction']]);
    go(0);
  };

  // ============ CO3: GPS loop closure ============
  builders['loop'] = function (mount) {
    var svg = makeSvg(mount, 600, 300, 'Three GPS baselines added head to tail around a loop; the small gap at the start point is the misclosure');
    arrowDefs(svg, 'lp-a', C.p);
    arrowDefs(svg, 'lp-b', C.d);
    var g = S('g', {}, svg);
    var base = { AB: [1520.432, -830.215, 410.118], BC: [-610.287, 1240.556, -205.334], CA: [-910.131, -410.352, -204.776] };
    var extra = 0, limit = 10, k = 1, ro;
    var P = { A: [70, 250], B: [300, 50], C: [420, 230] };
    function vecs() { var bc = base.BC.slice(); bc[1] += extra / 1000; return [base.AB, bc, base.CA]; }
    function len(v) { return Math.hypot(v[0], v[1], v[2]); }
    function draw() {
      clear(g);
      var v = vecs(), sum = [0, 0, 0], L = 0;
      v.forEach(function (x) { sum[0] += x[0]; sum[1] += x[1]; sum[2] += x[2]; L += len(x); });
      var mis = Math.hypot(sum[0], sum[1], sum[2]), ppm = mis / L * 1e6;
      var seg = [['A', 'B', 'AB'], ['B', 'C', 'BC'], ['C', 'A', 'CA']];
      var n = k * 3;
      seg.forEach(function (s, i) {
        var part = Math.max(0, Math.min(1, n - i));
        if (part <= 0) return;
        var p0 = P[s[0]], p1 = P[s[1]];
        var x1 = p0[0] + (p1[0] - p0[0]) * part, y1 = p0[1] + (p1[1] - p0[1]) * part;
        var sh = 0.06;
        S('line', { x1: p0[0] + (p1[0] - p0[0]) * sh, y1: p0[1] + (p1[1] - p0[1]) * sh, x2: p0[0] + (x1 - p0[0]) * (1 - (part === 1 ? sh : 0)), y2: p0[1] + (y1 - p0[1]) * (1 - (part === 1 ? sh : 0)), stroke: C.p, 'stroke-width': 2, 'marker-end': 'url(#lp-a)' }, g);
        if (part === 1) {
          var mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2;
          T(g, mx + (s[2] === 'CA' ? 0 : s[2] === 'AB' ? -14 : 14), my + (s[2] === 'CA' ? 18 : 0), s[2], { 'text-anchor': s[2] === 'AB' ? 'end' : 'start', fill: C.p, 'font-weight': 700 });
        }
      });
      ['A', 'B', 'C'].forEach(function (nm) {
        var p = P[nm];
        S('circle', { cx: p[0], cy: p[1], r: 6, fill: nm === 'A' ? C.a : C.p }, g);
        T(g, p[0] + (nm === 'A' ? -12 : 10), p[1] + (nm === 'B' ? -10 : 18), nm, { fill: C.t, 'font-weight': 700, 'font-size': 14, 'text-anchor': nm === 'A' ? 'end' : 'start' });
      });
      // magnified view of the gap at A
      var zx = 520, zy = 110, zr = 62, scale = 1.4;
      S('circle', { cx: zx, cy: zy, r: zr, fill: C.sf, stroke: C.b }, g);
      T(g, zx, zy - zr - 8, 'gap at A, enlarged', { 'text-anchor': 'middle', 'font-size': 11 });
      S('circle', { cx: zx, cy: zy, r: 4, fill: C.a }, g);
      if (k >= 1) {
        var gx = sum[0] * 1000 * scale, gy = -sum[1] * 1000 * scale, gm = Math.hypot(gx, gy);
        if (gm > zr - 8) { gx *= (zr - 8) / gm; gy *= (zr - 8) / gm; }
        S('circle', { cx: zx + gx, cy: zy + gy, r: 3.5, fill: C.d }, g);
        if (gm > 3) S('line', { x1: zx + gx, y1: zy + gy, x2: zx + gx * 0.15, y2: zy + gy * 0.15, stroke: C.d, 'stroke-width': 1.5, 'marker-end': 'url(#lp-b)' }, g);
        T(g, zx, zy + zr + 16, (mis * 1000).toFixed(1) + ' mm', { 'text-anchor': 'middle', fill: C.d, 'font-weight': 700 });
      }
      ro.sx.textContent = (sum[0] * 1000).toFixed(0) + ' / ' + (sum[1] * 1000).toFixed(0) + ' / ' + (sum[2] * 1000).toFixed(0) + ' mm';
      ro.mis.textContent = (mis * 1000).toFixed(1) + ' mm';
      ro.ppm.textContent = ppm.toFixed(1) + ' ppm';
      var ok = ppm <= limit;
      ro.v.textContent = ok ? 'Accept the loop' : 'Re-observe a baseline';
      ro.v.style.color = ok ? C.s : C.d;
    }
    var box = controls(mount);
    slider(box, 'Extra error in BC', 0, 60, 1, 0, function (v) { return v + ' mm'; }, function (v) { extra = v; k = 1; draw(); });
    slider(box, 'Limit (example)', 5, 20, 1, limit, function (v) { return v + ' ppm'; }, function (v) { limit = v; draw(); });
    button(box, '↻ Add baselines', function () { animate(mount, 2400, function (kk) { k = kk; draw(); }); });
    ro = readout(mount, [['sx', 'ΣΔX / ΣΔY / ΣΔZ'], ['mis', 'Misclosure'], ['ppm', 'Relative misclosure'], ['v', 'Decision']]);
    draw();
  };

  // ============ CO4: total station height explorer ============
  builders['ts-explorer'] = function (mount) {
    var svg = makeSvg(mount, 600, 290, 'Side view of a total station sighting a prism, updating with the chosen readings');
    arrowDefs(svg, 'ts-a', C.m);
    var g = S('g', {}, svg);
    var SD = 125, Z = 88.5, HI = 1.5, HT = 1.8, wrong = false, ro;
    function draw() {
      clear(g);
      var sdm = SD + (wrong ? 0.03 : 0);
      var zr = Z * Math.PI / 180, HD = sdm * Math.sin(zr), VD = sdm * Math.cos(zr), RL = 300 + HI + VD - HT;
      var h = 2.3, v = 10, x0 = 80, ay = 150 + VD * v / 2, px = x0 + HD * h, py = ay - VD * v, g0 = ay + HI * v, g1 = py + HT * v;
      var slope = (g1 - g0) / (px - x0);
      S('path', { d: 'M10 ' + (g0 - slope * 70) + 'L' + x0 + ' ' + g0 + 'L' + px + ' ' + g1 + 'L590 ' + (g1 + slope * (590 - px)), fill: 'none', stroke: C.f, 'stroke-width': 1.5 }, g);
      S('line', { x1: x0, y1: ay, x2: px, y2: ay, stroke: C.f, 'stroke-dasharray': '4 4' }, g);
      S('line', { x1: x0, y1: ay, x2: x0, y2: ay - 80, stroke: C.f, 'stroke-dasharray': '4 4' }, g);
      S('line', { x1: x0, y1: ay, x2: px, y2: py, stroke: C.a, 'stroke-width': 2.5 }, g);
      S('line', { x1: px + 18, y1: ay, x2: px + 18, y2: py, stroke: C.m, 'stroke-width': 1.3, 'marker-start': 'url(#ts-a)', 'marker-end': 'url(#ts-a)' }, g);
      S('line', { x1: x0, y1: ay + 8, x2: x0 - 14, y2: g0, stroke: C.m, 'stroke-width': 2 }, g);
      S('line', { x1: x0, y1: ay + 8, x2: x0 + 14, y2: g0, stroke: C.m, 'stroke-width': 2 }, g);
      S('rect', { x: x0 - 11, y: ay - 11, width: 22, height: 22, rx: 4, fill: C.p }, g);
      S('line', { x1: px, y1: py, x2: px, y2: g1, stroke: C.m, 'stroke-width': 2.5 }, g);
      S('circle', { cx: px, cy: py, r: 8, fill: C.a }, g);
      var r = 55, ex0 = 0, ex = x0 + r * Math.sin(zr), ey = ay - r * Math.cos(zr);
      S('path', { d: 'M' + x0 + ' ' + (ay - r) + 'A' + r + ' ' + r + ' 0 0 1 ' + ex + ' ' + ey, fill: 'none', stroke: C.p, 'stroke-width': 1.5 }, g);
      T(g, x0 + 24, ay - 62, 'Z', { fill: C.p, 'font-weight': 700 });
      var mx = (x0 + px) / 2, my = (ay + py) / 2;
      S('line', { x1: px - 10, y1: py, x2: px - 10, y2: g1, stroke: C.m, 'stroke-width': 1 }, g);
      S('line', { x1: x0 - 24, y1: ay, x2: x0 - 24, y2: g0, stroke: C.m, 'stroke-width': 1 }, g);
      T(g, mx - 10, my - 14, 'SD', { fill: C.a, 'font-weight': 700, halo: 1 });
      T(g, mx, ay + (VD > 0 ? 18 : -8), 'HD', { 'text-anchor': 'middle', halo: 1 });
      T(g, px + 26, (ay + py) / 2 + 4, 'VD', { halo: 1 });
      T(g, px - 14, (py + g1) / 2 + 4, 'HT', { 'text-anchor': 'end', halo: 1 });
      T(g, x0 - 28, (ay + g0) / 2 + 4, 'HI', { 'text-anchor': 'end', halo: 1 });
      T(g, 590, 282, 'heights drawn about 4× larger than distances', { 'text-anchor': 'end', 'font-size': 11, fill: C.f });
      ro.hd.textContent = HD.toFixed(3) + ' m';
      ro.vd.textContent = (VD >= 0 ? '+' : '') + VD.toFixed(3) + ' m';
      ro.rl.textContent = RL.toFixed(3) + ' m';
      ro.rl.style.color = wrong ? C.d : '';
      ro.hd.style.color = wrong ? C.d : '';
    }
    var box = controls(mount);
    slider(box, 'Slope distance SD', 20, 200, 1, SD, function (x) { return x.toFixed(0) + ' m'; }, function (x) { SD = x; draw(); });
    slider(box, 'Zenith angle Z', 86, 94, 0.25, Z, function (x) { return dms(x); }, function (x) { Z = x; draw(); });
    slider(box, 'Instrument height HI', 1.2, 1.8, 0.05, HI, function (x) { return x.toFixed(2) + ' m'; }, function (x) { HI = x; draw(); });
    slider(box, 'Prism height HT', 1, 2.5, 0.1, HT, function (x) { return x.toFixed(1) + ' m'; }, function (x) { HT = x; draw(); });
    check(box, 'Prism constant set wrongly (30 mm)', function (on) { wrong = on; draw(); });
    ro = readout(mount, [['hd', 'HD = SD sin Z'], ['vd', 'VD = SD cos Z'], ['rl', 'RL = 300 + HI + VD − HT']]);
    draw();
  };

  builders['face-lr'] = function (mount) {
    var svg = makeSvg(mount, 600, 200, 'Collimation error on face left and face right cancels in the mean');
    var g = S('g', {}, svg);
    var c = 20, ro;
    function dial(cx, label, reading, trueDeg, colour) {
      var cy = 100, r = 70;
      S('circle', { cx: cx, cy: cy, r: r, fill: C.sf, stroke: C.b }, g);
      for (var a = 0; a < 360; a += 30) {
        var t = (a - 90) * Math.PI / 180;
        S('line', { x1: cx + (r - 6) * Math.cos(t), y1: cy + (r - 6) * Math.sin(t), x2: cx + r * Math.cos(t), y2: cy + r * Math.sin(t), stroke: C.f }, g);
      }
      function ray(deg, col, w, dash) {
        var t = (deg - 90) * Math.PI / 180;
        S('line', { x1: cx, y1: cy, x2: cx + (r - 4) * Math.cos(t), y2: cy + (r - 4) * Math.sin(t), stroke: col, 'stroke-width': w, 'stroke-dasharray': dash || '' }, g);
      }
      ray(trueDeg, C.f, 1.5, '4 3');
      ray(reading, colour, 2.5);
      S('circle', { cx: cx, cy: cy, r: 3, fill: C.t }, g);
      T(g, cx, 20, label, { 'text-anchor': 'middle', fill: C.t, 'font-weight': 700 });
    }
    function draw() {
      clear(g);
      var e = c / 3600 * 600;
      dial(150, 'Face left', 60 + e, 60, C.p);
      dial(450, 'Face right', 240 - e, 240, C.a);
      T(g, 300, 190, 'dashed = true direction · solid = reading (error enlarged in the picture)', { 'text-anchor': 'middle', 'font-size': 11, fill: C.f });
      ro.fl.textContent = dms(60 + c / 3600);
      ro.fr.textContent = dms(240 - c / 3600);
      ro.mean.textContent = dms(60);
    }
    var box = controls(mount);
    slider(box, 'Collimation error', 0, 30, 1, c, function (x) { return x + '″'; }, function (x) { c = x; draw(); });
    ro = readout(mount, [['fl', 'Face left reading'], ['fr', 'Face right reading'], ['mean', 'Mean of FL and (FR − 180°)']]);
    draw();
  };

  // ============ CO5: spot heights -> TIN -> contours ============
  builders['tin'] = function (mount) {
    var svg = makeSvg(mount, 600, 330, 'Spot heights joined into triangles, from which contour lines are drawn');
    var g = S('g', {}, svg);
    var cols = 7, rows = 5, x0 = 50, y0 = 30, W = 500, Hh = 270, r = rng(21), P = [];
    function z(u, v) { return 100 + 16 * Math.exp(-((u - 0.62) * (u - 0.62) + (v - 0.42) * (v - 0.42)) / 0.07) + 6 * u - 3 * v; }
    for (var j = 0; j < rows; j++) for (var i = 0; i < cols; i++) {
      var edge = i === 0 || j === 0 || i === cols - 1 || j === rows - 1;
      var u = i / (cols - 1) + (edge ? 0 : (r() - 0.5) * 0.08), v = j / (rows - 1) + (edge ? 0 : (r() - 0.5) * 0.12);
      P.push({ x: x0 + u * W, y: y0 + v * Hh, z: z(u, v) });
    }
    var tris = [];
    for (j = 0; j < rows - 1; j++) for (i = 0; i < cols - 1; i++) {
      var a = j * cols + i, b = a + 1, c = a + cols, d = c + 1;
      if ((i + j) % 2) { tris.push([a, b, d]); tris.push([a, d, c]); } else { tris.push([a, b, c]); tris.push([b, d, c]); }
    }
    var stage = 3, interval = 2, showTri = true, k = 1, ro;
    var zmin = Math.min.apply(null, P.map(function (p) { return p.z; })), zmax = Math.max.apply(null, P.map(function (p) { return p.z; }));
    function draw() {
      clear(g);
      if (stage >= 2 && showTri) {
        tris.forEach(function (t, ti) {
          if (stage === 2 && ti / tris.length > k) return;
          var pts = t.map(function (q) { return P[q].x + ',' + P[q].y; }).join(' ');
          S('polygon', { points: pts, fill: 'none', stroke: C.p, 'stroke-opacity': 0.35 }, g);
        });
      }
      var levels = 0;
      if (stage >= 3) {
        var first = Math.ceil(zmin / interval) * interval, nLev = Math.floor((zmax - first) / interval) + 1;
        for (var L = first; L <= zmax; L += interval) {
          if ((L - first) / interval / nLev > k) break;
          levels++;
          var idx = Math.abs(L % (interval * 5)) < 1e-6;
          tris.forEach(function (t) {
            var seg = [];
            for (var e = 0; e < 3; e++) {
              var p = P[t[e]], q = P[t[(e + 1) % 3]];
              if ((p.z - L) * (q.z - L) < 0) { var f = (L - p.z) / (q.z - p.z); seg.push([p.x + f * (q.x - p.x), p.y + f * (q.y - p.y)]); }
            }
            if (seg.length === 2) S('line', { x1: seg[0][0], y1: seg[0][1], x2: seg[1][0], y2: seg[1][1], stroke: C.a, 'stroke-width': idx ? 2.4 : 1.3 }, g);
          });
        }
      }
      P.forEach(function (p, pi) {
        if (stage === 1 && pi / P.length > k) return;
        S('circle', { cx: p.x, cy: p.y, r: 3, fill: C.t }, g);
        T(g, p.x + 5, p.y - 5, p.z.toFixed(1), { 'font-size': 10.5 });
      });
      ro.pts.textContent = P.length;
      ro.tri.textContent = stage >= 2 ? tris.length : '–';
      ro.lev.textContent = stage >= 3 ? levels + ' lines, every ' + interval + ' m' : '–';
    }
    function run(s) { stage = s; animate(mount, s === 1 ? 900 : 1600, function (kk) { k = kk; draw(); }); }
    var box = controls(mount);
    button(box, '1 Spot heights', function () { run(1); });
    button(box, '2 Build TIN', function () { run(2); });
    button(box, '3 Draw contours', function () { run(3); });
    var lv = [1, 2, 5];
    slider(box, 'Contour interval', 0, 2, 1, 1, function (x) { return lv[x] + ' m'; }, function (x) { interval = lv[x]; k = 1; if (stage < 3) stage = 3; draw(); });
    var cb = check(box, 'Hide triangles', function (on) { showTri = !on; draw(); });
    ro = readout(mount, [['pts', 'Spot heights'], ['tri', 'Triangles in the TIN'], ['lev', 'Contours']]);
    draw();
  };

  // ============ CO5: UTM zones of India ============
  function utm(lat, lon) {
    var a = 6378137, f = 1 / 298.257223563, k0 = 0.9996, e2 = f * (2 - f), ep2 = e2 / (1 - e2);
    var zone = Math.floor((lon + 180) / 6) + 1, lon0 = (zone - 1) * 6 - 180 + 3;
    var phi = lat * Math.PI / 180, lam = (lon - lon0) * Math.PI / 180;
    var sp = Math.sin(phi), cp = Math.cos(phi), tp = Math.tan(phi);
    var N = a / Math.sqrt(1 - e2 * sp * sp), Tt = tp * tp, Cc = ep2 * cp * cp, A = cp * lam;
    var e4 = e2 * e2, e6 = e4 * e2;
    var M = a * ((1 - e2 / 4 - 3 * e4 / 64 - 5 * e6 / 256) * phi - (3 * e2 / 8 + 3 * e4 / 32 + 45 * e6 / 1024) * Math.sin(2 * phi) + (15 * e4 / 256 + 45 * e6 / 1024) * Math.sin(4 * phi) - (35 * e6 / 3072) * Math.sin(6 * phi));
    var E = k0 * N * (A + (1 - Tt + Cc) * Math.pow(A, 3) / 6 + (5 - 18 * Tt + Tt * Tt + 72 * Cc - 58 * ep2) * Math.pow(A, 5) / 120) + 500000;
    var Nn = k0 * (M + N * tp * (A * A / 2 + (5 - Tt + 9 * Cc + 4 * Cc * Cc) * Math.pow(A, 4) / 24 + (61 - 58 * Tt + Tt * Tt + 600 * Cc - 330 * ep2) * Math.pow(A, 6) / 720));
    if (lat < 0) Nn += 10000000;
    return { zone: zone, lon0: lon0, E: E, N: Nn };
  }
  window.DLSM_utm = utm;
  builders['utm'] = function (mount) {
    var svg = makeSvg(mount, 600, 380, 'UTM zones 42 to 47 across India with cities plotted by latitude and longitude');
    var g = S('g', {}, svg), ro, sel = 'Nagpur';
    var cities = [
      ['Srinagar', 34.0837, 74.7973], ['Delhi', 28.6139, 77.2090], ['Ahmedabad', 23.0225, 72.5714], ['Mumbai', 19.0760, 72.8777],
      ['Bengaluru', 12.9716, 77.5946], ['Chennai', 13.0827, 80.2707], ['Nagpur', 21.1458, 79.0882], ['Ramtek', 21.3950, 79.3270],
      ['Kolkata', 22.5726, 88.3639], ['Guwahati', 26.1445, 91.7362], ['Dibrugarh', 27.4728, 94.9120], ['Port Blair', 11.6234, 92.7265]
    ];
    var X = function (lon) { return 40 + (lon - 66) * 15; }, Y = function (lat) { return 350 - (lat - 6) * 10; };
    var custom = null;
    function draw() {
      clear(g);
      for (var z = 42; z <= 47; z++) {
        var l0 = (z - 1) * 6 - 180;
        S('rect', { x: X(l0), y: 30, width: 90, height: 320, fill: z % 2 ? C.ph : C.so, stroke: C.b }, g);
        T(g, X(l0 + 3), 22, 'Zone ' + z, { 'text-anchor': 'middle', fill: C.p, 'font-weight': 700 });
        T(g, X(l0), 366, l0 + '° E', { 'text-anchor': 'middle', 'font-size': 10.5 });
        S('line', { x1: X(l0 + 3), y1: 30, x2: X(l0 + 3), y2: 350, stroke: C.p, 'stroke-opacity': 0.35, 'stroke-dasharray': '3 4' }, g);
      }
      T(g, X(102), 366, '102° E', { 'text-anchor': 'middle', 'font-size': 10.5 });
      for (var lat = 10; lat <= 35; lat += 5) {
        S('line', { x1: 40, y1: Y(lat), x2: 580, y2: Y(lat), stroke: C.b }, g);
        T(g, 36, Y(lat) + 4, lat + '° N', { 'text-anchor': 'end', 'font-size': 10.5 });
      }
      var list = cities.slice();
      if (custom) list.push(custom);
      list.forEach(function (c) {
        var on = c[0] === sel, x = X(c[2]), y = Y(c[1]);
        var grp = S('g', { tabindex: 0, role: 'button', 'aria-label': c[0], style: 'cursor:pointer' }, g);
        S('circle', { cx: x, cy: y, r: on ? 7 : 5, fill: on ? C.a : C.t, stroke: C.sf, 'stroke-width': 2 }, grp);
        var left = c[0] === 'Nagpur' || c[0] === 'Bengaluru';
        T(grp, x + (left ? -9 : 9), y + (c[0] === 'Nagpur' ? 14 : c[0] === 'Ramtek' ? -6 : 4), c[0], { 'text-anchor': left ? 'end' : 'start', fill: on ? C.a : C.t, 'font-weight': on ? 700 : 400, 'font-size': 11 });
        function pick() { sel = c[0]; show(c); draw(); }
        grp.addEventListener('click', pick);
        grp.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pick(); } });
      });
      T(g, 580, 345, 'dashed = central meridian of each zone', { 'text-anchor': 'end', 'font-size': 10.5, fill: C.f });
    }
    function show(c) {
      var u = utm(c[1], c[2]);
      ro.place.textContent = c[0] + ' (' + c[1].toFixed(3) + '° N, ' + c[2].toFixed(3) + '° E)';
      ro.zone.textContent = u.zone + 'N, central meridian ' + u.lon0 + '° E';
      ro.e.textContent = u.E.toFixed(1) + ' m';
      ro.n.textContent = u.N.toFixed(1) + ' m';
    }
    var box = controls(mount);
    var l1 = H('label', {}, box); H('span', { text: 'Latitude °N' }, l1);
    var iLat = H('input', { type: 'number', step: 'any', min: 6, max: 37, placeholder: '21.40', class: 'ia-num' }, l1);
    var l2 = H('label', {}, box); H('span', { text: 'Longitude °E' }, l2);
    var iLon = H('input', { type: 'number', step: 'any', min: 66, max: 101.9, placeholder: '79.33', class: 'ia-num' }, l2);
    var err = H('span', { class: 'ia-err', 'aria-live': 'polite' }, box);
    button(box, 'Find zone', function () {
      var la = parseFloat(iLat.value), lo = parseFloat(iLon.value);
      if (!(la >= 6 && la <= 37) || !(lo >= 66 && lo < 102)) { err.textContent = 'Enter a latitude 6–37 and a longitude 66–102 (India region).'; return; }
      err.textContent = '';
      custom = ['Your point', la, lo]; sel = 'Your point'; show(custom); draw();
    });
    [iLat, iLon].forEach(function (i) { i.addEventListener('input', function () { err.textContent = ''; }); });
    H('p', { class: 'ia-hint', text: 'Click a city, or type a point and press Find zone.' }, mount);
    ro = readout(mount, [['place', 'Place'], ['zone', 'UTM zone'], ['e', 'Easting'], ['n', 'Northing']]);
    draw(); show(cities[6]);
  };

  // ---------- start ----------
  function init() {
    var figs = document.querySelectorAll('[data-ia]');
    Array.prototype.forEach.call(figs, function (fig) {
      var name = fig.getAttribute('data-ia'), mount = fig.querySelector('.ia-mount');
      if (!mount || !builders[name]) return;
      try { builders[name](mount); fig.classList.add('ia-ready'); } catch (e) { if (window.console) console.error('interactive ' + name, e); }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
