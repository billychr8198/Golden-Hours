/* Golden Hours — travel posters.
   Every destination gets an original, hand-coded poster in the spirit of
   vintage American park posters. Scene area is 300×322; a title band sits below. */
(function () {
  'use strict';
  let uid = 0;

  function rng(seed) {
    let s = seed * 9301 + 49297;
    return function () { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  }
  const f1 = (n) => (+n).toFixed(1);
  function P(pts, close) { return pts.map((p, i) => (i ? 'L' : 'M') + f1(p[0]) + ' ' + f1(p[1])).join('') + (close === false ? '' : 'Z'); }

  // ---------- primitives ----------
  function grad(id, stops, vertical) {
    return '<linearGradient id="' + id + '" x1="0" y1="0" x2="' + (vertical === false ? 1 : 0) + '" y2="' + (vertical === false ? 0 : 1) + '">' +
      stops.map(s => '<stop offset="' + s[0] + '" stop-color="' + s[1] + '"' + (s[2] != null ? ' stop-opacity="' + s[2] + '"' : '') + '/>').join('') + '</linearGradient>';
  }
  function sky(ctx, stops, h) {
    const id = ctx.id('sky');
    ctx.defs.push(grad(id, stops));
    return '<rect x="0" y="0" width="300" height="' + (h || 322) + '" fill="url(#' + id + ')"/>';
  }
  function sun(ctx, x, y, r, col, glowCol) {
    const id = ctx.id('glow');
    ctx.defs.push('<radialGradient id="' + id + '"><stop offset="0" stop-color="' + (glowCol || col) + '" stop-opacity=".55"/><stop offset="1" stop-color="' + (glowCol || col) + '" stop-opacity="0"/></radialGradient>');
    return '<circle cx="' + x + '" cy="' + y + '" r="' + r * 3 + '" fill="url(#' + id + ')"/><circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + col + '"/>';
  }
  function ridge(r, y, amp, freq, col, o) {
    o = o || {};
    const pts = [], a = r() * 6.28, b = r() * 6.28, c = r() * 6.28, bottom = o.bottom || 322;
    const x0 = o.x0 == null ? -5 : o.x0, x1 = o.x1 == null ? 305 : o.x1;
    for (let x = x0; x <= x1; x += o.step || 5) {
      let h = Math.sin(x * freq + a) * 0.5 + Math.sin(x * freq * 2.3 + b) * 0.3 + Math.sin(x * freq * 5.1 + c) * 0.14 + (r() - 0.5) * (o.jag == null ? 0.1 : o.jag);
      if (o.peaks) o.peaks.forEach(function (pk) { const d = Math.abs(x - pk[0]) / pk[2]; if (d < 1) h += pk[1] * Math.pow(1 - d, o.sharp || 1.3); });
      if (o.tilt) h += o.tilt * (x - 150) / 150;
      pts.push([x, y - h * amp]);
    }
    pts.push([x1, bottom], [x0, bottom]);
    return '<path d="' + P(pts) + '" fill="' + col + '"' + (o.op ? ' opacity="' + o.op + '"' : '') + '/>';
  }
  function water(r, y0, y1, base, line, n, o) {
    o = o || {};
    let s = '<rect x="0" y="' + y0 + '" width="300" height="' + (y1 - y0) + '" fill="' + base + '"/>';
    for (let i = 0; i < n; i++) {
      const y = y0 + 4 + Math.pow(r(), o.pow || 1.4) * (y1 - y0 - 6);
      const cx = o.cx != null ? o.cx + (r() - 0.5) * (o.spread || 80) * (0.4 + (y - y0) / (y1 - y0)) : r() * 300;
      const w = (o.w || 30) * (0.35 + r()) * (0.5 + (y - y0) / (y1 - y0));
      s += '<rect x="' + f1(cx - w / 2) + '" y="' + f1(y) + '" width="' + f1(w) + '" height="' + f1(o.h || 1.6) + '" rx="1" fill="' + line + '" opacity="' + f1(0.45 + r() * 0.5) + '"/>';
    }
    return s;
  }
  function pine(x, y, h, col) {
    const w = h * 0.42;
    let s = '<rect x="' + f1(x - h * 0.03) + '" y="' + f1(y - h * 0.12) + '" width="' + f1(h * 0.06) + '" height="' + f1(h * 0.14) + '" fill="' + col + '"/>';
    for (let i = 0; i < 3; i++) {
      const ty = y - h * 0.1 - i * h * 0.27, tw = w * (1 - i * 0.24);
      s += '<path d="' + P([[x - tw, ty], [x + tw, ty], [x, ty - h * 0.46]]) + '" fill="' + col + '"/>';
    }
    return s;
  }
  function forest(r, x0, x1, y, n, hmin, hmax, col, jitterY) {
    let s = '';
    const trees = [];
    for (let i = 0; i < n; i++) trees.push([x0 + r() * (x1 - x0), y + (r() - 0.5) * (jitterY || 0), hmin + r() * (hmax - hmin)]);
    trees.sort((a, b) => a[1] - b[1]);
    trees.forEach(t => { s += pine(t[0], t[1], t[2], col); });
    return s;
  }
  function cloud(x, y, s, col, op) {
    return '<g fill="' + (col || '#fff') + '" opacity="' + (op == null ? 0.9 : op) + '">' +
      '<ellipse cx="' + x + '" cy="' + y + '" rx="' + 26 * s + '" ry="' + 9 * s + '"/>' +
      '<ellipse cx="' + (x - 12 * s) + '" cy="' + (y - 5 * s) + '" rx="' + 12 * s + '" ry="' + 9 * s + '"/>' +
      '<ellipse cx="' + (x + 8 * s) + '" cy="' + (y - 8 * s) + '" rx="' + 14 * s + '" ry="' + 11 * s + '"/></g>';
  }
  function streak(x, y, w, col, op) { return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="3" rx="1.5" fill="' + col + '" opacity="' + (op || 0.8) + '"/>'; }
  function birds(r, n, x, y, col) {
    let s = '';
    for (let i = 0; i < n; i++) {
      const bx = x + r() * 60, by = y + r() * 30, w = 3 + r() * 3;
      s += '<path d="M' + f1(bx - w) + ' ' + f1(by) + ' Q' + f1(bx - w / 2) + ' ' + f1(by - w * 0.6) + ' ' + f1(bx) + ' ' + f1(by) + ' Q' + f1(bx + w / 2) + ' ' + f1(by - w * 0.6) + ' ' + f1(bx + w) + ' ' + f1(by) + '" fill="none" stroke="' + col + '" stroke-width="1.2" stroke-linecap="round"/>';
    }
    return s;
  }
  function stars(r, n, ymax, col) {
    let s = '';
    for (let i = 0; i < n; i++) s += '<circle cx="' + f1(r() * 300) + '" cy="' + f1(r() * ymax) + '" r="' + f1(0.4 + r() * 1.1) + '" fill="' + (col || '#fff') + '" opacity="' + f1(0.4 + r() * 0.6) + '"/>';
    return s;
  }
  function palm(x, y, h, col, lean) {
    lean = lean || 0;
    const tx = x + lean, ty = y - h;
    let s = '<path d="M' + f1(x - 2.2) + ' ' + y + ' Q' + f1(x + lean * 0.3 - 1) + ' ' + f1(y - h * 0.5) + ' ' + f1(tx - 1) + ' ' + f1(ty) + ' L' + f1(tx + 1) + ' ' + f1(ty) + ' Q' + f1(x + lean * 0.3 + 1) + ' ' + f1(y - h * 0.5) + ' ' + f1(x + 2.2) + ' ' + y + 'Z" fill="' + col + '"/>';
    const fr = [[-1, -0.25], [-0.8, 0.2], [-0.35, 0.45], [0.35, 0.45], [0.8, 0.2], [1, -0.25], [0, -0.5]];
    fr.forEach(function (d) {
      const L = h * 0.32;
      const ex = tx + d[0] * L, ey = ty + d[1] * L * 0.9 + Math.abs(d[0]) * L * 0.35;
      s += '<path d="M' + f1(tx) + ' ' + f1(ty) + ' Q' + f1(tx + d[0] * L * 0.6) + ' ' + f1(ty - L * 0.35) + ' ' + f1(ex) + ' ' + f1(ey) + ' Q' + f1(tx + d[0] * L * 0.5) + ' ' + f1(ty - L * 0.12) + ' ' + f1(tx) + ' ' + f1(ty + 2) + 'Z" fill="' + col + '"/>';
    });
    return s;
  }
  function beams(ctx, x, y, col, n, spread) {
    const id = ctx.id('beam');
    ctx.defs.push(grad(id, [[0, col, 0.55], [1, col, 0]]));
    let s = '<g fill="url(#' + id + ')">';
    for (let i = 0; i < n; i++) {
      const a = -spread / 2 + (spread * i) / Math.max(1, n - 1);
      s += '<path d="' + P([[x, y], [x + Math.tan(a - 0.03) * 320, y + 320], [x + Math.tan(a + 0.04) * 320, y + 320]]) + '"/>';
    }
    return s + '</g>';
  }

  // ---------- scenes (numbered like the flight guide) ----------
  const S = {};

  S[1] = function (c, r) { // Yosemite & Half Dome
    let s = sky(c, [[0, '#8fb2d4'], [0.6, '#f3d6a4'], [1, '#f6e3bd']]);
    s += cloud(80, 60, 0.9, '#fff', 0.7);
    s += ridge(r, 175, 20, 0.02, '#a9b8c9');
    // Half Dome
    s += '<path d="M170 205 L172 128 Q176 88 212 84 Q250 84 268 128 Q282 160 300 176 L300 205Z" fill="#b9b0a4"/>';
    s += '<path d="M172 128 Q176 88 212 84 L196 205 L170 205Z" fill="#8e867c"/>';
    s += '<path d="M180 130 L178 205 M186 110 L183 205" stroke="#7a7269" stroke-width="1.2" opacity=".5"/>';
    // El Capitan
    s += '<path d="M0 225 L0 110 Q40 96 78 112 L96 118 L112 225Z" fill="#cfc6b8"/>';
    s += '<path d="M78 112 L96 118 L112 225 L84 225Z" fill="#9d9489"/>';
    // Yosemite Falls
    s += '<path d="M138 132 Q136 170 140 196 Q136 214 139 232" fill="none" stroke="#fdfdfb" stroke-width="3.2" stroke-linecap="round"/>';
    s += '<path d="M126 232 L124 150 Q136 124 152 138 L156 232Z" fill="#a39a8e"/><path d="M138 132 Q136 170 140 196 Q136 214 139 232" fill="none" stroke="#fff" stroke-width="2.4"/>';
    s += '<ellipse cx="139" cy="236" rx="10" ry="3" fill="#fff" opacity=".7"/>';
    s += ridge(r, 250, 8, 0.05, '#6f8f58', { jag: 0.3 });
    s += forest(r, -5, 305, 262, 38, 22, 44, '#3f6b45', 8);
    s += '<path d="M0 300 Q90 280 150 292 Q220 304 300 286 L300 322 L0 322Z" fill="#87a868"/>';
    s += '<path d="M40 322 Q120 296 190 300 Q240 303 300 296" fill="none" stroke="#7fb6d6" stroke-width="7"/>';
    s += forest(r, -10, 60, 322, 5, 70, 110, '#23402f') + forest(r, 250, 310, 322, 4, 60, 100, '#23402f');
    return s;
  };

  S[2] = function (c, r) { // Golden Gate Bridge
    let s = sky(c, [[0, '#2f4a78'], [0.45, '#e8875a'], [0.8, '#f8c86b'], [1, '#fbe0a0']]);
    s += sun(c, 205, 170, 34, '#fbd46d', '#ffcf73');
    s += streak(20, 120, 70, '#fbe3b2', 0.7) + streak(220, 98, 60, '#fbe3b2', 0.5);
    s += ridge(r, 205, 18, 0.018, '#6b6f9a', { peaks: [[40, 1.4, 70]] });
    s += '<path d="M0 214 L0 150 Q30 140 60 162 Q90 186 120 206 L130 214Z" fill="#22335a"/>';
    s += water(r, 212, 322, '#1c2f57', '#f7c46a', 46, { cx: 205, spread: 120, w: 36 });
    // bridge
    const deckY = 238, R = '#c8382a', Rd = '#8e2519';
    s += '<g stroke="' + R + '" stroke-width="1" opacity=".95">';
    for (let x = 60; x <= 300; x += 6) {
      const t = (x - 88) / (232 - 88);
      const cy = x < 88 ? 72 + (88 - x) * 1.8 : x > 232 ? 88 + (x - 232) * 0.9 : 72 + 150 * t * (1 - t) * 1.0 + (88 - 72) * t;
      s += '<line x1="' + x + '" y1="' + f1(Math.min(deckY, cy)) + '" x2="' + x + '" y2="' + deckY + '"/>';
    }
    s += '</g>';
    s += '<path d="M20 240 Q54 150 88 72 Q160 205 232 88 Q270 170 305 222" fill="none" stroke="' + R + '" stroke-width="3"/>';
    s += '<rect x="-5" y="' + deckY + '" width="310" height="7" fill="' + R + '"/><rect x="-5" y="' + (deckY + 7) + '" width="310" height="3" fill="' + Rd + '"/>';
    function tower(x, top, w) {
      let t = '<rect x="' + (x - w) + '" y="' + top + '" width="' + w * 0.55 + '" height="' + (330 - top) + '" fill="' + R + '"/><rect x="' + (x + w * 0.45) + '" y="' + top + '" width="' + w * 0.55 + '" height="' + (330 - top) + '" fill="' + Rd + '"/>';
      for (let i = 0; i < 4; i++) { const yy = top + 4 + i * (deckY - top) / 4; t += '<rect x="' + (x - w) + '" y="' + f1(yy) + '" width="' + w * 2 + '" height="' + f1(w * 0.55) + '" fill="' + R + '"/>'; }
      return t;
    }
    s += tower(88, 64, 9) + tower(232, 82, 6);
    s += '<rect x="0" y="286" width="300" height="36" fill="#fff" opacity=".18"/>';
    s += cloud(40, 292, 1.4, '#fdf1dc', 0.8) + cloud(270, 300, 1.2, '#fdf1dc', 0.7);
    return s;
  };

  function redwoodGrove(c, r, fogCol, trunk, trunkDark, crown, ground) {
    let s = '';
    for (let layer = 0; layer < 3; layer++) {
      const n = [9, 6, 4][layer], op = [0.35, 0.65, 1][layer], wmin = [6, 12, 22][layer], wmax = [10, 18, 34][layer];
      for (let i = 0; i < n; i++) {
        const x = r() * 320 - 10, w = wmin + r() * (wmax - wmin);
        s += '<g opacity="' + op + '"><path d="M' + f1(x - w / 2) + ' 330 L' + f1(x - w * 0.32) + ' -5 L' + f1(x + w * 0.32) + ' -5 L' + f1(x + w / 2) + ' 330Z" fill="' + trunk + '"/>' +
          '<path d="M' + f1(x + w * 0.05) + ' 330 L' + f1(x + w * 0.04) + ' -5 L' + f1(x + w * 0.32) + ' -5 L' + f1(x + w / 2) + ' 330Z" fill="' + trunkDark + '"/>';
        if (layer === 2) for (let k = 0; k < 6; k++) { const fx = x - w * 0.3 + r() * w * 0.6; s += '<line x1="' + f1(fx) + '" y1="' + f1(r() * 200) + '" x2="' + f1(fx) + '" y2="330" stroke="' + trunkDark + '" stroke-width="1" opacity=".5"/>'; }
        s += '</g>';
      }
      if (layer < 2) s += '<rect x="0" y="0" width="300" height="322" fill="' + fogCol + '" opacity="' + (layer ? 0.25 : 0.35) + '"/>';
    }
    s += '<path d="M0 0 L300 0 L300 34 Q220 60 150 40 Q80 60 0 36Z" fill="' + crown + '"/>';
    s += '<path d="M0 322 L0 290 Q60 276 120 292 Q200 280 300 294 L300 322Z" fill="' + ground + '"/>';
    return s;
  }

  S[3] = function (c, r) { // Redwood National Park
    let s = sky(c, [[0, '#cfe0d2'], [1, '#f4efd9']]);
    s += redwoodGrove(c, r, '#e9efe2', '#9b4a2c', '#6e2f1b', '#294a31', '#3d5f36');
    s += '<g opacity=".55">' + beams(c, 220, -10, '#fff6d6', 5, 0.7) + '</g>';
    for (let i = 0; i < 16; i++) { const x = r() * 300, y = 300 + r() * 20; s += '<path d="M' + f1(x) + ' ' + f1(y + 12) + ' Q' + f1(x - 14) + ' ' + f1(y - 6) + ' ' + f1(x - 20) + ' ' + f1(y + 2) + ' M' + f1(x) + ' ' + f1(y + 12) + ' Q' + f1(x + 14) + ' ' + f1(y - 6) + ' ' + f1(x + 20) + ' ' + f1(y + 2) + '" stroke="#5f8a45" stroke-width="3" fill="none" stroke-linecap="round"/>'; }
    return s;
  };

  S[4] = function (c, r) { // Death Valley
    let s = sky(c, [[0, '#e9a868'], [0.5, '#f6d49a'], [1, '#fbe9c6']]);
    s += sun(c, 230, 70, 22, '#fff5d8', '#ffe5a6');
    s += ridge(r, 150, 26, 0.02, '#a88aa6', { peaks: [[70, 1.2, 60]] });
    s += ridge(r, 170, 16, 0.03, '#b77f78');
    s += '<rect x="0" y="176" width="300" height="20" fill="#f7f2e6"/>';
    for (let i = 0; i < 20; i++) s += '<path d="M' + f1(r() * 300) + ' ' + f1(178 + r() * 16) + ' l6 0 l3 2 l-3 2 l-6 0 l-3 -2Z" fill="none" stroke="#d9cfbb" stroke-width=".6"/>';
    const dune = (y, amp, lit, shade) => {
      const pts = [], sh = [];
      for (let x = -5; x <= 305; x += 5) pts.push([x, y - amp * Math.pow(Math.sin((x + y) * 0.016), 2)]);
      let crest = pts.reduce((a, b) => (b[1] < a[1] ? b : a));
      return '<path d="' + P(pts.concat([[305, 322], [-5, 322]])) + '" fill="' + lit + '"/>' +
        '<path d="M' + f1(crest[0]) + ' ' + f1(crest[1]) + ' Q' + f1(crest[0] + 40) + ' ' + f1(crest[1] + amp * 0.8) + ' ' + f1(crest[0] + 95) + ' ' + f1(y + 20) + ' L' + f1(crest[0] + 140) + ' 322 L' + f1(crest[0] + 10) + ' 322Z" fill="' + shade + '"/>';
    };
    s += dune(222, 26, '#e8b06a', '#c7864c') + dune(262, 40, '#eab972', '#b86f3c') + dune(312, 52, '#f0c47f', '#a95f33');
    return s;
  };

  S[5] = function (c, r) { // Big Sur & Bixby Bridge
    let s = sky(c, [[0, '#9cc9dc'], [1, '#e9f1ea']]);
    s += cloud(60, 50, 1, '#fff', 0.8) + cloud(230, 80, 0.8, '#fff', 0.7);
    s += water(r, 150, 322, '#2f8fa0', '#bfe9ea', 28, { w: 30 });
    s += '<rect x="0" y="150" width="300" height="60" fill="#5fb3bd" opacity=".35"/>';
    // far headlands
    s += '<path d="M150 150 L150 132 Q200 108 250 118 Q280 120 300 110 L300 150Z" fill="#7a9c86"/>';
    s += '<path d="M0 322 L0 150 Q30 128 70 140 Q100 150 110 180 L118 322Z" fill="#4e7a4f"/>';
    s += '<path d="M205 322 L200 190 Q220 150 262 146 Q290 144 300 150 L300 322Z" fill="#4e7a4f"/>';
    // bridge
    const x0 = 104, x1 = 212, dy = 170;
    s += '<rect x="' + (x0 - 6) + '" y="' + dy + '" width="' + (x1 - x0 + 12) + '" height="6" fill="#efe8da"/>';
    s += '<path d="M' + x0 + ' 262 Q' + (x0 + x1) / 2 + ' 150 ' + x1 + ' 262 L' + (x1 - 7) + ' 262 Q' + (x0 + x1) / 2 + ' 162 ' + (x0 + 7) + ' 262Z" fill="#efe8da"/>';
    for (let x = x0 + 8; x < x1 - 4; x += 9) {
      const t = (x - x0) / (x1 - x0), ay = 262 - 4 * 100 * t * (1 - t) * 0.98;
      s += '<rect x="' + (x - 1.5) + '" y="' + (dy + 5) + '" width="3" height="' + f1(Math.max(0, ay - dy - 5)) + '" fill="#e2d9c7"/>';
    }
    s += '<path d="M0 322 L0 250 Q40 236 80 254 Q110 270 132 322Z" fill="#35603d"/><path d="M180 322 Q200 262 250 250 Q280 244 300 256 L300 322Z" fill="#2c5234"/>';
    for (let i = 0; i < 8; i++) { const x = 120 + r() * 70, y = 300 + r() * 18; s += '<path d="M' + f1(x) + ' ' + f1(y) + ' q8 -3 16 0" stroke="#fff" stroke-width="2" fill="none" opacity=".8"/>'; }
    return s;
  };

  S[6] = function (c, r) { // Lake Tahoe
    let s = sky(c, [[0, '#6aa6d8'], [1, '#d8eefa']]);
    s += ridge(r, 150, 36, 0.022, '#8aa3c2', { peaks: [[70, 1.1, 50], [210, 1.4, 60]] });
    s += '<path d="M40 128 L70 96 L100 128 Q85 122 70 124 Q55 120 40 128Z M180 124 L210 86 L244 124 Q226 116 212 120 Q196 116 180 124Z" fill="#fff" opacity=".9"/>';
    s += ridge(r, 170, 14, 0.04, '#4f6f7f');
    const id = c.id('lake');
    c.defs.push(grad(id, [[0, '#0f3d8a'], [0.6, '#1e67b8'], [1, '#43c2c8']]));
    s += '<rect x="0" y="176" width="300" height="146" fill="url(#' + id + ')"/>';
    s += water(r, 178, 300, 'transparent', '#cfe9ff', 26, { w: 28 });
    s += '<ellipse cx="80" cy="300" rx="120" ry="20" fill="#7fd6d0" opacity=".55"/>';
    s += '<ellipse cx="60" cy="298" rx="18" ry="9" fill="#c9c2b6"/><ellipse cx="96" cy="306" rx="12" ry="6" fill="#b4ad9f"/><ellipse cx="130" cy="296" rx="9" ry="5" fill="#d3ccbf"/>';
    s += forest(r, 180, 310, 240, 12, 40, 70, '#27463a', 20) + forest(r, -10, 40, 322, 3, 90, 120, '#1c3529');
    s += '<path d="M150 322 Q210 296 300 300 L300 322Z" fill="#d9c9a2"/>';
    return s;
  };

  function joshuaTree(x, y, h, col, r) {
    let s = '';
    const trunkTop = [x + (r() - 0.5) * 6, y - h * 0.55];
    s += '<path d="M' + f1(x) + ' ' + y + ' L' + f1(trunkTop[0]) + ' ' + f1(trunkTop[1]) + '" stroke="' + col + '" stroke-width="' + f1(h * 0.08) + '" stroke-linecap="round"/>';
    const arms = 3 + Math.floor(r() * 3);
    for (let i = 0; i < arms; i++) {
      const ax = trunkTop[0] + (r() - 0.5) * h * 0.9, ay = trunkTop[1] - h * (0.15 + r() * 0.35);
      const mx = (trunkTop[0] + ax) / 2 + (r() - 0.5) * 10, my = trunkTop[1] - h * 0.05;
      s += '<path d="M' + f1(trunkTop[0]) + ' ' + f1(trunkTop[1]) + ' Q' + f1(mx) + ' ' + f1(my) + ' ' + f1(ax) + ' ' + f1(ay) + '" fill="none" stroke="' + col + '" stroke-width="' + f1(h * 0.055) + '" stroke-linecap="round"/>';
      for (let k = 0; k < 7; k++) { const a = -Math.PI / 2 + (k - 3) * 0.35; s += '<line x1="' + f1(ax) + '" y1="' + f1(ay) + '" x2="' + f1(ax + Math.cos(a) * h * 0.13) + '" y2="' + f1(ay + Math.sin(a) * h * 0.13) + '" stroke="' + col + '" stroke-width="1.4"/>'; }
    }
    return s;
  }
  S[7] = function (c, r) { // Joshua Tree
    let s = sky(c, [[0, '#3b3a78'], [0.45, '#b2608a'], [0.75, '#f39a5c'], [1, '#fbd18a']]);
    s += stars(r, 30, 90);
    s += sun(c, 90, 205, 26, '#ffd98a', '#ffb16b');
    s += ridge(r, 205, 16, 0.02, '#7b4f78');
    s += '<rect x="0" y="205" width="300" height="117" fill="#d69a66"/>';
    s += '<path d="M0 240 Q150 222 300 236 L300 322 L0 322Z" fill="#c4855a"/>';
    const boulder = (x, y, w, h, col) => '<ellipse cx="' + x + '" cy="' + y + '" rx="' + w + '" ry="' + h + '" fill="' + col + '"/>';
    s += boulder(220, 222, 40, 22, '#a8664a') + boulder(250, 204, 26, 18, '#b9765a') + boulder(196, 208, 20, 15, '#9a5a42') + boulder(236, 186, 16, 12, '#c4836a');
    s += joshuaTree(60, 300, 120, '#2c1f2e', r) + joshuaTree(150, 270, 70, '#3d2a36', r) + joshuaTree(270, 318, 100, '#2c1f2e', r);
    return s;
  };

  S[8] = function (c, r) { // Sequoia & General Sherman
    let s = sky(c, [[0, '#a8cbe0'], [1, '#eef3e2']]);
    s += ridge(r, 120, 20, 0.03, '#b6c7cf', { peaks: [[240, 1.4, 50]] });
    s += forest(r, -10, 310, 170, 30, 30, 70, '#6f8f75', 20);
    s += '<rect x="0" y="0" width="300" height="322" fill="#f4f1e4" opacity=".3"/>';
    const giant = (x, w, dark) => {
      let g = '<path d="M' + f1(x - w * 0.62) + ' 322 Q' + f1(x - w * 0.5) + ' 290 ' + f1(x - w * 0.42) + ' 250 L' + f1(x - w * 0.36) + ' -5 L' + f1(x + w * 0.36) + ' -5 L' + f1(x + w * 0.42) + ' 250 Q' + f1(x + w * 0.5) + ' 290 ' + f1(x + w * 0.62) + ' 322Z" fill="' + (dark ? '#8f3f22' : '#b5582e') + '"/>';
      g += '<path d="M' + f1(x + w * 0.08) + ' 322 L' + f1(x + w * 0.1) + ' -5 L' + f1(x + w * 0.36) + ' -5 L' + f1(x + w * 0.42) + ' 250 Q' + f1(x + w * 0.5) + ' 290 ' + f1(x + w * 0.62) + ' 322Z" fill="#6e2e18" opacity=".7"/>';
      for (let i = 0; i < 9; i++) { const fx = x - w * 0.34 + r() * w * 0.68; g += '<path d="M' + f1(fx) + ' 0 Q' + f1(fx + (r() - 0.5) * 6) + ' 160 ' + f1(fx + (fx - x) * 0.4) + ' 322" stroke="#5a2412" stroke-width="1.3" fill="none" opacity=".55"/>'; }
      return g;
    };
    s += giant(40, 70, true) + giant(190, 120, false);
    s += '<path d="M0 0 L300 0 L300 40 Q250 70 200 44 Q150 72 90 40 Q40 64 0 44Z" fill="#35583a"/>';
    s += '<path d="M0 322 L0 300 Q150 286 300 304 L300 322Z" fill="#7b8f5b"/>';
    // hiker for scale
    s += '<g fill="#23324d"><circle cx="128" cy="286" r="3"/><rect x="126" y="289" width="4" height="10" rx="1.5"/><rect x="126" y="298" width="1.6" height="7"/><rect x="128.6" y="298" width="1.6" height="7"/><rect x="129.5" y="290" width="4" height="6" rx="1" fill="#c0362c"/></g>';
    return s;
  };

  S[9] = function (c, r) { // Anaheim theme-park night
    let s = sky(c, [[0, '#0d1638'], [0.6, '#2c2a6b'], [1, '#6b4a8c']]);
    s += stars(r, 40, 200);
    const burst = (x, y, rad, col) => {
      let b = '<g stroke="' + col + '" stroke-width="1.6" stroke-linecap="round">';
      for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; b += '<line x1="' + f1(x + Math.cos(a) * rad * 0.3) + '" y1="' + f1(y + Math.sin(a) * rad * 0.3) + '" x2="' + f1(x + Math.cos(a) * rad) + '" y2="' + f1(y + Math.sin(a) * rad) + '"/><circle cx="' + f1(x + Math.cos(a) * rad * 1.12) + '" cy="' + f1(y + Math.sin(a) * rad * 1.12) + '" r="1.3" fill="' + col + '" stroke="none"/>'; }
      return b + '</g>';
    };
    s += burst(70, 70, 34, '#ffd36b') + burst(230, 60, 28, '#ff7aa8') + burst(160, 110, 22, '#8ee8ff') + burst(260, 130, 16, '#fff');
    // storybook castle (generic)
    const C = '#e9dff2', CD = '#c5b5dc', roof = '#5b79c9';
    const tower = (x, top, w, h) => '<rect x="' + (x - w / 2) + '" y="' + top + '" width="' + w + '" height="' + h + '" fill="' + C + '"/><rect x="' + x + '" y="' + top + '" width="' + w / 2 + '" height="' + h + '" fill="' + CD + '"/><path d="' + P([[x - w / 2 - 3, top], [x + w / 2 + 3, top], [x, top - w * 1.9]]) + '" fill="' + roof + '"/><rect x="' + (x - 1.5) + '" y="' + (top + 10) + '" width="3" height="6" rx="1.5" fill="#ffd36b"/>';
    s += '<rect x="80" y="210" width="140" height="70" fill="' + C + '"/><rect x="150" y="210" width="70" height="70" fill="' + CD + '"/>';
    for (let x = 80; x < 220; x += 10) s += '<rect x="' + x + '" y="204" width="6" height="6" fill="' + C + '"/>';
    s += tower(150, 150, 26, 130) + tower(112, 180, 18, 100) + tower(188, 176, 18, 104) + tower(84, 204, 14, 76) + tower(216, 202, 14, 78) + tower(132, 170, 12, 40) + tower(170, 166, 12, 44);
    s += '<path d="M140 280 L140 256 Q150 244 160 256 L160 280Z" fill="#2a2450"/>';
    s += '<path d="M0 322 L0 276 Q150 262 300 278 L300 322Z" fill="#1e3a36"/>';
    s += palm(22, 300, 86, '#101a2e', -6) + palm(282, 306, 92, '#101a2e', 8);
    return s;
  };

  S[10] = function (c, r) { // Hollywood hills & Griffith Observatory
    let s = sky(c, [[0, '#23305e'], [0.5, '#c46a6a'], [0.85, '#f5ae6b'], [1, '#fbd796']]);
    s += stars(r, 14, 70);
    s += ridge(r, 150, 20, 0.02, '#8a5f6f', { peaks: [[90, 1.2, 70]] });
    // abstract sign blocks on distant hill
    for (let i = 0; i < 9; i++) s += '<rect x="' + (52 + i * 11) + '" y="' + f1(118 + Math.sin(i * 0.8) * 2) + '" width="7" height="10" fill="#fdf7ea" opacity=".95"/>';
    s += ridge(r, 205, 26, 0.02, '#5b4a62', { peaks: [[210, 1.6, 80]] });
    // observatory
    const ox = 210, oy = 170;
    s += '<rect x="' + (ox - 50) + '" y="' + oy + '" width="100" height="18" fill="#f1ece2"/><rect x="' + (ox - 50) + '" y="' + (oy + 14) + '" width="100" height="4" fill="#cfc6b8"/>';
    s += '<path d="M' + (ox - 20) + ' ' + oy + ' A20 20 0 0 1 ' + (ox + 20) + ' ' + oy + 'Z" fill="#6f8aa3"/><rect x="' + (ox - 22) + '" y="' + (oy - 2) + '" width="44" height="4" fill="#f1ece2"/>';
    s += '<path d="M' + (ox - 50) + ' ' + oy + ' A9 9 0 0 1 ' + (ox - 32) + ' ' + oy + 'Z M' + (ox + 32) + ' ' + oy + ' A9 9 0 0 1 ' + (ox + 50) + ' ' + oy + 'Z" fill="#6f8aa3"/>';
    s += '<line x1="' + ox + '" y1="' + (oy - 20) + '" x2="' + (ox - 60) + '" y2="' + (oy - 110) + '" stroke="#fff6d8" stroke-width="1" opacity=".5"/>';
    s += '<rect x="0" y="232" width="300" height="90" fill="#1d1f3e"/>';
    for (let i = 0; i < 180; i++) { const y = 236 + Math.pow(r(), 0.8) * 84; s += '<rect x="' + f1(r() * 300) + '" y="' + f1(y) + '" width="' + f1(1 + r() * 2) + '" height="1.4" fill="' + (r() > 0.7 ? '#ffcf73' : '#fff3d0') + '" opacity="' + f1(0.4 + r() * 0.6) + '"/>'; }
    s += palm(40, 250, 70, '#141630', -4) + palm(60, 252, 58, '#141630', 5);
    return s;
  };

  S[11] = function (c, r) { // Alcatraz
    let s = sky(c, [[0, '#8fa5ba'], [1, '#dfe4e2']]);
    s += '<g fill="#a3b0bd" opacity=".7">';
    for (let i = 0; i < 16; i++) { const w = 8 + r() * 14, h = 20 + r() * 60, x = 170 + i * 8; s += '<rect x="' + f1(x) + '" y="' + f1(170 - h) + '" width="' + f1(w) + '" height="' + f1(h) + '"/>'; }
    s += '</g>';
    s += water(r, 170, 322, '#2c4a63', '#9fb8c8', 34, { w: 30 });
    s += '<path d="M40 222 Q60 188 110 184 L200 182 Q240 186 262 222Z" fill="#6b6a55"/>';
    s += '<path d="M60 222 Q80 204 120 204 L230 204 Q250 210 262 222Z" fill="#4c4b3c"/>';
    s += '<rect x="96" y="160" width="120" height="26" fill="#e2dccd"/><rect x="96" y="160" width="120" height="4" fill="#bfb7a5"/>';
    for (let x = 100; x < 214; x += 6) s += '<rect x="' + x + '" y="168" width="3" height="10" fill="#6c6b62"/>';
    s += '<rect x="224" y="148" width="4" height="36" fill="#5f5d52"/><rect x="236" y="148" width="4" height="36" fill="#5f5d52"/><rect x="220" y="136" width="24" height="16" fill="#9a968a"/>';
    s += '<rect x="84" y="120" width="9" height="46" fill="#f1ece0"/><path d="M82 120 L95 120 L88.5 110Z" fill="#383b40"/><rect x="85" y="113" width="7" height="6" fill="#ffdf8a"/>';
    s += '<rect x="0" y="228" width="300" height="30" fill="#fff" opacity=".22"/>';
    s += cloud(60, 250, 1.6, '#f2f4f2', 0.6) + cloud(250, 244, 1.3, '#f2f4f2', 0.55);
    s += birds(r, 5, 170, 70, '#3a4552');
    return s;
  };

  S[12] = function (c, r) { // Monterey Bay & Cannery Row
    let s = sky(c, [[0, '#c3dbe6'], [1, '#f2efe2']]);
    s += ridge(r, 110, 12, 0.02, '#9fb3b0');
    s += water(r, 112, 322, '#2b6f86', '#bde2e6', 22, { w: 26 });
    // canneries on stilts
    const bld = (x, w, h, col, roof) => '<rect x="' + x + '" y="' + (150 - h) + '" width="' + w + '" height="' + h + '" fill="' + col + '"/><path d="' + P([[x - 3, 150 - h], [x + w + 3, 150 - h], [x + w / 2, 150 - h - w * 0.3]]) + '" fill="' + roof + '"/>' + [0.2, 0.5, 0.8].map(k => '<rect x="' + f1(x + w * k - 1) + '" y="150" width="2" height="16" fill="#4a4036"/>').join('');
    s += bld(140, 44, 36, '#c9a27a', '#8b5a3c') + bld(188, 34, 44, '#e7dcc6', '#6d7f8c') + bld(226, 60, 30, '#b77a56', '#6e3f2a') + bld(290, 30, 40, '#d8cdb8', '#7a4a35');
    // cypress
    s += '<path d="M40 150 L44 108 M44 120 Q20 110 10 118 Q24 104 44 110 Q60 96 84 104 Q70 112 50 116" stroke="#3a3a2e" stroke-width="4" fill="#2f4d3a" stroke-linejoin="round"/>';
    s += '<path d="M0 150 Q30 132 70 144 L80 160 L0 168Z" fill="#6b6150"/>';
    // kelp
    for (let i = 0; i < 12; i++) { const x = r() * 300, top = 190 + r() * 50; s += '<path d="M' + f1(x) + ' 322 Q' + f1(x + 12) + ' ' + f1((top + 322) / 2) + ' ' + f1(x - 4) + ' ' + f1(top) + '" stroke="#8a7a2c" stroke-width="3" fill="none" opacity=".55"/>'; }
    // sea otter floating on its back
    s += '<g transform="translate(150 250)"><ellipse cx="0" cy="0" rx="34" ry="9" fill="#6b4a33"/><ellipse cx="-30" cy="-5" rx="10" ry="9" fill="#d9c6ac"/><circle cx="-33" cy="-7" r="1.6" fill="#1b1410"/><circle cx="-38" cy="-4" r="1.4" fill="#1b1410"/><ellipse cx="-10" cy="-6" rx="7" ry="4" fill="#8a6446"/><ellipse cx="30" cy="-2" rx="7" ry="4" fill="#5a3c28"/><circle cx="-6" cy="-10" r="3.5" fill="#c9b18a"/></g>';
    s += '<ellipse cx="150" cy="262" rx="50" ry="3" fill="#bde2e6" opacity=".6"/>';
    return s;
  };

  S[13] = function (c, r) { // Santa Monica Pier
    let s = sky(c, [[0, '#4e5f9e'], [0.45, '#e77f73'], [0.8, '#fbb867'], [1, '#fde0a2']]);
    s += sun(c, 80, 178, 30, '#ffe28f', '#ffb86b');
    s += water(r, 180, 322, '#3a4f8c', '#ffd98c', 44, { cx: 80, spread: 110, w: 30 });
    // pier
    s += '<rect x="30" y="206" width="280" height="6" fill="#4a2f2a"/>';
    for (let x = 34; x < 300; x += 12) s += '<rect x="' + x + '" y="212" width="3" height="' + (30 + (x % 24)) + '" fill="#3b2522"/>';
    // Ferris wheel
    const fx = 210, fy = 142, R = 52;
    s += '<circle cx="' + fx + '" cy="' + fy + '" r="' + R + '" fill="none" stroke="#fff4e0" stroke-width="2.4"/><circle cx="' + fx + '" cy="' + fy + '" r="' + (R - 7) + '" fill="none" stroke="#fff4e0" stroke-width="1"/>';
    const cols = ['#ff5a5a', '#ffd35a', '#5ad1ff', '#b67aff', '#6dff9e'];
    for (let i = 0; i < 20; i++) {
      const a = i / 20 * Math.PI * 2;
      s += '<line x1="' + fx + '" y1="' + fy + '" x2="' + f1(fx + Math.cos(a) * R) + '" y2="' + f1(fy + Math.sin(a) * R) + '" stroke="#fff4e0" stroke-width=".7"/><circle cx="' + f1(fx + Math.cos(a) * R) + '" cy="' + f1(fy + Math.sin(a) * R + 4) + '" r="3.4" fill="' + cols[i % 5] + '"/>';
    }
    s += '<path d="M' + (fx - 22) + ' 206 L' + fx + ' ' + fy + ' L' + (fx + 22) + ' 206" stroke="#e8d9c0" stroke-width="3" fill="none"/>';
    // coaster track
    s += '<path d="M100 206 Q110 160 124 170 Q134 178 140 150 Q150 120 160 170 Q166 196 176 206" fill="none" stroke="#f3e3c3" stroke-width="2"/>';
    for (let x = 104; x < 176; x += 6) s += '<line x1="' + x + '" y1="206" x2="' + x + '" y2="' + (180 - Math.sin(x * 0.12) * 18) + '" stroke="#f3e3c3" stroke-width=".7" opacity=".7"/>';
    s += palm(18, 214, 92, '#2b1d33', 6) + palm(282, 260, 70, '#2b1d33', -4);
    return s;
  };

  S[14] = function (c, r) { // Point Reyes
    let s = sky(c, [[0, '#a7bccb'], [1, '#e8ece6']]);
    s += water(r, 150, 322, '#244a6a', '#c6dbe6', 30, { w: 32 });
    s += '<rect x="0" y="130" width="300" height="46" fill="#fff" opacity=".45"/>';
    s += '<path d="M300 322 L300 110 Q250 100 210 130 Q170 160 150 200 Q140 230 110 250 Q80 262 60 322Z" fill="#7d8f58"/>';
    s += '<path d="M300 322 L300 150 Q256 160 226 196 Q196 236 170 270 Q150 300 120 322Z" fill="#5a6c3f"/>';
    s += '<path d="M150 200 Q140 230 110 250 Q80 262 60 322 L90 322 Q110 272 140 250 Q160 230 168 206Z" fill="#8d7a5a"/>';
    // lighthouse on lower ledge
    s += '<path d="M168 196 L176 216 L156 216Z" fill="#5a4a3a"/><rect x="160" y="178" width="10" height="22" fill="#f6f2ea"/><rect x="158" y="174" width="14" height="5" fill="#c0362c"/><path d="M158 174 L172 174 L165 166Z" fill="#c0362c"/><rect x="162" y="168" width="6" height="6" fill="#ffe28a"/>';
    s += '<line x1="165" y1="178" x2="' + 290 + '" y2="126" stroke="#fff" stroke-width=".8" opacity=".7"/>';
    // whale tail
    s += '<path d="M70 222 Q72 208 64 200 Q76 204 80 214 Q84 204 96 200 Q88 208 90 222Z" fill="#2c3e52"/><ellipse cx="80" cy="224" rx="16" ry="2.5" fill="#fff" opacity=".7"/>';
    for (let i = 0; i < 30; i++) { const x = 180 + r() * 120, y = 260 + r() * 60; s += '<line x1="' + f1(x) + '" y1="' + f1(y) + '" x2="' + f1(x + (r() - 0.5) * 6) + '" y2="' + f1(y - 8 - r() * 8) + '" stroke="#c9b770" stroke-width="1.2"/>'; }
    return s;
  };

  S[15] = function (c, r) { // Lassen Volcanic
    let s = sky(c, [[0, '#5f86b8'], [1, '#e9e2cf']]);
    s += '<path d="M40 190 Q110 60 150 54 Q190 60 262 190Z" fill="#7a6e72"/>';
    s += '<path d="M112 110 Q140 64 150 56 Q162 64 188 110 Q170 100 160 108 Q150 96 138 108 Q126 100 112 110Z" fill="#fbfaf6"/>';
    s += '<path d="M150 54 Q190 60 262 190 L210 190 Q180 120 150 54Z" fill="#5d5258" opacity=".6"/>';
    s += ridge(r, 205, 12, 0.04, '#46634d');
    s += forest(r, -10, 310, 228, 26, 22, 40, '#2d4a37', 10);
    s += '<path d="M0 322 L0 244 Q150 230 300 246 L300 322Z" fill="#d9b25f"/>';
    s += '<ellipse cx="96" cy="276" rx="44" ry="11" fill="#e38a3a"/><ellipse cx="96" cy="276" rx="30" ry="7" fill="#57c7c3"/>';
    s += '<ellipse cx="220" cy="296" rx="52" ry="12" fill="#c46b2d"/><ellipse cx="220" cy="296" rx="34" ry="7" fill="#7fd8c9"/>';
    s += '<path d="M0 262 L300 262" stroke="#8a6a44" stroke-width="3"/>';
    for (let i = 0; i < 4; i++) s += cloud(80 + i * 45, 238 - i * 14, 0.7 + i * 0.15, '#fff', 0.55);
    return s;
  };

  S[16] = function (c, r) { // Mount Shasta
    let s = sky(c, [[0, '#4a4e8a'], [0.55, '#c48aa6'], [1, '#f6cda0']]);
    // lenticular stack
    for (let i = 0; i < 3; i++) s += '<ellipse cx="150" cy="' + (48 - i * 11) + '" rx="' + (86 - i * 18) + '" ry="7" fill="#fbe7ef" opacity="' + (0.9 - i * 0.2) + '"/>';
    s += '<path d="M10 240 Q90 150 132 72 Q150 54 168 72 Q210 150 290 240Z" fill="#8a88b4"/>';
    s += '<path d="M78 172 Q110 118 132 72 Q150 54 168 72 Q192 118 222 172 Q200 158 188 168 Q176 150 160 164 Q148 146 136 164 Q120 150 108 166 Q94 156 78 172Z" fill="#fdf6f2"/>';
    s += '<path d="M150 58 Q170 70 210 150 L290 240 L210 240 Q178 140 150 58Z" fill="#6b6a96" opacity=".5"/>';
    s += '<path d="M200 118 Q210 100 226 102 Q214 108 208 124Z" fill="#fdf6f2"/>';
    s += '<path d="M0 322 L0 236 Q150 222 300 238 L300 322Z" fill="#b99b6a"/>';
    s += forest(r, -10, 310, 262, 24, 26, 46, '#324838', 16);
    s += '<path d="M0 322 L0 296 Q150 284 300 298 L300 322Z" fill="#8f8a5a"/>';
    return s;
  };

  S[17] = function (c, r) { // Napa Valley
    let s = sky(c, [[0, '#8ec0e0'], [1, '#f8e9c4']]);
    s += ridge(r, 132, 18, 0.02, '#8e9fb5');
    s += ridge(r, 150, 12, 0.03, '#7c9160');
    const id = c.id('vine');
    c.defs.push(grad(id, [[0, '#a6b25a'], [1, '#6f8a3a']]));
    s += '<rect x="0" y="152" width="300" height="170" fill="url(#' + id + ')"/>';
    const tints = ['#c9a23c', '#b8612e', '#8c9a3c', '#d7b24a'];
    for (let i = -22; i <= 22; i++) {
      const xb = 150 + i * 26;
      s += '<path d="M150 152 L' + f1(xb - 6) + ' 322 L' + f1(xb + 6) + ' 322Z" fill="' + tints[(i + 40) % 4] + '" opacity=".8"/>';
    }
    // barn
    s += '<rect x="196" y="140" width="34" height="18" fill="#a4332a"/><path d="M193 140 L233 140 L213 126Z" fill="#6e2019"/><rect x="209" y="148" width="8" height="10" fill="#f3e6cc"/>';
    s += '<g transform="translate(60 150)"><rect x="-2" y="-18" width="4" height="18" fill="#4a3a2a"/><ellipse cx="0" cy="-26" rx="20" ry="14" fill="#4f6b36"/></g>';
    // balloon
    s += '<g transform="translate(222 70)"><path d="M0 -26 C20 -26 26 -6 14 12 L6 22 L-6 22 L-14 12 C-26 -6 -20 -26 0 -26Z" fill="#e24b3c"/><path d="M0 -26 C8 -26 10 -6 5 12 L2 22 L-2 22 L-5 12 C-10 -6 -8 -26 0 -26Z" fill="#f6c850"/><rect x="-4" y="26" width="8" height="6" fill="#6b4a2a"/><line x1="-5" y1="22" x2="-4" y2="26" stroke="#6b4a2a"/><line x1="5" y1="22" x2="4" y2="26" stroke="#6b4a2a"/></g>';
    return s;
  };

  S[18] = function (c, r) { // Santa Barbara
    let s = sky(c, [[0, '#6fb1dc'], [1, '#e9f3f2']]);
    s += ridge(r, 128, 30, 0.02, '#6f8b6c', { peaks: [[200, 1, 90]] });
    s += '<rect x="0" y="150" width="300" height="40" fill="#2e7fb0"/>' + water(r, 152, 188, 'transparent', '#d5eef8', 12, { w: 30 });
    const house = (x, y, w, h) => '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="#fbf7ee"/><path d="' + P([[x - 3, y], [x + w + 3, y], [x + w * 0.7, y - h * 0.35], [x + w * 0.3, y - h * 0.35]]) + '" fill="#c3532e"/><rect x="' + (x + w * 0.2) + '" y="' + (y + h * 0.35) + '" width="' + w * 0.18 + '" height="' + h * 0.3 + '" rx="' + w * 0.09 + '" fill="#6e5a48"/>';
    for (let i = 0; i < 14; i++) s += house(-10 + i * 24 + r() * 8, 196 + (i % 3) * 10 + r() * 6, 24 + r() * 10, 16 + r() * 8);
    // mission bell tower
    s += '<rect x="126" y="150" width="48" height="110" fill="#f5eee0"/><rect x="152" y="150" width="22" height="110" fill="#e2d6c1"/>';
    s += '<path d="M136 176 L136 164 Q141 156 146 164 L146 176Z M156 176 L156 164 Q161 156 166 164 L166 176Z" fill="#6e5a48"/><circle cx="141" cy="170" r="3" fill="#d4a441"/><circle cx="161" cy="170" r="3" fill="#d4a441"/>';
    s += '<path d="M122 150 L178 150 L170 138 L130 138Z" fill="#c3532e"/><path d="M140 138 Q150 118 160 138Z" fill="#f5eee0"/><line x1="150" y1="122" x2="150" y2="110" stroke="#3b3a36" stroke-width="2"/><line x1="145" y1="114" x2="155" y2="114" stroke="#3b3a36" stroke-width="2"/>';
    s += '<path d="M0 322 L0 262 Q150 252 300 264 L300 322Z" fill="#8ba35f"/>';
    s += palm(40, 300, 110, '#2d4a34', -5) + palm(262, 306, 124, '#2d4a34', 6) + palm(90, 318, 70, '#2d4a34', 3);
    return s;
  };

  S[19] = function (c, r) { // Channel Islands
    let s = sky(c, [[0, '#76b5d9'], [1, '#e6f2ee']]);
    s += '<path d="M120 150 Q170 120 230 128 Q280 132 300 146 L300 150Z" fill="#8aa0a0"/>';
    s += water(r, 150, 322, '#1f6a8e', '#bfe6ee', 30, { w: 30 });
    // arch rock
    s += '<path d="M40 212 L44 170 Q60 150 84 150 Q110 152 120 180 L124 212 L104 212 Q102 190 84 188 Q66 190 64 212Z" fill="#8d6b52"/><path d="M84 150 Q110 152 120 180 L124 212 L110 212 Q108 176 84 150Z" fill="#6c4f3c"/>';
    s += '<path d="M84 150 Q96 144 110 150" stroke="#e9e1cc" stroke-width="3" fill="none"/>';
    // cliff foreground
    s += '<path d="M150 322 L160 250 Q200 214 250 210 Q286 208 300 214 L300 322Z" fill="#b4935f"/><path d="M160 250 Q200 214 250 210 Q286 208 300 214 L300 232 Q240 226 200 250 Q180 262 172 322 L150 322Z" fill="#8a9c5a"/>';
    // island fox
    s += '<g transform="translate(232 214)"><path d="M-14 0 Q-12 -14 0 -16 Q10 -16 12 -6 L12 0Z" fill="#8a7f78"/><path d="M-14 -2 Q-30 -6 -34 4 Q-26 2 -16 4Z" fill="#6f625c"/><path d="M-12 -4 Q-4 -2 2 -8 L12 -6 L12 0 L-12 0Z" fill="#c07a4a"/><circle cx="10" cy="-20" r="7" fill="#8a7f78"/><path d="M6 -26 L7 -33 L11 -27Z M11 -26 L14 -32 L15 -25Z" fill="#6f625c"/><path d="M14 -18 L20 -16 L14 -15Z" fill="#f2ece4"/><circle cx="12" cy="-21" r="1.1" fill="#1a1412"/></g>';
    for (let i = 0; i < 6; i++) { const x = 20 + r() * 120; s += '<path d="M' + f1(x) + ' 322 Q' + f1(x + 8) + ' 280 ' + f1(x - 2) + ' 244" stroke="#b69a3c" stroke-width="2.5" fill="none" opacity=".5"/>'; }
    s += birds(r, 4, 150, 70, '#2f4553');
    return s;
  };

  S[20] = function (c, r) { // San Diego Zoo & Balboa Park
    let s = sky(c, [[0, '#76b9e0'], [1, '#f1f3dc']]);
    // California Tower
    s += '<rect x="128" y="96" width="44" height="130" fill="#f3e6cc"/><rect x="150" y="96" width="22" height="130" fill="#e0cfae"/>';
    s += '<rect x="132" y="70" width="36" height="28" fill="#f3e6cc"/><path d="M134 72 Q150 36 166 72Z" fill="#2f78b8"/><path d="M150 38 L150 24" stroke="#c9a14a" stroke-width="2"/>';
    s += '<path d="M140 132 L140 118 Q150 106 160 118 L160 132Z" fill="#8a6a4a"/><path d="M140 170 L140 156 Q150 146 160 156 L160 170Z" fill="#8a6a4a"/>';
    s += '<path d="M118 100 L182 100 L176 94 L124 94Z" fill="#c78a4a"/>';
    s += '<path d="M0 322 L0 196 Q150 170 300 196 L300 322Z" fill="#4f8a4a"/>';
    s += palm(40, 230, 110, '#2c5a36', -6) + palm(78, 226, 90, '#2c5a36', 4) + palm(250, 232, 120, '#2c5a36', 6);
    s += '<ellipse cx="150" cy="286" rx="140" ry="26" fill="#5fb3c4"/>' + water(r, 266, 306, 'transparent', '#dff4f6', 10, { w: 26 });
    const flamingo = (x, y, s2, flip) => '<g transform="translate(' + x + ' ' + y + ') scale(' + (flip ? -s2 : s2) + ' ' + s2 + ')"><ellipse cx="0" cy="0" rx="12" ry="7" fill="#f47ea0"/><path d="M8 -3 Q16 -10 12 -22 Q9 -32 16 -34" stroke="#f47ea0" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M16 -34 L22 -31" stroke="#2a2a2a" stroke-width="2.5" stroke-linecap="round"/><line x1="0" y1="6" x2="0" y2="26" stroke="#e0607f" stroke-width="1.4"/><path d="M0 16 L6 12" stroke="#e0607f" stroke-width="1.4"/></g>';
    s += flamingo(110, 270, 1, false) + flamingo(160, 276, 1.1, true) + flamingo(200, 266, 0.9, false);
    for (let i = 0; i < 5; i++) { const x = r() * 300; s += '<path d="M' + f1(x) + ' 330 Q' + f1(x - 30) + ' 300 ' + f1(x - 40) + ' 280 Q' + f1(x - 10) + ' 290 ' + f1(x + 4) + ' 330Z" fill="#2e6a3a"/>'; }
    return s;
  };

  S[21] = function (c, r) { // Catalina Island, Avalon
    let s = sky(c, [[0, '#5aa8d8'], [1, '#e2f2f2']]);
    s += '<path d="M0 190 L0 120 Q60 80 120 110 Q180 70 240 96 Q280 110 300 104 L300 190Z" fill="#8a9a64"/><path d="M0 190 L0 150 Q80 120 160 140 Q240 120 300 136 L300 190Z" fill="#6f8350"/>';
    // bison
    s += '<g transform="translate(70 118) scale(.8)"><path d="M-14 0 Q-16 -14 -4 -16 Q10 -18 14 -8 L16 0Z" fill="#3a2a20"/><rect x="-12" y="0" width="3" height="6" fill="#3a2a20"/><rect x="8" y="0" width="3" height="6" fill="#3a2a20"/><circle cx="16" cy="-6" r="4" fill="#3a2a20"/></g>';
    s += water(r, 186, 322, '#1b7fa6', '#c7ecf2', 26, { w: 26 });
    s += '<path d="M0 186 Q150 240 300 186 L300 196 Q150 250 0 196Z" fill="#e8dcc0"/>';
    // casino rotunda
    s += '<rect x="226" y="150" width="60" height="40" fill="#f6efe2"/><rect x="256" y="150" width="30" height="40" fill="#e3d6be"/><path d="M222 152 Q256 124 290 152Z" fill="#b8472e"/>';
    for (let x = 230; x < 284; x += 8) s += '<rect x="' + x + '" y="160" width="4" height="14" rx="2" fill="#6d5a48"/>';
    for (let i = 0; i < 10; i++) { const x = 20 + r() * 200, y = 222 + r() * 80, h = 12 + r() * 10; s += '<path d="M' + f1(x) + ' ' + f1(y) + ' L' + f1(x) + ' ' + f1(y - h) + ' L' + f1(x + h * 0.6) + ' ' + f1(y) + 'Z" fill="#fff"/><path d="M' + f1(x - 6) + ' ' + f1(y) + ' L' + f1(x + h * 0.7) + ' ' + f1(y) + ' L' + f1(x + h * 0.6) + ' ' + f1(y + 3) + ' L' + f1(x - 4) + ' ' + f1(y + 3) + 'Z" fill="#fdf6e8"/>'; }
    for (let i = 0; i < 12; i++) s += '<rect x="' + (10 + i * 16) + '" y="' + f1(180 + Math.sin(i) * 3) + '" width="12" height="8" fill="' + ['#f3c24a', '#e86a4a', '#f6efe2', '#7bb5d8'][i % 4] + '"/>';
    return s;
  };

  S[22] = function (c, r) { // Pinnacles & condor
    let s = sky(c, [[0, '#6f9fcc'], [1, '#f4e6c8']]);
    s += cloud(230, 60, 0.9, '#fff', 0.8);
    const spire = (x, w, top, col, shade) => {
      const pts = [[x - w, 262]];
      const steps = 7;
      for (let i = 0; i <= steps; i++) { const t = i / steps; pts.push([x - w + t * w * 0.9 + (r() - 0.5) * 6, 262 - (262 - top) * Math.sin(t * Math.PI / 2) + (r() - 0.5) * 8]); }
      pts.push([x + w * 0.2, top - 6], [x + w * 0.5, top + 20]);
      for (let i = 0; i <= 5; i++) { const t = i / 5; pts.push([x + w * 0.5 + t * w * 0.5 + (r() - 0.5) * 6, top + 20 + (262 - top - 20) * t]); }
      return '<path d="' + P(pts) + '" fill="' + col + '"/><path d="M' + (x + w * 0.2) + ' ' + (top - 6) + ' L' + (x + w * 0.5) + ' ' + (top + 20) + ' L' + (x + w) + ' 262 L' + (x + w * 0.2) + ' 262Z" fill="' + shade + '" opacity=".7"/>';
    };
    s += spire(60, 40, 110, '#c98a4a', '#9a5f30') + spire(140, 34, 80, '#d69a58', '#a4683a') + spire(210, 46, 120, '#c07c40', '#8f5528') + spire(270, 30, 150, '#d39556', '#9e6334');
    s += '<path d="M0 322 L0 250 Q150 236 300 252 L300 322Z" fill="#c9b36a"/>';
    for (let i = 0; i < 9; i++) { const x = r() * 300, y = 262 + r() * 50; s += '<ellipse cx="' + f1(x) + '" cy="' + f1(y) + '" rx="' + f1(10 + r() * 8) + '" ry="' + f1(7 + r() * 4) + '" fill="#5a6f3a"/><rect x="' + f1(x - 1) + '" y="' + f1(y + 4) + '" width="2" height="6" fill="#4a3a2a"/>'; }
    // condor
    s += '<g transform="translate(120 52)"><path d="M0 0 Q-30 -8 -64 -2 L-58 2 L-66 4 L-56 6 L-62 9 L-40 8 Q-20 8 -6 6Z M0 0 Q30 -8 64 -2 L58 2 L66 4 L56 6 L62 9 L40 8 Q20 8 6 6Z" fill="#1c1c22"/><path d="M-40 6 Q-20 6 -8 4 L8 4 Q20 6 40 6 Q20 10 0 10 Q-20 10 -40 6Z" fill="#f1ede4"/><ellipse cx="0" cy="4" rx="6" ry="9" fill="#1c1c22"/><circle cx="0" cy="-6" r="3.6" fill="#e27a5a"/><path d="M-5 16 L0 22 L5 16Z" fill="#1c1c22"/></g>';
    return s;
  };

  S[23] = function (c, r) { // Palm Springs Aerial Tramway
    let s = sky(c, [[0, '#4f86c2'], [1, '#f6dcb4']]);
    s += '<path d="M80 322 L140 60 Q170 40 200 60 Q230 50 300 80 L300 322Z" fill="#8a7a8c"/>';
    s += '<path d="M140 60 Q170 40 200 60 Q230 50 300 80 L300 110 Q250 90 210 100 Q180 84 150 100Z" fill="#fbfaf7"/>';
    s += forest(r, 150, 300, 118, 14, 12, 20, '#3a5a44', 10);
    s += '<path d="M140 60 L80 322 L110 322 Q130 200 158 90Z" fill="#6c5e70" opacity=".6"/>';
    s += '<path d="M0 322 L0 262 Q150 250 300 266 L300 322Z" fill="#e2bd86"/>';
    // cables
    s += '<line x1="40" y1="270" x2="220" y2="92" stroke="#2c2a36" stroke-width="1.2"/><line x1="46" y1="272" x2="226" y2="94" stroke="#2c2a36" stroke-width="1.2"/>';
    s += '<rect x="34" y="258" width="18" height="14" fill="#e9e4dc"/><rect x="214" y="82" width="20" height="14" fill="#e9e4dc"/>';
    // rotating tram car
    s += '<g transform="translate(134 176)"><line x1="0" y1="-18" x2="0" y2="-6" stroke="#2c2a36" stroke-width="2"/><rect x="-16" y="-6" width="32" height="18" rx="7" fill="#e6e1d8"/><rect x="-13" y="-2" width="26" height="7" rx="3" fill="#6fb6e0"/><rect x="-16" y="9" width="32" height="3" fill="#c0362c"/></g>';
    s += palm(40, 318, 76, '#3e5a3a', -3) + palm(270, 314, 90, '#3e5a3a', 4) + palm(292, 318, 64, '#3e5a3a', 2);
    return s;
  };

  S[24] = function (c, r) { // Mendocino
    let s = sky(c, [[0, '#8fb1c9'], [1, '#eef0e4']]);
    s += water(r, 150, 322, '#2a5b7a', '#d6e7ee', 32, { w: 28 });
    const stack = (x, w, h, col) => '<path d="M' + (x - w) + ' 230 L' + (x - w * 0.7) + ' ' + (230 - h) + ' Q' + x + ' ' + (224 - h) + ' ' + (x + w * 0.7) + ' ' + (230 - h + 6) + ' L' + (x + w) + ' 230Z" fill="' + col + '"/><path d="M' + (x - w - 4) + ' 230 q' + (w + 4) + ' -6 ' + (w * 2 + 8) + ' 0" stroke="#fff" stroke-width="2" fill="none"/>';
    s += stack(40, 14, 50, '#5b5046') + stack(90, 10, 32, '#6b5e52') + stack(20, 7, 22, '#4f463d');
    s += '<path d="M120 322 L130 220 Q160 170 220 164 Q270 160 300 166 L300 322Z" fill="#7a6a58"/><path d="M130 220 Q160 170 220 164 Q270 160 300 166 L300 190 Q240 186 200 200 Q160 214 146 322 L120 322Z" fill="#8aa05a"/>';
    // victorian + water tower
    s += '<rect x="196" y="126" width="46" height="40" fill="#f3efe6"/><path d="M192 126 L246 126 L219 102Z" fill="#6a3e3a"/><path d="M228 126 L228 108 L240 108 L240 126Z" fill="#f3efe6"/><path d="M226 108 L242 108 L234 98Z" fill="#6a3e3a"/>';
    for (let x = 202; x < 238; x += 10) s += '<rect x="' + x + '" y="136" width="5" height="9" fill="#4d5d6d"/>';
    s += '<rect x="256" y="120" width="20" height="20" fill="#9a7a58"/><path d="M254 120 L278 120 L266 110Z" fill="#6a4a38"/><path d="M258 140 L256 166 M274 140 L276 166 M258 150 L274 150" stroke="#6a4a38" stroke-width="2"/>';
    for (let i = 0; i < 40; i++) { const x = 150 + r() * 150, y = 196 + r() * 120; s += '<circle cx="' + f1(x) + '" cy="' + f1(y) + '" r="' + f1(1.2 + r() * 1.3) + '" fill="' + ['#f3c24a', '#e98a3a', '#f6f0d8', '#b98ad0'][i % 4] + '"/>'; }
    return s;
  };

  S[25] = function (c, r) { // Mono Lake
    let s = sky(c, [[0, '#8ea2cf'], [0.6, '#f0c2b4'], [1, '#f7e3c8']]);
    s += ridge(r, 130, 34, 0.022, '#9d9ac0', { peaks: [[60, 1.2, 60], [230, 0.9, 70]] });
    s += '<path d="M30 110 L60 80 L88 110 Q70 104 60 108 Q48 102 30 110Z" fill="#fff" opacity=".85"/>';
    s += '<rect x="0" y="150" width="300" height="172" fill="#b9c5da"/>' + water(r, 152, 322, 'transparent', '#eef2f8', 20, { w: 40 });
    const tufa = (x, w, h, col) => {
      let t = '', y = 210;
      for (let i = 0; i < 6; i++) { const ww = w * (1 - i * 0.12) * (0.85 + r() * 0.3); t += '<ellipse cx="' + f1(x + (r() - 0.5) * 4) + '" cy="' + f1(y - i * h / 6) + '" rx="' + f1(ww) + '" ry="' + f1(h / 7) + '" fill="' + col + '"/>'; }
      let ref = '<g opacity=".35" transform="translate(0 ' + (2 * y + 8) + ') scale(1 -1)">' + t + '</g>';
      return ref + t;
    };
    s += tufa(60, 16, 70, '#d8cdb8') + tufa(92, 12, 50, '#cfc2aa') + tufa(170, 22, 90, '#e2d7c3') + tufa(206, 14, 56, '#cabca3') + tufa(250, 18, 64, '#d8cdb8');
    s += '<path d="M0 322 L0 286 Q150 272 300 290 L300 322Z" fill="#d9ceb0"/>';
    s += birds(r, 7, 120, 50, '#4a4a66');
    return s;
  };

  S[26] = function (c, r) { // Kings Canyon
    let s = sky(c, [[0, '#7fb0d8'], [1, '#eef1e8']]);
    s += ridge(r, 70, 20, 0.03, '#b7c3d2', { peaks: [[150, 1.2, 60]] });
    s += '<path d="M130 60 L150 44 L170 60Z" fill="#fff"/>';
    s += '<path d="M-5 322 L-5 40 Q40 50 80 90 Q120 150 140 260 L150 322Z" fill="#a39888"/><path d="M-5 40 Q40 50 80 90 Q120 150 140 260 L150 322 L118 322 Q100 170 60 110 Q30 70 -5 70Z" fill="#8a8072"/>';
    s += '<path d="M305 322 L305 50 Q260 60 220 100 Q180 160 160 260 L150 322Z" fill="#c2b7a6"/><path d="M305 50 Q260 60 220 100 Q180 160 160 260 L150 322 L175 322 Q190 180 240 120 Q270 90 305 84Z" fill="#d6ccbc"/>';
    s += forest(r, 20, 110, 200, 10, 14, 22, '#3f5f45', 90) + forest(r, 200, 290, 200, 10, 14, 22, '#3f5f45', 90);
    s += '<path d="M236 104 Q233 150 238 186" stroke="#fff" stroke-width="2.4" fill="none"/>';
    s += '<path d="M150 322 Q146 300 150 286 Q154 272 150 262" stroke="#57a9d6" stroke-width="8" fill="none" stroke-linecap="round"/><path d="M150 322 Q146 300 150 286" stroke="#bfe6f5" stroke-width="2" fill="none"/>';
    s += birds(r, 3, 140, 100, '#3a4a5a');
    return s;
  };

  S[27] = function (c, r) { // Winchester Mystery House
    let s = sky(c, [[0, '#1f2146'], [0.7, '#6a4a86'], [1, '#c48aa6']]);
    s += stars(r, 30, 150) + '<circle cx="240" cy="60" r="22" fill="#fbf1d0"/><circle cx="232" cy="54" r="22" fill="#2a2a58" opacity=".25"/>';
    const W = '#e8d6c2', WD = '#c4ab92', ROOF = '#3d3350';
    let h = '<rect x="30" y="176" width="240" height="110" fill="' + W + '"/>';
    const bits = [[40, 140, 40, 36, 'gable'], [86, 120, 30, 56, 'turret'], [120, 150, 50, 26, 'gable'], [172, 112, 22, 64, 'cupola'], [198, 140, 44, 36, 'gable'], [246, 130, 26, 46, 'turret'], [60, 110, 14, 30, 'cupola'], [150, 124, 16, 26, 'turret']];
    bits.forEach(function (b) {
      h += '<rect x="' + b[0] + '" y="' + b[1] + '" width="' + b[2] + '" height="' + (286 - b[1]) + '" fill="' + (r() > 0.5 ? W : WD) + '"/>';
      if (b[4] === 'gable') h += '<path d="' + P([[b[0] - 4, b[1]], [b[0] + b[2] + 4, b[1]], [b[0] + b[2] / 2, b[1] - b[2] * 0.6]]) + '" fill="' + ROOF + '"/>';
      if (b[4] === 'turret') h += '<path d="' + P([[b[0] - 3, b[1]], [b[0] + b[2] + 3, b[1]], [b[0] + b[2] / 2, b[1] - b[2] * 1.3]]) + '" fill="' + ROOF + '"/>';
      if (b[4] === 'cupola') h += '<path d="M' + (b[0] - 2) + ' ' + b[1] + ' Q' + (b[0] + b[2] / 2) + ' ' + (b[1] - b[2] * 1.2) + ' ' + (b[0] + b[2] + 2) + ' ' + b[1] + 'Z" fill="' + ROOF + '"/>';
      for (let y = b[1] + 10; y < 276; y += 22) h += '<rect x="' + (b[0] + b[2] * 0.3) + '" y="' + y + '" width="' + b[2] * 0.4 + '" height="10" fill="' + (r() > 0.4 ? '#ffd27a' : '#3a3150') + '"/>';
    });
    // staircase to nowhere
    h += '<path d="M40 286 L40 280 L48 280 L48 272 L56 272 L56 264 L64 264 L64 256 L72 256 L72 286Z" fill="' + WD + '"/><rect x="250" y="228" width="12" height="16" fill="#3a3150"/>';
    s += h;
    s += '<path d="M0 322 L0 284 Q150 276 300 286 L300 322Z" fill="#2c3a2e"/>';
    s += palm(18, 300, 90, '#141626', -4) + palm(286, 302, 80, '#141626', 5);
    return s;
  };

  S[28] = function (c, r) { // Hearst Castle
    let s = sky(c, [[0, '#6ea9d6'], [1, '#f5ecd6']]);
    s += '<rect x="0" y="150" width="300" height="20" fill="#3f7fb2"/>';
    s += '<path d="M0 170 Q60 150 120 130 Q160 118 200 130 Q260 150 300 170 L300 322 L0 322Z" fill="#d6b56a"/>';
    // Casa Grande twin towers
    const cx = 160;
    s += '<rect x="' + (cx - 40) + '" y="98" width="80" height="44" fill="#f4ecdc"/><rect x="' + (cx - 40) + '" y="98" width="80" height="6" fill="#d9c9ab"/>';
    [cx - 30, cx + 30].forEach(function (tx) {
      s += '<rect x="' + (tx - 9) + '" y="56" width="18" height="46" fill="#f4ecdc"/><rect x="' + tx + '" y="56" width="9" height="46" fill="#e2d4bb"/><path d="M' + (tx - 11) + ' 58 Q' + tx + ' 36 ' + (tx + 11) + ' 58Z" fill="#3c6f8f"/><rect x="' + (tx - 4) + '" y="64" width="8" height="12" rx="4" fill="#5a4a3a"/><line x1="' + tx + '" y1="40" x2="' + tx + '" y2="32" stroke="#b58a3a" stroke-width="1.6"/>';
    });
    s += '<path d="M' + (cx - 12) + ' 142 L' + (cx - 12) + ' 124 Q' + cx + ' 110 ' + (cx + 12) + ' 124 L' + (cx + 12) + ' 142Z" fill="#6a5440"/>';
    // cypress
    for (let i = 0; i < 6; i++) { const x = 60 + i * 34 + (i > 2 ? 40 : 0); s += '<ellipse cx="' + x + '" cy="' + (150 + (i % 2) * 6) + '" rx="5" ry="22" fill="#2f4d34"/>'; }
    // Neptune pool
    s += '<path d="M50 250 L250 250 L280 298 L20 298Z" fill="#f2ebdc"/><path d="M62 256 L238 256 L262 292 L38 292Z" fill="#2aa0c9"/>' + water(r, 258, 290, 'transparent', '#bff0fa', 10, { w: 24 });
    for (let x = 60; x <= 240; x += 22) s += '<rect x="' + x + '" y="214" width="6" height="36" fill="#f7f1e4"/>';
    s += '<rect x="54" y="208" width="198" height="8" fill="#f7f1e4"/><path d="M130 208 L170 208 L150 190Z" fill="#f7f1e4"/>';
    // zebra
    s += '<g transform="translate(262 176)"><rect x="-12" y="-8" width="24" height="10" rx="5" fill="#f8f6f0"/>' + [-8, -3, 2, 7].map(x => '<rect x="' + x + '" y="-8" width="2" height="10" fill="#1d1d1d"/>').join('') + '<path d="M10 -6 L16 -16 L20 -14 L14 -4Z" fill="#f8f6f0"/><rect x="-10" y="1" width="2" height="8" fill="#1d1d1d"/><rect x="8" y="1" width="2" height="8" fill="#1d1d1d"/></g>';
    return s;
  };

  S[29] = function (c, r) { // Muir Woods
    let s = sky(c, [[0, '#dfe8d6'], [1, '#f3efdc']]);
    s += redwoodGrove(c, r, '#e4ebdd', '#8a4a30', '#5c2b1a', '#27472f', '#48683a');
    s += '<g opacity=".6">' + beams(c, 90, -20, '#fffbe6', 6, 0.8) + '</g>';
    // creek
    s += '<path d="M0 322 L0 300 Q80 292 150 302 Q220 312 300 298 L300 322Z" fill="#4c7a8a"/><path d="M20 306 q20 -3 40 0 M180 312 q20 -3 40 0" stroke="#d8eef2" stroke-width="1.6" fill="none"/>';
    // footbridge
    s += '<path d="M60 296 Q150 278 240 296" stroke="#7a5536" stroke-width="6" fill="none"/><path d="M60 280 Q150 262 240 280" stroke="#7a5536" stroke-width="2" fill="none"/>';
    for (let x = 70; x < 240; x += 18) { const y1 = 296 - 18 * Math.sin((x - 60) / 180 * Math.PI) * 0.9; s += '<line x1="' + x + '" y1="' + f1(y1 - 14) + '" x2="' + x + '" y2="' + f1(y1) + '" stroke="#7a5536" stroke-width="2"/>'; }
    // deer
    s += '<g transform="translate(262 286)"><ellipse cx="0" cy="0" rx="12" ry="6" fill="#8a6446"/><path d="M9 -3 L14 -14 L18 -12 L13 -2Z" fill="#8a6446"/><circle cx="17" cy="-15" r="3" fill="#8a6446"/><rect x="-9" y="4" width="2" height="10" fill="#6a4a34"/><rect x="7" y="4" width="2" height="10" fill="#6a4a34"/><path d="M16 -18 L14 -24 M18 -18 L21 -24" stroke="#6a4a34" stroke-width="1.2"/></g>';
    return s;
  };

  S[30] = function (c, r) { // Venice Beach
    let s = sky(c, [[0, '#5a6fb2'], [0.4, '#f08a7c'], [0.75, '#fbc06e'], [1, '#fde6ae']]);
    s += sun(c, 210, 150, 24, '#ffe699', '#ffc36b');
    s += water(r, 152, 206, '#4c6aa8', '#ffe1a0', 24, { cx: 210, spread: 90, w: 26 });
    s += '<rect x="0" y="206" width="300" height="116" fill="#f2cf94"/>';
    // storefront murals
    const cols = ['#e5534b', '#3fa7c4', '#f2b53a', '#7bc86c', '#b06ad3', '#f08a3c'];
    for (let i = 0; i < 8; i++) {
      const x = i * 38 - 4, h = 34 + (i % 3) * 8;
      s += '<rect x="' + x + '" y="' + (262 - h) + '" width="36" height="' + h + '" fill="' + cols[i % 6] + '"/><rect x="' + (x + 4) + '" y="' + (262 - h + 6) + '" width="28" height="8" fill="#fdf5e0" opacity=".85"/><path d="M' + x + ' ' + (262 - h + 18) + ' L' + (x + 36) + ' ' + (262 - h + 18) + ' L' + (x + 32) + ' ' + (262 - h + 24) + ' L' + (x + 4) + ' ' + (262 - h + 24) + 'Z" fill="#fdf5e0" opacity=".6"/>';
    }
    s += '<rect x="0" y="262" width="300" height="20" fill="#a7a19a"/>';
    // skate bowl
    s += '<ellipse cx="80" cy="302" rx="60" ry="12" fill="#bdb7ae"/><ellipse cx="80" cy="304" rx="46" ry="8" fill="#8f897f"/>';
    s += '<g transform="translate(84 274) rotate(-12)"><circle cx="0" cy="-16" r="3.4" fill="#1d1d2a"/><path d="M-3 -12 L3 -12 L4 -2 L-4 -2Z" fill="#1d1d2a"/><path d="M-4 -2 L-8 6 M4 -2 L7 6 M-3 -10 L-11 -14 M3 -10 L10 -6" stroke="#1d1d2a" stroke-width="2.2" stroke-linecap="round"/><rect x="-11" y="6" width="22" height="2.4" rx="1" fill="#c0362c"/></g>';
    s += palm(30, 236, 120, '#2b2340', -6) + palm(150, 226, 140, '#2b2340', 5) + palm(268, 232, 128, '#2b2340', 8);
    return s;
  };

  function shield(x, y, n, size) {
    const k = (size || 1);
    return '<g transform="translate(' + x + ' ' + y + ') scale(' + k + ')"><path d="M3 5 Q20 -1 37 5 L39 18 Q37 33 20 44 Q3 33 1 18Z" fill="#1d6b45" stroke="#fff" stroke-width="2"/>' +
      '<text x="20" y="11.5" text-anchor="middle" font-family="Libre Franklin, Arial, sans-serif" font-size="4.6" font-weight="700" fill="#fff" letter-spacing=".2">CALIFORNIA</text>' +
      '<text x="20" y="31" text-anchor="middle" font-family="Big Shoulders Display, Impact, sans-serif" font-size="18" font-weight="800" fill="#fff">' + n + '</text></g>';
  }

  const POSTER_TITLES = { 9: 'Anaheim', 10: 'Hollywood Hills', 23: 'Palm Springs', 27: 'Winchester House' };

  function render(n, opts) {
    opts = opts || {};
    const spot = window.GH_DATA.spots[n - 1];
    const base = 'p' + n + '_' + (uid++);
    const ctx = { defs: [], id: function (k) { return base + k + this.defs.length; } };
    const r = rng(n * 131 + 7);
    const scene = S[n](ctx, r);
    const clip = base + 'clip';
    const title = (opts.title || POSTER_TITLES[n] || spot.short).toUpperCase();
    const fs = title.length <= 12 ? 32 : title.length <= 15 ? 28 : 24;
    const fit = title.length > 13 ? ' textLength="262" lengthAdjust="spacingAndGlyphs"' : '';
    return '<svg viewBox="0 0 300 400" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + spot.name + ' travel poster" class="poster-svg">' +
      '<defs>' + ctx.defs.join('') + '<clipPath id="' + clip + '"><rect width="300" height="322"/></clipPath></defs>' +
      '<rect width="300" height="400" fill="#fffaf0"/>' +
      '<g clip-path="url(#' + clip + ')">' + scene + '</g>' +
      '<rect x="0" y="322" width="300" height="78" fill="#10284a"/>' +
      '<rect x="0" y="322" width="300" height="3" fill="#d9a441"/>' +
      '<text x="150" y="360" text-anchor="middle" font-family="Big Shoulders Display, Impact, sans-serif" font-weight="800" font-size="' + fs + '" letter-spacing="1.5" fill="#f0c25e"' + fit + '>' + title + '</text>' +
      '<text x="150" y="382" text-anchor="middle" font-family="Libre Franklin, Arial, sans-serif" font-size="10.5" letter-spacing=".6" fill="#e9e1cf">' + spot.region + '</text>' +
      '<rect x="7" y="7" width="286" height="386" fill="none" stroke="#fffaf0" stroke-width="2" opacity=".85"/>' +
      (opts.noShield ? '' : shield(16, 16, n, 1)) +
      '</svg>';
  }

  window.GHPosters = { render: render, shield: shield };
})();
