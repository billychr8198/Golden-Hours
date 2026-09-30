/* Golden Hours — sound synthesizer.
   The same recipes render the .wav files in assets/audio and act as an
   in-browser fallback when files can't be fetched (e.g. opened via file://). */
(function (root) {
  'use strict';

  function makeRng(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Soft bell-ish tone: a few partials with exponential decay.
  function addTone(buf, sr, start, freq, opts) {
    const o = Object.assign({ amp: 0.5, tau: 1.2, partials: [[1, 1], [2, 0.3], [3, 0.1]], attack: 0.006, dur: 3, vibrato: 0 }, opts || {});
    const i0 = Math.floor(start * sr);
    const n = Math.min(buf.length - i0, Math.floor(o.dur * sr));
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const env = Math.min(1, t / o.attack) * Math.exp(-t / o.tau);
      const vib = o.vibrato ? 1 + o.vibrato * Math.sin(2 * Math.PI * 5.5 * t) * Math.min(1, t * 3) : 1;
      let v = 0;
      for (let p = 0; p < o.partials.length; p++) {
        const pr = o.partials[p];
        const ptau = pr[2] ? pr[2] : 1;
        v += pr[1] * Math.sin(2 * Math.PI * freq * pr[0] * vib * t) * (ptau === 1 ? 1 : Math.exp(-t / (o.tau * ptau)) / Math.exp(-t / o.tau));
      }
      buf[i0 + i] += o.amp * env * v;
    }
  }

  function normalize(buf, peak) {
    let m = 0;
    for (let i = 0; i < buf.length; i++) m = Math.max(m, Math.abs(buf[i]));
    if (m > 0) { const k = peak / m; for (let i = 0; i < buf.length; i++) buf[i] *= k; }
    // gentle fade-out at the tail
    const f = Math.min(buf.length, Math.floor(0.05 * 44100));
    for (let i = 0; i < f; i++) buf[buf.length - 1 - i] *= i / f;
    return buf;
  }

  const recipes = {
    // Classic two-tone cabin chime: "bing ... bong"
    'cabin-chime': function (sr) {
      const b = new Float32Array(Math.floor(sr * 2.8));
      const P = [[1, 1], [2, 0.18, 0.5], [3, 0.06, 0.35], [4.02, 0.03, 0.25]];
      addTone(b, sr, 0.0, 659.25, { amp: 0.55, tau: 0.95, partials: P, dur: 2.8 });
      addTone(b, sr, 0.62, 523.25, { amp: 0.55, tau: 1.15, partials: P, dur: 2.1 });
      return normalize(b, 0.85);
    },
    // Three-tone "attendant call" rising chime — used for arrivals.
    'arrival-chime': function (sr) {
      const b = new Float32Array(Math.floor(sr * 3.0));
      const P = [[1, 1], [2, 0.2, 0.5], [3, 0.07, 0.3]];
      addTone(b, sr, 0.0, 523.25, { amp: 0.5, tau: 1.0, partials: P });
      addTone(b, sr, 0.33, 659.25, { amp: 0.5, tau: 1.0, partials: P });
      addTone(b, sr, 0.66, 783.99, { amp: 0.55, tau: 1.3, partials: P });
      addTone(b, sr, 0.66, 1046.5, { amp: 0.12, tau: 1.0, partials: P });
      return normalize(b, 0.85);
    },
    // Brass desk bell at the boarding gate: ding-ding.
    'boarding-bell': function (sr) {
      const b = new Float32Array(Math.floor(sr * 2.6));
      const P = [[1, 1], [2.32, 0.55, 0.6], [4.25, 0.35, 0.35], [6.63, 0.18, 0.2], [0.5, 0.12, 1.4]];
      addTone(b, sr, 0.0, 1318.5, { amp: 0.5, tau: 0.8, partials: P, attack: 0.002 });
      addTone(b, sr, 0.42, 1318.5, { amp: 0.45, tau: 1.0, partials: P, attack: 0.002 });
      return normalize(b, 0.8);
    },
    // Jet fly-by: filtered noise swelling past, with a Doppler whine.
    'jet-flyby': function (sr) {
      const dur = 4.2, n = Math.floor(sr * dur);
      const b = new Float32Array(n);
      const rnd = makeRng(1414);
      let lp = 0, lp2 = 0, brown = 0, ph = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const x = (t - 1.9) / 0.85;
        const env = Math.exp(-x * x) * 0.95 + 0.05 * Math.exp(-t);
        const cutoff = 400 + 2600 * Math.exp(-x * x);
        const a = 1 - Math.exp(-2 * Math.PI * cutoff / sr);
        const w = rnd() * 2 - 1;
        brown = (brown + 0.02 * w) * 0.998;
        lp += a * (w - lp); lp2 += a * (lp - lp2);
        const f = 1650 - 350 * (1 / (1 + Math.exp(-(t - 1.9) * 4)));
        ph += 2 * Math.PI * f / sr;
        b[i] = env * (0.75 * lp2 + 1.6 * brown + 0.05 * Math.sin(ph) * Math.exp(-x * x));
      }
      return normalize(b, 0.85);
    },
    // Short bugle-style fanfare for the finale.
    'fanfare': function (sr) {
      const b = new Float32Array(Math.floor(sr * 4.2));
      const brass = [[1, 1], [2, 0.7], [3, 0.5], [4, 0.32], [5, 0.2], [6, 0.12], [7, 0.07]];
      const notes = [[0, 392.0, .22], [0.24, 523.25, .22], [0.48, 659.25, .22], [0.72, 783.99, .5], [1.28, 659.25, .2], [1.52, 783.99, 1.9]];
      notes.forEach(function (nt) {
        addTone(b, sr, nt[0], nt[1], { amp: 0.25, tau: nt[2] * 1.4 + 0.2, partials: brass, attack: 0.03, dur: nt[2] + 0.9, vibrato: nt[2] > 1 ? 0.004 : 0 });
      });
      addTone(b, sr, 1.52, 392.0, { amp: 0.14, tau: 2.0, partials: brass, attack: 0.05, dur: 2.6 });
      addTone(b, sr, 1.52, 523.25, { amp: 0.14, tau: 2.0, partials: brass, attack: 0.05, dur: 2.6 });
      // snare-ish roll under the last chord
      const rnd = makeRng(7);
      for (let k = 0; k < 14; k++) {
        const s = Math.floor((1.5 + k * 0.07) * sr);
        for (let i = 0; i < sr * 0.06 && s + i < b.length; i++) b[s + i] += (rnd() * 2 - 1) * 0.05 * Math.exp(-i / (sr * 0.015)) * (1 - k / 16);
      }
      return normalize(b, 0.82);
    },
    // Tiny UI click for the start button.
    'click': function (sr) {
      const b = new Float32Array(Math.floor(sr * 0.09));
      addTone(b, sr, 0, 1800, { amp: 0.4, tau: 0.012, partials: [[1, 1], [1.5, 0.4]], attack: 0.001, dur: 0.09 });
      addTone(b, sr, 0, 240, { amp: 0.5, tau: 0.02, partials: [[1, 1]], attack: 0.001, dur: 0.09 });
      return normalize(b, 0.6);
    }
  };

  function toWav(samples, sr) {
    const n = samples.length, buffer = new ArrayBuffer(44 + n * 2), v = new DataView(buffer);
    function str(o, s) { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); }
    str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    str(36, 'data'); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) { const s = Math.max(-1, Math.min(1, samples[i])); v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true); }
    return buffer;
  }

  const api = { recipes: recipes, toWav: toWav, render: function (name, sr) { return recipes[name](sr || 44100); } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GHSynth = api;
})(typeof window !== 'undefined' ? window : this);
