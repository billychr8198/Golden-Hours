/* Golden Hours — the 3D world.
   A low-poly relief model of California floating in a stylized Pacific,
   with Flight 14-CA circling your latest destination. */
(function () {
  'use strict';
  const T = window.THREE;

  // ---------- geography ----------
  const LON0 = -119.3, LAT0 = 37.2, SCALE = 10, COSL = Math.cos(37.2 * Math.PI / 180), HSCALE = 2.4;
  function toXZ(lon, lat) { return [(lon - LON0) * SCALE * COSL, -(lat - LAT0) * SCALE]; }

  const CA = [[-124.21, 42.0], [-120.0, 42.0], [-120.0, 39.0], [-114.63, 35.0], [-114.57, 34.8], [-114.13, 34.27], [-114.43, 34.08], [-114.53, 33.9], [-114.5, 33.6], [-114.72, 33.4], [-114.7, 33.05], [-114.47, 32.85], [-114.72, 32.72], [-117.12, 32.53], [-117.25, 32.72], [-117.28, 33.0], [-117.4, 33.2], [-117.6, 33.39], [-117.93, 33.6], [-118.1, 33.74], [-118.29, 33.71], [-118.41, 33.76], [-118.41, 33.9], [-118.52, 34.03], [-118.8, 34.01], [-119.2, 34.15], [-119.6, 34.41], [-120.0, 34.46], [-120.47, 34.45], [-120.64, 34.58], [-120.6, 34.9], [-120.64, 35.14], [-120.9, 35.45], [-121.3, 35.66], [-121.9, 36.3], [-121.95, 36.56], [-121.8, 36.72], [-121.82, 36.88], [-122.03, 36.96], [-122.4, 37.2], [-122.52, 37.6], [-122.51, 37.78], [-122.48, 37.81], [-122.65, 37.9], [-123.02, 37.99], [-122.95, 38.2], [-123.3, 38.5], [-123.73, 38.95], [-123.8, 39.3], [-123.83, 39.8], [-124.1, 40.1], [-124.4, 40.44], [-124.2, 40.8], [-124.1, 41.1], [-124.2, 41.8]];
  const BAY = [[-122.48, 37.81], [-122.37, 37.93], [-122.42, 38.05], [-122.25, 38.08], [-122.05, 38.06], [-122.2, 37.95], [-122.3, 37.85], [-122.18, 37.62], [-121.98, 37.45], [-122.12, 37.46], [-122.36, 37.62], [-122.38, 37.78]];
  const ISLANDS = [ // Channel Islands + Catalina as small ellipses [lon, lat, rLon, rLat, height]
    [-119.75, 34.02, 0.18, 0.05, 0.25], [-120.12, 34.0, 0.13, 0.05, 0.18], [-120.37, 34.04, 0.09, 0.04, 0.16], [-119.4, 34.01, 0.07, 0.025, 0.12], [-118.42, 33.39, 0.15, 0.045, 0.3], [-118.5, 32.9, 0.06, 0.08, 0.12]];

  function inPoly(x, y, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }

  function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
  function vnoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < 4; i++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= 0.5; } return s; }
  function ridged(x, y) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < 4; i++) { s += a * (1 - Math.abs(vnoise(x * f, y * f) * 2 - 1)); f *= 2.1; a *= 0.5; } return s; }

  function segInfo(u, v, a, b) {
    const ax = a[0] * COSL, ay = a[1], bx = b[0] * COSL, by = b[1];
    const dx = bx - ax, dy = by - ay;
    let t = ((u - ax) * dx + (v - ay) * dy) / (dx * dx + dy * dy); t = Math.max(0, Math.min(1, t));
    const ex = u - (ax + t * dx), ey = v - (ay + t * dy);
    return { d: Math.hypot(ex, ey), t: t, side: dx * ey - dy * ex > 0 ? 1 : -1 };
  }
  function polyD(u, v, pts) {
    let best = 1e9;
    for (let i = 0; i < pts.length - 1; i++) best = Math.min(best, segInfo(u, v, pts[i], pts[i + 1]).d);
    return best;
  }
  function cone(u, v, lon, lat, h, r, p) { const d = Math.hypot(u - lon * COSL, v - lat); return d < r ? h * Math.pow(1 - d / r, p || 1.5) : 0; }
  function gauss(d, w) { return Math.exp(-(d / w) * (d / w)); }
  const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  const COAST = [[-124.0, 41.6], [-123.4, 40.0], [-122.9, 38.7], [-122.1, 37.2], [-121.5, 36.2], [-120.6, 35.2], [-120.2, 34.8]];
  const TRANSVERSE = [[-120.4, 34.65], [-119.4, 34.55], [-118.3, 34.3], [-117.3, 34.2], [-116.8, 34.1]];
  const LAKES = [
    { lon: -120.03, lat: 39.09, rl: 0.085, rt: 0.2 },  // Tahoe
    { lon: -119.02, lat: 38.01, rl: 0.1, rt: 0.075 },  // Mono
    { lon: -115.83, lat: 33.3, rl: 0.1, rt: 0.2 },     // Salton Sea
    { lon: -122.83, lat: 39.06, rl: 0.08, rt: 0.08 }   // Clear Lake
  ];

  function elevRaw(lon, lat) {
    const u = lon * COSL, v = lat;
    const cv = gauss(segInfo(u, v, [-122.2, 40.4], [-119.2, 35.2]).d, 0.42);
    let h = 0.05 + 0.22 * fbm(u * 1.6 + 3, v * 1.6) * (1 - 0.85 * cv);
    const si = segInfo(u, v, [-121.25, 40.35], [-118.1, 35.65]);
    const prof = 0.5 + 0.62 * Math.exp(-Math.pow((si.t - 0.8) / 0.32, 2));
    h += prof * gauss(si.d, si.side > 0 ? 0.17 : 0.52) * (0.72 + 0.5 * ridged(u * 3.2, v * 3.2));
    h += 0.33 * gauss(polyD(u, v, COAST), 0.26) * (0.6 + 0.7 * ridged(u * 4, v * 4));
    h += 0.28 * gauss(Math.hypot(u + 121.6 * COSL, v - 36.15), 0.28);
    h += 0.55 * gauss(Math.hypot(u + 123.2 * COSL, v - 41.2), 0.6) * (0.6 + 0.6 * ridged(u * 3, v * 3));
    h += 0.42 * gauss(segInfo(u, v, [-122.3, 42.0], [-121.4, 40.3]).d, 0.3);
    h += cone(u, v, -122.195, 41.409, 1.6, 0.17, 1.6) + 0.25 * gauss(Math.hypot(u + 122.195 * COSL, v - 41.409), 0.3);
    h += cone(u, v, -121.505, 40.488, 0.85, 0.12, 1.4);
    h += 0.6 * gauss(polyD(u, v, TRANSVERSE), 0.17) * (0.7 + 0.5 * ridged(u * 4, v * 4));
    h += cone(u, v, -116.68, 33.81, 0.95, 0.14) + cone(u, v, -116.82, 34.1, 0.95, 0.14);
    h += 0.4 * gauss(segInfo(u, v, [-116.85, 33.6], [-116.35, 32.6]).d, 0.22);
    const desert = desertness(lon, lat);
    h += desert * (0.1 + 0.3 * Math.pow(ridged(u * 3.4, v * 3.4), 2));
    h -= 0.45 * gauss(segInfo(u, v, [-116.95, 36.75], [-116.7, 35.9]).d, 0.12);
    return Math.max(0.03, h);
  }
  function desertness(lon, lat) {
    const mojave = smooth(-118.6, -117.8, lon) * smooth(37.9, 37.2, lat);
    const colorado = smooth(-116.9, -116.3, lon) * smooth(34.4, 34.0, lat);
    const antelope = smooth(-118.9, -118.4, lon) * smooth(35.2, 34.8, lat) * smooth(34.4, 34.6, lat);
    return Math.min(1, Math.max(mojave, colorado, antelope));
  }

  const lakeLevels = LAKES.map(L => elevRaw(L.lon, L.lat) - 0.06);
  function sample(lon, lat) {
    const island = ISLANDS.find(I => Math.pow((lon - I[0]) / I[2], 2) + Math.pow((lat - I[1]) / I[3], 2) < 1);
    if (island) { const d = Math.pow((lon - island[0]) / island[2], 2) + Math.pow((lat - island[1]) / island[3], 2); return { h: island[4] * (1 - d) + 0.03 + 0.05 * fbm(lon * 20, lat * 20), land: true, lake: false }; }
    if (!inPoly(lon, lat, CA) || inPoly(lon, lat, BAY)) return { h: -0.5, land: false, lake: false };
    for (let i = 0; i < LAKES.length; i++) {
      const L = LAKES[i];
      if (Math.pow((lon - L.lon) / L.rl, 2) + Math.pow((lat - L.lat) / L.rt, 2) < 1) return { h: lakeLevels[i], land: true, lake: true };
    }
    return { h: elevRaw(lon, lat), land: true, lake: false };
  }
  function heightAt(lon, lat) { const s = sample(lon, lat); return Math.max(0, s.h) * HSCALE; }

  const COL = {
    field: [new T.Color('#b8b45c'), new T.Color('#98ad55'), new T.Color('#d0bd68'), new T.Color('#a7a04e')],
    gold: new T.Color('#d6b261'), green: new T.Color('#7a9550'), forest: new T.Color('#3e693e'), dark: new T.Color('#2d5233'),
    desert: new T.Color('#ddb682'), desert2: new T.Color('#c69565'), rock: new T.Color('#8f8a84'), snow: new T.Color('#f4f2ee'),
    lake: new T.Color('#2c6fb0'), salt: new T.Color('#eee6d6'), beach: new T.Color('#e5cf9a')
  };
  function colorAt(lon, lat, s) {
    const c = new T.Color();
    if (s.lake) return c.copy(COL.lake);
    const h = s.h, u = lon * COSL, v = lat, n = fbm(u * 6, v * 6);
    const cv = gauss(segInfo(u, v, [-122.2, 40.4], [-119.2, 35.2]).d, 0.42);
    const north = smooth(38.3, 40.2, lat);
    const des = desertness(lon, lat);
    if (cv > 0.45 && h < 0.2) {
      const k = (Math.floor(u * 16) + Math.floor(v * 11) * 2) & 3;
      c.copy(COL.field[k]);
    } else {
      c.copy(COL.gold).lerp(COL.green, Math.min(1, north * 0.8 + smooth(0.2, 0.4, h) * 0.6));
      if (h > 0.34 && h < 0.95 && des < 0.4) c.lerp(COL.forest, smooth(0.34, 0.5, h) * 0.9);
      if (lat > 38.5 && lon < -122.6) c.lerp(COL.dark, 0.7);
      if (lat > 40.5) c.lerp(COL.dark, smooth(0.15, 0.45, h) * 0.6);
    }
    if (des > 0) c.lerp(n > 0.5 ? COL.desert : COL.desert2, des);
    if (Math.hypot(u + 116.83 * COSL, v - 36.25) < 0.13) c.lerp(COL.salt, 0.8);
    if (h > 0.9) c.lerp(COL.rock, smooth(0.9, 1.05, h));
    if (h > 1.02 + n * 0.12) c.copy(COL.snow);
    if (h < 0.07 && !des) c.lerp(COL.beach, 0.35);
    c.offsetHSL(0, 0, (n - 0.5) * 0.06);
    return c;
  }

  function buildTerrain() {
    const LONMIN = -124.75, LONMAX = -113.85, LATMIN = 32.25, LATMAX = 42.3;
    const NX = 200, NY = Math.round(NX * (LATMAX - LATMIN) / ((LONMAX - LONMIN) * COSL));
    const grid = [];
    for (let j = 0; j <= NY; j++) {
      const row = [];
      for (let i = 0; i <= NX; i++) {
        const lon = LONMIN + (LONMAX - LONMIN) * i / NX, lat = LATMAX - (LATMAX - LATMIN) * j / NY;
        const s = sample(lon, lat);
        const xz = toXZ(lon, lat);
        row.push({ x: xz[0], z: xz[1], y: s.h * HSCALE, s: s, lon: lon, lat: lat });
      }
      grid.push(row);
    }
    const pos = [], col = [];
    function tri(a, b, c) {
      if (!a.s.land && !b.s.land && !c.s.land) return;
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
      const lon = (a.lon + b.lon + c.lon) / 3, lat = (a.lat + b.lat + c.lat) / 3;
      const land = [a, b, c].filter(p => p.s.land);
      const lake = land.some(p => p.s.lake) && land.every(p => p.s.lake || p.s.h > 0);
      const s = { h: (a.y + b.y + c.y) / 3 / HSCALE, lake: lake && land.filter(p => p.s.lake).length >= 2 };
      const cc = land.length < 3 && !s.lake ? COL.beach.clone().lerp(colorAt(lon, lat, s), 0.4) : colorAt(lon, lat, s);
      for (let k = 0; k < 3; k++) col.push(cc.r, cc.g, cc.b);
    }
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const a = grid[j][i], b = grid[j][i + 1], c = grid[j + 1][i], d = grid[j + 1][i + 1];
      if ((i + j) % 2) { tri(a, c, b); tri(b, c, d); } else { tri(a, c, d); tri(a, d, b); }
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    const m = new T.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92, metalness: 0 });
    const mesh = new T.Mesh(g, m);
    return mesh;
  }

  // ---------- themes ----------
  const THEMES = {
    focus: { top: '#27477d', horizon: '#f4b56a', sun: '#ffc27a', sunI: 1.9, sunDir: [-1, 0.32, 0.35], hemiSky: '#ffe2b8', hemiGround: '#3a4a6a', hemiI: 0.75, deep: '#0f2a54', shallow: '#23568a', glint: '#ffc864', stars: 0.15, city: 0.18, fogNear: 140, fogFar: 460 },
    short: { top: '#3a82d4', horizon: '#cde6fa', sun: '#fff6ea', sunI: 2.0, sunDir: [0.35, 1, 0.45], hemiSky: '#e9f4ff', hemiGround: '#6b7c5a', hemiI: 0.95, deep: '#135a90', shallow: '#2a8bc0', glint: '#eaf8ff', stars: 0, city: 0, fogNear: 160, fogFar: 520 },
    long: { top: '#030920', horizon: '#1b2c5c', sun: '#9fb6ff', sunI: 0.55, sunDir: [-0.4, 0.7, -0.5], hemiSky: '#6a7cc4', hemiGround: '#0c1226', hemiI: 0.42, deep: '#040c22', shallow: '#0a2046', glint: '#a9c0ff', stars: 1, city: 1, fogNear: 120, fogFar: 420 },
    finale: { top: '#2a3f82', horizon: '#ffcc7a', sun: '#ffd48a', sunI: 2.1, sunDir: [-1, 0.25, 0.1], hemiSky: '#ffe6c2', hemiGround: '#3a4a6a', hemiI: 0.85, deep: '#0f2a54', shallow: '#23568a', glint: '#ffd576', stars: 0.3, city: 0.6, fogNear: 160, fogFar: 520 }
  };
  function themeVals(name) {
    const t = THEMES[name];
    return {
      top: new T.Color(t.top), horizon: new T.Color(t.horizon), sun: new T.Color(t.sun), sunI: t.sunI,
      sunDir: new T.Vector3().fromArray(t.sunDir).normalize(), hemiSky: new T.Color(t.hemiSky), hemiGround: new T.Color(t.hemiGround), hemiI: t.hemiI,
      deep: new T.Color(t.deep), shallow: new T.Color(t.shallow), glint: new T.Color(t.glint), stars: t.stars, city: t.city, fogNear: t.fogNear, fogFar: t.fogFar
    };
  }

  // ---------- world ----------
  const W = {};
  let renderer, scene, camera, clock, sky, ocean, terrain, hemi, sunLight, starPts, cityPts, cloudGroup;
  let theme, themeTarget;
  const pins = [];
  let spots = [], unlocked = 0, reduced = false;
  let plane, planeState, trailGeo, trailPositions, trailAlpha;
  let routeMesh = null, nextLine = null;
  const cam = { target: new T.Vector3(0, 0, 5), r: 110, az: 0.25, el: 0.95, cur: null, mode: 'follow', focusIdx: -1, userAz: 0, userEl: 0, userR: 1, lastInteract: -1e9 };
  const raycaster = new T.Raycaster(), mouse = new T.Vector2(-9, -9);
  let hovered = -1, opts = {}, panelShift = 0, panelShiftY = 0, sparkles = null, arrivalQueue = [], arrivalCb = null;
  const START = { lon: -124.9, lat: 37.3 };

  function spotPos(i, lift) {
    const s = i < 0 ? START : spots[i];
    const xz = toXZ(s.lon, s.lat);
    return new T.Vector3(xz[0], (i < 0 ? 0 : heightAt(s.lon, s.lat)) + (lift || 0), xz[1]);
  }

  function makeSky() {
    const g = new T.SphereGeometry(900, 32, 16);
    const m = new T.ShaderMaterial({
      side: T.BackSide, depthWrite: false,
      uniforms: { uTop: { value: new T.Color() }, uHorizon: { value: new T.Color() }, uSun: { value: new T.Color() }, uSunDir: { value: new T.Vector3() } },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uSun; uniform vec3 uSunDir; varying vec3 vDir;' +
        'void main(){ float y = max(vDir.y, 0.0); vec3 c = mix(uHorizon, uTop, pow(y, 0.55));' +
        'float d = max(dot(normalize(vDir), normalize(uSunDir)), 0.0); c += uSun * (pow(d, 400.0) * 1.2 + pow(d, 12.0) * 0.35);' +
        'gl_FragColor = vec4(c, 1.0); }'
    });
    return new T.Mesh(g, m);
  }

  function makeOcean() {
    const g = new T.PlaneGeometry(1800, 1800, 1, 1); g.rotateX(-Math.PI / 2);
    const m = new T.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uDeep: { value: new T.Color() }, uShallow: { value: new T.Color() }, uGlint: { value: new T.Color() }, uHorizon: { value: new T.Color() }, uSunDir: { value: new T.Vector3() }, uCam: { value: new T.Vector3() } },
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: 'uniform float uTime; uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uGlint; uniform vec3 uHorizon; uniform vec3 uSunDir; uniform vec3 uCam; varying vec3 vW;' +
        'float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }' +
        'void main(){ float r = length(vW.xz - vec2(0.0, 0.0));' +
        'vec3 c = mix(uShallow, uDeep, smoothstep(30.0, 140.0, r));' +
        'vec2 p = vW.xz * vec2(0.09, 0.55); p.x += uTime * 0.25; float row = floor(p.y);' +
        'float seg = fract(p.x * (0.35 + h(vec2(row, 1.0)) * 0.4) + h(vec2(row, 2.0)) + uTime * 0.03);' +
        'float line = smoothstep(0.42, 0.5, fract(p.y)) * smoothstep(0.58, 0.5, fract(p.y)) * step(0.55, seg);' +
        'vec3 view = normalize(vW - uCam); vec3 refl = reflect(view, vec3(0.0,1.0,0.0));' +
        'float spec = pow(max(dot(refl, normalize(uSunDir)), 0.0), 18.0);' +
        'c += uGlint * line * (0.10 + spec * 1.3);' +
        'c += uGlint * pow(max(dot(refl, normalize(uSunDir)), 0.0), 120.0) * 0.6;' +
        'float fogF = smoothstep(180.0, 820.0, length(vW - uCam)); c = mix(c, uHorizon, fogF);' +
        'gl_FragColor = vec4(c, 1.0); }'
    });
    const mesh = new T.Mesh(g, m); mesh.position.y = 0;
    return mesh;
  }

  function makeStars() {
    const n = 1400, p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 0.95);
      p[i * 3] = Math.sin(ph) * Math.cos(th) * 800; p[i * 3 + 1] = Math.cos(ph) * 800 + 20; p[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * 800;
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(p, 3));
    return new T.Points(g, new T.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false }));
  }

  function makeCities() {
    const C = [[-118.25, 34.05, 0.45, 520], [-122.3, 37.7, 0.3, 320], [-117.15, 32.8, 0.18, 180], [-121.9, 37.35, 0.18, 160], [-121.49, 38.58, 0.14, 110], [-119.78, 36.75, 0.1, 70], [-117.3, 34.05, 0.25, 160], [-119.0, 35.37, 0.08, 50], [-117.85, 33.75, 0.2, 180]];
    const pts = [];
    C.forEach(function (c) {
      for (let i = 0; i < c[3]; i++) {
        const a = Math.random() * Math.PI * 2, rr = Math.pow(Math.random(), 0.7) * c[2];
        const lon = c[0] + Math.cos(a) * rr / COSL, lat = c[1] + Math.sin(a) * rr * 0.9;
        const s = sample(lon, lat); if (!s.land || s.lake) continue;
        const xz = toXZ(lon, lat); pts.push(xz[0], s.h * HSCALE + 0.12, xz[1]);
      }
    });
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pts, 3));
    return new T.Points(g, new T.PointsMaterial({ color: 0xffc66e, size: 0.22, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending }));
  }

  function makeClouds() {
    const group = new T.Group();
    const geo = new T.IcosahedronGeometry(1, 1);
    const mat = new T.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 1, transparent: true, opacity: 0.93 });
    for (let i = 0; i < 26; i++) {
      const c = new T.Group();
      const puffs = 4 + Math.floor(Math.random() * 4);
      for (let k = 0; k < puffs; k++) {
        const m = new T.Mesh(geo, mat);
        const s = 1 + Math.random() * 1.6;
        m.scale.set(s * 1.3, s * 0.75, s);
        m.position.set((k - puffs / 2) * 1.4 + Math.random(), Math.random() * 0.6, (Math.random() - 0.5) * 1.6);
        c.add(m);
      }
      c.position.set(-70 + Math.random() * 140, 9 + Math.random() * 5, -60 + Math.random() * 120);
      c.userData.speed = 0.5 + Math.random() * 0.8;
      const sc = 0.8 + Math.random() * 0.8; c.scale.setScalar(sc); c.userData.base = sc;
      group.add(c);
    }
    return group;
  }

  function makePlane() {
    const g = new T.Group();
    const white = new T.MeshStandardMaterial({ color: 0xf7f4ee, roughness: 0.45, metalness: 0.15 });
    const navy = new T.MeshStandardMaterial({ color: 0x10284a, roughness: 0.5, metalness: 0.2 });
    const gold = new T.MeshStandardMaterial({ color: 0xd9a441, roughness: 0.3, metalness: 0.6, emissive: 0x3a2400 });
    const red = new T.MeshStandardMaterial({ color: 0xc0362c, roughness: 0.5 });
    const glass = new T.MeshStandardMaterial({ color: 0x1b2433, roughness: 0.2, metalness: 0.5 });
    const fus = new T.Mesh(new T.CylinderGeometry(0.3, 0.27, 3.4, 20), white); fus.rotation.x = Math.PI / 2; g.add(fus);
    const nose = new T.Mesh(new T.SphereGeometry(0.3, 20, 12), white); nose.scale.set(1, 1, 1.7); nose.position.z = 1.7; g.add(nose);
    const cock = new T.Mesh(new T.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2.4), glass); cock.position.set(0, 0.1, 1.95); cock.rotation.x = 0.9; cock.scale.set(1.1, 1, 1.2); g.add(cock);
    const tail = new T.Mesh(new T.ConeGeometry(0.27, 1.1, 20), white); tail.rotation.x = -Math.PI / 2; tail.position.z = -2.25; tail.scale.set(1, 1, 1); g.add(tail);
    const belly = new T.Mesh(new T.CylinderGeometry(0.305, 0.275, 3.2, 20, 1, true, Math.PI * 0.62, Math.PI * 0.76), navy); belly.rotation.x = Math.PI / 2; g.add(belly);
    [-1, 1].forEach(function (s) {
      const stripe = new T.Mesh(new T.BoxGeometry(0.02, 0.05, 3.0), gold); stripe.position.set(s * 0.29, -0.02, 0.05); g.add(stripe);
      const win = new T.Mesh(new T.BoxGeometry(0.02, 0.07, 2.4), glass); win.position.set(s * 0.285, 0.1, 0.15); g.add(win);
      const wshape = new T.Shape(); wshape.moveTo(0, 0.55); wshape.lineTo(2.5, -0.35); wshape.lineTo(2.5, -0.72); wshape.lineTo(0, -0.35); wshape.lineTo(0, 0.55);
      const wing = new T.Mesh(new T.ExtrudeGeometry(wshape, { depth: 0.07, bevelEnabled: false }), white);
      wing.rotation.x = Math.PI / 2; wing.scale.x = s; wing.position.set(s * 0.15, -0.08, 0.2); wing.rotation.z = s * 0.06; g.add(wing);
      const tip = new T.Mesh(new T.BoxGeometry(0.05, 0.28, 0.3), gold); tip.position.set(s * 2.62, 0.06, -0.52); g.add(tip);
      const eng = new T.Mesh(new T.CylinderGeometry(0.17, 0.15, 0.75, 16), navy); eng.rotation.x = Math.PI / 2; eng.position.set(s * 1.05, -0.32, 0.45); g.add(eng);
      const intake = new T.Mesh(new T.TorusGeometry(0.16, 0.03, 8, 16), gold); intake.position.set(s * 1.05, -0.32, 0.83); g.add(intake);
      const hs = new T.Shape(); hs.moveTo(0, 0.25); hs.lineTo(1.0, -0.2); hs.lineTo(1.0, -0.42); hs.lineTo(0, -0.25);
      const stab = new T.Mesh(new T.ExtrudeGeometry(hs, { depth: 0.05, bevelEnabled: false }), white);
      stab.rotation.x = Math.PI / 2; stab.scale.x = s; stab.position.set(s * 0.1, 0.05, -2.0); g.add(stab);
      const light = new T.Mesh(new T.SphereGeometry(0.07, 8, 6), new T.MeshBasicMaterial({ color: s < 0 ? 0xff3b3b : 0x3bff7a }));
      light.position.set(s * 2.6, 0.02, -0.4); g.add(light);
    });
    const fs = new T.Shape(); fs.moveTo(0, 0); fs.lineTo(-0.95, 1.25); fs.lineTo(-1.45, 1.25); fs.lineTo(-1.2, 0);
    const fin = new T.Mesh(new T.ExtrudeGeometry(fs, { depth: 0.07, bevelEnabled: false }), navy);
    fin.rotation.y = Math.PI / 2; fin.position.set(-0.035, 0.12, -1.35); g.add(fin);
    const finStripe = new T.Mesh(new T.BoxGeometry(0.09, 0.12, 0.5), gold); finStripe.position.set(0, 0.95, -2.35); finStripe.rotation.x = 0.65; g.add(finStripe);
    const finStripe2 = new T.Mesh(new T.BoxGeometry(0.09, 0.08, 0.45), red); finStripe2.position.set(0, 0.78, -2.25); finStripe2.rotation.x = 0.65; g.add(finStripe2);
    const strobe = new T.Mesh(new T.SphereGeometry(0.09, 8, 6), new T.MeshBasicMaterial({ color: 0xffffff }));
    strobe.position.set(0, 1.4, -2.8); g.add(strobe);
    g.userData.strobe = strobe;
    const outer = new T.Group(); outer.add(g); g.scale.setScalar(0.55);
    outer.userData.inner = g;
    return outer;
  }

  function makeTrail() {
    const N = 90;
    trailPositions = new Float32Array(N * 3 * 2);
    trailAlpha = new Float32Array(N * 2);
    for (let i = 0; i < N * 2; i++) trailAlpha[i] = (1 - (i % N) / N);
    trailGeo = new T.BufferGeometry();
    trailGeo.setAttribute('position', new T.BufferAttribute(trailPositions, 3));
    trailGeo.setAttribute('alpha', new T.BufferAttribute(trailAlpha, 1));
    const idx = [];
    for (let k = 0; k < 2; k++) for (let i = 0; i < N - 1; i++) idx.push(k * N + i, k * N + i + 1);
    trailGeo.setIndex(idx);
    const m = new T.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uOp: { value: 0.55 } },
      vertexShader: 'attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform float uOp; varying float vA; void main(){ gl_FragColor = vec4(1.0,1.0,1.0, vA * vA * uOp); }'
    });
    const lines = new T.LineSegments(trailGeo, m);
    lines.frustumCulled = false;
    trailGeo.userData.N = N; trailGeo.userData.acc = 0; trailGeo.userData.filled = false;
    return lines;
  }

  function beamMaterial(col) {
    return new T.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
      uniforms: { uCol: { value: new T.Color(col) }, uOp: { value: 0.0 } },
      vertexShader: 'varying float vY; void main(){ vY = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 uCol; uniform float uOp; varying float vY; void main(){ gl_FragColor = vec4(uCol, (1.0 - vY) * (1.0 - vY) * uOp); }'
    });
  }

  function makePins() {
    const headGeo = new T.OctahedronGeometry(0.34, 0);
    const stemGeo = new T.CylinderGeometry(0.035, 0.035, 1, 6);
    const ringGeo = new T.RingGeometry(0.35, 0.52, 28); ringGeo.rotateX(-Math.PI / 2);
    const hitGeo = new T.SphereGeometry(0.75, 8, 6);
    const beamGeo = new T.CylinderGeometry(0.12, 0.42, 14, 16, 1, true); beamGeo.translate(0, 7, 0);
    spots.forEach(function (s, i) {
      const base = spotPos(i);
      const g = new T.Group(); g.position.copy(base);
      const stemH = 1.0 + (i % 3) * 0.55;
      const headMat = new T.MeshStandardMaterial({ color: 0x5b6b86, roughness: 0.4, metalness: 0.3, emissive: 0x000000, flatShading: true, transparent: true, opacity: 0.85 });
      const head = new T.Mesh(headGeo, headMat); head.position.y = stemH + 0.34; g.add(head);
      const stem = new T.Mesh(stemGeo, new T.MeshBasicMaterial({ color: 0x10284a, transparent: true, opacity: 0.7 })); stem.scale.y = stemH; stem.position.y = stemH / 2; g.add(stem);
      const ring = new T.Mesh(ringGeo, new T.MeshBasicMaterial({ color: 0x10284a, transparent: true, opacity: 0.55, depthWrite: false })); ring.position.y = 0.06; g.add(ring);
      const beam = new T.Mesh(beamGeo, beamMaterial(0xffd27a)); beam.visible = false; g.add(beam);
      const hit = new T.Mesh(hitGeo, new T.MeshBasicMaterial({ visible: false })); hit.position.y = stemH + 0.3; hit.userData.index = i; g.add(hit);
      scene.add(g);
      pins.push({ group: g, head: head, stem: stem, ring: ring, beam: beam, hit: hit, stemH: stemH, state: 'locked', t: Math.random() * 6 });
    });
  }

  function refreshPins() {
    pins.forEach(function (p, i) {
      const st = i < unlocked ? 'open' : i === unlocked ? 'next' : 'locked';
      p.state = st;
      const m = p.head.material;
      if (st === 'open') { m.color.set(0xe3ad48); m.emissive.set(0x5a3a00); m.opacity = 1; m.metalness = 0.7; p.ring.material.color.set(0xe3ad48); p.ring.material.opacity = 0.85; p.beam.visible = true; p.stem.material.color.set(0xe3ad48); }
      else if (st === 'next') { m.color.set(0xe4572e); m.emissive.set(0x5a1400); m.opacity = 1; m.metalness = 0.3; p.ring.material.color.set(0xe4572e); p.ring.material.opacity = 0.8; p.beam.visible = false; p.stem.material.color.set(0xe4572e); }
      else { m.color.set(0x5b6b86); m.emissive.set(0x000000); m.opacity = 0.8; m.metalness = 0.3; p.ring.material.color.set(0x10284a); p.ring.material.opacity = 0.5; p.beam.visible = false; p.stem.material.color.set(0x10284a); }
    });
  }

  function arcPoints(a, b, lift) {
    const pts = [], d = a.distanceTo(b), n = Math.max(8, Math.round(d * 1.5));
    for (let i = 0; i <= n; i++) {
      const t = i / n, p = a.clone().lerp(b, t);
      p.y += Math.sin(t * Math.PI) * (lift + d * 0.12);
      pts.push(p);
    }
    return pts;
  }

  function rebuildRoute() {
    if (routeMesh) { scene.remove(routeMesh); routeMesh.geometry.dispose(); routeMesh = null; }
    if (nextLine) { scene.remove(nextLine); nextLine.geometry.dispose(); nextLine = null; }
    const pts = [];
    let prev = spotPos(-1, 1.2);
    for (let i = 0; i < unlocked; i++) {
      const p = spotPos(i, pins[i].stemH + 0.35);
      const seg = arcPoints(prev, p, 1.5); if (pts.length) seg.shift();
      pts.push.apply(pts, seg); prev = p;
    }
    if (pts.length > 1) {
      const curve = new T.CatmullRomCurve3(pts, false, 'catmullrom', 0.2);
      routeMesh = new T.Mesh(new T.TubeGeometry(curve, Math.min(1200, pts.length * 3), 0.06, 6, false), new T.MeshBasicMaterial({ color: 0xf2c05c, transparent: true, opacity: 0.85 }));
      scene.add(routeMesh);
    }
    if (unlocked < spots.length) {
      const a = unlocked ? spotPos(unlocked - 1, pins[unlocked - 1].stemH + 0.35) : spotPos(-1, 1.2);
      const b = spotPos(unlocked, pins[unlocked].stemH + 0.35);
      const g = new T.BufferGeometry().setFromPoints(arcPoints(a, b, 1.5));
      nextLine = new T.Line(g, new T.LineDashedMaterial({ color: 0xffffff, dashSize: 0.5, gapSize: 0.4, transparent: true, opacity: 0.7 }));
      nextLine.computeLineDistances();
      scene.add(nextLine);
    }
  }

  // ---------- plane motion ----------
  function circleCenter(i) { return spotPos(i, 0).setY(0); }
  function circlePoint(center, ang, alt) { return new T.Vector3(center.x + Math.cos(ang) * 3.2, alt, center.z + Math.sin(ang) * 3.2); }
  function cruiseAlt(i) { return (i < 0 ? 0 : heightAt(spots[i].lon, spots[i].lat)) + 6; }

  function startTransit(toIdx) {
    const from = plane.position.clone();
    const center = circleCenter(toIdx), alt = cruiseAlt(toIdx);
    const dirIn = new T.Vector3().subVectors(center, from).setY(0).normalize();
    const entryAng = Math.atan2(from.z - center.z, from.x - center.x);
    const end = circlePoint(center, entryAng, alt);
    const dist = from.distanceTo(end);
    const fwd = new T.Vector3(0, 0, 1).applyQuaternion(plane.quaternion).setY(0).normalize();
    const c1 = from.clone().add(fwd.multiplyScalar(Math.min(10, dist * 0.35))); c1.y += 2 + dist * 0.05;
    const tang = new T.Vector3(-Math.sin(entryAng), 0, Math.cos(entryAng));
    const c2 = end.clone().sub(tang.multiplyScalar(Math.min(8, dist * 0.3))).add(dirIn.clone().multiplyScalar(-2)); c2.y += 1.5 + dist * 0.05;
    planeState = { mode: 'transit', to: toIdx, curve: new T.CubicBezierCurve3(from, c1, c2, end), t: 0, dur: Math.max(3.2, Math.min(8, dist / 9)), ang: entryAng };
  }

  function updatePlane(dt, time) {
    const inner = plane.userData.inner;
    inner.userData.strobe.visible = (time % 1.2) < 0.08;
    const prevPos = plane.position.clone();
    let roll = 0;
    if (planeState.mode === 'circle') {
      planeState.ang += dt * 0.32;
      const c = circleCenter(planeState.idx), alt = cruiseAlt(planeState.idx) + Math.sin(time * 0.6) * 0.25;
      const p = circlePoint(c, planeState.ang, alt);
      plane.position.lerp(p, Math.min(1, dt * 4));
      const ahead = circlePoint(c, planeState.ang + 0.25, alt);
      plane.lookAt(ahead);
      roll = -0.42;
    } else {
      planeState.t += dt / planeState.dur;
      const t = Math.min(1, planeState.t), e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const p = planeState.curve.getPoint(e);
      plane.position.copy(p);
      const ahead = planeState.curve.getPoint(Math.min(1, e + 0.02));
      if (ahead.distanceToSquared(p) > 1e-6) plane.lookAt(ahead);
      const tan = planeState.curve.getTangent(e), tan2 = planeState.curve.getTangent(Math.min(1, e + 0.05));
      roll = Math.max(-0.6, Math.min(0.6, (tan.x * tan2.z - tan.z * tan2.x) * -8));
      if (t >= 1) {
        const idx = planeState.to;
        planeState = { mode: 'circle', idx: idx, ang: planeState.ang };
        if (arrivalCb) arrivalCb(idx);
        if (arrivalQueue.length) startTransit(arrivalQueue.shift());
      }
    }
    inner.rotation.z += (roll - inner.rotation.z) * Math.min(1, dt * 3);
    // contrails from wingtips
    const N = trailGeo.userData.N;
    trailGeo.userData.acc += dt;
    if (trailGeo.userData.acc > 0.045 || !trailGeo.userData.filled) {
      trailGeo.userData.acc = 0;
      plane.updateMatrixWorld(true);
      for (let k = 0; k < 2; k++) {
        const tip = new T.Vector3(k ? 1.45 : -1.45, 0, -0.35).applyMatrix4(plane.matrixWorld);
        if (!trailGeo.userData.filled) { for (let i = 0; i < N; i++) { trailPositions[(k * N + i) * 3] = tip.x; trailPositions[(k * N + i) * 3 + 1] = tip.y; trailPositions[(k * N + i) * 3 + 2] = tip.z; } }
        for (let i = N - 1; i > 0; i--) { const a = (k * N + i) * 3, b = (k * N + i - 1) * 3; trailPositions[a] = trailPositions[b]; trailPositions[a + 1] = trailPositions[b + 1]; trailPositions[a + 2] = trailPositions[b + 2]; }
        trailPositions[k * N * 3] = tip.x; trailPositions[k * N * 3 + 1] = tip.y; trailPositions[k * N * 3 + 2] = tip.z;
      }
      trailGeo.userData.filled = true;
      trailGeo.attributes.position.needsUpdate = true;
    }
    return prevPos;
  }

  // ---------- camera ----------
  function desiredCam() {
    let target, r, el;
    if (cam.mode === 'overview') { target = new T.Vector3(-2, 0, 4); r = 118; el = 1.0; }
    else if (cam.mode === 'spot' && cam.focusIdx >= 0) { target = spotPos(cam.focusIdx, 1.2); r = 16; el = 0.62; }
    else { target = plane.position.clone(); target.y -= 1.5; r = 24; el = 0.5; }
    return { target: target, r: r * cam.userR, el: Math.max(0.12, Math.min(1.45, el + cam.userEl)), az: cam.az + cam.userAz };
  }
  function updateCamera(dt, time) {
    if (!reduced && time - cam.lastInteract > 5) cam.az += dt * (cam.mode === 'overview' ? 0.02 : 0.045);
    const d = desiredCam();
    if (!cam.cur) cam.cur = { target: d.target.clone(), r: d.r, el: d.el, az: d.az };
    const k = Math.min(1, dt * (cam.mode === 'follow' ? 2.2 : 1.6));
    cam.cur.target.lerp(d.target, k);
    cam.cur.r += (d.r - cam.cur.r) * k;
    cam.cur.el += (d.el - cam.cur.el) * k;
    cam.cur.az += (d.az - cam.cur.az) * Math.min(1, dt * 4);
    const c = cam.cur;
    camera.position.set(c.target.x + Math.sin(c.az) * Math.cos(c.el) * c.r, c.target.y + Math.sin(c.el) * c.r, c.target.z + Math.cos(c.az) * Math.cos(c.el) * c.r);
    const minY = Math.max(0, heightAt(...xzToLonLat(camera.position.x, camera.position.z))) + 1.2;
    if (camera.position.y < minY) camera.position.y = minY;
    camera.lookAt(c.target);
  }
  function xzToLonLat(x, z) { return [x / (SCALE * COSL) + LON0, -z / SCALE + LAT0]; }

  function bindControls(el) {
    let drag = null, pinch = null;
    const pointers = new Map();
    el.addEventListener('pointerdown', function (e) {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) drag = { x: e.clientX, y: e.clientY, moved: 0 };
      if (pointers.size === 2) { const a = [...pointers.values()]; pinch = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); }
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', function (e) {
      mouse.x = (e.clientX / el.clientWidth) * 2 - 1; mouse.y = -(e.clientY / el.clientHeight) * 2 + 1;
      W._mouseClient = { x: e.clientX, y: e.clientY };
      if (!pointers.has(e.pointerId)) return;
      const prev = pointers.get(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2 && pinch) {
        const a = [...pointers.values()], d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
        cam.userR = Math.max(0.3, Math.min(2.2, cam.userR * pinch / d)); pinch = d; cam.lastInteract = clock.elapsedTime; return;
      }
      if (drag) {
        const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
        drag.moved += Math.abs(dx) + Math.abs(dy);
        cam.userAz -= dx * 0.005; cam.userEl += dy * 0.004;
        cam.userEl = Math.max(-0.9, Math.min(0.9, cam.userEl));
        cam.lastInteract = clock.elapsedTime;
      }
    });
    function end(e) {
      if (drag && drag.moved < 6 && pointers.size === 1) {
        if (hovered >= 0 && opts.onPick) opts.onPick(hovered);
      }
      pointers.delete(e.pointerId); if (pointers.size < 2) pinch = null; if (!pointers.size) drag = null;
    }
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    el.addEventListener('pointerleave', function () { mouse.set(-9, -9); });
    el.addEventListener('wheel', function (e) {
      e.preventDefault();
      cam.userR = Math.max(0.3, Math.min(2.2, cam.userR * Math.exp(e.deltaY * 0.0012)));
      cam.lastInteract = clock.elapsedTime;
    }, { passive: false });
  }

  function updateHover() {
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(pins.map(p => p.hit), false);
    const idx = hits.length ? hits[0].object.userData.index : -1;
    if (idx !== hovered) {
      hovered = idx;
      renderer.domElement.style.cursor = idx >= 0 ? 'pointer' : 'grab';
    }
    if (opts.onHover) {
      if (hovered >= 0) {
        const p = pins[hovered].head.getWorldPosition(new T.Vector3()).project(camera);
        const rect = renderer.domElement.getBoundingClientRect();
        opts.onHover(hovered, { x: (p.x * 0.5 + 0.5) * rect.width, y: (-p.y * 0.5 + 0.5) * rect.height });
      } else opts.onHover(-1);
    }
  }

  function applyTheme(dt) {
    const k = dt == null ? 1 : Math.min(1, dt * 1.2);
    ['top', 'horizon', 'sun', 'hemiSky', 'hemiGround', 'deep', 'shallow', 'glint'].forEach(function (key) { theme[key].lerp(themeTarget[key], k); });
    theme.sunDir.lerp(themeTarget.sunDir, k).normalize();
    ['sunI', 'hemiI', 'stars', 'city', 'fogNear', 'fogFar'].forEach(function (key) { theme[key] += (themeTarget[key] - theme[key]) * k; });
    sky.material.uniforms.uTop.value.copy(theme.top); sky.material.uniforms.uHorizon.value.copy(theme.horizon);
    sky.material.uniforms.uSun.value.copy(theme.sun); sky.material.uniforms.uSunDir.value.copy(theme.sunDir);
    const ou = ocean.material.uniforms;
    ou.uDeep.value.copy(theme.deep); ou.uShallow.value.copy(theme.shallow); ou.uGlint.value.copy(theme.glint); ou.uHorizon.value.copy(theme.horizon); ou.uSunDir.value.copy(theme.sunDir);
    sunLight.color.copy(theme.sun); sunLight.intensity = theme.sunI; sunLight.position.copy(theme.sunDir).multiplyScalar(100);
    hemi.color.copy(theme.hemiSky); hemi.groundColor.copy(theme.hemiGround); hemi.intensity = theme.hemiI;
    scene.fog.color.copy(theme.horizon); scene.fog.near = theme.fogNear; scene.fog.far = theme.fogFar;
    starPts.material.opacity = theme.stars; cityPts.material.opacity = theme.city;
  }

  function loop() {
    const dt = Math.min(0.05, clock.getDelta()), time = clock.elapsedTime;
    applyTheme(dt);
    ocean.material.uniforms.uTime.value = time;
    ocean.material.uniforms.uCam.value.copy(camera.position);
    cloudGroup.children.forEach(function (c) {
      c.position.x += c.userData.speed * dt; if (c.position.x > 80) c.position.x = -80;
      // clouds melt away before they can fill the lens
      const d = c.position.distanceTo(camera.position), k = Math.max(0, Math.min(1, (d - 12) / 14));
      c.scale.setScalar(c.userData.base * k); c.visible = k > 0.02;
    });
    updatePlane(dt, time);
    pins.forEach(function (p, i) {
      p.t += dt;
      p.head.rotation.y += dt * (p.state === 'locked' ? 0.3 : 1.2);
      p.head.position.y = p.stemH + 0.34 + (p.state === 'locked' ? 0 : Math.sin(p.t * 2) * 0.08);
      const hs = hovered === i ? 1.35 : 1;
      const pulse = p.state === 'next' ? 1 + Math.sin(p.t * 4) * 0.15 : 1;
      p.head.scale.setScalar(hs * pulse);
      p.ring.scale.setScalar(p.state === 'next' ? 1 + ((p.t * 0.8) % 1) * 1.6 : 1);
      if (p.state === 'next') p.ring.material.opacity = 0.8 * (1 - ((p.t * 0.8) % 1));
      if (p.beam.visible) p.beam.material.uniforms.uOp.value = (0.22 + theme.stars * 0.3) * (0.85 + Math.sin(p.t * 1.5) * 0.15);
    });
    if (sparkles) {
      sparkles.rotation.y += dt * 0.05;
      sparkles.material.opacity = 0.6 + Math.sin(time * 3) * 0.3;
    }
    updateCamera(dt, time);
    updateHover();
    renderer.render(scene, camera);
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    if (panelShift || panelShiftY) camera.setViewOffset(w, h, -panelShift, -panelShiftY, w, h); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }

  W.init = function (o) {
    opts = o; spots = o.spots; reduced = !!o.reducedMotion;
    renderer = new T.WebGLRenderer({ canvas: o.canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    scene = new T.Scene();
    scene.fog = new T.Fog(0xf4b56a, 140, 460);
    camera = new T.PerspectiveCamera(42, 1, 0.3, 2400);
    clock = new T.Clock();
    theme = themeVals(o.mode || 'focus'); themeTarget = themeVals(o.mode || 'focus');
    sky = makeSky(); scene.add(sky);
    starPts = makeStars(); scene.add(starPts);
    ocean = makeOcean(); scene.add(ocean);
    hemi = new T.HemisphereLight(0xffffff, 0x333333, 0.8); scene.add(hemi);
    sunLight = new T.DirectionalLight(0xffffff, 1.5); scene.add(sunLight);
    scene.add(new T.AmbientLight(0xffffff, 0.12));
    terrain = buildTerrain(); scene.add(terrain);
    cityPts = makeCities(); scene.add(cityPts);
    cloudGroup = makeClouds(); scene.add(cloudGroup);
    makePins();
    plane = makePlane(); scene.add(plane);
    scene.add(makeTrail());
    unlocked = o.unlocked || 0;
    const startIdx = unlocked - 1;
    plane.position.copy(circlePoint(circleCenter(startIdx), 0, cruiseAlt(startIdx)));
    planeState = { mode: 'circle', idx: startIdx, ang: 0 };
    refreshPins(); rebuildRoute(); applyTheme();
    bindControls(o.canvas);
    window.addEventListener('resize', resize); resize();
    renderer.setAnimationLoop(loop);
    return W;
  };

  W.setTheme = function (mode) { themeTarget = themeVals(THEMES[mode] ? mode : 'focus'); };

  // Advance progress. New destinations are flown to one after another.
  W.setProgress = function (n, animate, onArrive) {
    n = Math.max(0, Math.min(spots.length, n));
    if (onArrive) arrivalCb = onArrive;
    const prev = unlocked; unlocked = n;
    refreshPins(); rebuildRoute();
    if (n < prev || !animate) {
      arrivalQueue = [];
      const idx = n - 1;
      planeState = { mode: 'circle', idx: idx, ang: 0 };
      plane.position.copy(circlePoint(circleCenter(idx), 0, cruiseAlt(idx)));
      trailGeo.userData.filled = false;
      return;
    }
    for (let i = prev; i < n; i++) arrivalQueue.push(i);
    cam.mode = 'follow'; cam.userR = 1; cam.userEl = 0;
    if (planeState.mode === 'circle') startTransit(arrivalQueue.shift());
  };

  W.view = function (mode, idx) {
    cam.mode = mode; cam.focusIdx = idx == null ? -1 : idx;
    cam.userAz = 0; cam.userEl = 0; cam.userR = 1;
  };
  W.getView = function () { return cam.mode; };
  W.setPanelShift = function (px, py) { panelShift = px || 0; panelShiftY = py || 0; if (renderer) resize(); };
  W.setReducedMotion = function (v) { reduced = v; };

  W.celebrate = function () {
    if (sparkles) return;
    const n = 900, p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const s = spots[i % spots.length], xz = toXZ(s.lon, s.lat); p[i * 3] = xz[0] + (Math.random() - 0.5) * 6; p[i * 3 + 1] = 3 + Math.random() * 16; p[i * 3 + 2] = xz[1] + (Math.random() - 0.5) * 6; }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(p, 3));
    sparkles = new T.Points(g, new T.PointsMaterial({ color: 0xffd27a, size: 0.35, transparent: true, opacity: 0.8, depthWrite: false, blending: T.AdditiveBlending }));
    scene.add(sparkles);
    W.setTheme('finale'); W.view('overview');
  };
  W.endCelebration = function () { if (sparkles) { scene.remove(sparkles); sparkles = null; } };

  W.heightAt = heightAt;
  window.GHWorld = W;
})();
